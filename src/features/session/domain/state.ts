import type { ThinkingLevel } from "../../../vendor/chatobby-client/wire-types.js";
import type { AutoNameStrategy, WsAutoCompactionSettings } from "../../../vendor/chatobby-client/connector-types.js";


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

/** Events that drive the session state machine. */
export type SessionEvent =
  | { type: "new_session"; sessionId: string }
  | { type: "state_update"; state: WsSessionState }
  | { type: "message"; message: LegacyAgentMessage }
  | { type: "stream_start" }
  | { type: "stream_end" }
  | { type: "compact_start" }
  | { type: "compact_end" }
  | {
      type: "queue_update";
      steering: readonly string[];
      followUp: readonly string[];
    }
  | { type: "thinking_changed"; level: ThinkingLevel }
  | { type: "retry_start" }
  | { type: "retry_end" }
  | { type: "auto_compaction"; settings: WsAutoCompactionSettings };
