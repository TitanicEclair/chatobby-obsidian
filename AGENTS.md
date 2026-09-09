# Chatobby Obsidian Connector Development Rules

This private repository contains Chatobby's Obsidian connector. It owns the
native Obsidian experience and the verified boundary to the separate Chatobby
runtime. It does not own the agent loop or durable backend domain state.

## Start here

Before broad work, read:

1. `docs/responsibility-boundaries.md`;
2. `docs/release-boundary.md` for build, projection, or publication work;
3. the relevant current architecture document under `docs/`;
4. the Chatobby source monorepo's root and package-local `AGENTS.md` when a
   runtime, protocol, generated client, permission, tool, or domain contract is
   involved.

The live source and canonical contract package outrank historical plans and
handover documents. Do not copy old command counts, operation counts, paths, or
feature-status claims into current guidance.

If unfinished cross-repository work must be transferred to another session,
the private source repository provides an optional
`packages/chatobby/docs/devops/session-handoff.md` template. Record source and
connector state separately; neither repository's working state proves the
other. Ordinary cross-repository work does not require a handoff document.

## Status and responsibility

The connector owns:

- Obsidian views, commands, context menus, settings, keyboard and focus
  behavior, responsive layout, accessibility, and user-facing notices;
- composer input, attachments, feed rendering, feature pages, and normalized
  frontend projections;
- one leaf-local frontend session route, authenticated transport, and extension
  UI stream for each Chatobby view;
- one plugin-global Obsidian bridge coordinator, including bounded native
  folder observations and retry/rescan delivery; durable Project identity,
  marker interpretation, and reconciliation remain backend-owned;
- managed runtime installation, verification, update, startup, reconnection,
  rollback, and product-facing diagnostics;
- gathering live vault, workspace, editor, selection, cursor, attachment, and
  supported view context;
- allowlisted Obsidian operations requested through the bridge;
- connector settings and secret references. Secret values must stay within
  their approved local or Obsidian secret-storage boundary.

The connector does not own:

- model inference, reasoning, tool-loop execution, compaction, retries, or
  subagent execution;
- durable session history or authoritative memory, permission, channel, event,
  query, workflow, MCP, or subagent state;
- permission-policy evaluation or authorization decisions;
- public release authorization.

Frontend state may optimistically represent an action, but backend snapshots
and events remain authoritative for durable product state. Closing or reloading
an Obsidian view must not terminate session-owned backend work unless the user
explicitly requested that lifecycle action.

## Ownership boundaries

- Change a wire, tool, or domain contract in its canonical source-monorepo
  package first. Treat connector copies as generated projections or adapters.
- `src/vendor/chatobby-client/` is generated from the backend vendor output.
  Do not hand-edit it.
- `src/vendor/@chatobby/obsidian-protocol/` mirrors the canonical browser-safe
  Obsidian protocol. Keep it byte-for-byte compatible with its owner.
- `src/types/agent.ts` is a connector-owned narrowing of the model and agent
  event shapes the UI consumes. Verify every field against current source;
  there is no `src/stubs/` authority.
- Feature consumers import from `src/features/<feature>/public.ts`. Do not reach
  into another feature's private reducer, controller, state, or presentation
  internals.
- Feed/domain state must remain independent of Obsidian DOM APIs. Controllers
  coordinate effects; presentation receives selectors and narrow actions.
- The bridge executes only registered, validated operations. Never add an
  unbounded generic Obsidian, filesystem, process, or network escape hatch.

If a change crosses repositories, name one canonical owner for each contract,
then update generated connector projections through the documented generator
or sync command.

## Change map

| Area | Primary paths | Notes |
|---|---|---|
| Plugin composition | `src/main.ts`, `src/settings.ts`, `src/view-type.ts`, `src/uri-handler.ts` | Registration, lifecycle, settings, commands, and view composition. |
| Runtime lifecycle | `src/runtime/`, `src/backend/`, `src/vault-runtime.ts` | Installation, verification, process control, readiness, rollback, and diagnostics. |
| Transport and contracts | `src/transport/`, `src/vendor/`, `src/types/` | WebSocket adapters and generated/browser-safe contracts. |
| Obsidian bridge | `src/obsidian-bridge/` | Validated native vault/workspace operations. |
| Projects observation | `src/features/projects/` | Folder-event queue and typed bridge delivery only; no Project store or marker authority. |
| Feature domains | `src/features/` | Public feature boundaries, controllers, selectors, and presentation. |
| Composer and prompt context | `src/prompt/`, `src/attachments/`, relevant `src/ui/` modules | Live prompt context, attachment lifecycle, input, and controls. |
| UI and shared state | `src/ui/`, `src/state/`, `styles.css` | Page shell, feed, shared primitives, focus, responsive behavior, and styling. |
| Credentials | `src/credentials/` | Local credential writer and approved secret-reference integration. Never log values. |
| Commands | `src/commands/` | Obsidian command registration and deterministic target-view selection. |
| Tests and gates | `tests/`, `scripts/`, `boundary-manifest.json` | Architecture, protocol, release-boundary, and projection checks. |

Search for the actual owner before editing. Directory names and historical docs
are navigation aids, not architectural proof.

## Persistence and configuration

Any configuration change requires:

- one owner and typed schema;
- explicit storage and vault/project scope;
- validation and a safe default;
- migration, rollback, interruption, and recovery behavior when persistent data
  changes;
- a clear secret boundary;
- tests for old and new states.

Provider API keys default to the shared Chatobby agent credential store under
`.chatobby/agent/auth.json`, subject to the configured agent-directory override.
Obsidian-managed secrets are referenced by identifier; their values must not be
copied into plugin settings, frontend state, logs, diagnostics, or fixtures.

Managed runtime installation and version pointers are connector-owned external
state. A release build may launch only an installed package that passes the
signed inventory, platform, architecture, protocol, compatibility, and file
verification gates. Development overrides must remain unavailable in release
builds.

## Code quality

- Use strict, concrete TypeScript types; avoid `any` and explicit unsafe casts.
- Read installed dependency types and current Obsidian APIs instead of guessing.
- Keep schemas shallow and discriminated where practical. Derive user text and
  structured results from one typed state.
- Preserve focus, scroll, drafts, selection, and live session continuity during
  updates. Do not rebuild whole pages for unrelated feed changes.
- Use Obsidian theme variables and shared Chatobby primitives. Avoid fixed
  colors, global selectors, and `!important` unless an existing documented
  compatibility boundary requires it.
- Keep timers, observers, event registrations, object URLs, transports, and
  process handles owned and disposed by their lifecycle scope.
- Never expose internal prompt text, tool-discovery guidance, credentials,
  tokens, private filesystem paths, or signing material in the UI or logs.
- Ask before removing an intentional capability or changing product behavior.

## Development feedback and CI/CD gates

Reserve GitHub Actions builds for necessary final production preparation.
Run local checks, paired development installation and affected UI tests before
manual hosted verification. Do not use candidate installations or duplicate
push/PR CI as a debugging loop. Report failures and add earlier coverage. The
source-owned `packages/chatobby/docs/devops/actions-budget-policy.md` is the
cross-repository authority.

Cross-repository runtime/frontend development uses the source-owned
`chatobby-dev develop reconcile` command. This connector consumes only its
hash-bound pending receipt, verifies the exact installed artifacts and runtime
bytes, obtains runtime-owned maintenance admission, and promotes `current.json`
only after the exact development fingerprint reconnects and frontend bootstrap
completes. Visible views are UX state, never maintenance authority.

Guide prose is not connector source. Connectors that implement the Guide
channel fetch its signed compatibility-range manifest and only the immutable,
hash-bound revision named by that manifest. They verify the consumer schema,
connector compatibility, size, SHA-256, revision, bounded Markdown paths, and
file count, then retain the existing user confirmation before writing. Version
0.4.3 and older remain on the exact-release asset path until one connector
upgrade adds this channel. There is no bundled or runtime-command fallback.

Choose gates by impact and by the maturity of the change. A fast feedback loop
does not replace a review gate, and a passing review gate does not prove that
new bytes are loaded in Obsidian. Do not run release or multi-platform candidate
work merely to inspect an ordinary frontend edit.

### Gate map

| Gate | Use it when | Required outcome | Does not prove |
|---|---|---|---|
| Rapid frontend feedback | Iterating on connector-owned TypeScript or CSS in a disposable vault | Fresh development bundle is copied, Chatobby alone is reloaded, and the affected UI is inspected | Type safety, full regression safety, candidate identity, or release readiness |
| Focused checkpoint | A coherent edit or bug fix is ready for local review | Relevant typecheck, focused tests, and targeted live scenario pass | Full connector regression safety or publishability |
| Documentation-only | Only current guidance, comments, or non-rendered documentation changed | Links, paths, claims, formatting, and diff hygiene pass | Runtime or rendered UI behavior |
| Connector PR | Connector code, schema, CSS behavior, build logic, or an operating rule is ready for review | Complete connector checks/tests, current docs, changelog, and required live evidence pass | Paired runtime compatibility or release acceptance unless those boundaries were exercised |
| Paired runtime/connector | A runtime contract, generated client, startup path, bridge, installation, or live lifecycle changed | Exact source/connector identities, paired checks, installed hashes, and targeted test-vault scenarios pass | Multi-platform production-candidate or public-release acceptance |
| Production candidate | An exact version is frozen on paired private release branches | Native matrix, signed/inventoried runtime packages, production connector, and private candidate report pass | Publication authorization |
| Public release | The owner explicitly authorizes the exact accepted candidate | Runtime publishes first, connector assets/tag follow, Community review is requested, and public bytes are reverified | Permission to mutate a later version or replace immutable assets |

### Rapid frontend feedback

Work from the private connector development branch or its registered worktree,
never the public projection. Register one dedicated disposable vault once:

```powershell
npm run dev:vault:register -- --vault-root "C:\absolute\path\to\disposable-vault" --confirm-disposable
```

Registration requires an existing real `.obsidian` directory and writes
`.obsidian/.chatobby-dev-vault.json`. That path-bound marker and the explicit
confirmation are the deployment safety boundary. Never register the user's
main or Community-managed vault. A moved vault must be registered again; an
invalid marker is never silently overwritten.

For each frontend iteration, run:

```powershell
npm run dev:vault -- --vault-root "C:\absolute\path\to\disposable-vault"
```

The command performs the following bounded operation:

1. requires the explicit absolute vault root and matching disposable marker;
2. records the connector revision and dirty-path count;
3. runs only `node esbuild.config.mjs`, producing the unminified development
   `main.js` and generated `styles.css` without TypeScript or review gates;
4. transactionally replaces only `main.js` and `styles.css` under
   `.obsidian/plugins/chatobby/`, verifies staged and installed SHA-256 hashes,
   and restores the previous files if copying, verification, or reload fails;
5. preserves `data.json`, runtime packages and pointers, credentials, developer
   launchers, and every unrelated plugin file;
6. clears the Obsidian developer-error buffer, reloads only plugin ID
   `chatobby`, reads the fresh error buffer, and reports errors, hashes, source
   state, and build/copy/reload timings.

Use `--include-manifest` only when plugin metadata or version compatibility
changed. Use `--no-reload` for copy-and-hash verification without invoking the
Obsidian CLI, such as isolated automation. When the vault folder name does not
identify the intended registered Obsidian vault, provide
`--vault-name "<Obsidian vault name>"`. `--obsidian-cli` can select an explicit
CLI executable. Neither option broadens the file-copy allowlist, and a plugin
reload must not be substituted with a runtime restart.

After deployment, inspect the exact affected UI. For visible layout work, check
the relevant pane widths, themes, focus/keyboard path, scroll behavior, and
persisted draft/disclosure state.

Esbuild success is feedback, not a gate. It performs no TypeScript typecheck and
does not prove that the installed files match the source unless the copied
artifact hashes or bytes are checked; `dev:vault` performs that copy check but
still provides no type or regression proof. `npm run build` is deliberately
heavier: it runs Community-review checks and TypeScript before bundling, so it
is not the per-save frontend command.

### Focused checkpoint

Use this after a coherent edit and before expanding the change:

1. Run `npx tsc --noEmit` for TypeScript changes.
2. Run every modified or directly affected test file until it passes.
3. Run architecture tests when module, selector, public API, or ownership
   boundaries changed.
4. Repeat the targeted disposable-vault scenario for visible behavior.
5. Inspect `git diff` and confirm generated root artifacts are not being
   mistaken for canonical source.

### Documentation-only

1. Validate every changed local link and referenced path.
2. Search the edited guidance for obsolete absolute paths, historical commands
   presented as current, and competing authority claims.
3. Validate changed JSON or YAML, including `boundary-manifest.json`, when
   applicable.
4. Run the documentation-link architecture test when documentation navigation
   or source-code references changed.
5. Run `git diff --check`.

Comments or documentation that also change CSS declarations, executable code,
configuration, schemas, generated projections, or build behavior are not a
documentation-only change.

### Connector code or pull-request gate

Use this once per reviewable checkpoint and before committing or opening a pull
request; it is not required after every saved file.

1. Add or update focused regression tests and run each modified test directly.
2. Run `npm run check`.
3. Run `npm test` plus any boundary-specific integration suite.
4. Run `npm run check:community-review` when reviewable source, documentation,
   dependencies, build inputs, or the public projection boundary changed.
5. Run `git diff --check` and inspect the complete unstaged/staged diff.
6. Update `[Unreleased]` and the relevant current architecture, user, and
   operating documentation.
7. For visible UI changes, install the development build in the disposable test
   vault and record the exact scenarios inspected. UI, focus, navigation,
   permission-prompt, attachment, runtime-reconnect, and multi-view changes
   always require live evidence in addition to code tests.

Private connector CI runs locked dependency hydration, `npm run check`, and
`npm test` only when manually dispatched after local acceptance. After those pass, it builds the exact
development connector, records `main.js`, `manifest.json`, and `styles.css`
hashes, uploads a revision-bound receipt, and exercises the file-install
contract in a temporary vault fixture while preserving plugin data and runtime
state.

The workflow defines an explicitly requested installed-acceptance target on private `dev`, `main`,
or `release/*` using the `chatobby-disposable-obsidian` protected environment and
a dedicated self-hosted Windows runner. When that target is provisioned, the
job downloads the exact uploaded artifact, validates its receipt, resets the
runner-owned golden profile/vault, installs and reloads Chatobby, checks plugin
identity and DOM state, captures a screenshot and fresh developer errors,
uploads diagnostics, and resets the profile/vault again even on failure. Never
expose that runner to pull requests, forks, or arbitrary feature-branch code.
Do not describe the target as active without current GitHub runner,
environment, variable, and job evidence; `docs/release-boundary.md` records the
latest observed readiness. Connector CI still does not build the paired
runtime or authorize release.

### Backend contract or generated-client gate

1. Change the canonical source-monorepo contract first.
2. Build the source monorepo's vendor projection through its documented
   command.
3. Sync generated connector files; never hand-edit `src/vendor/`.
4. Set `CHATOBBY_BACKEND_ROOT` to the exact source checkout and run
   `npm run check:backend-contract`.
5. Run connector checks and the paired private source/connector gate.
6. Install the exact paired artifacts into the disposable test vault and verify
   negotiation, reconnect/resync, rejection, and affected UI behavior.

Record both repository SHAs. A connector pass against an unrecorded or stale
runtime is not compatibility evidence.

`check:backend-contract` invokes the source generator into a fresh temporary
directory with the connector's exact product version and expected source HEAD,
compares that isolated projection byte-for-byte, and removes it afterward. An
ambient ignored `vendor/` build cache in the source checkout is not projection
authority.

### Paired runtime/connector test-vault gate

Use this for runtime startup, bridge, generated protocol, persistent
configuration, installation/update/rollback, permission, or cross-process
lifecycle changes.

1. Build dependencies and the runtime through the current private-source
   development or candidate command appropriate to the change.
2. Build the matching private connector revision.
3. Record source SHA, connector SHA, product version, runtime executable or
   package hash, connector artifact hashes, installation paths, configured
   runtime command or version pointer, and restart/reload time.
4. Install the exact artifacts in the disposable vault while preserving its
   `data.json` and a recoverable previous runtime/connector state.
5. Restart the runtime only when runtime bytes or runtime configuration changed;
   reload only the connector for connector-only changes.
6. Exercise the affected live matrix and record observed results and fresh
   errors.
7. On failure, restore the previous connector bytes and runtime pointer, restart
   the affected lifecycle, and retain the failed artifact identity and redacted
   logs.

`chatobby-dev stage install` creates an exact synthetic candidate staging tree
and requires a complete verified runtime package. It is not the rapid frontend
feedback loop and does not by itself exercise the installed plugin inside a
running Obsidian test vault.

### Production-candidate gate

Use only for a frozen version on matching private `release/<version>` branches.

1. Record clean, committed, full source and connector SHAs and matching version
   authorities.
2. Dispatch the private source repository's multi-platform candidate workflow.
3. Require every native target, repository/platform regression, signed runtime
   package, installer/update/cancellation/rollback test, connector check/test,
   production connector build, inventory, and candidate verification job to
   pass.
4. Download artifacts from that exact run only; verify report, hashes,
   signatures, inventories, versions, source revisions, and the exact three
   connector assets.
5. Install the exact candidate into the disposable vault and complete manual
   acceptance against the matching runtime.
6. Record remaining limitations and stop for explicit approval.

Candidate creation is private and non-publishing. A green candidate does not
move private `main`, create public tags/releases, request Community review, or
authorize any of those actions.

### Authorized public-release gate

Use only after the release owner explicitly authorizes the exact accepted
candidate version and identities.

1. Promote the accepted private source and connector commits through their
   reviewed release-branch paths into private `main`.
2. Publish and freshly verify the runtime release first.
3. Project the exact approved connector source, push the immutable version tag,
   and allow the public tag workflow to check, test, build, attest, and publish
   exactly `main.js`, `manifest.json`, and `styles.css`.
4. Verify the public tag, release assets, attestations, hashes, default branch,
   and runtime/connector compatibility from fresh downloads.
5. Request the Obsidian Community release check only after both public releases
   exist, then monitor until the exact version is completed.

Published tags and assets are immutable. Corrections use a new version. No
ordinary build, check, pull request, candidate, monitor, documentation task, or
prior approval authorizes this gate.

## Integration and release effects

- The private repository is the development authority. The public connector is
  an allowlisted reviewable projection, not a second development source.
- `boundary-manifest.json` classifies reviewable source and official artifacts.
  Update it whenever a top-level source root or authority changes.
- `npm run export:reviewable` copies only allowlisted source into a fresh
  destination. It must never export `data.json`, local runtime state, generated
  release output, secrets, or machine-specific configuration.
- Release assets are built from immutable reviewed source and the matching
  canonical runtime contracts. Do not mix revisions from separate candidates.
- Obsidian reload and runtime restart are different lifecycle operations. Test
  the one affected by the change.
- Never create a public tag, GitHub release, Community review, or publication
  from an ordinary build or documentation task.

## Git and state preservation

- Base ordinary feature work on private `dev` and open pull requests back into
  `dev`. Private `dev` is the default next-release integration branch.
- Cut `release/<version>` from `dev` only for candidate stabilization. Only
  those temporary release branches normally promote into private `main`.
- Private `main` contains approved public-ready connector state. Public
  connector `main` is updated only by a separately authorized release
  projection from the exact approved private commit.
- Remove merged feature and release branches after their useful state is
  reachable from the intended persistent branch and immutable release evidence
  exists. Preserve unique work until it is deliberately archived or merged.
- Inspect status before editing. Preserve unrelated work from other sessions.
- Stage explicit files only; never use `git add .` or `git add -A`.
- Do not use destructive reset, checkout, clean, stash, force push, history
  rewriting, or `--no-verify` to resolve shared-worktree state.
- Commit coherent changes only after proportional tests. A later cleanup commit
  is acceptable when it preserves the cause and verification history.
- Public projection, release, and Community actions always require separate
  explicit authorization.
