# Managed Runtime Lifecycle

This document describes the connector-owned lifecycle for the Chatobby runtime.
It is an architecture guide, not an installation runbook or a release ledger.
For user-facing installation steps, see [Installation](../installation.md). For
repository ownership, see [Responsibility boundaries](../responsibility-boundaries.md).

## Ownership boundary

The connector owns the desktop integration around the runtime:

- locating and validating an installed runtime;
- installing or updating signed runtime artifacts through the public explicit
  action or the approval-gated automatic provisioning coordinator;
- launching, attaching, detaching, and explicitly stopping connector-owned
  managed and developer runtime processes;
- connecting to an external runtime without taking ownership of its process;
- creating authenticated transports for each Chatobby view;
- presenting installation, connection, update, and recovery state in Obsidian.

The runtime owns model execution, sessions, projects, memory, permissions, MCP,
subagents, and the canonical frontend protocol. The connector must not recreate
those domain stores or infer their state from process output.

## Components

| Component | Responsibility |
|---|---|
| `src/runtime/application/runtime-manager.ts` | Resolves runtime mode and coordinates launch, connection, detach, explicit stop, and recovery. |
| `src/runtime/application/frontend-session-registry.ts` | Owns authenticated frontend sessions and transport cleanup for open views. |
| `src/runtime/application/view-runtime-controller.ts` | Adapts application runtime state to one Chatobby view. |
| `src/runtime/infrastructure/runtime-installation.ts` | Detects, verifies, installs, and activates runtime artifacts. |
| `src/runtime/application/runtime-update-manager.ts` | Coordinates exact-pair checks, provisioning, explicit repair, and rollback-aware updates. |
| `src/runtime/application/runtime-bootstrap-coordinator.ts` | Joins concurrent bootstrap calls, reattaches an installed runtime first, and retries deferred provisioning. |
| `src/runtime/application/development-pair-coordinator.ts` | Validates and adopts a source/connector development pair through maintenance admission, exact runtime reconnect, frontend bootstrap proof, and rollback. |
| `src/runtime/application/development-pair-bootstrap.ts` | Negotiates protocol v2 and requires a fresh subscribed bootstrap for the exact runtime instance and development pair before promotion. |
| `src/runtime/infrastructure/runtime-update-client.ts` | Fetches immutable exact-version runtime packages and the separately signed compatible Guide channel. |
| `src/runtime/infrastructure/managed-process.ts` | Starts connector-owned managed/developer processes, observes readiness, and owns termination fallback. |
| `src/runtime/public.ts` | Supported runtime API used outside the runtime feature. |
| `src/frontend/` | Applies canonical screen snapshots and patches, then dispatches typed intents. |
| `src/features/runtime-status/ui/` | Renders runtime state and explicit recovery/update controls. |

Consumers outside `src/runtime/` import from `src/runtime/public.ts`. Generated
protocol declarations under `src/vendor/` are projections from the private
runtime repository and are never edited by hand.

## Lifecycle state flow

```text
plugin load
  -> resolve configured runtime mode
  -> inspect installation and update state
  -> launch managed/developer runtime or connect to external runtime
  -> wait for authenticated readiness
  -> open one frontend session per Chatobby view
  -> close view sessions independently

plugin unload
  -> detach the connector runtime attachment
     -> session-lifetime managed or developer: request reattach grace
     -> background managed: leave the runtime running
     -> external: disconnect only
  -> dispose connector session transports

explicit Stop or Restart
  -> managed or developer: request shutdown, then terminate if necessary
  -> external: disconnect only
```

Runtime status is a connector-owned projection. Views subscribe to that state;
they do not poll process files or construct their own backend clients.

## Runtime modes

The runtime configuration selects one of the modes exposed by the connector's
runtime contracts:

- **Managed:** the connector launches the verified connector-installed
  distribution. Session lifetime participates in reattach grace during plugin
  reload; background lifetime remains running when the plugin detaches.
- **Developer:** the connector launches the configured `developerCommand` and
  arguments. It owns that process and treats plugin unload as a reattachable
  detach, while an explicit Stop or Restart shuts it down.
- **External:** the connector connects to the configured endpoint. It owns only
  its connection and never shuts down the external process.

All modes pass through the same authenticated frontend-session boundary.

Mode-specific details belong in the runtime contracts and settings UI. Code
that renders feed, projects, memory, permissions, or other domain screens must
not branch on the runtime mode.

## Installation and updates

Installation is a signed, exact-pair workflow:

1. Fully verify the installed pointer, manifest, inventory, target, protocol,
   compatibility, file sizes, hashes, and signature before any network request.
2. If no verified compatible package is selected, request only the immutable
   runtime index paired with the connector's own version. Never follow a
   `latest` descriptor.
3. Download into staging and verify the signed descriptor, bundle, extracted
   manifest, and complete inventory before activation.
4. Serialize account-local installation mutation so multiple vaults cannot
   prepare conflicting packages simultaneously.
5. Keep the currently working installation available until maintenance is
   admitted and the new runtime is ready.
6. Activate atomically, start the exact prepared executable, confirm its signed
   package identity at authenticated readiness, then finalize the journal.
7. Restore the prior pointer and reconnect the previous runtime if activation
   or startup fails before acceptance cleanup begins.

`RuntimePackageInstaller` owns the account-local `pending-installation.json`
journal under the managed runtime installation root. Schema 2 adds a
`finalizing` phase, written atomically after authenticated acceptance and before
deleting any same-version backup files. Partial deletion, a locked directory,
or interruption while removing the journal can then be retried at the next
plugin start. Recovery still verifies the complete signed active package,
fingerprint and pointer, then requires the exact runtime to reconnect. Backup
verification is required in `prepared` and `activated`, but is no longer
meaningful once `finalizing` records that cleanup started. Windows removal uses
three bounded retries before retaining this phase for later recovery.

All restored views join one recovered-installation finalization operation after
their individual runtime identities are checked. A concurrent failed request
waits for that acceptance before considering rollback, and multiple failures
join one rollback. This prevents simultaneous Windows journal replacements
from triggering shutdown of an otherwise healthy runtime. The regression uses
a real signed package and eight concurrent reconnects in temporary directories;
deferred acceptance tests cover successful cleanup and one shared failed recovery
before any release build. No journal schema, trust, or storage scope changes.

Schema-1 prepared/activated journals remain readable and advance to schema 2
on their next successful transition. Legacy journals with damaged backups fail
closed; this migration does not invent acceptance evidence. A repair can still
roll back before finalization. Once cleanup begins, the partial backup cannot
be used for rollback: finish the accepted installation before repairing it.
Older connectors cannot interpret a pending schema-2 journal, so finish cleanup
with the current connector before downgrading. The journal contains package
identities and version pointers only; no credentials, prompts or vault data.

The public Community build keeps automatic provisioning disabled and continues
to treat an available package as state awaiting explicit user action. An
approved release build may enable automatic provisioning after layout readiness
so an Obsidian connector update is the only normal update action. That path
retains explicit retry, repair, diagnostics, and removal controls.

Connector-visible views are not a maintenance authority. They cannot prove that
responses, compaction, subagents, or Events in the shared runtime are idle.
Automatic activation therefore also requires the canonical runtime-owned,
authenticated maintenance-admission lease. Staging may happen before admission;
shutdown, pointer activation, and reconnect must not. Until the generated lease
contract and its live acceptance matrix are present, the release flag remains
off. Release creation and publication remain outside this repository; see
[Release boundary](../release-boundary.md).

## Development-pair promotion

The private development workflow stages one schema-v3 `pending.json` receipt
whose runtime executable and complete asset inventory, protocol projection,
connector artifacts, vault marker, and
source content fingerprint are exact. The connector validates those identities
before requesting runtime-owned maintenance admission. A pending pair is never
current merely because its process started or its authenticated utility socket
connected.

After the exact runtime reconnects, the connector opens an authenticated
frontend session and performs protocol-v2 negotiation followed by a no-resume
subscription. Promotion requires the resulting fresh bootstrap to bind the
same pair ID, runtime instance, view ID, selected capabilities, sequence, and
revision. The proof is bounded to 20 seconds and is stored in both the promoted
`current.json` receipt and the activated adoption result. The development CLI
re-reads `current.json` and independently validates that proof before reporting
activation.

Before launch, the connector copies the verified development executable and
every canonical parser, image/OCR, and HTML-export asset into fresh staging,
then verifies and atomically renames the whole bundle into a connector-owned
cache addressed by executable plus sorted asset path/size/hash inventory.
New materializations use the canonical external device-local
`runtime/development-pairs` namespace, outside the Vault. The validated v3
current receipt carries `runtimeCacheLocation: external-v1`; the marker is
connector-owned location metadata, not artifact or permission identity. Pending
receipts and unknown markers reject. A current receipt without the marker uses
only its historical in-Vault cache, with no search, migration or fallback. Both
caches remain intact when a new adoption fails and restores the prior pair.
The pure asset allowlist is generated from `@chatobby/runtime-contracts`, not
maintained independently by the connector. Promotion and rollback
launch that immutable cached path rather than depending on the source worktree
or replacing the user's developer launcher. On every plugin load, the current
receipt re-derives that cache path and revalidates the vault marker, connector
artifacts, source fingerprint, protocol versions, and exact runtime/asset bytes before
pinning it for ordinary starts and restarts. A missing, non-regular, symlinked,
or modified cached runtime fails closed instead of falling back to another
configured development command.

New pending receipts must be v3. Legacy v1/v2 current receipts remain readable
for existing-state preservation and rollback, never new executable-only
admission. The adoption-result schema remains v2. Missing, extra, oversized,
linked, or changed assets block launch; an existing cache is never repaired
in place. After asynchronous maintenance and frontend bootstrap, integrity is
rechecked. No-replacement reuse additionally requires the current receipt's
bundle identity and activation runtime instance to match the authenticated
running instance; unknown or restarted instances take maintenance. These
checks provide development artifact integrity, not signed production admission
or race-free operating-system containment.

The generated finite inventory includes Host and Setup with one shared runtime
and .NET license/third-party notices. The authored group expects 192 helper
files and a 222-file total bound; actual combined compilation remains separate
proof. Every new native pending bundle requires the complete group before
deployment, cache staging, maintenance or launch. A current pair that includes
the helper cannot be replaced by base-only input. Complete historical Host-only
and base-only current receipts remain readable for preservation and rollback,
not new native admission, readiness or permission setup. Helper bytes are checked again after maintenance
admission and before launching the runtime, just like other assets.

At source `9227269a5da3b80c586c50cefce1c5c27d0fbb70`, the Host-only
first-admission and deployment regressions failed before the guard, then the
focused 51 cases and complete 1043-test suite (two existing skips) passed.
All five projections, connector checks, Community-review checks and build pass.
These are synthetic package/lifecycle tests; no native helper or installed
Obsidian session was exercised, and the recorded USER-boundary failure remains.

The subsequent source `c047e8ea3900d41e55436d688b8b0988a9fc04ab` projection
shares the byte-compatible bundle digest and external-cache path role. Focused
tests cover new external adoption, exact old-cache reload/rollback and invalid
marker rejection. Historical in-Vault bundles remain ordinary development
compatibility, not native installation authority. Rollback requires a matched
source/connector pair capable of interpreting its selected location; it never
rewrites an old receipt or moves existing code.
At this checkpoint, the focused 63 cache/projection cases (88d7a521), exact
five-projection backend comparison (86867fd8), connector checks (f0c7b288),
complete 1,051-test suite with two existing skips (7e2b9ab7), and Community-review
plus build (1e742fb2) pass. These isolated fixture results do not establish
native setup, a matching-platform runtime launch or installed/live acceptance.

Failure or timeout removes the pending receipt and records a non-current
adoption result. If the attempt replaced a running runtime, rollback stops the
trial runtime and restores the exact prior runtime only when its receipt,
binary, and currently installed connector bytes still match. Otherwise it
retains the stopped state rather than creating a mixed pair. The connector UI
remains loaded with a redacted exact-pair diagnostic, but every automatic and
manual runtime start route, including manager-owned crash retries and in-flight
launches, stays blocked for that plugin load. Recovery requires restaging a
valid exact pair and reloading Chatobby. Maintenance admission and
connector artifact rollback remain separate required transactions around this
runtime/frontend promotion gate.

## Per-view sessions and transport

Each Chatobby view receives an isolated frontend session from
`FrontendSessionRegistry`. The registry owns the session token, the protocol
client, auxiliary session transport, and disposal. A view controller converts
application runtime state into stable UI state and disposes its session when the
view closes.

The primary frontend protocol carries bootstrap, screen snapshots, intents,
patches, and notifications. Session-streaming data that is deliberately kept
outside that protocol travels through the connector transport adapter. See
[Wire protocol](../wire-protocol.md) for the current boundary map.

## Shutdown and recovery

Closing a Chatobby view disposes that view's frontend session without stopping
the shared runtime. Plugin unload calls `detach()`, not the explicit stop path:

- session-lifetime managed and developer modes request the runtime's reattach
  grace period before the connector disconnects;
- background managed mode disconnects while leaving the runtime running; and
- external mode disconnects without sending a lifecycle request to the
  external process.

An explicit Stop or Restart uses `stop()`. Managed and developer modes request
runtime shutdown and terminate their connector-launched process if it does not
exit within the bounded wait. External mode only disconnects. All cleanup paths
must be idempotent because Obsidian can close a view, reload the plugin, change
runtime mode, or terminate the application in quick succession.

Failures remain visible and actionable:

- missing or invalid installation: offer the supported install or repair path;
- failed download or verification: keep the working installation and show the
  verification failure;
- offline first installation: keep the connector loaded and expose retry;
- offline update: retain a verified compatible runtime and retry later;
- startup timeout or early exit: surface the captured startup reason and allow
  a bounded retry;
- authentication or connection loss: preserve the view and expose reconnect
  state rather than fabricating domain data;
- update failure: retain or restore the last verified runtime.
- plugin downgrade: reuse a retained verified compatible package and never
  replace a newer verified package without an explicit, journaled decision.

Logs and diagnostics must redact credentials, session tokens, provider keys,
and private prompt content.

## Change checklist

When changing this boundary:

1. Update the owning runtime contract before its UI projection.
2. Add focused tests for transitions, cleanup, and failure recovery.
3. Run `npm run check` and the proportional runtime/installation suites.
4. Build an unpublished candidate and install it into the disposable test vault
   for changes that affect installation, startup, or live transport.
5. Record source, runtime, connector, manifest, and artifact identities for live
   acceptance work.
6. Update this guide, the changelog, and user-facing installation or
   troubleshooting documentation when behavior changes.

No build, candidate, tag, or successful test authorizes publication.
