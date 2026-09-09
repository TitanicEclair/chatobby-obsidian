# Chatobby 0.5.1

- **Workspace tools:** fix Windows folder-name casing and system path aliases that could block reads, shell commands and web tools in Read-only or Workspace mode.
- **Access changes:** refresh the tools available to an ongoing chat. Keep pages and connections working after an Obsidian app-access change stops an MCP server.
- **Stop commands:** fix an intermittent Windows timing mismatch that could prevent a running command from stopping cleanly.
- **Command startup:** handle commands that finish before their input pipe closes, preventing a successful short command from appearing to fail.
- **Web search:** improve regional and site-specific queries, result filtering and pagination. Keep useful results when a later request fails.
- **Tool errors:** report the actual connection, permission, startup or search failure. Check the target vault before running Obsidian CLI commands, including commands that return an error with exit code zero.
- **Agent guidance:** clarify shell discovery, search queries, continuation and the distinction between verified results and untested assumptions.

Update Chatobby through Obsidian Community plugins, then install the matching runtime update in Chatobby Settings. Your chats, Projects, memory and model connections are preserved.

Default search still depends on DuckDuckGo and can encounter provider bot challenges. macOS and Linux remain experimental; macOS packages are not notarized. Windows is the primary interactively tested desktop platform.

[Report a problem or share feedback](https://github.com/TitanicEclair/chatobby-obsidian/issues)
