import type {
  FrontendBootstrap,
  FrontendFeedBlock,
  FrontendPatch,
  FrontendPatchOperation,
  FrontendProtocolErrorCode,
  FrontendScreenId,
  FrontendScreenResponse,
  FrontendScreenViewModel,
  FrontendSubscriptionResult,
} from "../vendor/chatobby-client/frontend-contracts.js";
import { chatobbyPerformance } from "./performance-monitor";

export class FrontendResyncRequiredError extends Error {
  constructor(
    message: string,
    readonly code: FrontendProtocolErrorCode = "malformed-entity",
  ) {
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
  private feedBlockIndexes = new Map<string, number>();
  private screenAuthorities = new Map<FrontendScreenId, {
    readonly requestEpoch: number;
    readonly sequence: number;
    readonly revision: number;
  }>();

  get snapshot(): FrontendBootstrap | null {
    return this.snapshotValue;
  }

  get local(): FrontendLocalOverlay {
    return { expandedBlockIds: this.expandedBlockIds, drafts: this.drafts };
  }

  replace(snapshot: FrontendBootstrap): void {
    this.snapshotValue = snapshot;
    this.screenAuthorities = new Map();
    this.feedBlockIndexes = indexFeedBlocks(snapshot.feed.blocks);
    this.emit();
  }

  replaceScreen(response: FrontendScreenResponse): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) throw new FrontendResyncRequiredError("Frontend bootstrap is missing", "sequence-gap");
    if (response.runtimeInstanceId !== snapshot.runtimeInstanceId) {
      throw new FrontendResyncRequiredError("Screen response targets a replaced runtime", "runtime-replaced");
    }
    if (response.viewId !== snapshot.viewId) {
      throw new FrontendResyncRequiredError("Screen response targets another view", "unauthorized-view");
    }
    const authority = this.screenAuthorities.get(response.screen.screenId);
    if (
      response.baseSequence !== snapshot.sequence
      || (authority && response.requestEpoch <= authority.requestEpoch)
      || (authority && response.screenRevision < authority.revision)
    ) {
      throw new FrontendResyncRequiredError("Stale screen response cannot replace newer state", "stale-screen-response");
    }
    this.screenAuthorities.set(response.screen.screenId, {
      requestEpoch: response.requestEpoch,
      sequence: response.baseSequence,
      revision: response.screenRevision,
    });
    this.snapshotValue = withScreen(snapshot, response.screen);
    this.emit();
  }

  applyReplay(result: Extract<FrontendSubscriptionResult, { status: "replayed" }>): void {
    const snapshot = this.snapshotValue;
    if (!snapshot) throw new FrontendResyncRequiredError("Replay requires an existing bootstrap", "sequence-gap");
    if (snapshot.runtimeInstanceId !== result.runtimeInstanceId || snapshot.viewId !== result.viewId) {
      throw new FrontendResyncRequiredError("Replay identity does not match the current store", "runtime-replaced");
    }
    if (snapshot.sequence !== result.baseSequence || snapshot.revision !== result.baseRevision) {
      throw new FrontendResyncRequiredError("Replay base does not match the current store", "revision-conflict");
    }
    for (const patch of result.replay) this.applyPatch(patch, false);
    if (this.snapshotValue?.sequence !== result.sequence || this.snapshotValue.revision !== result.revision) {
      throw new FrontendResyncRequiredError("Replay did not reach its declared cutover", "sequence-gap");
    }
    this.emit();
  }

  apply(patch: FrontendPatch): "applied" | "duplicate" {
    return this.applyPatch(patch, true);
  }

  private applyPatch(patch: FrontendPatch, notify: boolean): "applied" | "duplicate" {
    const snapshot = this.snapshotValue;
    if (!snapshot) throw new FrontendResyncRequiredError("Frontend bootstrap is missing", "sequence-gap");
    if (patch.runtimeInstanceId !== snapshot.runtimeInstanceId) {
      throw new FrontendResyncRequiredError("Chatobby runtime instance changed", "runtime-replaced");
    }
    if (patch.viewId !== snapshot.viewId || patch.scope.kind !== "view" || patch.scope.viewId !== snapshot.viewId) {
      throw new FrontendResyncRequiredError("Frontend patch targets another view", "unauthorized-view");
    }
    if (patch.sequence <= snapshot.sequence) return "duplicate";
    if (patch.sequence !== snapshot.sequence + 1) {
      throw new FrontendResyncRequiredError(`Frontend patch sequence gap: expected ${snapshot.sequence + 1}, received ${patch.sequence}`, "sequence-gap");
    }
    if (patch.baseRevision !== snapshot.revision) {
      throw new FrontendResyncRequiredError(`Frontend revision mismatch: expected ${snapshot.revision}, received ${patch.baseRevision}`, "revision-conflict");
    }

    let next = snapshot;
    let nextFeedBlockIndexes = new Map(this.feedBlockIndexes);
    const nextScreenAuthorities = new Map(this.screenAuthorities);
    for (const operation of patch.operations) {
      next = applyOperation(next, operation, nextFeedBlockIndexes);
      if (
        operation.type === "feed.document.replace" ||
        operation.type === "feed.block.upsert" ||
        operation.type === "feed.block.remove"
      ) {
        nextFeedBlockIndexes = indexFeedBlocks(next.feed.blocks);
      }
      if (operation.type === "screen.replace") {
        const existing = nextScreenAuthorities.get(operation.screen.screenId);
        nextScreenAuthorities.set(operation.screen.screenId, {
          requestEpoch: existing?.requestEpoch ?? 0,
          sequence: patch.sequence,
          revision: operation.screen.revision,
        });
      }
    }
    this.snapshotValue = { ...next, revision: patch.revision, sequence: patch.sequence };
    this.feedBlockIndexes = nextFeedBlockIndexes;
    this.screenAuthorities = nextScreenAuthorities;
    if (notify) this.emit();
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

}

function indexFeedBlocks(blocks: readonly FrontendFeedBlock[]): Map<string, number> {
  return new Map(blocks.map((block, index) => [block.id, index]));
}

function applyOperation(
  snapshot: FrontendBootstrap,
  operation: FrontendPatchOperation,
  feedBlockIndexes: ReadonlyMap<string, number>,
): FrontendBootstrap {
  switch (operation.type) {
    case "session.replace":
      return { ...snapshot, session: operation.session };
    case "session.clear":
      return { ...snapshot, session: null };
    case "task-plan.replace":
      return { ...snapshot, taskPlan: operation.taskPlan };
    case "composer.replace":
      return { ...snapshot, composer: operation.composer };
    case "agent-rail.replace":
      return { ...snapshot, agentRail: operation.agentRail };
    case "local-commands.replace":
      return { ...snapshot, localCommands: operation.localCommands };
    case "feed.document.replace":
      return { ...snapshot, feed: operation.feed };
    case "feed.block.upsert": {
      const blocks = [...snapshot.feed.blocks];
      const existingIndex = feedBlockIndexes.get(operation.block.id) ?? -1;
      if (existingIndex >= 0) blocks[existingIndex] = operation.block;
      else blocks.splice(Math.min(operation.index, blocks.length), 0, operation.block);
      return withFeedBlocks(snapshot, blocks);
    }
    case "feed.block.remove": {
      if (!feedBlockIndexes.has(operation.blockId)) {
        throw new FrontendResyncRequiredError(`Feed removal target is missing: ${operation.blockId}`, "malformed-entity");
      }
      return withFeedBlocks(snapshot, snapshot.feed.blocks.filter((block) => block.id !== operation.blockId));
    }
    case "feed.text.append":
      return appendFeedText(snapshot, operation.blockId, operation.text, feedBlockIndexes);
    case "feed.turn.finalize": {
      const hasTarget = snapshot.feed.blocks.some(
        (block) => (block.type === "text" || block.type === "thinking" || block.type === "tools")
          && block.turnId === operation.turnId,
      );
      if (!hasTarget) {
        throw new FrontendResyncRequiredError(`Feed finalize target is missing: ${operation.turnId}`, "malformed-entity");
      }
      return withFeedBlocks(snapshot, snapshot.feed.blocks.map((block) => finalizeTurn(block, operation.turnId)));
    }
    case "screen.replace":
      return withScreen(snapshot, operation.screen);
    default:
      return assertNever(operation);
  }
}

function appendFeedText(
  snapshot: FrontendBootstrap,
  blockId: string,
  text: string,
  indexes: ReadonlyMap<string, number>,
): FrontendBootstrap {
  const index = indexes.get(blockId);
  if (index === undefined) throw new FrontendResyncRequiredError(`Feed append target is missing: ${blockId}`, "malformed-entity");
  const block = snapshot.feed.blocks[index];
  if (!block) throw new FrontendResyncRequiredError(`Feed append target index is invalid: ${blockId}`, "malformed-entity");
  const appended = appendText(block, blockId, text);
  if (appended === block) throw new FrontendResyncRequiredError(`Feed append target is not textual: ${blockId}`, "malformed-entity");
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

function assertNever(value: never): never {
  throw new FrontendResyncRequiredError(
    `Unknown frontend patch operation: ${JSON.stringify(value)}`,
    "malformed-entity",
  );
}
