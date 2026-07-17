# Chatobby 0.1.4 public alpha

This release corrects the Web Viewer tool surface identified by Obsidian's
automated review.

## Review-safe Web Viewer tools

- Removed arbitrary JavaScript evaluation from the agent-facing browser tools.
- Kept bounded Markdown and text reading, accessible page snapshots, sanitized
  DOM inspection, stable element references, native clicks and keyboard input,
  event-driven waits, browser history, and screenshots.
- Added a repository check that prevents arbitrary page evaluation from being
  reintroduced into the public plugin source.

## Runtime pairing

Chatobby plugin `0.1.4` is paired with runtime `0.1.4`. Existing installations
can use the in-plugin update action; new installations can use the guided
runtime installer shown in Chatobby.

This remains an early public alpha. The Windows runtime is integrity-signed by
Chatobby but is not yet Authenticode-signed, so Windows may show a reputation
warning.
