import { describe, expect, it, vi } from "vitest";
import type { ViewState, WorkspaceLeaf } from "obsidian";
import type ChatobbyPlugin from "../../src/main";
import { VIEW_TYPE_CHATOBBY_PAGE, WorkspacePageRegistry, WorkspacePageView } from "../../src/ui/workspace/workspace-tabs";
import { VIEW_TYPE_CHATOBBY } from "../../src/view-type";

vi.mock("../../src/ui/workspace/workspace-pages", () => ({
  workspacePageTitle: (state: { mode: string }) => state.mode,
  WorkspacePage: class {
    readonly element = document.createElement("div");
    onClose = () => {};
    start = vi.fn(async () => {});
    dispose = vi.fn(async () => {});
    constructor(readonly plugin: unknown, readonly state: { mode: string }, readonly id = crypto.randomUUID()) {
      this.element.append(document.createElement("textarea"));
    }
  },
}));

function harness() {
  const leaves: WorkspaceLeaf[] = [];
  const layoutReady: Array<() => void> = [];
  const revealLeaf = vi.fn(async (_leaf: WorkspaceLeaf) => {});
  const plugin = { app: { workspace: {
    getLeavesOfType: () => leaves,
    getLeaf: vi.fn(() => createLeaf()),
    revealLeaf,
    onLayoutReady: (callback: () => void) => layoutReady.push(callback),
  } } } as unknown as ChatobbyPlugin;
  Object.assign(plugin, { workspacePages: new WorkspacePageRegistry(plugin) });
  function createLeaf(saved?: ViewState) {
    let state: ViewState = saved ?? { type: "empty" };
    let view: WorkspacePageView | undefined;
    const leaf = {
      get view() { return view; },
      get isDeferred() { return !view; },
      getViewState: () => state,
      loadIfDeferred: vi.fn(async () => { if (!view) await leaf.setViewState(state); }),
      setViewState: vi.fn(async (next: ViewState) => {
        state = next;
        view ??= new WorkspacePageView(leaf as unknown as WorkspaceLeaf, plugin);
        await view.onOpen();
        await view.setState(next.state, {});
      }),
      detach: vi.fn(() => { leaves.splice(leaves.indexOf(leaf as unknown as WorkspaceLeaf), 1); void view?.onClose(); }),
    };
    leaves.push(leaf as unknown as WorkspaceLeaf);
    return leaf;
  }
  return { plugin, leaves, createLeaf, layoutReady, revealLeaf };
}

describe("native Obsidian workspace pages", () => {
  it("restores background page titles without focus, duplicates or unrelated view changes", async () => {
    const h = harness();
    const saved = h.createLeaf({ type: VIEW_TYPE_CHATOBBY_PAGE, state: { schemaVersion: 2, pageId: crypto.randomUUID(), page: { mode: "memory" } } });
    const unrelated = h.createLeaf({ type: "markdown", state: { file: "Keep.md" } });
    await h.plugin.workspacePages.restoreNativeLeaves();
    await h.plugin.workspacePages.restoreNativeLeaves();
    expect(saved.view?.getDisplayText()).toBe("Chatobby – memory");
    expect(saved.loadIfDeferred).toHaveBeenCalledOnce();
    expect(unrelated.loadIfDeferred).not.toHaveBeenCalled();
    expect(h.revealLeaf).not.toHaveBeenCalled();
    expect(h.leaves).toHaveLength(2);
  });

  it("stops deferred chat restoration when the plugin unloads", async () => {
    const h = harness();
    const chat = h.createLeaf({ type: VIEW_TYPE_CHATOBBY, state: { sessionTitle: "Saved chat" } });
    const later = h.createLeaf({ type: VIEW_TYPE_CHATOBBY_PAGE, state: { page: { mode: "events" } } });
    chat.loadIfDeferred.mockImplementationOnce(async () => { h.plugin.workspacePages.dispose(); });
    await h.plugin.workspacePages.restoreNativeLeaves();
    expect(chat.loadIfDeferred).toHaveBeenCalledOnce();
    expect(later.loadIfDeferred).not.toHaveBeenCalled();
    expect(h.revealLeaf).not.toHaveBeenCalled();
  });

  it("coalesces layout events and restores a leaf deferred after the initial snapshot", async () => {
    const h = harness();
    const chat = h.createLeaf({ type: VIEW_TYPE_CHATOBBY, state: { sessionTitle: "Saved chat" } });
    let late: ReturnType<typeof h.createLeaf> | undefined;
    chat.loadIfDeferred.mockImplementationOnce(async () => {
      await chat.setViewState({ type: VIEW_TYPE_CHATOBBY, state: {} });
      late = h.createLeaf({ type: VIEW_TYPE_CHATOBBY_PAGE, state: { page: { mode: "settings" } } });
      void h.plugin.workspacePages.restoreNativeLeaves();
    });
    const first = h.plugin.workspacePages.restoreNativeLeaves();
    expect(h.plugin.workspacePages.restoreNativeLeaves()).toBe(first);
    await first;
    expect(chat.loadIfDeferred).toHaveBeenCalledOnce();
    expect(late?.loadIfDeferred).toHaveBeenCalledOnce();
    expect(late?.view?.getDisplayText()).toBe("Chatobby – settings");
    expect(h.revealLeaf).not.toHaveBeenCalled();
  });

  it("continues restoring other saved tabs if one fails to load", async () => {
    const h = harness();
    const failed = h.createLeaf({ type: VIEW_TYPE_CHATOBBY, state: { sessionTitle: "Saved chat" } });
    const next = h.createLeaf({ type: VIEW_TYPE_CHATOBBY_PAGE, state: { page: { mode: "events" } } });
    failed.loadIfDeferred.mockImplementationOnce(async () => {
      void h.plugin.workspacePages.restoreNativeLeaves();
      throw new Error("Synthetic restore failure");
    });
    await h.plugin.workspacePages.restoreNativeLeaves();
    expect(failed.loadIfDeferred).toHaveBeenCalledOnce();
    expect(next.view?.getDisplayText()).toBe("Chatobby – events");
    expect(h.revealLeaf).not.toHaveBeenCalled();
  });

  it("opens one native leaf for simultaneous requests and preserves its draft on refocus", async () => {
    const h = harness();
    const [page, repeated] = await Promise.all([h.plugin.workspacePages.open({ mode: "memory" }), h.plugin.workspacePages.open({ mode: "memory" })]);
    expect(page).toBe(repeated);
    expect(h.leaves).toHaveLength(1);
    expect(h.leaves[0]?.getViewState().type).toBe(VIEW_TYPE_CHATOBBY_PAGE);
    const draft = page.element.querySelector("textarea")!;
    draft.value = "Keep this unfinished memory";
    await h.plugin.workspacePages.open({ mode: "events" });
    expect(await h.plugin.workspacePages.open({ mode: "memory" })).toBe(page);
    expect(draft.value).toBe("Keep this unfinished memory");
    expect(page.dispose).not.toHaveBeenCalled();
    expect(h.leaves).toHaveLength(2);
    expect(h.leaves[0]?.view.getDisplayText()).toBe("Chatobby – memory");
    expect(page.element.querySelector('[role="tablist"]')).toBeNull();
  });

  it("loads an existing deferred native leaf without creating a duplicate", async () => {
    const h = harness();
    const id = crypto.randomUUID();
    const leaf = h.createLeaf({ type: VIEW_TYPE_CHATOBBY_PAGE, state: { schemaVersion: 2, pageId: id, page: { mode: "permissions" } } });
    const page = await h.plugin.workspacePages.open({ mode: "permissions" });
    expect(page.id).toBe(id);
    expect(leaf.loadIfDeferred).toHaveBeenCalledOnce();
    expect(h.leaves).toHaveLength(1);
  });

  it("treats omitted legacy subagent defaults as the same native conversation", async () => {
    const h = harness();
    const page = await h.plugin.workspacePages.open({ mode: "subagents", runId: "run-a", nodeId: "node-a", feedOnly: true });
    expect(await h.plugin.workspacePages.open({ mode: "subagents", runId: "run-a", nodeId: "node-a", feedOnly: true, subagentTab: "runs" })).toBe(page);
    expect(h.leaves).toHaveLength(1);
  });

  it("migrates valid legacy pages once without stealing focus or closing other leaves", async () => {
    const h = harness();
    const id = crypto.randomUUID();
    const saved = { schemaVersion: 1, pages: [{ id, state: { mode: "memory" } }, null, { id: "invalid", state: { mode: "events" } }] };
    h.plugin.workspacePages.restoreLegacy(saved);
    h.plugin.workspacePages.restoreLegacy(saved);
    expect(h.leaves).toHaveLength(0);
    for (const callback of h.layoutReady) callback();
    await vi.waitFor(() => expect(h.leaves).toHaveLength(1));
    expect(h.plugin.workspacePages.find({ mode: "memory" })?.id).toBe(id);
    expect(h.revealLeaf).not.toHaveBeenCalled();
    h.plugin.workspacePages.dispose();
    expect(h.leaves).toHaveLength(1);
    expect(h.leaves[0]?.getViewState().state?.pageId).toBe(id);
  });

  it("releases page connections once on close and allows a fresh page to reopen", async () => {
    const h = harness();
    const page = await h.plugin.workspacePages.open({ mode: "memory" });
    const leaf = h.leaves[0]!;
    h.plugin.workspacePages.close(page);
    expect(leaf.detach).toHaveBeenCalledOnce();
    expect(page.dispose).toHaveBeenCalledOnce();
    expect(h.plugin.workspacePages.find({ mode: "memory" })).toBeUndefined();
    expect((await h.plugin.workspacePages.open({ mode: "memory" })).id).not.toBe(page.id);
  });
});
