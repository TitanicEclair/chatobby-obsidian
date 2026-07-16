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
  workflow/event validation, retrieval planning, and product command behavior.
- Provider credential persistence and credential mutation.

## Plugin owns

- Vault-scoped runtime manager, demand registry, managed/external/developer mode selection, and product-facing runtime status.
- Composer, autocomplete, tabs, feed presentation, tool cards, keyboard/focus, scroll, and responsive layout.
- Gathering active-note, selection, cursor, open-note, and attachment context.
- A presentation-only frontend document per visible session; runtime feed
  projections remain authoritative.
- One leaf-local working directory, active session recovery path, authenticated
  transport, extension stream, and bridge client per Chatobby Obsidian tab.
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
