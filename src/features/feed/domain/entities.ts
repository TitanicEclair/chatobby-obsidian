import type {
  CompactionBlock,
  ExtensionPanelBlock,
  QueuedMessageBlock,
  SubagentActivity,
  SubagentBlock,
  SubagentCommunicationBlock,
  SystemBlock,
  TextBlock,
  ThinkingBlock,
  ThinkingDisplayMode,
  ToolBlock,
  ToolItem,
  TurnSummary,
  UserBlock,
} from "../../../types";
import type { AssistantCallId, BlockId, ToolCallId } from "./ids";

export type ThinkingBlockEntity = Readonly<Omit<ThinkingBlock, "id" | "turnId" | "displayMode"> & {
  id: BlockId;
  turnId: AssistantCallId;
}>;

export type TextBlockEntity = Readonly<Omit<TextBlock, "id" | "turnId"> & {
  id: BlockId;
  turnId: AssistantCallId;
}>;

export type ToolBlockEntity = Readonly<Omit<ToolBlock, "id" | "turnId" | "items" | "isExpanded"> & {
  id: BlockId;
  turnId: AssistantCallId;
}>;

export type SummaryBlockEntity = Readonly<Omit<TurnSummary, "id" | "turnId" | "blocks" | "isExpanded"> & {
  id: BlockId;
  turnId: AssistantCallId;
}>;

export type UserBlockEntity = Readonly<Omit<UserBlock, "id"> & { id: BlockId }>;
export type SystemBlockEntity = Readonly<Omit<SystemBlock, "id"> & { id: BlockId }>;
export type QueuedBlockEntity = Readonly<Omit<QueuedMessageBlock, "id"> & { id: BlockId }>;
export type CompactionBlockEntity = Readonly<Omit<CompactionBlock, "id"> & { id: BlockId }>;
export type SubagentBlockEntity = Readonly<Omit<SubagentBlock, "id"> & { id: BlockId; activity: Readonly<SubagentActivity> }>;
export type SubagentCommunicationBlockEntity = Readonly<Omit<SubagentCommunicationBlock, "id"> & { id: BlockId }>;
export type ExtensionPanelBlockEntity = Readonly<Omit<ExtensionPanelBlock, "id"> & { id: BlockId }>;

/** Normalized feed block. Tool items, summary children, and view state live in separate tables. */
export type FeedBlockEntity =
  | ThinkingBlockEntity
  | TextBlockEntity
  | ToolBlockEntity
  | SummaryBlockEntity
  | UserBlockEntity
  | SystemBlockEntity
  | QueuedBlockEntity
  | CompactionBlockEntity
  | SubagentBlockEntity
  | SubagentCommunicationBlockEntity
  | ExtensionPanelBlockEntity;

/** Normalized tool entity stored independently from its containing tool block. */
export type ToolItemEntity = Readonly<Omit<ToolItem, "id" | "isExpanded"> & { id: ToolCallId }>;

export interface FeedScrollState {
  readonly isAtBottom: boolean;
  readonly scrollTop: number;
  readonly anchorBlockId?: BlockId;
  readonly anchorOffset?: number;
}

export interface FeedViewStateSnapshot {
  readonly scroll: FeedScrollState;
  readonly expandedSummaryIds: readonly BlockId[];
  readonly expandedToolBlockIds: readonly BlockId[];
  readonly expandedToolIds: readonly ToolCallId[];
  readonly thinkingOverrides: readonly { blockId: BlockId; mode: ThinkingDisplayMode }[];
}
