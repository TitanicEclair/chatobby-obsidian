# MCP connections

MCP connections add optional tools from another service or a program on your
computer. Examples include repository hosting, calendars, communication apps,
cloud storage, and specialist local utilities.

Saving, authenticating, connecting, and granting permission are separate
steps. A connection can be configured successfully while its tools remain
unavailable to agents until a permission policy allows them.

## Add a connection

1. Open **Plugins** from Chatobby's top bar.
2. Prefer a Chatobby-verified connection when it meets your need. For another
   service, choose **Add a connection**.
3. Choose **Online service** for a remote URL or **Program on this computer**
   for a local command.
4. Enter the connection name and the basic fields shown for that type. Open
   **Advanced details** only when the server's official instructions require
   arguments, a working folder, headers, or environment mappings.
5. Select **Test connection**. Resolve any authentication or startup error
   before saving.
6. Save the connection. New custom connections remain disabled until you have
   reviewed them.
7. Enable and connect it, refresh its capabilities, then open **Permissions**
   and allow only the tools the intended agent needs.

Chatobby's verified list is curated, but verification is not a promise that a
third-party service will always be available or suitable. Review the publisher,
source, requested access, account requirements, and privacy terms.

## Credentials

Never paste a token or password into a chat or ordinary note. Use the secure
credential or secret control shown by Chatobby. A secret name is a safe local
reference; the secret value is the private credential. Creating a secret does
not automatically link it to a connection.

Local programs run with your operating-system account. Remote connections send
requests to another service. Keep environment mappings narrow and avoid
putting secret values directly in connection arguments.

## Ask Chatobby for help

> I want to connect Chatobby to GitHub. Use the official public setup guide,
> explain the account requirement in plain language, and stop before asking me
> to create or paste a credential.

> I have a local MCP command from this publisher's documentation. Walk me
> through the Plugins form, test it, and show me which discovered tools are
> still denied by my current policy.

Chatobby should use the public guide and the live Plugins page. It does not need
to inspect private product source or reveal private tool descriptions.

For connection failures, see [troubleshooting](troubleshooting.md). For
permission behavior, see [responsibility boundaries](responsibility-boundaries.md).
