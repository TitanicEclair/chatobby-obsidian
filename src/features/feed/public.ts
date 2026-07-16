/** Commands accepted by the normalized feed store and its view-only subset. */
export type { FeedAction, FeedViewAction, ExtensionPanelInput } from "./state/actions";

/** Immutable commit metadata emitted after an atomic feed transaction. */
export type { FeedCommit, FeedChangeSet } from "./state/change-set";

/** Store interfaces for dispatch, selection, and lifecycle-safe subscriptions. */
export type { FeedStore, CreateFeedStoreOptions, FeedCommitListener, FeedSelectorListener, FeedSubscription } from "./state/feed-store";

/** Creates an empty store or hydrates one from a versioned snapshot. */
export { createFeedStore, hydrateFeedStore } from "./state/feed-store";

/** Read-only selector contracts exposed to renderers and controllers. */
export type { FeedReader, FeedSelector, RunTimingView } from "./state/selectors";

/** Stable selector catalogue for feed documents, entities, and view state. */
export { feedSelectors } from "./state/selectors";

/** Flat materialized read model accepted by incremental projection synchronization. */
export type { FeedDocumentProjection } from "./domain/projections";

/** Versioned persistence format accepted by feed hydration. */
export type { FeedSnapshot, FeedSnapshotV2, UnknownFeedSnapshot } from "./domain/snapshots";

/** Snapshot defaults and the typed hydration failure raised for invalid input. */
export { createEmptyFeedSnapshot, FeedHydrationError } from "./state/snapshot-codec";

/** Branded identifiers that prevent mixing block, tool, and assistant call IDs. */
export type { BlockId, ToolCallId, AssistantCallId } from "./domain/ids";

/** Validates and brands external identifiers at the feature boundary. */
export { blockId, toolCallId, assistantCallId } from "./domain/ids";

/** Test and migration-only shape used to compare pre-normalization feed behavior. */
export type { LegacyFeedState } from "./migration/legacy-feed-migration";

/** Explicit one-way migration helpers; not used by the production renderer path. */
export { INITIAL_LEGACY_FEED_STATE, materializeLegacyFeedState, migrateLegacyFeedState } from "./migration/legacy-feed-migration";
