# Chatobby 0.1.3 public alpha

This release strengthens Chatobby's Obsidian Web Viewer tools for pages that
need a signed-in browser, client-side rendering, or visual inspection.

## Web Viewer improvements

- Read meaningful page content as bounded Markdown, plain text, or structured
  blocks with page metadata, outline, links, coverage, and continuation cursors.
- Inspect accessible page structure and use stable element references for
  clicks and form entry.
- Query or inspect sanitized DOM when semantic reading is not enough.
- Navigate back and forward, send native keyboard input, wait on live page
  changes, and capture screenshots as image tool results.
- Redact password values and reject stale element references after navigation.
- Separate page reading, page control, and expert JavaScript evaluation in the
  permission UI.

## Runtime pairing

Chatobby plugin `0.1.3` is paired with runtime `0.1.3`. Existing installations
can use the in-plugin update action; new installations can use the guided
runtime installer shown in Chatobby. The runtime package is signed with the
same Ed25519 trust key used for `0.1.2`.

This remains an early public alpha. The Windows runtime is integrity-signed by
Chatobby but is not yet Authenticode-signed, so Windows may show a reputation
warning.
