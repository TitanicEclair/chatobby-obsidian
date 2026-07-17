import type { SubagentActivity } from "../../../types";
import type { FeedBlockEntity, FeedViewStateSnapshot, ToolItemEntity } from "./entities";
import type { AssistantCallId, BlockId, ToolCallId } from "./ids";

export interface FeedRuntimeSnapshot {
  readonly nextSequence: number;
  readonly activeCallId: AssistantCallId | null;
  readonly completedCallId: AssistantCallId | null;
  readonly turnStartedAt: number | null;
  readonly runStartedAt: number | null;
  readonly lastRunDurationMs: number | null;
  readonly pendingPromptEchoes: readonly string[];
  readonly subagents: readonly { id: string; activity: Readonly<SubagentActivity> }[];
}

/** Versioned, plain-data serialization format for a normalized feed store. */
export interface FeedSnapshotV2 {
  readonly schemaVersion: 2;
  readonly blockOrder: readonly BlockId[];
  readonly blocks: readonly FeedBlockEntity[];
  readonly tools: readonly ToolItemEntity[];
  readonly toolBlockItems: readonly { blockId: BlockId; toolIds: readonly ToolCallId[] }[];
  readonly summaryChildren: readonly { summaryId: BlockId; childIds: readonly BlockId[] }[];
  readonly runtime: FeedRuntimeSnapshot;
  readonly view: FeedViewStateSnapshot;
}

export type FeedSnapshot = FeedSnapshotV2;
export type UnknownFeedSnapshot = unknown;
