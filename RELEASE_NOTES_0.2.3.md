# Chatobby 0.2.3 public alpha

Chatobby 0.2.3 pairs with Runtime 0.2.3 on Windows x64 and experimental macOS.

> **macOS status:** Apple Silicon and Intel packages are built and verified on
> native GitHub macOS runners. This alpha has not been externally verified on a
> physical Mac and is not Apple-notarized.

## What changed

- Adds practical built-in permission policies: Obsidian, Approve safe, Full
  access, Auto, and Read only.
- Adds private, fail-closed Auto classification for permission checks that
  would otherwise require a user decision.
- Adds native file-explorer actions to start a Chatobby session in a selected
  folder or browse that folder's saved sessions.
- Keeps submitted image and document attachments visible in the feed and lets
  users open them through the operating system.
- Makes composer attachment tiles smaller and clearer, with file-family icons,
  overlaid metadata, and compact removal controls.
- Places the composer closer to the status bar with smaller outer insets.
- Clears submitted text before the optimistic message appears, eliminating the
  brief duplicate-composer flash while preserving failed-send recovery.
- Improves typo-tolerant vault search and isolates slow optional providers so
  useful lexical results are not discarded.
- Keeps shell selection and restart guidance consistent across every supported
  built-in and custom shell.
- Improves bounded document reading and OCR so text-only models can read
  image-only documents without receiving embedded binary payloads.
- Improves bounded web reading and continuation metadata.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
