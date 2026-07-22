# Chatobby 0.2.0 public alpha

Chatobby 0.2.0 pairs with Runtime 0.2.0 and focuses on making the agent's tool
use more capable, predictable, and context-efficient on Windows and
experimental macOS.

> **macOS status:** Apple Silicon and Intel packages are built and verified on
> native GitHub macOS runners. This alpha has not been externally verified on a
> physical Mac and is not Apple-notarized.

## What changed

- Added a canonical tool-contract registry so tool purpose, preparation,
  follow-up, result completeness, paging, cancellation, and recovery guidance
  stay aligned with the runtime's real schemas.
- Reduced the always-visible provider tool surface by consolidating overlapping
  task, event, context-query, channel, subagent, and Obsidian operations behind
  clearer façades. Specialist MCP tools remain discoverable on demand.
- Added revision-safe inspection and mutation flows for memories, permissions,
  user skills, tasks, events, context queries, and subagent definitions.
- Added bounded paging and retained-result handling for filesystem discovery,
  documents, media, Obsidian CLI output, and memory maintenance so large reads
  do not unnecessarily consume the conversation context.
- Improved subagent status and control semantics, including terminal-state
  races and unified channel communication.
- Fixed project guidance loading from the active session directory and rejected
  stale Web Viewer element references after page transitions.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
