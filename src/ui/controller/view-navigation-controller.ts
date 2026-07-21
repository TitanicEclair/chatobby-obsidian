import type { WorkspaceLeaf } from "obsidian";

export type ChatobbyViewMode = "chat" | "session-picker" | "subagents" | "channels" | "permissions" | "memory" | "events" | "queries";
export type ChatobbySubagentTab = "runs" | "inbox" | "agents" | "workflows" | "settings";
export type ExclusiveViewSurface = "chat" | "session-picker" | "overlays" | "subagents" | "channels";

export interface ExclusiveViewSurfaceClosers {
  sessionPicker(): void;
  overlays(): void;
  subagents(): void;
  channels(): void;
}

export interface ChatobbyNavigationState {
  mode: ChatobbyViewMode;
  runId?: string;
  nodeId?: string;
  subagentTab?: ChatobbySubagentTab;
  feedOnly?: boolean;
  channelId?: string;
  messageId?: string;
}

/** Map internal routes onto the page ribbon without treating child feeds as management pages. */
export function ribbonModeForNavigation(
  viewMode: ChatobbyViewMode,
  state: ChatobbyNavigationState,
): ChatobbyViewMode {
  return viewMode === "subagents" && state.mode === "subagents" && state.feedOnly ? "chat" : viewMode;
}

/** Close every full-view surface except the one being entered. */
export function closeInactiveViewSurfaces(
  target: ExclusiveViewSurface,
  closers: ExclusiveViewSurfaceClosers,
): void {
  if (target !== "session-picker") closers.sessionPicker();
  if (target !== "overlays") closers.overlays();
  if (target !== "subagents") closers.subagents();
  if (target !== "channels") closers.channels();
}

interface NavigationHandlers {
  openChat: () => void;
  openPermissions: () => void;
  openMemory: () => void;
  openEvents: () => void;
  openQueries: () => void;
  openSubagents: (state: ChatobbyNavigationState) => void;
  openChannels: (state: ChatobbyNavigationState) => void;
  openSessionPicker: () => Promise<void>;
  getLeafSessionState?: () => { vaultDirectoryPath?: string; sessionPath?: string };
  onError: (error: unknown) => void;
}

interface WorkspaceLeafHistoryBridge {
  history?: {
    backHistory?: unknown[];
    forwardHistory?: unknown[];
  };
  trigger?: (name: string) => void;
}

/** Owns Obsidian history state and routes it to one mutually exclusive Chatobby screen. */
export class ViewNavigationController {
  private current: ChatobbyNavigationState = { mode: "chat" };
  private pendingHistoryIntent: { state: ChatobbyNavigationState; record: boolean } | null = null;
  private readonly leaf: WorkspaceLeaf;
  private readonly viewType: string;
  private readonly handlers: NavigationHandlers;

  constructor(leaf: WorkspaceLeaf, viewType: string, handlers: NavigationHandlers) {
    this.leaf = leaf;
    this.viewType = viewType;
    this.handlers = handlers;
  }

  state(): ChatobbyNavigationState {
    return { ...this.current };
  }

  shouldRecordHistory(state: ChatobbyNavigationState): boolean {
    const intent = this.pendingHistoryIntent;
    if (intent && sameNavigationState(intent.state, state)) {
      this.pendingHistoryIntent = null;
      return intent.record;
    }
    return !sameNavigationState(this.current, state);
  }

  navigate(state: ChatobbyNavigationState): void {
    void this.setState(state, true);
  }

  /** Replace the current Chatobby screen without appending another native history entry. */
  replace(state: ChatobbyNavigationState): Promise<void> {
    return this.setState(state, false);
  }

  /** Collapse the current Chatobby route to its main feed and discard stale page routes. */
  reset(): void {
    clearWorkspaceLeafNavigationHistory(this.leaf);
    void this.setState({ mode: "chat" }, false);
  }

  private async setState(state: ChatobbyNavigationState, recordHistory: boolean): Promise<void> {
    if (this.pendingHistoryIntent && sameNavigationState(this.pendingHistoryIntent.state, state)) return;
    if (!this.pendingHistoryIntent && sameNavigationState(this.current, state)) return;
    this.pendingHistoryIntent = { state: { ...state }, record: recordHistory };
    await this.leaf.setViewState({
      type: this.viewType,
      state: { ...this.handlers.getLeafSessionState?.(), ...state },
      active: true,
    })
      .catch((error: unknown) => {
        if (this.pendingHistoryIntent && sameNavigationState(this.pendingHistoryIntent.state, state)) {
          this.pendingHistoryIntent = null;
        }
        this.handlers.onError(error);
      });
  }

  async apply(state: ChatobbyNavigationState): Promise<void> {
    this.current = state;
    if (state.mode === "chat") this.handlers.openChat();
    else if (state.mode === "permissions") this.handlers.openPermissions();
    else if (state.mode === "memory") this.handlers.openMemory();
    else if (state.mode === "events") this.handlers.openEvents();
    else if (state.mode === "queries") this.handlers.openQueries();
    else if (state.mode === "subagents") this.handlers.openSubagents(state);
    else if (state.mode === "channels") this.handlers.openChannels(state);
    else await this.handlers.openSessionPicker();
  }
}

/**
 * Obsidian exposes history recording through ViewStateResult but currently has
 * no public API for clearing a leaf's completed navigation stack. Keep the
 * feature-detected compatibility bridge isolated here so the project button
 * can provide a genuine route reset instead of making users press Back through
 * pages they deliberately left behind.
 */
export function clearWorkspaceLeafNavigationHistory(leaf: WorkspaceLeaf): void {
  const bridge = leaf as unknown as WorkspaceLeafHistoryBridge;
  if (!Array.isArray(bridge.history?.backHistory) || !Array.isArray(bridge.history.forwardHistory)) return;
  bridge.history.backHistory.splice(0);
  bridge.history.forwardHistory.splice(0);
  bridge.trigger?.("history-change");
}

export function parseNavigationState(value: unknown): ChatobbyNavigationState {
  if (!value || typeof value !== "object") return { mode: "chat" };
  const record = value as Record<string, unknown>;
  return {
    mode: isViewMode(record.mode) ? record.mode : "chat",
    runId: typeof record.runId === "string" ? record.runId : undefined,
    nodeId: typeof record.nodeId === "string" ? record.nodeId : undefined,
    subagentTab: isSubagentTab(record.subagentTab) ? record.subagentTab : undefined,
    feedOnly: typeof record.feedOnly === "boolean" ? record.feedOnly : undefined,
    channelId: typeof record.channelId === "string" ? record.channelId : undefined,
    messageId: typeof record.messageId === "string" ? record.messageId : undefined,
  };
}

export function parseLeafSessionState(value: unknown): { vaultDirectoryPath?: string; sessionPath?: string } {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    vaultDirectoryPath: typeof record.vaultDirectoryPath === "string" ? record.vaultDirectoryPath : undefined,
    sessionPath: typeof record.sessionPath === "string" ? record.sessionPath : undefined,
  };
}

/** Decide whether an Obsidian state update changes runtime session identity. */
export function shouldActivateLeafSession(
  hydrated: boolean,
  current: { vaultDirectoryPath: string; sessionPath?: string },
  requested: { vaultDirectoryPath?: string; sessionPath?: string },
): boolean {
  if (!hydrated) return true;
  if (requested.vaultDirectoryPath !== undefined && requested.vaultDirectoryPath !== current.vaultDirectoryPath) return true;
  return requested.sessionPath !== undefined && requested.sessionPath !== current.sessionPath;
}

function isViewMode(value: unknown): value is ChatobbyViewMode {
  return value === "chat"
    || value === "session-picker"
    || value === "subagents"
    || value === "channels"
    || value === "permissions"
    || value === "memory"
    || value === "events"
    || value === "queries";
}

function isSubagentTab(value: unknown): value is ChatobbySubagentTab {
  return value === "runs" || value === "inbox" || value === "agents" || value === "workflows" || value === "settings";
}

function sameNavigationState(left: ChatobbyNavigationState, right: ChatobbyNavigationState): boolean {
  return left.mode === right.mode
    && left.runId === right.runId
    && left.nodeId === right.nodeId
    && left.subagentTab === right.subagentTab
    && left.feedOnly === right.feedOnly
    && left.channelId === right.channelId
    && left.messageId === right.messageId;
}
