# Install Chatobby

Chatobby is a desktop-only Obsidian connector backed by a separately installed
local runtime. The official Community plugin installs and updates the
connector. The Chatobby runtime is downloaded separately from GitHub Releases.

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
   **Get runtime**.
4. On the [latest runtime release](https://github.com/TitanicEclair/chatobby-runtime/releases/latest),
   download `Chatobby-Setup.exe` and its SHA-256 checksum file.
5. Verify the checksum shown on the release page, then run the installer. The
   runtime installer does not install or update the Obsidian connector.
6. Return to Obsidian and select **Check again**. Chatobby verifies the signed
   runtime package before starting it.
7. Open **Settings → Chatobby**, connect a model provider, and begin with a
   copied test note and a low-risk read-only request.

The initial public alpha may show a Windows unknown-publisher warning until an
Authenticode certificate is available. Continue only when the installer came
from the official GitHub release and its checksum matches. Do not disable
SmartScreen or antivirus globally.

## Update

Obsidian updates the connector through the Community plugin directory. Runtime
updates are deliberate: open the latest runtime release, download the new
installer, and run it. Chatobby does not silently download or execute updates.

Connector and runtime versions must be compatible. If Chatobby reports a
version mismatch, update both components before retrying.

## Uninstall

1. Remove or disable Chatobby from Obsidian Community plugin settings.
2. Remove **Chatobby Runtime** from Windows Installed apps.

Uninstalling program files intentionally preserves vault content, sessions,
memory, event definitions, provider credentials, and other user-owned data.
See [Privacy](../PRIVACY.md) before deleting retained data manually.

