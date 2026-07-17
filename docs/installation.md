# Install Chatobby

Chatobby is a desktop-only Obsidian connector backed by an independently
installed local runtime. The official Community plugin installs and updates
the connector. The normal runtime setup path is the signed in-plugin
installation guide, which downloads from GitHub Releases; a standalone Windows
installer is also available for manual installation.

## Requirements

- Windows 11 or a currently supported Windows 10 x64 installation;
- Obsidian 1.8.0 or newer;
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
   current Windows account, and reconnects the vault.
5. Open **Settings → Chatobby**, connect a model provider, and begin with a
   copied test note and a low-risk read-only request.

The plugin installation path does not run a downloaded Windows installer and
does not request administrator access. If you instead use the standalone
installer, the initial public alpha may show a Windows unknown-publisher
warning until an Authenticode certificate is available. Continue only when it
came from the official GitHub release and its checksum matches. Do not disable
SmartScreen or antivirus globally.

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
2. Remove **Chatobby Runtime** from Windows Installed apps.

Uninstalling program files intentionally preserves vault content, sessions,
memory, event definitions, provider credentials, and other user-owned data.
See [Privacy](../PRIVACY.md) before deleting retained data manually.
