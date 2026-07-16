// Tests for the adjacency cache + cooperative lexical scan in VaultRetrievalService.
// See docs/frontend-architecture-refactor.md §8/§9 and the retrieval refactor plan.

import { afterEach, describe, expect, it } from "vitest";
import { createMockApp } from "./helpers/mock-app";
import { getVaultRetrievalService, disposeVaultRetrievalService } from "../../src/obsidian-bridge/retrieval/service";
import { buildAdjacency } from "../../src/obsidian-bridge/operations/helpers/retrieval-graph";

const apps: unknown[] = [];

afterEach(() => {
  for (const app of apps.splice(0)) disposeVaultRetrievalService(app as never);
});

function appWithLinks() {
  const app = createMockApp(
    new Map([
      ["alpha.md", "alpha project atlas"],
      ["beta.md", "beta project neighbor"],
      ["gamma.md", "gamma unrelated"],
    ]),
    {
      resolvedLinks: {
        "alpha.md": { "beta.md": 1 },
        "beta.md": { "gamma.md": 2 },
      },
    },
  ) as ReturnType<typeof createMockApp> & { vault: { __emit(name: string, file?: unknown): void } };
  apps.push(app);
  return app;
}

describe("VaultRetrievalService adjacency cache", () => {
  it("exposes the same adjacency as a fresh buildAdjacency(resolvedLinks)", () => {
    const app = appWithLinks();
    const service = getVaultRetrievalService(app);
    const resolved = (app.metadataCache as unknown as { resolvedLinks?: Record<string, Record<string, number>> }).resolvedLinks ?? {};
    const fresh = buildAdjacency(resolved);
    const cached = service.adjacency();
    expect(cached.nodes).toEqual(fresh.nodes);
    expect(cached.outgoing).toEqual(fresh.outgoing);
    expect(cached.incoming).toEqual(fresh.incoming);
  });

  it("memoizes the adjacency across calls (same reference)", () => {
    const app = appWithLinks();
    const service = getVaultRetrievalService(app);
    const first = service.adjacency();
    const second = service.adjacency();
    expect(second).toBe(first);
  });

  it("recomputes the adjacency after a vault modify event", () => {
    const app = appWithLinks();
    const service = getVaultRetrievalService(app);
    const before = service.adjacency();
    app.vault.__emit("modify", { path: "alpha.md" });
    const after = service.adjacency();
    expect(after).not.toBe(before);
    // Shape is still equivalent for unchanged link data.
    expect(after.nodes).toEqual(before.nodes);
  });

  it("recomputes after create/delete/rename events too", () => {
    const app = appWithLinks();
    const service = getVaultRetrievalService(app);
    const original = service.adjacency();
    for (const event of ["create", "delete", "rename"] as const) {
      app.vault.__emit(event);
      const next = service.adjacency();
      expect(next).not.toBe(original);
    }
  });

  it("dispose clears the singleton so a fresh service can be created and caches normally", () => {
    const app = appWithLinks();
    const first = getVaultRetrievalService(app);
    first.adjacency();
    disposeVaultRetrievalService(app);
    const second = getVaultRetrievalService(app);
    expect(second).not.toBe(first);
    const cached = second.adjacency();
    expect(second.adjacency()).toBe(cached);
  });
});

describe("VaultRetrievalService lexical scan", () => {
  it("returns matching hits with stable order (chunking preserves results)", async () => {
    const app = appWithLinks();
    const service = getVaultRetrievalService(app);
    const envelope = await service.explore("alpha", "lexical", 50);
    const paths = (envelope.semanticHits ?? []).map((hit) => hit.path);
    expect(paths).toContain("alpha.md");
  });

  it("throws DEADLINE_EXCEEDED promptly when the signal is already aborted", async () => {
    const app = appWithLinks();
    const service = getVaultRetrievalService(app);
    const ac = new AbortController();
    ac.abort();
    await expect(service.explore("alpha", "lexical", 50, undefined, ac.signal)).rejects.toMatchObject({
      code: "DEADLINE_EXCEEDED",
    });
  });
});
