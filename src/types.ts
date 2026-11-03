// Compatibility facade for connector-local models and canonical wire types.
// New producers use their feature/prompt owner; connection and interaction remain here.
export type {
  TextContent,
  ImageContent,
  AttachmentContent,
  UserMessage,
  StopReason,
  ToolItemStatus,
  ToolCategory,
  ToolItem,
  BlockStatus,
  ThinkingDisplayMode,
  ThinkingBlock,
  ToolBlock,
  TextBlock,
  UserBlock,
  SystemBlock,
  TurnSummary,
  QueuedMessageBlock,
  DividerBlock,
  SubagentEventChannel,
  SubagentActivityStatus,
  SubagentTokenUsage,
  SubagentActivity,
  SubagentBlock,
  SubagentCommunicationBlock,
  ExtensionPanelBlock,
  ExtensionPanelAction,
  FeedBlock
} from "./features/feed/domain/presentation";
export { DEFAULT_SESSION_PREFERENCES } from "./features/session/domain/preferences";
export type { SessionPreferences, PermissionMode } from "./features/session/domain/preferences";
export { DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT, EMPTY_SESSION_STATE } from "./features/session/domain/state";
export type { WsSessionState, SessionState, SessionListItem, SessionEvent } from "./features/session/domain/state";
export type { VaultContext, VaultCapabilityContext, VaultEnvironment, ObsidianFileConventionFactsV1, OpenNoteInfo } from "./prompt/types";
import type { ThinkingLevel } from "./vendor/chatobby-client/wire-types.js";
import type {
  AutoNameStrategy,
  WsAutoCompactionSettings,
  WsSessionInfo,
  WsExtensionUIRequest,
  WsExtensionUIResponse,
  WsSessionStats,
  WsProviderInfo,
  WsLocalModelProvider,
  WsLocalModelProviderDocument,
  WsLocalModelProviderProbeResult,
  WsLocalModelDiscoveryResult,
  WsDiscoveredLocalModel,
  WsManagedLocalModelServerProfile,
  WsManagedLocalModelServerSnapshot,
  WsManagedLocalModelServerStatus,
  WsBashResult,
  WsAttachmentCapabilities,
  WsPromptAttachment,
  WsPromptContextPacket,
  WsRuntimeInfo,
  WsBridgeConfig,
  WsForkMessage,
} from "./vendor/chatobby-client/connector-types.js";

export { INITIAL_COMPOSER_STATE } from "./ui/composer/types";
export type { ComposerState, ComposerAttachmentDelivery, ComposerAttachment } from "./ui/composer/types";

// Canonical wire compatibility exports.

export type {
  AutoNameStrategy,
  WsAutoCompactionSettings,
  WsSessionInfo,
  WsExtensionUIRequest,
  WsExtensionUIResponse,
  WsSessionStats,
  WsProviderInfo,
  WsLocalModelProvider,
  WsLocalModelProviderDocument,
  WsLocalModelProviderProbeResult,
  WsLocalModelDiscoveryResult,
  WsDiscoveredLocalModel,
  WsManagedLocalModelServerProfile,
  WsManagedLocalModelServerSnapshot,
  WsManagedLocalModelServerStatus,
  WsBashResult,
  WsAttachmentCapabilities,
  WsPromptAttachment,
  WsPromptContextPacket,
  WsRuntimeInfo,
  WsBridgeConfig,
  WsForkMessage,
  ThinkingLevel,
};

// Compatibility exports bypass the UI-bearing feature barrel; settings owns these declarations.
export { DEFAULT_COMPOSER_KEYBINDINGS, DEFAULT_PLUGIN_SETTINGS } from "./features/settings/domain/settings";
export type { ComposerKeybindings, PluginSettings, ThinkingDisplay } from "./features/settings/domain/settings";

// ── Layer 4: UI-only State (never persisted) ─────────────────────────

/** Connection lifecycle state. Owned by ChatobbyTransport. */
export interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  error?: string;
  reconnectAttempt: number;
}

export const INITIAL_CONNECTION_STATE: ConnectionState = {
  status: "disconnected",
  reconnectAttempt: 0,
};

// ── Interaction State (active extension UI request) ──────────────────

/** The active blocking interaction from an extension UI request.
 *  Owned by the view. Rendered by InteractionCard. Input routed by composer. */
export interface InteractionState {
  /** Server request ID — sent back in the response. */
  id: string;
  /** What kind of interaction. */
  method: "select" | "confirm" | "input" | "editor";
  /** Server-provided params (title, options, placeholder, prefill, etc.). */
  params: Record<string, unknown>;
  /** Current user selection index (for select). */
  selectedIndex: number;
  /** Current text value (for input/editor). */
  text: string;
  /** Whether the user has submitted. Awaiting server ack. */
  submitted: boolean;
}

/** Create a fresh InteractionState from a server request. */
export function createInteractionState(
  id: string,
  method: InteractionState["method"],
  params: Record<string, unknown>,
): InteractionState {
  return {
    id,
    method,
    params,
    selectedIndex: 0,
    text: typeof params.prefill === "string" ? params.prefill : "",
    submitted: false,
  };
}

// ── State machine event types ────────────────────────────────────────

/** Events that drive the connection state machine. */
export type ConnectionEvent =
  | { type: "connect" }
  | { type: "connected" }
  | { type: "error"; error: string }
  | { type: "disconnected" }
  | { type: "retry" };
