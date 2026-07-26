# Chatobby 0.2.2 public-alpha candidate

Chatobby 0.2.2 pairs with Runtime 0.2.2 on Windows and experimental macOS.

> **macOS status:** Apple Silicon and Intel packages are built and verified on
> native GitHub macOS runners. This alpha has not been externally verified on a
> physical Mac and is not Apple-notarized.

## What changed

- Reworked permission capability state so connected MCP servers and their
  discovered tools use the same Allow, Ask, and Deny controls as built-in
  capabilities.
- Added a visible **Temporary session access** section when an agent or user
  grants a session-only permission. Temporary access no longer looks like a
  saved policy edit.
- Replaced the open MCP Registry catalogue with a Chatobby-verified plugin
  catalogue while continuing to show user-configured connections.
- Added explicit Obsidian Secrets linking for bearer-token MCP services,
  including linked-token state, refreshable secret choices, and guarded
  connection controls.
- Improved plugin identity, capability, setup, authentication, and diagnostic
  presentation in the Plugins page.
- Added a ribbon action that copies or updates a linked, multi-page Chatobby
  Guide inside the vault after confirmation.
- Lowered the minimum automatic-compaction threshold from 50 to 25 percent.
- Made early Stop settle the elapsed timer even when the backend never entered
  streaming before acknowledging cancellation.
- Updated the bundled frontend contracts for live permission approvals, MCP
  configuration, guide files, and tool capability metadata.

## Verification

- Connector type and architecture checks pass.
- The complete connector suite passes 779 tests, with two intentional skips.
- Runtime permission, MCP, schema, guide, and compaction regression suites pass.
- Exact Windows, Apple Silicon, and Intel production targets pass native build,
  clean-home startup, installer, update, cancellation, and rollback checks.
- The exact Windows runtime and connector pass live test-vault acceptance.
- Final combined candidate assembly and publication remain pending.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
