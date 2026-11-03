import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createFeedStore, feedSelectors } from "../../src/features/feed/public";
import { FrontendStore } from "../../src/frontend/frontend-store";
import { synchronizeFrontendFeed } from "../../src/ui/controller/frontend-feed-sync";
import {
  parseFrontendNegotiationResult,
  parseFrontendPatch,
  parseFrontendSubscriptionResult,
  type FrontendBootstrap,
} from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { CAPTURE_ENCLOSING_TIMEOUT_MS, captureNode } from "./helpers/runtime-capture";

// @see docs/api/feed.md#paired-runtime-projection-regression
// Ordinary tests need no private checkout. check:backend-contract first requires
// a backend root, verifies its exact projection, and always runs this suite.
const backendRoot = process.env.CHATOBBY_BACKEND_ROOT;
describe.skipIf(!backendRoot)("runtime history through real connector feed stores", () => {
  let capture: ReturnType<typeof captureRuntime>;
  beforeAll(() => { capture = captureRuntime(); }, CAPTURE_ENCLOSING_TIMEOUT_MS);

  it("matches a fresh full bootstrap after streaming text and completed-turn folding", () => {
    const { frontend, feed } = stores(capture.initial.bootstrap);
    const originalWireBlock = frontend.snapshot!.feed.blocks[0];
    const originalRenderedBlock = blocks(feed)[0];
    let sequence = capture.initial.sequence;
    let revision = capture.initial.revision;
    let sawAppend = false;
    let sawFold = false;
    for (const patch of capture.patches) {
      expect(patch.sequence).toBe(++sequence);
      expect(patch.baseRevision).toBe(revision);
      expect(patch.revision).toBe(revision + 1);
      revision = patch.revision;
      expect(frontend.apply(patch)).toBe("applied");
      expect(frontend.snapshot!.feed.blocks[0]).toBe(originalWireBlock);
      expect(blocks(feed)[0]).toBe(originalRenderedBlock);
      sawAppend ||= patch.operations.some((operation) => operation.type === "feed.text.append");
      sawFold ||= frontend.snapshot!.feed.blocks.some((block) => block.type === "summary");
      const snapshot = frontend.snapshot;
      expect(frontend.apply(patch)).toBe("duplicate");
      expect(frontend.snapshot).toBe(snapshot);
    }
    expect(sawAppend).toBe(true);
    expect(sawFold).toBe(true);
    const restored = stores(capture.restored.bootstrap);
    expect(frontend.snapshot!.feed.blocks).toEqual(restored.frontend.snapshot!.feed.blocks);
    expect(blocks(feed)).toEqual(blocks(restored.feed));
    expect(frontend.snapshot!.session).toEqual(restored.frontend.snapshot!.session);
  });

  it("replays the missed contiguous tail through the same feed synchronization seam", () => {
    const resumed = stores(capture.initial.bootstrap);
    const live = stores(capture.initial.bootstrap);
    for (const patch of capture.patches) {
      live.frontend.apply(patch);
      if (patch.sequence <= capture.replay.baseSequence) resumed.frontend.apply(patch);
    }
    const oldBlock = blocks(resumed.feed)[0];
    resumed.frontend.applyReplay(capture.replay);
    expect(resumed.frontend.snapshot).toEqual(live.frontend.snapshot);
    expect(blocks(resumed.feed)).toEqual(blocks(live.feed));
    expect(blocks(resumed.feed)[0]).toBe(oldBlock);
    expect(resumed.frontend.snapshot!.sequence).toBe(capture.replay.sequence);
    expect(resumed.frontend.snapshot!.revision).toBe(capture.replay.revision);
    expect(capture.replay.replay).toEqual(capture.patches.filter((patch) => patch.sequence > capture.replay.baseSequence));
  });

  it("captures deterministic canonical envelopes with exact source and compiled provenance", () => {
    expect(captureRuntime()).toEqual(capture);
    expect(capture.provenance.sourceRevision).toMatch(/^[a-f0-9]{40}$/);
    expect(capture.provenance.files).toHaveLength(4);
    for (const file of capture.provenance.files) {
      expect(file.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.compiledSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(capture.negotiation.protocolVersion).toBe(2);
  }, CAPTURE_ENCLOSING_TIMEOUT_MS);
});

function captureRuntime() {
  if (!backendRoot) throw new Error("CHATOBBY_BACKEND_ROOT is required for the paired projection gate");
  const output = captureNode(path.join(backendRoot, "packages/chatobby/test/fixtures/frontend/capture-history.mjs"), backendRoot);
  const raw = JSON.parse(output) as {
    schemaVersion: number;
    provenance: { sourceRevision: string; files: { path: string; sourceSha256: string; compiledSha256: string }[] };
    negotiation: unknown; initial: unknown; patches: unknown[]; replay: unknown; restored: unknown;
  };
  expect(raw.schemaVersion).toBe(1);
  const initial = parseFrontendSubscriptionResult(raw.initial);
  const restored = parseFrontendSubscriptionResult(raw.restored);
  const replay = parseFrontendSubscriptionResult(raw.replay);
  if (initial.status !== "bootstrapped" || restored.status !== "bootstrapped" || replay.status !== "replayed") {
    throw new Error("Runtime fixture did not provide complete bootstrap/replay cuts");
  }
  return {
    provenance: raw.provenance, negotiation: parseFrontendNegotiationResult(raw.negotiation),
    initial, restored, replay, patches: raw.patches.map(parseFrontendPatch),
  };
}

function stores(bootstrap: FrontendBootstrap) {
  const frontend = new FrontendStore();
  const feed = createFeedStore();
  frontend.subscribe((snapshot) => synchronizeFrontendFeed(feed, snapshot));
  frontend.replace(bootstrap);
  return { frontend, feed };
}

function blocks(feed: ReturnType<typeof createFeedStore>) {
  return feed.select(feedSelectors.orderedBlockIds).map((id) => feed.select(feedSelectors.blockById(id)));
}
