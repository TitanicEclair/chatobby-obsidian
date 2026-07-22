# Chatobby 0.1.15 public alpha

Chatobby 0.1.15 pairs with Runtime 0.1.15 and focuses on Community review
quality. It keeps the existing product workflows while making the connector's
reviewable source easier for automated and human reviewers to verify.

> **Paired update:** update the Community plugin first. Chatobby will then offer
> to install the matching signed Runtime 0.1.15 package. Plugin and Runtime
> versions must remain paired.

## What changed

- Replaced the generated untyped WebSocket client with the equivalent typed
  public client source, preserving protocol validation across the reviewable
  connector boundary.
- Removed the tracked generated stylesheet so Community review scans only the
  source styles; production builds still generate the required `styles.css`.
- Replaced the remaining direct feed DOM construction with Obsidian-compatible
  element helpers.
- Added searchable setting definitions while retaining the legacy settings-tab
  renderer for older supported Obsidian versions.
- Removed unfilled README media placeholders and added release gates that stop
  them or source `!important` declarations from returning.

## Candidate verification

- Official Obsidian review lint passes with zero warnings locally.
- Connector TypeScript, architecture, public API, and release-boundary checks
  pass.
- All 719 connector tests pass.
- Runtime type, distribution, browser, shrinkwrap, and vendor checks pass.
- Focused runtime frontend and WebSocket lifecycle suites pass all 36 tests.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
