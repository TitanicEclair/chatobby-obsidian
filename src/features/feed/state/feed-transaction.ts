import type { SubagentActivity, ThinkingDisplayMode } from "../../../types";
import type { FeedBlockEntity, FeedScrollState, ToolItemEntity } from "../domain/entities";
import type { AssistantCallId, BlockId, ToolCallId } from "../domain/ids";
import { assistantCallId, blockId } from "../domain/ids";
import type { FeedChangeSet } from "./change-set";
import type { MutableFeedStoreState } from "./store-state";

type BlockUpdater = (current: FeedBlockEntity) => FeedBlockEntity;
type ToolUpdater = (current: ToolItemEntity) => ToolItemEntity;

/** Internal capability surface used by focused feed reducers for one atomic dispatch. */
export class FeedTransaction {
  private readonly addedBlockIds = new Set<BlockId>();
  private readonly updatedBlockIds = new Set<BlockId>();
  private readonly removedBlockIds = new Set<BlockId>();
  private readonly updatedToolIds = new Set<ToolCallId>();
  private orderChanged = false;
  private runtimeChanged = false;
  private scrollChanged = false;
  private expansionChanged = false;
  private documentChanged = false;

  constructor(
    private readonly state: MutableFeedStoreState,
    readonly now: () => number,
  ) {}

  allocateId(prefix: "block" | "call" | "message"): string {
    const value = `${prefix}-${this.state.runtime.nextSequence}`;
    this.state.runtime.nextSequence += 1;
    this.runtimeChanged = true;
    this.documentChanged = true;
    return value;
  }

  allocateBlockId(): BlockId {
    return blockId(this.allocateId("block"));
  }

  allocateCallId(): AssistantCallId {
    return assistantCallId(this.allocateId("call"));
  }

  getBlock(id: BlockId): FeedBlockEntity | undefined {
    return this.state.blocksById.get(id);
  }

  getTool(id: ToolCallId): ToolItemEntity | undefined {
    return this.state.toolsById.get(id);
  }

  get runStartedAt(): number | null {
    return this.state.runtime.runStartedAt;
  }

  get turnStartedAt(): number | null {
    return this.state.runtime.turnStartedAt;
  }

  get activeCallId(): AssistantCallId | null {
    return this.state.runtime.activeCallId;
  }

  ensureActiveCall(): AssistantCallId {
    if (this.state.runtime.activeCallId) return this.state.runtime.activeCallId;
    const id = this.allocateCallId();
    const startedAt = this.now();
    this.state.runtime.activeCallId = id;
    this.state.runtime.turnStartedAt = startedAt;
    this.state.runtime.runStartedAt ??= startedAt;
    this.markRuntimeChanged();
    return id;
  }

  finishActiveCall(): AssistantCallId | null {
    const id = this.state.runtime.activeCallId;
    if (!id) return null;
    this.state.runtime.completedCallId = id;
    this.state.runtime.activeCallId = null;
    this.state.runtime.turnStartedAt = null;
    this.markRuntimeChanged();
    return id;
  }

  consumePendingPromptEcho(text: string): boolean {
    const index = this.state.runtime.pendingPromptEchoes.indexOf(text);
    if (index < 0) return false;
    this.state.runtime.pendingPromptEchoes.splice(index, 1);
    this.markRuntimeChanged();
    return true;
  }

  orderedBlockIds(): readonly BlockId[] {
    return this.state.blockOrder;
  }

  allBlockIds(): readonly BlockId[] {
    return [...this.state.blocksById.keys()];
  }

  blockIndex(id: BlockId): number {
    return this.state.blockOrder.indexOf(id);
  }

  latestAssistantBlock(callId: AssistantCallId): FeedBlockEntity | undefined {
    const id = this.state.indexes.latestAssistantBlockByCall.get(callId);
    return id ? this.state.blocksById.get(id) : undefined;
  }

  findAssistantBlock(
    callId: AssistantCallId,
    type: "thinking" | "text" | "tools",
    contentIndex: number,
  ): FeedBlockEntity | undefined {
    const id = this.state.indexes.assistantBlockByScopeAndIndex.get(`${callId}:${type}:${contentIndex}`);
    return id ? this.state.blocksById.get(id) : undefined;
  }

  findToolLocation(id: ToolCallId): { blockId: BlockId } | undefined {
    return this.state.indexes.toolLocationByCallId.get(id);
  }

  allToolIds(): readonly ToolCallId[] {
    return [...this.state.toolsById.keys()];
  }

  toolIdsForBlock(id: BlockId): readonly ToolCallId[] {
    return this.state.toolBlockItems.get(id) ?? [];
  }

  findToolByContentIndex(blockIdValue: BlockId, contentIndex: number): ToolItemEntity | undefined {
    for (const id of this.state.toolBlockItems.get(blockIdValue) ?? []) {
      const tool = this.state.toolsById.get(id);
      if (tool?.contentIndex === contentIndex) return tool;
    }
    return undefined;
  }

  childIdsForSummary(id: BlockId): readonly BlockId[] {
    return this.state.summaryChildren.get(id) ?? [];
  }

  summaryParentIdsForChild(id: BlockId): readonly BlockId[] {
    return [...(this.state.indexes.summaryParentsByChild.get(id) ?? [])];
  }

  getSubagent(id: string): Readonly<SubagentActivity> | undefined {
    return this.state.runtime.subagentsById.get(id);
  }

  setSubagent(activity: Readonly<SubagentActivity>): void {
    this.state.runtime.subagentsById.set(activity.agentId, activity);
    this.markRuntimeChanged();
  }

  findSubagentBlock(id: string): BlockId | undefined {
    return this.state.indexes.subagentBlockByAgentId.get(id);
  }

  beginRun(startedAt = this.now()): void {
    this.state.runtime.runStartedAt = startedAt;
    this.state.runtime.lastRunDurationMs = null;
    this.state.runtime.turnStartedAt = startedAt;
    this.markRuntimeChanged();
  }

  ensureRunStarted(startedAt = this.now()): void {
    if (this.state.runtime.runStartedAt == null) this.state.runtime.runStartedAt = startedAt;
    if (this.state.runtime.turnStartedAt == null) this.state.runtime.turnStartedAt = startedAt;
    this.markRuntimeChanged();
  }

  completeRun(completedAt = this.now()): void {
    const startedAt = this.state.runtime.runStartedAt;
    if (startedAt != null) this.state.runtime.lastRunDurationMs = Math.max(0, completedAt - startedAt);
    if (this.state.runtime.activeCallId) this.state.runtime.completedCallId = this.state.runtime.activeCallId;
    this.state.runtime.activeCallId = null;
    this.state.runtime.runStartedAt = null;
    this.state.runtime.turnStartedAt = null;
    this.markRuntimeChanged();
  }

  resetHistoricalTiming(): void {
    this.state.runtime.activeCallId = null;
    this.state.runtime.runStartedAt = null;
    this.state.runtime.turnStartedAt = null;
    this.markRuntimeChanged();
  }

  appendPendingPromptEcho(text: string): void {
    this.state.runtime.pendingPromptEchoes.push(text);
    this.markRuntimeChanged();
  }

  removePendingPromptEcho(text: string): void {
    const index = this.state.runtime.pendingPromptEchoes.indexOf(text);
    if (index < 0) return;
    this.state.runtime.pendingPromptEchoes.splice(index, 1);
    this.markRuntimeChanged();
  }

  findExtensionPanelByKey(key: string): BlockId | undefined {
    return this.state.indexes.extensionPanelByKey.get(key);
  }

  addBlock(block: FeedBlockEntity, index = this.state.blockOrder.length): void {
    if (this.state.blocksById.has(block.id)) throw new Error(`Duplicate feed block id: ${block.id}`);
    this.state.blocksById.set(block.id, block);
    this.state.blockOrder = [
      ...this.state.blockOrder.slice(0, index),
      block.id,
      ...this.state.blockOrder.slice(index),
    ];
    this.addedBlockIds.add(block.id);
    this.orderChanged = true;
    this.documentChanged = true;
    this.indexBlock(block);
  }

  updateBlock(id: BlockId, update: BlockUpdater): void {
    const current = this.state.blocksById.get(id);
    if (!current) throw new Error(`Unknown feed block id: ${id}`);
    const next = update(current);
    if (next.id !== id) throw new Error("A feed block update cannot change its id");
    if (next === current) return;
    this.unindexBlock(current);
    this.state.blocksById.set(id, next);
    this.indexBlock(next);
    if (!this.addedBlockIds.has(id)) this.updatedBlockIds.add(id);
    this.documentChanged = true;
  }

  removeBlock(id: BlockId): void {
    const current = this.state.blocksById.get(id);
    if (!current) return;
    if ((this.state.indexes.summaryParentsByChild.get(id)?.size ?? 0) > 0) {
      throw new Error(`Cannot remove summarized child block: ${id}`);
    }
    this.unindexBlock(current);
    for (const toolIdValue of this.state.toolBlockItems.get(id) ?? []) {
      this.state.toolsById.delete(toolIdValue);
      this.state.indexes.toolLocationByCallId.delete(toolIdValue);
      this.state.view.expandedToolIds.delete(toolIdValue);
      this.updatedToolIds.add(toolIdValue);
    }
    for (const childId of this.state.summaryChildren.get(id) ?? []) {
      const parents = this.state.indexes.summaryParentsByChild.get(childId);
      parents?.delete(id);
      if (parents?.size === 0) this.state.indexes.summaryParentsByChild.delete(childId);
    }
    this.state.blocksById.delete(id);
    this.state.toolBlockItems.delete(id);
    this.state.summaryChildren.delete(id);
    this.state.blockOrder = this.state.blockOrder.filter((candidate) => candidate !== id);
    this.addedBlockIds.delete(id);
    this.updatedBlockIds.delete(id);
    this.removedBlockIds.add(id);
    this.orderChanged = true;
    this.documentChanged = true;
  }

  replaceOrder(order: readonly BlockId[]): void {
    if (order.length === this.state.blockOrder.length && order.every((id, index) => this.state.blockOrder[index] === id)) return;
    for (const id of order) {
      if (!this.state.blocksById.has(id)) throw new Error(`Feed order references unknown block: ${id}`);
    }
    this.state.blockOrder = [...order];
    this.orderChanged = true;
    this.documentChanged = true;
  }

  setToolBlockItems(blockIdValue: BlockId, toolIds: readonly ToolCallId[]): void {
    const block = this.state.blocksById.get(blockIdValue);
    if (block?.type !== "tools") throw new Error(`Block is not a tool block: ${blockIdValue}`);
    const previousIds = this.state.toolBlockItems.get(blockIdValue) ?? [];
    if (sameOrderedValues(previousIds, toolIds)) return;
    for (const previousId of previousIds) {
      if (!toolIds.includes(previousId)) this.state.indexes.toolLocationByCallId.delete(previousId);
    }
    for (const id of toolIds) {
      if (!this.state.toolsById.has(id)) throw new Error(`Tool block references unknown tool: ${id}`);
      this.state.indexes.toolLocationByCallId.set(id, { blockId: blockIdValue });
    }
    this.state.toolBlockItems.set(blockIdValue, [...toolIds]);
    if (!this.addedBlockIds.has(blockIdValue)) this.updatedBlockIds.add(blockIdValue);
    this.documentChanged = true;
  }

  setSummaryChildren(summaryId: BlockId, childIds: readonly BlockId[]): void {
    const summary = this.state.blocksById.get(summaryId);
    if (summary?.type !== "summary") throw new Error(`Block is not a summary: ${summaryId}`);
    for (const id of childIds) {
      if (!this.state.blocksById.has(id)) throw new Error(`Summary references unknown child: ${id}`);
    }
    const previous = this.state.summaryChildren.get(summaryId) ?? [];
    if (sameOrderedValues(previous, childIds)) return;
    for (const childId of previous) {
      const parents = this.state.indexes.summaryParentsByChild.get(childId);
      parents?.delete(summaryId);
      if (parents?.size === 0) this.state.indexes.summaryParentsByChild.delete(childId);
    }
    this.state.summaryChildren.set(summaryId, [...childIds]);
    for (const childId of childIds) {
      const parents = this.state.indexes.summaryParentsByChild.get(childId) ?? new Set<BlockId>();
      parents.add(summaryId);
      this.state.indexes.summaryParentsByChild.set(childId, parents);
    }
    if (!this.addedBlockIds.has(summaryId)) this.updatedBlockIds.add(summaryId);
    this.documentChanged = true;
  }

  addTool(tool: ToolItemEntity, blockIdValue: BlockId): void {
    if (this.state.toolsById.has(tool.id)) throw new Error(`Duplicate tool call id: ${tool.id}`);
    this.state.toolsById.set(tool.id, tool);
    this.state.indexes.toolLocationByCallId.set(tool.id, { blockId: blockIdValue });
    this.updatedToolIds.add(tool.id);
    this.documentChanged = true;
  }

  updateTool(id: ToolCallId, update: ToolUpdater): void {
    const current = this.state.toolsById.get(id);
    if (!current) throw new Error(`Unknown tool call id: ${id}`);
    const next = update(current);
    if (next.id !== id) throw new Error("A tool update cannot change its id");
    if (next === current) return;
    this.state.toolsById.set(id, next);
    this.updatedToolIds.add(id);
    const location = this.state.indexes.toolLocationByCallId.get(id);
    if (location && !this.addedBlockIds.has(location.blockId)) this.updatedBlockIds.add(location.blockId);
    this.documentChanged = true;
  }

  removeTool(id: ToolCallId): void {
    const location = this.state.indexes.toolLocationByCallId.get(id);
    if (!location || !this.state.toolsById.has(id)) return;
    this.state.toolsById.delete(id);
    this.state.indexes.toolLocationByCallId.delete(id);
    this.state.toolBlockItems.set(
      location.blockId,
      (this.state.toolBlockItems.get(location.blockId) ?? []).filter((candidate) => candidate !== id),
    );
    this.state.view.expandedToolIds.delete(id);
    this.updatedToolIds.add(id);
    if (!this.addedBlockIds.has(location.blockId)) this.updatedBlockIds.add(location.blockId);
    this.documentChanged = true;
  }

  replaceToolId(currentId: ToolCallId, next: ToolItemEntity): void {
    const current = this.state.toolsById.get(currentId);
    if (!current) throw new Error(`Unknown tool call id: ${currentId}`);
    if (currentId === next.id) {
      this.updateTool(currentId, () => next);
      return;
    }
    if (this.state.toolsById.has(next.id)) throw new Error(`Duplicate tool call id: ${next.id}`);
    const location = this.state.indexes.toolLocationByCallId.get(currentId);
    if (!location) throw new Error(`Tool call has no containing block: ${currentId}`);
    const ids = this.state.toolBlockItems.get(location.blockId) ?? [];
    this.state.toolsById.delete(currentId);
    this.state.toolsById.set(next.id, next);
    this.state.indexes.toolLocationByCallId.delete(currentId);
    this.state.indexes.toolLocationByCallId.set(next.id, location);
    this.state.toolBlockItems.set(location.blockId, ids.map((id) => id === currentId ? next.id : id));
    if (this.state.view.expandedToolIds.delete(currentId)) this.state.view.expandedToolIds.add(next.id);
    this.updatedToolIds.add(currentId);
    this.updatedToolIds.add(next.id);
    if (!this.addedBlockIds.has(location.blockId)) this.updatedBlockIds.add(location.blockId);
    this.documentChanged = true;
  }

  setScroll(scroll: FeedScrollState): void {
    const current = this.state.view.scroll;
    if (current.isAtBottom === scroll.isAtBottom &&
        current.scrollTop === scroll.scrollTop &&
        current.anchorBlockId === scroll.anchorBlockId &&
        current.anchorOffset === scroll.anchorOffset) return;
    this.state.view.scroll = scroll;
    this.scrollChanged = true;
  }

  setSummaryExpanded(id: BlockId, expanded: boolean): void {
    this.setBlockMembership(this.state.view.expandedSummaryIds, id, expanded);
  }

  setToolBlockExpanded(id: BlockId, expanded: boolean): void {
    this.setBlockMembership(this.state.view.expandedToolBlockIds, id, expanded);
  }

  setToolExpanded(id: ToolCallId, expanded: boolean): void {
    if (this.state.view.expandedToolIds.has(id) === expanded) return;
    if (expanded) this.state.view.expandedToolIds.add(id);
    else this.state.view.expandedToolIds.delete(id);
    this.expansionChanged = true;
    this.updatedToolIds.add(id);
    const location = this.state.indexes.toolLocationByCallId.get(id);
    if (location) this.updatedBlockIds.add(location.blockId);
  }

  setThinkingOverride(id: BlockId, mode: ThinkingDisplayMode): void {
    if (this.state.view.thinkingOverrides.get(id) === mode) return;
    this.state.view.thinkingOverrides.set(id, mode);
    this.expansionChanged = true;
    this.updatedBlockIds.add(id);
  }

  markRuntimeChanged(): void {
    this.runtimeChanged = true;
    this.documentChanged = true;
  }

  changes(): FeedChangeSet {
    const updatedBlockIds = new Set(this.updatedBlockIds);
    const queue = [...updatedBlockIds];
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) continue;
      for (const parentId of this.state.indexes.summaryParentsByChild.get(id) ?? []) {
        if (updatedBlockIds.has(parentId)) continue;
        updatedBlockIds.add(parentId);
        queue.push(parentId);
      }
    }
    return {
      addedBlockIds: [...this.addedBlockIds],
      updatedBlockIds: [...updatedBlockIds],
      removedBlockIds: [...this.removedBlockIds],
      updatedToolIds: [...this.updatedToolIds],
      orderChanged: this.orderChanged,
      runtimeChanged: this.runtimeChanged,
      scrollChanged: this.scrollChanged,
      expansionChanged: this.expansionChanged,
      documentChanged: this.documentChanged,
      viewChanged: this.scrollChanged || this.expansionChanged,
    };
  }

  private setBlockMembership(set: Set<BlockId>, value: BlockId, included: boolean): void {
    if (set.has(value) === included) return;
    if (included) set.add(value);
    else set.delete(value);
    this.expansionChanged = true;
    this.updatedBlockIds.add(value);
  }

  private indexBlock(block: FeedBlockEntity): void {
    if (block.type === "thinking" || block.type === "text" || block.type === "tools") {
      for (let index = block.startIndex; index <= block.endIndex; index += 1) {
        this.state.indexes.assistantBlockByScopeAndIndex.set(`${block.turnId}:${block.type}:${index}`, block.id);
      }
      this.state.indexes.latestAssistantBlockByCall.set(block.turnId, block.id);
    } else if (block.type === "subagent") {
      this.state.indexes.subagentBlockByAgentId.set(block.agentId, block.id);
    } else if (block.type === "extension-panel" && block.key) {
      this.state.indexes.extensionPanelByKey.set(block.key, block.id);
    }
  }

  private unindexBlock(block: FeedBlockEntity): void {
    if (block.type === "thinking" || block.type === "text" || block.type === "tools") {
      for (let index = block.startIndex; index <= block.endIndex; index += 1) {
        this.state.indexes.assistantBlockByScopeAndIndex.delete(`${block.turnId}:${block.type}:${index}`);
      }
      if (this.state.indexes.latestAssistantBlockByCall.get(block.turnId) === block.id) {
        this.state.indexes.latestAssistantBlockByCall.delete(block.turnId);
      }
    } else if (block.type === "subagent") {
      this.state.indexes.subagentBlockByAgentId.delete(block.agentId);
    } else if (block.type === "extension-panel" && block.key) {
      this.state.indexes.extensionPanelByKey.delete(block.key);
    }
  }
}

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
