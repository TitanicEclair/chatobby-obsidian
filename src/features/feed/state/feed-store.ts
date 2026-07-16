import type { FeedBlock, ThinkingBlock, ToolBlock, ToolItem, TurnSummary } from "../../../types";
import type { BlockId, ToolCallId } from "../domain/ids";
import type { FeedSnapshot, UnknownFeedSnapshot } from "../domain/snapshots";
import type { FeedAction } from "./actions";
import type { FeedCommit, FeedChangeSet } from "./change-set";
import { FeedTransaction } from "./feed-transaction";
import { reduceFeedAction } from "./reducers";
import type { FeedReader, FeedSelector, RunTimingView } from "./selectors";
import { createEmptyFeedSnapshot, decodeFeedSnapshot, encodeFeedSnapshot } from "./snapshot-codec";
import type { MutableFeedStoreState } from "./store-state";

export type FeedCommitListener = (commit: FeedCommit) => void;
export type FeedSelectorListener<T> = (value: T, previous: T) => void;

export interface FeedSubscription {
  dispose(): void;
}

/** Public read/dispatch/subscribe surface for one session tab's normalized feed. */
export interface FeedStore {
  readonly revision: number;
  dispatch(action: FeedAction): FeedCommit;
  select<T>(selector: FeedSelector<T>): T;
  subscribe(listener: FeedCommitListener): FeedSubscription;
  observe<T>(selector: FeedSelector<T>, listener: FeedSelectorListener<T>): FeedSubscription;
  exportSnapshot(): FeedSnapshot;
}

export interface CreateFeedStoreOptions {
  readonly snapshot?: UnknownFeedSnapshot;
  readonly now?: () => number;
}

/** Creates an isolated normalized feed store. Snapshot hydration is O(total entities). */
export function createFeedStore(options: CreateFeedStoreOptions = {}): FeedStore {
  const snapshot = options.snapshot ?? createEmptyFeedSnapshot();
  return new FeedStoreImplementation(decodeFeedSnapshot(snapshot), options.now ?? Date.now);
}

/** Hydrates a validated versioned feed snapshot and rebuilds all private indexes. */
export function hydrateFeedStore(snapshot: UnknownFeedSnapshot, now: () => number = Date.now): FeedStore {
  return new FeedStoreImplementation(decodeFeedSnapshot(snapshot), now);
}

class FeedStoreImplementation implements FeedStore {
  private currentRevision = 0;
  private documentRevision = 0;
  private viewRevision = 0;
  private dispatching = false;
  private readonly listeners = new Set<FeedCommitListener>();
  private readonly blockCache = new Map<BlockId, FeedBlock>();
  private readonly reader: FeedReader;

  constructor(
    private readonly state: MutableFeedStoreState,
    private readonly now: () => number,
  ) {
    this.reader = {
      orderedBlockIds: () => this.state.blockOrder,
      blockById: (id) => this.materializeBlock(id, new Set()),
      toolById: (id) => this.state.toolsById.get(id),
      scroll: () => this.state.view.scroll,
      runTiming: () => this.runTiming(),
      subagents: () => [...this.state.runtime.subagentsById.values()],
    };
  }

  get revision(): number {
    return this.currentRevision;
  }

  dispatch(action: FeedAction): FeedCommit {
    if (this.dispatching) throw new Error("FeedStore does not allow reentrant dispatch");
    this.dispatching = true;
    let commit: FeedCommit;
    try {
      const transaction = new FeedTransaction(this.state, this.now);
      reduceFeedAction(transaction, action);
      commit = this.finishCommit(transaction.changes(), action);
    } finally {
      this.dispatching = false;
    }
    // Notify listeners AFTER clearing the dispatch flag. Listeners (e.g. the feed
    // renderer scrolling to bottom) may themselves dispatch view-state updates;
    // firing them while dispatching was still true made those updates trip the
    // reentrancy guard and throw, crashing sendPrompt / event handling. Each
    // listener is isolated so one throw can never kill the dispatch path.
    this.notifyListeners(commit);
    return commit;
  }

  select<T>(selector: FeedSelector<T>): T {
    return selector(this.reader);
  }

  subscribe(listener: FeedCommitListener): FeedSubscription {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  observe<T>(selector: FeedSelector<T>, listener: FeedSelectorListener<T>): FeedSubscription {
    let previous = this.select(selector);
    return this.subscribe(() => {
      const value = this.select(selector);
      if (Object.is(previous, value)) return;
      const before = previous;
      previous = value;
      listener(value, before);
    });
  }

  exportSnapshot(): FeedSnapshot {
    return encodeFeedSnapshot(this.state);
  }

  private finishCommit(changes: FeedChangeSet, action: FeedAction): FeedCommit {
    const documentChanged = changes.documentChanged;
    const viewChanged = changes.viewChanged;
    this.invalidateMaterializedBlocks(changes);
    if (documentChanged || viewChanged) this.currentRevision += 1;
    if (documentChanged) this.documentRevision += 1;
    if (viewChanged) this.viewRevision += 1;
    return {
      revision: this.currentRevision,
      documentRevision: this.documentRevision,
      viewRevision: this.viewRevision,
      changes,
      action,
    };
  }

  private notifyListeners(commit: FeedCommit): void {
    if (!commit.changes.documentChanged && !commit.changes.viewChanged) return;
    for (const listener of [...this.listeners]) {
      try {
        listener(commit);
      } catch (error) {
        console.error("Chatobby: feed store listener threw", error);
      }
    }
  }

  private materializeBlock(id: BlockId, ancestors: Set<BlockId>): FeedBlock | undefined {
    const cached = this.blockCache.get(id);
    if (cached) return cached;
    const entity = this.state.blocksById.get(id);
    if (!entity) return undefined;
    if (ancestors.has(id)) throw new Error(`Feed summary cycle detected at ${id}`);
    switch (entity.type) {
      case "thinking":
        return this.cacheBlock(id, {
          ...entity,
          id,
          turnId: entity.turnId,
          displayMode: this.state.view.thinkingOverrides.get(id) ?? null,
        } satisfies ThinkingBlock);
      case "tools": {
        const items = (this.state.toolBlockItems.get(id) ?? [])
          .map((toolId) => this.materializeTool(toolId))
          .filter((item): item is ToolItem => item !== undefined);
        return this.cacheBlock(id, {
          ...entity,
          id,
          turnId: entity.turnId,
          items,
          isExpanded: this.state.view.expandedToolBlockIds.has(id),
        } satisfies ToolBlock);
      }
      case "summary": {
        const nextAncestors = new Set(ancestors).add(id);
        const blocks = (this.state.summaryChildren.get(id) ?? [])
          .map((childId) => this.materializeBlock(childId, nextAncestors))
          .filter((block): block is FeedBlock => block !== undefined);
        return this.cacheBlock(id, {
          ...entity,
          id,
          turnId: entity.turnId,
          blocks,
          isExpanded: this.state.view.expandedSummaryIds.has(id),
        } satisfies TurnSummary);
      }
      default:
        return this.cacheBlock(id, { ...entity, id } as FeedBlock);
    }
  }

  private materializeTool(id: ToolCallId): ToolItem | undefined {
    const tool = this.state.toolsById.get(id);
    if (!tool) return undefined;
    return { ...tool, id, isExpanded: this.state.view.expandedToolIds.has(id) };
  }

  private runTiming(): RunTimingView {
    return {
      activeCallId: this.state.runtime.activeCallId,
      runStartedAt: this.state.runtime.runStartedAt,
      lastRunDurationMs: this.state.runtime.lastRunDurationMs,
    };
  }

  private cacheBlock(id: BlockId, block: FeedBlock): FeedBlock {
    this.blockCache.set(id, block);
    return block;
  }

  private invalidateMaterializedBlocks(changes: FeedChangeSet): void {
    const pending = new Set<BlockId>([
      ...changes.addedBlockIds,
      ...changes.updatedBlockIds,
      ...changes.removedBlockIds,
    ]);
    for (const toolId of changes.updatedToolIds) {
      const location = this.state.indexes.toolLocationByCallId.get(toolId);
      if (location) pending.add(location.blockId);
    }
    const queue = [...pending];
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) continue;
      this.blockCache.delete(id);
      for (const parent of this.state.indexes.summaryParentsByChild.get(id) ?? []) {
        if (pending.has(parent)) continue;
        pending.add(parent);
        queue.push(parent);
      }
    }
  }
}
