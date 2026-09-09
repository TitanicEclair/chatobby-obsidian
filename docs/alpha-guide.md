# Chatobby alpha guide

Chatobby is a free public alpha. Patreon support is optional and does not
unlock features, raise limits, or change the data Chatobby can access.

## Start a chat

1. Open Chatobby's **Settings** page from its sidebar and connect one model
   provider or local model server.
2. Start a Vault chat, or create a Project with the folders you want to use.
3. Ask Chatobby to summarize a note, compare linked ideas or make an edit.
4. Add the **Chatobby Guide** from Settings for the full feature reference.

## Access modes

New chats start in **Workspace** mode with network access on. Workspace allows
file changes in the selected Vault or Project folders; **Read-only** prevents
file changes there. Both modes use native sandboxing on Windows, macOS and Linux.
Chatobby's internal storage stays protected. **Full** uses your normal OS account
access and keeps networking on. Choose the mode and network setting in the composer
or Permissions; separate chats keep their own choices.

**Obsidian app access** enables tools that operate the app itself, including its
whole-vault access. It defaults on for Vault chats and off for Projects. Existing
explicit choices are preserved. Manage it and individual MCP connections in
Permissions.

## What is included

- provider, model, and reasoning controls per session;
- Obsidian-aware reading, search, navigation, and allowlisted vault operations;
- memory, tasks, events, permissions, and document/image
  attachments;
- terminal-first durable file work plus version-aware Obsidian CLI discovery
  for live application, index, history, plugin, and developer semantics;
- subagents and vault-scoped communication channels; and
- local session storage with no Chatobby account requirement.

Features are experimental. Contracts, storage formats, and user interfaces may
change before a stable release.

## Cost and data flow

Chatobby does not charge for this alpha. Your selected provider or integration
may charge for requests. Remote model calls can include prompts, selected note
context, attachments, tool arguments, and tool results. Review the active
permission policy and provider terms before working with sensitive content.

Chatobby has no client-side analytics or automatic crash reporting. Diagnostics
remain local unless you choose to share a redacted copy.

## Feedback

Use the [public issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues)
for reproducible non-security issues. Remove credentials, private note content,
names, and confidential paths. Report vulnerabilities privately as described
in [Security](../SECURITY.md).

Optional development support is available through
[Patreon](https://www.patreon.com/cw/MadelynCruzTan/membership).
