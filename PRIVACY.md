# Privacy

Last updated: 16 July 2026

Chatobby consists of this Obsidian connector and a separately installed local
runtime. The connector does not contain client-side telemetry and does not send
usage analytics to Chatobby.

## Data flow

- The connector communicates with the Chatobby runtime over authenticated
  loopback connections on the same computer.
- The connector can read or modify vault content only for visible product
  workflows or allowlisted operations requested by the runtime.
- When you explicitly attach a file outside the vault, the connector may read
  and copy that selected file for the requested conversation.
- The local runtime sends prompts, selected vault context, attachments, and
  tool results to the model provider you configure. That provider processes
  data under its own terms and privacy policy and may charge for usage.
- Agent tools can contact websites or other services when you request or
  authorize those operations. The relevant service then receives the data
  needed for that operation.

Chatobby does not require a Chatobby account for the free connector. Provider
accounts or credentials may be required by the model provider you choose.

## Local storage

The connector stores non-secret settings and view/session recovery references
through Obsidian plugin data. The runtime stores credentials, conversations,
memory, permissions, channels, events, logs, and runtime metadata outside the
connector under the local user's Chatobby/runtime data locations. Provider
credentials are not persisted in the connector's `data.json` file.

Disabling or removing the connector does not automatically delete runtime data
or vault content. This protects users from accidental data loss. Use Chatobby's
data controls or remove the runtime-owned data separately when permanent
deletion is intended.

## Telemetry and diagnostics

The connector has no client-side telemetry. Chatobby does not currently
operate product analytics or server-side telemetry. Local diagnostics are
redacted by default; users decide whether to share diagnostic material with
support.

## Public links

The connector opens GitHub only when you choose a documentation, support, or
runtime-download action. GitHub then receives normal web request information
under its own privacy terms. The Patreon link is opened only when you choose
to support development; Chatobby does not send Patreon vault content, prompts,
session data, or product analytics.

## Contact

Privacy questions can be sent to madelyntan0223@gmail.com.
