# Chatobby 0.1.10 public alpha

This release makes Obsidian Web Viewer tasks reliable and keeps the Community
plugin aligned with Chatobby Runtime 0.1.10.

## What changed

- Web Viewer pages can be opened directly to the left, right, above, or below
  the current workspace leaf.
- The connector waits for the embedded browser's `dom-ready` event before
  navigating, preventing a tab from being created while the operation reports
  failure.
- Browser and workspace tools now resolve the same stable Web Viewer leaf IDs.
- Exact final-URL waits complement partial URL matching for redirect-aware
  verification.
- Web Viewer metadata remains safe to read while a tab is attaching or loading.

## Verification

- TypeScript, public API, architecture, release-boundary, and connector tests
  pass.
- Live testing opened Example Domain in a left split, followed the Obsidian
  plugin-directory redirect, read both pages, and matched their leaf IDs across
  the browser and workspace tool families.
- The release build contains only `main.js`, `manifest.json`, and `styles.css`.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
