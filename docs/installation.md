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
- an account or API key for at least one supported model provider.

Chatobby itself is free during alpha. Model providers may charge for API usage
under their own terms.

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
5. In the Chatobby view, select the **Settings** gear. Connect a model provider
   or local model server, then begin with a copied test note and a low-risk
   read-only request. API keys use the same protected runtime credential store;
   moving the setup page does not copy them into plugin settings.

Obsidian's **Settings → Chatobby** page remains available for runtime,
document-processing, documentation, and support discovery. It links back to
the everyday Settings page inside Chatobby.

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
installation fails. The standalone installer remains an alternative.

Connector and runtime versions must be compatible. If Chatobby reports a
version mismatch, update both components before retrying.

## Uninstall

1. Remove or disable Chatobby from Obsidian Community plugin settings.
2. Close Obsidian and remove Chatobby's machine-local runtime directory for
   your operating system if you also want to remove the runtime.

Uninstalling program files intentionally preserves vault content, sessions,
memory, event definitions, provider credentials, and other user-owned data.
See [Privacy](../PRIVACY.md) before deleting retained data manually.
