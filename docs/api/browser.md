# Browser bridge

The connector executes validated Web Viewer operations. The runtime owns tool
authorization; the canonical Obsidian protocol owns operation and result schemas.
[operation-registry.ts](../../src/obsidian-bridge/operation-registry.ts) is the
dispatch boundary. Plugin composition uses the bridge's
[index.ts](../../src/obsidian-bridge/index.ts) to dispose browser observation.

## Module boundaries

| Owner | Responsibility |
|---|---|
| `operations/browser-operations.ts` | Validated navigation, interaction, inspection and diagnostic adapters. |
| `operations/browser-read.ts` | Live document capture and retained read continuations. |
| `browser/webview.ts` | Electron webview access, readiness, targeting and injected page invocation. |
| `browser/tab-state.ts` | Observed tab state, semantic action deltas and dispatch receipts. |
| `browser/screenshot.ts` | Rendered-surface pixel capture, exact target checks and request-scoped waits. |
| `browser/console-capture.ts` | App-scoped event subscription and per-leaf bounded console buffers. |
| `browser/read-pagination.ts` | Cursor encoding, document projection and text/block budgets. |
| `browser/artifact-store.ts` | Bounded semantic documents with expiry and access-order eviction. |
| `browser/page-runtime.ts` | Guest-page observation and validated page effects. |

## Lifetime and data

Console observation starts when an operation inspects a Web Viewer. One service
per App owns a workspace `layout-change` subscription and one `console-message`
listener per observed leaf. Repeated inspection reuses the listener. Layout
changes remove captures for closed leaves, changed view types or replaced
webviews; they do not start new observation. Replacement is also checked at the
next inspection. Bridge close removes its listener immediately.
An operation returning after its leaf closes or changes cannot reattach the old
webview's listener or detach a replacement's current observation.

Plugin unload disposes every listener and the workspace subscription synchronously,
before asynchronous runtime teardown. Late in-flight operations cannot restart
observation. A plugin reload gets a fresh module lifetime. Buffers are in memory
only, retain the newest 200 messages and preserve sequence/dropped counts. Message
and source text use the existing credential-pattern redaction and 2,000-character
limit; diagnostics cannot recover messages emitted before observation started.

Read artifacts remain separate from console observation. The module-owned store
retains semantic documents for up to 15 minutes since access within a 64 MiB
budget. Bridge close deletes that leaf's artifacts. External leaf closure does
not invalidate a retained read: its cursor serves the original document without
executing the guest again. Page refs remain identity/revision-bound. This change
does not alter those retention rules, cursor formats or legacy `startIndex` reads.

## Screenshot surface and cancellation

Screenshots observe pixels without selecting tabs or changing focus. The exact
guest must be attached, laid out with nonzero bounds, and visible in its owning
document. A visible but unfocused split remains supported. A hidden tab or host
returns `UNSUPPORTED_OPERATION` immediately, with instructions to show the same
tab before retrying; read, snapshot and DOM inspection remain alternatives.
This does not prove that the operating system's compositor can supply an image.

The connector checks the same leaf, view, webview and available native guest ID
before and after asynchronous work. Bounds lookup, native capture and metadata
waits settle on the existing request signal; there is no extra timeout or retry.
Electron capture cannot be cancelled by this signal. Late native completion or
rejection is consumed without publishing image bytes or starting later metadata
work. Empty images are errors. A same-guest navigation can still change the page;
target identity is not an atomic document snapshot guarantee.
Already-started guest scripting can also finish internally after abort; settling
the caller's wait does not cancel Electron scripting or its runtime-install fallback.

The API behavior is documented by Electron's
[webview capture API](https://github.com/electron/electron/blob/v43.7.7/docs/api/webview-tag.md#webviewcapturepagerect)
and [surface-copy implementation](https://github.com/electron/electron/blob/v43.7.7/shell/browser/api/electron_api_web_contents.cc#L3794-L3835).
Runtime MCP projection and model image support remain source-owned: a text-only
model receives the canonical omission notice instead of image bytes in history.

## Test-purpose map

| Contract | Tests |
|---|---|
| Demand-only listeners; external close/replacement; App isolation; unload; redaction and bounds | [console lifecycle](../../tests/obsidian-bridge/browser-console-capture.test.ts) |
| Navigation/readiness abort, interaction, screenshots, retained reads and stale page refs | [operations](../../tests/obsidian-bridge/browser-operations.test.ts) |
| Hidden/zero-area rejection; visible unfocused capture; crop bytes; deferred abort, replacement and empty-image failures | [screenshot lifetime](../../tests/obsidian-bridge/browser-screenshot.test.ts) |
| Artifact expiry, byte bounds and eviction | [artifact store](../../tests/obsidian-bridge/browser-artifact-store.test.ts) |
| Registered capabilities and request routing | [coverage](../../tests/obsidian-bridge/capability-coverage.test.ts), [integration](../../tests/obsidian-bridge/bridge-integration.test.ts) |

The shared [fixture](../../tests/obsidian-bridge/helpers/browser-fixture.ts) supplies
a synthetic App, workspace events and a webview adapter running the real guest
page function. It disposes observations after each test. It does not prove
Electron event timing or an installed plugin's unload path.

Run `npx vitest run tests/obsidian-bridge` for focused feedback, then connector
checks, full tests and Community review checks. Paired disposable-vault acceptance
opens/inspects a Web Viewer, closes it through Obsidian, replaces a tab, and reloads
Chatobby; navigation, diagnostics and screenshots must still work afterward.
