# Install Chatobby

Chatobby is a desktop-only Obsidian connector backed by an independently
installed local runtime. The official Community plugin installs and updates
the connector. The normal runtime setup path is the signed in-plugin
installation guide, which downloads from GitHub Releases. Runtime assets are
not standalone installers.

## Requirements

- Windows 11 or a currently supported Windows 10 x64 installation, macOS 11 or
  newer on Apple Silicon or Intel, or a glibc-based Linux desktop on x64 or
  arm64;
- Obsidian 1.11.4 or newer;
- a current backup of the vault you plan to use; and
- a supported provider account or a running compatible local model server.

The core Chatobby harness is free and will remain free. Model providers set
their own subscription and API prices; local servers do not require a paid
model-provider account.

## Install

1. In Obsidian, open **Settings → Community plugins → Browse**.
2. Find **Chatobby**, select **Install**, and then select **Enable**.
3. Open Chatobby from the ribbon. If the runtime is not installed, select
   **Install runtime**.
4. Review the version, download size, source, and verification explanation,
   then select **Install**. Chatobby downloads the package from the official
   GitHub release, verifies its signed update descriptor, verifies the signed
   runtime manifest and every packaged file, installs it atomically for the
   current operating-system account, and reconnects the vault.
5. In the Chatobby view, select **Settings** in the sidebar. Connect a model provider
   or local model server, then begin with a copied test note and a low-risk
   read-only request. API keys use the same protected runtime credential store;
   moving the setup page does not copy them into plugin settings.

Obsidian's **Settings → Chatobby** page remains available for runtime,
document-processing, documentation, and support discovery. It links back to
the everyday Settings page inside Chatobby.

**Add guide to vault** is a separate, user-confirmed content action. Connector
versions that support the Guide channel verify the signed stable
`guide-channel.json`, require its connector and consumer-schema compatibility
ranges, download the immutable hash-bound guide revision it names, validate the
bounded `Chatobby Guide/*.md` file set, and only then ask whether to write the
notes. The guide is not bundled into the plugin or runtime. Public Guide channel activation is pending for the workspace candidate. Offline, missing,
incompatible, or invalid assets leave every existing guide note unchanged and
show a retryable error.

The plugin installation path does not run a downloaded installer and does not
request administrator or root access. Windows may show an unknown-publisher
warning because the alpha runtime is not Authenticode-signed. macOS uses an
ad-hoc signature rather than Apple notarization and may require one explicit
**Open Anyway** approval. Chatobby never changes SmartScreen, Gatekeeper,
quarantine, Full Disk Access, firewall, shell profiles, or global PATH.

Linux support is experimental and targets ordinary glibc desktop installs.
Flatpak, Snap, musl, and other confinement environments remain unverified. A
detected libc, architecture, permission, or confinement mismatch stops before
execution and preserves the previous runtime.

## Update

Obsidian updates the connector through the Community plugin directory. Runtime
updates are deliberate: Chatobby checks a small signed GitHub descriptor and
shows a compact **Update Chatobby** action when a compatible runtime is newer.
The package is downloaded and installed only after you open the guide and
confirm the update. The previous runtime remains available for rollback if an
installation fails. Standalone installer tooling is reserved for controlled
development and release testing; it is not the public installation path.

Connector and runtime versions must be compatible. If Chatobby reports a
version mismatch, update both components before retrying.

### Approval-gated one-action provisioning

The private connector contains a release-only automatic provisioning path, but
Community/public builds must leave it disabled until Obsidian grants the
documented exception for installing and updating the separately distributed
closed-source runtime. This is not enabled by README disclosure alone.

When an approved build enables it, connector version `N` requests only
`releases/download/N/runtime-index.json`; it never follows `releases/latest`.
An already-installed, fully verified compatible runtime is reused without a
network request. Otherwise Chatobby stages and verifies runtime `N`, waits for
runtime-owned maintenance admission, activates atomically, and reconnects. The
normal install/update confirmation disappears, while explicit **Retry setup**,
**Repair Chatobby**, diagnostics, and **Remove local runtime** remain available.

If initial setup is offline, the connector remains loaded and shows a retry
action. If an update cannot be downloaded, a previous verified compatible
runtime remains selected. Signature, target, protocol, inventory, or hash
failure prevents execution. Interrupted activation uses the installation
journal to roll back or complete recovery on the next load.

## Uninstall

1. If you also want to remove the runtime program files, use **Remove local
   runtime** from Chatobby's runtime menu before uninstalling the plugin.
2. Remove or disable Chatobby from Obsidian Community plugin settings.
3. If the plugin is already gone, close Obsidian and remove Chatobby's
   machine-local runtime directory manually.

Uninstalling program files intentionally preserves vault content, sessions,
memory, event definitions, provider credentials, and other user-owned data.
See [Privacy](../PRIVACY.md) before deleting retained data manually.
