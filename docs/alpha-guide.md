# Chatobby alpha guide

Chatobby is a free public alpha. Patreon support is optional and does not
unlock features, raise limits, or change the data Chatobby can access.

## A safe first session

1. Use a backed-up vault or copied test folder.
2. Connect one model provider in **Settings → Chatobby**.
3. Keep the default permission policy for the first session.
4. Ask Chatobby to summarize the active test note without changing it.
5. Request one small edit and inspect the result before expanding permissions.
6. Restart Obsidian and confirm that the session and runtime reconnect.

## What is included

- provider, model, and reasoning controls per session;
- Obsidian-aware reading, search, navigation, and allowlisted vault operations;
- memory, tasks, context queries, events, permissions, and document/image
  attachments;
- subagents, workflows, and vault-scoped communication channels; and
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

