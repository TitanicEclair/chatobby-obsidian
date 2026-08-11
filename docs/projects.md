# Projects

Projects keep related Chatobby conversations and working folders together. A
Vault chat is best for general vault work. A Project chat is best when the work
has a stable purpose, a set of relevant folders, or several conversations that
should stay easy to find together.

Opening the Projects page does not change the conversation currently running.
The page distinguishes the Project you are viewing from the Vault or Project
shown in the active chat header.

## Start or resume work

1. Open **Projects** from Chatobby's top bar.
2. Choose **Vault** for general work, or select an existing Project.
3. Select an existing chat to resume it, or choose **New chat in Project**.
4. Confirm the Vault or Project name in the active chat header before sending
   consequential instructions.

You can create a Project from the Projects page or from a folder in Obsidian.
A Project has one primary folder and may include other working folders. Adding
a folder makes it part of every chat in the Project immediately. You do not
need to add the same folder to an external-directory allowlist. This does not
enable a denied capability: the active permission policy still decides whether
the agent may read, edit, use a shell, or perform another operation.

To reorganize an existing chat, right-click it and choose **Move chat…**. Vault
is always the first destination, followed by searchable active Projects. Moving
a chat changes its workspace and future Project context; it does not rewrite or
remove any messages.

At Project session start, Chatobby provides the agent with the current Project
name and a compact list of its working folders. When the Project's folder set
changes, Chatobby refreshes those facts for the next model call. This helps the
agent understand the workspace without copying folder paths into every prompt.

## Useful requests

> Tell me which Project this chat belongs to and which working folders are
> available. Do not read their contents yet.

> Review this Project's folders and propose how to divide the work. Ask before
> editing anything.

> Start a separate chat in this Project for release planning, while leaving
> this conversation unchanged.

## Project guidance

Chatobby automatically creates `chatobby.md` in the exact root used by a new
chat: the vault root for a Vault chat or the primary Project root for a Project
chat. The generated file contains the current supported properties and an empty
Markdown body. Put stable naming, formatting, source, and verification rules in
that body. Use `AGENTS.md` for repository commands and code conventions.
Neither file grants permission, and neither should contain credentials.

The body is a lower-priority system-prompt section placed after Chatobby's
protected built-in prompt. A body edit replaces the previous body on the next
message you send; it does not change a turn already running. Frontmatter
switches and workspace-directory properties are read when the agent runtime is
prepared, so start a new chat or recreate/reconnect the session after changing
them.

| Chat situation | Body guidance | Frontmatter configuration |
|---|---|---|
| Vault chat | Vault-root `chatobby.md` | Compiled from that file when the runtime is prepared. |
| Project chat | Vault-root body plus the body from the chat's active Project root | Compiled from the active root; Vault properties are not inherited as another configuration layer. |
| Added Project folder | Its body can activate when work first targets that registered folder. | It does not replace the running chat's base configuration. |
| Ordinary nested folder | Nested `chatobby.md` files are not discovered automatically. | Use path-scoped `AGENTS.md` or compatible `CLAUDE.md` for nested repository rules. |
| Primary root changes | Existing chats retain their stored active root until moved or reopened; new chats default to the current primary root. | The selected active root is read when its runtime is prepared. |

`AGENTS.md` is the preferred path-scoped repository instruction file.
`CLAUDE.md` is supported for compatibility through the same mechanism. When
both exist in the same directory, Chatobby uses `AGENTS.md` there. None of
these files grants permission or should contain credentials.

Most users should leave all prompt switches enabled. The current configurable
sections are core behavior, task planning, tool routing, coding workflow,
artifacts, memory, personal workflow, subagents, automation, and Obsidian
Markdown output. The five directory properties choose vault-relative
conventions for artifacts, sandbox files, task lists, reports, and inbox work;
they do not create folders. The complete property table and example are in the
[README project-guidance section](../README.md#project-guidance-chatobbymd-agentsmd-and-claudemd).

For model setup, see [providers and models](providers-and-models.md). For
authority boundaries, see [responsibility boundaries](responsibility-boundaries.md).
