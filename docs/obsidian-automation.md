# Let Chatobby operate Obsidian

Chatobby can arrange native tabs, work with the open editor, inspect plugin views,
configure settings and combine several app operations in a script. It uses
Obsidian's CLI and public API, with a searchable API reference and guidance for
the plugins you have enabled.

## Try it

> Open my Project Index beside this chat, follow its unresolved links, and make
> a list of the notes I still need to write.

> Connect the LM Studio server I already started at http://127.0.0.1:1234/v1.
> Find its models, add the one I choose, keep the server defaults and test it.

> Turn this selected paragraph into a callout. Keep the rest of my unsaved
> note unchanged and check the rendered result.

> Make a QuickAdd command that creates a reading note from my template and
> opens it next to the source note. Check cancellation and repeated use.

## Enable the app connection

Use a current Obsidian desktop installation with its CLI enabled. Chatobby
reports CLI availability for the connected vault. Live scripting currently
requires **Full** access and the relevant Obsidian access setting in
**Permissions**. Full runs with your normal account access; it is not sandboxed.
Ordinary note work can use Chatobby's file tools when live app control is unnecessary.

## Public API reference

The reference is called the **Obsidian API**. Its official declarations are
`obsidian.d.ts` in the [obsidian-api repository](https://github.com/obsidianmd/obsidian-api).
Chatobby includes a version-pinned searchable catalogue of those declarations.
It can look up Workspace, Editor, Vault, MetadataCache and FileManager methods
before composing a script. Community plugins have their own APIs and version
requirements.

The API allows scripts to combine information that file reads alone miss:
the open editor's unsaved selection, current native tabs, indexed links,
rendered views and application settings. Chatobby uses registered commands or
visible controls for plugin settings that lack a public configuration method.

## Local-model setup

Chatobby's **Settings → Local model connections → Connect server** form reads
models from your running server. **Find models** supplies exact IDs and supported
metadata. Select models, use **Test**, then **Save connection**. Automatic context
uses the loaded model's reported configuration; compatible output limits can stay
on **Use server settings**. See [Local model connections](local-model-connections.md).

When authorized and the app connection is available, an agent can operate this
form, wait for discovery, and check the saved connection. Enter private tokens
in the product's credential field or browser sign-in flow.

## Reusable workflows

- **QuickAdd:** interactive capture, choices and command sequences.
- **Templater:** generated notes, variables, templates and hooks.
- **Chatobby Events:** scheduled or file-triggered agent work.
- **A custom Obsidian plugin:** persistent app events, commands or a new view.

Chatobby checks the result in the relevant editor, page or saved note. An async
command returning successfully does not by itself prove that a view finished
rendering or a setting persisted. Web Viewer pages are a separate browser
surface; their interaction tools operate inside the page.

[Terminal and CLI reference](obsidian-cli-and-terminal.md) ·
[Events](events.md) · [Providers](providers-and-models.md) ·
[Troubleshooting](troubleshooting.md)
