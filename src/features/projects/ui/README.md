# Projects presentation

[Parent owner guide](../README.md) covers actions, drafts and runtime authority.

- [projects-view.ts](projects-view.ts) composes the page and owns its projection
  subscription, shared busy/error state, both search timers, serialized filters
  and pending-move reconciliation. Leaves call this owner instead of adding locks.
- [Editor](editor/project-editor.ts) owns the native modal/shell and create/details
  forms. The controller owns the creation draft. Native close clears modal state;
  explicit creation Cancel, handled Escape and successful creation also reset
  the draft. Stable shell keys restore values, caret and focus across refreshes.
- [Session library](library/session-library.ts) renders the rail, chat/search
  results and session menus. [Move modal](library/move-session-modal.ts) settles
  one destination or cancellation; only the parent view tracks pending moves.
- [Project detail](detail/project-detail.ts) owns folder/detail presentation and
  native root choices. Add-folders rereads the current Project after picking;
  relink/remove preserve their captured revision and canonical rejection.
- [View types](project-view-types.ts) describe local presentation callbacks;
  [elements](project-elements.ts) shares only choice/select and plural labels.
- [project-navigator-view.ts](project-navigator-view.ts) is the native sidebar;
  [navigator-state.ts](../application/navigator-state.ts) owns its saved presentation state.
- [project-directory-session-modal.ts](project-directory-session-modal.ts)
  collects launch choices/details. Dismissal resolves cancellation; initial
  focus remains modal-owned.
- [project-marker-recovery-modal.ts](project-marker-recovery-modal.ts) collects
  explicit retry/device-only/cancel decisions; the controller performs retries.

Keep labels, native focus and DOM cleanup here. Convert local picker input in
the application layer; do not reconstruct Project identities from paths or
introduce permission decisions in rendering. CSS stays with its owning UI.

[Mounted-view tests](../../../../tests/ui/projects-view.test.ts) cover shared
busy gating, editor interaction restoration, timer disposal, modal cancellation,
move conflict and target confirmation. Native installed focus/keyboard behavior
has separate acceptance; these DOM fixtures do not prove that boundary.
