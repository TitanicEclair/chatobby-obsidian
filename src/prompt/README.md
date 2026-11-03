# Prompt boundary

[index.ts](index.ts) exposes native capture and packet projection;
[types.ts](types.ts) owns local observation declarations. Generated connector
contracts own the wire packet, and the runtime replaces frontend session
estimates with authoritative facts before model-context assembly.

[capture.ts](capture.ts) observes App-scoped semantic/UI services and environment.
[authorized-context.ts](authorized-context.ts) captures only between matching live
grant stamps; [context-packet.ts](context-packet.ts) projects fields and omission
metadata. Both capture and packet clipping remain: their callers and provenance
are distinct. [The context API](../../docs/api/context.md) documents limits and
the complete test map; [service ownership](../obsidian-context/README.md) explains
cache and observation lifetimes.

[Actual view-route tests](../../tests/ui/view-authorized-context.test.ts) invoke
ChatobbyView methods with controlled dependencies. They freeze exact first/later
ordinary transport arguments and verify raw/steer/follow-up omit passive capture;
they do not construct a full native view. [Capture tests](../../tests/prompt/capture.test.ts)
exercise real capture-to-packet projection using a synthetic App, including
cache counts and descriptive timing without a performance threshold. Run these
and `tests/prompt` with `npm test -- <test paths>` before checkpoint gates.
