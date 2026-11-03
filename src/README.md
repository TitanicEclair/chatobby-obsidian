# Connector source

[main.ts](main.ts) composes plugin services; [ui/view.ts](ui/view.ts) owns each
native chat view. Runtime contracts in `vendor/` are generated. The connector
owns local configuration, interaction and presentation, while runtime
projections remain authoritative for durable chat and domain state.

- [Feature owners](features/README.md): public entry points and local owner guides.
- [Composer owners](ui/composer/README.md): transient drafts, submissions,
  attachments, keyboard/reference boundaries and deferred-callback tests.
- [Prompt boundary](prompt/README.md) and [live observation services](obsidian-context/README.md):
  local data models, admission, packet routes and cache/reference lifetimes.
- [Frontend module map](../docs/architecture/frontend-modules.md): transport,
  screen composition and controller boundaries.
- [Responsibility boundaries](../docs/responsibility-boundaries.md): connector,
  runtime, permission and credential authority.
- [Development rules](../AGENTS.md): local tests, private review and installed
  qualification. Passing a source test does not prove the app loaded those bytes.

`types.ts` remains a compatibility entry for local and generated declarations.
Its settings, Composer, feed, session and prompt exports name data declarations directly to avoid
importing UI through a compatibility facade.
