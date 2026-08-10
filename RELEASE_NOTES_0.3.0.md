# Chatobby 0.3.0 public alpha

Chatobby 0.3.0 pairs with Runtime 0.3.0 on Windows x64, experimental macOS on
Apple Silicon and Intel, and experimental glibc Linux on x64 and arm64. It
requires Obsidian 1.11.4 or newer and uses runtime protocol revision 4.

> **Platform status:** Windows is the primary tested platform. macOS and Linux
> packages are built and exercised on native GitHub runners but have not
> completed representative physical-device acceptance. macOS is not
> Apple-notarized. Flatpak, Snap, musl, and other confined Linux environments
> remain unverified.

## What changed

- Replaces path-based chat organization with a first-class Vault and Projects
  library, stable Project identities, multiple attached folders, rename/move
  recovery, Project-scoped chats, and authoritative Project context.
- Adds the in-Chatobby Settings page for provider credentials, local model
  servers, conversation preferences, Project behavior, documentation, and
  support. Local servers include Ollama, LM Studio, vLLM, llama.cpp, and
  generic OpenAI- or Anthropic-compatible endpoints.
- Adds experimental Linux x64 and arm64 runtime packages with XDG-aware
  storage, native CI verification, signed target selection, and fail-closed
  libc and confinement handling.
- Makes the composer more responsive, adds an inline `@` file/folder picker,
  keeps controls on one row, and adds a sticky previous-prompt navigator.
- Improves Memory filtering and Project-aware applicability, permission-policy
  consistency, bounded Auto classification, MCP connection guidance, and
  per-server permission discovery.
- Shares revisioned semantic Obsidian context between prompt injection and
  tools, and improves semantic web reading, retained continuation, document
  parsing, OCR routing, and non-Markdown view awareness.
- Separates Obsidian pane and ItemView controls from the webpage DOM inside a
  Web Viewer. Browser results identify the containing leaf and guest-page
  revision independently, and semantic clicks now activate guest-page links
  and controls through the correct page execution path.
- Makes Chatobby's Obsidian CLI and live developer diagnostics easier for the
  agent to discover, and encourages rendered Dataview, CSS, plugin, and UI work
  to be checked against current errors and live Obsidian state.
- Strengthens compaction, cross-session continuity, built-in Obsidian skills,
  subagent lifecycle display, channel permission admission, and scheduled
  Event sessions.
- Fixes Project chats reverting to Vault scope after their first prompt and
  fixes stale feed content appearing beneath a newly opened session.

Chatobby remains public-alpha software. Back up important vaults, begin with
the minimum permissions needed for the task, and review experimental-platform
limitations before installing.
