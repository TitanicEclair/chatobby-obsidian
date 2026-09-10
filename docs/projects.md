# Projects

Projects keep related Chatobby conversations and working folders together. A
Vault chat is best for general vault work. A Project chat is best when the work
has a stable purpose, a set of relevant folders, or several conversations that
should stay easy to find together.

Opening Chatobby reveals Projects in the native left sidebar. Search, collapse
and reorder Projects and their chats there. Browsing a Project or opening a
workspace page does not move or replace the conversation currently running.

## Start or resume work

1. Open Chatobby and use the **Projects** section in its left sidebar.
2. Choose **New chat** for general Vault work, or open a Project group.
3. Select an existing chat to resume it, or choose **New chat in Project**.
4. Confirm the Vault or Project name in the active chat header before sending
   consequential instructions.

Choose **Create Project** beside the Projects heading, or create one from a
folder in Obsidian. The native modal keeps name, description and folders together.
During creation, **Add folders** can select several vault or external folders.
Selections accumulate instead of replacing one another; choose **Make primary**
when a folder other than the first should be the working directory. If you
intentionally select no existing folder, Chatobby creates a new folder named
after the Project in the vault. A selected external folder is used in place and
is never replaced by a same-named vault copy.

A Project has one primary folder and may include other working folders. The
primary folder determines the initial working directory and how relative paths
resolve. Adding a folder supplies that context to every chat in the Project.
Chatobby 0.5.3 uses Full access while sandboxing is temporarily unavailable;
the folder list does not restrict file or command access.

A Project with no linked folder retains its Project identity and memory/history
scope. Add a folder to give its chats a working directory. Full access can still
reach explicit paths elsewhere.

## Folder identity and external access

Chatobby normally offers to place a small identity marker in each selected
folder. The marker contains no conversation or credential data; it lets
Chatobby recognize that physical folder after a rename or move. If a marker
cannot be written, you can retry, cancel the entire operation, or explicitly
continue with a device-only binding. Creation and batch folder addition are
all-or-nothing, so an inaccessible or expired selection never leaves a partial
Project.

Project membership identifies the workspace, instructions and application data
scope. It does not provide filesystem or network containment in 0.5.3.

To reorganize an existing chat, right-click it and choose **Move chat…**. Vault
is always the first destination, followed by searchable active Projects. Moving
a chat changes its workspace and the authority used by future file, tool, and
memory work; it does not rewrite or remove existing conversation context. Start
a new Project chat when you need a separate context rather than moving the
current conversation.

Use the chat search above a Project's conversation list to search titles. Turn
on **Search messages** to search inside conversations instead. Message results
are shown as bounded pages of matching excerpts. Selecting a result resumes its
conversation and moves the feed to that exact message, where Chatobby briefly
highlights the match.

Inside a chat, type `@` to reference a file or folder. With an empty query,
Chatobby starts with useful items from the running Project's primary and attached
folders, including external folders. Continue typing to narrow the results, use
spaces normally when a file or folder name contains them, use the arrow keys or
pointer to move through the scrollable list, and press Escape only when you want
to cancel the active lookup. Select an item to keep it as a compact chip.
Selecting that chip opens a vault file in Obsidian,
reveals a vault folder in Obsidian's file explorer, or reveals an external item
in the system file explorer. References communicate intent; permissions still
decide what the agent may do with the item.

At Project session start, Chatobby provides the agent with the current Project
name, exact working directory, and verified primary and attached folders. When
the Project's folder set changes, Chatobby replaces those facts for the next
model call. Missing or conflicting folders remain identified by state without
a guessed local path.

The **Permissions** page manages Obsidian app access per Vault/Project. Access-mode
and network controls are hidden in 0.5.3. Session-history tools search only the
current Project, or Vault chats for a Vault session; memory uses its own Project
rules. Archiving a Project preserves notes and saved conversations.

## Repair a Project that points at the wrong folder

Chatobby never deletes a mistakenly created folder automatically. To repair a
Project non-destructively:

1. Add the intended folder.
2. Make it primary.
3. Move or rebind the relevant chats if prompted.
4. Remove the false folder from the Project.
5. Reveal the old folder and inspect or remove it manually only when you are
   certain it contains nothing you need.

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
both exist in the same directory, Chatobby uses a non-empty `AGENTS.md` there;
an empty `AGENTS.md` falls through to `CLAUDE.md`. None of
these files grants permission or should contain credentials.

Most users should leave all prompt switches enabled. The current configurable
sections are core behavior, task planning, tool routing, coding workflow,
artifacts, memory, personal workflow, subagents, automation, and Obsidian
Markdown output. The five directory properties choose vault-relative
conventions for artifacts, sandbox files, task lists, reports, and inbox work;
they do not create folders. The complete property table and example are in the
[project-guidance reference](project-guidance.md).

For model setup, see [providers and models](providers-and-models.md). For
authority boundaries, see [responsibility boundaries](responsibility-boundaries.md).
