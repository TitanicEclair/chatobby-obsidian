# Chatobby 0.1.5 public alpha

This release focuses on predictable subagent budgets, reliable navigation,
long-page usability, and more precise Obsidian workspace and Web Viewer tools.

## What changed

- Subagent token budgets now charge uncached model work. Reused prompt-cache
  reads remain visible as diagnostics but cannot convert a valid completion into
  a false 60,000-token failure.
- The Memory page can scroll through long record lists again.
- Workspace state now exposes exact leaf IDs and a compact, sanitized layout so
  agents can target the intended Obsidian pane.
- Existing note, workspace, and browser operations accept exact leaf targets.
- Web Viewer supports native hover, scroll, and drag through one pointer tool,
  plus right-click and double-click through the existing click tool.
- Temporary composer attachments can be promoted to Obsidian's configured
  attachment location and return the exact Markdown link and embed.
- Agent guidance now explains screenshot-model requirements and the richer
  workspace, browser, and attachment workflows.
- Session browsing keeps compact names and metadata within their rows across
  narrow and wide panes.
- Chatobby-owned native skills migrate out of user-visible skill directories
  without deleting user-authored content.
- The release files are built, verified, and supplied with GitHub build
  provenance attestations from the tagged source.

## Verification

- The source and architecture checks pass.
- The complete plugin test suite passes.
- Release assets are minified, source-map free, limited to `main.js`,
  `manifest.json`, and `styles.css`, and checked for local paths, credentials,
  signing material, and unexpected files.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
