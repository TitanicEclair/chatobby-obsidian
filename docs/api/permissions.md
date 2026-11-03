# Permissions frontend

The connector renders runtime-owned policies and exact-operation reviews. It does
not evaluate policy, grant authority, or persist a second permission model.
Consumers use [public.ts](../../src/features/permissions/public.ts); canonical wire
types and review parsing come from the generated runtime client.

## Ownership and lifetime

| Area | Responsibility |
|---|---|
| `features/permissions/domain/` | Stable workspace identity and canonical review parsing; no DOM or effects. |
| `features/permissions/application/` | Screen loading, current target/revision checks, durable notice projection, and decision coalescing. |
| `features/permissions/ui/` | Workspace selection, mode/request choices, tool opt-outs, focus, and loading/error presentation. |
| `ui/compatibility/` within the feature | Older-runtime session policy, app-grant and effective-access display only. |
| `ui/requests/` within the feature | Deliberate Allow once/Deny cards and one bounded notification per request. |

`PermissionsScreenController` owns one view. Closing it disposes subscriptions and
invalidates pending presentation updates without undoing a committed runtime action.
Selection and busy/error state are local; saved policies, grants, revisions, and
workspace identity come from snapshots. Network is not a current workspace control.

`ProjectedPermissionRequests` accepts a narrow UI host. The feed adapter receives
snapshot and dispatch callbacks from its caller, so it does not import the view or
notice controller. Both recheck runtime/view/session binding before dispatch.
Stale requests cannot approve an action in a new session. Failed dispatches stay
retryable; successful decisions coalesce across parent, child, and feed surfaces.
The notification cache retains at most 256 request IDs. The decision cache retains
in-flight promises and at most 256 settled request identities.

## Compatibility boundary

OS sandbox setup, verification, recovery and revocation controls are retired. The
connector never advertises `native-sandbox-setup`; stale setup actions are rejected
before transport. Historical native fields can still be parsed by the generated
client, but cannot expose those controls. Older runtime screens direct users to
update and retain their reported access and application-grant controls.

This UI change does not delete persisted grants, runtime migration/recovery
records, or development-pair receipts. Those belong to the runtime and installation
owners. Current workspace modes, request behavior, native-tool opt-outs, and
exact-operation review remain supported.

## Test-purpose map

| Invariant | Tests |
|---|---|
| Workspace selection, revision conflict, stale target and busy/disposal behavior | [workspace settings](../../tests/ui/workspace-permission-settings.test.ts), [screen controller](../../tests/ui/permissions-screen-controller.test.ts) |
| Current and older-runtime app grants, policy ownership, migration notice, effective reporting | [permission view](../../tests/ui/permissions-view.test.ts) |
| Historical native projections and old build flags cannot restore setup UI/capability | [native retirement](../../tests/ui/permissions-native-retirement.test.ts), [bootstrap negotiation](../../tests/ui/frontend-bootstrap-request.test.ts), [welcome](../../tests/ui/product-intro-modal.test.ts) |
| Exact review, keyboard behavior, preserved drafts, stale binding, duplicate decisions and retry | [permission cards](../../tests/ui/permission-request-ui.test.ts), [durable projections](../../tests/ui/projected-permission-requests.test.ts), [extension UI](../../tests/ui/extension-ui-controller.test.ts) |
| Public imports, pure domain, and absence of controller/feature cycles | [feature boundaries](../../tests/architecture/feature-boundaries.test.ts) |

Run a named file with `npx vitest run tests/ui/workspace-permission-settings.test.ts`;
run `npm run check`, `npm test`, and `npm run check:community-review` for the full
connector gate. These use synthetic snapshots and DOM hosts, not an installed
runtime. Paired live acceptance must still check workspace switching, tool opt-out
persistence, request focus/draft preservation, and deliberate approval/denial in
the registered disposable vault.
