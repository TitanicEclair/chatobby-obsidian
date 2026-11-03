import { afterEach, describe, expect, it, vi } from "vitest";
import { ObsidianSemanticContextService } from "../../src/obsidian-context/semantic-context-service";
import { createMockApp, createMockFile } from "../obsidian-bridge/helpers/mock-app";

describe("ObsidianSemanticContextService", () => {
  it("includes non-markdown tabs after the first leaf with truthful coverage", async () => {
    const app = createMockApp(new Map([["First.md", "first"]]), { activeView: { path: "First.md" } });
    for (const type of ["chatobby-view", "chatobby-workspace-page", "webviewer"]) {
      await app.workspace.getLeaf("tab").setViewState({ type });
    }
    const service = new ObsidianSemanticContextService(app);
    const projection = service.contextProjection({ scope: "workspace", limit: 50 });
    expect(projection).toMatchObject({ coverage: { kind: "exact", returned: 4, total: 4, hasMore: false } });
    expect(service.snapshot().workspace.leaves.map(leaf => leaf.viewType)).toEqual([
      "markdown", "chatobby-view", "chatobby-workspace-page", "webviewer",
    ]);
    service.dispose();
  });

  it("does not label a chat with the last active Markdown file", async () => {
    const app = createMockApp(new Map([["Previous.md", "previous"]]), { activeView: { path: "Previous.md" } });
    const chat = app.workspace.getLeaf("tab");
    await chat.setViewState({ type: "chatobby-view" });
    vi.spyOn(chat, "getViewState").mockReturnValue({ type: "chatobby-view", state: {} });
    Reflect.deleteProperty(chat.view, "file");
    app.workspace.getActiveFile = () => createMockFile("Previous.md", "previous");
    app.workspace.setActiveLeaf(chat);
    const service = new ObsidianSemanticContextService(app);
    expect(service.snapshot().focus).toMatchObject({ viewType: "chatobby-view" });
    expect(service.snapshot().focus).not.toHaveProperty("path");
    expect(service.snapshot().openNotes).toContainEqual(expect.objectContaining({ path: "Previous.md", isActive: false }));
    service.dispose();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("projects the active editor buffer and honors include/maxOpenNotes", () => {
    const app = createMockApp(
      new Map([
        ["Active.md", "saved value"],
        ["Other.md", "other"],
      ]),
      {
        activeView: {
          path: "Active.md",
          content: "# Live\nunsaved editor value\n\nUnsaved Setext\n---\n\n```\n# Not a heading\n```",
          cursor: { line: 1, ch: 7 },
          selection: "editor",
        },
        openNotes: ["Other.md"],
        cache: new Map([
          ["Active.md", {
            headings: [{ heading: "Stale saved heading", level: 1, position: { start: { line: 0 } } }],
          }],
        ]),
      },
    );
    const service = new ObsidianSemanticContextService(
      app,
      () => new Date("2026-07-27T00:00:00.000Z"),
    );

    const minimal = service.contextProjection({
      include: ["activeNote", "cursor", "openNotes"],
      maxOpenNotes: 1,
    });
    expect(minimal).toMatchObject({
      schemaVersion: 2,
      capturedAt: "2026-07-27T00:00:00.000Z",
      activeNote: {
        path: "Active.md",
        fromLine: 1,
        toLine: 8,
      },
      cursor: { line: 2, ch: 7 },
      coverage: { openNotes: { returned: 1, total: 2, truncated: true } },
    });
    expect(minimal.openNotes).toHaveLength(1);
    expect((minimal.activeNote as { excerpt: string }).excerpt).toContain("unsaved editor value");
    expect(minimal).not.toHaveProperty("selection");
    expect(minimal).not.toHaveProperty("headings");
    const complete = service.snapshot();
    expect(complete.headings).toEqual([
      expect.objectContaining({ level: 1, text: "Live", line: 1 }),
      expect.objectContaining({ level: 2, text: "Unsaved Setext", line: 4 }),
    ]);
    service.dispose();
  });

  it("reports a non-markdown active view without borrowing another note as active", async () => {
    const app = createMockApp(
      new Map([
        ["Active.pdf", "binary-placeholder"],
        ["Other.md", "other"],
      ]),
      {
        activeView: { path: "Active.pdf" },
        openNotes: ["Other.md"],
      },
    );
    const activeLeaf = (app.workspace as unknown as {
      activeLeaf?: { setViewState?(state: { type: string }): Promise<void> };
    }).activeLeaf;
    await activeLeaf?.setViewState?.({ type: "pdf" });
    const service = new ObsidianSemanticContextService(app);

    const snapshot = service.snapshot();

    expect(snapshot.focus).toMatchObject({ viewType: "pdf", path: "Active.pdf" });
    expect(snapshot.activeNote).toBeUndefined();
    expect(snapshot.warnings).toContain("NO_ACTIVE_NOTE: The active view is not a markdown note");
    service.dispose();
  });

  it("coalesces invalidations and advances each affected revision once", async () => {
    vi.useFakeTimers();
    const app = createMockApp(
      new Map([["Active.md", "content"]]),
      { activeView: { path: "Active.md" } },
    );
    const service = new ObsidianSemanticContextService(
      app,
      () => new Date("2026-07-27T00:00:00.000Z"),
    );
    const events: unknown[] = [];
    service.onChange((event) => events.push(event));

    service.invalidate(["focus", "workspace"]);
    service.invalidate(["editor"]);
    await vi.advanceTimersByTimeAsync(75);

    expect(events).toEqual([
      {
        type: "context_changed",
        sequence: 2,
        capturedAt: "2026-07-27T00:00:00.000Z",
        changed: ["focus", "workspace", "editor"],
        revisions: { workspace: 2, editor: 2, page: 2, capabilities: 1 },
      },
    ]);
    expect(service.diagnostics()).toMatchObject({
      captures: 0,
      emittedEvents: 1,
      invalidations: 2,
      coalescedInvalidations: 1,
    });
    service.dispose();
  });

  it("reuses the immutable cached snapshot until an event invalidates it", () => {
    vi.useFakeTimers();
    const app = createMockApp(
      new Map([["Active.md", "content"]]),
      { activeView: { path: "Active.md" } },
    );
    const service = new ObsidianSemanticContextService(app);

    expect(service.snapshot()).toBe(service.snapshot());
    expect(service.diagnostics().captures).toBe(1);
    service.invalidate(["editor"]);
    const revised = service.snapshot();
    expect(revised.revisions.editor).toBe(2);
    expect(service.diagnostics().captures).toBe(2);
    service.dispose();
  });

  it("captures on demand after coalesced invalidation and preserves boolean layout state", () => {
    vi.useFakeTimers();
    const app = createMockApp(
      new Map([["Active.md", "content"]]),
      { activeView: { path: "Active.md" } },
    );
    const workspace = app.workspace as unknown as {
      getLayout(): Record<string, unknown>;
    };
    workspace.getLayout = () => ({
      left: { id: "left", type: "split", collapsed: true },
    });
    let measurement = 0;
    const service = new ObsidianSemanticContextService(
      app,
      () => new Date("2026-07-27T00:00:00.000Z"),
      () => {
        measurement += 2;
        return measurement;
      },
    );
    service.invalidate(["workspace"]);

    const snapshot = service.snapshot();

    expect(snapshot.workspace.layout).toMatchObject({
      left: { id: "left", type: "split", collapsed: true },
    });
    expect(service.diagnostics()).toMatchObject({
      captures: 1,
      emittedEvents: 1,
      lastCaptureMs: 2,
      maxCaptureMs: 2,
    });
    service.dispose();
  });

  it("pages workspace leaves with revision-bound cursors and inspects regions and leaves", () => {
    const app = createMockApp(
      new Map([
        ["Active.md", "active"],
        ["Other.md", "other"],
      ]),
      {
        activeView: { path: "Active.md" },
        openNotes: ["Other.md"],
      },
    );
    const service = new ObsidianSemanticContextService(app);

    const first = service.contextProjection({ scope: "workspace", limit: 1 });
    expect(first).toMatchObject({
      scope: "workspace",
      workspace: { leaves: [expect.objectContaining({ path: "Active.md" })] },
      coverage: { kind: "exact", returned: 1, total: 2, hasMore: true },
    });
    const nextCursor = (first.coverage as { nextCursor?: string }).nextCursor;
    expect(nextCursor).toBeTypeOf("string");
    const second = service.contextProjection({ scope: "workspace", cursor: nextCursor });
    expect(second).toMatchObject({
      workspace: { leaves: [expect.objectContaining({ path: "Other.md" })] },
      coverage: { returned: 1, total: 2, hasMore: false },
    });

    expect(service.contextProjection({ scope: "region", regionId: "main-tabs" })).toMatchObject({
      region: { id: "main-tabs", type: "tabs" },
      coverage: { returned: 1, hasMore: false },
    });
    const leafId = (first.workspace as { leaves: Array<{ leafId: string }> }).leaves[0]!.leafId;
    expect(service.contextProjection({ scope: "leaf", leafId })).toMatchObject({
      leaf: { leafId, path: "Active.md", isActive: true },
      activeView: { path: "Active.md" },
    });

    service.invalidate(["workspace"]);
    expect(() => service.contextProjection({ scope: "workspace", cursor: nextCursor }))
      .toThrow("REVISION_CONFLICT");
    service.dispose();
  });
});
