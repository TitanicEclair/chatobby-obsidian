import type { BlockId, ToolCallId } from "../domain/ids";
import type { FeedAction } from "./actions";

/** Exact entities and state slices changed by one atomic feed dispatch. */
export interface FeedChangeSet {
  readonly addedBlockIds: readonly BlockId[];
  readonly updatedBlockIds: readonly BlockId[];
  readonly removedBlockIds: readonly BlockId[];
  readonly updatedToolIds: readonly ToolCallId[];
  readonly orderChanged: boolean;
  readonly runtimeChanged: boolean;
  readonly scrollChanged: boolean;
  readonly expansionChanged: boolean;
  /** True when normalized document/runtime entities changed, excluding presentation state. */
  readonly documentChanged: boolean;
  /** True when scroll or expansion presentation state changed. */
  readonly viewChanged: boolean;
}

/** Atomic result delivered after a store action has fully committed. */
export interface FeedCommit {
  readonly revision: number;
  readonly documentRevision: number;
  readonly viewRevision: number;
  readonly changes: FeedChangeSet;
  /** Command that produced this atomic commit, used for renderer scheduling and diagnostics. */
  readonly action: FeedAction;
}

export function emptyChangeSet(): FeedChangeSet {
  return {
    addedBlockIds: [],
    updatedBlockIds: [],
    removedBlockIds: [],
    updatedToolIds: [],
    orderChanged: false,
    runtimeChanged: false,
    scrollChanged: false,
    expansionChanged: false,
    documentChanged: false,
    viewChanged: false,
  };
}
