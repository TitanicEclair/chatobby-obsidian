# Chatobby 0.1.1 public alpha

Community review compatibility and safety cleanup for Chatobby's desktop
connector.

## Fixed

- Removed the duplicated plugin title from the settings page and adopted native
  settings-section headings.
- Updated feed and modal DOM handling for safer cross-window behavior.
- Used the configured vault settings directory instead of assuming
  `.obsidian`.
- Hardened attachment filenames, cursor parsing, and user-facing error handling.
- Reduced type ambiguity and deprecated internal API usage without raising the
  minimum supported app version.

## Install

Install the connector through Obsidian, then use **Get runtime** to download the
separate Windows runtime from the official
[`chatobby-runtime`](https://github.com/TitanicEclair/chatobby-runtime/releases/latest)
release.

This is free alpha software. Back up important vaults and start with a copied
test note. Optional Patreon support does not unlock features.
