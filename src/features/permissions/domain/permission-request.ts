import { parsePermissionRequestReview, type PermissionRequestReview } from "../../../vendor/chatobby-client/permission-review";

/** Presentation metadata only; the runtime binds approval to the exact operation. */
export type PermissionRequestDisplay = PermissionRequestReview;

/** Require structured runtime metadata; titles and tool text cannot select this card. */
export function permissionRequestDisplay(params: Readonly<Record<string, unknown>>): PermissionRequestDisplay | null {
  try { return parsePermissionRequestReview(params.permissionRequest); }
  catch { return null; }
}

/** Connector decision payload; runtime validation remains authoritative. */
export interface SubagentPermissionDecisionPayload {
  readonly runId: string;
  readonly nodeId: string;
  readonly permissionRequestId: string;
  readonly expectedPermissionRequestRevision: number;
  readonly approved: boolean;
  readonly value?: string;
}
