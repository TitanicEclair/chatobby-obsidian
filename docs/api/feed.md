# Feed API

Import only from `src/features/feed/public.ts`.

## Ownership and module map

The connector feed feature owns a normalized presentation store for one session
tab. The runtime remains authoritative for durable messages and tool meaning;
DOM components own rendering. Feed domain/state modules cannot import Obsidian,
presentation modules or test support.

| Module | Responsibility |
|---|---|
| [public.ts](../../src/features/feed/public.ts) | Supported store, action, selector, ID and snapshot contracts. |
| [domain/](../../src/features/feed/domain) | Typed entities, IDs and the versioned snapshot shape. |
| [state/](../../src/features/feed/state) | Atomic reduction, private indexes, selectors and snapshot validation. |
| [feed renderer](../../src/ui/feed/index.ts) | Commit-driven DOM updates and reader scroll intent. |
| [test support](../../tests/support/feed/README.md) | Nested presentation fixtures, excluded from the production API. |

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

The [snapshot contract](../../src/features/feed/domain/snapshots.ts) is the
canonical shape. A session tab owns its store's lifetime; exporting a snapshot
does not create a second durable history authority. Hydration rejects unknown
or malformed shapes and dangling references before rebuilding indexes. Nested
test fixture conversion is not an older persisted-schema migration.

## Stability

The documented exports in `public.ts` are the supported surface. Reducers,
transactions, mutable state and indexes are internal. Test fixtures are imported
from `tests/support/feed/` only by tests and are not production compatibility APIs.

## Test-purpose map

| Behavior | Test | Fixture and limit |
|---|---|---|
| Snapshot round trip, malformed/dangling rejection and bounded updates | [normalized-feed-store.test.ts](../../tests/ui/feed/normalized-feed-store.test.ts) | Current schema-2 snapshots; no installed runtime or disk recovery proof. |
| Agent events, echo reconciliation, history and projection reduction | [normalized-feed-reducers.test.ts](../../tests/ui/feed/normalized-feed-reducers.test.ts) | Real store actions; synthetic agent/projection input. |
| Keyed DOM identity, scroll intent and incremental block rendering | [feed-renderer.test.ts](../../tests/ui/feed/feed-renderer.test.ts) | Real store with nested test fixtures and mocked DOM. |
| Preceding-prompt positioning and focus | [sticky-prompt.test.ts](../../tests/ui/feed/sticky-prompt.test.ts), [feed-focus.test.ts](../../tests/ui/feed/feed-focus.test.ts) | Mock layout/focus; live Obsidian layout still needs inspection after UI changes. |
| Coalesced Markdown work and tool presentation | [streaming-markdown.test.ts](../../tests/ui/feed/streaming-markdown.test.ts), [tool-item.test.ts](../../tests/ui/feed/tools/tool-item.test.ts) | Synthetic streams/tool data; no provider execution. |
| Feature import boundaries and documentation links | [architecture tests](../../tests/architecture) | Source/document inspection; no behavioral UI claim. |

## Paired runtime projection regression

[feed-projection-pair.test.ts](../../tests/frontend/feed-projection-pair.test.ts)
joins the actual source coordinator's canonical bootstrap/stream/replay capture
to `FrontendStore` → `synchronizeFrontendFeed` → the feed adapter → the public
normalized feed store. It compares live, replayed and fresh restored blocks,
checks contiguous revisions and duplicate delivery, and preserves unchanged
historical object references through incremental updates.

The fixture belongs to the private source at
`packages/chatobby/test/fixtures/frontend/capture-history.mjs`; its purpose map
is in that package's `docs/frontend-protocol.md#history-projection-and-test-map`.
It uses synthetic messages and a fixed clock with the actual built coordinator.
It records source/compiled hashes and rejects stale source maps or missing
builds. The connector never copies the source projector or substitutes the
historical test adapter as an oracle.

`npm run check:backend-contract` requires `CHATOBBY_BACKEND_ROOT`, verifies the
exact generated projection and runs this paired suite. Missing capture/build
or backend configuration fails that gate. Ordinary `npm test` needs no private
checkout and skips the paired suite when the variable is absent. This checks
projection composition, not provider execution or installed DOM timing.

The test-only [capture helper](../../tests/frontend/helpers/runtime-capture.ts)
retains a 15-second child deadline. Setup and the repeat-capture case each have
an explicit 20-second enclosing budget, leaving five seconds for harness work.
Completed JSON does not count as success until the child exits successfully.
Failures report exit/error/signal, elapsed time, stdout byte count and a bounded
stderr tail. Source-fixture stage marks stay on stderr; elapsed process time
includes startup and does not isolate import time or explain historical delays.
[Subprocess regressions](../../tests/frontend/runtime-capture.test.ts) exercise
timeout, delayed successful/failed exit after output, and actual Vitest hook/test
budgets with awaited delays. These local children use no backend or provider.

Run the feed behavior suites with `npx vitest run tests/ui/feed` and boundaries
with `npx vitest run tests/architecture`. Run `npm run check`, `npm test` and
`npm run check:community-review` before a connector review checkpoint.
