# Feed test support

`legacy-feed-fixture.ts` builds current normalized snapshots from nested feed
fixtures used by presentation tests. It owns no runtime state and performs no
persisted-data migration. Production imports only the supported
[feed API](../../../src/features/feed/public.ts).

Use current store actions or `createEmptyFeedSnapshot()` for new store/reducer
tests. Use the nested fixture only when assembling a renderer scenario is
clearer that way; the fixture still passes through normal snapshot hydration.

| Consumer | Purpose |
|---|---|
| [mock-host.ts](../../ui/helpers/mock-host.ts) | Hydrates fixtures into the real store and supplies narrow rendering actions. |
| [feed-renderer.test.ts](../../ui/feed/feed-renderer.test.ts) | Builds nested block scenarios for DOM identity, scroll and incremental update regressions. |
| [sticky-prompt.test.ts](../../ui/feed/sticky-prompt.test.ts) | Sets the starting scroll state for preceding-prompt navigation scenarios. |

The [feed test-purpose map](../../../docs/api/feed.md#test-purpose-map) links
behavior, local commands and fixture limitations. Mock DOM tests do not establish
installed Obsidian behavior or runtime protocol compatibility. Production
imports of test support are prohibited by the architecture suite.
