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

## Verification

Choose gates by impact.

### Documentation-only

1. Validate every changed local link and referenced path.
2. Search the edited guidance for obsolete absolute paths and competing claims.
3. Run `git diff --check`.

### Connector code or schema

1. Add or update focused regression tests.
2. Run each modified test until it passes.
3. Run `npm run check`.
4. Run `npm test` plus any boundary-specific integration suite.
5. Update `[Unreleased]` and the relevant current documentation.

### Backend contract or generated client

1. Build the source monorepo's vendor projection through its documented command.
2. Sync the generated connector files; do not edit them manually.
3. Set `CHATOBBY_BACKEND_ROOT` to the exact source checkout and run
   `npm run check:backend-contract`.
4. Run connector checks and the paired private source/connector gate.

### Runtime, release, or public projection

1. Run `npm run check:release-boundary`.
2. Build the unpublished candidate with `npm run build:release`.
3. Confirm the official connector asset set is exactly `main.js`,
   `manifest.json`, and `styles.css`.
4. Install the exact candidate into the disposable test vault and exercise the
   affected UI and lifecycle paths against the matching runtime.
5. Record source, connector, runtime, manifest, and artifact hashes.
6. Keep publication disabled until the release owner explicitly authorizes it.

UI, focus, navigation, permission-prompt, attachment, runtime-restart, and
multi-view changes require live test-vault verification in addition to code
tests.

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
