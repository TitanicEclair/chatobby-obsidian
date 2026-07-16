import type { FeedBlockEntity } from "../domain/entities";
import type { BlockId, ToolCallId } from "../domain/ids";
import type { FeedSnapshotV2, UnknownFeedSnapshot } from "../domain/snapshots";
import type { MutableFeedIndexes, MutableFeedStoreState } from "./store-state";

/** Typed failure raised when a feed snapshot cannot be safely hydrated. */
export class FeedHydrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedHydrationError";
  }
}

/** Creates the empty versioned snapshot used for new session tabs. */
export function createEmptyFeedSnapshot(): FeedSnapshotV2 {
  return {
    schemaVersion: 2,
    blockOrder: [],
    blocks: [],
    tools: [],
    toolBlockItems: [],
    summaryChildren: [],
    runtime: {
      nextSequence: 0,
      activeCallId: null,
      completedCallId: null,
      turnStartedAt: null,
      runStartedAt: null,
      lastRunDurationMs: null,
      pendingPromptEchoes: [],
      subagents: [],
    },
    view: {
      scroll: { isAtBottom: true, scrollTop: 0 },
      expandedSummaryIds: [],
      expandedToolBlockIds: [],
      expandedToolIds: [],
      thinkingOverrides: [],
    },
  };
}

/** Validates a v2 snapshot and rebuilds all private lookup indexes. Runs in O(total entities). */
export function decodeFeedSnapshot(snapshot: UnknownFeedSnapshot): MutableFeedStoreState {
  if (!isFeedSnapshotV2(snapshot)) throw new FeedHydrationError("Unsupported or malformed feed snapshot");

  const blocksById = uniqueMap(snapshot.blocks, (block) => block.id, "block");
  const toolsById = uniqueMap(snapshot.tools, (tool) => tool.id, "tool");
  const toolBlockItems = entryMap(snapshot.toolBlockItems, (entry) => entry.blockId, (entry) => [...entry.toolIds], "tool block");
  const summaryChildren = entryMap(snapshot.summaryChildren, (entry) => entry.summaryId, (entry) => [...entry.childIds], "summary");

  for (const id of snapshot.blockOrder) requireBlock(blocksById, id, "Feed order");
  for (const [blockIdValue, toolIds] of toolBlockItems) {
    const block = requireBlock(blocksById, blockIdValue, "Tool items");
    if (block.type !== "tools") throw new FeedHydrationError(`Tool item entry targets non-tool block: ${blockIdValue}`);
    for (const id of toolIds) {
      if (!toolsById.has(id)) throw new FeedHydrationError(`Tool block ${blockIdValue} references unknown tool ${id}`);
    }
  }
  for (const [summaryId, childIds] of summaryChildren) {
    const summary = requireBlock(blocksById, summaryId, "Summary children");
    if (summary.type !== "summary") throw new FeedHydrationError(`Summary entry targets non-summary block: ${summaryId}`);
    for (const id of childIds) requireBlock(blocksById, id, `Summary ${summaryId}`);
  }

  const indexes = rebuildIndexes(blocksById, toolBlockItems, summaryChildren);
  return {
    blockOrder: [...snapshot.blockOrder],
    blocksById,
    toolsById,
    toolBlockItems,
    summaryChildren,
    runtime: {
      nextSequence: snapshot.runtime.nextSequence,
      activeCallId: snapshot.runtime.activeCallId,
      completedCallId: snapshot.runtime.completedCallId,
      turnStartedAt: snapshot.runtime.turnStartedAt,
      runStartedAt: snapshot.runtime.runStartedAt,
      lastRunDurationMs: snapshot.runtime.lastRunDurationMs,
      pendingPromptEchoes: [...snapshot.runtime.pendingPromptEchoes],
      subagentsById: new Map(snapshot.runtime.subagents.map((entry) => [entry.id, entry.activity])),
    },
    view: {
      scroll: { ...snapshot.view.scroll },
      expandedSummaryIds: new Set(snapshot.view.expandedSummaryIds),
      expandedToolBlockIds: new Set(snapshot.view.expandedToolBlockIds),
      expandedToolIds: new Set(snapshot.view.expandedToolIds),
      thinkingOverrides: new Map(snapshot.view.thinkingOverrides.map((entry) => [entry.blockId, entry.mode])),
    },
    indexes,
  };
}

/** Serializes private tables into the stable plain-data snapshot format. Runs in O(total entities). */
export function encodeFeedSnapshot(state: MutableFeedStoreState): FeedSnapshotV2 {
  return {
    schemaVersion: 2,
    blockOrder: [...state.blockOrder],
    blocks: [...state.blocksById.values()],
    tools: [...state.toolsById.values()],
    toolBlockItems: [...state.toolBlockItems].map(([blockIdValue, toolIds]) => ({ blockId: blockIdValue, toolIds: [...toolIds] })),
    summaryChildren: [...state.summaryChildren].map(([summaryId, childIds]) => ({ summaryId, childIds: [...childIds] })),
    runtime: {
      nextSequence: state.runtime.nextSequence,
      activeCallId: state.runtime.activeCallId,
      completedCallId: state.runtime.completedCallId,
      turnStartedAt: state.runtime.turnStartedAt,
      runStartedAt: state.runtime.runStartedAt,
      lastRunDurationMs: state.runtime.lastRunDurationMs,
      pendingPromptEchoes: [...state.runtime.pendingPromptEchoes],
      subagents: [...state.runtime.subagentsById].map(([id, activity]) => ({ id, activity })),
    },
    view: {
      scroll: { ...state.view.scroll },
      expandedSummaryIds: [...state.view.expandedSummaryIds],
      expandedToolBlockIds: [...state.view.expandedToolBlockIds],
      expandedToolIds: [...state.view.expandedToolIds],
      thinkingOverrides: [...state.view.thinkingOverrides].map(([blockIdValue, mode]) => ({ blockId: blockIdValue, mode })),
    },
  };
}

function rebuildIndexes(
  blocksById: Map<BlockId, FeedBlockEntity>,
  toolBlockItems: Map<BlockId, ToolCallId[]>,
  summaryChildren: Map<BlockId, BlockId[]>,
): MutableFeedIndexes {
  const indexes: MutableFeedIndexes = {
    assistantBlockByScopeAndIndex: new Map(),
    latestAssistantBlockByCall: new Map(),
    toolLocationByCallId: new Map(),
    summaryParentsByChild: new Map(),
    subagentBlockByAgentId: new Map(),
    extensionPanelByKey: new Map(),
  };
  for (const block of blocksById.values()) {
    if (block.type === "thinking" || block.type === "text" || block.type === "tools") {
      for (let index = block.startIndex; index <= block.endIndex; index += 1) {
        indexes.assistantBlockByScopeAndIndex.set(`${block.turnId}:${block.type}:${index}`, block.id);
      }
      indexes.latestAssistantBlockByCall.set(block.turnId, block.id);
    } else if (block.type === "subagent") {
      indexes.subagentBlockByAgentId.set(block.agentId, block.id);
    } else if (block.type === "extension-panel" && block.key) {
      indexes.extensionPanelByKey.set(block.key, block.id);
    }
  }
  for (const [blockIdValue, toolIds] of toolBlockItems) {
    for (const id of toolIds) indexes.toolLocationByCallId.set(id, { blockId: blockIdValue });
  }
  for (const [summaryId, childIds] of summaryChildren) {
    for (const childId of childIds) {
      const parents = indexes.summaryParentsByChild.get(childId) ?? new Set<BlockId>();
      parents.add(summaryId);
      indexes.summaryParentsByChild.set(childId, parents);
    }
  }
  return indexes;
}

function isFeedSnapshotV2(value: unknown): value is FeedSnapshotV2 {
  if (!isRecord(value) || value.schemaVersion !== 2) return false;
  return isStringArray(value.blockOrder) &&
    Array.isArray(value.blocks) && value.blocks.every(isFeedBlock) &&
    Array.isArray(value.tools) && value.tools.every(isToolItem) &&
    Array.isArray(value.toolBlockItems) && value.toolBlockItems.every((entry) => isRecord(entry) && typeof entry.blockId === "string" && isStringArray(entry.toolIds)) &&
    Array.isArray(value.summaryChildren) && value.summaryChildren.every((entry) => isRecord(entry) && typeof entry.summaryId === "string" && isStringArray(entry.childIds)) &&
    isRuntimeSnapshot(value.runtime) &&
    isViewSnapshot(value.view);
}

function isFeedBlock(value: unknown): value is FeedBlockEntity {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") return false;
  const supported = ["thinking", "text", "tools", "summary", "user", "system", "queued", "compaction", "subagent", "subagent-communication", "extension-panel"];
  if (!supported.includes(value.type)) return false;
  if (value.type === "thinking" || value.type === "text" || value.type === "tools") {
    return typeof value.turnId === "string" && isFiniteNumber(value.startIndex) && isFiniteNumber(value.endIndex);
  }
  if (value.type === "summary") return typeof value.turnId === "string";
  return true;
}

function isToolItem(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    typeof value.arguments === "string" &&
    isToolItemStatus(value.status);
}

function isToolItemStatus(value: unknown): boolean {
  return value === "pending" || value === "running" || value === "waiting" || value === "succeeded" ||
    value === "failed" || value === "cancelled" || value === "interrupted";
}

function isRuntimeSnapshot(value: unknown): boolean {
  if (!isRecord(value) || !Number.isSafeInteger(value.nextSequence) || (value.nextSequence as number) < 0) return false;
  return isNullableString(value.activeCallId) &&
    isNullableString(value.completedCallId) &&
    isNullableNumber(value.turnStartedAt) &&
    isNullableNumber(value.runStartedAt) &&
    isNullableNumber(value.lastRunDurationMs) &&
    isStringArray(value.pendingPromptEchoes) &&
    Array.isArray(value.subagents) && value.subagents.every((entry) => isRecord(entry) && typeof entry.id === "string" && isRecord(entry.activity));
}

function isViewSnapshot(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.scroll)) return false;
  return typeof value.scroll.isAtBottom === "boolean" &&
    isFiniteNumber(value.scroll.scrollTop) &&
    isStringArray(value.expandedSummaryIds) &&
    isStringArray(value.expandedToolBlockIds) &&
    isStringArray(value.expandedToolIds) &&
    Array.isArray(value.thinkingOverrides) && value.thinkingOverrides.every((entry) =>
      isRecord(entry) && typeof entry.blockId === "string" &&
      (entry.mode === "expanded" || entry.mode === "collapsed" || entry.mode === "hidden"));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): boolean {
  return value === null || isFiniteNumber(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uniqueMap<T, K>(values: readonly T[], key: (value: T) => K, label: string): Map<K, T> {
  const result = new Map<K, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new FeedHydrationError(`Duplicate ${label} id: ${String(id)}`);
    result.set(id, value);
  }
  return result;
}

function entryMap<T, K, V>(
  values: readonly T[],
  key: (value: T) => K,
  mapValue: (value: T) => V,
  label: string,
): Map<K, V> {
  const result = new Map<K, V>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new FeedHydrationError(`Duplicate ${label} entry: ${String(id)}`);
    result.set(id, mapValue(value));
  }
  return result;
}

function requireBlock(blocks: Map<BlockId, FeedBlockEntity>, id: BlockId, source: string): FeedBlockEntity {
  const block = blocks.get(id);
  if (!block) throw new FeedHydrationError(`${source} references unknown block ${id}`);
  return block;
}
