# Chatobby 0.1.2 public alpha

Reliability and first-run usability update for Chatobby's Obsidian connector
and Windows runtime.

## Fixed

- Agent turns no longer stop because the user opens or leaves another Chatobby
  page.
- The first sent message and live response appear immediately without manually
  refreshing the view.
- Repeated clicks on the same Chatobby page no longer create duplicate Obsidian
  history entries or require extra Back presses.
- Runtime requests, shell commands, tool calls, and unanswered permission
  prompts now have bounded deadlines and visible failures.
- Feature pages no longer remain on an endless loading state when the runtime is
  unavailable.
- Permission edits preserve the user's scroll position.
- Chatobby text follows the normal Obsidian interface font size.

## Added

- A concise in-feed first-run guide for connecting the runtime, adding a model
  provider, understanding the default permission policy, and sending the first
  message.

## Install

For a new or troubleshooting installation, use the full **Chatobby Setup**
installer. It installs both the Windows runtime and the three Obsidian connector
files into the vault chosen during setup. Close Obsidian before running it, then
open the vault and enable Chatobby under **Settings -> Community plugins**.

This is free alpha software. Back up important vaults and start with a copied
test note. Optional Patreon support does not unlock features.
