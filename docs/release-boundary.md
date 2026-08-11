# Connector release boundary

> Current public-alpha distribution: Obsidian Community plugin plus the
> plugin-managed, Ed25519-verified Chatobby runtime.

## Reviewable connector

The public connector is intentionally limited to Obsidian presentation,
workspace integration, transport, and verified runtime lifecycle handling.
`boundary-manifest.json` classifies every public source root and prevents the
connector from importing private runtime packages.

`npm run build:release`:

- compiles with release-only constants;
- disables source maps;
- minifies JavaScript and CSS;
- requires the runtime Ed25519 public key;
- rejects local paths, private-key material, common credentials, and unexpected
  files; and
- emits exactly `main.js`, `manifest.json`, and `styles.css` in `release/`.

Release-mode runtime discovery accepts only the installed runtime pointer. The
environment, plugin-bundled executable, and `PATH` fallbacks are development
features and are not present in the Community plugin path.

## Runtime trust boundary

The private runtime is published separately as a versioned compressed bundle.
The connector verifies the signed release descriptor, complete signed package
manifest, platform, architecture, protocol, plugin compatibility, inventory,
file sizes, and SHA-256 hashes before activating it. Updates install into a
new version directory and switch the current pointer only after verification.

The Ed25519 package signature proves that the runtime package came from the
Chatobby release key and was not modified. It does not suppress the Windows
publisher warning that applies to directly launched, unsigned executables;
that requires a separate Authenticode certificate.

## Build modes

| Mode | Intended use | Runtime | Connector |
|---|---|---|---|
| Development | Local source work | Source or locally built binary | Unminified local build |
| Release candidate | Exact pre-publication verification | Public-alpha package | Production connector build |
| Public alpha | Current official path | Ed25519-signed package | Community plugin assets |
| Stable signed | Future stable/paid distribution | Ed25519 + Authenticode | Community plugin assets |

Standalone and runtime-only installer tooling remains available for controlled
testing, but installers are not part of the current official public-alpha
release. Users install the plugin through Obsidian and install or update the
runtime from Chatobby's in-plugin action.

## Release requirements

Development happens only in the private connector repository. Ordinary
feature branches merge into its default `dev` branch. A temporary
`release/<version>` branch is then cut from `dev`, paired with the matching
private runtime release branch, and used for candidate testing. After manual
acceptance, that exact connector commit promotes through a pull request into
private `main`. Public connector `main` receives only the separately authorized
projection of the approved private commit.

The public tag workflow publishes and verifies the exact three connector
assets before it advances public `main`. Promotion remains fast-forward only.
After the ref update, the workflow polls the remote ref for a bounded interval
before asserting equality, because the branch read can briefly lag the
successful update. A timeout fails the workflow; it does not force or repeat
the promotion.

The private release workflow is intentionally inert: the tag-triggered
publisher runs only when `github.repository` is
`TitanicEclair/chatobby-obsidian`. A private tag can therefore never create a
connector release accidentally.

Every public version must:

1. use the same plugin and runtime version and tag;
2. pass repository checks and focused lifecycle tests;
3. produce the runtime package before the connector so the connector embeds the
   matching public key;
4. pass runtime package verification and `doctor` from the packaged directory;
5. pass the connector release-artifact scan;
6. be installed into a disposable vault before publication;
7. publish the runtime release before the plugin release; and
8. verify the uploaded assets and Community-plugin listing after publication.

Published tags and release assets are immutable. A defect discovered after
publication is corrected with a new patch version, never by replacing files on
an existing tag.

## Remaining stable-release gates

These do not block the explicitly labelled public alpha, but they remain gates
for a stronger stable or paid release claim:

- Authenticode-sign and timestamp the runtime executable if Windows publisher
  identity is required;
- exercise update, rollback, and uninstall on a clean Windows account;
- maintain offline recovery instructions for a failed runtime update;
- complete qualified legal review of stable/commercial terms; and
- document signing-key rotation and incident response.
