import { describe, expect, it } from "vitest";
import {
  BrowserArtifactStore,
  type BrowserSemanticArtifact,
} from "../../src/obsidian-bridge/browser/artifact-store";

function artifact(documentId: string, leafId = "leaf-1", text = "content"): BrowserSemanticArtifact {
  return {
    documentId,
    revision: 1,
    leafId,
    capturedAt: "2026-07-27T00:00:00.000Z",
    page: { documentId, revision: 1 },
    metadata: {},
    root: {},
    blocks: [{ id: "b1", text, markdown: text }],
    outline: [],
    links: [],
    coverage: {},
    captureTruncated: false,
  };
}

describe("BrowserArtifactStore", () => {
  it("expires retained documents without silently recreating them", () => {
    let now = 0;
    const store = new BrowserArtifactStore(100, 10_000, () => now);
    store.put(artifact("doc-1"));
    expect(store.get("doc-1", 1)).toBeDefined();
    now = 101;
    expect(store.get("doc-1", 1)).toBeUndefined();
  });

  it("evicts least-recently-used documents and invalidates a closed leaf", () => {
    const sampleBytes = new TextEncoder().encode(JSON.stringify(artifact("doc-a", "leaf-a"))).byteLength;
    const store = new BrowserArtifactStore(10_000, sampleBytes * 2 + 32);
    store.put(artifact("doc-a", "leaf-a"));
    store.put(artifact("doc-b", "leaf-b"));
    expect(store.get("doc-a", 1)).toBeDefined();
    store.put(artifact("doc-c", "leaf-c"));

    expect(store.get("doc-b", 1)).toBeUndefined();
    expect(store.get("doc-a", 1)).toBeDefined();
    store.deleteLeaf("leaf-a");
    expect(store.get("doc-a", 1)).toBeUndefined();
  });
});
