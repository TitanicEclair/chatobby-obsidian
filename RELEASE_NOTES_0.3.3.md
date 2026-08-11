# Chatobby 0.3.3

Chatobby 0.3.3 is a reliability and guidance update for the public alpha.

## Improved

- Context usage refreshes immediately after compaction and completed turns.
  Loading state no longer displays cumulative lifetime usage as though it were
  the active context window.
- Running tool timers advance independently of other feed updates, and a
  completed turn again shows one expandable **Worked for ...** summary while
  leaving the final answer in the main feed.
- Long-running shell work can continue as a managed job, with truthful timeout
  behavior and protection against launching the same download or installation
  repeatedly.
- Web and image research uses exact retained results, source links, and licence
  details, and can show selected public images directly in chat without guessed
  URLs.
- Generated `chatobby.md` files expose Project guidance as an editable,
  lower-priority system-prompt layer that refreshes before the next turn.
- The user guide and README now explain Vault, Project, active-root, and
  attached-folder guidance, and distinguish `chatobby.md` from path-scoped
  `AGENTS.md` and compatible `CLAUDE.md` files.
- Multi-step planning, evidence-based recommendations, bounded scripting, and
  verification are more salient to Chatobby during ordinary work.
- The current subagent-only Flows page is labelled for deprecation in 0.4.0
  ahead of a future general-purpose workflow design.

macOS and Linux support remain experimental pending representative physical
device acceptance.
