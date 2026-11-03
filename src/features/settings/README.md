# Settings ownership

Consumers use [public.ts](public.ts). [domain/settings.ts](domain/settings.ts)
owns the connector's vault-local configuration declarations and shared defaults.
[infrastructure/settings-store.ts](infrastructure/settings-store.ts) owns the
existing `data.json` input, normalization, legacy migration and single-write
serialization for settings and session preferences.

The plugin retains its public settings object; the store mutates it in place.
Session preferences are persisted by the store, with declarations in the
[session owner](../session/domain/preferences.ts). Updating settings applies the in-memory
change before saving, and a rejected save does not roll it back. Legacy runtime
fields trigger a migration save only when `runtimeMode` is absent. This is
preserved behavior, not a new schema or migration.

Credential values pass transiently to the existing runtime credential callback.
Only configured flags enter plugin data. Credential dispatch must succeed before
the flag changes or a save begins. Obsidian secret references remain owned by
the [credential service](../../credentials/web-search.ts).

The old `types.ts` and `state/settings-store.ts` paths explicitly re-export their
named owner declarations. Those two compatibility exports avoid the UI-bearing
feature barrel; they are not exceptions for ordinary private imports. The
architecture tests enforce the exact exporter, target and names.

[main.ts](../../main.ts) owns runtime detach/start and configuration effects.
The [native settings tab](../../settings.ts) registers Obsidian settings and
delegates to its own [SettingsView](ui/settings-view.ts). Each embedded
[screen controller](application/settings-screen-controller.ts) constructs a
separate view and owns its store subscription and detach/close lifecycle.
Native settings do not discover providers. No catalogue cache is shared across
these instances.

SettingsView retains the live host, provider/local-document pair, loading and
pending refresh flags, and callbacks that read the current transport. It renders
local rows, requests discovery, then reads loading/error state in that order.
[Runtime](ui/runtime-section.ts), [document](ui/document-section.ts),
[display/shortcuts](ui/display-section.ts) and
[provider rows/web settings](ui/provider-section.ts) render cohesive sections;
[credential modals](ui/credential-modals.ts) own their existing draft/save state.
The existing local-provider and subscription-login modals remain in `ui/modals`.

Save callbacks keep the revision captured when opening a local-provider modal;
deletion reads the current revision after transport readiness. Deferred refresh
can still populate a reopened host: there is no request-generation guard in
this ownership change. That existing limit remains tracked in
[issue 60](https://github.com/TitanicEclair/chatobby/issues/60).

| Test | Purpose |
|---|---|
| [Store characterization](../../../tests/settings/settings-store.test.ts) | Actual store defaults/object identity, legacy snapshots, exact serialized data, mutation/save and credential/failure ordering. |
| [Runtime migrations](../../../tests/runtime/settings-migration.test.ts) | Existing runtime-mode, shell, OCR and onboarding compatibility. |
| [Credential service](../../../tests/credentials/web-search.test.ts) | Secret-reference dispatch and persistence boundaries. |
| [Feature boundaries](../../../tests/architecture/feature-boundaries.test.ts) | Narrow compatibility exports, configuration independence and import-cycle checks. |
| [Surface characterization](../../../tests/settings/settings-surfaces.test.ts) | Actual renderer/controller/store lifetimes, deferred pair publication/coalescing, native isolation, existing late-result behavior, control callbacks and modal/revision ordering. |
| [Settings/controller routes](../../../tests/settings.test.ts), [controller subscription](../../../tests/ui/settings-screen-controller.test.ts) | Provider ordering/details/modal continuity and a direct assertion that closed controllers unsubscribe, even when a detached renderer would ignore the refresh. |
| [Local-provider modal](../../../tests/ui/local-model-provider-modal.test.ts), [subscription login](../../../tests/ui/provider-login-modal.test.ts) | Existing model/credential form and login lifetimes used by the moved presentation callbacks. |

Run these suites through `npm test -- <test paths>` and the repository's
`npm run check`; the full connector test/build gates remain checkpoint gates.
