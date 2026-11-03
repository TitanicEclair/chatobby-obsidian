# Live observation ownership

[index.ts](index.ts) exposes shared native observation services. The plugin owns
one App-scoped [semantic service](semantic-context-service.ts) and
[UI snapshot service](ui-snapshot-service.ts), disposed on unload. Events
invalidate semantic observations; capture reads live editors/workspace on demand.
UI observations retain document identities and revision/expiry-bound references.
Prompt callers and explicit context tools share services, not an authorization
decision: their existing admission and validation boundaries still apply.

The [context API and test map](../../docs/api/context.md) route to cache/revision,
unsaved-editor, paging, stale-reference and traversal tests. [Prompt ownership](../prompt/README.md)
explains full ordinary-turn packets and separate raw/queued routes. Run
`npm test -- tests/obsidian-context tests/prompt` for local feedback; synthetic
App/DOM fixtures do not establish installed focus or runtime authorization.
