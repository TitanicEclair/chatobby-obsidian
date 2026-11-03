# Feature owners

Import another feature through its `public.ts`. Feature folders may contain
domain data, application effects and UI, with each responsibility in its own
owner; their presence does not make connector state a backend authority.

| Guide | Local responsibility |
|---|---|
| [Settings](settings/README.md) | Vault configuration/defaults, persistence/migration and existing settings surfaces. |
| [Projects](projects/README.md) | Native directory actions, runtime-projected Project pages and local view state. |
| [Feed](feed/README.md) | Local presentation models, normalized store and snapshot/test routes. |
| [Session](session/README.md) | Preferences, runtime projections, per-tab construction and existing default identities. |
| [Memory](memory/README.md) | Runtime-projected browsing/actions and native page lifetimes. |
| [Frontend module map](../../docs/architecture/frontend-modules.md) | Other current public APIs and composition paths. |

The root data/settings compatibility facades use exact named export-only
exceptions to avoid UI-bearing barrels. See the owner guides and
[boundary tests](../../tests/architecture/feature-boundaries.test.ts); ordinary
private imports remain disallowed.
