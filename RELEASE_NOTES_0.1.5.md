# Chatobby 0.1.5 manual-verification candidate

This is an unpublished candidate. Do not tag or publish it until the integration
suite passes and the product owner completes manual verification.

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

## Manual checks before release

- Confirm a long Memory list scrolls to its final item in the target vault.
- Run a small multi-turn subagent task and confirm cached input does not exhaust
  its token budget or replace a successful result.
- Exercise exact-pane note/browser opening and native pointer interactions.
- Promote an image and a document attachment and verify their returned embeds
  resolve at the configured attachment location.
- Confirm normal navigation through Permissions, Events, Queries, Channels,
  Tasks, and Subagents remains scrollable and retains page state.
