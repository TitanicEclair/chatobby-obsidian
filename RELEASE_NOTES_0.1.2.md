# Chatobby 0.1.2 public alpha

Chatobby 0.1.2 is a reliability, responsiveness, and first-run usability
release for the Obsidian plugin and its local Windows runtime.

## Highlights

- Install or update the signed Chatobby runtime directly from the plugin after
  reviewing its version, source, size, and verification details.
- Keep an active agent turn running while opening Permissions, Events, Memory,
  Channels, Queries, Subagents, or another Chatobby view.
- See the first message, streaming Markdown, tool activity, tasks, and new
  subagents update without leaving and reopening the conversation.
- Use bounded runtime requests, shell commands, tool calls, permission prompts,
  and subagent waits so stalled work produces a visible failure instead of
  waiting indefinitely.
- Navigate Chatobby pages without duplicate Obsidian history entries or extra
  Back presses.
- Use improved subagent lifecycle entries, live agent-rail updates, task-strip
  styling, permission-policy controls, document attachments, and composer
  command affordances.
- Follow the new in-feed first-run guide for runtime setup, provider setup,
  permissions, and the first prompt.

## Install through Obsidian

1. Install or update Chatobby from Obsidian's Community plugin directory.
2. Open Chatobby and select **Install runtime** or **Update Chatobby**.
3. Review the release details and confirm. The plugin downloads the package,
   verifies its Ed25519 signature and complete file inventory, installs it for
   the current Windows account, and reconnects.
4. Add a model provider credential under **Settings -> Chatobby**.

Runtime installation is an explicit action. It does not silently update the
Obsidian plugin.

## Standalone downloads

The runtime release also provides two clearly named installers:

- **Chatobby Runtime Setup** installs only the local runtime. It does not ask
  for a vault and is intended for users who install the plugin through Obsidian.
- **Chatobby Standalone Setup** asks for one vault and installs both the runtime
  and the three Obsidian plugin files into that vault.

The 0.1.2 Windows executables are not Authenticode-signed. Windows may display
an unknown-publisher warning. The in-plugin package is independently signed and
verified with Chatobby's embedded Ed25519 release key.

## Alpha notice

Chatobby remains free public-alpha software. Back up important vaults and begin
with a copied test note. Optional Patreon support does not unlock features.
