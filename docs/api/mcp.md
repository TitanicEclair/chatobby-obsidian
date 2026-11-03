# MCP frontend

The connector renders runtime-owned connection and catalogue projections. It owns
form drafts, navigation and presentation; it cannot register, enable, authenticate
or expose a tool without an explicit runtime intent. Consumers use
[public.ts](../../src/features/mcp/public.ts). See the
[connection guide](../mcp-connections.md) for user actions.

## Ownership and lifetime

| Owner within `features/mcp/` | Responsibility |
|---|---|
| `application/mcp-screen-controller.ts` | Screen loading, current refresh/error presentation and initial focus frame; constructs intent envelopes and synchronizes a selected Obsidian secret before a reference-only save/link intent. |
| `ui/mcp-view.ts` | PageShell, catalogue/detail routing, filters, search timer, current editor identity, busy/errors and runtime intent completion. Its local intent type derives from the canonical discriminated union. |
| `ui/catalogue/plugin-list.ts` | Installed/verified list rendering, grouping, filtering and sorting; receives view-owned values and narrow navigation/search callbacks. |
| `ui/detail/plugin-detail.ts` | Manifest overview, capabilities, setup, access notes, activity and cautions. |
| `ui/detail/server-controls.ts` | Connection, removal confirmation, tool access, credential-reference and pending sign-in controls; reports user actions to the view. |
| `ui/plugin-summary.ts` | Shared plugin identity/metadata, list rows, brand marks and capability counts. |
| `ui/editor/connection-editor.ts` | Form DOM, validation presentation, transport/authentication visibility and narrow user-action callbacks. |
| `ui/editor/connection-draft.ts` | Transient string fields, field-keyed validation and canonical draft projection; no storage or execution. |
| `ui/controls/` | MCP-specific fields and secret-name selection, shared by editor and authentication detail. |
| `ui/links.ts` | The single HTTP(S) normalizer for form addresses and external-link rendering. |

The runtime owns configuration, inventory, authentication and tool-selection
revisions. Save actions use the currently displayed config revision. A conflict
keeps the editor open; the UI does not merge configurations or retry mutations.

Each screen refresh captures its view and request identity. An older completion
cannot clear or replace the current refresh error after another request, route or
page lifetime. The protocol/store still enforces response epochs and revisions;
the controller does not reinterpret a rejected stale response as an error on the
newer route. The initial focus frame belongs to the rendered view's document and
is retired on navigation or close. It focuses only if focus has not moved to
another control or overlay. Intent completion remains with the initiating view;
closing a page does not cancel or retry a committed runtime mutation.
This guard concerns controller refresh/focus effects. Non-editor actions still
use the existing mounted-view outcome guard; same-view route changes during those
actions are not given a new cancellation or outcome policy by this slice.

DOM controls contain unsaved values. PageShell preserves keyed values, selection,
focus, disclosure and scroll when the same page scope rerenders. After restoration,
the current form recomputes only derived visibility, pressed choices and token-link
availability. This does not emit input/change events or dispatch intents. There is
no second draft store. A same-editor field key bridges native focus refusal while
its restored local/token field is temporarily hidden. After showing it, the form
retries focus with no scroll, retaining PageShell's caret selection and respecting
an intervening overlay or other focused control. The handoff uses the field's own
document; broader PageShell caret/selection behavior in a popout still requires
native acceptance and is not established by the same-window DOM fixtures.

Cancel, the existing Escape handler or another plugin route ends the editor;
completion or rejection from its old request cannot close or report an error on a
new editor. Closing the page drops subscriptions, the search timer and presentation
references; committed runtime work is not cancelled implicitly.

Catalogue and detail renderers own only their current DOM and callbacks. They do
not subscribe, schedule work, import the view or dispatch wire intents. The view
retains installed filters, verified search debounce and list scroll across detail
routes; changing a route clears its editor and removal confirmation. Detail actions
capture the displayed configuration revision. Pending sign-in inputs and credential
selections remain keyed PageShell values; after restoration the detail renderer
refreshes token-link availability without reading a secret value.

A Project suggestion seeds visible address/command fields in a separate disabled
user draft. It copies no credential or environment/header value. New saves remain
disabled; preview validates only, and discovery and explicit tool selection are
separate operations. The form preserves transport-specific mapping behavior and
the canonical wire shape; runtime validation remains authoritative.

Secret selection holds a reference name only. Refreshing names preserves a still
available selection and clears a removed one without linking it. Values pass only
through the controller's existing authenticated credential synchronization; they
do not enter draft intents, frontend state, diagnostics or test fixtures with real
credentials. Local execution availability comes from the runtime. The connector
does not reinstate OS sandbox setup or infer permission from MCP exposure.

## Test-purpose map

| Invariant | Tests |
|---|---|
| Draft/derived presentation, focus/selection, disclosure/scroll, revision conflict, stale completion, distinct suggestion routes and disposal | [editor lifecycle](../../tests/ui/mcp-editor-lifecycle.test.ts) |
| Missing fields, URL and mapping errors, validation focus and corrected disabled preview | [editor validation](../../tests/ui/mcp-editor-validation.test.ts) |
| Real protocol/store stale-response rejection, refresh/close/reopen ordering, current failure/retry, initial focus retirement, old mutation completion, reference-only intents and deferred/failed credential synchronization | [screen controller](../../tests/ui/mcp-screen-controller.test.ts) |
| Catalogue/detail routes, disabled discovery, untrusted suggestions, per-tool exposure, execution admission and cancellation | [MCP view](../../tests/ui/mcp-view.test.ts) |
| List filtering/focus, detail/Back scroll, search debounce/Enter/disposal, current detail targeting, removal confirmation, OAuth draft and external-link policy | [navigation lifecycle](../../tests/ui/mcp-navigation-lifecycle.test.ts) |
| Shared synthetic projected server/plugin shapes | [screen fixtures](../../tests/support/mcp/screen.ts) |
| Public imports, cycles, owner size bounds and documentation links | [feature boundaries](../../tests/architecture/feature-boundaries.test.ts), [documentation links](../../tests/architecture/documentation-links.test.ts) |

Run the five named MCP UI files with `npx vitest run` for focused feedback.
Connector gates are `npm run check`, `npm test`, and
`npm run check:community-review`. DOM fixtures prove interaction contracts, not
native Obsidian layout or secret-storage integration. Disposable-vault acceptance
also checks narrow/wide and light/dark forms, refresh with an unsaved local/bearer
draft, validation focus, explicit secret-name refresh/link, rejected-save retention,
separate synthetic suggestions, Cancel/Back and list scroll restoration. The
controller lifetime change also requires native route/Refresh/close/reopen checks
with focus moved to another control. Deferred transport fixtures establish response
ordering, not native window focus or popout behavior. The
Escape composition test calls the existing controller handler: native workspace
pages do not yet forward keyboard events to that handler. This routing gap remains
separate follow-up work; unit coverage does not establish native Escape behavior.
