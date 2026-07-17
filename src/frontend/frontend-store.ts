import type {
  FrontendBootstrap,
  FrontendFeedBlock,
  FrontendPatch,
  FrontendPatchOperation,
  FrontendScreenViewModel,
} from "../vendor/chatobby-client/frontend-contracts.js";
import { chatobbyPerformance } from "./performance-monitor";

export class FrontendResyncRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrontendResyncRequiredError";
  }
}

export interface FrontendLocalOverlay {
  readonly expandedBlockIds: ReadonlySet<string>;
  readonly drafts: ReadonlyMap<string, string>;
}

type StoreListener = (snapshot: FrontendBootstrap) => void;
type StoreSelector<T> = (snapshot: FrontendBootstrap) => T;
type StoreSelectionListener<T> = (selection: T) => void;

/**
 * Generic connector-side holder for runtime-owned read models.
 * Only local presentation overlays survive snapshot replacement.
 */
export class FrontendStore {
  private snapshotValue: FrontendBootstrap | null = null;
  private readonly listeners = new Set<StoreListener>();
  private readonly expandedBlockIds = new Set<string>();
  private readonly drafts = new Map<string, string>();
  private readonly feedBlockIndexes = new Map<string, number>();

  get snapshot(): FrontendBootstrap | null {
    return this.snapshotValue;
  }

  get local(): FrontendLocalOverlay {
    return { expandedBlockIds: this.expandedBlockIds, drafts: this.drafts };
  }

  replace(snapshot: FrontendBootstrap): void {
    this.snapshotValue = snapshot;
    this.rebuildFeedBlockIndexes(snapshot.feed.blocks);
    this.emit();
  }

  replaceScreen(screen: FrontendScreenViewModel): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) throw new FrontendResyncRequiredError("Frontend bootstrap is missing");
    this.snapshotValue = withScreen(snapshot, screen);
    this.emit();
  }

  apply(patch: FrontendPatch): "applied" | "duplicate" {
    const snapshot = this.snapshotValue;
    if (!snapshot) throw new FrontendResyncRequiredError("Frontend bootstrap is missing");
    if (patch.runtimeInstanceId !== snapshot.runtimeInstanceId) {
      throw new FrontendResyncRequiredError("Chatobby runtime instance changed");
    }
    if (patch.sequence <= snapshot.sequence) return "duplicate";
    if (patch.sequence !== snapshot.sequence + 1) {
      throw new FrontendResyncRequiredError(`Frontend patch sequence gap: expected ${snapshot.sequence + 1}, received ${patch.sequence}`);
    }
    if (patch.baseRevision !== snapshot.revision) {
      throw new FrontendResyncRequiredError(`Frontend revision mismatch: expected ${snapshot.revision}, received ${patch.baseRevision}`);
    }

    let next = snapshot;
    for (const operation of patch.operations) {
      next = applyOperation(next, operation, this.feedBlockIndexes);
      if (
        operation.type === "feed.document.replace" ||
        operation.type === "feed.block.upsert" ||
        operation.type === "feed.block.remove"
      ) {
        this.rebuildFeedBlockIndexes(next.feed.blocks);
      }
    }
    this.snapshotValue = { ...next, revision: patch.revision, sequence: patch.sequence };
    this.emit();
    return "applied";
  }

  setExpanded(blockId: string, expanded: boolean): void {
    if (expanded) this.expandedBlockIds.add(blockId);
    else this.expandedBlockIds.delete(blockId);
  }

  setDraft(key: string, value: string): void {
    if (value) this.drafts.set(key, value);
    else this.drafts.delete(key);
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    if (this.snapshotValue) listener(this.snapshotValue);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to one stable slice without replaying its current value.
   * Screen renderers already synchronously read their initial model when they
   * mount, so suppressing the initial replay avoids a duplicate first render.
   */
  subscribeSelector<T>(
    selector: StoreSelector<T>,
    listener: StoreSelectionListener<T>,
    equals: (left: T, right: T) => boolean = Object.is,
  ): () => void {
    let hasSelection = this.snapshotValue !== null;
    let selection = this.snapshotValue === null ? undefined : selector(this.snapshotValue);
    const storeListener: StoreListener = (snapshot) => {
      const next = selector(snapshot);
      if (hasSelection && equals(selection as T, next)) return;
      selection = next;
      hasSelection = true;
      listener(next);
    };
    this.listeners.add(storeListener);
    return () => this.listeners.delete(storeListener);
  }

  private emit(): void {
    if (!this.snapshotValue) return;
	const startedAt = performance.now();
    for (const listener of this.listeners) listener(this.snapshotValue);
	chatobbyPerformance.recordStoreNotification(performance.now() - startedAt);
  }

  private rebuildFeedBlockIndexes(blocks: readonly FrontendFeedBlock[]): void {
    this.feedBlockIndexes.clear();
    for (const [index, block] of blocks.entries()) this.feedBlockIndexes.set(block.id, index);
  }
}

function applyOperation(
  snapshot: FrontendBootstrap,
  operation: FrontendPatchOperation,
  feedBlockIndexes: ReadonlyMap<string, number>,
): FrontendBootstrap {
  switch (operation.type) {
    case "session.replace":
      return { ...snapshot, session: operation.session };
    case "task-plan.replace":
      return { ...snapshot, taskPlan: operation.taskPlan };
    case "composer.replace":
      return { ...snapshot, composer: operation.composer };
    case "agent-rail.replace":
      return { ...snapshot, agentRail: operation.agentRail };
    case "feed.document.replace":
      return { ...snapshot, feed: operation.feed };
    case "feed.block.upsert": {
      const blocks = [...snapshot.feed.blocks];
      const existingIndex = feedBlockIndexes.get(operation.block.id) ?? -1;
      if (existingIndex >= 0) blocks[existingIndex] = operation.block;
      else blocks.splice(Math.min(operation.index, blocks.length), 0, operation.block);
      return withFeedBlocks(snapshot, blocks);
    }
    case "feed.block.remove":
      return withFeedBlocks(snapshot, snapshot.feed.blocks.filter((block) => block.id !== operation.blockId));
    case "feed.text.append":
      return appendFeedText(snapshot, operation.blockId, operation.text, feedBlockIndexes);
    case "feed.turn.finalize":
      return withFeedBlocks(snapshot, snapshot.feed.blocks.map((block) => finalizeTurn(block, operation.turnId)));
    case "screen.replace":
      return withScreen(snapshot, operation.screen);
  }
}

function appendFeedText(
  snapshot: FrontendBootstrap,
  blockId: string,
  text: string,
  indexes: ReadonlyMap<string, number>,
): FrontendBootstrap {
  const index = indexes.get(blockId);
  if (index === undefined) return snapshot;
  const block = snapshot.feed.blocks[index];
  if (!block) return snapshot;
  const appended = appendText(block, blockId, text);
  if (appended === block) return snapshot;
  const blocks = [...snapshot.feed.blocks];
  blocks[index] = appended;
  return withFeedBlocks(snapshot, blocks);
}

function withScreen(snapshot: FrontendBootstrap, screen: FrontendScreenViewModel): FrontendBootstrap {
  return {
    ...snapshot,
    screenModels: [...snapshot.screenModels.filter((candidate) => candidate.screenId !== screen.screenId), screen],
  };
}

function withFeedBlocks(snapshot: FrontendBootstrap, blocks: readonly FrontendFeedBlock[]): FrontendBootstrap {
  return { ...snapshot, feed: { ...snapshot.feed, revision: snapshot.feed.revision + 1, blocks } };
}

function appendText(block: FrontendFeedBlock, blockId: string, text: string): FrontendFeedBlock {
  if (block.id !== blockId || (block.type !== "text" && block.type !== "thinking")) return block;
  return { ...block, text: `${block.text}${text}` };
}

function finalizeTurn(block: FrontendFeedBlock, turnId: string): FrontendFeedBlock {
  if ((block.type === "text" || block.type === "thinking" || block.type === "tools") && block.turnId === turnId) {
    return { ...block, phase: "complete" };
  }
  return block;
}
