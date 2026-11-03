# Frontend context

The connector observes live Obsidian state. The runtime owns effective session,
workspace, permission and model-context assembly. Generated contracts own the
packet schema. [prompt/index.ts](../../src/prompt/index.ts) exposes capture and
packet projection; [obsidian-context/index.ts](../../src/obsidian-context/index.ts)
exposes the shared services used by both prompts and explicit context tools.
The [prompt owner guide](../../src/prompt/README.md) and
[observation owner guide](../../src/obsidian-context/README.md) locate local
declarations and lifetimes; the generated wire schema remains separate.

## Module boundaries

| Owner | Responsibility |
|---|---|
| `prompt/capabilities.ts` | Capability advertisement and relevant integration projection; no note collection. |
| `prompt/capture.ts` | Observe semantic/UI facts and environment after admission. |
| `prompt/context-packet.ts` | Pure packet projection, field limits and omission metadata. |
| `prompt/authorized-context.ts` | Collect only between matching host-owned grant stamps. |
| `obsidian-context/semantic-context-service.ts` | App-scoped event subscriptions, invalidation, revisions, demand cache and diagnostics. |
| `obsidian-context/semantic/` | Snapshot types, live editor/workspace capture and rich tool projections with revision-bound paging. |
| `obsidian-context/ui-snapshot-service.ts` | Retained documents, opaque cursors, expiry and interaction revision checks. |
| `obsidian-context/ui/` | Typed node state, visible DOM traversal and validated element effects. |

Capture does not authorize collection. The submit controller checks the live
target, reads the runtime grant before and after capture, and drops stale/revoked
passive context. Explicit user text and attachments remain separate. The runtime
filters the packet again and replaces estimated session facts before rendering.

## Lifetime and data

Bootstrap collects capabilities only. Each ordinary user submission gets a full
reference packet; unchanged semantic observations reuse the App-scoped snapshot.
Events invalidate that snapshot without reading note text. UI observations create
fresh document identities; opaque references expire or become invalid when the
view changes. Plugin unload disposes both services. Explicit tool observations
retain richer paging and editor facts than the prompt packet.

Semantic `capturedAt` is the time of the last demand capture after an event
invalidated the cached state. An unchanged time is not evidence of stale state;
domain revisions count invalidations, not changed capability entries. Native
Chatobby title updates explicitly invalidate workspace/page observations even
when Obsidian emits no layout event. A UI document's `capturedAt` describes its
actual DOM capture and stays fixed while paging that retained document. Prompt
`appContext.inspection.capturedAt` carries this fresh UI time separately from
`appContext.capturedAt`; older runtimes/connectors may omit the optional field.

The current packet limits selection to 12,000 characters, captured excerpt to
6,000, headings to 64 × 200 characters, distinct open-note references to 12 and prompt UI
landmarks to eight. Field limits are not a total model-token budget. Device
fingerprint/display fields and unrelated plugin inventory are omitted. No
first-turn-only suppression or changed-fields protocol is implemented here.
Open-note references are deduplicated by exact canonical vault path before the
limit, keeping the first title and order. Semantic snapshots and tool projections
still report every leaf; path case and separate folders are not collapsed.

## Test-purpose map

| Contract | Tests |
|---|---|
| Actual capture-to-packet path: unsaved editor, selection, later turns and tool parity | [capture](../../tests/prompt/capture.test.ts) |
| Field limits, omission metadata and workspace projection | [packet](../../tests/prompt/context-packet.test.ts) |
| No passive bootstrap reads | [negotiation](../../tests/ui/frontend-bootstrap-request.test.ts) |
| Target/grant races and preservation of explicit user input | [authorized capture](../../tests/prompt/authorized-context.test.ts), [actual view submission](../../tests/ui/view-authorized-context.test.ts) |
| Exact ordinary first/later transport packets; raw/steer/follow-up route separation | [Actual view methods](../../tests/ui/view-authorized-context.test.ts), with controlled dependencies and frozen serialized arguments |
| Off/revocation invalidation and socket rebinding | [passive invalidation](../../tests/obsidian-bridge/passive-context-invalidation.test.ts) |
| Cache, revisions, unsaved state, projection paging and scope | [semantic service](../../tests/obsidian-context/semantic-context-service.test.ts) |
| Visible DOM, stale references, sensitive values, expiry and traversal bounds | [UI service](../../tests/obsidian-context/ui-snapshot-service.test.ts) |
| Prompt acceptance/retraction during compaction | [submission](../../tests/ui/prompt-submission-controller.test.ts) |

Run `npx vitest run tests/prompt tests/obsidian-context` for local feedback and
`npm run check`, `npm test`, `npm run check:community-review` for connector gates.
Fixtures are synthetic App/DOM hosts, not private conversations or installed
runtime evidence. Paired live acceptance checks unsaved edits, focus changes,
tool opt-out and explicit context-tool interaction in the disposable vault.
