# Chatobby alpha guide

Chatobby is a free public alpha. Patreon support is optional and does not
unlock features, raise limits, or change the data Chatobby can access.

## Start a chat

1. Open Chatobby's **Settings** page from its sidebar and connect one model
   provider or local model server.
2. Start a Vault chat, or create a Project with the folders you want to use.
3. Ask Chatobby to summarize a note, compare linked ideas or make an edit.
4. Add the **Chatobby Guide** from Settings for the full feature reference.

## Workspace permissions

Choose **Read-only**, **Workspace**, or **Full access** in the composer. The last
choice is saved for the Vault or Project and shared by its chats. New workspaces
start in Workspace mode.

Read-only allows reading, searching and web access. Workspace adds file creation
and edits within its roots. Restricted modes accept only approved command forms;
other execution requires an exception. Full access uses your account's file,
command and network access. These checks do not create an operating-system sandbox.

In **Permissions**, select an existing workspace to change its mode, choose
**Ask me** or **Reject automatically**, and enable or disable **Chatobby and
Obsidian tools**. Both Vault and Project tool access default On; explicit Off
choices are preserved. Enabled tools still pass through the selected mode.

When the agent requests an exception, an Obsidian notification points to the
request above the composer. Review its action and reason, then choose **Allow
once** or **Deny**. Your draft stays intact. Enabled MCP servers and tools remain
available in every mode and are managed in Plugins.

Project memory and session-history queries keep their independent workspace scope.

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
context, attachments, tool arguments, and tool results. Use a local model when
you want inference to stay on your device.

Chatobby has no client-side analytics or automatic crash reporting. Diagnostics
remain local unless you choose to share a redacted copy.

## Feedback

Use the [public issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues)
for reproducible non-security issues. Remove credentials, private note content,
names, and confidential paths. Report vulnerabilities privately as described
in [Security](../SECURITY.md).

Optional development support is available through
[Patreon](https://www.patreon.com/cw/MadelynCruzTan/membership).
