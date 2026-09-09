import { ItemView, Notice, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import type ChatobbyPlugin from "../../main";
import { VIEW_TYPE_CHATOBBY } from "../../view-type";
import { parseNavigationState } from "../controller/view-navigation-controller";
import { WorkspacePage, workspacePageTitle, type WorkspacePageState } from "./workspace-pages";

export const VIEW_TYPE_CHATOBBY_PAGE = "chatobby-workspace-page";
interface OwnedPage { page: WorkspacePage; leaf?: WorkspaceLeaf }

/** Native leaves own navigation; the page keeps its connection, controller and draft. */
export class WorkspacePageRegistry {
  private readonly pages = new Map<string, OwnedPage>();
  private readonly opening = new Map<string, Promise<WorkspacePage>>();
  private readonly migrated = new Set<string>();
  private nativeRestoreRequested = false;
  private nativeRestore: Promise<void> | undefined;
  private disposed = false;
  constructor(private readonly plugin: ChatobbyPlugin) {}

  /** DeferredView has no plugin title; restore saved Chatobby leaves without activating them. */
  restoreNativeLeaves(): Promise<void> {
    this.nativeRestoreRequested = true;
    this.nativeRestore ??= Promise.resolve().then(async () => {
      const attempted = new Set<WorkspaceLeaf>();
      while (this.nativeRestoreRequested && !this.disposed) {
        this.nativeRestoreRequested = false;
        await this.restoreDeferredLeaves(attempted);
      }
    }).finally(() => { this.nativeRestore = undefined; });
    return this.nativeRestore;
  }

  private async restoreDeferredLeaves(attempted: Set<WorkspaceLeaf>): Promise<void> {
    const workspace = this.plugin.app.workspace;
    const leaves = new Set([
      ...workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY),
      ...workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY_PAGE),
    ]);
    for (const leaf of leaves) {
      if (this.disposed) return;
      const type = leaf.getViewState().type;
      if (attempted.has(leaf) || !leaf.isDeferred || (type !== VIEW_TYPE_CHATOBBY && type !== VIEW_TYPE_CHATOBBY_PAGE)) continue;
      attempted.add(leaf);
      try { await leaf.loadIfDeferred(); }
      catch { if (!this.disposed) new Notice("A saved Chatobby tab could not reopen. Select its tab to retry."); }
    }
  }

  acquire(state: WorkspacePageState, id?: string): WorkspacePage {
    const existing = id ? this.pages.get(id) : undefined;
    if (existing) return existing.page;
    const page = new WorkspacePage(this.plugin, state, id);
    this.pages.set(page.id, { page });
    page.onClose = () => this.close(page);
    void page.start();
    return page;
  }

  find(state: WorkspacePageState): WorkspacePage | undefined {
    return [...this.pages.values()].find(({ page }) => pageKey(page.state) === pageKey(state))?.page;
  }

  async open(state: WorkspacePageState, id?: string, activate = true): Promise<WorkspacePage> {
    const key = pageKey(state);
    const pending = this.opening.get(key);
    if (pending) { const page = await pending; if (activate) this.focus(page); return page; }
    const existing = this.find(state);
    if (existing) { if (activate) this.focus(existing); return existing; }
    const operation = this.openLeaf(state, id, activate).finally(() => this.opening.delete(key));
    this.opening.set(key, operation);
    return operation;
  }

  private async openLeaf(state: WorkspacePageState, id: string | undefined, activate: boolean): Promise<WorkspacePage> {
    const saved = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY_PAGE).find((leaf) => {
      const value = leaf.getViewState().state;
      return value && pageKey(parseNavigationState(value.page) as WorkspacePageState) === pageKey(state);
    });
    if (saved) {
      await saved.loadIfDeferred();
      const page = this.find(state);
      if (page) { if (activate) await this.plugin.app.workspace.revealLeaf(saved); return page; }
    }
    if (this.disposed) throw new Error("Chatobby is closing.");
    const page = this.acquire(state, id);
    const leaf = this.plugin.app.workspace.getLeaf("tab");
    try {
      await leaf.setViewState({ type: VIEW_TYPE_CHATOBBY_PAGE, active: activate, state: { schemaVersion: 2, pageId: page.id, page: page.state } });
      if (activate) await this.plugin.app.workspace.revealLeaf(leaf);
      return page;
    } catch (error) { this.release(page); leaf.detach(); throw error; }
  }

  attach(page: WorkspacePage, leaf: WorkspaceLeaf): void {
    const entry = this.pages.get(page.id);
    if (entry) entry.leaf = leaf;
  }

  focus(page: WorkspacePage): void {
    const leaf = this.pages.get(page.id)?.leaf;
    if (leaf) void this.plugin.app.workspace.revealLeaf(leaf);
  }

  close(page: WorkspacePage): void {
    const entry = this.pages.get(page.id);
    if (!entry) return;
    this.release(page);
    entry.leaf?.detach();
  }

  release(page: WorkspacePage): void {
    if (this.pages.get(page.id)?.page !== page) return;
    this.pages.delete(page.id);
    void page.dispose();
  }

  /** One-time migration from the former inner-tab layout, without touching chats. */
  restoreLegacy(value: unknown): void {
    if (!value || typeof value !== "object" || !("schemaVersion" in value) || value.schemaVersion !== 1 || !("pages" in value) || !Array.isArray(value.pages)) return;
    const records: readonly unknown[] = value.pages;
    for (const item of records) {
      if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string" || !("state" in item) || !/^[a-f0-9-]{36}$/u.test(item.id) || this.migrated.has(item.id)) continue;
      const state = parseNavigationState(item.state);
      if (state.mode === "chat") continue;
      const id = item.id;
      this.migrated.add(id);
      this.plugin.app.workspace.onLayoutReady(() => {
        if (this.disposed) return;
        void this.open(state as WorkspacePageState, id, false).catch(() => new Notice("A saved Chatobby page could not reopen. Open it from the sidebar."));
      });
    }
  }

  dispose(): void {
    this.disposed = true;
    // Keep native leaf state intact for Obsidian's normal plugin reload/restoration.
    for (const { page } of this.pages.values()) void page.dispose();
    this.pages.clear();
  }
}

export class WorkspacePageView extends ItemView {
  private page: WorkspacePage | null = null;
  constructor(leaf: WorkspaceLeaf, private readonly plugin: ChatobbyPlugin) { super(leaf); this.navigation = false; }
  getViewType(): string { return VIEW_TYPE_CHATOBBY_PAGE; }
  getDisplayText(): string { return this.page ? `Chatobby – ${workspacePageTitle(this.page.state)}` : "Chatobby"; }
  getIcon(): string { return "messages-square"; }
  async onOpen(): Promise<void> { this.contentEl.addClass("chatobby-workspace"); }
  async setState(value: unknown, result: ViewStateResult): Promise<void> {
    result.history = false;
    if (!value || typeof value !== "object" || !("page" in value)) return;
    const state = parseNavigationState(value.page);
    if (state.mode === "chat") return;
    const id = "pageId" in value && typeof value.pageId === "string" && /^[a-f0-9-]{36}$/u.test(value.pageId) ? value.pageId : undefined;
    if (this.page && this.page.id !== id) { const previous = this.page; this.page = null; this.plugin.workspacePages.release(previous); }
    this.page = this.plugin.workspacePages.acquire(state as WorkspacePageState, id);
    this.plugin.workspacePages.attach(this.page, this.leaf);
    this.contentEl.append(this.page.element);
    this.page.element.removeClass("is-hidden");
    await super.setState(value, result);
  }
  getState(): Record<string, unknown> { return this.page ? { schemaVersion: 2, pageId: this.page.id, page: this.page.state } : {}; }
  async onClose(): Promise<void> {
    const page = this.page; this.page = null;
    if (page) this.plugin.workspacePages.release(page);
  }
}

function pageKey(state: WorkspacePageState): string {
  return JSON.stringify([state.mode, state.runId, state.nodeId, state.feedOnly ?? false, state.projectId, state.channelId, state.messageId, state.pluginId, state.subagentTab ?? "runs"]);
}
