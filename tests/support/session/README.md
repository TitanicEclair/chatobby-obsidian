# Session controller test support

`controller.ts` creates the existing application controller with synthetic vault,
transport and operation dependencies; it performs no filesystem, app or network
work. The fixture only supplies canonical session view-model fields.

- `ui/session/session-controller.test.ts`: ordinary session targeting and mutation behavior.
- `ui/session/session-recovery.test.ts`: actual recovery/transport coordination, deferred readiness and target ownership.
- `ui/view-snapshot-recovery.test.ts`: real view persistence/title callbacks during provisional bootstrap.

See [leaf session recovery](../../../docs/architecture/managed-runtime-lifecycle.md#leaf-session-recovery)
for the owner, lifetime and distinction between deterministic checks and installed latency acceptance.
