# Chatobby 0.4.0

Chatobby 0.4.0 strengthens the full working loop: choosing where a chat works,
connecting models, finding the right capability, preserving useful context,
and verifying results inside Obsidian.

## Highlights

- Connect compatible local model servers from Chatobby Settings, including
  Ollama, LM Studio, vLLM, llama.cpp, and OpenAI- or Anthropic-compatible
  endpoints. Optional managed llama.cpp profiles can start, stop, restart, and
  launch on demand without conflating the server process with the model
  connection that chats select.
- Create Projects from existing vault or external folders, attach multiple
  folders, choose the primary working directory, and make attached roots
  available through the effective Project permission boundary. Project context
  and the current chat's effective permission policy remain visible to the
  agent when roots or policies change.
- Search and sort Projects and chats, search message contents, move chats among
  Projects and the Vault, and resume an exact matching result.
- Keep prompts submitted during automatic compaction pending until the rebuilt
  context is ready. Compaction now has a dedicated five-stage activity, a
  durable completion receipt, and an immediate post-compaction usage refresh.
- Keep large tool results available through the working turn and query retained
  results by stable ID using bounded pages, ranges, lines, text search, JSON
  pointers, and tabular projections without recursively creating new retained
  results.
- Discover tools, installed Obsidian CLI commands, command-palette entries,
  configured MCP tools, and maintained native skill suites through one ranked
  capability search. Eleven native suites provide progressively disclosed
  guidance for Obsidian, coding, research, data, diagrams, and product work.
- Prefer ordinary file tools and bounded terminal scripts for durable content,
  while retaining Obsidian CLI for live index, history, link updates, settings,
  plugin lifecycle, command-palette, and developer diagnostics where those
  semantics matter.
- Return typed, actionable Obsidian CLI results. Invalid screenshot paths,
  unsupported image delivery, and render-dependent command sequences now state
  what was attempted, what was not dispatched, and how to recover instead of
  collapsing into a generic internal error.
- Resolve embedded images from the Vault's actual link and attachment settings.
  Image bytes are delivered only when the selected model supports image input.
- Remove retired media/download helpers and their bundled
  Python/Pillow/yt-dlp/NumPy environment, reducing the runtime package surface.

## Workflow transition

The current subagent-only Flows surface is deprecated in 0.4.0 while Chatobby
moves toward general-purpose workflows whose steps are not limited to
subagents. Existing Flows remain available during this transition, but new
long-lived automation should not depend on them.

## Alpha platform status

Windows remains the primary tested desktop path. Native candidate jobs build
and exercise Windows x64, macOS Apple Silicon and Intel, and glibc Linux x64
and arm64 packages. macOS and Linux remain experimental until representative
physical-device acceptance is complete; Flatpak, Snap, musl, and other confined
Linux environments remain unverified.

Back up important vaults and review the active permission policy before
granting broad filesystem or terminal access.
