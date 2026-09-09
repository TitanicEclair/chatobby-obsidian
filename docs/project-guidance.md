# Project guidance: `chatobby.md`, `AGENTS.md`, and `CLAUDE.md`

Chatobby supports both its own project-guidance file and the standard
coding-agent instruction files. They overlap slightly, but they have different
discovery rules and are most useful for different kinds of projects.

| File          | Best use                                                                                                                  | Discovery                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `chatobby.md` | Chatobby-specific system guidance plus optional prompt/workspace configuration                                            | Automatically prepared at the vault root for a Vault chat or the active root for a Project chat; it does not search ordinary nested folders |
| `AGENTS.md`   | Repository instructions, development commands, code conventions, verification requirements, and directory-scoped guidance | Loaded from the registered root toward the file or folder Chatobby is about to use                                                          |
| `CLAUDE.md`   | Compatibility for repositories that already keep agent instructions under this filename                                   | Loaded through the same path-scoped mechanism as `AGENTS.md`; when both exist in one directory, `AGENTS.md` is used there                   |

Neither file grants permission, and neither should contain secrets. Built-in
safety, evidence, and permission behavior remains authoritative.

### A simple `chatobby.md`

Start a new Vault or Project chat and Chatobby creates the file automatically.
The generated file contains the current properties and an empty body. For the
common case, leave the properties enabled and add plain Markdown below the
closing `---` line:

```markdown
# Project guidance

- Preserve the existing note structure and writing style.
- Put new research notes in `Research/`.
- Link new notes to [[Project Index]].
- Ask before reorganizing folders or renaming existing notes.
- When writing a project report, distinguish confirmed facts from proposals.
```

The body becomes lower-priority project guidance for every chat in that
workspace. It is sent as a system-prompt section after Chatobby's protected
built-in sections, not as an ordinary user message.

| Chat situation               | Body guidance                                                                                                          | Frontmatter configuration                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Vault chat                   | Vault-root `chatobby.md`                                                                                               | Vault-root properties are compiled when the runtime is prepared.                                                  |
| Project chat                 | Vault-root body plus the body from the chat's active Project root                                                      | Active-root properties configure the session. Vault properties are not inherited as a second configuration layer. |
| Added Project folder         | Its body can activate when Chatobby first works inside that registered folder.                                         | Its properties do not replace the current chat's base configuration.                                              |
| Ordinary nested folder       | A nested `chatobby.md` is not discovered automatically.                                                                | Nested properties are not inherited; use `AGENTS.md` or `CLAUDE.md` for path-specific repository rules.           |
| Project primary root changes | Existing chats retain their stored active root until moved or reopened. New chats default to the current primary root. | A newly prepared runtime reads its selected active root.                                                          |

| Change                                                | When it is used                                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit only the Markdown body                           | On the next new message you send. The prior body is replaced; a turn already running is unchanged.                                           |
| Change a prompt-module switch                         | When a new chat or recreated/reconnected session runtime prepares its base prompt.                                                           |
| Change a workspace-directory property                 | When a new chat or recreated/reconnected session runtime prepares its workspace conventions.                                                 |
| Add a property introduced by a later Chatobby version | Normally automatic. Chatobby synchronizes missing supported properties while preserving your values, comments, unknown properties, and body. |

Changing a Project's folder list does not silently change an existing chat's
active root. If you need that chat to use another root's properties, move or
reopen it against that root so its runtime is prepared with the correct cwd.

Use `chatobby.md` for durable conventions. Do not use it for:

- API keys or other secrets;
- a temporary one-turn request;
- large note collections that should be searched normally;
- permission grants;
- changing or bypassing built-in safety instructions;
- data that should be calculated afresh.

### Advanced `chatobby.md` configuration

Most users should keep every built-in prompt section enabled. If you need a
specialized project, frontmatter can independently control Chatobby prompt
modules and workspace directories:

```markdown
---
chatobby-prompt-schema: 1
chatobby-system-prompt: true
chatobby-task-guidance: true
chatobby-tool-guidance: true
chatobby-coding-workflow-guidance: true
chatobby-artifact-guidance: true
chatobby-memory-guidance: true
chatobby-personal-workflow-guidance: true
chatobby-subagent-guidance: true
chatobby-automation-guidance: true
chatobby-markdown-output-guidance: true
chatobby-artifacts-directory: .chatobby/workspace/artifacts
chatobby-sandbox-directory: .chatobby/workspace/sandbox
chatobby-tasklists-directory: .chatobby/workspace/tasklists
chatobby-reports-directory: .chatobby/workspace/reports
chatobby-inbox-directory: .chatobby/workspace/inbox
---

# Project guidance

Keep generated reports concise and link every report to [[Project Index]].
```

### Current properties

| Property                              |                         Default | What it controls                                                                                          |
| ------------------------------------- | ------------------------------: | --------------------------------------------------------------------------------------------------------- |
| `chatobby-prompt-schema`              |                             `1` | The file-format version. Chatobby owns and updates this exact value.                                      |
| `chatobby-system-prompt`              |                          `true` | Chatobby's core working temperament, evidence discipline, conversational behavior, and outcome ownership. |
| `chatobby-task-guidance`              |                          `true` | First-class planning and progress tracking for substantive multi-step work.                               |
| `chatobby-tool-guidance`              |                          `true` | Capability discovery and correct routing among Obsidian, web, file, shell, and specialist tools.          |
| `chatobby-coding-workflow-guidance`   |                          `true` | Repository understanding, implementation, testing, and live verification behavior.                        |
| `chatobby-artifact-guidance`          |                          `true` | Durable working files, reports, and artifact organization.                                                |
| `chatobby-memory-guidance`            |                          `true` | Durable memory, correction, retrieval, and continuity behavior.                                           |
| `chatobby-personal-workflow-guidance` |                          `true` | Personal organization and lifestyle-work guidance with privacy and inference boundaries.                  |
| `chatobby-subagent-guidance`          |                          `true` | When and how bounded subagents should be delegated and supervised.                                        |
| `chatobby-automation-guidance`        |                          `true` | Events, schedules, triggers, and deliberate recurring work.                                               |
| `chatobby-markdown-output-guidance`   |                          `true` | Obsidian-ready Markdown, wikilinks, embeds, properties, callouts, tasks, and blocks.                      |
| `chatobby-artifacts-directory`        | `.chatobby/workspace/artifacts` | Preferred vault-relative location for durable generated artifacts.                                        |
| `chatobby-sandbox-directory`          |   `.chatobby/workspace/sandbox` | Preferred vault-relative location for temporary working files.                                            |
| `chatobby-tasklists-directory`        | `.chatobby/workspace/tasklists` | Preferred vault-relative location for durable task-list artifacts.                                        |
| `chatobby-reports-directory`          |   `.chatobby/workspace/reports` | Preferred vault-relative location for generated reports.                                                  |
| `chatobby-inbox-directory`            |     `.chatobby/workspace/inbox` | Preferred vault-relative location for items awaiting organization.                                        |

Directory properties are conventions; changing one does not create that folder
or grant access to it. Values must remain within the Vault or Project boundary.
Disabling built-in sections can remove important behavioral guidance, so it is
an advanced option rather than a recommended first customization. Runtime-owned
product boundaries, immutable safety and confidentiality guidance, current
environment facts, and the native skill catalogue remain enabled regardless of
these switches.

### A simple `AGENTS.md`

For a repository, put instructions such as these in `AGENTS.md`:

```markdown
# Development rules

- Read the affected implementation before editing it.
- Preserve unrelated changes in the worktree.
- Run `npm run check` after code changes.
- Run focused tests for every modified test file.
- Do not build or publish a release unless explicitly requested.
```

Use additional `AGENTS.md` files in nested directories when a particular part
of a repository needs more specific guidance. Existing `CLAUDE.md` files are
supported as a compatibility alternative and use the same path-scoped loading.
If both names exist in one directory, Chatobby uses a non-empty `AGENTS.md` for
that directory. An empty `AGENTS.md` does not suppress compatible guidance in
`CLAUDE.md`. Avoid duplicating contradictory rules across `chatobby.md`,
`AGENTS.md`, and `CLAUDE.md`.
