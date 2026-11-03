// Generated from packages/chatobby/src/frontend/contracts/permission-screen.ts. Do not edit.
import {
	type FrontendSandboxSetupViewModel,
	validateFrontendSandboxSetupView,
} from "../../frontend-sandbox-contracts.ts";
import {
	optionalString,
	requireBoolean,
	requireEnumValue,
	requireRecord,
	requireSafeInteger,
	requireString,
	validateArray,
} from "./validation.ts";
import {
	type FrontendPermissionRequestBehavior,
	type FrontendPermissionWorkspaceTarget,
	type FrontendWorkspacePermissionPolicy,
	parseFrontendPermissionTarget,
	parseFrontendRequestBehavior,
	parseFrontendWorkspacePolicyPayload,
} from "./workspace-permissions.ts";

export const OBSIDIAN_VAULT_ACCESS_WARNING = "Uses Obsidian’s app authority beyond ordinary filesystem scope.";

export type FrontendObsidianVaultAccessViewModel =
	| {
			readonly status: "available";
			readonly revision: number;
			readonly sessionId: string;
			readonly bindingRevision: number;
			readonly enabled: boolean;
			readonly source: "default" | "user";
			readonly warning: typeof OBSIDIAN_VAULT_ACCESS_WARNING;
	  }
	| {
			readonly status: "unavailable";
			readonly enabled: false;
			readonly warning: typeof OBSIDIAN_VAULT_ACCESS_WARNING;
			readonly reason: string;
	  };

export interface FrontendPermissionScreenViewModel {
	readonly screenId: "permissions";
	/** Absent on older runtimes; never infer Full-only operation from the plugin version. */
	readonly executionMode?: "full-access" | "permissions";
	readonly revision: number;
	/** Durable policy owner; delegated sessions display this inherited authority read-only. */
	readonly accessPolicySessionId: string;
	readonly accessPolicy: {
		readonly schemaVersion: 1;
		readonly revision: number;
		readonly accessMode: "read-only" | "workspace" | "full";
		readonly agentNetworkAccess: boolean;
		readonly requestBehavior?: FrontendPermissionRequestBehavior;
	};
	/** Current authenticated workspace; never inferred from a local folder. */
	readonly activeWorkspaceTarget?: FrontendPermissionWorkspaceTarget;
	readonly workspacePolicies?: readonly FrontendWorkspacePermissionPolicy[];
	readonly scope: {
		readonly bindingRevision: number;
		readonly kind: "project" | "vault";
		readonly selectedRootCount: number;
		readonly filesystemBound: boolean;
	};
	readonly nativeSupport: {
		readonly status: "ready" | "setup-required" | "unverified" | "unsupported";
		readonly backendId?: "windows-appcontainer" | "linux-bubblewrap" | "macos-seatbelt" | "landstrip";
		readonly reason?: string;
		readonly userAction?: string;
	};
	/** Absent only for additive compatibility with older runtimes; never infer a grant. */
	readonly obsidianVaultAccess?: FrontendObsidianVaultAccessViewModel;
	/** Explicit operator choices across this Vault; independent of session policy. */
	readonly workspaceVaultAccess?: readonly {
		readonly projectId: string | null;
		readonly projectRevision?: number;
		readonly label: string;
		readonly revision: number;
		readonly enabled: boolean;
		readonly source: "default" | "user";
	}[];
	/** Explicit setup/recovery, never a substitute for nativeSupport proof. Omitted without negotiation. */
	readonly nativeSetup?: FrontendSandboxSetupViewModel;
	readonly effective: {
		readonly fileRead: boolean;
		readonly fileWrite: boolean;
		readonly localProcess: "native-contained" | "unavailable" | "unsandboxed" | "restricted-commands";
		readonly obsidian: "typed-read" | "typed-workspace" | "unavailable" | "unsandboxed" | "app-authority";
		readonly agentNetworkAccess: boolean;
		readonly warning?: string;
	};
	readonly migrationNotice?: string;
	readonly loading: boolean;
	readonly error?: string;
	readonly statusMessage?: string;
}

/** Validate the complete permission projection before exposing controls. */
export function validatePermissionScreen(input: Record<string, unknown>): void {
	if (input.executionMode !== undefined)
		requireEnumValue(input.executionMode, "executionMode", ["full-access", "permissions"]);
	if (input.nativeSetup !== undefined) validateFrontendSandboxSetupView(input.nativeSetup);
	requireString(input.accessPolicySessionId, "accessPolicySessionId");
	const accessPolicy = requireRecord(input.accessPolicy, "accessPolicy");
	if (accessPolicy.schemaVersion !== 1) throw new Error("accessPolicy.schemaVersion must be 1");
	requireSafeInteger(accessPolicy.revision, "accessPolicy.revision");
	requireEnumValue(accessPolicy.accessMode, "accessPolicy.accessMode", ["read-only", "workspace", "full"]);
	if (accessPolicy.requestBehavior !== undefined) parseFrontendRequestBehavior(accessPolicy.requestBehavior);
	requireBoolean(accessPolicy.agentNetworkAccess, "accessPolicy.agentNetworkAccess");
	if (accessPolicy.accessMode === "full" && accessPolicy.agentNetworkAccess !== true) {
		throw new Error("Full access includes agent network access.");
	}
	const scope = requireRecord(input.scope, "scope");
	requireSafeInteger(scope.bindingRevision, "scope.bindingRevision");
	requireEnumValue(scope.kind, "scope.kind", ["project", "vault"]);
	requireSafeInteger(scope.selectedRootCount, "scope.selectedRootCount");
	requireBoolean(scope.filesystemBound, "scope.filesystemBound");
	if ((scope.selectedRootCount === 0) !== (scope.filesystemBound === false)) {
		throw new Error("Permission scope filesystemBound must match selectedRootCount.");
	}
	const nativeSupport = requireRecord(input.nativeSupport, "nativeSupport");
	if (
		input.executionMode === "full-access" &&
		(accessPolicy.accessMode !== "full" || nativeSupport.status !== "unsupported" || input.nativeSetup !== undefined)
	) {
		throw new Error("Full-only execution must report Full access with sandboxing unavailable and no native setup.");
	}
	requireEnumValue(nativeSupport.status, "nativeSupport.status", [
		"ready",
		"setup-required",
		"unverified",
		"unsupported",
	]);
	if (nativeSupport.backendId !== undefined) {
		requireEnumValue(nativeSupport.backendId, "nativeSupport.backendId", [
			"windows-appcontainer",
			"linux-bubblewrap",
			"macos-seatbelt",
			"landstrip",
		]);
	}
	optionalString(nativeSupport.reason, "nativeSupport.reason");
	optionalString(nativeSupport.userAction, "nativeSupport.userAction");
	if (input.obsidianVaultAccess !== undefined) {
		const grant = requireRecord(input.obsidianVaultAccess, "obsidianVaultAccess");
		const status = requireEnumValue(grant.status, "obsidianVaultAccess.status", ["available", "unavailable"]);
		const enabled = requireBoolean(grant.enabled, "obsidianVaultAccess.enabled");
		if (grant.warning !== OBSIDIAN_VAULT_ACCESS_WARNING) throw new Error("obsidianVaultAccess.warning is invalid");
		if (status === "available") {
			requireSafeInteger(grant.revision, "obsidianVaultAccess.revision");
			requireString(grant.sessionId, "obsidianVaultAccess.sessionId");
			requireSafeInteger(grant.bindingRevision, "obsidianVaultAccess.bindingRevision");
			requireEnumValue(grant.source, "obsidianVaultAccess.source", ["default", "user"]);
		} else {
			if (enabled) throw new Error("Unavailable Obsidian vault access must be Off");
			requireString(grant.reason, "obsidianVaultAccess.reason");
		}
	}
	if (input.workspaceVaultAccess !== undefined)
		validateArray(input.workspaceVaultAccess, "workspaceVaultAccess", (value, label) => {
			const grant = requireRecord(value, label);
			if (grant.projectId !== null) {
				requireString(grant.projectId, `${label}.projectId`);
				requireSafeInteger(grant.projectRevision, `${label}.projectRevision`);
			}
			requireString(grant.label, `${label}.label`);
			requireSafeInteger(grant.revision, `${label}.revision`);
			requireBoolean(grant.enabled, `${label}.enabled`);
			requireEnumValue(grant.source, `${label}.source`, ["default", "user"]);
		});
	if (input.activeWorkspaceTarget !== undefined) parseFrontendPermissionTarget(input.activeWorkspaceTarget);
	if (input.workspacePolicies !== undefined)
		validateArray(input.workspacePolicies, "workspacePolicies", (value) => {
			const policy = requireRecord(value, "workspace policy");
			parseFrontendWorkspacePolicyPayload({ ...policy, expectedRevision: policy.revision });
			requireString(policy.label, "workspace policy label");
		});
	if (
		input.executionMode === "permissions" &&
		(!input.activeWorkspaceTarget || !input.workspacePolicies || accessPolicy.requestBehavior === undefined)
	) {
		throw new Error("Permission execution requires a current workspace and request behavior.");
	}
	const effective = requireRecord(input.effective, "effective");
	requireBoolean(effective.fileRead, "effective.fileRead");
	requireBoolean(effective.fileWrite, "effective.fileWrite");
	requireEnumValue(effective.localProcess, "effective.localProcess", [
		"restricted-commands",
		"native-contained",
		"unavailable",
		"unsandboxed",
	]);
	requireEnumValue(effective.obsidian, "effective.obsidian", [
		"app-authority",
		"typed-read",
		"typed-workspace",
		"unavailable",
		"unsandboxed",
	]);
	requireBoolean(effective.agentNetworkAccess, "effective.agentNetworkAccess");
	optionalString(effective.warning, "effective.warning");
	optionalString(input.migrationNotice, "migrationNotice");
	optionalString(input.error, "error");
	optionalString(input.statusMessage, "statusMessage");
}
