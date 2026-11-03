# Session ownership

[public.ts](public.ts) exposes per-tab construction, local preferences and
runtime session projections. [domain/preferences.ts](domain/preferences.ts)
defines persisted defaults; the [settings store](../settings/infrastructure/settings-store.ts)
continues to own their load/save and migration. The legacy six-value
`PermissionMode` is compatibility data, not runtime permission policy.

[domain/state.ts](domain/state.ts) owns projection/event declarations and shared
defaults. The runtime owns authoritative session state; [transitions.ts](../../transitions.ts)
applies existing events locally. [domain/session-tab.ts](domain/session-tab.ts)
creates a separate feed store but intentionally retains the existing shared
Composer default and nested empty-session references. This move does not add
fresh-default factories or change those aliases.

[Tab tests](../../../tests/ui/session/tab-state.test.ts) check navigation and
default identity; [transition tests](../../../tests/transitions.test.ts) cover
event application; [settings tests](../../../tests/settings/settings-store.test.ts)
protect actual persistence/default serialization. [Architecture tests](../../../tests/architecture/feature-boundaries.test.ts)
keep declarations independent and legacy facade exports exact. Run the named
files with `npm test -- <test paths>`, followed by repository checkpoint gates.
