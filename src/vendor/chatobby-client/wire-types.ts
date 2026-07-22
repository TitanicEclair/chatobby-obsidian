// Generated from packages/chatobby/src/wire-types.ts. Do not edit.
// Chatobby-owned, JSON-serializable wire types for the WebSocket boundary.
//
// These mirror the subset of pi's AgentMessage / AgentSessionEvent shapes that
// cross the WS boundary to the Obsidian plugin, but are owned by chatobby so the
// protocol types (and the vendored client .d.ts) carry NO dependency on pi
// packages. The orchestrator maps pi types -> these wire types (see wire-mapping.ts).
//
// Design notes:
// - Variant discriminators and scalar fields are precise, so the plugin gets
//   exhaustively-narrowable event/message types.
// - Each union ends in a passthrough variant (`{ type: string; [field: string]:
//   unknown }` / `{ role: string; ... }`) so future pi event/message variants and
//   custom extension messages flow through without dropping data or breaking the
//   build. The plugin narrows known variants and defaults the rest.
// - ThinkingLevel is mirrored here (a trivial string union) so ws-types.ts has no
//   pi import.

/** Thinking level, mirrored from pi so ws-types has no pi import. */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

// ── Content blocks ────────────────────────────────────────────────────

export interface WireTextContent {
	type: "text";
	text: string;
}

export interface WireImageContent {
	type: "image";
	mimeType: string;
	data: string;
}

export interface WireThinkingContent {
	type: "thinking";
	text: string;
}

export interface WireToolCall {
	type: "toolCall";
	toolCallId: string;
	toolName: string;
	args: unknown;
}

/** A renderable content block. Exotic/unknown blocks pass through loosely. */
export type WireContentBlock =
	| WireTextContent
	| WireImageContent
	| WireThinkingContent
	| WireToolCall
	| { type: string; [field: string]: unknown };

// ── Messages ──────────────────────────────────────────────────────────

export interface WireUserMessage {
	role: "user";
	content: string | WireContentBlock[];
	timestamp: number;
}

export interface WireAssistantMessage {
	role: "assistant";
	content: WireContentBlock[];
	model: string;
	timestamp: number;
}

export interface WireToolResultMessage {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: WireContentBlock[];
	isError: boolean;
	timestamp: number;
}

/** Application-owned message with a dedicated frontend renderer and structured details. */
export interface WireCustomMessage {
	role: "custom";
	customType: string;
	content: string;
	display: boolean;
	details?: unknown;
	timestamp: number;
}

/** A chatobby-owned message crossing the WS boundary (get_messages / events). */
export type WireMessage =
	| WireUserMessage
	| WireAssistantMessage
	| WireToolResultMessage
	| WireCustomMessage
	| { role: string; content: unknown; timestamp: number; [field: string]: unknown };

// ── Session events ─────────────────────────────────────────────────────

/**
 * Mirrors pi's AgentSessionEvent variant set, owned by chatobby. Nested messages
 * use WireMessage; non-message payloads (args, results, assistantMessageEvent,
 * CompactionResult) are `unknown` and tightened as the plugin's needs confirm.
 */
export type WireSessionEvent =
	// Agent lifecycle
	| { type: "agent_start" }
	| { type: "agent_end"; messages: WireMessage[]; willRetry: boolean }
	| { type: "agent_settled" }
	// Turn lifecycle (one assistant response + any tool calls/results)
	| { type: "turn_start" }
	| { type: "turn_end"; message: WireMessage; toolResults: WireMessage[] }
	// Message lifecycle (user, assistant, toolResult)
	| { type: "message_start"; message: WireMessage }
	| { type: "message_update"; message: WireMessage; assistantMessageEvent: unknown }
	| { type: "message_end"; message: WireMessage }
	// Tool execution lifecycle
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: unknown }
	| { type: "tool_execution_update"; toolCallId: string; toolName: string; args: unknown; partialResult: unknown }
	| { type: "tool_execution_end"; toolCallId: string; toolName: string; result: unknown; isError: boolean }
	// Session-specific
	| { type: "queue_update"; steering: readonly string[]; followUp: readonly string[] }
	| {
			type: "compaction_start";
			reason: "manual" | "threshold" | "overflow";
			customInstructions?: string;
	  }
	| { type: "session_info_changed"; name: string | undefined }
	| { type: "thinking_level_changed"; level: ThinkingLevel }
	| {
			type: "compaction_end";
			reason: "manual" | "threshold" | "overflow";
			result: unknown;
			aborted: boolean;
			willRetry: boolean;
			errorMessage?: string;
	  }
	| { type: "auto_retry_start"; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
	| { type: "auto_retry_end"; success: boolean; attempt: number; finalError?: string }
	// Passthrough for future/unrecognized events (payload preserved at runtime).
	| { type: string; [field: string]: unknown };

// ── Extension events ─────────────────────────────────────────────────

/** Normalized event emitted by a Pi extension over the shared extension event bus. */
export interface WireExtensionEvent {
	channel: string;
	source: string;
	timestamp: number;
	data: Record<string, unknown>;
}
