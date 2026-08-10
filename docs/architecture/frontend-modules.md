# Frontend Modules

## Dependency direction

```text
wire types / transport
  -> feature public APIs
  -> UI controllers and screens
  -> presentation components
  -> ChatobbyView composition boundary
```

Feature domain and state modules cannot depend on Obsidian or DOM presentation. Consumers outside a feature import only its `public.ts`. UI components never import reducer internals or mutate store tables.

## Public entry points

| Entry point | Supported responsibility |
|---|---|
| `features/feed/public.ts` | Feed actions, store, commits, selectors, IDs, snapshots, explicit migration helpers. |
| `features/session/public.ts` | Per-tab session contract and constructor. |
| `features/commands/public.ts` | Slash-command controller and host capability contract. |
| `features/operations/public.ts` | Cross-surface operation domains, active-operation read models, and coordinator. |
| `features/projects/public.ts` | Runtime-projected Project library, Project-scoped chat browsing, and typed Project/session intents. |
| `features/settings/public.ts` | Chatobby-local Settings page that reuses connector credential and runtime services. |

Every export statement requires API documentation, enforced by `scripts/check-public-api.mjs` using the installed TypeScript compiler.

## Controller boundaries

- `SessionController`: tab registry, working-directory scope, initial backend history hydration, metadata refresh, and one preserved feed store per tab.
- `SlashCommandController`: catalogue, argument validation, surrounding-text policy, deterministic routing.
- `OperationCoordinator`: UI-agnostic producer lock state shared by runtime,
  session, and workflow business controllers.
- `LiveStatsController`: coalesced fetches and timer lifecycle.
- `ExtensionUiController`: extension panels/widgets and blocking interaction cards.
- `MemoryScreenController` / `PermissionsScreenController`: screen lifecycle and transport/data routing.

Controllers accept capabilities through constructor options. They should not query arbitrary DOM or reach into another feature's internal state.

Command, slash, and button components are consumers. They do not decide whether
a session/runtime mutation can overlap; the controller that owns the mutation
acquires the relevant operation domain and returns a typed conflict.

## Presentation boundaries

`FeedRenderer` binds to a `FeedStore`, subscribes to commits, and owns keyed DOM mounts. Block views receive projected entities and `FeedViewActions`. Memory presentation is divided into coordinator, model/action definitions, and controls/operations section renderers.

The Projects page is the user-facing Project and chat browser. It consumes the runtime-owned Projects projection and dispatches typed intents; it never infers Project identity from a path or silently changes the active chat while the user is browsing.

The Settings page hosts everyday provider, model-server, conversation, and Project preferences inside Chatobby. The Obsidian plugin settings page keeps installation, document-processing, and support discovery while linking to the in-product page. Both surfaces call the same credential and runtime services, so secret values never move into frontend state.

CSS is colocated with presentation. `ui/shared/tokens.css` is the only raw Obsidian-theme mapping layer; component CSS consumes semantic Chatobby tokens.

## Enforcement

`npm run check` validates types, public export documentation, deep-import rules, feed layer independence, removed compatibility imports, semantic CSS tokens, extracted-module cycles, and checked size ceilings. Exceptions require a rationale in the architecture test and cannot grow beyond the recorded ceiling.
