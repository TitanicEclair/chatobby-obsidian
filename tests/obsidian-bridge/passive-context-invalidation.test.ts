import { MarkdownView, type App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObsidianBridgeClient } from "../../src/obsidian-bridge/bridge-client";
import {
  disposeObsidianSemanticContextService,
  getObsidianSemanticContextService,
} from "../../src/obsidian-context";
import { gatherAuthorizedPromptContext } from "../../src/prompt/authorized-context";
import { BRIDGE_READY_GRACE_MS } from "../../src/ui/shared/constants";
import type { WsPromptContextPacket } from "../../src/vendor/chatobby-client/connector-types.js";
import { createMockApp } from "./helpers/mock-app";

type Stamp = NonNullable<WsPromptContextPacket["obsidianVaultAccess"]>;
const allowed: Stamp = { sessionId: "session-a", vaultId: "vault-a", bindingRevision: 1, policyRevision: 2 };

/** In-memory transport only: no sockets, processes, files, or real Obsidian. */
class RecordingSocket {
  static instances: RecordingSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly frames: string[] = [];

  constructor(_url: string) { RecordingSocket.instances.push(this); }
  open(): void { this.readyState = 1; this.onopen?.(); }
  send(data: string): void { this.frames.push(data); }
  close(): void { this.readyState = 3; }
  contextFrames(): Record<string, unknown>[] {
    return this.frames.map((frame) => JSON.parse(frame) as Record<string, unknown>)
      .filter((frame) => frame.type === "context_changed");
  }
}

describe("passive bridge invalidations with prompt eligibility", () => {
  let app: App;
  let client: ObsidianBridgeClient;

  beforeEach(async () => {
    vi.useFakeTimers();
    RecordingSocket.instances = [];
    app = createMockApp(new Map([["Synthetic.md", "SYNTHETIC_SAVED"]]), {
      activeView: { path: "Synthetic.md", content: "SYNTHETIC_UNSAVED", selection: "SYNTHETIC_SELECTION" },
    });
    client = new ObsidianBridgeClient(app, "ws://fixture.invalid", "synthetic-bridge-token", "1.0.0", "0.4.3",
      RecordingSocket as unknown as typeof WebSocket);
    await client.connect();
    RecordingSocket.instances[0]!.open();
    await vi.advanceTimersByTimeAsync(BRIDGE_READY_GRACE_MS);
    expect(client.isReady).toBe(true);
  });

  afterEach(async () => {
    await client.disconnect();
    disposeObsidianSemanticContextService(app);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function collection() {
    const service = getObsidianSemanticContextService(app);
    const editor = app.workspace.getActiveViewOfType(MarkdownView)!.editor;
    const readValue = vi.spyOn(editor, "getValue");
    const readSelection = vi.spyOn(editor, "getSelection");
    const readStamp = vi.fn<() => Promise<Stamp | undefined>>(async () => undefined);
    const gather = vi.fn((): WsPromptContextPacket => {
      const snapshot = service.snapshot();
      return {
        schemaVersion: 2, source: "obsidian", vault: "Synthetic",
        activeNote: { path: snapshot.activeNote?.path, selection: snapshot.selection?.text },
        privacy: { included: ["active-note", "selection"], omitted: [] },
      };
    });
    const collect = () => gatherAuthorizedPromptContext({
      sessionId: "session-a", readStamp, isCurrentTarget: () => true, gather,
    });
    return { service, editor, readValue, readSelection, readStamp, gather, collect };
  }

  function expectMetadataOnly(socket: RecordingSocket): void {
    expect(socket.contextFrames()).not.toHaveLength(0);
    for (const frame of socket.contextFrames()) {
      expect(Object.keys(frame).sort()).toEqual(["capturedAt", "changed", "revisions", "sequence", "type"]);
      expect(JSON.stringify(frame)).not.toMatch(/Synthetic\.md|SYNTHETIC_|summary|path|focus"\s*:/u);
    }
  }

  it("does not read editor contents or send note metadata while eligibility is Off", async () => {
    const fixture = collection();
    fixture.service.invalidate(["focus", "editor", "page"]);
    await vi.advanceTimersByTimeAsync(75);
    expect(await fixture.collect()).toBeUndefined();
    expect(fixture.gather).not.toHaveBeenCalled();
    expect(fixture.readValue).not.toHaveBeenCalled();
    expect(fixture.readSelection).not.toHaveBeenCalled();
    expect(fixture.service.diagnostics().captures).toBe(0);
    expectMetadataOnly(RecordingSocket.instances[0]!);
  });

  it("stops collecting after revocation and refreshes only on a later eligible demand", async () => {
    const fixture = collection();
    fixture.readStamp.mockResolvedValue(allowed);
    expect(await fixture.collect()).toMatchObject({ obsidianVaultAccess: allowed });
    expect(fixture.readValue).toHaveBeenCalledOnce();
    fixture.readValue.mockClear();
    fixture.readSelection.mockClear();
    fixture.readStamp.mockResolvedValue(undefined);
    fixture.editor.setValue("SYNTHETIC_CHANGED_AFTER_REVOKE");
    fixture.service.invalidate(["editor"]);
    await vi.advanceTimersByTimeAsync(75);
    expect(await fixture.collect()).toBeUndefined();
    expect(fixture.readValue).not.toHaveBeenCalled();
    expect(fixture.readSelection).not.toHaveBeenCalled();
    expect(fixture.service.diagnostics().captures).toBe(1);
    expectMetadataOnly(RecordingSocket.instances[0]!);
    fixture.readStamp.mockResolvedValue({ ...allowed, policyRevision: 4 });
    expect(await fixture.collect()).toMatchObject({ obsidianVaultAccess: { policyRevision: 4 } });
    expect(fixture.readValue).toHaveBeenCalledOnce();
    expect(fixture.service.snapshot().activeNote?.excerpt).toContain("SYNTHETIC_CHANGED_AFTER_REVOKE");
    expect(fixture.service.snapshot().revisions.editor).toBe(2);
  });

  it("rebinds invalidation delivery without retaining collection eligibility or notifying the retired socket", async () => {
    const fixture = collection();
    fixture.readStamp.mockResolvedValue(allowed);
    await fixture.collect();
    fixture.readValue.mockClear();
    fixture.readSelection.mockClear();
    fixture.readStamp.mockResolvedValue(undefined);
    const retired = RecordingSocket.instances[0]!;
    const oldCount = retired.frames.length;
    await client.reconfigure("ws://other-fixture.invalid", "synthetic-next-token");
    const current = RecordingSocket.instances[1]!;
    current.open();
    await vi.advanceTimersByTimeAsync(BRIDGE_READY_GRACE_MS);
    fixture.service.invalidate(["focus", "workspace"]);
    await vi.advanceTimersByTimeAsync(75);
    expect(await fixture.collect()).toBeUndefined();
    expect(fixture.readValue).not.toHaveBeenCalled();
    expect(fixture.readSelection).not.toHaveBeenCalled();
    expect(retired.readyState).toBe(3);
    expect(retired.frames).toHaveLength(oldCount);
    expectMetadataOnly(current);
  });
});
