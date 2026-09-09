# Connector Wire Boundaries

Chatobby uses several deliberately separate wire boundaries. This document is a
map for connector developers; canonical domain schemas are generated from the
private runtime repository and must not be restated manually here.

## Source of truth

Generated declarations under `src/vendor/chatobby-client/` define the frontend
protocol version, message envelopes, screen projections, intents, patches, and
extension UI contracts consumed by the connector. They are generated
projections. Update the owning runtime contracts, regenerate through the
documented private release workflow, and review the projection diff; never edit
the vendor files by hand.

The full API authority is the private source guide
[`packages/chatobby/docs/frontend-protocol.md`](https://github.com/TitanicEclair/pi-mono/blob/dev/packages/chatobby/docs/frontend-protocol.md).
This connector document explains application responsibilities only and does not
redeclare that schema.

Connector-owned types live beside the adapter that uses them:

- `src/runtime/contracts.ts` describes connector runtime modes and lifecycle
  state;
- `src/transport/` adapts authenticated session streaming;
- `src/obsidian-bridge/` validates and routes runtime requests into Obsidian;
- `src/frontend/` applies canonical frontend state and sends typed intents.

See [Responsibility boundaries](responsibility-boundaries.md) for the complete
repository ownership split.

## Boundary map

```text
Obsidian view
  -> connector frontend client
      -> authenticated frontend protocol: negotiate, atomic subscribe/bootstrap/replay,
         screens, intents, patches and typed resync
      -> session transport: chat streaming and session-scoped operations
  <- runtime

runtime
  -> authenticated Obsidian bridge request
  -> connector validates capability and arguments
  -> Obsidian or local desktop operation
  <- structured result or structured error
```

The frontend protocol is the default boundary for runtime-owned product state.
The connector renders projections and dispatches intents; it does not mirror
the runtime's projects, settings, permissions, memory, MCP, channel, event,
task, or subagent stores.

## Frontend connection lifecycle

`FrontendSessionRegistry` creates one authenticated frontend session per open
Chatobby view. `FrontendProtocolController` owns the explicit lifecycle:
`disconnected`, `connecting`, `negotiating`, `bootstrapping`, `replaying`,
`live`, `resynchronizing`, `degraded`, and `closed`. The client:

1. establishes the transport using the connector-provided endpoint and session
   credentials;
2. negotiates protocol v2 and the complete required capability set;
3. makes one atomic subscription call that returns either a cold bootstrap, a
   contiguous bounded replay, or an explicit full-resync requirement;
4. applies that exact sequence/revision cut, then releases patches buffered by
   the generated client during cutover;
5. requests revisioned detailed screens with runtime/view/request identity,
   request epoch, and base sequence;
6. dispatches typed, idempotent intents and handles discriminated outcomes;
7. applies ordered patches or transitions to controlled resynchronization on a
   malformed entity, wrong identity/scope, sequence/revision gap, missing feed
   target, or stale screen response;
8. closes the session when the view is disposed.

Message parsing and version rejection happen at the generated client boundary;
the connector store independently enforces reducer invariants and exhaustive
operations. The generated client never silently discards an invalid
`frontend_patch`: it emits a safe typed diagnostic and requests resync. UI
modules consume typed projections, not raw JSON. Authentication material is
held by runtime/session infrastructure and must not enter feed entities, DOM
attributes, persisted plugin data, or logs.

## Screens, intents, and patches

A runtime-owned page follows a one-way flow:

```text
screen snapshot or patch -> feature controller -> view model -> DOM
user action -> typed intent -> runtime -> resulting projection or error
```

Screens are named protocol projections. A detailed response is applied only if
its request epoch, runtime/view identity, response sequence cut, and screen
revision cannot overwrite a newer request or patch. Intents describe user
actions without embedding connector callbacks. Patches update a known global
and domain revision and are applied by `FrontendStore`; unknown/illegal
operations are resync errors, not ignored records.

Feed adapters render canonical blocks. They must preserve actual message,
actor, recipient, run, node, turn, correlation, delivery, acknowledgement and
timestamp meaning and must not fabricate placeholder entities.

Extension panels, widgets, actions, and blocking interaction cards use the same
generated frontend contracts. The connector may provide Obsidian presentation
capabilities, but it must not reinterpret a runtime extension payload into a
different domain contract.

## Session transport

Chat streaming and explicitly session-scoped operations use the connector's
transport adapter. The adapter owns connection mechanics and normalization into
the public session contract. Feed and composer code call feature/controller
APIs rather than constructing WebSocket, HTTP, or authentication messages.

Transport reconnects preserve view identity and resume only from the last
applied sequence/revision against the same runtime instance. Too-old/future
cursors, a replaced runtime, or a gap trigger a cold bootstrap. A lost
connection does not authorize a new session, a silent working-directory change,
or a synthetic success response.

## Obsidian bridge

The bridge is a connector-owned capability boundary for operations that require
Obsidian, vault, filesystem, process, or permitted network access. The runtime
sends a request envelope; `src/obsidian-bridge/bridge-router.ts` validates the
request, routes it through the operation registry, and returns either a typed
result or a structured bridge error.

Bridge rules:

- reject unknown operations and invalid arguments at the boundary;
- check advertised capabilities before execution;
- keep request IDs stable through success, timeout, and error responses;
- convert exceptions to the public error taxonomy without leaking secrets or
  absolute private data unnecessarily;
- keep result text and structured content derived from one typed result;
- never grant permission based only on frontend presentation state.

Operation implementations and paging helpers live under
`src/obsidian-bridge/`. Consumers outside that feature use its supported public
entry point instead of deep-importing registry internals.

## Compatibility

Compatibility is explicit. Unknown optional fields may be ignored. New union,
operation, or entity variants require a negotiated capability. Required,
renamed, removed, or narrowed fields require a protocol version change. Unknown
variants are rejected/resynchronized, never guessed. Generated protocol
versions must match the runtime artifact selected by the connector release. An
incompatible runtime is reported as an installation or connection problem; the
connector does not guess missing fields or retain undocumented legacy forms.

Protocol v2 is a paired cutover: release rollback restores the old runtime and
connector pair together. Development-pair receipts bind the runtime protocol,
frontend protocol, exact generated projection hash, and both repository content
fingerprints before adoption.

When changing a wire boundary:

1. change the canonical owner;
2. regenerate projections rather than hand-editing them;
3. add schema/adapter regression tests for success, rejection, and cleanup;
4. update the affected architecture and user documentation;
5. verify an unpublished connector/runtime candidate together in the disposable
   test vault when the change crosses the live boundary.

## Related documentation

- [Frontend modules](architecture/frontend-modules.md)
- [Frontend styles](architecture/frontend-styles.md)
- [Managed runtime lifecycle](architecture/managed-runtime-lifecycle.md)
- [Release boundary](release-boundary.md)
- [Installation](installation.md)
- [Troubleshooting](troubleshooting.md)
