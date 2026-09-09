# Frontend Styles

This guide is the editing map for Chatobby's connector CSS. It explains which
file owns a selector, how the cascade is assembled, and which invariants protect
the Obsidian-native layout and accessibility behavior.

## Canonical source and generated output

`src/ui/styles.css` is the source bundle barrel. It imports every CSS module in
intentional cascade order. The connector build emits the release-root
`styles.css` from that barrel.

Never edit root `styles.css` by hand. It is a generated release artifact and is
excluded from the reviewable source projection. Make changes in the owning
`src/ui/**/*.css` module, run the checks, and let the candidate build regenerate
the artifact when a release workflow actually requires it.

## Cascade order

The barrel orders styles by ownership and override intent:

1. semantic tokens and shell structure;
2. session/toolbar/composer primitives;
3. feed presentation and shared screen components;
4. feature page modules;
5. page-shell structural rules and reduced-motion overrides that intentionally
   close the bundle.

Do not reorder imports casually. Equal-specificity selectors rely on this
sequence for predictable overrides, especially feed content, composer states,
page layouts, and responsive feature variants.

## Module ownership

| Module | Selector ownership |
|---|---|
| `ui/shared/tokens.css` | Chatobby semantic surfaces, borders, accents, status colors, and radii mapped from Obsidian themes. |
| `ui/shell/shell.css` | Static view shell, top-level navigation, and shell regions. |
| `ui/session/session.css` | Session tabs, session metadata, and tab interaction states. |
| `ui/toolbar/toolbar.css` | Conversation toolbar actions and compact controls. |
| `ui/composer/composer.css` | Prompt editor, references, attachments, command menu, actions, and composer states. |
| `ui/feed/feed.css` | Feed rows, message content, code/markdown, streaming state, and feed-local controls. |
| `ui/feed/tools/tools.css` | Tool-call rows, status, summaries, and expandable results. |
| `ui/feed/channel-messages.css` | Channel-specific message decoration inside a feed. |
| `ui/feed/subagent-messages.css` | Subagent communication cards inside a feed. |
| `ui/feed/divider.css` | Feed dividers and compact continuity markers. |
| `ui/memory/memory-view.css` | Memory screen sections, list rows, and editing controls. |
| `ui/permissions/permissions-view.css` | Permission rules, prompts, scope controls, and decision states. |
| `ui/shared/page-shell.css` | Shared full-page header, rail/content layout, loading, empty, and error hierarchy. |
| `ui/modals/modals.css` | Connector modal framing and common modal rows/actions. |
| `ui/settings/settings.css` | Reusable settings fields, labels, descriptions, and control rows. |
| `ui/shared/motion.css` | Reduced-motion overrides for Chatobby animations and transitions. |
| `features/channels/ui/channels.css` | Channel directory and channel history page. |
| `features/events/ui/events.css` | Event cards, history, editor, and scheduling form. |
| `features/mcp/ui/mcp.css` | MCP/plugin catalogue, server detail, and configuration editor. |
| `features/projects/ui/projects.css` | Project library, details, chat browser, and folder controls. |
| `features/runtime-status/ui/runtime-status.css` | Inline runtime state plus install/update/recovery presentation. |
| `features/settings/ui/settings-page.css` | In-product settings page wrapper. |
| `features/subagents/ui/subagents.css` | Agent rail, management views, role controls, and child feed. |
| `features/tasks/ui/tasks.css` | Compact task/progress page. |

Before adding a selector, find its presentation owner. Shared patterns belong in
a shared module only when multiple surfaces intentionally share the same DOM
contract; visual similarity alone is not a reason to couple selectors.

## Selector and state conventions

- Prefix connector selectors with `.chatobby-`.
- Use `__part` for a component-owned element and `--variant` for a stable
  visual variant.
- Use `.is-*` for transient presentation state such as `.is-active` or
  `.is-loading`; do not encode runtime domain state by inventing CSS classes.
- Use `data-*` attributes for explicit layout modes that the controller owns,
  such as page or pane layout.
- Scope feature selectors under their feature root so an Obsidian theme or
  another plugin cannot accidentally acquire Chatobby component rules.

Comments should explain ownership, layout invariants, or why an unusual rule
exists. They should not narrate obvious declarations one line at a time.

## Tokens and Obsidian themes

Centralize Chatobby surface, border, accent, and status mappings in
`ui/shared/tokens.css`. Component CSS consumes those semantic variables so dark,
light, and custom Obsidian themes receive one coherent mapping layer.

Stable Obsidian typography, icon, and spacing variables can be used directly
when they represent the same presentation concept. Raw semantic color variables
such as Obsidian background, interactive, text-accent, error, warning, and
generic color families are prohibited outside the token layer by the
architecture tests.

Do not add fixed colors merely to match one theme. If a new semantic color is
needed, add one documented Chatobby token and test it in both light and dark
themes.

## Layout and responsive behavior

`ui/shared/page-shell.css` is the only owner of reusable full-page structure.
Feature modules style their rail rows, cards, controls, and local grids, but do
not reimplement the page header/content hierarchy.

Each scrollable region needs one clear scroll owner. Avoid nested full-height
scroll containers unless the interaction explicitly requires independently
scrollable panes. Narrow layouts use the named `chatobby-page` container where
possible so a split Obsidian pane responds to its own width rather than the
desktop window.

Keep DOM order useful without CSS. Responsive rules may rearrange visual layout,
but keyboard and screen-reader order must remain coherent.

## Interaction and accessibility

- Preserve `:focus-visible` treatment for all custom interactive elements.
- Use native buttons, inputs, and disclosures before recreating them with
  generic elements.
- Do not use color as the only indication of error, success, selection, or
  activity.
- Keep disabled state distinct from in-progress state.
- Add motion through the shared semantic layer and include an equivalent rule
  in `ui/shared/motion.css` when reduced motion should suppress it.
- Verify compact/narrow panes, keyboard navigation, high zoom, and both light
  and dark Obsidian themes for meaningful layout changes.

## Safe edit workflow

1. Locate the DOM owner and its CSS module.
2. Inspect the complete module and nearby cascade imports before editing.
3. Reuse an existing token or introduce a documented semantic token.
4. Keep selector scope and state ownership local to the component.
5. During visual iteration, use the registered disposable-vault loop documented
   in `AGENTS.md`: `npm run dev:vault -- --vault-root <absolute-path>`. Inspect
   the exact interaction after Chatobby alone reloads and review the freshly
   reported Obsidian errors. This bundles, copies, and hash-verifies the two
   frontend artifacts; it is not a type or regression gate.
6. At a coherent checkpoint, run TypeScript, the directly affected tests, and
   the targeted disposable-vault scenario. Expand to architecture tests when a
   selector, module, shared primitive, or ownership boundary changed.
7. Before commit or pull request, run the complete connector gate: focused
   regressions, `npm run check`, `npm test`, the Community-review check when its
   boundary changed, `git diff --check`, current documentation/changelog, and
   recorded live UI evidence for visible behavior.
8. Build and install an unpublished production candidate only when the paired
   runtime/connector or release boundary requires it. Ordinary visual edits do
   not require a candidate merely to see the change.
9. Review the generated artifact diff only when the candidate/release workflow
   intentionally regenerates it.

Documentation and comments do not replace live verification for layout or
interaction changes.
