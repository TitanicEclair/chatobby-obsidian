# Memory screen ownership

[public.ts](public.ts) exposes the existing native controller and view API.
[application/memory-screen-controller.ts](application/memory-screen-controller.ts)
reads the current frontend store/protocol, loads the runtime screen and stamps
policy intents with the current projected revision. Runtime contracts, record
revisions and enabled targets remain authoritative; this feature owns no durable
Memory store, ranking, policy evaluation or learning service.

[ui/memory-view.ts](ui/memory-view.ts) owns browsing/detail/editor state, one
subscription, busy/error state and PageShell presentation. Creation rechecks the
latest enabled target. [ui/memory-filters.ts](ui/memory-filters.ts) renders filters
and constructs the existing view payload; [its CSS](ui/memory-view.css) stays at
the same position in [the style barrel](../../ui/styles.css).

[Workspace pages](../../ui/workspace/workspace-pages.ts) own an independent
connection and Memory controller. The [legacy overlay coordinator](../../ui/screens/chat-view-overlay-screens.ts)
instead closes sibling overlays. Close destroys the view subscription. Existing
old refresh/frame callbacks can still affect a replacement view, and native
WorkspacePage keyboard forwarding is absent; these remain tracked in
[issue 133](https://github.com/TitanicEclair/chatobby/issues/133).

| Test | Purpose |
|---|---|
| [View](../../../tests/ui/memory-view.test.ts) | Synthetic projected records, browse/detail controls, current target recheck, actions and retained scroll. |
| [Controller/page](../../../tests/ui/memory-screen-controller.test.ts) | Actual public parser, store, protocol, controller/view and WorkspacePage with controlled transport/connection: load identity, applied/rejected/conflict policy outcomes, exact subscription disposal and existing late callbacks. |
| [Architecture](../../../tests/architecture/feature-boundaries.test.ts) | Public feature entry, single scroll owner, shared PageShell and unchanged CSS import order. |

Run the named files with `npm test -- <test paths>` and the full checkpoint
gates. Native browse/detail/back/close and installed identity are separate checks.
