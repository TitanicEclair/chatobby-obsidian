# Chatobby for Obsidian

Chatobby is a desktop-only Obsidian connector for a separately installed local
Chatobby agent runtime. The connector owns Obsidian UI, vault-authority bridge
operations, local runtime lifecycle, and authenticated loopback transport. The
runtime owns models, prompts, memory, permissions, tasks, subagents, workflows,
events, and product decision logic.

> **Public alpha:** Chatobby is free while the product is under active
> development. Interfaces and storage contracts may change. Back up important
> vaults and begin with a low-risk test note.

Please support me to remain unemployed so I can keep working on Chatobby. It's
actually so exciting to see its capabilities now and I love doing this <3

[![Support Chatobby on Patreon](https://img.shields.io/badge/Support%20Chatobby-Patreon-FF424D?logo=patreon&logoColor=white)](https://www.patreon.com/cw/MadelynCruzTan/membership)

## Install

1. Install and enable Chatobby from Obsidian's Community plugin directory.
2. Open Chatobby and select **Get runtime**.
3. Download `Chatobby-Setup.exe` from the
   [latest runtime release](https://github.com/TitanicEclair/chatobby-runtime/releases/latest).
4. Run the installer, return to Obsidian, and select **Check again**.
5. Connect a model provider in **Settings → Chatobby**.

See the complete [installation guide](docs/installation.md),
[alpha guide](docs/alpha-guide.md), and
[troubleshooting guide](docs/troubleshooting.md).

## Required disclosures

- **Separate runtime:** The connector requires a compatible Chatobby runtime
  installed on the same computer. It verifies and starts that signed runtime;
  it does not download or silently update plugin code.
- **Network use:** The connector talks to the runtime over authenticated local
  loopback connections. The runtime contacts the model provider selected by
  the user and may contact websites or integrations when the user requests or
  authorizes a corresponding tool operation.
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

## Support development

Chatobby is not charging for the alpha. Users who want to support continued
development can do so through
[Patreon](https://www.patreon.com/cw/MadelynCruzTan/membership). Support is
entirely optional and is not required to install or use the alpha.

For defects, use the
[public issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues).
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
