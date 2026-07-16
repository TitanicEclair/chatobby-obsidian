import type { SubagentActivity, ThinkingDisplayMode } from "../../../types";
import type { FeedBlockEntity, FeedScrollState, ToolItemEntity } from "../domain/entities";
import type { AssistantCallId, BlockId, ToolCallId } from "../domain/ids";

export interface MutableFeedRuntimeState {
  nextSequence: number;
  activeCallId: AssistantCallId | null;
  completedCallId: AssistantCallId | null;
  turnStartedAt: number | null;
  runStartedAt: number | null;
  lastRunDurationMs: number | null;
  pendingPromptEchoes: string[];
  subagentsById: Map<string, Readonly<SubagentActivity>>;
}

export interface MutableFeedViewState {
  scroll: FeedScrollState;
  expandedSummaryIds: Set<BlockId>;
  expandedToolBlockIds: Set<BlockId>;
  expandedToolIds: Set<ToolCallId>;
  thinkingOverrides: Map<BlockId, ThinkingDisplayMode>;
}

export interface MutableFeedIndexes {
  assistantBlockByScopeAndIndex: Map<string, BlockId>;
  latestAssistantBlockByCall: Map<AssistantCallId, BlockId>;
  toolLocationByCallId: Map<ToolCallId, { blockId: BlockId }>;
  summaryParentsByChild: Map<BlockId, Set<BlockId>>;
  subagentBlockByAgentId: Map<string, BlockId>;
  extensionPanelByKey: Map<string, BlockId>;
}

export interface MutableFeedStoreState {
  blockOrder: BlockId[];
  blocksById: Map<BlockId, FeedBlockEntity>;
  toolsById: Map<ToolCallId, ToolItemEntity>;
  toolBlockItems: Map<BlockId, ToolCallId[]>;
  summaryChildren: Map<BlockId, BlockId[]>;
  runtime: MutableFeedRuntimeState;
  view: MutableFeedViewState;
  indexes: MutableFeedIndexes;
}
