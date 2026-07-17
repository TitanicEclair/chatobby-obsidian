# Chatobby for Obsidian

Chatobby brings a full agent workspace into Obsidian. Use it to work across
notes and attachments, keep useful context between sessions, plan longer work,
run scheduled actions, and coordinate multiple agents without leaving your
vault. A separately installed local runtime connects Chatobby to the model
providers you choose. The plugin can install that runtime through a signed,
user-confirmed setup guide.

> **Public alpha:** Chatobby is free while the product is under active
> development. Interfaces and storage contracts may change. Back up important
> vaults and begin with a low-risk test note.

Please support me to remain unemployed so I can keep working on Chatobby. It's
actually so exciting to see its capabilities now and I love doing this <3

[![Support Chatobby on Patreon](https://img.shields.io/badge/Support%20Chatobby-Patreon-FF424D?logo=patreon&logoColor=white)](https://www.patreon.com/cw/MadelynCruzTan/membership)

## What you can do

- **Work with your vault:** Ask questions about the active note, search for
  related material, navigate between notes, and make permission-controlled
  edits.
- **Bring in other material:** Paste images or attach supported documents so
  they can be read alongside your notes.
- **Keep useful context:** Review and manage memory, approve or ignore memory
  suggestions, and use project context queries to add information when a
  session starts or before each turn.
- **Plan and automate:** Track multi-step tasks in the conversation and create
  scheduled or repeating events with runtime and daily-run limits.
- **Delegate larger work:** Start subagents, follow each agent's feed, run
  reusable workflows, and inspect agent-to-agent communication in channels.
- **Choose how each session runs:** Select a provider, model, reasoning effort,
  project directory, and permission policy for the current session.
- **Stay in control:** Use explicit permission policies for files, tools,
  channels, and automated work. Chatobby shows tool activity and keeps agent
  actions visible in the conversation.

## Install

1. Install and enable Chatobby from Obsidian's Community plugin directory.
2. Open Chatobby and select **Install runtime**.
3. Review the source, version, download size, and verification details, then
   select **Install**. Chatobby downloads the signed runtime package, verifies
   every file, installs it for the current Windows account, and reconnects.
4. Connect a model provider in **Settings → Chatobby**.

The standalone Windows installer remains available from the
[latest runtime release](https://github.com/TitanicEclair/chatobby-runtime/releases/latest)
for manual or offline-style installation.

See the complete [installation guide](docs/installation.md),
[alpha guide](docs/alpha-guide.md), and
[troubleshooting guide](docs/troubleshooting.md).

The current alpha supports desktop Obsidian on Windows 10 or 11 x64. Chatobby
is free, but the model provider you select may require an account, API key,
subscription, or usage payment.

## A good first session

1. Start with a backed-up vault or a copied test folder.
2. Open a test note, launch Chatobby from the ribbon, and keep the default
   permission policy selected.
3. Try a read-only request such as: `Summarize this note and identify its open
   questions.`
4. Try vault retrieval: `Find notes related to this topic and explain how they
   connect.`
5. Request one small edit and inspect the result before granting broader
   permissions or scheduling automated work.

Once the basics feel comfortable, open Chatobby's dedicated pages for memory,
permissions, events, context queries, channels, and subagents. Each page is
scoped to the current Chatobby project where applicable.

## Required disclosures

- **Separate runtime:** The connector requires a compatible Chatobby runtime
  installed on the same computer. It verifies and starts that signed runtime.
  Runtime installation and updates require an explicit click; the connector
  does not download or silently update plugin code.
- **Network use:** The connector talks to the runtime over authenticated local
  loopback connections. The runtime contacts the model provider selected by
  the user and may contact websites or integrations when the user requests or
  authorizes a corresponding tool operation. The connector also requests a
  small signed update descriptor from GitHub when the first Chatobby view
  opens; no vault or session content is included.
- **Accounts and payment:** Chatobby does not currently require a Chatobby
  account or payment for the free alpha. Optional Patreon support does not
  unlock product features. A selected model provider may require an account,
  API credential, subscription, or usage payment.
- **Files outside the vault:** Runtime installation and session data live in
  the local user's Chatobby data directories. The connector can read an
  outside-vault file only when the user explicitly selects it as an attachment,
  and the signed runtime can operate outside the vault only under the active
  Chatobby permission policy.
- **Telemetry:** The connector includes no client-side telemetry. Chatobby does
  not currently collect product analytics or server-side telemetry.
- **Source and licensing:** The reviewable connector source is source-available
  under a proprietary license and is not open source. The separately installed
  runtime is closed source and has separate distribution terms. See
  [LICENSE](LICENSE) and [PRIVACY.md](PRIVACY.md).

## How it works

The Community plugin provides Chatobby's Obsidian interface and performs
allowlisted vault operations. The separately installed runtime manages model
requests, sessions, prompts, memory, permissions, tasks, events, workflows,
subagents, and channels. They communicate over an authenticated local-loopback
connection. Runtime installation and updates are deliberate; the plugin does
not silently replace the runtime.

## Support development

Chatobby is not charging for the alpha. Users who want to support continued
development can do so through
[Patreon](https://www.patreon.com/cw/MadelynCruzTan/membership). Support is
entirely optional and is not required to install or use the alpha.

For defects, use the
[public issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues).
For questions, ideas, polls, and general feedback, use
[GitHub Discussions](https://github.com/TitanicEclair/chatobby-obsidian/discussions).
For vulnerabilities, follow [SECURITY.md](SECURITY.md).

## Development

```powershell
npm install --ignore-scripts
npm run check
npm run build
```

`npm run build` writes the live development `main.js` and `styles.css` into the
plugin checkout. `npm run build:release` requires
`CHATOBBY_RUNTIME_PUBLIC_KEY`, disables source maps, and stages exactly
`main.js`, `manifest.json`, and `styles.css` under `release/`.

## Reviewable source export

```powershell
node scripts/export-reviewable-source.mjs C:\path\to\chatobby-connector-export --draft
```

Draft exports include `publication-gaps.json` if required publication files are
missing. Omit `--draft` for a release export; missing publication files then
fail closed.

See [the responsibility boundaries](docs/responsibility-boundaries.md),
[managed runtime lifecycle](docs/architecture/managed-runtime-lifecycle.md),
and [release boundary](docs/release-boundary.md).
