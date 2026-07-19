# Chatobby 0.1.8 public alpha

This release makes early cancellation durable, completes the installed-user
Context Query workflow, and improves the polish of resumed sessions and the
Queries page.

## What changed

- Pressing Escape before a tool starts or assistant output completes can return
  the submitted message to the composer. The message is removed from the feed
  and from the active durable conversation branch.
- Prompt recovery is event-driven and submission-scoped rather than based on a
  timing window, preventing send-time flashes and stale Stop controls.
- Down Arrow moves forward through recalled messages. A separate configurable
  shortcut restores a stashed draft when the composer is empty.
- Context Queries run through the installed Chatobby runtime, expose a bounded
  project-data SDK, persist exact-source test state, and do not require access
  to Chatobby source code or a separately installed Node.js runtime.
- The Queries page is more compact, responsive, and consistent with the rest of
  Chatobby. Session resume now shows an accessible animated loading state.
- The public README and user guides now cover providers, project guidance,
  Context Queries, subagents, workflows, Events, permissions, privacy, and the
  normal in-plugin runtime installation flow.
- Runtime-owned safety guidance remains active independently of editable project
  prompt sections.

## Verification

- All 697 connector tests pass.
- TypeScript, architecture, public API, and release-boundary checks pass.
- Focused runtime tests cover Context Query execution, persisted approval,
  prompt retraction before and after commit boundaries, and reload behavior.
- Release assets are minified, source-map free, and limited to `main.js`,
  `manifest.json`, and `styles.css`.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
