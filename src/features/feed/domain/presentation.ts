import type { FrontendSubagentMessageViewModel as SubagentMessage } from "../../../vendor/chatobby-client/frontend-contracts.js";


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

export interface AttachmentContent {
  type: "attachment";
  name: string;
  kind: "image" | "text" | "binary";
  mimeType?: string;
  path?: string;
  sizeBytes?: number;
  data?: string;
}

export interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent | AttachmentContent)[];
  skillInvocations?: readonly { readonly name: string }[];
  timestamp?: number;
}

export type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

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
  | "read" // read note / get context / get metadata / read image
  | "edit" // edit note / edit editor / update frontmatter
  | "write" // create note / create folder
  | "list" // list entries / tasks / tags / properties / commands / hotkeys
  | "search" // full-text search / vault explore
  | "link" // resolve note / get links / audit links / generate link
  | "move" // move entry / copy entry
  | "trash" // trash entry
  | "open" // open note / open app / focus location
  | "graph" // traverse graph / vault trace / vault related / vault hubs / vault communities / vault explain
  | "task" // update task
  | "workspace" // get workspace / manage leaf / get editor state / get capabilities
  | "command" // execute command
  | "import" // import attachment
  | "shell" // terminal command / Obsidian CLI
  | "cli" // daily note / base / file history / sync / bookmarks / template / plugin / appearance / quickadd / dev diagnostics
  | "subagent" // subagent lifecycle/control tools
  | "metadata" // metadata query (non-obsidian tools, or legacy)
  | "git" // git operation
  | "capability" // MCP/tool capability discovery and connection
  | "memory" // durable memory search and mutation
  | "skill" // reusable skill inspection and mutation
  | "event" // durable Event inspection and mutation
  | "permission" // permission policy inspection and mutation
  | "channel" // agent communication channels
  | "media" // deterministic media download or transformation
  | "other"; // fallback — generic tool card

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
  /** Local submission correlation used only until the runtime confirms or retracts the prompt. */
  submissionId?: string;
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
  /** Attachments submitted with this steer or follow-up. */
  attachments?: readonly AttachmentContent[];
  /** Ack state driven by queue_update events. */
  status: "pending" | "queued" | "applied";
}

/** A divider block — a centered single-line status rule in the feed. Used for
 *  the compaction marker ("Compacting context…" → "Context compacted.") and for
 *  fork/clone receipts ("Session forked from …", "Session cloned"). The rule
 *  stretches edge-to-edge; the label sits centered on it. */
export interface DividerBlock {
  type: "divider";
  /** Stable UI-only block id. */
  id: string;
  /** Centered label shown on the rule. */
  label: string;
  /** Visual tone: active (animated), done, info, or error. */
  tone: "active" | "done" | "info" | "error";
  /** When true, an animated ellipsis follows the label (live compaction). */
  animated?: boolean;
  /** Start/end timestamps for a live operation row shown above the divider. */
  activityStartedAt?: number;
  activityEndedAt?: number;
  /** Present-participle operation label, such as "Compacting". */
  activityLabel?: string;
  /** Optional user-supplied focus shown faintly below the operation label. */
  detail?: string;
  /** Real lifecycle steps for long operations. No synthetic percentage is implied. */
  activitySteps?: readonly {
    id: string;
    label: string;
    state: "pending" | "active" | "complete";
  }[];
}

export type SubagentEventChannel =
  | "subagents:created"
  | "subagents:started"
  | "subagents:completed"
  | "subagents:failed"
  | "subagents:steered"
  | "subagents:compacted";

export type SubagentActivityStatus =
  "created" | "running" | "waiting" | "completed" | "failed" | "steered";

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
  /** Absent when the runtime does not expose an authoritative count. */
  compactionCount?: number;
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
  | DividerBlock
  | SubagentBlock
  | SubagentCommunicationBlock
  | ExtensionPanelBlock;
