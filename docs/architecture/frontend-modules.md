# Frontend Modules

This guide maps the connector-owned frontend. It covers dependency direction,
supported feature entry points, screen composition, controller ownership, and
the boundary between runtime projections and Obsidian presentation.

[Frontend context](../api/context.md) maps live capture, packet projection,
grant admission, shared context services and their regression tests.

[Composer ownership](../api/composer.md) maps draft/submission and the bound
reference presentation lifecycle, with linked tests and native acceptance limits.

Durable child permission reviews use `features/permissions/application/projected-permission-requests.ts`
to mount the shared request card above parent and selected child composers.
`permission-decision-guard.ts` coalesces feed and composer decisions for the same
runtime, run, node, request, and revision. Native tool execution and the final
compare-and-set decision remain runtime-owned; feed notices remain available.

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
The [settings owner guide](../../src/features/settings/README.md) documents the
two export-only compatibility facades that avoid a UI-bearing barrel.

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
| `src/ui/memory/` | Runtime-projected memory screen presentation. |
| `src/features/permissions/` | [Permission presentation and request coordination](../api/permissions.md), with explicit older-runtime compatibility adapters. |
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

### Projects contract boundary

Canonical Project models, fields, screen validation and intent bodies live in
the runtime's `frontend/contracts/projects/`; shared choices live in
`frontend/contracts/choices.ts`. The generated public
`frontend-contracts.ts` facade remains the connector import boundary. Its
envelopes retain schema 1 and protocol 2; the extraction adds no connector
schema, persistence or migration.

The [Projects owner guide](../../src/features/projects/README.md) routes local
workflow and presentation work. `DirectoryProjectLaunch` handles file-explorer
decisions through plugin-supplied native services. `project-actions.ts` derives
action payloads from `FrontendIntentInput`; only device-local picker values and
the UI's explicit session-workspace requirement differ. The controller registers
absolute paths for the exact operation/intent before sending opaque candidates.
Drafts and marker retries stay controller-owned; durable identity, expiry and
revision checks stay runtime-owned.

[Directory launch tests](../../tests/ui/directory-project-launch.test.ts) cover
probe ordering, cancellation, remembered choices and browsing without rebinding
the running chat. [Action boundary tests](../../tests/ui/project-actions.test.ts)
compose the controller, protocol envelope and public parser, including delayed
batch registration, unavailable/expired selections and preserved drafts on
conflict. [Controller tests](../../tests/ui/projects-screen-controller.test.ts)
retain fresh-intent marker retries and resume-before-message navigation.

The [presentation guide](../../src/features/projects/ui/README.md) routes editor,
detail, library and move-dialog changes. The composed view keeps one operation
lock, error owner, serialized filter queue and pending-move map. Its
[mounted tests](../../tests/ui/projects-view.test.ts) preserve the editor shell
and interaction state across refreshes, retire search timers on destruction,
and verify cancellation, shared busy gating, move conflicts and target confirmation.

[Project screen contract tests](../../tests/frontend/project-screen-contract.test.ts)
serialize screen responses and patches through that public parser before
`FrontendStore` accepts them. They preserve viewed versus running scope,
roots, choices, optional navigator sessions and local drafts, and reject
malformed roots/choices before store mutation. Source tests own intent/default
parity; these connector tests do not establish installed UI behavior.

[Client inventory tests](../../tests/release/client-projection.test.ts) run the
actual verifier against isolated fixtures. Receipt and normalized relative file
paths use the generator's ordinal ordering, independent of locale; duplicates,
reordering, changed bytes and unlisted files remain rejected.

## Feature public entry points

The current feature entry points include:

| Entry point | Supported responsibility |
|---|---|
| `features/channels/public.ts` | Runtime-projected channel directory, history, navigation, and typed channel intents. |
| `features/commands/public.ts` | Slash-command controller and host capability contract. |
| `features/events/public.ts` | Runtime-projected event definitions, occurrence history, and typed event intents. |
| `features/feed/public.ts` | [Local presentation models, actions, store, commits, selectors, IDs and versioned snapshots](../../src/features/feed/README.md). |
| `features/guide/public.ts` | In-product guide registration and supported guide-page presentation. |
| `features/mcp/public.ts` | [MCP/plugin catalogue, connection editor and detail](../api/mcp.md), with runtime-owned configuration and typed intents. |
| `features/memory/public.ts` | [Runtime-projected Memory controller, browsing/detail view and action types](../../src/features/memory/README.md). |
| `features/operations/public.ts` | Cross-surface operation domains, active-operation read models, and coordinator. |
| `features/projects/public.ts` | Runtime-projected Project library, directory launch, native browsing/actions and folder observations. |
| `features/runtime-status/public.ts` | Connector runtime-state presentation and explicit install/update/recovery actions. |
| `features/session/public.ts` | [Preferences, runtime projections, per-tab contract and constructor](../../src/features/session/README.md). |
| `features/settings/public.ts` | [Connector configuration/defaults, persistence and settings screens](../../src/features/settings/README.md). |
| `features/subagents/public.ts` | Agent rail, run inspection, child feed, catalogue, and typed subagent intents. |
| `features/tasks/public.ts` | Runtime-projected task progress mounted in the active session. |

Additional UI features expose a `public.ts` when another feature consumes them.
The public API checker treats that file as the supported boundary; implementation
files remain private. Every export statement requires API documentation,
enforced by `scripts/check-public-api.mjs` using the installed TypeScript
compiler.

The [feed API and test-purpose map](../api/feed.md) describe presentation state,
snapshot hydration and test fixture ownership. Nested feed fixtures live only
under `tests/support/feed/`; they are not runtime migration or public feature APIs.

### Feature verification routes

These tests use controlled projections, transports or host callbacks. They protect
connector interaction; runtime domain suites and installed acceptance remain separate.

| Feature entry | Behavior and existing test route |
|---|---|
| [Channels](../../src/features/channels/public.ts) | [Controller](../../tests/channels/channel-screen-controller.test.ts): reload after reconnect. [View](../../tests/ui/channels-view.test.ts): channel-local drafts survive patches and failed sends; only successful submission clears them. |
| [Commands](../../src/features/commands/public.ts) | [Slash controller](../../tests/commands/slash-command-controller.test.ts): projected catalogue/visibility, local routing, skill metadata, producer conflicts and acceptance before execution. |
| [Events](../../src/features/events/public.ts) | [Controller](../../tests/ui/events-screen-controller.test.ts): restored routes wait for bootstrap. [View](../../tests/ui/events-view.test.ts): explicit background consent and draft retention until authoritative closure. |
| [Guide](../../src/features/guide/public.ts) | [Guide acceptance](../live-update-lifecycle.md#development-guide-feed-acceptance) separates confirmation/write fixtures from signed-channel verification. |
| [Operations](../../src/features/operations/public.ts) | [Coordinator](../../tests/operations/operation-coordinator.test.ts): shared domain exclusion, compatible work, failure release and bounded notifications with controlled promises. |
| [Subagents](../../src/features/subagents/public.ts) | [Rail](../../tests/subagents/session-agent-rail.test.ts): stable tabs, selected-child retention and navigation. [Store](../../tests/subagents/subagent-store.test.ts): runtime screen replacement drives the renderer model; neither executes workers. |
| [Tasks](../../src/features/tasks/public.ts) | [Progress](../../tests/ui/task-progress.test.ts): keyed rows, retained disclosure, read-only controls, empty/completed states and timed completion acknowledgement from synthetic task plans. |
| [Runtime status](../../src/features/runtime-status/public.ts) | [Status verification](managed-runtime-lifecycle.md#status-verification) maps state presentation and recovery-action routing; it does not launch or install a runtime. |

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

Projects, channels, events, MCP, subagents, tasks, memory,
and permissions are runtime-projected screens. Browsing a project never
silently changes the active chat, working directory, memory injection, or
permission context. Secret values remain in credential/runtime services and do
not move into frontend projection state.
Settings combines connector-owned configuration with runtime-provided provider
catalogues; it is not wholly a runtime projection.

The permission screen uses `features/permissions/ui/workspace-permission-settings.ts` for
local workspace selection and `workspace-permission-choices.ts` for mode and
request behavior controls. Backend projections remain the authority. The composer
shows the active workspace's mode; network toggles are retired. The older-runtime
adapters `legacy-policy-sections.ts` and `legacy-access-sections.ts` preserve
compatibility; native setup controls and capability negotiation are retired for every runtime.

`ExtensionUiController` recognizes structured permission request metadata, queues
requests and notifies once. `PermissionRequestCard` mounts in the composer shell's
bounded request host, preserving the user's draft and keeping the request visible
while the feed scrolls. Approval requires deliberate button activation; the existing
cancel shortcut denies. The runtime binds the one-time response to the exact action.
Durable parent and child adapters retain that same review after a failed decision
dispatch. Only a matching pending request may remount; successful decisions remain
coalesced across feed and composer surfaces, and retries do not repeat notifications.
When the runtime invalidates an ephemeral review, its canonical `dismiss` message
closes only the matching UI request ID. Unrelated reviews and the composer draft
remain intact; the connector does not infer cancellation from tool text.

`frontend-bootstrap-request.ts` gathers capability inventory only. Its offered
protocol capabilities use the canonical lists and always exclude the retired
`native-sandbox-setup` capability, including for older product flags.
Development-pair adoption still requires every offered capability and verifies
the exact runtime and bootstrap.
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
