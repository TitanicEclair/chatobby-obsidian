import type { FeedBlock, SubagentActivity } from "../../../types";
import type { FeedScrollState, ToolItemEntity } from "../domain/entities";
import type { AssistantCallId, BlockId, ToolCallId } from "../domain/ids";

/** Read-only store projection available to public selectors. */
export interface FeedReader {
  orderedBlockIds(): readonly BlockId[];
  blockById(id: BlockId): FeedBlock | undefined;
  toolById(id: ToolCallId): ToolItemEntity | undefined;
  scroll(): FeedScrollState;
  runTiming(): RunTimingView;
  subagents(): readonly Readonly<SubagentActivity>[];
}

export interface RunTimingView {
  readonly activeCallId: AssistantCallId | null;
  readonly runStartedAt: number | null;
  readonly lastRunDurationMs: number | null;
}

export type FeedSelector<T> = (reader: FeedReader) => T;

/** Supported stable selectors for feed consumers outside the feature. */
export const feedSelectors = {
  orderedBlockIds: (reader: FeedReader): readonly BlockId[] => reader.orderedBlockIds(),
  blockById: (id: BlockId): FeedSelector<FeedBlock | undefined> => (reader) => reader.blockById(id),
  toolById: (id: ToolCallId): FeedSelector<ToolItemEntity | undefined> => (reader) => reader.toolById(id),
  scroll: (reader: FeedReader): FeedScrollState => reader.scroll(),
  runTiming: (reader: FeedReader): RunTimingView => reader.runTiming(),
  subagents: (reader: FeedReader): readonly Readonly<SubagentActivity>[] => reader.subagents(),
};
