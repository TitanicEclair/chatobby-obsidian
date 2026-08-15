# Terminal and Obsidian CLI work

Chatobby has two complementary ways to carry out technical work in and around
an Obsidian vault.

## Which route Chatobby uses

| Route                                            | Best for                                                                                                                                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary file tools and bounded terminal scripts | Reading and editing durable Markdown or code, structured frontmatter changes, repository work, repeatable bulk transformations, and commands that do not need the running Obsidian app                                  |
| Obsidian CLI                                     | Indexed search, Obsidian history or Sync semantics, link-aware changes, current settings, plugin lifecycle, command-palette actions, developer console/DOM/CSS diagnostics, and other behavior owned by the running app |
| Live editor specialist                           | Inspecting or changing an unsaved editor buffer, focus, selection, or editor undo/redo state                                                                                                                            |
| Web Viewer specialists                           | Inspecting and interacting with a web page inside Obsidian's Web Viewer; these operate on the guest page, not the Obsidian host interface                                                                               |

The CLI is available directly when useful, but it is not a requirement for
ordinary note or coding work. A command result proves what that invocation
reported; Chatobby still verifies important file, application, or rendered
state proportionately.

## Command discovery

Chatobby builds the command inventory at runtime startup for the selected
vault and refreshes it after a plugin revision changes.

- Built-in CLI commands use the packaged grammar for the supported Obsidian
  version and are checked against the live installation.
- Direct CLI commands supplied by installed plugins are discovered and parsed
  from their current help output.
- Command-palette IDs are discovered separately. An ID is not guessed from a
  display label.
- Maintained plugin overlays can provide richer grammar and usage guidance for
  a known integration, but only after live discovery confirms the command is
  installed.

The compact command names are available to the session without loading a full
manual. Chatobby can search the capability catalogue and request one exact
command description when it needs parameters or task-specific guidance.

## Inputs and results

CLI calls use a command name plus an array of argument tokens rather than a
shell-quoted command string. Chatobby supplies the current vault target itself.
The canonical shapes are conceptually:

```json
{
  "command": "backlinks",
  "arguments": ["file=Notes/Claim.md", "format=json"],
  "timeout_ms": 60000
}
```

```json
{
  "commands": [
    { "command": "files", "arguments": ["folder=Projects"] },
    { "command": "orphans", "arguments": [] }
  ],
  "failure_policy": "stop",
  "timeout_ms": 60000
}
```

The older `args` field is not accepted. Each sequence item names one exact
command; it does not repeat `obsidian`, add `vault=`, or put the command
inside its argument list. A validated sequence may stop or continue after an
error according to the requested policy.

`dev:screenshot` requires an absolute output-file path. Opening a view and
capturing it are separate calls because process completion does not prove that
the new view has rendered. Chatobby should open the target, observe readiness,
then capture it. A relative screenshot path or an open-and-screenshot sequence
is rejected before dispatch with a corrected staged example.

Results keep stdout and stderr separate and report the command, source,
version, catalogue revision, status, exit code, timing, byte and line counts,
output interpretation, effect confidence, warnings, and recovery guidance. A
completed process is not automatically a verified live or durable effect.
`not_dispatched` means the runtime rejected the request before Obsidian ran;
`unknown` means dispatch may have occurred but the final state could not be
established. Stable failure codes identify whether recovery belongs to input,
preflight, launch, process, output parsing, or artifact verification.

Large exact output is retained for bounded continuation instead of being
repeated in the model context. Screenshot output is attached only when the
selected model declares image input support and the requested artifact exists
and is readable. A missing screenshot artifact remains an output-stage failure
even if the CLI process exited successfully.

## Images embedded in notes

Chatobby receives the vault's current link format and new-attachment location
as environment facts. For an embed such as `![[image-1.png]]`, it resolves the
target using the source note and vault conventions before reading it.

An image-capable model can receive supported local image content through the
ordinary read path. A text-only model does not receive raw image bytes; it can
use metadata, OCR/document extraction, or ask to switch models when visual
inspection is materially required.

## Requirements

Obsidian CLI support requires a current Obsidian desktop installation whose
installer provides the CLI and an enabled CLI command. Chatobby reports the
installed app and installer versions and keeps unavailable or TUI-only
commands from being executed through the non-interactive facade.

For current command syntax and setup, see the official
[Obsidian CLI documentation](https://help.obsidian.md/cli).
