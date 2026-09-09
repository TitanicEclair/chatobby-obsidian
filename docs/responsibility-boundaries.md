# Responsibility Boundaries

The WebSocket and Obsidian bridge are the product boundary. The backend is the agent runtime; the plugin is the native Obsidian client and allowlisted vault executor.

## Backend owns

- Runtime identity, authenticated readiness/control, dynamic endpoint, graceful shutdown, and parent-lifetime handling.
- Agent loop, LLM calls, token streaming, tool orchestration, retries, and compaction.
- Durable session JSONL/history and server-authoritative model/thinking state.
- Path-addressed stored-session rename, fork, clone, export, and deletion.
- Memory records, candidates, activity, policies, jobs, and artifacts.
- Extension loading and server slash-command execution.
- Provider credential reads for model calls.
- Persistent Event definitions, triggers, occurrence history, leases, approvals, budgets, and isolated execution sessions.
- Vault-scoped channel definitions, membership lifecycle, durable message and
  per-recipient delivery records, permission enforcement, and live agent routing.
- Versioned frontend bootstrap, screen, feed, composer, agent-rail, and notice
  projections.
- Atomic, idempotent interpretation of frontend intents and ordered frontend
  patch publication.
- Feed reduction, tool semantic labels, memory and permission policy,
  Event/domain validation, retrieval planning, and product command behavior.
- Provider credential persistence and credential mutation.

## Plugin owns

- Vault-scoped runtime manager, demand registry, managed/external/developer mode selection, and product-facing runtime status.
- Composer, autocomplete, tabs, feed presentation, tool cards, keyboard/focus, scroll, and responsive layout.
- Gathering passive active-note, selection, cursor, and open-note context only
  with fresh runtime eligibility; explicit user text/attachments remain separate.
- A presentation-only frontend document per visible session; runtime feed
  projections remain authoritative.
- One leaf-local working directory, active session recovery path, authenticated
  frontend transport, and extension stream per Chatobby Obsidian tab.
- One plugin-global Obsidian bridge connection coordinated across all live
  Chatobby tabs. The newest valid runtime configuration owns it; owner removal
  promotes a remaining configuration without requesting runtime startup.
- Local UI commands that open screens and dispatch typed runtime intents.
- Inline extension interaction cards and extension UI responses.
- Native memory, permission, event, channel, and subagent screen rendering,
  local drafts, disclosures, focus, selection, and scroll state.
- Allowlisted Obsidian vault operations requested through the bridge.
- Runtime discovery, signature and compatibility verification, launch/attach,
  reconnect, and product-facing runtime status.
- Write-only credential intents over the authenticated local transport; the
  connector stores only configured/not-configured presentation flags.
- Events editor/history rendering, visible-view signal, and explicit
  background-consent action; the backend remains authoritative.
- Agent switcher, channel directory/history UI, message bubbles, and native
  history routes between Main, subagent feeds, and channel messages.

## Data route

```text
user intent + approved vault context
  -> leaf-scoped FrontendIntent
  -> backend session/agent/tools/memory
  -> FrontendBootstrap / FrontendPatch / screen projection
  -> connector presentation store
  -> native Obsidian UI
```

Backend frontend snapshots are authoritative for durable messages, session
metadata, tool meaning, message grouping, and available product actions. The
connector may keep local optimistic input keyed by intent ID until the runtime
projection acknowledges it. Feed folding, expansion, focus, and scroll are
presentation decisions and never rewrite durable backend messages.

Opening another Chatobby leaf reuses the plugin-scoped backend process,
catalogues, supervisor, and indexes, but creates a separate authenticated
transport and backend main-runtime lease. Leaves can prompt and stream
simultaneously. Closing one leaf disposes only its channel; it cannot disconnect
or retarget another leaf.

## Project directory observation route

The connector observes Obsidian folder rename/move events and sends only
normalized vault-relative paths through the browser-safe protocol. Files and
unrelated vault refresh listeners remain unaffected. A bounded FIFO permits one
request in flight; retries keep a stable observation identity while using a new
request identity. Startup, disconnect gaps, queue overflow, and exhausted
observation retries collapse into one typed authoritative-rescan request.

The connector never interprets directory markers, chooses Project identity,
persists Project bindings, or grants permissions. The runtime supplies the
stable vault identity and registered vault root in `bridge_config`, and
`@chatobby/projects` verifies real paths and markers before any durable
mutation. A folder event while the runtime is stopped records no local durable
claim and does not start the runtime.

## Runtime route

`ChatobbyRuntimeManager` resolves or launches the correct vault runtime and
verifies its ready descriptor with the control token. `FrontendSessionRegistry`
uses that dynamic endpoint to maintain one session hello and transport per leaf.
Views request availability but never spawn or kill processes. Managed shutdown
targets only the authenticated instance/exact child; external mode is never
stopped by the plugin.

## Events route

`EventsScreenController` calls typed transport methods and reports whether a
Chatobby view is visibly open. The Events UI is the only surface that grants
view-closed consent. Agent Events tools can inspect, save, pause, trigger, or
explicitly delete definitions, but cannot mint background consent.

## Memory route

`MemoryScreenController` requests the runtime-projected Memory screen and sends
one typed intent per action. `MemoryView` renders that view model and owns only
local disclosure and draft state. When the backend is unavailable, the
controller supplies one inline availability error; it does not reconstruct
memory policy or produce stacked Notices.

Historical memory authority also remains runtime-owned and follows the exact
host-proven Project/Vault ancestry. Moving a chat preserves visible conversation
context but does not grant the new workspace access to prior-workspace memory.
The connector does not relabel legacy history or infer Vault authority from a
missing Project folder.

## Permissions and passive Obsidian context

The runtime owns the three access modes and agent-network policy for each durable
session. Independent chats, including chats in the same Project, keep separate
choices; two tabs attached to the same saved chat render the same authoritative
policy. Reopen restores that policy. New independent chats start Workspace/On;
existing chats without a session record snapshot their previous effective policy
once through the runtime's migration owner. Installation settings do not
live-override sessions, and the connector owns no policy/default store.
Delegated agents use their initiating parent's policy owner, not independent
chat defaults. Their child views display "Controlled by parent session" and
disable mode/network editing; they cannot silently change their parent or siblings.

The Permissions screen carries the runtime's `accessPolicySessionId`. Its mode
and network actions require that exact identity in the existing `mainSessionId`
envelope plus the current session-policy revision. The renderer and controller
reject stale selections; late responses cannot update a replacement session's
UI. A successful save may carry an enforcement warning, which is displayed
without treating persistence as rejected or manufacturing native readiness.
Full remains unsandboxed and necessarily Network On; constrained modes expose
the existing session network switch. Roots, memory scopes, and existing context
are not changed by a policy selection.

The separate Obsidian vault-access choice
is keyed to the authenticated Project or Vault. The connector renders it only after the
optional `obsidian-vault-access` capability is negotiated and a current target
projection is available. Grant updates carry the runtime's grant revision and
expected session/binding revisions; the host derives the target. The available
grant's own `revision`, not the session mode revision, supplies its CAS input. There is no
connector grant store or folder-based default. Project defaults are Off, normal
Vault defaults are On, and conservative migrated defaults may be Off; the
runtime's projected choice, not the connector, is authoritative.

This connector requires the paired runtime upgrade. Earlier runtimes reject
the new capability name; the connector does not guess or retry a weaker
negotiation. The new runtime accepts older eight-capability clients without
exposing this control. Optional selection is not a promise that older runtime
parsers accept newer capability names.

Obsidian vault access includes the existing CLI and vault-level tools:
**Uses Obsidian’s app authority outside the sandbox.** This explicit exception
can read or change the vault in any access mode and can use Obsidian's network
access. It neither rewrites Project roots, identity, or memory scope nor enables
MCP servers/tools. Native process readiness is reported separately and is not
proved by this grant or its UI.

Frontend negotiation reads capabilities only, without collecting passive note
or editor context. Before each normal prompt, `ChatobbyView` checks fresh
authenticated eligibility, gathers passive context, and rechecks the exact
session/vault/binding/policy stamp. Missing, revoked, or stale eligibility omits
the entire passive packet; changed leaf/session/transport stops submission.
Explicit user text and attachments remain intact. The runtime independently
revalidates the stamp before intake; a connector stamp cannot mint authority.

Background semantic-context watchers emit only change categories, sequence,
timestamp, and revision counters. They invalidate the cached snapshot without
capturing editor contents or sending a focus path/summary, including after
revocation and bridge rebind. A later eligible demand captures fresh context.
The paired runtime must also discard legacy event summaries and must not turn
an invalidation or sequence gap into an unauthorised context read.

## Native setup and recovery consent

The optional `native-sandbox-setup` capability gates explicit Permissions
actions. The runtime resolves current authenticated roots and separately reads
recorded older roots from its canonical owned-grant journal. The connector
displays those exact paths only for user review; it does not derive a target,
copy a journal, submit paths/SIDs, or treat configured as verified containment.
Review then confirmation carries only opaque references, the current session
and expected revisions. Stale targets/connections reject without a fallback.

Landstrip applies the current policy to each launch; its canonical
`not-required` root-setup state has no grant to dereference and never means
verified or ready. The connector keeps actual Landstrip availability/reasons
separate from selected mode and shows no per-root setup action. Historical
recorded grants, when projected by their owner, retain explicit recovery.

For backends with explicit Setup grants, configured grants reuse only the exact authenticated Vault/Project root set,
mode and network choice across chats. Each first-time mode/network combination
still requires explicit setup. Recorded recovery is Vault-authenticated user
control, not a model permission or cross-Project execution grant. Permissions
inspection reads journal/protection consistency only; native launch verification
remains a separate runtime boundary and is not a readiness claim.

Setup/recovery temporarily pauses all constrained work on the shared native
backend while owned processes drain and grants are checked. Full access and
ordinary host processes are not stopped. Missing backend composition remains
unavailable. Revoke removes only witnessed owned grants; profile identity is
retained. It does not change the three access modes, network preference,
Obsidian app-authority exception, Project memory, or independent MCP switches.
Reverting this UI hides future actions but does not undo existing native grants;
recovery remains a canonical runtime responsibility.

The active Landstrip runtime admits signed release qualification bound to its
binary, policy, source revision and native development-test receipt. The
connector's generated asset contract recognizes the bounded data file; package
signature and inventory checks authenticate it. It does not run synthetic
capability tests during installation or startup. Normal Permissions has no
verification checklist. Historical Verify contracts and records remain for the
retained alternative backend and recovery tests; the active Landstrip composition
does not consult or rewrite that record. Legacy Windows grant recovery remains
with its original owner. Actual launch errors, identity changes and failed process
cleanup remain runtime errors, not automatic permission changes.

The current alpha claim is workspace accidental-change mitigation, not a boundary
for untrusted code. Network On uses ordinary networking; the vault switch governs
the supplied Obsidian tools/CLI, not all indirect shell access to applications.
These limits do not remove independent MCP controls, Project memory boundaries
or the requirement for actual native development and release tests.

## Channel route

The backend derives each sender identity from its live main, in-process child,
or authenticated worker runtime. Agents connect to authorized vault channels
and use the unified channel tools for all agent-to-agent messages. The runtime
projects the channel directory, participant and recipient labels, bounded
history, unread state, and navigation references. The connector renders those
models and applies ordered screen patches without becoming the message
authority.

## Frontend protocol route

The connector bootstraps one view using the public `FrontendBootstrap`
contract, requests bounded screen projections, subscribes after a known
sequence, and sends idempotent `FrontendIntent` values. The runtime publishes
ordered `FrontendPatch` values with runtime-instance, sequence, base-revision,
and revision identity. A gap, incompatible version, or runtime-instance change
causes bounded resynchronization instead of connector-side reconstruction.

The public client contains only frontend contracts, connector transport types,
wire message data, and runtime-control compatibility data. Raw channel,
permission, subagent, event, memory, or agent-event contracts are not vendored
into the connector.

## Extension UI route

`ExtensionUiController` handles `select`, `confirm`, `input`, and `editor` as blocking inline cards. `notify`, `setWidget`, and `setTitle` are non-blocking. Pending responses are resolved with `undefined` during disposal so backend requests do not hang.

## Internal dependency boundary

Feature consumers import only `features/<name>/public.ts`. Feed domain/state code cannot import Obsidian or presentation. Controllers coordinate feature APIs; presentation receives selectors and narrow actions. Raw maps, sets, transactions, and reducer internals remain private.

Architecture enforcement lives in `tests/architecture/feature-boundaries.test.ts` and `scripts/check-public-api.mjs`.
