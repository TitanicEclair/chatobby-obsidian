# Chatobby for Obsidian

**A full agent workspace inside your vault.**

[![Install Chatobby in Obsidian](https://img.shields.io/badge/Install%20in-Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=chatobby)
[![Public alpha](https://img.shields.io/badge/release-public%20alpha-2F81F7?style=for-the-badge)](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/alpha-guide.md)
[![Desktop platforms](https://img.shields.io/badge/platform-Windows%20%2B%20macOS%20%2B%20Linux%20alpha-4B5563?style=for-the-badge)](#platform-and-alpha-status)
[![Star Chatobby on GitHub](https://img.shields.io/github/stars/TitanicEclair/chatobby-obsidian?style=for-the-badge&logo=github&label=Star%20Chatobby)](https://github.com/TitanicEclair/chatobby-obsidian)

**Community:** [GitHub Discussions](https://github.com/TitanicEclair/chatobby-obsidian/discussions) · [Issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues) · [Documentation](https://github.com/TitanicEclair/chatobby-obsidian/tree/main/docs)

**Chatobby** gives you a **local-first agent workspace**, built with first-class
support for Obsidian and coding.

Chatobby can understand your notes, use tools, work across projects,
recall memory and past sessions, and coordinate subagents when a task grows.

You can use a hosted model or connect a model server already running on your
own computer. Each Vault or Project chat can also have a visible,
user-editable `chatobby.md` system-prompt layer, so the way Chatobby works can
fit the project without modifying the plugin or exposing private internals.

Your conversations, permissions, context, scheduled work, and delegated work all
remain visible inside Obsidian.

Only **model calls** are sent to a provider of your choosing,
with continuously updated support for OpenAI, Anthropic, DeepSeek, Google Gemini,
Z.AI, Xiaomi, OpenRouter, Hugging Face, and many more. You can also connect a
running local server that offers an OpenAI-compatible or Anthropic
Messages-compatible API.

| Provider group | Supported services |
| --- | --- |
| Major model APIs | OpenAI, Anthropic, Google Gemini, Azure OpenAI, Google Vertex AI, Amazon Bedrock |
| Model hubs and gateways | OpenRouter, Vercel AI Gateway, Hugging Face, NVIDIA NIM, Fireworks AI, Together AI, Cloudflare Workers AI, Cloudflare AI Gateway |
| Additional model providers | DeepSeek, Groq, Cerebras, Mistral, xAI, Z.AI, Xiaomi MiMo, Moonshot AI, MiniMax, Ant Ling |
| Coding and account-backed access | OpenAI Codex, GitHub Copilot, Kimi Coding, Z.AI Coding Plan, Xiaomi Token Plan, OpenCode Zen, OpenCode Go |

Models change more often than this README. See the maintained
[providers and models guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/providers-and-models.md)
for provider variants, setup notes, and how to check the exact models available
in your installed Chatobby version.

Though it can be, Chatobby is built not just to be another isolated chatbot sidebar.
Chatobby is designed as a workspace in which an agent can help with real
vault work, research, writing, planning, coding, Obsidian browser capabilities,
and longer-running projects while you retain control over what it may do.

> **Public alpha:** Chatobby is free while it is under active development.
> It is important to practice discipline with backing up important vaults
> and starting small to learn how to use Chatobby.
> Interfaces, behavior, and storage contracts may change between alpha releases.

## Support Chatobby's development

> If you like Chatobby and want to support its development
> and continuous updates, I would love to hear your feedback!
>
> If you love Chatobby, and want to keep our devs (me) unemployed, I
> would greatly appreciate donations :")
> It's actually so exciting to see its capabilities now and I love doing this <3

[![Support Chatobby on Patreon](https://img.shields.io/badge/Support%20Chatobby%20on%20Patreon-FF424D?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/cw/MadelynCruzTan/membership)

Support is completely optional. It does not unlock features or change the free
alpha experience.

#### **Chatobby is available on Windows, macOS, and Linux. macOS and Linux support are experimental and have not yet been fully tested on physical hardware.**

## Contents

- [Support Chatobby's development](#support-chatobbys-development)
- [What makes Chatobby different](#what-makes-chatobby-different)
- [The agentic experience](#the-agentic-experience)
  - [Run local models on your own hardware](#run-local-models-on-your-own-hardware)
  - [Customize the system prompt for each workspace](#customize-the-system-prompt-for-each-workspace)
- [Install](#install)
- [A guided first fifteen minutes](#a-guided-first-fifteen-minutes)
- [User guides](#user-guides)
- [Project guidance: `chatobby.md`, `AGENTS.md`, and `CLAUDE.md`](#project-guidance-chatobbymd-agentsmd-and-claudemd)
- [Memory](#memory)
- [Context Queries](#context-queries)
- [Skills](#skills)
- [Tasks, roles, subagents, Flows, and channels](#tasks-roles-subagents-flows-and-channels)
- [Events](#events)
- [Permission policies](#permission-policies)
- [More things to ask Chatobby](#more-things-to-ask-chatobby)
- [Platform and alpha status](#platform-and-alpha-status)
- [Privacy and data flow](#privacy-and-data-flow)
- [Source and licensing](#source-and-licensing)
- [Help shape Chatobby](#help-shape-chatobby)

## What makes Chatobby different

Most AI integrations stop at a chat box or QnA about your vault.
Chatobby is built around the larger working experience required when
an agent is allowed to do useful work, and track tasks for you.

| Chatobby capability     | What it means for you                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool-using agent        | Ask for an outcome instead of manually copying every note and instruction into a prompt.                                                                   |
| Visible work            | Follow Chatobby's thoughts, reasoning summaries, tool activity, permission requests, tasks, errors, and results in one feed.                               |
| Projects                | Keep related chats and one or more working folders together while Vault chats remain available for general work.                                         |
| Permission policies     | Decide which files, commands, tools, channels, and automated actions a session may use. Create fully customizable permission presets.                      |
| Memory and context      | Retain approved knowledge and inject small pieces of live project data when needed.                                                                        |
| Subagents and legacy Flows | Delegate focused work without losing the main conversation. The current subagent-only Flows surface is being retired in 0.4.0.                          |
| Events                  | Run bounded one-off or repeating work with an assigned project, agent, policy, and runtime limits.                                                         |
| Local model servers     | Connect Ollama, LM Studio, vLLM, llama.cpp, or another compatible server through Chatobby settings.                                                        |
| Custom project prompt   | Use the automatically prepared `chatobby.md` to add durable system guidance and choose optional prompt modules.                                           |
| Extensible runtime      | Use providers, models, skills, MCP servers, project instructions, and context queries without turning the Obsidian plugin into an unmaintainable monolith. |
| Custom themes           | Chatobby's theme follows your vault's, and fits in to your preferences                                                                                     |

## The agentic experience

### Work with your actual vault

Ask Chatobby about the note you are viewing, search for related material,
compare ideas across folders, follow backlinks, open the right file, or request
a precise edit. It can help preserve Obsidian-specific structure such as
frontmatter, wikilinks, embeds, block references, tasks, tags, callouts, Canvas,
and Bases rather than treating every note as generic text.

Examples:

- `Summarize the active note and identify its unresolved questions.`
- `Find the notes that best support this claim and explain the connection.`
- `Turn these scattered research notes into a linked project index.`
- `Check this folder for unresolved links and propose a cleanup plan.`
- `Open the note where I last described the deployment problem.`

### See work happen, not just the final answer

Responses stream into the conversation while compact progress and tool activity
remain inspectable. Permission requests appear where you are already working.
Longer tasks can expose a small task list above the composer, and completed work
collapses away instead of permanently occupying the interface.

You can stop a turn, inspect what the agent used, copy a full Markdown response,
or select only the portion you need.

### Work with images and documents

Paste an image into the composer or attach a supported document. Chatobby keeps
the attachment visible with the message. Attached files can be opened through
the operating system, while the document reader extracts bounded text from
supported Office, OpenDocument, PDF, RTF, HTML, Markdown, CSV, and text files.
Built-in OCR can recover text from image-only documents without requiring a
multimodal model.

Understanding photographs, diagrams, page layout, and other visual meaning
still depends on a multimodal model or a configured advanced OCR engine.

### Continue real projects

Every chat belongs either to the Vault or to a Project. A Project keeps related
conversations together and can include one primary folder plus other working
folders. Sessions retain their history, Project identity, and current working
set so you can continue the real work later instead of starting from nothing.

Browsing the Projects page never silently changes the chat that is running.
Open a stored chat to resume it, choose **New chat in Project** for a separate
conversation, or move an existing chat between Vault and Projects from its
context menu. Obsidian tabs remain the boundary between independent active
conversations, while the agent rail switches between a main session and its
subagents.

Right-click a folder, or a file inside it, to start Project work from that
folder. Adding another folder to the Project makes it available to its chats
without granting capabilities denied by the active permission policy.

### Customize the system prompt for each workspace

Chatobby automatically prepares a visible `chatobby.md` in the vault root for
a Vault chat or in the primary Project root for a Project chat. Leave the
properties alone and write ordinary Markdown below them to add durable naming,
formatting, source, verification, or workflow preferences.

The body is a real lower-priority system-prompt section placed after Chatobby's
protected built-in prompt—not a repeated user message. Body edits replace the
old guidance on the next message you send. Advanced users can also switch
optional built-in prompt modules on or off; those frontmatter changes take
effect when a new chat or recreated/reconnected session runtime is prepared.

See [Project guidance](#project-guidance-chatobbymd-agentsmd-and-claudemd) for the full
property list and examples.

### Use Chatobby for coding as well as notes

When the task is coding-oriented, Chatobby can treat the real repository,
source files, project instructions, tests, logs, and built application as the
primary working environment. It does not need to force ordinary coding work
through vault search simply because the interface lives in Obsidian.

For Obsidian plugin development, the agent can combine repository work with
read-only developer diagnostics for the live app, including console errors,
DOM and CSS inspection, screenshots, and supported Obsidian CLI operations.

Examples:

- `Diagnose this failing test, fix the cause, and run the focused verification.`
- `Review the current implementation against AGENTS.md and report concrete risks.`
- `Build the plugin and verify the affected workflow in the test vault.`
- `Inspect the live Obsidian console and determine why this view did not render.`

### Delegate without losing the thread

Create specialist subagents for bounded research, exploration, coding, review,
or other focused work. The agent rail lets you move between the main agent and
each active subagent. Every subagent has its own feed instead of being rendered
as an undifferentiated block in the main conversation.

Reusable roles provide consistent instructions, model choices, limits, and
permission policies. The existing subagent-only **Flows** feature can connect
multiple roles into a validated execution graph, but it is scheduled for
deprecation in 0.4.0. New work should normally use direct subagents while a
future general-purpose workflow system is designed around more than subagent
nodes.

Channels provide a durable, inspectable place for agent-to-agent communication.
They are separate from user-facing session messages, so operational
communication does not have to overwhelm the main conversation.

### Keep useful continuity without hiding it

Chatobby uses several different continuity surfaces because they solve
different problems:

- **Session history** preserves the chronological conversation and tool work.
- **Memory** stores user-approved durable facts, preferences, and decisions.
- **Project guidance** tells the agent how work in one project should be done.
- **Context Queries** compute small pieces of current project data.
- **Skills** describe reusable procedures.
- **Tasks** track the steps of the current session.
- **Events** trigger bounded future work.

These are not interchangeable. In particular, memory is not hidden policy,
Context Query output is not a system instruction, and prompt text does not grant
permission.

### Automate deliberately

Events can represent one-off, scheduled, or repeating work. Each Event can be
associated with a project, agent, permission policy, schedule, maximum runtime,
and daily run limit. Run history remains visible so automated work can be
inspected instead of disappearing into an unaccountable background process.

Examples:

- `Every weekday at 6 PM, summarize today's project notes into the daily note.`
- `On the first day of each month, review unresolved tasks in this project.`
- `Tomorrow at 9 AM, run the saved research workflow with the review policy.`

### Choose what the agent may do

Permission policies control access to files, directories, commands, tools,
settings, channels, and automated work. Choose a policy per session, switch it
from the composer, respond to permission requests in the feed, and create more
focused policies for particular roles or tasks.

Policies are separate from instructions. Telling the agent to edit a file does
not silently bypass a policy that requires confirmation or denies the operation.

### Bring the provider and model you want

Provider, model, and reasoning effort are session controls. Chatobby can use
supported built-in providers and custom model metadata. The provider account,
subscription, API key, and usage charges remain between you and that provider;
Chatobby does not resell model tokens during the free alpha.

### Run local models on your own hardware

Chatobby can connect to a server you already run through Ollama, LM Studio,
vLLM, llama.cpp, or another OpenAI-compatible or Anthropic
Messages-compatible endpoint. Open **Chatobby Settings -> Local model
servers**, choose a preset or API format, enter the exact model ID, and run the
real connection test before saving.

You can also ask Chatobby to help choose a realistic local setup for your
device. With permission, it can inspect relevant RAM, GPU, and VRAM facts,
compare quantization and hybrid CPU/GPU offload, link current official setup
guides, and explain what should be tested rather than treating hardware fit as
certain. Chatobby connects to the server; it does not silently install, start,
or expose one.

See the [providers and models guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/providers-and-models.md)
for presets, API modes, authentication choices, and a complete setup example.

### Research the current web

Chatobby includes account-free public-web search. In Chatobby **Settings -> Web
research**, you can optionally connect your own Brave Search API key for
stronger freshness, language, region, and date filtering. The key stays in
Obsidian's secret storage. Search results identify whether basic search,
enhanced search, or a genuine fallback was used, so an unconfigured provider is
not reported as an outage.

## Install

### Recommended: install through Obsidian

1. Open **Settings -> Community plugins -> Browse**.
2. Search for **Chatobby**, then select **Install** and **Enable**.
3. Open Chatobby from the ribbon.
4. If the local runtime is missing, select **Install runtime** in the Chatobby
   view.
5. Review the requested installation and alpha notices, then confirm.
6. Open Chatobby, select the **Settings** gear in its top bar, then connect a
   provider or local model server. Credential values continue to use
   Chatobby's protected local credential store.
7. Return to Chatobby and send your first message.

The plugin downloads the runtime only after confirmation. It cryptographically
verifies the release descriptor and included files, installs the runtime for the
current operating-system account, and reconnects to it. When a compatible runtime update
is available, Chatobby can present an update action inside the plugin.

Chatobby itself is free during the public alpha. The model provider you choose
may require an account, API key, subscription, or usage payment.

For more detail, see the [installation guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/installation.md),
[alpha guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/alpha-guide.md), and
[troubleshooting guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/troubleshooting.md).

## A guided first fifteen minutes

Start with the default permission policy and a copied test note.

### 1. Ask about what is open

Open a note and send:

> Summarize the active note, list its open questions, and suggest one useful
> next step. Do not edit anything yet.

This demonstrates active-note context without immediately granting mutation
authority.

### 2. Search across the project

Send:

> Find the most relevant notes for this topic. Explain why each one matters and
> include wikilinks.

This tests discovery, evidence selection, and Obsidian-native output.

### 3. Approve one small edit

Send:

> Add a short `Next steps` section to this copied note. Preserve its existing
> frontmatter and style, and show me any permission request that is required.

### 4. Attach something

Paste a screenshot or attach a small document, then ask Chatobby to summarize
it or connect it to the current note.

### 5. Explore the workspace

Use the top ribbon to open Projects, Permissions, Memory, Events, Queries,
Channels, Subagents, Plugins, and Settings. Projects replaces the former
directory session picker with one searchable Vault/Project chat library. At the
top of Settings, **Add guide to vault** can copy or update the linked Chatobby
Guide. These pages are part of the same agent workspace; opening them does not
change the Project or chat currently running.

## User guides

These guides explain both the UI workflow and what to ask Chatobby when you want
the agent to create or manage the feature for you:

| Guide | Use it for |
|---|---|
| [Projects](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/projects.md) | Keep related chats and working folders together without confusing Project membership with permission. |
| [Providers and models](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/providers-and-models.md) | Connect a supported provider and check how to find the models available in your installed Chatobby version. |
| [MCP connections](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/mcp-connections.md) | Add verified or custom online and local connections, test them, and permission their discovered tools deliberately. |
| [Context Queries](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/context-queries.md) | Safely compute small typed project data at session start or before a turn, including the complete supported script and SDK contract. |
| [Subagents](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/subagents.md) | Launch bounded specialist workers with appropriate roles, policies, limits, communication, and lifecycle handling. |
| [Flows (legacy)](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/workflows.md) | Review the existing subagent-only Flow feature while it remains available. It is scheduled for deprecation in 0.4.0 in favor of general-purpose workflows. |
| [Events](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/events.md) | Create deliberate one-off or repeating automated work with schedules, policies, limits, and inspectable history. |

You can build these features through their pages or describe the outcome to
Chatobby and ask it to use the dedicated management tools. Chatobby never needs
to inspect its own product source to use them.

## Project guidance: `chatobby.md`, `AGENTS.md`, and `CLAUDE.md`

Chatobby supports both its own project-guidance file and the standard
coding-agent instruction files. They overlap slightly, but they have different
discovery rules and are most useful for different kinds of projects.

| File | Best use | Discovery |
|---|---|---|
| `chatobby.md` | Chatobby-specific system guidance plus optional prompt/workspace configuration | Automatically prepared at the vault root for a Vault chat or the active root for a Project chat; it does not search ordinary nested folders |
| `AGENTS.md` | Repository instructions, development commands, code conventions, verification requirements, and directory-scoped guidance | Loaded from the registered root toward the file or folder Chatobby is about to use |
| `CLAUDE.md` | Compatibility for repositories that already keep agent instructions under this filename | Loaded through the same path-scoped mechanism as `AGENTS.md`; when both exist in one directory, `AGENTS.md` is used there |

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

| Chat situation | Body guidance | Frontmatter configuration |
|---|---|---|
| Vault chat | Vault-root `chatobby.md` | Vault-root properties are compiled when the runtime is prepared. |
| Project chat | Vault-root body plus the body from the chat's active Project root | Active-root properties configure the session. Vault properties are not inherited as a second configuration layer. |
| Added Project folder | Its body can activate when Chatobby first works inside that registered folder. | Its properties do not replace the current chat's base configuration. |
| Ordinary nested folder | A nested `chatobby.md` is not discovered automatically. | Nested properties are not inherited; use `AGENTS.md` or `CLAUDE.md` for path-specific repository rules. |
| Project primary root changes | Existing chats retain their stored active root until moved or reopened. New chats default to the current primary root. | A newly prepared runtime reads its selected active root. |

| Change | When it is used |
|---|---|
| Edit only the Markdown body | On the next new message you send. The prior body is replaced; a turn already running is unchanged. |
| Change a prompt-module switch | When a new chat or recreated/reconnected session runtime prepares its base prompt. |
| Change a workspace-directory property | When a new chat or recreated/reconnected session runtime prepares its workspace conventions. |
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

| Property | Default | What it controls |
|---|---:|---|
| `chatobby-prompt-schema` | `1` | The file-format version. Chatobby owns and updates this exact value. |
| `chatobby-system-prompt` | `true` | Chatobby's core working temperament, evidence discipline, conversational behavior, and outcome ownership. |
| `chatobby-task-guidance` | `true` | First-class planning and progress tracking for substantive multi-step work. |
| `chatobby-tool-guidance` | `true` | Capability discovery and correct routing among Obsidian, web, file, shell, and specialist tools. |
| `chatobby-coding-workflow-guidance` | `true` | Repository understanding, implementation, testing, and live verification behavior. |
| `chatobby-artifact-guidance` | `true` | Durable working files, reports, and artifact organization. |
| `chatobby-memory-guidance` | `true` | Durable memory, correction, retrieval, and continuity behavior. |
| `chatobby-personal-workflow-guidance` | `true` | Personal organization and lifestyle-work guidance with privacy and inference boundaries. |
| `chatobby-subagent-guidance` | `true` | When and how bounded subagents should be delegated and supervised. |
| `chatobby-automation-guidance` | `true` | Events, schedules, triggers, and deliberate recurring work. |
| `chatobby-markdown-output-guidance` | `true` | Obsidian-ready Markdown, wikilinks, embeds, properties, callouts, tasks, and blocks. |
| `chatobby-artifacts-directory` | `.chatobby/workspace/artifacts` | Preferred vault-relative location for durable generated artifacts. |
| `chatobby-sandbox-directory` | `.chatobby/workspace/sandbox` | Preferred vault-relative location for temporary working files. |
| `chatobby-tasklists-directory` | `.chatobby/workspace/tasklists` | Preferred vault-relative location for durable task-list artifacts. |
| `chatobby-reports-directory` | `.chatobby/workspace/reports` | Preferred vault-relative location for generated reports. |
| `chatobby-inbox-directory` | `.chatobby/workspace/inbox` | Preferred vault-relative location for items awaiting organization. |

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
If both names exist in one directory, Chatobby uses `AGENTS.md` for that
directory. Avoid duplicating contradictory rules across `chatobby.md`,
`AGENTS.md`, and `CLAUDE.md`.

## Memory

Memory is for durable knowledge that should remain useful across sessions:
preferences, stable facts, project decisions, terminology, and established
constraints.

Chatobby can surface a non-blocking memory suggestion in the feed. You can
approve it, reject it, or ignore it. Pending suggestions remain available on
the Memory page, where stored records can be reviewed, edited, archived,
deleted, and inspected for history or technical details.

Good memory:

- `The project uses Singapore time for all deadlines.`
- `The user prefers concise technical status reports.`
- `Deployment decision: use the staging vault before production.`

Poor memory:

- a temporary task;
- a secret;
- a large transcript;
- an instruction intended to bypass permission;
- a value that changes every few minutes.

## Context Queries

Full instructions: [Context Queries guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/context-queries.md).

Context Queries are small project-owned scripts that produce typed data for an
agent session. They are useful when current information should be computed from
a local or external source instead of saved as memory or repeatedly searched by
the agent.

A query runs at one of two times:

- **Session start** for information that should be established once when a
  session begins.
- **Every turn** only when a value can materially change between adjacent user
  messages.

Good examples include:

- current Git branch and changed-file count;
- current project milestone data;
- a small status summary from an approved local service;
- the current date or selected calendar state;
- bounded statistics derived from a project-owned dataset.

Avoid using a Context Query for:

- secrets;
- ordinary note retrieval;
- large datasets or documents;
- instructions or permission policy;
- data that does not need to be injected automatically;
- expensive work on every user message.

Use the Queries page to review names, descriptions, trigger timing, enabled
state, and test results. Chatobby can also create, inspect, update, test, enable,
disable, and delete queries through its dedicated tools. The Queries page keeps
normal usage approachable rather than turning the interface into a code editor;
the project retains the script files under `.chatobby/queries/`.

Example requests:

- `Create a disabled session-start Context Query named Repository status. It should return the current branch and changed-file count. Test it, but do not enable it yet.`
- `List this project's Context Queries and explain which ones really need to run every turn.`
- `Test the project-status query and show me the typed result and any error.`

Query code is trusted project code. Testing disabled code and enabling a query
requires project trust and visible confirmation. Output is bounded and injected
as untrusted contextual data, not as a system instruction.

<!--
Show the minimal Queries list with a useful name, description, session-start
trigger, and successful test state. Do not show raw script code.
-->

## Skills

Skills provide reusable procedures for recurring work. User and project skills
can be selected when appropriate, while Chatobby also ships runtime-owned
operating skills for supported capabilities such as coding work, Web Viewer
operation, MCP setup, model-provider configuration, Context Queries,
permissions, subagents, command shells, and runtime diagnosis.

Runtime-owned skills are immutable and are not exposed as editable files or
ordinary slash-command entries. The agent selects them semantically when the
task requires them; selection is not based on a hardcoded list of trigger
phrases.

Use a project skill when the procedure belongs only to one project. Use a user
skill when the procedure is genuinely reusable across projects. Do not put
personal assumptions into a skill intended for other users.

## Obsidian views and Web Viewer pages

Chatobby treats Obsidian itself and a webpage opened in Web Viewer as two
separate interactive surfaces. Obsidian panes, tabs, editors, plugin pages,
Chatobby pages, focus, and workspace layout belong to the Obsidian host. The
webpage inside a Web Viewer runs in its own page context with different
content, controls, console messages, and element references.

This distinction lets Chatobby inspect or operate the intended surface without
mistaking an Obsidian control for a webpage control. A Web Viewer tab can still
be selected or closed as an Obsidian pane, but reading, clicking, typing, and
page diagnostics happen inside its webpage. Host-interface and webpage
references are not interchangeable.

## Tasks, roles, subagents, Flows, and channels

Full instructions: [Subagents guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/subagents.md) and
[Workflows guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/workflows.md).

These surfaces cover different levels of coordination:

| Surface | Purpose |
|---|---|
| Task | Tracks one session's current multi-step work |
| Role | Defines a reusable kind of specialist agent |
| Subagent run | Performs one bounded delegated assignment |
| Flow (legacy) | Connects reusable subagent roles into a validated execution graph during the 0.3.x alpha |
| Channel | Carries durable agent-to-agent communication |

Start with one subagent when a task has a clearly separable research or review
component. The current subagent-only Flows feature is scheduled for deprecation
in 0.4.0, so avoid building new long-lived processes around it. Existing Flows
remain documented so their behavior is understandable while Chatobby moves
toward a general-purpose workflow design whose steps do not all have to be
subagents.

Example requests:

- `Delegate a bounded review of these sources to one research subagent. Limit it to five sources and reconcile the findings here.`
- `Create a reusable role for web-only fact checking with a focused permission policy.`
- `Inspect this existing Flow, explain its dependencies, and tell me what should be preserved before Flows are retired.`
- `Show me the active Flow, its blocked nodes, and any permission request that needs my decision.`

The main agent remains the supervisor. Delegation must not be used to bypass
permissions or conceal work from the user.

## Events

Full instructions: [Events guide](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/events.md).

Events are durable triggers for future agent work. Use them when the timing is
part of the requirement rather than merely another step in the current
conversation.

When creating an Event, review:

- project directory;
- assigned agent;
- permission policy;
- date and time;
- repetition and end condition;
- maximum runtime;
- daily run limit;
- expected output and failure behavior.

Do not use an Event as an invisible permission escalation. Scheduled work uses
its assigned policy and remains visible in run history.

<!--
Show a readable repeating schedule, assigned project/policy, and one successful
history entry.
-->

## Permission policies

New sessions begin with **Obsidian**, the vault-focused default. **Approve
safe** asks before potentially unsafe work, **Full access** permits the broadest
surface, **Read only** blocks changes, and **Auto** privately classifies the
checks that Approve safe would otherwise ask you to decide. Auto may add a
small model request before a tool runs and fails closed if classification
cannot complete. Create narrower custom policies for specialized roles,
web-only research, automation, or sensitive projects.

When customizing a policy:

1. Inspect the current policy rather than overwriting it blindly.
2. Decide whether each capability should allow, ask, or deny.
3. Keep file, external-directory, command, settings, tool, and channel access
   conceptually separate.
4. Save the customized policy without assuming that customization should also
   assign it to the current session.
5. Select the policy explicitly for the session or role that should use it.
6. Verify the saved rules after changing them.

Permission instructions do not belong in `chatobby.md`, memory, Context Query
output, or an agent message. The Permissions page and permission tools are the
authority-bearing surfaces.

Connected MCP plugins appear as separate capability groups after discovery.
Their tools start denied in every policy until you explicitly choose Allow or
Ask; connecting a service does not grant an agent permission to use it.

<!--
Show one readable policy and a visible ask/allow/deny decision without exposing
credentials or a personal filesystem path.
-->

## More things to ask Chatobby

### Vault and knowledge work

- `Compare my notes on these two approaches and create a decision table.`
- `Find claims in this draft that need sources and locate supporting notes.`
- `Turn this lecture transcript into revision-ready Obsidian notes.`
- `Trace the backlinks around this concept and identify missing connections.`

### Planning and administration

- `Review this project's recent sessions and give me a compact continuation brief.`
- `Find incomplete tasks related to the move and group them by urgency.`
- `Create a one-off Event for this deadline with a conservative permission policy.`

### Research

- `Research this question on the web, preserve source links, and compare the findings with my vault.`
- `Open this page in Web Viewer, inspect its actual content, and extract the relevant evidence.`
- `Use two bounded subagents to research opposing views, then reconcile disagreements.`

### Coding and plugin work

- `Inspect the repository instructions and determine the correct test command before editing.`
- `Fix this regression, add a focused test, and verify the built Obsidian workflow.`
- `Check the live plugin console and DOM state rather than guessing from the source alone.`

## Platform and alpha status

The current alpha supports desktop Obsidian on Windows 10 or 11 x64, macOS 11
or later on Apple Silicon and Intel, and glibc-based Linux on x64 and arm64.
macOS and Linux packages are built and exercised on native GitHub runners, but
neither platform has completed representative physical-device acceptance.
Flatpak, Snap, musl, and other confined Linux environments remain unverified.

Important limitations:

- Chatobby uses a separate local runtime in addition to the Community plugin.
- The runtime executable is cryptographically verified by Chatobby but is not
  currently Authenticode-signed, so Windows may show a publisher warning.
- macOS uses an ad-hoc code signature rather than Apple notarization and may
  require one explicit **Open Anyway** approval. Chatobby never changes
  Gatekeeper or quarantine settings.
- Linux support currently targets ordinary glibc desktop installations. A
  libc or confinement mismatch fails before execution and keeps the previous
  runtime available.
- Provider availability, multimodal support, and tool calling depend on the
  selected model and provider.
- Agent actions can modify files or run commands when permitted. Begin with a
  copied note or test vault and review permission prompts.
- Alpha storage and configuration formats may require migration between
  releases.
- There is no Chatobby account or Chatobby subscription during the free alpha.
  Provider costs are separate.

## Privacy and data flow

- **Local connection:** The plugin communicates with the runtime over an
  authenticated local connection.
- **Model requests:** The runtime sends the request and relevant context to the
  model provider you select.
- **Tools and integrations:** Websites or external services are contacted only
  when requested or authorized through the relevant capability.
- **Files outside the vault:** External files are read only when attached or
  when the active permission policy authorizes the runtime operation.
- **Update check:** The plugin checks a signed GitHub update descriptor. Vault
  and conversation content is not included in that check.
- **Telemetry:** The plugin contains no client-side product telemetry. Chatobby
  does not currently collect product analytics or server-side telemetry.
- **Secrets:** Do not put credentials in notes, `chatobby.md`, `AGENTS.md`,
  memory, Context Query output, or chat messages. Use supported credential
  storage and settings.

## Source and licensing

The reviewable Obsidian connector is source-available under proprietary terms
and is not open source. The separate runtime is closed source and has its own
distribution terms. See [LICENSE](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/LICENSE), [PRIVACY.md](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/PRIVACY.md), and the
[responsibility boundaries](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/responsibility-boundaries.md).

## Help shape Chatobby

This is an alpha because feedback still has real influence over the product.

- Report reproducible defects through the
  [issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues).
- Use [GitHub Discussions](https://github.com/TitanicEclair/chatobby-obsidian/discussions)
  for questions, ideas, workflows, polls, and general feedback.
- For security concerns, follow [SECURITY.md](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/SECURITY.md).
- If Chatobby has been useful and you want to support continued development,
  [join the Patreon](https://www.patreon.com/cw/MadelynCruzTan/membership).

Useful feedback includes:

- what you tried to accomplish;
- what you expected to happen;
- what actually happened;
- the Chatobby and runtime versions;
- whether the problem survived an Obsidian restart;
- screenshots or logs with private data removed.

Contact: [thatsmad002@gmail.com](mailto:thatsmad002@gmail.com)

<details>
<summary>Review and development information</summary>

The Community plugin is the reviewable Obsidian interface. The separately
distributed runtime owns private model orchestration and agent services. The
two processes communicate over authenticated local loopback connections.

```powershell
npm install --ignore-scripts
npm run check
npm run build
```

`npm run build:release` requires `CHATOBBY_RUNTIME_PUBLIC_KEY`, disables source
maps, and stages exactly `main.js`, `manifest.json`, and `styles.css` under
`release/`.

Reviewers can also consult the
[responsibility boundaries](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/responsibility-boundaries.md),
[managed runtime lifecycle](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/architecture/managed-runtime-lifecycle.md),
and [release boundary](https://github.com/TitanicEclair/chatobby-obsidian/blob/main/docs/release-boundary.md).

</details>
