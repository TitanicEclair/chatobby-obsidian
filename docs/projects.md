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
a folder makes it part of the Project's workspace; it does not grant permission
to read, edit, or run anything there. The active permission policy still
decides what the agent may do.

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

Place durable Chatobby-specific instructions in `chatobby.md` at the active
Project root. Use it for stable naming, formatting, source, and verification
rules. Use `AGENTS.md` for repository commands and code conventions. Neither
file grants permission, and neither should contain credentials.

For model setup, see [providers and models](providers-and-models.md). For
authority boundaries, see [responsibility boundaries](responsibility-boundaries.md).
