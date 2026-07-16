/** Stable identifier for one normalized feed block. */
export type BlockId = string & { readonly __blockId: unique symbol };

/** Durable tool call identifier supplied by the agent runtime. */
export type ToolCallId = string & { readonly __toolCallId: unique symbol };

/** UI-owned identifier for one assistant message/call scope. */
export type AssistantCallId = string & { readonly __assistantCallId: unique symbol };

/** Converts a validated stored string into a block identifier. */
export function blockId(value: string): BlockId {
  return value as BlockId;
}

/** Converts a runtime tool-call string into a durable tool identifier. */
export function toolCallId(value: string): ToolCallId {
  return value as ToolCallId;
}

/** Converts a validated stored string into an assistant-call identifier. */
export function assistantCallId(value: string): AssistantCallId {
  return value as AssistantCallId;
}
