# MCP connections

MCP connections add optional tools from an online service or a program already
installed on your computer. A connection, its authentication, its exposed tool
set are separate decisions. Local programs in Chatobby 0.5.3 run with Full access;
sandboxing is temporarily unavailable.

## Add a connection

1. Open **Plugins** from Chatobby's sidebar.
2. Prefer a Chatobby-verified definition when it meets your need. Otherwise
   choose **Add a connection**.
3. Choose **Online service** for a remote URL or **Program on this computer**
   for a trusted local command.
4. Enter the basic connection details. Open **Advanced options** only when the
   server's official instructions require arguments, a working folder, headers,
   environment mappings, or a different lifecycle.
5. Select **Check details** to validate the form. This check does not contact,
   start, authenticate with, or discover tools from the server.
6. Save the connection. A new custom connection is stored in your Chatobby
   settings, remains off, and exposes no
   tools to the agent.
7. For an online service, select **Test & discover** to make one contained
   connection attempt and read its current tool list. This deliberate test can
   affect the remote service, but it does not enable the connection or any
   tool. Select **Stop test** to cancel an in-progress attempt.
8. Review the discovered tools and explicitly turn on only the ones the agent
   may use. Link its saved secret or complete browser sign-in when required,
   then enable the connection.

A repository `.mcp.json`, `.chatobby/mcp.json`, or project instruction is an
untrusted connection suggestion, not registration or consent. Chatobby may show
it for review, but it cannot contact or authenticate with the server, start the
command, enable the server, widen an existing tool selection, or replace a
user-approved definition. **Review & add** copies only the visible address or
command details into a separate, disabled Chatobby setting. The project file
remains unchanged, credentials are not copied, and every discovered tool
remains off until you select it.

**Check details** remains available for validating a local command without
starting it. A real local **Test & discover**, connection, or tool call follows
the runtime-reported process boundary. In 0.5.3, it starts unsandboxed as your
operating-system account. The connection page shows this before testing.

Chatobby's built-in web and Obsidian MCP adapters also use ordinary local
processes. Remote MCP connections use the network. A user-started test does not
enable that server or select its agent tools.

Chatobby's verified list is curated, but verification is not a promise that a
third-party service will always be available or suitable. Review the publisher,
source, requested account access, and privacy terms.

## Choose agent tools

The Plugins page shows capabilities reported by a connection. Tool selections
control which of those capabilities are supplied to the agent.

Every discovered tool starts off. Turning on a server does not turn on its
tools, and newly discovered tools remain off until selected. Removing a tool
selection revokes both direct and proxied access after the connection reloads.

Older definitions that named individual direct tools retain those exact names.
Older definitions that implicitly exposed every tool require review and expose
none until the user selects them. A selected tool can affect its remote service,
but it does not change Project memory or session-history scope.

## Credentials

Never paste a token or password into a chat or ordinary note. Use the secret
control shown by Chatobby. A secret name is a safe local reference; the secret
value is the private credential. Creating a secret does not automatically link
it to a connection.

Local programs run with your operating-system account. Remote connections send
requests to another service. Keep environment mappings narrow and do not put
secret values directly in connection arguments.

## Ask Chatobby for help

> I want to connect Chatobby to GitHub. Use the official public setup guide,
> explain the account requirement in plain language, and stop before asking me
> to create or paste a credential.

> I have a local MCP command from this publisher's documentation. Walk me
> through saving it disabled and checking its details. Explain whether the live
> connection status allows the program to start, and let me choose its tools
> before enabling it. I understand that local programs run with Full access.

Chatobby should use the public guide and the live Plugins page. It does not need
to inspect private product source or reveal private tool descriptions.
If no supported MCP mutation tool is available, it should tell you to use
**Plugins -> Add a connection** or **Review & add** rather than claiming it
registered, authenticated, or enabled the server itself. A Project instruction
can suggest a server, but only your reviewed Chatobby setting and explicit tool
switches create agent access.

For connection failures, see [troubleshooting](troubleshooting.md). For trust
boundaries, see [responsibility boundaries](responsibility-boundaries.md).
