# Frontend Modules

This guide maps the connector-owned frontend. It covers dependency direction,
supported feature entry points, screen composition, controller ownership, and
the boundary between runtime projections and Obsidian presentation.

## Dependency direction

```text
generated wire contracts / connector transports
  -> feature public APIs and controllers
  -> screen and component presentation
  -> ChatobbyView composition boundary
```

Feature domain and state modules cannot depend on Obsidian or DOM presentation.
Consumers outside a feature import only its `public.ts`. UI components never
deep-import reducer internals or mutate store tables.

## Top-level map

The plugin-owned [welcome and update highlights](../onboarding-and-updates.md)
are native modals, independent of session feeds and runtime connectivity.

| Area | Responsibility |
|---|---|
| `src/main.ts` | Plugin lifecycle, Obsidian registrations, and composition of connector services. |
| `src/runtime/` | Runtime installation, lifecycle state, managed process, and authenticated frontend sessions. |
| `src/frontend/` | Canonical frontend-protocol client, screen registry, projection updates, and typed intent dispatch. |
| `src/transport/` | Session-scoped streaming transport and normalized session operations. |
| `src/features/` | UI-independent connector feature state and controllers. |
| `src/ui/shell/` | Static Chatobby view shell and primary navigation. |
| `src/features/*/ui/` | Runtime-projected page renderers and page-specific controllers. |
| `src/ui/feed/` | Keyed feed rendering and message/tool presentation. |
| `src/ui/composer/` | Composer input, commands, references, attachments, and submission UI. |
| `src/ui/shared/` | Reusable tokens, page chrome, motion, and cross-feature layout rules. |
| `src/ui/memory/`, `src/ui/permissions/` | Runtime-projected memory and permission screen presentation. |
| `src/ui/modals/`, `src/ui/settings/` | Connector modal and reusable settings presentation. |
| `src/obsidian-bridge/` | Validated bridge from runtime requests to Obsidian/desktop capabilities. |
| `src/vendor/` | Generated runtime contract projections; never hand-edit. |

`ChatobbyView` composes these areas. It does not become the owner of their
domain state: the runtime owns runtime domains, feature controllers own
connector interaction state, and presentation modules own DOM lifecycle.

Within `src/frontend/`, protocol responsibility is cohesive rather than
page-based:

| Module | Protocol-v2 responsibility |
|---|---|
| `frontend-protocol-controller.ts` | connection lifecycle, negotiation, atomic cold/resume subscription, resync, screen request epochs, and intent envelope identity |
| `frontend-store.ts` | exact runtime/view/scope/sequence/revision checks, exhaustive patch reduction, session clearing, feed target legality, and revision-aware screen cache |
| `feed-adapter.ts` | lossless conversion of canonical feed entities into existing renderer entities; no invented protocol meaning |
| `screen-registry.ts` | named detailed-screen controller registration and presentation routing |
| `src/transport/ws-client.ts` | connector wrapper around generated deep parsers, patch buffering, and lifecycle/protocol diagnostics |

The generated `src/vendor/chatobby-client/projection.json` binds the entire
client projection to its canonical source revision and content hash. Normal CI
verifies that receipt locally; it is not conditional on a developer having the
private source checkout beside the connector.

## Feature public entry points

The current feature entry points include:

| Entry point | Supported responsibility |
|---|---|
| `features/channels/public.ts` | Runtime-projected channel directory, history, navigation, and typed channel intents. |
| `features/commands/public.ts` | Slash-command controller and host capability contract. |
| `features/events/public.ts` | Runtime-projected event definitions, occurrence history, and typed event intents. |
| `features/feed/public.ts` | Feed actions, store, commits, selectors, IDs, snapshots, and explicit migration helpers. |
| `features/guide/public.ts` | In-product guide registration and supported guide-page presentation. |
| `features/mcp/public.ts` | MCP/plugin catalogue, connection detail, configuration, and typed intents. |
| `features/operations/public.ts` | Cross-surface operation domains, active-operation read models, and coordinator. |
| `features/projects/public.ts` | Runtime-projected project library, project-scoped chat browsing, and typed intents. |
| `features/runtime-status/public.ts` | Connector runtime-state presentation and explicit install/update/recovery actions. |
| `features/session/public.ts` | Per-tab session contract and constructor. |
| `features/settings/public.ts` | Chatobby-local settings screen services and types. |
| `features/subagents/public.ts` | Agent rail, run inspection, child feed, catalogue, and typed subagent intents. |
| `features/tasks/public.ts` | Runtime-projected task progress mounted in the active session. |

Additional UI features expose a `public.ts` when another feature consumes them.
The public API checker treats that file as the supported boundary; implementation
files remain private. Every export statement requires API documentation,
enforced by `scripts/check-public-api.mjs` using the installed TypeScript
compiler.

## Controller boundaries

- `SessionController` owns tab registration, working-directory scope, initial
  history hydration, metadata refresh, and one preserved feed store per tab.
  First submission waits for the accepted session transition and its
  presentation settlement. A rejected competing operation cannot release that
  wait; a failed destination remains an error rather than falling back to the
  preceding Vault or Project session.
- `SlashCommandController` owns the command catalogue, argument validation,
  surrounding-text policy, and deterministic routing.
- `OperationCoordinator` owns UI-agnostic producer locks shared by runtime,
  session, and domain business controllers.
- `LiveStatsController` owns coalesced stats requests and timer lifecycle.
- `ExtensionUiController` owns extension panels, widgets, actions, and blocking
  interaction cards.
- `FrontendProtocolController` owns the protocol lifecycle
  (`disconnected` through `closed`) and is the only connector boundary allowed
  to negotiate, subscribe/replay, or enrich typed intent identities. Required
  and optional capability lists come from the canonical contract. Optional
  selection is cleared on disconnect, replacement, and resynchronization; a
  late response cannot restore a prior connection's selection. A new connection
  does not wait on a retired synchronization promise, and a late failure cannot
  degrade the replacement connection.
- `FrontendStore` owns authoritative global revision and detailed-screen cache
  cuts. A malformed entity, wrong runtime/view/scope, gap, illegal operation,
  missing feed target, or reversed screen response becomes a typed resync
  error, never a silent no-op.
- `FrontendSnapshotBatcher` advances its rendered snapshot only after the view
  applies it successfully. A rendering failure remains observable, and the next
  snapshot compares against the last successful render so unchanged object
  references cannot skip recovery. The view updates Stop and the feed before
  rendering task progress; no automatic rendering retry loop is added.
- Screen controllers own the lifecycle and intent routing for their named
  runtime projection. They do not mirror the runtime store behind that screen.

Runtime catalogue patches refresh slash commands and open role editors in
place. Skill invocation bodies remain backend context while the feed receives
only structured invocation metadata for compact presentation.

Controllers accept capabilities through constructor options. They should not
query arbitrary DOM, construct raw transports, or reach into another feature's
internal state. Command, slash, and button components are consumers; the
controller that owns a mutation acquires its operation domain and returns a
typed conflict when necessary.

## Screen composition

The shell is mounted once by `src/ui/shell/view-shell.ts`. It provides the
primary view regions and stable navigation targets. Page features render into a
shared page host and use `src/ui/shared/page-shell.css` for full-page hierarchy,
header, rail, content, empty, loading, and error states.

`FeedRenderer` binds to a `FeedStore`, subscribes to commits, and owns keyed DOM
mounts. Block views receive projected entities and `FeedViewActions`. The
composer owns user input state but routes session mutations through the session
and operation controllers.

The preceding-prompt navigator occupies a separate padded row above the feed's
single scroll owner. It appears only once that prompt is fully above the
reading viewport, retains the full text in its accessible label, and stays
hidden in source mode. Resize updates do not move an unpinned reader. Synthetic
DOM/CSS regressions cover these rules; the undeployed follow-up still requires
live width, theme, focus, and bottom-follow acceptance.

`ComposerControls` preserves direct access to every projected access/provider/
model/effort button. A named controls container measures the space remaining
after attachment and send/Stop/context actions; labels and chevrons collapse
before icon wrapping, with current selections retained in accessible names and
tooltips. Unsupported effort is absent only when the runtime omits that control.
The permission picker still presents the runtime's Read-only, Workspace, and
Full choices; layout never changes policy or adds Auto.

The existing `SelectionMenu` mounts in its anchor's document body to escape
split-pane overflow and containment. It shares the semantic theme token mapping,
clamps to that window's visual viewport, and repositions on owned resize/scroll
observations. Escape/selection restore trigger focus; Tab restores the trigger
before native navigation continues; outside pointer dismissal does not steal
focus. Disposal removes the portal, observations, listeners, and pending focus
frame. This uses ordinary DOM APIs, not a new popover/framework requirement.
DOM/geometry and CSS-contract regressions do not replace the pending installed
narrow-pane, zoom, theme, and popout-window visual acceptance.
This presentation-only change introduces no setting, schema, credential, or
runtime projection change. Reverting the composer/token patch restores the
previous presentation without migrating user state; public artifacts change
only through a separately accepted build and release.

Automatic compaction is runtime-owned maintenance. The model's modal selects
queued or background behavior; queued pauses only this session's next inference
until maintenance settles, while the composer remains available for queued
input. The connection editor declares Local/self-hosted or Hosted scheduling;
new connections default local, while legacy Unspecified connections keep
background behavior. Explicit per-model mode overrides win. No endpoint-wide
scheduler or hardware-locality detection is implied. Compact now remains the
existing manual action that stops/settles foreground work before compaction.
The context meter reports only
provider-measured usage; until the provider supplies a measurement, it says so
explicitly and automatic threshold evaluation waits. A compaction activity
ending is not presented as success because the session activity flag does not
carry a success, cancellation, or failure outcome.

Projects, settings, channels, events, MCP, subagents, tasks, memory,
and permissions are runtime-projected screens. Browsing a project never
silently changes the active chat, working directory, memory injection, or
permission context. Secret values remain in credential/runtime services and do
not move into frontend projection state.

The Permissions screen labels access mode and agent network as durable-session
settings, not installation or Project defaults. Distinct chats are independent;
two tabs attached to the same saved chat share its runtime projection, including
on reopen. New independent chats start Workspace/On; migration and persistence
remain runtime-owned. The composer keeps the existing four controls; Network
On/Off remains on Permissions. Full forces On and disables that switch.
Delegated child views compare the policy-owner identity to the actual selected
session and show parent-controlled, disabled controls when they differ.

`composer-access-policy.ts` refreshes the current session policy before dispatch,
checks runtime/view/session identity and `accessPolicySessionId`, and sends the
host-owned session-policy revision. The Permissions renderer carries the same
captured session identity to its controller; stale actions reject and late
outcomes are not shown on a replacement session. Successful saved-policy
warnings are notices, not rejection or readiness. Radio groups are pane-local
DOM identities, never policy owners. Mode/network controls use existing
focus-only keys so draft preservation cannot overwrite new authoritative
checked values; scroll and focus still follow the ordinary page shell.

Roots/memory stay with each chat and app-authority grants stay with the
authenticated Project or Vault. Read-only permits processes only through a
ready backend while keeping selected roots read-only and allowing controlled
private scratch; the renderer never replaces effective-availability evidence.

The Permissions screen presents one separately negotiated Obsidian vault-access
switch, with the runtime's effective/default-or-user state and shared revision.
Unknown/loading/disconnected state is unavailable, never an inferred Vault On
or a claimed persisted Off choice. The warning identifies Obsidian app authority
outside the sandbox, including CLI and vault-level tools in any mode; Project
roots/memory/identity and independent MCP switches stay unchanged. Native
process availability remains the separate runtime-reported status.

`native-setup-view.ts` renders the optional `native-sandbox-setup` projection
inside Permissions. Current selected roots and recorded older grant roots are
separate host-issued displays. Review opens an inline consent group focused on
Cancel; confirmation submits only the opaque target/grant reference and CAS
revisions through the existing screen controller. Refresh, disposal, reconnect,
target change or a newer journal revision invalidates that consent. No local
grant store, path selection, native command or automatic recovery is introduced.
Native maintenance is explicitly busy; configured is never promoted to ready.
Installed verification uses this same negotiated capability and renderer.
Its review/confirmation carries the current session, installation fingerprint,
verification revision and the fixed verify/recover selector, never roots or
commands. It remains available for authenticated recovery when current Project
roots are unresolved or the mode is Full. Busy, reconnect, installation change,
new record revision, detached DOM or changed recovery state invalidates consent.
The runtime's installed proof and session-native status are rendered separately;
neither configured roots nor a resolved request upgrades the other.
Landstrip's `not-required` root-setup state renders without accessing a grant or
offering new root setup. Installed verification and any earlier owned grants
remain distinct; the backend label names Landstrip, not a platform fallback.
Its retained-attempt recovery explains the recorded-complete process cleanup
precondition and promises no permission/profile repair. Missing inspection
renders the runtime's actual reason without manufacturing a setup requirement.
Canonical contract generation and exact-pair metadata remain source-owned.
Focused DOM/controller tests are not installed visual or native acceptance;
all four existing composer controls remain unchanged.

`frontend-bootstrap-request.ts` gathers capability inventory only.
`prompt/authorized-context.ts` brackets passive collection with matching fresh
host stamps; `ChatobbyView` also checks leaf/session/transport continuity at
submission. A revoked or stale stamp drops passive context, not explicit user
attachments or text. This is connector collection/admission coverage, not live
Obsidian acceptance or proof of native isolation.

## Styling boundary

CSS is colocated with the presentation module that owns its selectors.
`src/ui/shared/tokens.css` centralizes Chatobby semantic surfaces, accents, and
status colors; component modules may also consume stable Obsidian typography
and spacing variables. `src/ui/styles.css` defines bundle order and generates
the release-root `styles.css`; the generated file is never hand-edited.

See [Frontend styles](frontend-styles.md) for the module map, cascade rules,
selector conventions, responsive layout, accessibility, and safe edit flow.

## Enforcement

Passive semantic-context events are invalidations, not snapshots. The shared
context service advances revision counters and drops its cached snapshot without
reading note contents. Only an eligible demand captures again; bridge reconnect
does not restore a previous session's collection eligibility. Regression tests
compose the real bridge client and context service with an in-memory transport;
they do not establish installed Obsidian or native containment acceptance.

`npm run check` validates types, public export documentation, deep-import rules,
feed layer independence, removed compatibility imports, semantic CSS tokens,
full-page structure ownership, extracted-module cycles, checked size ceilings,
and local documentation links. Exceptions require a rationale in the
architecture test and cannot grow beyond the recorded ceiling.
