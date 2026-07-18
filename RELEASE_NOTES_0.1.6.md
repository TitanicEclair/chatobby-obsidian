# Chatobby 0.1.6 public alpha

This release focuses on dependable workflow and subagent execution, clearer
permission handling, reliable cancellation, and consistent Obsidian vault-root
operations.

## What changed

- Stop now responds immediately while bounded runtime cleanup continues, so a
  slow provider cannot leave the composer stuck in a running state.
- Subagent permission actions are routed to the exact requesting child and
  stale decisions cannot be applied to an unrelated or completed run.
- Vault entry listing now treats `.`, `./`, `.\\`, `/`, and the empty path as
  the same vault root while rejecting absolute paths and traversal attempts.
- The paired runtime previews undersized workflow token budgets with estimated
  input, response reserve, and a recommended minimum.
- Undersized subagent budgets are rejected before any model provider call, with
  zero provider usage and an actionable error.
- Equivalent explicit child permission policies no longer produce redundant
  override confirmations.
- The public guide now explains installation, permission policies, project
  guidance, Context Queries, skills, subagents, workflows, Events, and privacy
  in user-facing terms.

## Verification

- The source and architecture checks pass.
- All 652 connector tests pass.
- A live six-check regression run passed vault-root aliases, workflow budget
  preview, pre-provider budget rejection, unrestricted child execution, and
  permission-prompt expectations without modifying the test vault.
- Release assets are minified, source-map free, limited to `main.js`,
  `manifest.json`, and `styles.css`, and checked for local paths, credentials,
  signing material, and unexpected files.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
