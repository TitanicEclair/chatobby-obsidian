# Chatobby 0.1.13 public alpha

This candidate keeps the Community plugin aligned with Chatobby Runtime 0.1.13
and fixes operational gaps surfaced by live use of 0.1.12.

> **Paired update:** install this plugin update first; it offers to install the
> matching Runtime 0.1.13. Plugin 0.1.12 and Runtime 0.1.12 continue to work
> together unchanged.

## What changed

- **Fixed empty active-note excerpt.** The agent received an empty excerpt body
  every turn even for a note with content. The connector now reads the active
  markdown editor's live buffer and builds a real excerpt around the cursor
  (plus cursor, selection, and headings) — the same logic the bridge's
  `context.get` uses.
- **`/compact <focus>` now works.** The slash handler no longer discards its
  argument; it forwards the focus text to the runtime's compaction summarizer.
- Vendored `chatobby-client` artifacts synced from runtime 0.1.13.

## Verification

- TypeScript, public API, architecture, and release-boundary checks pass.
- All connector tests pass except one pre-existing, unrelated architecture
  assertion about the manifest description (present on the 0.1.12 release).
- A production-equivalent candidate is installed in a disposable test vault for
  manual verification before publication.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
