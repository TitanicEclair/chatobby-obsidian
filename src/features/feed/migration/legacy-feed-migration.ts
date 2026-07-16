import type { FeedBlock, SubagentActivity } from "../../../types";
import type { FeedBlockEntity, ToolItemEntity } from "../domain/entities";
import { assistantCallId, blockId, toolCallId, type BlockId, type ToolCallId } from "../domain/ids";
import type { FeedSnapshotV2 } from "../domain/snapshots";
import type { FeedStore } from "../state/feed-store";
import { feedSelectors } from "../state/selectors";

/**
 * Converts the former nested FeedState shape into the normalized v2 snapshot.
 * This boundary exists only for persisted/runtime migration and legacy fixtures.
 */
/** Former pre-v2 nested feed shape, retained only at the explicit migration boundary. */
export interface LegacyFeedState {
  readonly blocks: FeedBlock[];
  readonly nextSeq: number;
  readonly activeTurnId: string | null;
  readonly completedTurnId: string | null;
  readonly turnStartMs: number | null;
  readonly runStartMs: number | null;
  readonly runDurationMs: number | null;
  readonly pendingUserEchoes: string[];
  readonly subagents: Record<string, SubagentActivity>;
  readonly isAtBottom: boolean;
  readonly scrollTop: number;
}

export const INITIAL_LEGACY_FEED_STATE: LegacyFeedState = {
  blocks: [],
  nextSeq: 0,
  activeTurnId: null,
  completedTurnId: null,
  turnStartMs: null,
  runStartMs: null,
  runDurationMs: null,
  pendingUserEchoes: [],
  subagents: {},
  isAtBottom: true,
  scrollTop: 0,
};

export function migrateLegacyFeedState(state: LegacyFeedState): FeedSnapshotV2 {
  const blocks = new Map<BlockId, FeedBlockEntity>();
  const tools = new Map<ToolCallId, ToolItemEntity>();
  const toolBlockItems: FeedSnapshotV2["toolBlockItems"][number][] = [];
  const summaryChildren: FeedSnapshotV2["summaryChildren"][number][] = [];
  const expandedSummaryIds: BlockId[] = [];
  const expandedToolBlockIds: BlockId[] = [];
  const expandedToolIds: ToolCallId[] = [];
  const thinkingOverrides: FeedSnapshotV2["view"]["thinkingOverrides"][number][] = [];

  const visit = (block: FeedBlock): BlockId => {
    const id = blockId(block.id);
    if (blocks.has(id)) return id;
    switch (block.type) {
      case "thinking": {
        const { displayMode, ...entity } = block;
        blocks.set(id, { ...entity, id, turnId: assistantCallId(block.turnId) });
        if (displayMode) thinkingOverrides.push({ blockId: id, mode: displayMode });
        return id;
      }
      case "text":
        blocks.set(id, { ...block, id, turnId: assistantCallId(block.turnId) });
        return id;
      case "tools": {
        const { items, isExpanded, ...entity } = block;
        const toolIds = items.map((item) => {
          const toolIdValue = toolCallId(item.id);
          const { isExpanded: itemExpanded, ...tool } = item;
          tools.set(toolIdValue, { ...tool, id: toolIdValue });
          if (itemExpanded) expandedToolIds.push(toolIdValue);
          return toolIdValue;
        });
        blocks.set(id, { ...entity, id, turnId: assistantCallId(block.turnId) });
        toolBlockItems.push({ blockId: id, toolIds });
        if (isExpanded) expandedToolBlockIds.push(id);
        return id;
      }
      case "summary": {
        const { blocks: children, isExpanded, ...entity } = block;
        blocks.set(id, { ...entity, id, turnId: assistantCallId(block.turnId) });
        summaryChildren.push({ summaryId: id, childIds: children.map(visit) });
        if (isExpanded) expandedSummaryIds.push(id);
        return id;
      }
      default:
        blocks.set(id, { ...block, id } as FeedBlockEntity);
        return id;
    }
  };

  const blockOrder = state.blocks.map(visit);
  return {
    schemaVersion: 2,
    blockOrder,
    blocks: [...blocks.values()],
    tools: [...tools.values()],
    toolBlockItems,
    summaryChildren,
    runtime: {
      nextSequence: state.nextSeq,
      activeCallId: state.activeTurnId ? assistantCallId(state.activeTurnId) : null,
      completedCallId: state.completedTurnId ? assistantCallId(state.completedTurnId) : null,
      turnStartedAt: state.turnStartMs,
      runStartedAt: state.runStartMs,
      lastRunDurationMs: state.runDurationMs,
      pendingPromptEchoes: [...state.pendingUserEchoes],
      subagents: Object.entries(state.subagents).map(([id, activity]) => ({ id, activity })),
    },
    view: {
      scroll: { isAtBottom: state.isAtBottom, scrollTop: state.scrollTop },
      expandedSummaryIds,
      expandedToolBlockIds,
      expandedToolIds,
      thinkingOverrides,
    },
  };
}

/** Materializes a normalized store into the former shape for migration verification only. */
export function materializeLegacyFeedState(store: FeedStore): LegacyFeedState {
  const snapshot = store.exportSnapshot();
  const blocks = store.select(feedSelectors.orderedBlockIds)
    .map((id) => store.select(feedSelectors.blockById(id)))
    .filter((block): block is FeedBlock => block !== undefined);
  return {
    blocks,
    nextSeq: snapshot.runtime.nextSequence,
    activeTurnId: snapshot.runtime.activeCallId,
    completedTurnId: snapshot.runtime.completedCallId,
    turnStartMs: snapshot.runtime.turnStartedAt,
    runStartMs: snapshot.runtime.runStartedAt,
    runDurationMs: snapshot.runtime.lastRunDurationMs,
    pendingUserEchoes: [...snapshot.runtime.pendingPromptEchoes],
    subagents: Object.fromEntries(snapshot.runtime.subagents.map(({ id, activity }) => [id, activity])),
    isAtBottom: snapshot.view.scroll.isAtBottom,
    scrollTop: snapshot.view.scroll.scrollTop,
  };
}
