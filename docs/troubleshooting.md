# Troubleshooting

## Chatobby runtime is not installed

Select **Get runtime** in the Chatobby view or settings. Review the version,
platform, source, download size, and verification details, then select
**Install**. The connector downloads and verifies the official runtime package
for the current user. Do not copy runtime executables into the plugin folder.

## The runtime is incompatible or damaged

Open the runtime status control and select the supported repair or install
action. The connector verifies the signed update descriptor, runtime manifest,
and every packaged file before launch. A signature, checksum, protocol, or
compatibility failure cannot be bypassed from release settings.

## Chatobby does not reconnect after Obsidian restarts

Open the Chatobby runtime status control and select **Restart Chatobby**. If the
problem remains, copy the redacted diagnostics and include connector, runtime,
Obsidian, and operating-system versions in a support report.

## Plugin and runtime versions differ

Choose **Update** beside the version notice. Chatobby downloads and verifies the
package, stops current work, installs it and reconnects. Saved conversations,
Projects, memory and model connections remain. Interrupted agents do not restart
automatically.

If another runtime installation or repair is already running, let it finish and
choose **Try again**. A failed stop leaves the current package in place; close
and reopen Obsidian before retrying.

## The Chatobby Guide cannot be added or updated

Retry while online. Chatobby accepts only the guide asset named by the signed
stable Guide channel when its connector-version and consumer-schema ranges are
compatible. It does not fall back to embedded or unverified latest content. A
missing asset, invalid signature, incompatible range, size or hash mismatch,
unsupported schema, or unsafe Markdown path stops before the confirmation and
leaves the existing `Chatobby Guide/` notes unchanged. Connector 0.4.3 needs one
normal connector upgrade before it can use the channel.

## Remove the local runtime

Before uninstalling the connector, open the runtime status menu and choose
**Remove local runtime**. Chatobby stops the managed process and removes only
connector-owned account-local program files. Vault content, chats, memory,
Events, provider credentials, and other user-owned data are preserved. If the
plugin was already removed, close Obsidian and follow the manual runtime-path
cleanup in the installation guide.

## No providers or models appear

Open Chatobby, select the **Settings** gear, and wait for provider discovery.
Connect the provider or local model server you intend to use. Chatobby stores a
hosted-provider credential in the local runtime credential store, not in the
Obsidian plugin folder or page state. Provider availability, quotas, billing,
and outages remain the provider's responsibility.

## Windows warns about an unknown publisher

The initial alpha may be distributed before Authenticode signing is available.
Use only Chatobby's in-plugin guide and verify the displayed source and signed
package details before confirming. Never disable Windows security protections
globally to install Chatobby.

## Reporting a problem

Use the [issue tracker](https://github.com/TitanicEclair/chatobby-obsidian/issues)
for ordinary defects. Do not attach provider credentials, raw vault content,
private session transcripts, or signing material. Follow
[SECURITY.md](../SECURITY.md) for vulnerabilities.
