# Troubleshooting

## Chatobby runtime is not installed

Select **Get runtime** in the Chatobby view or settings, install the latest
`Chatobby-Runtime-Setup-<version>.exe` from the official GitHub release, then
select **Check again**. This installer does not ask for a vault. Do not copy
`chatobby.exe` into the plugin folder.

## The runtime is incompatible or damaged

Download and run the latest installer again. The connector verifies the signed
runtime manifest and every packaged file before launch. A signature, checksum,
protocol, or compatibility failure cannot be bypassed from release settings.

## Chatobby does not reconnect after Obsidian restarts

Open the Chatobby runtime status control and select **Restart Chatobby**. If the
problem remains, copy the redacted diagnostics and include connector, runtime,
Obsidian, and Windows versions in a support report.

## No providers or models appear

Open **Settings → Chatobby** and wait for provider discovery. Connect the
provider you intend to use. Chatobby stores the credential in the local runtime
credential store, not in the Obsidian plugin folder. Provider availability,
quotas, billing, and outages remain the provider's responsibility.

## Windows warns about an unknown publisher

The initial alpha may be distributed before Authenticode signing is available.
Download only from the official Chatobby runtime repository and compare the
installer SHA-256 hash with the published checksum. Never disable Windows
security protections globally to install Chatobby.

## Reporting a problem

Use the [issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues)
for ordinary defects. Do not attach provider credentials, raw vault content,
private session transcripts, or signing material. Follow
[SECURITY.md](../SECURITY.md) for vulnerabilities.
