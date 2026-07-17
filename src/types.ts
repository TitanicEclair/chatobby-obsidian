// Chatobby plugin type definitions
// Three-layer state model: PluginSettings → SessionPreferences → SessionState

import type { ThinkingLevel } from "./vendor/chatobby-client/wire-types.js";
import type {
  AutoNameStrategy,
  WsAutoCompactionSettings,
  WsSessionInfo,
  WsExtensionUIRequest,
  WsExtensionUIResponse,
  WsSessionStats,
  WsProviderInfo,
  WsBashResult,
  WsAttachmentCapabilities,
  WsPromptAttachment,
  WsPromptContextPacket,
  WsRuntimeInfo,
  WsBridgeConfig,
  WsForkMessage,
} from "./vendor/chatobby-client/connector-types.js";
import type { FrontendSubagentMessageViewModel as SubagentMessage } from "./vendor/chatobby-client/frontend-contracts.js";

// ── Re-exports (consumers import from here, not the local domain module or vendor directly) ────

export type {
  AutoNameStrategy,
  WsAutoCompactionSettings,
  WsSessionInfo,
  WsExtensionUIRequest,
  WsExtensionUIResponse,
  WsSessionStats,
  WsProviderInfo,
  WsBashResult,
  WsAttachmentCapabilities,
  WsPromptAttachment,
  WsPromptContextPacket,
  WsRuntimeInfo,
  WsBridgeConfig,
  WsForkMessage,
  ThinkingLevel,
};

/** Minimal presentation content used by feed components after runtime projection. */
export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp?: number;
}

export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

interface LegacyAgentMessage {
  role: string;
  content: unknown;
  timestamp?: number;
}

export interface WsSessionState {
  sessionId: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  sessionName?: string;
  sessionFile?: string;
  steeringMode: "all" | "one-at-a-time";
  followUpMode: "all" | "one-at-a-time";
  autoCompaction: WsAutoCompactionSettings;
  autoNameStrategy: AutoNameStrategy;
  messageCount: number;
  pendingMessageCount: number;
}

// Legacy prompt-context preference. Backend permission profiles own authorization.

// ── Display types ────────────────────────────────────────────────────

/** How thinking/reasoning blocks are rendered in the conversation feed. */
export type ThinkingDisplay = "hidden" | "collapsed" | "expanded";

// ── Layer 1: Plugin Settings (persisted, infrastructure) ─────────────

/** Settings owned by the Obsidian SettingTab. Persisted to data.json. */
export interface PluginSettings {
	/** Completed first-run experience version. Zero means the setup guide is still active. */
	onboardingVersion: number;
  /** Product runtime ownership mode. */
  runtimeMode: "managed" | "external" | "developer";
  /** Automatically acquire the managed runtime when a visible Chatobby view opens. */
  runtimeAutoStart: boolean;
  /** Whether the managed runtime follows Obsidian or remains available for background Events. */
  runtimeLifetime: "obsidian-session" | "background";
  /** User-supplied endpoint used only in external mode. */
  externalServerUrl: string;
  /** Raw command used only in developer mode. */
  developerCommand: string;
  /** Raw arguments used only in developer mode; lifecycle arguments remain manager-owned. */
  developerArgs: string[];
  /** Command shell used by agent shell tools. */
  commandShell: "auto" | "pwsh" | "powershell" | "cmd" | "bash" | "zsh" | "fish" | "sh" | "custom";
  /** Executable name or absolute path used when commandShell is custom. */
  customShellPath: string;
  /** Local display flags only; credential values are persisted by the runtime. */
  providerKeys: Record<string, boolean>;
  /** How thinking blocks are rendered in the feed. */
  thinkingDisplay: ThinkingDisplay;
  /** Whether the feed auto-scrolls to bottom on new content. */
  autoScroll: boolean;
  /** Vault-relative directory used for new sessions and resume listing. Empty string = vault root. */
  activeVaultDirectory: string;
  /** How new sessions are auto-named: "truncate" (first 5 words) or "model" (LLM call). */
  autoNameStrategy: AutoNameStrategy;
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
	onboardingVersion: 0,
  runtimeMode: "managed",
  runtimeAutoStart: true,
  runtimeLifetime: "obsidian-session",
  externalServerUrl: "ws://127.0.0.1:9222",
  developerCommand: "chatobby",
  developerArgs: [],
  commandShell: "auto",
  customShellPath: "",
  providerKeys: {},
  thinkingDisplay: "collapsed",
  autoScroll: true,
  activeVaultDirectory: "",
  autoNameStrategy: "truncate",
};

// ── Layer 2: Session Preferences (persisted, managed by UI controls) ─

/** Session defaults managed by the session controls popover. Persisted to data.json.
 *  Used to seed new sessions via newSession(). NOT in the settings tab. */
export interface SessionPreferences {
  /** Model ID to request. null = server default. */
  model: string | null;
  /** Thinking/reasoning level to request. */
  thinkingLevel: ThinkingLevel;
  /** Permission mode to request for new sessions. */
  permissionMode: PermissionMode;
}

export const DEFAULT_SESSION_PREFERENCES: SessionPreferences = {
  model: null,
  thinkingLevel: "medium",
  permissionMode: "default",
};

// ── Vault & Directory Session Prefs (persisted in .chatobby/session-dirs.json) ──

/** Per-directory preference override. Fields are optional — omission means "inherit from parent." */
export interface DirectoryPrefs {
  model?: string | null;
  thinkingLevel?: ThinkingLevel;
  permissionMode?: PermissionMode;
  enabledTools?: string[];
  lastUsed?: number;
}

/** Root config stored in .chatobby/session-dirs.json. Plugin-only, never crosses the wire. */
export interface VaultSessionConfig {
  vaultDefaults: SessionPreferences & { enabledTools?: string[] };
  directories: Record<string, DirectoryPrefs>;
}

// ── Layer 3: Session State (ephemeral, server-authoritative) ─────────

/** Runtime session state. Updated by getState() responses and event stream. */
export interface SessionState {
  sessionId: string | null;
  model: string;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  isRetrying: boolean;
  autoCompaction: WsAutoCompactionSettings;
  activeTools: string[];
  messages: LegacyAgentMessage[];
  /** Mid-generation steers the server has accepted and queued (queue_update.steering). */
  steering: readonly string[];
  /** Messages queued for the next turn (queue_update.followUp). */
  followUp: readonly string[];
}

export const DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT = 85;

export interface SessionListItem {
  path: string;
  id: string;
  cwd: string;
  name?: string;
  parentSessionPath?: string;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
}

export const EMPTY_SESSION_STATE: SessionState = {
  sessionId: null,
  model: "",
  thinkingLevel: "medium",
  isStreaming: false,
  isCompacting: false,
  isRetrying: false,
  autoCompaction: {
    enabled: true,
    thresholdPercent: DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT,
    effectiveThresholdPercent: DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT,
  },
  activeTools: [],
  messages: [],
  steering: [],
  followUp: [],
};

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

/** Composer input state. Owned by the Composer component. */
export interface ComposerState {
  text: string;
  attachments: ComposerAttachment[];
  isFocused: boolean;
}

export const INITIAL_COMPOSER_STATE: ComposerState = {
  text: "",
  attachments: [],
  isFocused: false,
};

export type ComposerAttachmentDelivery = "image" | "document" | "text" | "file";

export interface ComposerAttachment {
  id: string;
  name: string;
  prompt: WsPromptAttachment;
  delivery: ComposerAttachmentDelivery;
  previewUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  localPath?: string;
}

/** Permission mode for tool execution. Server-authoritative, persisted per session. */
export type PermissionMode =
  | "default"           // ask before each tool use
  | "acceptEdits"       // auto-allow file edits, ask for commands
  | "bypassPermissions" // allow everything
  | "plan"              // read-only planning mode
  | "dontAsk"           // allow without asking (with reason)
  | "auto";             // server decides

// ── Feed Blocks (rendering abstraction over raw messages) ────────────
//
// A single AssistantMessage contains mixed content: [thinking, toolCall, text, ...]
// Blocks group consecutive same-type content items into visual units.
// Each block owns its own streaming state and lifecycle.
//
// Content items in AssistantMessage.content[]:
//   index 0: ThinkingContent  ─┐
//   index 1: ThinkingContent  ─┤→ ThinkingBlock (streaming → complete → compacted)
//   index 2: ToolCall         ─┐
//   index 3: ToolCall         ─┤
//   index 4: ToolCall         ─┤→ ToolBlock (items run individually, block compacts when all done)
//   index 5: TextContent      ─→ TextBlock (streaming → complete)
//

/** Status of one tool execution. Downstream background work owns a separate lifecycle. */
export type ToolItemStatus =
  | "pending"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "interrupted";

/** Tool category — determines which UI component renders the tool. */
export type ToolCategory =
  | "read"       // read note / get context / get metadata / read image
  | "edit"       // edit note / edit editor / update frontmatter
  | "write"      // create note / create folder
  | "list"       // list entries / tasks / tags / properties / commands / hotkeys
  | "search"     // full-text search / vault explore
  | "link"       // resolve note / get links / audit links / generate link
  | "move"       // move entry / copy entry
  | "trash"      // trash entry
  | "open"       // open note / open app / focus location
  | "graph"      // traverse graph / vault trace / vault related / vault hubs / vault communities / vault explain
  | "task"       // update task
  | "workspace"  // get workspace / manage leaf / get editor state / get capabilities
  | "command"    // execute command
  | "import"     // import attachment
  | "bash"       // terminal command / run cli / read cli result
  | "cli"        // daily note / base / file history / sync / bookmarks / template / plugin / appearance / quickadd / dev diagnostics
  | "subagent"   // subagent lifecycle/control tools
  | "metadata"   // metadata query (non-obsidian tools, or legacy)
  | "git"        // git operation
  | "capability" // MCP/tool capability discovery and connection
  | "memory"     // durable memory search and mutation
  | "skill"      // reusable skill inspection and mutation
  | "event"      // durable Event inspection and mutation
  | "permission" // permission policy inspection and mutation
  | "channel"    // agent communication channels
  | "media"      // deterministic media download or transformation
  | "other"      // fallback — generic tool card

/** An individual tool call within a ToolBlock. */
export interface ToolItem {
  /** Tool call ID (from ToolCall.id). */
  id: string;
  /** Opaque runtime operation identifier retained for result diagnostics. */
  name: string;
  /** Runtime-projected presentation category. */
  category: ToolCategory;
  /** Raw arguments JSON string. */
  arguments: string;
  /** Runtime-resolved semantic operation key. */
  semanticKind: string;
  /** Runtime-resolved lifecycle label. */
  displayTitle: string;
  /** Runtime-resolved icon from the public allowlist. */
  iconToken?: string;
  /** Execution status. */
  status: ToolItemStatus;
  /** Execution result (available after a terminal state). */
  result?: unknown;
  /** Whether the result is an error. */
  isError?: boolean;
  /** Whether the user has expanded this tool's detail view. */
  isExpanded: boolean;
  /** Content index in the source AssistantMessage.content[] when known. */
  contentIndex?: number;
  /** When execution started (from tool_execution_start). */
  startTime?: number;
  /** When execution ended (from tool_execution_end). */
  endTime?: number;
}

/** Block lifecycle status. */
export type BlockStatus = "streaming" | "complete" | "compacted";

/** Display mode for thinking blocks. */
export type ThinkingDisplayMode = "expanded" | "collapsed" | "hidden";

/** A thinking block — model's internal reasoning. */
export interface ThinkingBlock {
  type: "thinking";
  /** Stable UI-only block id. */
  id: string;
  /** Stable UI-only assistant turn id. */
  turnId: string;
  /** Accumulated thinking text (built from thinking_delta events). */
  text: string;
  /** Content indices in the source AssistantMessage.content[] this block covers. */
  startIndex: number;
  endIndex: number;
  /** Block lifecycle. */
  status: BlockStatus;
  /** User-controlled display mode. Overrides global thinkingDisplay when set. */
  displayMode: ThinkingDisplayMode | null;
  /** Wall-clock when the block started streaming (for computing durationMs). */
  startedAt?: number;
  /** Duration in ms (from first delta to thinking_end). */
  durationMs?: number;
}

/** A tool block — group of consecutive tool calls. */
export interface ToolBlock {
  type: "tools";
  /** Stable UI-only block id. */
  id: string;
  /** Stable UI-only assistant turn id. */
  turnId: string;
  /** Individual tool items in execution order. */
  items: ToolItem[];
  /** Content indices in the source AssistantMessage.content[] this block covers. */
  startIndex: number;
  endIndex: number;
  /** Block lifecycle. */
  status: BlockStatus;
  /** Whether the user has expanded a compacted block. */
  isExpanded: boolean;
}

/** A text block — model's visible response. */
export interface TextBlock {
  type: "text";
  /** Stable UI-only block id. */
  id: string;
  /** Stable UI-only assistant turn id. */
  turnId: string;
  /** Accumulated text (built from text_delta events). */
  text: string;
  /** Content indices in the source AssistantMessage.content[] this block covers. */
  startIndex: number;
  endIndex: number;
  /** Block lifecycle. */
  status: BlockStatus;
  /** Stop reason (set on message_end). */
  stopReason?: StopReason;
  /** Wall-clock when the block started streaming (for computing durationMs). */
  startedAt?: number;
  /** Elapsed wall-clock time this block spent streaming (set on completion). */
  durationMs?: number;
}

/** A user message block — renders the user's prompt. */
export interface UserBlock {
  type: "user";
  /** Stable UI-only block id. */
  id: string;
  /** Stable UI-only user message id. */
  messageId: string;
  /** The user message content. */
  message: UserMessage;
}

/** A system message block — server-injected user-role message (subagent input, context, etc.).
 *  Visually muted. Not from the user's explicit prompt. */
export interface SystemBlock {
  type: "system";
  /** Stable UI-only block id. */
  id: string;
  /** Stable UI-only message id. */
  messageId: string;
  /** The message content. */
  message: UserMessage;
}

/** A turn summary — compacted representation of the work before a confirmed final response. */
export interface TurnSummary {
  type: "summary";
  /** Summary level: one intermediate assistant call or the whole pre-response run. */
  summaryKind?: "call" | "run";
  /** Stable UI-only block id. */
  id: string;
  /** Stable UI-only assistant turn id. */
  turnId: string;
  /** When the summarized work started. */
  startedAt?: number;
  /** When the summarized work was folded. */
  completedAt?: number;
  /** Duration of the turn in ms. */
  durationMs?: number;
  /** Summary text, e.g., "Worked for 1m 18s". */
  text: string;
  /** Tool counts by category. */
  toolCounts: Record<string, number>;
  /** Whether the user has expanded to see the raw blocks. */
  isExpanded: boolean;
  /** The raw blocks this summary replaces. */
  blocks: FeedBlock[];
}

/** A mid-turn steer or queued follow-up message, shown with its server-ack state:
 *  pending (sent) → queued (queue_update lists it) → applied (consumed by the model). */
export interface QueuedMessageBlock {
  type: "queued";
  /** Stable UI-only block id. */
  id: string;
  /** Whether this corrects the running turn (steer) or queues for the next (followUp). */
  kind: "steer" | "followUp";
  /** The message text. */
  text: string;
  /** Ack state driven by queue_update events. */
  status: "pending" | "queued" | "applied";
}

/** A compaction block — inline indicator that the server is compacting context.
 *  Driven by the runtime-projected session compaction state.
 *  Appears inline in the feed between turns, updates to "Session compacted" when done. */
export interface CompactionBlock {
  type: "compaction";
  /** Stable UI-only block id. */
  id: string;
  /** Why compaction was triggered (manual, threshold, overflow). */
  reason?: string;
  /** When compaction started. */
  startTime: number;
  /** Whether the server-side compaction marker is still active. */
  status: "active" | "done";
  /** Optional error or abort marker from compaction_end. */
  errorMessage?: string;
}

export type SubagentEventChannel =
  | "subagents:created"
  | "subagents:started"
  | "subagents:completed"
  | "subagents:failed"
  | "subagents:steered"
  | "subagents:compacted";

export type SubagentActivityStatus =
  | "created"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "steered";

export interface SubagentTokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface SubagentActivity {
  agentId: string;
  name?: string;
  type: string;
  description: string;
  source: string;
  status: SubagentActivityStatus;
  isBackground?: boolean;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  tokens?: SubagentTokenUsage;
  toolUses?: number;
  resultPreview?: string;
  errorMessage?: string;
  outputFile?: string;
  lastSteer?: string;
  compactionCount: number;
  tokensBeforeCompaction?: number;
}

export interface SubagentBlock {
  type: "subagent";
  /** Stable UI-only block id. */
  id: string;
  /** Subagent id from pi.events payload. */
  agentId: string;
  /** Current structured activity for this subagent. */
  activity: SubagentActivity;
  /** Block lifecycle. */
  status: BlockStatus;
}

/** Origin-preserving communication projected by the Chatobby subagent supervisor. */
export interface SubagentCommunicationBlock {
  type: "subagent-communication";
  /** Stable UI-only block id. */
  id: string;
  /** Durable supervisor message id. */
  messageId: string;
  /** Structured message used for labels, routing, and child-feed navigation. */
  message: SubagentMessage;
}

export interface ExtensionPanelBlock {
  type: "extension-panel";
  /** Stable UI-only block id. */
  id: string;
  /** Stable key for replaceable panels such as extension widgets. */
  key?: string;
  /** What kind of extension surface produced this panel. */
  panelKind: "notice" | "widget" | "screen";
  /** Short heading shown above the panel body. */
  title: string;
  /** Markdown or plain text body. */
  body: string;
  /** Extension-provided severity, when available. */
  level?: "info" | "warning" | "error";
  /** Origin label such as memory, permissions, or subagents. */
  source?: string;
  /** First-class actions rendered by the Chatobby feed. */
  actions?: ExtensionPanelAction[];
  createdAt: number;
}

export interface ExtensionPanelAction {
  id: string;
  label: string;
  icon?: string;
  kind?: "primary" | "secondary" | "danger";
}

/** A feed block — one visual unit in the conversation feed. */
export type FeedBlock =
  | ThinkingBlock
  | ToolBlock
  | TextBlock
  | UserBlock
  | SystemBlock
  | TurnSummary
  | QueuedMessageBlock
  | CompactionBlock
  | SubagentBlock
  | SubagentCommunicationBlock
  | ExtensionPanelBlock;

/** Vault context gathered before a prompt. */
export interface VaultContext {
  frontend: "obsidian";
  vault: string;
  environment?: VaultEnvironment;
  capabilities?: VaultCapabilityContext;
  notePath?: string;
  cursor?: { line: number; ch: number };
  selection?: string;
  contextExcerpt?: { fromLine: number; toLine: number; text: string };
  headings?: string[];
  openNotes?: OpenNoteInfo[];
  imageEmbeds?: ResolvedImage[];
}

export interface VaultCapabilityContext {
  featureFamilies: string[];
  integrations: Array<{ id: string; name: string; installed: boolean; enabled: boolean }>;
  runtimeDependencies: Array<{ id: string; name: string; available: boolean; detail?: string }>;
}

export interface VaultEnvironment {
  time: {
    sentAtUtc: string;
    localDate: string;
    localTime: string;
    timeZone?: string;
    utcOffsetMinutes: number;
  };
  locale?: {
    primary?: string;
    languages?: string[];
  };
  device?: {
    platform?: string;
    userAgent?: string;
    hardwareConcurrency?: number;
    deviceMemoryGb?: number;
  };
  display?: {
    viewportWidth?: number;
    viewportHeight?: number;
    screenWidth?: number;
    screenHeight?: number;
    devicePixelRatio?: number;
    colorScheme?: "dark" | "light";
  };
  app?: {
    obsidianVersion?: string;
    chatobbyVersion?: string;
  };
}

export interface OpenNoteInfo {
  path: string;
  title: string;
}

export interface ResolvedImage {
  link: string;
  path: string;
  data?: string;
  mimeType?: string;
}

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

// ── Session Tab (complete per-tab state snapshot) ────────────────────

// ── State machine event types ────────────────────────────────────────

/** Events that drive the connection state machine. */
export type ConnectionEvent =
  | { type: "connect" }
  | { type: "connected" }
  | { type: "error"; error: string }
  | { type: "disconnected" }
  | { type: "retry" };

/** Events that drive the session state machine. */
export type SessionEvent =
  | { type: "new_session"; sessionId: string }
  | { type: "state_update"; state: WsSessionState }
  | { type: "message"; message: LegacyAgentMessage }
  | { type: "stream_start" }
  | { type: "stream_end" }
  | { type: "compact_start" }
  | { type: "compact_end" }
  | { type: "queue_update"; steering: readonly string[]; followUp: readonly string[] }
  | { type: "thinking_changed"; level: ThinkingLevel }
  | { type: "retry_start" }
  | { type: "retry_end" }
  | { type: "auto_compaction"; settings: WsAutoCompactionSettings };
