# Live update and session transition lifecycle

Chatobby treats backend state, Obsidian vault state, and local presentation state as separate sources of truth.

## Session transitions

Resume, create, fork, clone, import, rename, and reload operations enter the `session-transition` operation domain. The view shows one blocking readiness state for that operation. It is removed only after:

1. the runtime mutation completes;
2. the authoritative frontend patch is applied;
3. the active feed and composer controls reconcile; and
4. two animation frames allow the new surface to paint.

An empty Chatobby leaf may adopt a resumed session. A leaf with conversation history is not mutated: its Projects browser closes first, the destination leaf is opened or reused, the destination session is made ready, and that destination is revealed last. This ordering prevents an asynchronous history update in the source leaf from stealing focus back.

## Feature-page updates

Feature pages subscribe only to their own runtime-owned screen model. Their update sources are:

| Domain | Live invalidation source |
| --- | --- |
| Memory | `memory:changed` and memory-candidate events |
| Permissions | runtime `screen.replace` after a revision-bound access-policy mutation |
| Events | Event-service subscription |
| Channels | Channel-service subscription |
| Subagents | Subagent lifecycle subscription |
| Sessions | Session identity, name, recovery path, or message-count changes |
| Vault directories | Obsidian vault create, delete, and rename events |

Invalidations reload the authoritative model; they do not patch forms from guessed local state. Store selectors prevent a domain update from rebuilding unrelated pages.

## Account model discovery

Opening the provider or model picker requests current account discovery through
the runtime's cache. `refreshComposerModelCatalogue` reconciles the same connected
frontend before displaying its authored status; a replaced connection or closed
picker discards late results. Search text and existing choices remain available
during a refresh or failure. Settings displays cached-list warnings and optional
model-specific exclusions from the canonical provider contract. These diagnostics
contain no credentials, introduce no persistent setting, and remain absent with
an older runtime that does not supply them. Rolling back the connector restores
the earlier presentation without changing account or selected-model state.

## Session directory

The directory tree is re-read whenever the open picker is invalidated. Obsidian's vault watcher supplies create, delete, and rename events for changes made through Obsidian or detected from the filesystem. Refreshes are debounced and preserve the selected directory when it still exists; if it was removed, selection moves to the nearest existing ancestor.

The session list is invalidated across every open Chatobby leaf when a session is created, resumed, renamed, cloned, forked, deleted, or gains persisted messages. Hidden pickers do no rendering work; an open picker refreshes in place.

## Development Guide feed acceptance

The signed Guide channel keeps its production URLs compiled into ordinary and
release builds. An unpublished development build may set
`CHATOBBY_DEV_GUIDE_FEED_BASE_URL` to a credential-free `https://localhost/.../`
or `https://127.0.0.1/.../` directory ending in `/`. The exact-pair build must
also embed the matching ephemeral Ed25519 public key through
`CHATOBBY_RUNTIME_PUBLIC_KEY`; the Guide fixture is signed with the corresponding
temporary runtime signing key.

The override changes only where that development connector reads
`guide-channel.json` and its named immutable `guides/chatobby-guide-<revision>.json`
asset. Signature, compatibility-range, consumer-schema, path, size, hash, and
file-count checks remain unchanged. An invalid or unavailable fixture leaves
the installed Guide untouched, and a valid result still requires the existing
user confirmation before writing.

Release builds reject the development Guide feed input before producing release
assets, and the release verifier rejects its specific build marker as a second
gate. This test seam does not activate or replace the public stable feed and
must not install a test certificate globally; local HTTPS trust is process-scoped
to the disposable acceptance run.
