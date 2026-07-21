# Live update and session transition lifecycle

Chatobby treats backend state, Obsidian vault state, and local presentation state as separate sources of truth.

## Session transitions

Resume, create, fork, clone, import, rename, and reload operations enter the `session-transition` operation domain. The view shows one blocking readiness state for that operation. It is removed only after:

1. the runtime mutation completes;
2. the authoritative frontend patch is applied;
3. the active feed and composer controls reconcile; and
4. two animation frames allow the new surface to paint.

An empty Chatobby leaf may adopt a resumed session. A leaf with conversation history is not mutated: its session picker closes first, the destination leaf is opened or reused, the destination session is made ready, and that destination is revealed last. This ordering prevents an asynchronous history update in the source leaf from stealing focus back.

## Feature-page updates

Feature pages subscribe only to their own runtime-owned screen model. Their update sources are:

| Domain | Live invalidation source |
| --- | --- |
| Memory | `memory:changed` and memory-candidate events |
| Permissions | `permissions:profiles-changed` after agent policy mutations |
| Queries | `chatobby:context-queries-changed` after agent query mutations |
| Events | Event-service subscription |
| Channels | Channel-service subscription |
| Subagents | Subagent lifecycle subscription |
| Sessions | Session identity, name, recovery path, or message-count changes |
| Vault directories | Obsidian vault create, delete, and rename events |

Invalidations reload the authoritative model; they do not patch forms from guessed local state. Store selectors prevent a domain update from rebuilding unrelated pages.

## Session directory

The directory tree is re-read whenever the open picker is invalidated. Obsidian's vault watcher supplies create, delete, and rename events for changes made through Obsidian or detected from the filesystem. Refreshes are debounced and preserve the selected directory when it still exists; if it was removed, selection moves to the nearest existing ancestor.

The session list is invalidated across every open Chatobby leaf when a session is created, resumed, renamed, cloned, forked, deleted, or gains persisted messages. Hidden pickers do no rendering work; an open picker refreshes in place.
