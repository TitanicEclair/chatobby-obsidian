/** Connector presentation and coordination only; the runtime owns authorization.
 * @see docs/api/permissions.md
 */
export { PermissionsScreenController } from "./application/permissions-screen-controller";
/** Present durable requests in the existing extension UI host, retaining session binding. */
export { ProjectedPermissionRequests } from "./application/projected-permission-requests";
/** Adapt current feed notices through caller-owned snapshot and dispatch effects. */
export { synchronizeFeedPermissionRequests } from "./application/feed-permission-requests";
/** Coalesce decisions for one runtime, child, request, and revision; failures remain retryable. */
export { decidePermissionOnce } from "./application/permission-decision-guard";
/** Parse canonical runtime review metadata without inferring authority from display text. */
export { permissionRequestDisplay } from "./domain/permission-request";
/** Bound child-decision input; the runtime validates the actual operation and revision. */
export type { SubagentPermissionDecisionPayload } from "./domain/permission-request";
/** Explicit Allow once/Deny composer card that never treats typing Enter as approval. */
export { PermissionRequestCard } from "./ui/requests/permission-request-card";
/** Show one bounded notification per request ID during this plugin lifetime. */
export { notifyPermissionRequestOnce } from "./ui/requests/permission-request-notification";
