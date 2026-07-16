import type { WorkspaceLeaf } from "obsidian";

export type ChatobbyViewMode = "chat" | "session-picker" | "subagents" | "channels" | "permissions" | "memory" | "events" | "queries";
export type ChatobbySubagentTab = "runs" | "inbox" | "agents" | "workflows" | "settings";

export interface ChatobbyNavigationState {
  mode: ChatobbyViewMode;
  runId?: string;
  nodeId?: string;
  subagentTab?: ChatobbySubagentTab;
  feedOnly?: boolean;
  channelId?: string;
  messageId?: string;
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
  onError: (error: unknown) => void;
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
    this.setState(state, true);
  }

  /** Replace the current Chatobby screen without appending another native history entry. */
  replace(state: ChatobbyNavigationState): void {
    this.setState(state, false);
  }

  /** Collapse the current Chatobby route to its main feed without adding another history entry. */
  reset(): void {
    this.pendingHistoryIntent = null;
    this.setState({ mode: "chat" }, false);
  }

  private setState(state: ChatobbyNavigationState, recordHistory: boolean): void {
    this.pendingHistoryIntent = { state: { ...state }, record: recordHistory };
    void this.leaf.setViewState({ type: this.viewType, state: { ...state }, active: true })
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
