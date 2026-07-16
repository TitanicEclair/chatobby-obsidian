# Feed API

Import only from `src/features/feed/public.ts`.

## Store lifecycle

- `createFeedStore(options?)` creates one isolated store. A session tab owns the returned instance.
- `hydrateFeedStore(snapshot)` validates a version-2 snapshot, rebuilds private indexes, and throws `FeedHydrationError` for malformed or dangling data.
- `exportSnapshot()` materializes plain data. Do not call it on streaming/render hot paths.

## Commands

`FeedStore.dispatch(action)` applies one atomic action and returns a `FeedCommit`. Supported families include agent events, extension events/panels, submitted prompts, local feedback, queued messages, loaded history, projected-document synchronization, and view actions.

`feed.document-projection-synchronized` accepts a flat `FeedDocumentProjection`. It is intended for durable external read models such as a selected subagent transcript. The reducer reconciles stable block and tool IDs, removes stale entities, preserves order, and does not replace scroll or expansion state. Summary blocks remain reducer-owned and are intentionally excluded from projections.

Reentrant dispatch is rejected. Commit listeners run after the transaction completes and observe one consistent revision.

## Reads

Use `feedSelectors` with `store.select()` or `store.observe()`. Stable selectors include ordered block IDs, block/tool by ID, summary children, tools for a block, subagents, run timing, scroll state, and source text.

`observe(selector, listener)` notifies only when the selected result changes. Unrelated entity and scroll commits therefore remain quiet for block/document observers.

## Commits

`FeedCommit` contains the originating `action`, global/document/view revisions, and a `FeedChangeSet`. The renderer consumes added, updated, and removed block IDs and updated tool IDs directly. Order reconciliation is required only when `orderChanged` is true.

## IDs and snapshots

Use `blockId`, `toolCallId`, and `assistantCallId` at external boundaries. These branded IDs prevent accidental cross-table access. Snapshot schema version 2 serializes block order, entities, tool membership, summary children, runtime data, and view state; indexes are deliberately omitted and rebuilt.

## Stability

The documented exports in `public.ts` are the supported surface. Reducers, transactions, mutable state, indexes, and migration implementation details are internal. The legacy migration exports are compatibility utilities and must not be used by production presentation.
