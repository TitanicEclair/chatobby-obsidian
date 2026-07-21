# Chatobby 0.1.13 public alpha

Chatobby 0.1.13 keeps the Community plugin aligned with Runtime 0.1.13 and
focuses on session continuity, compaction feedback, and live page updates.

> **Paired update:** update the Community plugin first. Chatobby will then offer
> to install the matching signed Runtime 0.1.13 package. Plugin 0.1.12 and
> Runtime 0.1.12 continue to work together unchanged.

## What changed

- Fixed the active-note excerpt so the agent receives useful cursor, selection,
  heading, and nearby-text context from the live editor buffer.
- Added a compact, durable compaction activity row with the requested focus,
  elapsed time, completion state, and working Stop control. `/compact <focus>`
  now forwards the focus instead of leaving it in the composer.
- Made clone store-only and made fork create and focus a distinct Chatobby view
  without replacing the originating session.
- Reused an empty Chatobby view when resuming a session, kept focus on a newly
  opened resumed view, and added consistent loading feedback for session
  resume, fork, and clone transitions.
- Updated session directories, vault folders, memories, permission policies,
  queries, and related pages from live domain changes rather than requiring a
  navigation round trip.
- Prevented early-cancelled prompts from flashing, remaining in the feed, or
  leaving the composer in a working state.
- Kept subagent rail and main-turn lifecycle updates responsive while child
  transcript traffic is streaming.
- Updated the public description and version compatibility map through 0.1.13.

## Verification

- Connector TypeScript, architecture, public API, and release-boundary checks
  pass.
- All 719 connector tests pass.
- The release build contains exactly `main.js`, `manifest.json`, and
  `styles.css`; it is minified, source-map-free, and embeds only the runtime
  public verification key.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
