/** Browser-safe projection of the permission domain's authenticated target. */
export type FrontendPermissionWorkspaceTarget = {
    readonly kind: "vault";
    readonly vaultId: string;
} | {
    readonly kind: "project";
    readonly vaultId: string;
    readonly projectId: string;
};
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
export declare function parseFrontendPermissionTarget(value: unknown): FrontendPermissionWorkspaceTarget;
/** Parse an explicit request behavior without silently accepting unknown values. */
export declare function parseFrontendRequestBehavior(value: unknown): FrontendPermissionRequestBehavior;
/** Parse the canonical data-only workspace policy mutation. */
export declare function parseFrontendWorkspacePolicyPayload(value: unknown): FrontendWorkspacePolicyPayload;
