# Composer and references

The connector owns transient draft text, attachments, reference selection and
keyboard presentation. The runtime owns submitted messages, execution and
permissions. Selecting an `@` reference names a file or folder; it grants no
access and does not read file contents.

| Owner under `src/ui/composer/` | Responsibility |
|---|---|
| `composer.ts` | Bound input, keyboard/interaction/slash routing, and ordered capture/restore of DOM and reference selection. Public host/method compatibility remains here. |
| `draft-state.ts` | One current draft, local prompt history/navigation and stash; snapshots transfer existing attachment references and copy activation/reference lists. |
| `submission-lifecycle.ts` | Pending identity/signal, slash acknowledgement, accepted retraction and output-marker promotion, using the original host receiver and named Composer view operations. |
| `attachment-presentation.ts` | Picker, paste/drop listeners, attachment rows and removal; uses the same draft and the current binding after storage awaits. |
| `types.ts` | Local draft/attachment declarations and submission callbacks; root `types.ts` re-exports the original names and constant identity. Wire attachments still come from generated contracts. |
| `references/controller.ts` | Bound reference menu/chips/overflow panel, query selection, reference list, keyboard handling and presentation resources. |
| `references/search.ts` | Existing bounded Vault/Project filename search, ranking and reference identity. It does not own the draft or authorize tools. |

The reference controller receives narrow text-change, selection-change, search
and open callbacks. Composer copies its reference selection into the existing
stashed/submitted draft snapshot and restores through `replaceSelection`.
Replacing a draft retires the previous query; the controller does not store a
second history or serialize a new prompt format. Folder markers, deduplication,
ordering and explicit reference text retain their existing behavior.

Each `bind` creates one presentation lifetime. Rebinding or destruction retires
that identity before cancelling its frames and disconnecting its resize observer.
Late search success/rejection, queued frames and old DOM controls cannot update
the replacement surface. The filename search itself is not cancelled; only its
obsolete result is ignored. Frames and resize observations use the input's own
window. A deferred panel focus respects a later focus change or closed panel;
scroll work targets the actual still-current option, not a replacement query.

Expanded reference chips keep their bounded natural width instead of shrinking
to hide rail overflow. A long single label can still truncate; multiple chips
collapse to the summary when their measured total exceeds the rail. Widening
past the recorded total restores the ordinary chips. After panel deletion, the
controller briefly measures the remaining chips in the rail and restores the
summary within the same task, without hiding the panel. Its expansion threshold
requires a real width increase, so a queued same-width resize cannot interrupt
deletion focus even when the remaining references already fit.

Reference controls retain their original position around interaction and
attachment rails. Composer still routes blocking permission interaction before
reference keys, and reference Enter selects a name before ordinary Enter can
submit. This extraction changes no permission choice, approval, Stop/retraction,
attachment ownership, runtime contract or persistence schema.

Obsidian invokes the view's keyboard scope before ordinary DOM key listeners.
The focused reference panel therefore uses the same panel handler from both
routes. The current body-mounted control picker receives scoped keys through
`ComposerControls` before draft/turn cancellation; only its focused subtree may
claim them. Escape closes that surface and restores its trigger without clearing
the draft, changing references or arming Stop. Already-consumed events are not
applied twice. Outside those focused surfaces, configured cancellation and the
existing idle clearing, retraction and double-Escape Stop behavior remain active.

| Purpose | Regression owner |
|---|---|
| Late query completion/rejection, destroy/rebind, stale control/frame/observer, deletion/resize measurement, stash restoration and rail order | [Reference lifecycle](../../tests/ui/composer/references-lifecycle.test.ts) |
| Reference tokens, folders, Escape, overflow keyboard behavior, submission recovery and existing history/attachment semantics | [Actual Composer](../../tests/ui/composer.test.ts) |
| Delayed send/retraction with newer drafts, preview-URL transfer/release, delayed slash acknowledgement, and existing destroy/rebind callback behavior | [Submission ownership](../../tests/ui/composer/submission-lifecycle.test.ts) |
| Scope-before-DOM reference/picker Escape, selected-reference preservation, custom cancellation, consumed-event replay and unfocused-surface exclusions | [Scoped keyboard](../../tests/ui/composer/scoped-keyboard.test.ts) |
| Bounded filename ranking, workspace identities, exclusions and no content reads | [Reference search](../../tests/ui/composer/vault-reference-search.test.ts) |
| Controls, dropdown focus, responsive layout and key routing | [Controls](../../tests/ui/composer-controls.test.ts), [responsive behavior](../../tests/ui/composer-responsive.test.ts), [view keys](../../tests/ui/composer/view-key-routing.test.ts) |
| Permission cards and parent/child decision routing remain separate | [Permission request UI](../../tests/ui/permission-request-ui.test.ts), [subagent permission action](../../tests/ui/subagent-permission-action.test.ts) |

The tests compose the actual Composer and production shell. Controlled frame and
resize callbacks prove ownership and current-selection measurement under late
delivery, not CSS layout or popout focus. Installed acceptance checks actual
chip/rail geometry and controls at narrow and wide widths, overflow selection/removal,
keyboard focus, draft restoration and permission-card coexistence in the
disposable vault.

Draft and submission owners live for the Composer instance, across `bind` calls;
binding new elements does not create a fresh draft or pending submission. Capture
stores text, attachment references, slash activations and selected references;
it does not capture caret positions. Composer retains the existing typing/history
caret rules and restore order. Ordinary sends clear before optimistic feed
publication. First cancellation aborts pending preparation or retracts an accepted
submission with its original ID; output-marker promotion commits its history and
releases its preview URLs. A newer draft is retained or stashed according to the
existing acceptance/retraction path. Slash acknowledgement clears only the still
matching draft and is applied once. URL revocation does not delete persisted files.

The reference controller's bind retirement is stronger than general Composer
teardown. Current send/retraction/file callbacks, old attachment listeners, the
abort-confirm timer and draft URLs do not have one universal disposed-generation
guard. The submission fixture deliberately records late failure/storage results
reaching a replacement binding; these remain the deferred [issue-59 limits](https://github.com/TitanicEclair/chatobby/issues/59#issuecomment-6365617878),
not a cleanup guarantee. The extraction changes no teardown policy or permission,
transport, attachment persistence, slash language or prompt packet.
