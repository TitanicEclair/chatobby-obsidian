import { htmlToMarkdown, type App, type Component } from "obsidian";
import type { ExtensionPanelAction, FeedBlock, ThinkingDisplay, ThinkingDisplayMode } from "../../types";
import { chatobbyPerformance } from "../../frontend/performance-monitor";
import {
  blockId,
  feedSelectors,
  type FeedCommit,
  type FeedStore,
  type FeedSubscription,
} from "../../features/feed/public";
import { ChatobbyComponent } from "../shared/component";
import { SCROLL_BOTTOM_THRESHOLD_PX, STREAM_TEXT_DEBOUNCE_MS } from "../shared/constants";
import { CompactionBlockView } from "./compaction-block";
import { ExtensionPanelBlockView } from "./extension-panel-block";
import { preserveComposerFocusForFeedControl } from "./feed-focus";
import { blocksToSource } from "./source-serializer";
import type { InteractionCard } from "./interaction-card";
import { QueuedMessageBlockView } from "./queued-message-block";
import { SubagentBlockView } from "./subagent-block";
import { SubagentCommunicationBlockView } from "./subagent-communication-block";
import { TextBlockView } from "./text-block";
import { ThinkingBlockView } from "./thinking-block";
import { ToolBlockView } from "./tools/tool-block";
import { TurnSummaryView } from "./turn-summary";
import { UserBlockView } from "./user-block";
import { hasLiveTiming, isInteractiveTarget, isTickable, renderKeyForCommit } from "./feed-render-policy";

/** Narrow presentation commands exposed to feed block views. */
export interface FeedViewActions {
  setScroll(isAtBottom: boolean, scrollTop: number): void;
  setThinkingDisplay(blockIdValue: string, mode: ThinkingDisplayMode): void;
  setSummaryExpanded(blockIdValue: string, expanded: boolean): void;
  setToolBlockExpanded(blockIdValue: string, expanded: boolean): void;
  setToolExpanded(toolCallIdValue: string, expanded: boolean): void;
}
/** Stable host boundary used by feed presentation components. */
export interface FeedHost {
  app: App;
  component: Component;
  getFeedStore(): FeedStore;
  feedViewActions: FeedViewActions;
  getAutoScroll(): boolean;
  getThinkingDisplay(): ThinkingDisplay;
  renderMarkdown(markdown: string, container: HTMLElement): void | Promise<void>;
  scrollFeed(): void;
  openVaultLink(path: string): void;
  openSystemPath(path: string): void;
  copyToClipboard(text: string): void;
  onExtensionPanelAction?(action: ExtensionPanelAction): void;
  onAutoScrollChange(enabled: boolean): void;
  onCompactionRequest(): void;
  onEmptyPrompt?(prompt: string): void;
  onFeedEscape?(): void;
  renderEmptyState?(container: HTMLElement): void;
  getCurrentSubagentNodeId?(): string | null;
}
interface BlockMount {
  id: string;
  element: HTMLElement;
  view?: ChatobbyComponent;
}

const TICK_THROTTLE_MS = 250;
const FIXED_RENDER_INTERVAL_MS = STREAM_TEXT_DEBOUNCE_MS;

/** Commit-driven renderer for one active normalized feed store. */
export class FeedRenderer extends ChatobbyComponent {
  private scrollEl: HTMLElement | null = null;
  private blocksEl: HTMLElement | null = null;
  private interactionsEl: HTMLElement | null = null;
  private sourceEl: HTMLTextAreaElement | null = null;
  private jumpPillEl: HTMLElement | null = null;
  private readonly blockMounts = new Map<string, BlockMount>();
  private store: FeedStore;
  private storeSubscription: FeedSubscription | null = null;
  private readonly pendingChangedIds = new Set<string>();
  private readonly pendingRemovedIds = new Set<string>();
  private pendingOrderChanged = false;
  private pendingDocumentChanged = false;
  private tickRaf: ReturnType<typeof requestAnimationFrame> | null = null;
  private lastTick = 0;
  private renderTimer: ReturnType<typeof setInterval> | null = null;
  private contentDirty = false;
  private lastRenderTime = 0;
  private scrollRaf = 0;
  private bottomPinned: boolean;
  private userScrollIntentUntil = 0;
  private lastObservedScrollTop = 0;
  /** Re-pins a following reader when content grows after a flush (late height
   *  changes from markdown/highlight/image/embed loads fire no scroll event). */
  private contentResizeObserver: ResizeObserver | null = null;
  private pinRaf = 0;
  private autoScroll: boolean;
  private viewMode: "reading" | "source" = "reading";
  private sourceDirty = true;
  private active = true;
  private dirtyWhileInactive = false;
	private pendingInteraction: InteractionCard | null | undefined;

  constructor(private readonly host: FeedHost) {
    super();
    this.store = host.getFeedStore();
    this.autoScroll = host.getAutoScroll();
    this.bottomPinned = this.store.select(feedSelectors.scroll).isAtBottom;
  }

  bind(feedEl: HTMLElement): void {
    this.render(feedEl);
  }

  /** Changes the active tab store and mounts its current projection once. */
  switchStore(store: FeedStore): void {
    this.storeSubscription?.dispose();
    this.store = store;
    this.bottomPinned = store.select(feedSelectors.scroll).isAtBottom;
    this.storeSubscription = store.subscribe((commit) => this.onCommit(commit));
    this.resetPendingCommit();
    if (this.blocksEl && this.active) this.renderFullStore();
    else this.dirtyWhileInactive = true;
  }

  /** Suspend presentation work while another Chatobby screen covers the feed. */
  setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (!active) {
      this.stopRenderTimer();
      if (this.tickRaf) cancelAnimationFrame(this.tickRaf);
      this.tickRaf = null;
      if (this.pinRaf) cancelAnimationFrame(this.pinRaf);
      this.pinRaf = 0;
      this.contentResizeObserver?.disconnect();
      return;
    }
    if (this.blocksEl) this.contentResizeObserver?.observe(this.blocksEl);
	if (this.pendingInteraction !== undefined && this.interactionsEl) {
		this.interactionsEl.empty();
		this.pendingInteraction?.render(this.interactionsEl);
		this.pendingInteraction = undefined;
	}
    if (this.dirtyWhileInactive) {
      this.dirtyWhileInactive = false;
      this.flushPendingCommit();
    }
    const blocks = this.currentBlocks();
    this.syncLiveTimer(blocks);
	this.updateJumpPill(this.store.select(feedSelectors.scroll).isAtBottom);
    this.maybeScrollToBottom();
  }

  mountInteraction(card: InteractionCard): void {
	if (!this.active) {
		this.pendingInteraction = card;
		return;
	}
    if (!this.interactionsEl) return;
    this.interactionsEl.empty();
    card.render(this.interactionsEl);
    this.maybeScrollToBottom();
  }

  clearInteraction(): void {
	if (!this.active) {
		this.pendingInteraction = null;
		return;
	}
    this.interactionsEl?.empty();
  }

  scrollToBottom(): void {
    this.bottomPinned = true;
    if (this.scrollEl) this.scrollEl.scrollTo({ top: this.scrollEl.scrollHeight });
    else this.host.scrollFeed();
    this.lastObservedScrollTop = this.scrollEl?.scrollTop ?? this.lastObservedScrollTop;
    this.commitScroll(true, this.scrollEl?.scrollTop ?? 0);
  }

  setAutoScroll(on: boolean): void {
    this.autoScroll = on;
    this.host.onAutoScrollChange(on);
    if (on) this.scrollToBottom();
  }

  /** Apply persisted feed display preferences to the already-mounted view. */
  refreshDisplaySettings(): void {
    this.autoScroll = this.host.getAutoScroll();
    if (this.blocksEl) this.renderFullStore();
  }

  focusFeed(): void {
    this.scrollEl?.focus();
  }

  setCompacting(on: boolean, reason?: string): void {
    this.container?.toggleClass("is-compacting", on);
    this.container?.setAttr("aria-label", reason ?? "");
  }

  renderEmptyState(): void {
    if (!this.blocksEl || this.blocksEl.querySelector(".chatobby-feed__empty")) return;
    const empty = this.blocksEl.createDiv({ cls: "chatobby-feed__empty" });
    if (this.host.renderEmptyState) {
      this.host.renderEmptyState(empty);
      return;
    }
    empty.createDiv({ cls: "chatobby-feed__empty-title", text: "Chatobby" });
    empty.createDiv({
      cls: "chatobby-feed__empty-copy",
      text: "Chatobby can reason across your vault, help shape a plan, and carry the work through with you.",
    });
    const capabilities = empty.createDiv({ cls: "chatobby-feed__empty-capabilities", attr: { "aria-label": "Example capabilities" } });
    for (const prompt of ["Understand this note", "Plan vault work", "Continue a project"]) {
      const button = capabilities.createEl("button", { text: prompt, attr: { type: "button" } });
      button.addEventListener("click", () => this.host.onEmptyPrompt?.(prompt));
    }
  }

  clear(): void {
    this.storeSubscription?.dispose();
    this.storeSubscription = null;
    super.clear();
    this.scrollEl = null;
    this.blocksEl = null;
    this.interactionsEl = null;
    this.sourceEl = null;
    this.jumpPillEl = null;
    this.destroyBlockMounts();
    this.stopRenderTimer();
    this.contentResizeObserver?.disconnect();
    this.contentResizeObserver = null;
    if (this.pinRaf) cancelAnimationFrame(this.pinRaf);
    this.pinRaf = 0;
    if (this.tickRaf) cancelAnimationFrame(this.tickRaf);
    this.tickRaf = null;
  }

  protected onRender(container: HTMLElement): void {
    this.scrollEl = container.createDiv({ cls: "chatobby-feed__scroll" });
    this.scrollEl.tabIndex = 0;
    this.scrollEl.setAttr("role", "region");
    this.scrollEl.setAttr("aria-label", "Conversation feed");
    this.blocksEl = this.scrollEl.createDiv({ cls: "chatobby-feed__blocks" });
    this.blocksEl.setAttr("role", "document");
    this.blocksEl.setAttr("aria-readonly", "true");
    this.blocksEl.setAttr("aria-label", "Conversation text");
    this.interactionsEl = this.scrollEl.createDiv({ cls: "chatobby-feed__interactions" });
    this.sourceEl = this.scrollEl.createEl("textarea", {
      cls: "chatobby-feed__source",
      attr: { readonly: "true", "aria-label": "Conversation source" },
    });
    this.jumpPillEl = container.createEl("button", { cls: "chatobby-feed__jump-pill is-hidden", text: "Latest" });
    this.jumpPillEl.onclick = () => this.scrollToBottom();
    this.scrollEl.addEventListener("scroll", () => this.onScroll());
    this.scrollEl.addEventListener("wheel", (event) => this.onWheel(event), { passive: true });
    this.scrollEl.addEventListener("pointerdown", (event) => this.onPointerScrollIntent(event), true);
    this.scrollEl.addEventListener("pointerdown", preserveComposerFocusForFeedControl, true);
    this.scrollEl.addEventListener("copy", (event) => this.copySelectionAsMarkdown(event));
    this.scrollEl.addEventListener("keydown", (event) => {
      this.onKeyScrollIntent(event);
      this.handleFeedKeydown(event);
    });
    // Late content growth after a flush needs an observer to re-pin (see onContentResized).
    this.contentResizeObserver = new ResizeObserver(() => this.onContentResized());
    this.contentResizeObserver.observe(this.blocksEl);
    this.syncViewMode();
    this.switchStore(this.host.getFeedStore());
  }

  protected componentClass(): string {
    return "chatobby-feed-renderer";
  }

  /** Public entry point for the tab bar source-view toggle button. */
  toggleSourceViewMode(): void {
    this.viewMode = this.viewMode === "reading" ? "source" : "reading";
    this.syncViewMode();
    if (this.viewMode === "source") {
      this.syncSourceTextIfVisible(this.currentBlocks(), true);
      this.sourceEl?.focus();
    } else {
      this.scrollEl?.focus();
    }
  }

  private onCommit(commit: FeedCommit): void {
    this.mergeCommit(commit);
    if (!this.active) {
      this.dirtyWhileInactive = true;
      return;
    }
    const renderKey = renderKeyForCommit(commit);
    if (!renderKey || renderKey.flush || renderKey.delayMs === 0) {
      this.flushPendingCommit();
      return;
    }
    this.contentDirty = true;
    this.ensureRenderTimer();
  }

  private mergeCommit(commit: FeedCommit): void {
    for (const id of commit.changes.addedBlockIds) this.pendingChangedIds.add(id);
    for (const id of commit.changes.updatedBlockIds) this.pendingChangedIds.add(id);
    for (const id of commit.changes.removedBlockIds) this.pendingRemovedIds.add(id);
    this.pendingOrderChanged ||= commit.changes.orderChanged;
    this.pendingDocumentChanged ||= commit.changes.documentChanged;
	if (this.active && commit.changes.scrollChanged) {
		this.updateJumpPill(this.store.select(feedSelectors.scroll).isAtBottom);
	}
  }

  private flushPendingCommit(): void {
    if (!this.blocksEl || !this.active) {
      this.dirtyWhileInactive = true;
      return;
    }
    const order = this.store.select(feedSelectors.orderedBlockIds);
    const visibleIds = new Set(order);
    this.blocksEl.querySelector(".chatobby-feed__empty")?.remove();
    for (const id of this.pendingRemovedIds) this.removeMount(id);
    for (const id of this.pendingChangedIds) {
      if (!visibleIds.has(blockId(id))) continue;
      const block = this.store.select(feedSelectors.blockById(blockId(id)));
      if (!block) continue;
      const mount = this.mountForBlock(block);
      this.renderBlock(mount.element, block, mount);
    }
    if (this.pendingOrderChanged) this.reconcileBlockOrder(order);
    if (order.length === 0) this.renderEmptyState();
    if (this.pendingDocumentChanged) this.sourceDirty = true;
    const blocks = this.currentBlocks();
    this.syncSourceTextIfVisible(blocks);
    this.syncLiveTimer(blocks);
    this.scrollEl?.setAttr("aria-busy", String(hasLiveTiming(this.store, blocks)));
    this.resetPendingCommit();
	chatobbyPerformance.recordRetainedDomNodes(this.blocksEl.querySelectorAll("*").length);
    this.maybeScrollToBottom();
  }

  private renderFullStore(): void {
    if (!this.blocksEl) return;
    this.destroyBlockMounts();
    this.blocksEl.empty();
    const order = this.store.select(feedSelectors.orderedBlockIds);
    for (const id of order) {
      const block = this.store.select(feedSelectors.blockById(id));
      if (!block) continue;
      const mount = this.mountForBlock(block);
      this.blocksEl.appendChild(mount.element);
      this.renderBlock(mount.element, block, mount);
    }
    if (order.length === 0) this.renderEmptyState();
    const blocks = this.currentBlocks();
    this.sourceDirty = true;
    this.syncSourceTextIfVisible(blocks);
    this.restoreScroll();
    const scroll = this.store.select(feedSelectors.scroll);
    this.updateJumpPill(scroll.isAtBottom);
    this.syncLiveTimer(blocks);
    this.scrollEl?.setAttr("aria-busy", String(hasLiveTiming(this.store, blocks)));
	chatobbyPerformance.recordRetainedDomNodes(this.blocksEl.querySelectorAll("*").length);
  }

  private currentBlocks(): FeedBlock[] {
    return this.store.select(feedSelectors.orderedBlockIds)
      .map((id) => this.store.select(feedSelectors.blockById(id)))
      .filter((block): block is FeedBlock => block !== undefined);
  }

  private mountForBlock(block: FeedBlock): BlockMount {
    const existing = this.blockMounts.get(block.id);
    if (existing) return existing;
    const element = document.createElement("div");
    element.className = `chatobby-feed__block chatobby-feed__block--${block.type}`;
    element.setAttr("role", "article");
    element.dataset.blockId = block.id;
    const mount = { id: block.id, element };
    this.blockMounts.set(block.id, mount);
    return mount;
  }

  private renderBlock(element: HTMLElement, block: FeedBlock, mount: BlockMount): void {
    element.className = `chatobby-feed__block chatobby-feed__block--${block.type}`;
    const existing = mount.view;
    if (existing && canReuseView(block, existing)) {
      updateView(existing, block);
      return;
    }
    existing?.destroy();
    element.empty();
    const view = createView(this.host, block);
    view.render(element);
    if (view instanceof UserBlockView && (block.type === "user" || block.type === "system")) {
      view.setMessage(block.message, block.type);
    }
    mount.view = view;
  }

  private reconcileBlockOrder(order: readonly string[]): void {
    if (!this.blocksEl) return;
    const visibleIds = new Set(order);
    for (const element of Array.from(this.blocksEl.children)) {
      if (!(element instanceof HTMLElement)) continue;
      const id = element.dataset.blockId;
      if (id && !visibleIds.has(id)) element.remove();
    }
    let cursor = this.blocksEl.firstElementChild;
    for (const id of order) {
      const element = this.blockMounts.get(id)?.element;
      if (!element) continue;
      if (element !== cursor) this.blocksEl.insertBefore(element, cursor);
      cursor = element.nextElementSibling;
    }
  }

  private removeMount(id: string): void {
    const mount = this.blockMounts.get(id);
    mount?.view?.destroy();
    mount?.element.remove();
    this.blockMounts.delete(id);
  }

  private destroyBlockMounts(): void {
    for (const mount of this.blockMounts.values()) mount.view?.destroy();
    this.blockMounts.clear();
  }

  private restoreScroll(): void {
    if (!this.scrollEl) return;
    const scroll = this.store.select(feedSelectors.scroll);
    this.bottomPinned = scroll.isAtBottom;
    if (scroll.isAtBottom && this.autoScroll) this.scrollToBottom();
    else this.scrollEl.scrollTop = scroll.scrollTop;
    this.lastObservedScrollTop = this.scrollEl.scrollTop;
  }

  private maybeScrollToBottom(): void {
    if (this.autoScroll && this.bottomPinned) this.scrollToBottom();
  }

  /** Content can keep growing after a flush (markdown/highlight/image/embed
   *  loads fire no scroll event), so a following reader drifts above the new
   *  bottom on large blocks. Re-pin only while following — never yank a reader
   *  who scrolled up — and coalesce to one scroll per animation frame. */
  private onContentResized(): void {
    if (!this.active || this.pinRaf) return;
    this.pinRaf = requestAnimationFrame(() => {
      this.pinRaf = 0;
      if (!this.scrollEl) return;
      if (this.autoScroll && this.bottomPinned) {
        this.scrollEl.scrollTop = this.scrollEl.scrollHeight;
        this.commitScroll(true, this.scrollEl.scrollTop);
      }
    });
  }

  private handleFeedKeydown(event: KeyboardEvent): void {
    if (isInteractiveTarget(event.target)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.host.onFeedEscape?.();
    }
  }

  private copySelectionAsMarkdown(event: ClipboardEvent): void {
    if (this.viewMode !== "reading" || !this.blocksEl || !event.clipboardData) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const common = range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (!common || (!this.blocksEl.contains(common) && common !== this.blocksEl)) return;
    const wrapper = document.createElement("div");
    wrapper.appendChild(range.cloneContents());
    for (const control of Array.from(wrapper.querySelectorAll("button, [aria-hidden='true']"))) control.remove();
    const markdown = htmlToMarkdown(wrapper).trim();
    if (!markdown) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", markdown);
    event.clipboardData.setData("text/markdown", markdown);
  }

  private syncViewMode(): void {
    const sourceMode = this.viewMode === "source";
    this.container?.toggleClass("is-source-mode", sourceMode);
    this.container?.toggleClass("is-reading-mode", !sourceMode);
  }

  private syncSourceTextIfVisible(blocks: readonly FeedBlock[], force = false): void {
    if (!this.sourceEl || this.viewMode !== "source" || (!force && !this.sourceDirty)) return;
    const source = blocksToSource(blocks);
    if (this.sourceEl.value !== source) this.sourceEl.value = source;
    this.sourceDirty = false;
  }

  private onScroll(): void {
    if (!this.scrollEl || this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      if (!this.scrollEl) return;
      const { scrollTop, scrollHeight, clientHeight } = this.scrollEl;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const explicitUserScroll = Date.now() <= this.userScrollIntentUntil;
      const explicitlyScrolledUp = explicitUserScroll && scrollTop < this.lastObservedScrollTop - 1;
      this.lastObservedScrollTop = scrollTop;
      if (this.bottomPinned && !explicitUserScroll) {
        if (this.autoScroll && distanceFromBottom >= SCROLL_BOTTOM_THRESHOLD_PX) this.onContentResized();
        this.commitScroll(true, scrollTop);
        this.updateJumpPill(true);
        return;
      }
      const isAtBottom = !explicitlyScrolledUp && distanceFromBottom < SCROLL_BOTTOM_THRESHOLD_PX;
      this.bottomPinned = isAtBottom;
      this.commitScroll(isAtBottom, scrollTop);
      this.updateJumpPill(isAtBottom);
    });
  }

  private onWheel(event: WheelEvent): void {
    this.markUserScrollIntent();
    if (!this.scrollEl || event.deltaY >= 0 || !this.bottomPinned) return;
    this.bottomPinned = false;
    this.commitScroll(false, this.scrollEl.scrollTop);
    this.updateJumpPill(false);
  }

  private onPointerScrollIntent(event: PointerEvent): void {
    if (event.target === this.scrollEl || event.pointerType === "touch") this.markUserScrollIntent();
  }

  private onKeyScrollIntent(event: KeyboardEvent): void {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
      this.markUserScrollIntent();
    }
  }

  private markUserScrollIntent(): void {
    this.userScrollIntentUntil = Date.now() + 1_000;
  }

  private updateJumpPill(isAtBottom: boolean): void {
    this.jumpPillEl?.toggleClass("is-hidden", isAtBottom);
  }

  private commitScroll(isAtBottom: boolean, scrollTop: number): void {
    const current = this.store.select(feedSelectors.scroll);
    if (current.isAtBottom === isAtBottom && current.scrollTop === scrollTop) return;
    this.host.feedViewActions.setScroll(isAtBottom, scrollTop);
  }

  private ensureRenderTimer(): void {
    if (!this.active || this.renderTimer) return;
    this.lastRenderTime = Date.now();
    this.renderTimer = setInterval(() => {
      if (!this.contentDirty) return;
      const now = Date.now();
      if (now - this.lastRenderTime < FIXED_RENDER_INTERVAL_MS) return;
      this.lastRenderTime = now;
      this.contentDirty = false;
      this.flushPendingCommit();
    }, Math.max(16, FIXED_RENDER_INTERVAL_MS >> 1));
  }

  private stopRenderTimer(): void {
    if (this.renderTimer) clearInterval(this.renderTimer);
    this.renderTimer = null;
  }

  private syncLiveTimer(blocks: readonly FeedBlock[]): void {
    const needsTimer = this.active && hasLiveTiming(this.store, blocks);
    if (needsTimer && !this.tickRaf) {
      this.lastTick = 0;
      this.scheduleTick();
    } else if (!needsTimer && this.tickRaf) {
      cancelAnimationFrame(this.tickRaf);
      this.tickRaf = null;
      this.stopRenderTimer();
    }
  }

  private scheduleTick(): void {
    if (!this.active) return;
    this.tickRaf = requestAnimationFrame(() => {
      this.tickRaf = null;
      const now = Date.now();
      if (now - this.lastTick >= TICK_THROTTLE_MS) {
        this.lastTick = now;
        for (const mount of this.blockMounts.values()) if (isTickable(mount.view)) mount.view.tick();
      }
      if (this.active && [...this.blockMounts.values()].some((mount) => isTickable(mount.view))) this.scheduleTick();
    });
  }

  private resetPendingCommit(): void {
    this.pendingChangedIds.clear();
    this.pendingRemovedIds.clear();
    this.pendingOrderChanged = false;
    this.pendingDocumentChanged = false;
    this.contentDirty = false;
  }
}

function canReuseView(block: FeedBlock, view: unknown): boolean {
  switch (block.type) {
    case "user":
    case "system": return view instanceof UserBlockView;
    case "text": return view instanceof TextBlockView;
    case "thinking": return view instanceof ThinkingBlockView;
    case "tools": return view instanceof ToolBlockView;
    case "summary": return view instanceof TurnSummaryView;
    case "compaction": return view instanceof CompactionBlockView;
    default: return false;
  }
}

function updateView(view: unknown, block: FeedBlock): void {
  switch (block.type) {
    case "text": (view as TextBlockView).setBlock(block); return;
    case "thinking": (view as ThinkingBlockView).setBlock(block); return;
    case "tools": (view as ToolBlockView).setBlock(block); return;
    case "summary": (view as TurnSummaryView).setSummary(block); return;
    case "user":
    case "system": (view as UserBlockView).setMessage(block.message, block.type); return;
    case "compaction": (view as CompactionBlockView).setBlock(block); return;
  }
}

function createView(host: FeedHost, block: FeedBlock): ChatobbyComponent {
  switch (block.type) {
    case "user":
    case "system": return new UserBlockView(host);
    case "text": return new TextBlockView(host, block);
    case "thinking": return new ThinkingBlockView(host, block);
    case "tools": return new ToolBlockView(host, block);
    case "summary": return new TurnSummaryView(host, block);
    case "queued": return new QueuedMessageBlockView(block);
    case "compaction": return new CompactionBlockView(host, block);
    case "subagent": return new SubagentBlockView(block);
    case "subagent-communication": return new SubagentCommunicationBlockView(block, host);
    case "extension-panel": return new ExtensionPanelBlockView(host, block);
  }
}
