# Changelog

## [Unreleased]

## [0.1.6] - 2026-07-19

### Changed

- Made Stop acknowledge cancellation immediately while the runtime finishes
  bounded cleanup, so a slow provider cannot leave the composer controls hung.
- Expanded the public guide around installation, permissions, project
  guidance, Context Queries, skills, subagents, workflows, Events, and privacy.

### Fixed

- Routed subagent permission decisions to the exact requesting child and kept
  stale permission actions from targeting an unrelated or completed run.
- Made vault entry listing treat `.`, `./`, `/`, and the empty folder as the
  vault root, normalize Windows separators, and reject traversal attempts.

## [0.1.5] - 2026-07-18

### Added

- Expanded existing Obsidian workspace and Web Viewer operations with exact
  leaf targeting, compact layout metadata, right/double click, and one native
  pointer operation for hover, scrolling, and drag interactions.
- Promoted temporary composer attachments through Obsidian's configured
  attachment location and returned the exact Markdown link and embed.

### Changed

- Clarified subagent displays so their default token budget represents uncached
  model work rather than repeated prompt-cache reads.

### Fixed

- Restored scrolling for long Memory record lists without introducing a nested
  competing scroll container.
- Kept session-directory names and message metadata contained and readable in
  both side-by-side and stacked layouts.
- Migrated Chatobby-owned native skills out of user-visible skill directories
  while preserving user-authored content.
- Removed review-only incompatibilities around cross-window DOM checks,
  Promise rejection values, and narrow channel layouts.

## [0.1.4] - 2026-07-18

- Removed arbitrary Web Viewer page-script evaluation while retaining bounded
  semantic reading, sanitized DOM inspection, stable element references,
  native interaction, event-driven waits, and screenshots.
- Added a release-boundary check that rejects arbitrary code evaluation in the
  public Obsidian connector source.

## [0.1.3] - 2026-07-18

- Expanded Obsidian Web Viewer automation with semantic Markdown reading,
  stable accessible element refs, page identity checks, sanitized DOM
  inspection, browser history, native key input, event-driven waits, safe form
  filling, screenshots, and password redaction.

## [0.1.2] - 2026-07-18

### Fixed — first-run lifecycle and navigation reliability (2026-07-17)

- Kept an active agent turn running when a Chatobby page or observer connection
  closes, while retaining explicit Stop as the user-owned cancellation action.
- Replayed the current frontend snapshot to newly mounted views and subscribed
  before transport bootstrap so the first message and feature pages update
  without a route-away/route-back refresh.
- Made repeated clicks on the current or pending Chatobby destination a no-op,
  preventing duplicate Obsidian history entries and extra Back presses.
- Added bounded connector requests, backend commands, shell commands, arbitrary
  tool execution, and unanswered permission prompts so stalled work resolves to
  a visible error instead of waiting indefinitely.
- Replaced indefinite feature-page loading states with actionable unavailable
  messages when the runtime cannot answer.
- Added an inline first-run guide for runtime connection, provider setup,
  permission policy review, and sending the first prompt.
- Preserved permission-page scroll position while live policy changes save and
  restored Obsidian-sized typography throughout the Chatobby view.

### Added — public alpha distribution (2026-07-17)

- Added official runtime-download recovery actions, public installation and
  troubleshooting guidance, Community-directory disclosures, and optional
  Patreon funding metadata without feature gating.
- Added a theme-native in-plugin runtime installation and update guide with
  explicit confirmation, signed release metadata, bounded streaming downloads,
  path-safe extraction, complete package verification, atomic activation,
  rollback-safe failure recovery, and a compact composer update action.

### Added — document attachments (2026-07-17)

- Added a compact composer attachment action backed by the native file picker,
  responsive image/document chips with truncated titles and file sizes, and
  safe 10 MB/eight-file limits shared with the backend document reader.

### Added — slash activation affordances (2026-07-17)

- Added compact selected-command and selected-skill chips above the composer,
  including a dedicated target treatment for future goal commands and a visible
  Tab hint on the active autocomplete row.

### Fixed — slash command catalogue (2026-07-17)

- Deduplicated runtime command names in the connector so obsolete permission and
  memory aliases cannot reappear as separate advertised extension commands.

### Fixed — composer session policy targeting (2026-07-16)

- Made the composer permission picker reattach and verify its visible Obsidian
  leaf's session before loading or applying a session-only policy, preventing
  another leaf's backend session from receiving the selection.
- Rekeyed restored blank-session tabs when the backend recreates a missing
  not-yet-flushed session path with a new session ID.

### Fixed — ribbon page containment (2026-07-16)

- Kept Channels and the other ribbon pages stretched to the available view
  height by making their shared host a column flex container.

### Changed — page ribbon, memory, Events, and session controls (2026-07-15)

- Replaced in-view main-session tabs with a page ribbon for Channels,
  Permissions, Memory, and Events; the plus action now opens a blank Chatobby
  Obsidian leaf, and active sessions cannot be retargeted to another directory.
- Kept provider, model, effort, and the current session permission policy in
  the composer, with direct session-only policy switching from its dropdown.
- Rebuilt Memory records as compact collapsed rows with inline edit, archive,
  delete, history, and technical detail controls, and projected pending memory
  suggestions into their originating session feed for approve/reject/ignore.
- Made Events visibly selected tabs unambiguous and added vault-wide project,
  permission policy, and main/role agent allocation to definitions and history.
- Unified ribbon destinations, new-view, and directory selection as one
  right-aligned icon toolbar, and rebuilt the session-policy picker with
  height-safe wrapping, explicit selection marks, and keyboard navigation.
- Replaced native composer selects and the policy card menu with one searchable,
  scroll-bounded command picker for policy, provider, model, and effort.
- Made Channels respond to its Obsidian pane width instead of the application
  window, preventing the directory rail and conversation from collapsing into
  overlapping slivers in narrow splits.

### Added — agent switcher and channel communication (2026-07-15)

- Rebuilt the session agent bar as a persistent Main/subagent tab switcher that
  updates as agents start, marks the selected feed, uses a spinner only while an
  agent is working, and participates in native Obsidian back/forward history.
- Added a top-bar Channels screen with channel navigation, bounded message
  history, group-chat bubbles, message metadata, and direct navigation to the
  addressed agent feed.
- Added multi-channel permission controls for connect, read, and send decisions
  across automatic session channels and named vault channels.
- Brought subagent composers and normal response rendering in line with main
  sessions, while limiting each session feed to channel messages directly
  addressed to that feed's agent.

### Fixed — simultaneous sessions and reload reattachment (2026-07-15)

- Replaced the single active WebSocket and session-event owner with one
  authenticated runtime channel and Obsidian bridge client per Chatobby leaf.
- Enabled simultaneous parent-agent turns in separate Obsidian Chatobby tabs
  while retaining one shared backend process, supervisor, and vault index.
- Made New and Resume open an independently runnable Obsidian Chatobby tab when
  the current leaf already owns a session, even within the same directory.
- Preserved leaf registrations across runtime disconnects and automatically
  reattached every restored leaf and session path after plugin or Obsidian reload.
- Requested Obsidian layout persistence whenever a leaf's directory or active
  session recovery path changes, and deferred session adoption until restored
  leaf state has hydrated.
- Scoped session operation coordination, commands, events, model state, and
  extension interactions to their owning leaf so one tab cannot retarget,
  interrupt, or disconnect another.
- Added transport and registry regressions for concurrent connections, isolated
  leaf teardown, backend replacement, and reload reconnection.
- Live-verified two simultaneous DeepSeek V4 Pro turns, then reloaded the plugin
  and restored both original session ids, paths, messages, and connections.

### Fixed — leaf session accountability and session explorer (2026-07-15)

- Pinned working-directory and active-session recovery state to each Chatobby
  Obsidian leaf. Selecting a different directory from a leaf with sessions now
  opens or focuses a separate leaf while reusing the shared runtime.
- Made active-tab close establish a replacement backend session before a later
  prompt can resolve its destination, preventing messages from returning to the
  session the user just closed.
- Added direct stored-session rename, clone, fork, export, and delete commands
  so contextual maintenance never temporarily replaces the active conversation.
- Rebuilt the session explorer with collapsible folders, vault-wide title
  search, compact contained rows, right-click-only actions, and responsive
  stacked layouts.
- Added explicit interrupted/restored feed receipts and reconciliation of
  accepted subagent controls across transport loss.
- Routed permission, compaction, preferences, export, and session maintenance
  through the shared operation coordinator.
- Replaced fixed bridge-test readiness sleeps with state-based waits and bounded
  client teardown, removing the full-suite startup race.

### Changed — reliability ownership and advanced session UX (2026-07-15)

- Added a plugin-scoped operation coordinator and moved session, runtime, and
  workflow-control concurrency into producer controllers instead of independent
  command-palette and slash-command locks.
- Moved maintenance actions out of general command discovery and into a stored
  session ellipsis/right-click menu with resume, rename, clone, fork, export,
  and delete actions.
- Redesigned blocking extension requests and generic extension panels as
  compact theme-native inline feed elements.
- Made workflow validation/save failures stay visible, prevented duplicate
  submission, and kept generated step identifiers unique after edits.
- Documented the persistence/reconstruction/ephemeral state matrix, user entry
  point inventory, lifecycle invariants, and staged acceptance checklist.

### Changed — permission, subagent, and session navigation UX (2026-07-15)

- Kept expanded permission capability and advanced-rule sections open while
  live decisions save, and removed redundant live-application status copy.
- Simplified subagent runs around working, needs-you, and finished states;
  moved executor, budgets, runtime, and technical evidence behind advanced
  disclosures; and made the run layout contain itself in narrow panes.
- Replaced role-local tool selection with one reusable permission-policy
  selector and a direct route to policy management.
- Added backend-managed policy creation and assignment for prompted role design,
  while removing the second delegation confirmation when the active policy
  already authorizes subagents.
- Added native Obsidian back/forward history for Chatobby screens and made the
  session explorer mutually exclusive with Permissions, Memory, Events, and
  Subagents so stale split overlays cannot remain mounted.
- Rebuilt the session browser as a hierarchical vault explorer with session
  indicators, exact created/last-used timestamps, safe deletion, and one
  descendant catalogue load.
- Applied thinking-display, auto-scroll, and auto-name setting changes to live
  views and sessions, added automatic-compaction running/completed feedback,
  and improved narrow composer-control layouts.
- Extracted history routing and session-picker mode ownership from the main
  Obsidian lifecycle adapter into dedicated controllers.

### Fixed — Runtime reload and compatibility (2026-07-15)

- Sent the managed-runtime detach request before closing the old frontend
  connection, so a replacement plugin instance cancels the grace-period
  shutdown instead of being terminated by a late unload request.
- Advanced the managed-runtime protocol boundary with the permission-profile
  backend, preventing an older installed executable from being treated as a
  compatible runtime and failing only when the Permissions screen opens.

### Changed — Live permission profiles and MCP parity (2026-07-15)

- Replaced direct vault-file policy editing with authenticated backend profile
  commands and optimistic revision handling, so permission changes apply at the
  next tool authorization even during an active turn.
- Added named parent profiles, editable custom copies, and per-subagent role
  inheritance or explicit profile assignment.
- Added consistent allow/ask/deny controls for MCP-wide behavior, discovery,
  configured servers, individual discovered tools, and exposed resource tools.
- Redesigned the screen around user-facing capabilities, inherited-state labels,
  responsive semantic styling, and clear storage/live-application guidance.
- Added a live dependency registry for community plugins, core plugins, and the
  Obsidian CLI. Hard-dependency tools now disappear from agent discovery,
  permission controls, and role tool pickers when unavailable; plugin changes
  propagate without restarting the Chatobby session.
- Moved subagent permission assignment into the redesigned role editor, with
  human-oriented role fields, real model selection, combined live tool
  discovery, user-skill selection, and advanced runtime settings.

### Added — Release boundary foundations (2026-07-14)

- Added installer-provided runtime trust-key plumbing and complete recursive
  package inventory verification, including rejection of extra files and
  symlinks before launch.
- Added explicit development and release connector builds; release builds
  disable source maps, minify assets, and stage only the three official Obsidian
  release files.
- Added a reviewable-source boundary manifest and checks for unclassified source
  roots, private runtime imports, symlinks, local settings, and release asset
  drift.
- Added release artifact checks for source maps, local paths, credentials,
  signing material, common secret formats, and unexpected files.
- Restricted release managed-runtime resolution to the installer-owned current
  runtime path while retaining environment, bundled, and `PATH` resolution for
  development builds.
- Upgraded runtime installation to signed complete-package manifests and made
  release startup re-verify every executable/UI/WASM file against the embedded
  Ed25519 trust anchor before spawning the runtime.
- Added an allowlist-only reviewable-source exporter with strict publication
  gates, draft gap reporting, and exact locked connector dependencies.

### Added — Managed runtime lifecycle and Events (2026-07-14)

- Replaced port-based backend ownership with a vault-scoped runtime manager that
  starts Chatobby on demand, verifies authenticated identity/readiness, uses
  dynamic endpoints, reattaches across plugin reloads, and never adopts or kills
  an arbitrary port owner.
- Added managed, external, and developer runtime modes; bounded restart/circuit
  breaking; graceful stop/detach; machine-local descriptors, credentials, logs,
  and verified runtime installation/rollback foundations.
- Kept view rendering and composer drafts available during startup, routed all
  normal actions through one readiness gateway, and added accessible inline
  status, diagnostics, restart, and stop controls.
- Added optional detached background runtime lifetime plus a production Events
  screen for cron, vault-path, and named-command automation with approvals,
  explicit view-closed consent, budgets, Run now, pause/resume, deletion, and
  bounded history.
- Added `/events`, a composer Events icon, visible-view signaling, and the
  current browser-safe Event contracts/client methods from the built backend.
- Added responsive Events layouts and tests for lifecycle ownership, secure
  installation, composer send-once behavior, status UI, Event editing, and
  backend-contract synchronization.

### Fixed — Composer, feed scroll, context meter, compaction UX (2026-07-14)

- Resized the composer textarea back to its resting height after sending a long message. Programmatic value changes (`clear`, prefill, slash autocomplete) now run the autosize that previously only fired on DOM `input` events, so the box no longer stays expanded until the next keystroke.
- Kept a bottom-pinned feed pinned when large blocks arrive. A `ResizeObserver` on the blocks container now re-pins a following reader to the bottom when content keeps growing after a flush (markdown render, syntax highlighting, image/embed loads — height changes that fire no scroll event), while still releasing instantly on any upward reader motion and never yanking a scrolled-up view. Coalesced to one scroll per animation frame.
- Refreshed the context-usage meter on tab switch. Stats are cached per connection rather than per tab, so the active tab now resets and refetches its stats on activation instead of showing the previous session's meter until the next message.
- Showed the chosen automatic-compaction threshold as a live percentage beside the slider (the slider's value bubble only appears while dragging), so the exact 50–95% value is visible at rest.

### Added — Model compaction and agent task foundations (2026-07-14)

- Added default-on per-model automatic-compaction settings with a 50-95%
  threshold, backend-resolved safety trigger, composer status control, native
  settings modal, and compact running/completed feed states.
- Added first-class branch-aware task tools and prompt policy to parent and
  subagent sessions; plans are reserved for meaningful multi-step work and are
  distinct from reusable subagent workflow graphs.
- Fixed invisible typed text in the subagent composer and restyled addressed
  agent communications as compact route-aware feed rows matching Chatobby's
  existing visual system.

### Fixed — Subagent room routing and communication clarity (2026-07-14)

- Stopped lifecycle-only child turns from activating the parent; one named run block now carries ready/running/terminal state while explicit `message_parent` communication requests a parent pass.
- Added semantic child-to-parent, child-to-user, sibling, and exact-reply tools; replies remain canonical messages while communication-tool calls, delivery receipts, and post-send acknowledgements stay out of the child chat feed.
- Preserved actor display names across the durable contract, removed UUID-oriented reply labels, suppressed legacy result duplicates, and reduced agent communication to responsive groupchat-style rows with direct feed navigation.
- Replaced the full-width run-details bar with a compact Open button in the run header and removed result previews from the parent run block.

### Fixed — Backend restart session recovery (2026-07-13)

- Kept the backend alive across plugin unload/reload, reconnected an already-running managed backend, and added bounded restart backoff after unexpected managed-process exits.
- Added health monitoring for an adopted backend so a process that exits after plugin reload is detected and restarted automatically.
- Reattached the visible conversation to its persisted backend session after a backend restart instead of leaving the active tab bound to a fresh hidden session.
- Cleared stale streaming, compaction, retry, tool, and interaction state immediately when the transport disappears, so the composer cannot remain visually stuck running.
- Made selecting the already-active tab verify and repair its backend session attachment rather than returning early with stale state.

### Changed — Native subagent conversation feed (2026-07-13)

- Limited the session rail to active role-named agents and their status, removed its redundant supervisor button, and made each item open the exact child feed.
- Replaced always-expanded agent traffic with compact expandable named communication blocks, removed transcript-promotion UI and USD-oriented controls, and showed the actual model with muted inheritance provenance.
- Removed the duplicate attached-response projection when the same operator reply exists as a durable message, and removed control-page message composition in favor of the child feed.
- Replaced the focused transcript inspector with the same normalized `FeedRenderer` and composer shell used by normal Chatobby conversations.
- Projected child responses, live output, tool activity, and origin-preserving communications into normal feed blocks; only explicit operator messages use user bubbles.
- Added incremental projected-document reconciliation so child updates preserve scroll and expansion state and rerender only changed blocks and tools.
- Kept child controls, decisions, earlier-history pagination, and artifacts available around the conversation without restoring management analytics to the feed.

### Fixed — Session subagent supervisor corrective pass (2026-07-13)

- Scoped snapshots, run history, messages, mutations, and deletion to the connected Chatobby session; filtered global sequence gaps no longer trigger refresh loops.
- Added normalized live child feeds for transcript entries, live drafts, tool activity, messages, and acknowledgement responses, with newest-first cursor pagination.
- Added visible effective/failed control receipts, reliable message and steering actions, saved-workflow execution, real role scope targets, and confirmed session-data deletion.
- Removed lifetime token/cost dashboard totals, added active-child navigation, and constrained grids, cards, controls, inbox rows, and transcript rows for narrow Obsidian panes.
- Synced the generated browser client to the current backend contracts, including layered settings context and session deletion.

### Fixed — Memory scope and retired commands (2026-07-13)

- Kept `/memory` as the direct user-facing memory command and retired the old
  extension command family from autocomplete. Invoked legacy aliases are
  intercepted locally and cannot fall through to a model prompt.
- Added regression coverage for project-filter visibility and aligned the
  agent tool contract so general memory defaults to the active project unless
  the agent explicitly selects vault scope.

### Changed — Memory architecture and user experience (2026-07-13)

- Replaced prompt-simulated memory actions with typed backend create, update,
  archive, restore, permanent-delete, search, policy, candidate-review, and
  Markdown import/export calls.
- Reworked Memory around Vault profile, Vault memory, project boundaries, and
  reversible archival, with explicit project isolation and permanent-deletion
  confirmation that preserves source transcripts.
- Removed non-interactive operational dashboards, added responsive semantic-token
  styling, and updated the vendored frontend contract for scoped snapshots and
  canonical SQLite storage.

### Added — First-class subagent supervisor (2026-07-12)

- Added a dedicated Obsidian management screen for parallel runs, node/runtime inspection, transcripts, artifacts, durable messages, role definitions, workflow DAGs, and supervisor controls.
- Added snapshot-plus-ordered-delta synchronization with runtime/sequence validation and O(1) private indexes, keeping orchestration state independent from the chat feed.
- Synced the generated browser client and `@chatobby/pi-subagents` browser-safe contracts, added transport wrappers, architecture checks, 10,000-run performance coverage, and responsive semantic-token styling.
- Added an operator inbox for permission requests, reviewed acceptance evidence, and durable blocking messages; explicit worktree/budget start controls; layered role scope IDs and full runtime policy fields; worker fingerprints, workspace audits, orphan reconciliation, fork/clone, and artifact promotion.
- Added one compact feed projection per durable supervisor run with a direct Open run details action, while keeping transcripts and high-frequency events outside the feed store.
- Cut the frontend contract over to definition addresses, message list/acknowledgement APIs, permission/acceptance records, and explicit worker recovery mode.
- Added typed, cursor-based run history with filters for name, parent session, project directory, lifecycle status, agent role, executor, and creation age; additional pages keep transcripts lazy and the initial screen bounded to 100 summaries.

### Changed — Prompt workspace context (2026-07-12)

- Added working directory, active surface, session maturity, session name, and
  permission mode to the typed per-turn Obsidian context packet, and synced the
  vendored browser-client contract from the current backend build.

### Changed — Normalized feed architecture and UI system (2026-07-12)

- Replaced whole-feed reducer cloning with a normalized, per-session feed store,
  private indexes, focused reducers, scoped change sets, and versioned snapshots.
- Moved session, command, live-stats, extension UI, memory, and permission ownership
  into documented controllers behind feature-level public APIs and architecture checks.
- Refined feed, composer, toolbar, session, permission, and memory styling around a
  semantic token layer, including narrow-pane memory layouts and reduced motion.
- Added deterministic feed-scale tests, hydration validation, module-boundary checks,
  and a local backend-contract verifier for the compiled CLI and vendored browser client.

### Added — Web viewer browser bridge tools (2026-07-08)

- Added plugin-side Web viewer handlers for `browser.open`,
  `browser.navigate`, `browser.list`, `browser.snapshot`, `browser.read`,
  `browser.click`, `browser.type`, `browser.wait`, `browser.evaluate`, and
  `browser.close`, exposed through the vendored `obsidian_browser_*` MCP
  catalog entries.
- Updated the bridge capability vocabulary to advertise `browser` and synced
  the vendored tool catalog to the current 70-tool backend surface.

### Changed — Retrieval / vault-search responsiveness (2026-07-07)

- Memoized the Obsidian link-adjacency graph in `VaultRetrievalService`; it was being rebuilt from `metadataCache.resolvedLinks` on every retrieval query across seven call sites (`trace`, `hubs`, `communities`, lexical search/related, `lexicalGraphFromPaths`, and `graph.traverse`). The cache is invalidated by vault `modify`/`create`/`delete`/`rename` events and detached on plugin unload.
- Made the lexical full-vault scan cooperative: it now yields to the event loop every 32 files so note navigation stays responsive during a search, and checks the bridge `AbortSignal` between chunks so an aborted/deadlined search stops work instead of running to completion in the background.
- Routed `graph.traverse` through the shared cached adjacency instead of rebuilding the link graph itself.

### Changed — Toolbar stats no longer thrash during streaming (2026-07-07)

- Stopped the toolbar stats subtree from being torn down and rebuilt several times per second during streaming. Stats children are now cached and updated in place (`textContent` + CSS variables), agent events only do a cheap connection/streaming flag update, and the elapsed timer ticks an in-place update instead of a full re-render.

### Changed — Feed rendering performance (2026-07-07)

- Built conversation source text only when source mode is displayed, instead of rebuilding the hidden source transcript during normal streaming renders.
- Rendered thinking blocks as plain text and kept live elapsed updates on lightweight block ticks.
- Increased live response markdown render debounce to reduce Obsidian main-thread pressure while preserving markdown rendering during streaming and completion.

### Changed — Feed source view and tool previews (2026-07-06)

- Added a reading/source toggle for the conversation feed, with source mode rendered as a read-only textarea for normal text selection.
- Removed block-level feed navigation and the synthetic read-only cursor mode from reading view.
- Changed active tool rows to show their semantic target when available, or the tool name plus a compact one-line input preview when no semantic target exists.
- Kept tool blocks streaming until every contained tool item reaches a terminal status.
- Changed composer Escape during an active turn to require a second Escape press before aborting, with the stop button changing to `Esc` while confirmation is armed.
- Removed the aggregate "All providers" option from composer provider controls.

### Fixed — Composer controls and screen focus (2026-07-05)

- Fixed provider/model controls so a selected provider is preserved across model refreshes and model choices are applied explicitly instead of snapping back to the prior DeepSeek selection.
- Restored composer focus after leaving dedicated Chatobby screens, and tightened the Memory screen row layout so action descriptions and badges no longer overlap in narrow panes.
- Persisted the model returned by the Obsidian "Cycle model" command so future sessions use the cycled model preference.

### Changed — Memory and interaction UX (2026-07-05)

- Replaced the feed-panel memory menu with a dedicated keyboard-navigable Memory screen that separates current-session, project, profile, and memory-system actions.
- Redesigned blocking select/confirm interaction cards so numbered choices render as vertical rows with clearer focus, selection, and shortcut affordances.

### Changed — Permission screen navigation and layout (2026-07-05)

- Added keyboard navigation to the permission policy screen: Tab/Shift+Tab use native focus order, Up/Down moves between permission rows, and Left/Right changes the focused row's allow/ask/deny decision.
- Moved new-rule creation into each permission section with default-deny saves, added an external-directory section, and improved section spacing plus decision control styling.

### Fixed — Feed vault and path links (2026-07-05)

- Fixed feed markdown links so rendered `[[wikilinks]]`, Obsidian URI links,
  bare vault `.md` paths, and explicit local file paths can be clicked from
  Chatobby feed blocks.

### Added — First-class extension UI screens (2026-07-05)

- Added durable feed panels for extension `notify` and `setWidget` output so
  long Hermes memory, permission, and subagent messages are visible in the
  Chatobby conversation instead of transient Obsidian notices.
- Added a Chatobby-owned `/permission-system` screen and inline project-policy
  editor for `.pi/extensions/pi-permission-system/config.json`, replacing the
  old local permission-mode picker with the configured Pi permission extension.
- Added a Chatobby-owned `/subagents:sessions` screen plus transcript-path
  rendering on subagent lifecycle blocks.

### Added — Frontend slash command handler (2026-07-04)

- Added a frontend-owned slash command parser/state layer for composer-local command detection, autocomplete activation, escape cancellation, argument span parsing, and submit planning.
- Added textarea overlay highlighting for activated slash command words and consumed arguments while preserving the existing textarea input path.
- Added local slash command execution for session/control actions and standalone backend dynamic command dispatch from `getCommands()`.
- Added argument option completion for slash commands with predetermined args, including model and thinking-level pickers before final command submission.
- Fixed slash picker keyboard navigation so the active row stays scrolled into view, and added feed-level guidance for invalid slash command inputs.

### Added — Pi extension events and subagent feed blocks (2026-07-04)

- Added `extension_event` support to the vendored Chatobby websocket client and transport path.
- Added plugin-owned extension event and subagent activity types, reducer state keyed by `agentId`, and `SubagentBlock` rendering for subagent lifecycle updates.
- Added distinct `subagent` tool classification for `subagent`, `get_subagent_result`, and `steer_subagent`.

### Changed — Composer polish, live stats, and tool row summaries (2026-07-03)

- Refined the composer control row so provider/model/thinking/permission selectors sit on
  the composer surface instead of drawing separate filled rectangles, while preserving
  Obsidian theme fonts and colors.
- Removed the composer placeholder text, added a subtle default lift to the composer card,
  and spaced the feed away from the composer so the scrollbar no longer touches it.
- Replaced the linear context meter with a circular clockwise fill indicator that shows the
  context percentage inside the ring and keeps exact token/window detail in the hover title.
- Added live polling of `getSessionStats()` while turns or compaction are active, so the
  toolbar token label can update during generation when the backend reports live stats.
- Updated token labels to render as `1874 tokens`, `14.4k tokens`, or `1.2M tokens`.
- Tuned tool rows toward the Chaude style and added compact `+N`/`-N` change summaries
  from tool arguments or diff result envelopes.

### Changed — Frontend architecture: UI hierarchy + co-located styles (2026-07-03)

- Reorganized `src/ui/` into a component-based hierarchy. Each area is now a
  directory owning its components **and** its CSS:
  - `ui/shared/` — base `ChatobbyComponent` class (← `components.ts`), `constants.ts`,
    `format.ts`, `tokens.css`.
  - `ui/shell/` (← `view-shell.ts`), `ui/toolbar/` (← `toolbar.ts` + `status/` folded in),
    `ui/composer/` (← `composer.ts`, `composer-controls.ts`, `slash-menu.ts`),
    `ui/modals/` (← `modals.ts`).
  - `ui/feed/`, `ui/session/` keep their components; each gained a co-located `.css`.
- **Co-located CSS, bundled.** Split the single 906-line root `styles.css` into 8
  component files (`shared/tokens.css`, `shell/shell.css`, `session/session.css`,
  `toolbar/toolbar.css`, `composer/composer.css`, `modals/modals.css`, `feed/feed.css`,
  `feed/tools/tools.css`). A new `src/ui/styles.css` barrel `@import`s them; `esbuild`
  bundles it into the root `styles.css` Obsidian loads (now a generated, committed
  artifact like `main.js`). Verified byte-complete: 175/175 rule blocks, every
  selector preserved.
- `view.ts` stays the orchestrator (its decomposition into Session/Interaction/Event
  sub-managers is deferred). ~25 import sites + tests updated to the new paths.

### Added — Backend orphan detection (adopt-on-start) (2026-07-02)

### Added — Command registry + reliable backend start/stop (2026-07-02)

- Added a **command registry** (`src/commands/`) that separates plugin functionality
  (declarative action records in `src/commands/actions/`) from Obsidian command
  registration. Adding a command now means dropping a record into the relevant
  actions file — no `main.ts` edits. Actions are also invocable programmatically
  (`registry.run(id)`) and discoverable (`registry.list()`). Shared try/catch +
  `Notice` handling lives once in the registry instead of per-command.
- Added explicit **"Start backend"** and **"Stop backend"** commands replacing the
  old "Toggle backend" (whose stop branch was unreachable after a renderer reload —
  the plugin lost its `ChildProcess` handle and every later launch died on the
  port-in-use, silently reconnecting to the orphaned process).

### Changed — `main.ts` decomposed (2026-07-02)

- Decomposed `main.ts` (~433 → ~270 lines, pure wiring) into focused modules:
  - `src/state/settings-store.ts` — settings + session-preference persistence and mutators.
  - `src/backend/backend-controller.ts` — orchestrates the backend process + transport connect.
  - `src/commands/` — registry + grouped action records.
  - `src/uri-handler.ts` — the `obsidian://chatobby` handler.
  - `src/view-type.ts` — the `VIEW_TYPE_CHATOBBY` constant.
- The plugin's public surface used by SettingTab/view/toolbar (`settings`,
  `getSessionPreferences`, `updateSettings`, `getBackendState`,
  `onBackendStateChange`, `createTransport`, `configuredProviders`,
  `setServerUrl`, provider-key methods) is preserved via delegates.

### Added — Backend orphan detection (adopt-on-start) (2026-07-02)

- `BackendController.start()` now probes the configured port before spawning. If a
  backend is already listening there (e.g. an orphan from a previous Obsidian
  session that survived a reload), it **adopts** it — connects the transport and
  marks the state `running`/`external` — instead of spawning a doomed duplicate
  that dies on `EADDRINUSE` and silently reconnects.
- `stop()` can now terminate an adopted backend: `killProcessOnPort` resolves the
  owning PID(s) (`netstat`/`taskkill /T /F` on Windows; `lsof`/`ss` + `kill` on
  POSIX) and kills the whole tree, so the previously-unstoppable orphan cycle is
  closed. New `src/backend/port-utils.ts` (`probePort`, `killProcessOnPort`,
  `portFromServerUrl`).
- `BackendProcessState` running variant gained an `external?: boolean` flag.

### Fixed — Windows backend stop no longer orphans the MCP child (2026-07-02)

- `ChatobbyBackendProcess.stop()` now uses `taskkill /PID <pid> /T /F` on Windows,
  killing the backend AND its spawned MCP server together. Previously
  `child.kill("SIGTERM")` mapped to a single-PID `TerminateProcess`, leaving the
  MCP child orphaned (reproduced live). POSIX keeps the SIGTERM → SIGKILL path.

### Removed (2026-07-02)

- Removed the **"Toggle backend"** command and `ChatobbyPlugin.toggleBackend()`.
  Use **"Start backend"** / **"Stop backend"** instead.

### Fixed — Obsidian MCP bridge contract drift (2026-07-02)

- Fixed core bridge results so `obsidian_get_context` and `obsidian_list_entries` return MCP-compatible note/entry refs with required `basename` fields.
- Accepted current backend MCP argument names for plugin-native and retrieval tools, including free-text `obsidian_vault_explore`, `fromRef`/`toRef`, `sourcePath`/`targetPath`, `startPath`, and `commandId`.

### Changed — Feed work-summary folding (2026-07-02)

- Changed assistant-run folding so prior thinking/tool/intermediate text blocks compress into a
  single "Worked for X" summary only after `message_end` confirms a final non-`toolUse` response.
  Each assistant message now gets a fresh block scope so repeated `contentIndex: 0` thoughts do
  not merge. Tool execution events patch by `toolCallId` and only use `contentIndex` when present,
  preventing later tools/results from disappearing into earlier tool blocks.
- Fixed tool grouping for repeated assistant calls by making `toolCallId` the only global tool
  identity. `contentIndex` is now scoped to the active assistant message only, so later tool calls
  no longer append to the first tool block when multiple attempts reuse the same content index.
- Changed live intermediate assistant calls so their completed thinking/tool blocks compact
  immediately into one per-call line such as "Thought for 2s · called 2 tools", while non-final
  text stays visible until the final response folds prior work into the run summary.
- Fixed a UI state bug where summary/thinking/tool expansions closed on the next streaming render;
  expansion now persists in `FeedState` for summaries, nested tool groups, tool rows, and thinking
  blocks.
- Fixed the toolbar elapsed-time badge so it disappears when a run finishes instead of showing the
  last completed duration forever.
- Normalized chevron behavior across summary, thinking, and tool rows, and adjusted markdown list
  styling so list markers are part of selectable text flow.
- Added `docs/feed-rendering-flow.md` as the working reference for feed data structures, event
  routes, identity rules, and work-summary folding.

### Changed — Backend functionality exposure + remaining UI features (2026-07-02)

Goal: wire up everything the backend exposes so only UI/UI-state design remains. Build + 286
tests green; verified live via `obsidian plugin:reload` + `dev:screenshot` + CLI command listing.

- **Every backend command is now reachable.** Registered 12 new Obsidian commands (CLI/palette):
  `rename-session`, `clone-session`, `fork` (with a fuzzy fork-point picker via `get_fork_messages`),
  `import-jsonl`, `export-html`, `export-jsonl`, `bash` (into agent context), `copy-last-response`
  (`get_last_assistant_text`), `toggle-auto-compaction`, `queue-follow-up`, `focus-chat`,
  `focus-editor`. New `ui/modals.ts` (`PromptModal` + `PickModal`) gives these a minimal text-input
  / fuzzy-picker UI; polished in-feed UI is deferred. The transport already wrapped all 29 commands.
- **Every backend event is now handled.** `queue_update` (steer/follow-up queues), `thinking_level_changed` (syncs the picker + persists), `auto_retry_start/end` (notice + flag),
  and `autoCompactionEnabled` (synced from `get_state`) all flow into `SessionState` via new
  `SessionEvent` variants in `transitions.ts`.
- **Turn-duration meta (#14).** Turns are timed plugin-side (`FeedState.turnStartMs` → `turnMs` at
  fold); shown adaptively (`12s` / `1m 23s`) on the turn-summary and as a muted footer on text-only
  responses. Snapshot-built turns (wall-time ≈ 0) are filtered out.
- **Slash-command autocomplete (#15).** New `SlashMenu` pops above the composer on a leading
  `/query`; lists recognized backend commands (name + description + source badge) from `getCommands()`; ↑/↓/Enter/Tab/Escape driven; non-matches show a "sent as-is" empty state.
- **Steer/follow-up acknowledgment (#17).** Mid-turn steers and queued follow-ups render as a
  distinct badged block whose state advances **pending → queued → applied** via `queue_update`, so
  the user knows their message was sent, accepted, and ingested. Steers finalize on turn completion.
- **Note-edit diff views (#18).** The bridge `note.edit` op now attaches a unified diff
  (`src/utils/diff.ts`, LCS-based, with context windows); it round-trips back to the edit tool's
  detail view, which renders hunks with `@@` range headers, +/- coloring, and `⋯ N lines hidden`
  separators between far-apart changes. Diff correctness is unit-tested.
- **Keyboard:** Enter steers a running turn; Escape stops a running turn (text preserved) or clears
  the draft when idle; send is disabled when the box is empty. (Carried from v2.)

### Changed — Frontend pass v2: scoped folding, tool UI, send/stop, token meter (2026-07-02)

Continuation of the frontend pass, driven by live feedback. `npm run build` + `npm run test`
green (281 tests). Verified live via `obsidian dev:screenshot` + `plugin:reload`.

- **Fixed the folding bug correctly (responses are never folded).** The first pass removed
  folding entirely; the correct behavior is: **thinking** and **tool calls** fold as they finish,
  then roll up into one collapsible "Thought for Xs · read 3 files · edited 1" line when the
  response lands — but the **response text** stays rendered as markdown forever. Previously the
  whole turn (incl. text) was folded into a `TurnSummary` that re-rendered the response as plain
  text, which was the "markdown vanishes on the next prompt" bug. `foldTurnDetails()` now folds
  thinking+tools only; `TurnSummaryView` re-renders children via `ThinkingBlockView`/
  `ToolBlockView` (markdown + rows), never plain text. Thinking blocks record `startedAt`/
  `durationMs` for the "Thought for Xs" label. Regression tests added.
- **Redesigned tool output.** Replaced the 8 near-identical `*-renderer.ts` stubs (which dumped
  args/result as plain text) with one `tools/format.ts` (`primaryArgument`, `categoryIcon`,
  `renderToolDetail` with truncation). `ToolItemView` is now a compact icon row
  (category icon + name + primary arg + status dot + copy + chevron) that expands to a formatted
  `<pre>` result. Real CSS for `.chatobby-tool-block`/`.chatobby-tool-item` (was entirely
  unstyled — that's why tool output looked raw).
- **Morphing send/stop button.** One accent circle: arrow-up (send) when idle, square (stop) only
  while a turn runs. Stop is no longer shown at rest (the old `isStopAvailable()` counted a
  connected transport as "stoppable"). Send disabled when the box is empty.
- **Keyboard:** Enter steers a running turn (mid-generation correction via `transport.steer`),
  not a new prompt; Escape stops a running turn (text preserved) or clears the draft when idle.
- **Toolbar → connection dot + token/context meter.** Removed the redundant "Ready"/"Generating"
  text box; the dot pulses while streaming, and a meter shows live tokens + context-window fill
  (from `getSessionStats()`: `tokens.total` + `contextUsage.percent`), pulled on connect and after
  each turn. Session tabs now show the **session name** (via `session_info_changed` /
  `WsSessionState.sessionName`, fallback "New chat") instead of the raw UUID.
- **New commands:** `chatobby:focus-chat` (focus the message box) and `chatobby:focus-editor`
  (return focus to the active note) for a keyboard loop between note and agent.
- Friendlier placeholder: "Send a message…  type / for commands".

### Changed — Frontend pass: streaming fix, composer controls, commands (2026-07-02)

A full frontend UI/UX pass. `npm run build` + `npm run test` green (276 tests).

- **Fixed streaming token-per-block bug (root cause: type-stub drift).** Streaming responses
  rendered one token per block ("you" / "'re" / "working" …) instead of accumulating into one
  assistant bubble. The plugin narrowed the wire-level `assistantMessageEvent: unknown` with a
  hand-maintained stub that read `event.index`; the real backend field is `contentIndex`
  (`pi-mono/packages/ai/src/types.ts:456`), so `event.index` was `undefined` and every delta
  pushed a new block. Markdown was always rendered — it only looked like plain text because each
  block held one token. Same drift also broke `toolcall_delta` (`argumentsDelta` → `delta`).
- **Eliminated `src/stubs/` entirely.** The plugin now owns its agent domain types locally in
  `src/types/agent.ts` (content blocks, messages, a correct `AssistantMessageEvent` with
  `contentIndex`/`delta`/`partial`, and the `AgentEvent` union), and consumes the vendored wire
  envelope from `src/vendor/chatobby-client/`. Deleted `@earendil-works/pi-agent-core`,
  `@earendil-works/pi-ai`, and the dead self-referential `@chatobby/chatobby` stubs; removed the
  `@earendil-works/*` `tsconfig` path mappings and esbuild `external` entry. The wire layer's
  deliberate `assistantMessageEvent: unknown` is now narrowed by plugin-owned types, killing the
  drift class of bug at the root.
- **Redesigned the composer with inline controls.** Replaced the floating `SessionControls` gear
  popover (deleted `src/ui/session-controls.ts`) with a new `src/ui/composer-controls.ts` row
  inside the composer card: a **provider filter** + **model picker** fed by
  `transport.getAvailableModels()` (finally wired up — `WsModelInfo` carries `provider`), plus
  **thinking-level** and **permission-mode** pickers. No more memorizing model names. The
  duplicate model display is gone — the toolbar now shows connection + status only.
- **Redesigned settings provider rows.** Removed the hardcoded
  `DEFAULT_PROVIDER_ROWS = ["anthropic","openai"]` that always showed those two even when
  unconfigured; the Credentials section now shows only configured providers, with "Add provider"
  as the primary affordance (plus a known-providers suggestion datalist).
- **Visual pass — responses read like a note.** Feed surface is `--background-secondary`
  (matching the surrounding pane/note background); assistant text blocks are borderless/
  transparent (flowing note content) instead of grayish boxes. Send button is now a filled accent circle with a clear arrow icon (it previously
  rendered as a dot — icon had no contrast against a backgroundless button). New
  `.chatobby-composer-bar`/`.chatobby-composer-controls` styles; dead `.chatobby-controls*`
  popover CSS removed.
- **Commands + `obsidian://chatobby` handler for CLI live testing.** Registered a command set the
  `obsidian` CLI enumerates (`open`, `new-session`, `send-prompt`, `abort`, `cycle-model`,
  `cycle-thinking`, `compact`, `reload`, `toggle-backend`) plus an `obsidian://chatobby` protocol
  handler so a specific prompt can be injected from a shell
  (`Start-Process "obsidian://chatobby?prompt=…&model=…"`).
- **Note:** `permissionMode` is plugin-local only for now — the backend exposes no permission
  command and `new_session` takes no options, so the picker persists the preference (labeled
  "backend wiring pending") but does not yet push it to the server.
- Tests: added feed-reducer regression coverage for same-`contentIndex` accumulation and
  post-`text_end` block separation; updated existing fixtures to the real `contentIndex` shape.

### Fixed — Frontend UI pass (2026-07-02)

- Fixed feed layout ownership so the shell frames the feed while `FeedRenderer` owns the scrollable surface.
- Added stable feed content width/min-width rules and safer markdown wrapping so blocks no longer collapse into a few-character column.
- Hid the "Latest" jump pill on first render and kept it synced when feed state is restored programmatically.
- Stopped auto-connecting to `localhost:9222` when the managed backend is toggled off; connection failures now log instead of spamming Obsidian notices.
- Made the toolbar show explicit stopped/connecting/connected/error labels instead of collapsing to a bare status dot when no session exists.

### Fixed — Composer stop control (2026-07-02)

- Kept the stop button available whenever the transport can accept an abort, including the prompt handoff before `agent_start`.
- Added local prompt-in-flight state so send is disabled and stop remains reachable while a prompt command is pending.
- Routed empty-input Escape through the same abort availability check and fixed composer state initialization to avoid shared mutable defaults.
- Added focused composer regression coverage for connected idle, prompt-in-flight, Escape abort, and streaming states.

### Fixed — Frontend WebSocket lifecycle (2026-07-02)

- Made `ChatobbyTransport.connect()` idempotent so repeated view opens, backend toggles, or concurrent connect calls reuse the active socket instead of replacing it with a new `CONNECTING` client.
- Disabled the vendored `ChatobbyWsClient` hidden reconnect loop under the plugin wrapper and routed unexpected closes through the plugin-owned connection state machine.
- Preserved extension UI handlers registered before the socket exists, preventing `select`/`confirm`/`input`/`editor` callbacks from being dropped on first connect.
- Added transport regression coverage for duplicate connect suppression and pre-connect extension UI registration.

### Changed — Backend toggle and prompt boundary (2026-07-01)

- Added a `Toggle Chatobby backend` Obsidian command backed by a managed process controller. Toggling off aborts active work, disconnects the bridge and WebSocket transport, then stops the managed backend process.
- Added persisted backend command/argument settings so the current `chatobby` bin can later be replaced by the packaged executable without changing the plugin flow.
- Moved vault context gathering and prompt formatting from `src/ui/context/` to `src/prompt/`; UI shows the raw submitted prompt while the backend receives the structured context-wrapped prompt.
- Kept bridge connection failures internal to console logging; no user-visible bridge status UI was added.

### Changed — FeedRenderer live migration (2026-07-01)

- Replaced the dual `ConversationRenderer`/`FeedRenderer` path with a single block-based
  `FeedRenderer`; removed the `FEED_RENDERER_ENABLED` migration flag and deleted the old
  renderer source.
- Added stable feed block/turn/message ids, prompt echo suppression, server-user `SystemBlock`
  routing, compaction markers, and automatic `TurnSummary` creation in `feed-reducer.ts`.
- Wired basic inline extension UI cards (`select`, `confirm`, `input`, `editor`) into the feed
  so blocking backend UI requests resolve through the existing WebSocket response flow.
- Expanded feed reducer, renderer, and interaction-card tests; full suite remains green.

### Changed — Vendored Chatobby client wiring (2026-07-01)

- The Obsidian transport now imports `ChatobbyWsClient` from the generated
  `src/vendor/chatobby-client/ws-client.js` artifact instead of the external
  `@chatobby/chatobby/client` stub path, so `main.js` bundles the WebSocket SDK.
- Wired the real `onBridgeConfig()` SDK callback through `ChatobbyTransport` to
  the bridge client handoff path. Updated backend-sync/bundling docs to make the
  vendored-client workflow explicit.

### Added — PluginAuthStorage local helper (2026-06-30)

- `PluginAuthStorage` local helper (`src/credentials/auth-storage.ts`): dependency-free,
  atomic-write credential I/O for `~/.pi/agent/auth.json`. Same path resolution (incl.
  `PI_CODING_AGENT_DIR`), same `0o600` mode, same JSON shape as the server's `AuthStorage`.
- Full test suite in `tests/credentials/auth-storage.test.ts` covering set/remove/merge,
  OAuth-clobber regression, corrupt-file safety, env-override path resolution, and atomicity.

### Changed — AuthStorage replaced with local helper (2026-06-30)

- Credential writes now go through `PluginAuthStorage` instead of `AuthStorage` from
  `@earendil-works/pi-coding-agent`. Locking is now atomic temp+rename (documented tradeoff)
  instead of `proper-lockfile`.
- Removed `@earendil-works/pi-coding-agent` type stub and tsconfig path mapping.
- Updated all docs (`credentials.md`, `CLAUDE.md`, `AGENTS.md`, `responsibility-boundaries.md`,
  `schemas.md`, `backend-sync.md`, `main-ui-implementation-plan.md`).

### Changed — Obsidian MCP tool-name contract sync (2026-06-30)

- Mirrored the canonical 52-tool `obsidian_*` MCP catalog from
  `C:\chatobby\pi-mono\packages\chatobby-mcp-servers\chatobby-obsidian\docs\tools.md`
  into the runtime-vendored protocol as `mcp-tool-catalog.ts`.
- Added tool-name-to-operation maps for plugin-native, retrieval, CLI family, and CLI substrate
  tools, including `obsidian_get_capabilities`, `obsidian_file_history`,
  `obsidian_run_cli`, and `obsidian_read_cli_result`.
- Added a drift guard test that asserts the plugin catalog matches the backend tool-name constants,
  all mapped operations are implemented, the registered surface remains 52 canonical `obsidian_*`
  names, and excluded compatibility aliases stay out.
- Updated `docs/tooling/operation-catalog.md` from stale skeleton wording to the implemented
  direct/non-direct MCP tool surface.

### Added — Operation handlers + routing → E2E readiness (Phases 0–1) (2026-06-30)

Implemented every remaining bridge operation (all 52 static ops + dynamic `cli.native.*`)
and hardened command routing for real-backend conformance. Full plan mirrored into the repo
at `docs/tooling/e2e-readiness-plan.md`. `npm run build` + `npm run test` green (235 tests).

- **Phase 0 — conformance**: centralized terminal close codes into one exported
  `TERMINAL_CLOSE_CODES` and added **4002 (protocol error)** as terminal (was retryable →
  reconnect storm on any handshake drift). `bridge-client.ts` and `bridge-connection-state.ts`
  now share the constant. New `tests/obsidian-bridge/bridge-close-codes.test.ts`.
- **Phase 1 — routing refactor**: `operation-registry.ts` is now a single flat `HANDLERS` map
  (was a core map + three stub branches). `cli.native.*` dispatched dynamically. Adding an op
  is one line. Exports `listImplementedOperations()` for introspection + drift tests.
- **Phase 1 — plugin-native handlers (24)**: split into data ops
  (`plugin-native-operations.ts`: registry.status, metadata.get, properties.list,
  frontmatter.update, tags.list, links.generate/get/audit, graph.traverse, tasks.list/update,
  folder.create, entry.copy/move/trash, attachment.import) and runtime ops
  (`workspace-operations.ts`: editor.get/edit/focus, workspace.get/manage, commands.list/execute,
  hotkeys.list). Runtime ops degrade gracefully ("unavailable") when the Obsidian surface is absent.
- **Phase 1 — retrieval handlers (6)** with a real **lexical backend** over
  `metadataCache.resolvedLinks` (BFS neighborhood / shortest-path / degree ranking /
  connected components). Semantic backends detected from `enabledPlugins` and reported via
  `ObsidianRetrievalEnvelope` backend status + warnings; `partial: true` when lexical-only.
- **Phase 1 — CLI handlers (13)** via a bounded `execFile` (never shell): named subcommands
  (`cli.daily/sync/…`), `cli.result.read` (paged), `cli.run`, and dynamic `cli.native.*`.
  Injectable executor (`setCliExecutor`); error mapping `OBSIDIAN_CLI_NOT_FOUND` /
  `OBSIDIAN_CLI_FAILED` / `CLI_RESULT_NOT_FOUND`; `cli.run`/`cli.native.*` guarded against
  shell metacharacters and non-allowlisted binaries.
- **Phase 1 — helpers**: `helpers/frontmatter.ts` (bounded YAML read/merge/serialize),
  `helpers/tasks.ts` (checkbox parse/toggle), `helpers/retrieval-graph.ts` (graph algorithms),
  `helpers/cli-exec.ts` (bounded executor + injector), `helpers/binary.ts` (base64⇄ArrayBuffer,
  deduped from core-operations).
- **Capabilities**: `capabilities.ts` now advertises all 11 families (every op is implemented).
  Drift guarded by `tests/obsidian-bridge/capability-coverage.test.ts`.
- **Tests**: added `plugin-native-operations.test.ts`, `retrieval-operations.test.ts`,
  `cli-operations.test.ts`, helper tests (frontmatter/tasks/retrieval-graph), capability + close-code
  tests. Extended `mock-app.ts` (rich metadata cache, resolvedLinks, folder/trash/rename/createBinary,
  active editor view, commands, hotkeys, enabled plugins) — backward compatible.

### Added — UI scaffolding execution (2026-06-30)

Executed `docs/ui-scaffolding-plan.md` as a default-off scaffold pass.

- Added mountable `ChatobbyComponent` skeletons for feed blocks, interaction cards, tool items/renderers, session tabs, context preview/gatherers, and status widgets with stable `chatobby-*` class hooks.
- Added `FeedRenderer` and wired `ChatobbyView` host seams behind `FEED_RENDERER_ENABLED = false`, keeping the existing `ConversationRenderer` live path unchanged.
- Added provisional `VaultContext` types, context formatting, link-only image resolution, and vault session preference read/write helpers.
- Added `happy-dom`/Vitest UI smoke tests for component structure and host-call wiring; full suite remains green.
- Populated bridge Hello `enabledPlugins` from Obsidian's runtime plugin registry while retaining terminal `4503` no-retry behavior.

### Changed — Bridge Executor: §5 contract alignment + re-vendor (2026-06-30)

Backend §5 parity decisions landed; re-vendored `@chatobby/obsidian-protocol` and aligned the plugin.

- **Re-vendored protocol**: added `bridge-capabilities.ts`; updated `bridge-protocol.ts` (`hello.capabilities: ObsidianBridgeCapability[]`; parser rejects unknown values) and `bridge-errors.ts` (added `OPERATION_CANCELLED` — 16 codes now). Vendored specifiers kept extensionless (plugin tsconfig has no `allowImportingTsExtensions`).
- **§5.2 capabilities**: new `src/obsidian-bridge/capabilities.ts` advertises implemented families (`vault`, `attachments`) from the canonical 11-value union; `bridge-client.ts` `sendHello` uses it (replaces the inline `["context","notes","search","edit"]`, which would now trigger `4002`).
- **§5.1 connectionId**: unchanged — plugin already sends a UUID; backend now honors it as the registry key.
- **§5.3 cancel code**: `OPERATION_CANCELLED` is backend→MCP only (Phase 5); no plugin behavior change. Plugin still honors inbound `cancel` (abort) and stashes `cancelReason` on the in-flight entry for forward-compat.
- **D5 vault.id**: `vault-identity.ts` now sets `vault.id`/`vault.root` = `app.vault.adapter.getBasePath()`, `vault.name` = display name (was: name-as-id, which risked `4000`/`OBSIDIAN_VAULT_AMBIGUOUS`).
- **D1/D2/D7**: `capabilities.ts` module added (D1); module names kept (`operation-registry`/`bridge-router`) — backend §7 names are a suggested structure, not a conformance gate (D2); vendoring satisfies §7 "bundle" intent (D7).
- Mock-app harness updated to provide `adapter.getBasePath` + `getName`.

### Docs — UI scaffolding plan (2026-06-30)

Added `docs/ui-scaffolding-plan.md` — an executor-ready, non-locking buff-out plan for the UI
component API surface. Fills the ~38 empty UI stubs with a real `ChatobbyComponent` contract
(host interface + typed methods + stable `chatobby-*` class hooks) across `feed/`, `feed/tools/`,
`session/`, `context/`, and `status/`; defers `diff/` and `voice/` (Phase 7).

- **Signature + class hooks depth**: skeletons produce stable BEM class hooks (no CSS, no
  logic) so the next pass (frontend design + component state handling) can target them in tests.
- **`ConversationRenderer → FeedRenderer` migration**: begun behind a `FEED_RENDERER_ENABLED`
  flag (default off — live chat unchanged). Three reversible stages (additive → wire-behind-flag
  → retire). Full event→block dispatch surface specified; reducer logic deferred to the visual pass.
- **Host seams**: four new interfaces (`FeedHost`, `TabBarHost`, `InteractionHost`,
  `ContextHost`) for `ChatobbyView` to implement as stub methods; `FeedHost` supersedes `RendererHost`.
- **Test contract**: `happy-dom` env via `vitest` `environmentMatchGlobs` (composed with the
  concurrent bridge-executor's node tests), `tests/ui/` mirroring `src/ui/`, mock-host/mount
  helpers, skeleton-level assertions (structure + no-throw + host-call wiring).
- **10 provisional decisions flagged** for the visual pass to revisit (SystemBlock variant,
  category-renderer shape, InteractionCard base class, block-as-component, etc.).
- Reuses the locked `types.ts` shapes verbatim; adds a provisional `VaultContext` type for the
  `context/` contract.

### Added — Bridge Executor (2026-06-30)

Implemented the bridge executor scaffold — the plugin as vault-data provider for server-side `obsidian_*` MCP tools.

- **Vendored `@chatobby/obsidian-protocol`**: 7 browser-safe `.ts` sources copied into `src/vendor/@chatobby/obsidian-protocol/` and bundled into `main.js` by esbuild. Runtime parsers/validators (`parseServerToPluginMessage`, `parseBridgeErrorPayload`, `isOperationName`, operation/error sets) — not type-only stubs.
- **Bridge client** (`src/obsidian-bridge/bridge-client.ts`): 2nd WebSocket to bridge endpoint; lifecycle, Hello, ping/pong, in-flight table, reconnect with exponential backoff.
- **Bridge connection state machine** (`src/obsidian-bridge/bridge-connection-state.ts`): pure state transitions; close-code routing (4000/4401/4503 → terminal, 4003/transient → retry-eligible).
- **Bridge router** (`src/obsidian-bridge/bridge-router.ts`): parse inbound frames → dispatch to operation registry → serialize outbound result/error.
- **Operation registry** (`src/obsidian-bridge/operation-registry.ts`): `executeOperation()` with `isOperationName` allowlist, family dispatch, deadline enforcement.
- **Core 10 operations** (`src/obsidian-bridge/operations/core-operations.ts`): `context.get`, `note.read`, `vault.search`, `note.resolve`, `attachment.read`, `vault.list`, `note.write`, `note.edit`, `note.open`, `app.open` — all implemented with Obsidian APIs.
- **Operation helpers**: `paging.ts` (ported from chaude `read-tools.ts`), `vault-identity.ts`, `note-io.ts` (read/write/edit/resolve/list), `search.ts` (ported from chaude `read-tools.ts`).
- **Skeleton operations**: plugin-native (23), retrieval (6), CLI (11+) — all return `UNSUPPORTED_OPERATION` until their phase implements them.
- **Auth handoff**: `bridge_config` top-level server→client frame; `ChatobbyTransport.onBridgeConfig()`; `main.ts` tears down + reconnects on new config.
- **Bridge constants**: `BRIDGE_PING_INTERVAL_MS`, `BRIDGE_DEFAULT_DEADLINE_MS`, `BRIDGE_REQUEST_TIMEOUT_MS`, `BRIDGE_CLI_RESULT_PAGE_BYTES` added to `src/ui/constants.ts`.
- **Type stub update**: `WsBridgeConfig` added to `src/stubs/@chatobby/chatobby/index.d.ts`.
- **tsconfig + esbuild**: `@chatobby/obsidian-protocol` path mapping added; esbuild documents vendored (not external) package.
- **Tests** (94 total, all passing): bridge-connection-state, bridge-router, operation-registry, error-mapping, paging, core-operations against mock App.
- **Documentation**: `docs/tooling/bridge-executor.md` (architecture), `docs/tooling/operation-catalog.md` (49+ operations), `docs/tooling/bridge-routing.md` (flow diagrams).
- **Updated docs**: `CLAUDE.md` (Backend Package Map, Responsibility Boundaries, Documentation table, vendor convention), `CHANGELOG.md`.

### Docs — backend API sync (2026-06-30)

Synced plugin docs to the current `pi-mono` backend after auditing the consumed API surfaces.

- **Credentials import corrected**: removed the fictional `@chatobby/chatobby/credentials` subpath (`setApiKey` / `removeApiKey` / `listProviders`, and the `./credentials` package export). That subpath was never implemented — `@chatobby/chatobby` exports only `.` and `./client`. Replaced with the real `AuthStorage` class from `@earendil-works/pi-coding-agent` (`AuthStorage.create()` / `auth.set()` / `auth.remove()` / `auth.getAll()`), which is what the server itself uses (same `0o600` locking and path). Updated `CLAUDE.md`, `docs/credentials.md`, `docs/schemas.md`, `docs/responsibility-boundaries.md`.
- **Backend packages documented**: added a Backend Package Map to `CLAUDE.md` and expanded the protocol source table. The backend now ships three packages the plugin docs hadn't acknowledged: `@chatobby/pi-obsidian-agent` (Obsidian agent SDK — type origin for `AgentSessionEvent` / `AgentMessage` / `ThinkingLevel`, consumed by ws-types.ts; server-side), `@chatobby/obsidian-protocol` (browser-safe Obsidian bridge protocol — **not wired into the WS server yet**, a future plugin import), and `chatobby-mcp-servers` (standalone server-side MCP processes spawned by pi-mcp-adapter). Plugin consumes none of these at runtime today.
- **Settings shape aligned with code**: `configuredProviders: string[]` → `providerKeys: Record<string, boolean>` to match `src/types.ts` (`PluginSettings.providerKeys`).
- **Added `docs/backend-sync.md`**: runbook capturing the backend source files to read, the audit checklist, and the gotchas from this pass, so future re-syncs are fast. Linked from `CLAUDE.md`.
- **Verified accurate, no change needed**: the 29 WS commands (stub matches `ws-types.ts`/`ws-client.ts` exactly), the `AgentSessionEvent` stream (`agent_start`, `turn_start/end`, `message_start/update/end`, `tool_execution_start/update/end`, `queue_update`, `compaction_start/end`, `session_info_changed`, `thinking_level_changed`, `auto_retry_start/end`, `agent_end`), and the 7 extension UI methods (`select`/`confirm`/`input`/`editor`/`notify`/`setWidget`/`setTitle`). The `text_delta`/`thinking_delta`/`toolcall_delta` families are the nested `AssistantMessageEvent` inside `message_update`, not top-level events.

### Added
- `docs/obsidian-css-variables.md` — comprehensive Obsidian CSS variable reference with chatobby usage mapping
- `docs/ui-design-concepts.md` — semantic design patterns from chaude analysis (favourable vs unfavourable)
- `docs/chatobby-style-plan.md` — authoritative CSS architecture and style plan for chatobby

### Added
- Phase 0 foundation: types, constants, base component class, utils, state machines, transport wrapper
- Three-layer state model: PluginSettings (infrastructure), SessionPreferences (session defaults), SessionState (server-authoritative)
- Pure state machine functions for connection and session lifecycles
- ChatobbyTransport wrapping ChatobbyWsClient with connection state machine and event subscription
- ViewShell pure DOM factory with ShellHandlers callback interface
- Toolbar component displaying connection status and session info
- ConversationRenderer with streaming message accumulation, scroll management, and markdown rendering
- Composer with send/stop toggle, keyboard shortcuts, and model label
- SessionControls popover with model and thinking level controls
- ChatobbyView orchestrator wiring all components together
- Type stubs for backend packages (@chatobby/chatobby, @earendil-works/pi-agent-core, @earendil-works/pi-ai)
- Unit tests for connection and session state machines (17 tests)

### Changed
- Plugin settings now separate infrastructure (PluginSettings) from session defaults (SessionPreferences)
- Model and thinking level are managed by SessionControls popover, NOT the settings tab
- Active tools left as server defaults — plugin does not manage them
- Credential management uses full per-provider forms (add/change/remove API key)
- Backend stubs and protocol docs now track `AgentSessionEvent`, direct `ChatobbyWsClient` return values, and the current attachment blocker.

### Fixed
- Consolidated loadData/saveData into single read/write cycle to avoid race conditions
- Added missing `.catch()` on async void calls (transport.connect, transport.prompt, transport.disconnect)
- Cleaned up transport subscription lifecycle (connection + event listeners properly unsubscribed on view close)
- Removed unused imports (transitionConnection, SCROLL_BOTTOM_THRESHOLD_PX, STREAM_RENDER_DEBOUNCE_MS)
- Fixed MarkdownRenderer.render call signature (added missing app parameter)

### Added (docs)
- Feature ideation document (`docs/feature-ideation.md`) — 67 features mapped from chaude's 58-feature inventory + industry patterns, categorized as PORT/PORT+MODIFY/NEW/SERVER with 6-phase implementation plan
- Vault & directory-based session preferences design spec (`docs/vault-session-prefs.md`) — supersedes previous "seed from previous tab" rules
- Session creation now resolves prefs via walk-up directory hierarchy from `.chatobby/session-dirs.json`
- DirectoryPickerModal (FuzzySuggestModal) for vault folder selection on "from directory" session creation
- Added `vault-prefs.ts` and `directory-picker.ts` to target directory tree and responsibility map
- Added VaultSessionConfig and DirectoryPrefs types to State Model section

### Changed
- Session tab architecture: each tab owns a complete state snapshot (SessionTab) — switching tabs swaps messages, composer text, permission mode, feed scroll, streaming state
- New session creation resolves preferences from `.chatobby/session-dirs.json` via walk-up directory hierarchy (supersedes "seed from previous tab" — see `docs/vault-session-prefs.md`)
- SessionPreferences now includes permissionMode field
- FeedState now includes scrollTop for per-tab scroll preservation
- Host slash commands: removed /interrupt (abort handled by stop button), /claude (not applicable), and /profile (not applicable)
- UI state guide updated with SessionTab architecture and tab switching behavior
- Renamed `state-machines.ts` to `transitions.ts` — connection transitions are a genuine state machine, session transitions are an event reducer (not a state machine)
- `transitionSession` renamed to `applySessionEvent` to reflect its actual purpose
- ComposerCard: session controls (model, thinking, permission) are now children of the composer card, not a floating popover
- Responsive layout architecture: CSS container queries (`container-type: inline-size`) with three modes: full (≥900px), narrow (500-899px), compact (<500px)
- Extension UI blocking requests (select, confirm, input, editor) rendered as InteractionCard in the feed instead of Obsidian Modals
- InteractionCard is a pure display component — view owns interaction state, composer delegates keystrokes when interaction is active
- Added InteractionState type and createInteractionState factory
- SessionTab now includes activeInteraction field (null when idle)
- Feed block system: raw AssistantMessage.content[] grouped into visual blocks (ThinkingBlock, ToolBlock, TextBlock, UserBlock, TurnSummary)
- Each block owns its own streaming state and lifecycle (streaming → complete → compacted)
- ToolBlock tracks individual ToolItem statuses (pending → running → done/error)
- Turn compaction: completed blocks compress to TurnSummary ("Thought for 5s, read 4 files")
- Removed StreamingState — block system replaces it (each block tracks its own streaming data)
- Imported StopReason and UserMessage types from backend stubs
- Tool categories: ToolCategory type (read/edit/write/bash/search/note/git/task/metadata/other) with classifyTool() function
- Each ToolItem has category field and isExpanded field for independent expand/collapse
- ThinkingBlock: ThinkingDisplayMode (expanded/collapsed/hidden) with per-block override of global setting
- Collapsed-during-streaming: shows latest line only, flushed from latest word boundary
- Tool-specific UI: each category renders different collapsed/expanded views (diffs, output, file content, etc.)
- Tool interactions: click to expand/collapse, copy button, clickable file paths, error details, duration display
- Feed interactions: block-level copy, keyboard navigation (Ctrl+↑/↓), tool output truncation, vault link decoration
- Source structure section in ui-state-guide.md — full directory tree with responsibility map for every file
- ui-state-guide.md reconciled with actual implementation: component tree shows current vs target architecture with ✅/🔲 markers
- ui-state-guide.md fixed Layer 4 FeedState to show current `{ isAtBottom }` and target block-based form
- ui-state-guide.md extension UI handler shows both current (Modals) and target (InteractionCards) implementations
- ui-state-guide.md data routing uses `applySessionEvent` (was `transitionSession`)
- Interaction System, Feed Block System, Session Tab Architecture, Responsive Layout sections marked as 🔲 Planned in guide
- Block-based CSS class names added to CSS Naming Convention
- CLAUDE.md Source Structure replaced with pointer to docs/ui-state-guide.md (implementation status tracking belongs in docs, not agent instructions)
- CLAUDE.md Extension UI table updated to show target InteractionCard rendering
- ui-state-guide.md Source Structure expanded: current layout + full target directory tree with 8 new directories (feed/, session/, interaction/, context/, diff/, voice/, status/, feed/tools/) and 35+ planned files
- ui-state-guide.md Responsibility map expanded to cover all planned files across all directories
- Interaction files moved from `ui/interaction/` into `ui/feed/` — InteractionCards are blocks in the feed, not a separate concern
- Compaction moved from `status/compaction-banner.ts` to `feed/compaction-block.ts` — inline in feed, not a status overlay
- Activity indicator clarified: same `tool_execution_*` events as feed blocks, not a separate data source
- Added CompactionBlock type to types.ts — inline in feed, driven by isCompacting state
- Updated view.ts: extension UI handler now routes notify/setTitle (fire-and-forget) and logs blocking methods as stubs
- Updated all source files with target architecture comments pointing to docs/ui-state-guide.md
- FeedBlock union now includes CompactionBlock
- Streaming render: replaced single `STREAM_RENDER_DEBOUNCE_MS` with per-type constants (thinking 250ms, text 60ms, toolcall 0ms)
- Streaming render: segment-based incremental rendering design — ContentSegment per content index, only active segment rebuilds, frozen segments untouched
- Added `feed/streaming-segment.ts` to target directory tree and responsibility map
- ui-state-guide.md: full Streaming Text Rendering rewrite with segment architecture, per-type debounce, freeze semantics, event routing table
- Fixed SessionPreferences State Model to include `permissionMode` field
- Added `turn_start`/`turn_end` to Mapping AgentEvents with lifecycle comments
- `message_start` now documented with role-based routing (UserMessage/AssistantMessage/ToolResultMessage)
- Fixed `toolcall_end` event routing: "build interaction DOM" → "create/update ToolItem in ToolBlock"
- `feed/blocks.ts` clarified: grouping logic only, types stay in `types.ts`
- Fixed `STREAM_DEBOUNCE_MS` in StreamingMessage code to use per-type constants
- Updated `FeedState` in State Model to match `types.ts` (blocks, isAtBottom, scrollTop)
- Added interaction mode to composer responsibility map
- CompactionBlock lifecycle clarified: both manual/auto triggers, view watches `isCompacting`, stays visible as "Session compacted" marker
- UserMessage routing: user's own message rendered at send time as UserBlock; all server `UserMessage`s are SystemBlock (no matching needed)
- Added SystemBlock type — server-injected user-role messages (subagent input, context), visually muted
- Added SystemBlock to FeedBlock union, block-to-DOM mapping, CSS classes
- Fixed CompactionBlock description in types.ts: "disappears" → "updates to Session compacted"
- Fixed schemas.md: turn_end and message_start descriptions updated for role-based routing
- Fixed wire-protocol.md: added turn_start, updated message_start/turn_end/tool_execution_end descriptions
- Fixed view.ts target comment: added UserBlock, SystemBlock to block list
- Implementation phases document (`docs/implementation-phases.md`) — 7 phases with dependency graph, done-when criteria, and per-file scope
- Initialized full project directory structure: 40 skeleton files across feed/, feed/tools/, context/, diff/, voice/, status/, session/
- Fixed ui-state-guide discrepancies: removed phantom `renderDiffLines()` from utils.ts, added `conversation-renderer.ts` to responsibility map, clarified view.ts owns flat SessionState (not tab map), marked vault-prefs/directory-picker as partially implemented, fixed vault-prefs param signatures, clarified Component Architecture as target vs current, added stubs `client/` nesting, split data routing into current/target
