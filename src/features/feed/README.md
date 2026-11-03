# Feed ownership

[public.ts](public.ts) exposes the connector's presentation models, normalized
store, selectors and versioned snapshots. [domain/presentation.ts](domain/presentation.ts)
owns local blocks and display state; generated runtime feed projections remain
the source of durable meaning. [frontend/feed-adapter.ts](../../frontend/feed-adapter.ts)
converts those projections and preserves unchanged block identity through its
existing WeakMap. Domain/state modules do not import Obsidian or DOM owners.

The [feed API](../../../docs/api/feed.md) maps transactions, hydration and fixtures.
[Adapter tests](../../../tests/frontend/feed-adapter.test.ts) protect projected
blocks; [store tests](../../../tests/ui/feed/normalized-feed-store.test.ts) protect
reduction and selection. [Architecture checks](../../../tests/architecture/feature-boundaries.test.ts)
protect pure model dependencies and the exact legacy `types.ts` re-exports.
These controlled projections do not prove installed streaming or runtime history.

Run the named files with `npm test -- <test paths>`; use the repository check,
full test and build gates for a completed change.
