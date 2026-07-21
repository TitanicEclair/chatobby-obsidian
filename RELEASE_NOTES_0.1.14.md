# Chatobby 0.1.14 public alpha

Chatobby 0.1.14 pairs with Runtime 0.1.14 and focuses on code safety, Obsidian
compatibility, and Community review quality without changing the product's
core workflows.

> **Paired update:** update the Community plugin first. Chatobby will then offer
> to install the matching signed Runtime 0.1.14 package. Plugin 0.1.13 and
> Runtime 0.1.13 continue to work together unchanged.

## What changed

- Replaced unsafe values at Obsidian, browser, runtime, and persisted-data
  boundaries with validated typed narrowing.
- Qualified timers, animation frames, WebSocket access, and window state for
  popup-window compatibility.
- Replaced native browser confirmations with themed Obsidian confirmation
  modals.
- Replaced unsafe file casts with native Obsidian checks plus compatible
  structural fallbacks for supported adapters and tests.
- Removed source CSS `!important` declarations through corrected cascade and
  selector specificity, including reduced-motion handling.
- Added the official Obsidian lint rules and a zero-warning review gate for
  future release candidates.
- Corrected the manifest description punctuation and published the 0.1.14
  compatibility entry.

## Verification

- Official Obsidian review lint passes with zero warnings.
- Connector TypeScript, architecture, public API, and release-boundary checks
  pass.
- All 719 connector tests pass.
- The release build contains exactly `main.js`, `manifest.json`, and
  `styles.css`; it is minified, source-map-free, and embeds only the runtime
  public verification key.
- The exact plugin and signed runtime candidate were installed and exercised in
  the disposable test vault before publication.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
