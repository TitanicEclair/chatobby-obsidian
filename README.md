# Chatobby for Obsidian

**A full agent workspace inside your vault.**

Chat with an agent that can understand your notes, use tools, work across
long-running projects, and bring in specialist subagents when the task grows.
Chatobby keeps the conversation, work, permissions, and supporting context
together in Obsidian instead of reducing the experience to a chatbot sidebar.

> **Public alpha:** Chatobby is free while it is under active development.
> Back up important vaults and begin with a copied test note. Interfaces and
> storage contracts may change between alpha releases.

## Support Chatobby's development

> Please support me to remain unemployed so I can keep working on Chatobby.
> It's actually so exciting to see its capabilities now and I love doing this
> <3

[![Support Chatobby on Patreon](https://img.shields.io/badge/Support%20Chatobby%20on%20Patreon-FF424D?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/cw/MadelynCruzTan/membership)

Support is completely optional. It does not unlock features or change the free
alpha experience.

## The agentic experience

### Work with your actual vault

Ask about the note you are viewing, search for related material, compare ideas
across folders, open the right file, or request a precise edit. Chatobby can
also work with pasted images and attached documents, so the conversation is
not limited to plain text.

### See work happen, not just the final answer

Responses stream into the conversation while concise progress, tool activity,
permission requests, tasks, and errors remain visible. You can stop a turn,
review what the agent used, and copy the resulting Markdown back into your own
workflow.

### Delegate without losing the thread

Create specialist subagents for research, exploration, review, or other
focused work. Switch between their individual feeds, follow their lifecycle in
the agent rail, and inspect agent-to-agent communication through channels.
Reusable roles and workflows make larger projects easier to coordinate.

### Keep useful continuity

Sessions belong to a project directory and can retain the context needed to
continue later. Memory suggestions stay under your control, while context
queries can safely provide project-specific information at session start or on
each turn.

### Automate deliberately

Create one-off, scheduled, or repeating Events and assign the project, agent,
permission policy, runtime limit, and daily run limit. Automated work remains
bounded and visible instead of running as an unaccountable background process.

### Choose what the agent may do

Permission policies control files, commands, tools, channels, and automated
work. Pick a policy per session, respond to requests in the feed, and create
more focused policies for particular roles or tasks. Provider, model, and
reasoning effort also remain selectable for each session.

## What is included

- A native Obsidian conversation feed with streaming Markdown and visible tool
  activity
- Vault search, reading, navigation, editing, images, and document attachments
- Persistent project sessions with model and permission controls
- Tasks, subagents, reusable roles, workflows, and communication channels
- User-managed memory and programmable project context queries
- Scheduled and repeating Events with safety limits and run history
- A guided, signed runtime installer and update flow inside the plugin

## Install

1. Install and enable **Chatobby** from Obsidian's Community plugin directory.
2. Open Chatobby from the ribbon.
3. Select **Install runtime**, review the version and verification details, and
   confirm the installation.
4. Open **Settings -> Chatobby**, choose a provider, and add the credential that
   provider requires.
5. Return to Chatobby and send your first message.

The plugin downloads the runtime only after confirmation, verifies the signed
package and every included file, installs it for the current Windows account,
and reconnects automatically. A standalone installer remains available from
the [latest runtime release](https://github.com/TitanicEclair/chatobby-runtime/releases/latest)
for manual installation.

The current alpha supports desktop Obsidian on Windows 10 or 11 x64. Chatobby
itself is free, but the model provider you choose may require an account, API
key, subscription, or usage payment.

For more detail, see the [installation guide](docs/installation.md),
[alpha guide](docs/alpha-guide.md), and
[troubleshooting guide](docs/troubleshooting.md).

## A good first ten minutes

Start with the default permission policy and a copied test note. Try these in
order:

1. `Summarize this note and identify its open questions.`
2. `Find notes related to this topic and explain how they connect.`
3. `Propose one small improvement to this note, then ask before editing it.`
4. Attach an image or document and ask Chatobby to connect it to your notes.
5. Open Permissions, Memory, Events, Queries, Channels, and Subagents when you
   are ready to explore the wider workspace.

## Important alpha information

- **Separate runtime:** The Obsidian plugin provides the interface and
  allowlisted vault operations. A compatible local Chatobby runtime manages
  model requests, sessions, prompts, tools, memory, tasks, events, workflows,
  subagents, and channels.
- **Network use:** The plugin communicates with the runtime through an
  authenticated local connection. The runtime contacts the model provider you
  select and may contact websites or integrations when you request or authorize
  the relevant tool. The plugin checks a signed GitHub update descriptor when
  Chatobby opens; no vault or conversation content is included in that check.
- **Files outside the vault:** A file outside the vault is read only when you
  explicitly attach it or when the active Chatobby permission policy authorizes
  the runtime operation.
- **Accounts and payment:** Chatobby does not require a Chatobby account or
  payment during the free alpha. Provider accounts and usage costs are separate.
- **Telemetry:** The plugin contains no client-side telemetry. Chatobby does not
  currently collect product analytics or server-side telemetry.
- **Source and licensing:** The reviewable Obsidian connector is
  source-available under proprietary terms and is not open source. The separate
  runtime is closed source and has its own distribution terms. See
  [LICENSE](LICENSE) and [PRIVACY.md](PRIVACY.md).

## Help shape Chatobby

Report defects through the
[issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues).
Use [GitHub Discussions](https://github.com/TitanicEclair/chatobby-obsidian/discussions)
for questions, ideas, feature requests, polls, and general feedback. For
security concerns, follow [SECURITY.md](SECURITY.md).

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
[responsibility boundaries](docs/responsibility-boundaries.md),
[managed runtime lifecycle](docs/architecture/managed-runtime-lifecycle.md),
and [release boundary](docs/release-boundary.md).

</details>
