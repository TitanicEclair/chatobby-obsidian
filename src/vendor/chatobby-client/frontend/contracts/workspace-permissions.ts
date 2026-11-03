// Generated from packages/chatobby/src/frontend/contracts/workspace-permissions.ts. Do not edit.
import { requireEnumValue, requireRecord, requireSafeInteger, requireString } from "./validation.ts";

/** Browser-safe projection of the permission domain's authenticated target. */
export type FrontendPermissionWorkspaceTarget =
	| { readonly kind: "vault"; readonly vaultId: string }
	| { readonly kind: "project"; readonly vaultId: string; readonly projectId: string };

/** Wire projection; parity with the canonical permission domain is regression-tested. */
export type FrontendPermissionRequestBehavior = "ask" | "reject";

/** One workspace's runtime-owned saved choices, including the implicit defaults. */
export interface FrontendWorkspacePermissionPolicy {
	readonly target: FrontendPermissionWorkspaceTarget;
	readonly label: string;
	readonly revision: number;
	readonly accessMode: "read-only" | "workspace" | "full";
	readonly requestBehavior: FrontendPermissionRequestBehavior;
}

/** The host authenticates the target again before committing this revisioned update. */
export interface FrontendWorkspacePolicyPayload {
	readonly target: FrontendPermissionWorkspaceTarget;
	readonly expectedRevision: number;
	readonly accessMode: FrontendWorkspacePermissionPolicy["accessMode"];
	readonly requestBehavior: FrontendPermissionRequestBehavior;
}

/** Reject device paths and mixed target shapes at the wire boundary. */
export function parseFrontendPermissionTarget(value: unknown): FrontendPermissionWorkspaceTarget {
	const input = requireRecord(value, "permission target");
	const kind = requireEnumValue(input.kind, "permission target kind", ["vault", "project"]);
	const vaultId = requireString(input.vaultId, "permission target vaultId");
	const allowed = kind === "vault" ? ["kind", "vaultId"] : ["kind", "vaultId", "projectId"];
	if (Object.keys(input).some((key) => !allowed.includes(key)))
		throw new Error("permission target contains an unknown field");
	return kind === "vault"
		? { kind, vaultId }
		: { kind, vaultId, projectId: requireString(input.projectId, "permission target projectId") };
}

/** Parse an explicit request behavior without silently accepting unknown values. */
export function parseFrontendRequestBehavior(value: unknown): FrontendPermissionRequestBehavior {
	return requireEnumValue(value, "requestBehavior", ["ask", "reject"]);
}

/** Parse the canonical data-only workspace policy mutation. */
export function parseFrontendWorkspacePolicyPayload(value: unknown): FrontendWorkspacePolicyPayload {
	const input = requireRecord(value, "workspace policy");
	return {
		target: parseFrontendPermissionTarget(input.target),
		expectedRevision: requireSafeInteger(input.expectedRevision, "workspace policy expectedRevision"),
		accessMode: requireEnumValue(input.accessMode, "workspace policy accessMode", ["read-only", "workspace", "full"]),
		requestBehavior: parseFrontendRequestBehavior(input.requestBehavior),
	};
}
