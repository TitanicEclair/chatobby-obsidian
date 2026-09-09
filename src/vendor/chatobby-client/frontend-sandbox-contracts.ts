// Generated from packages/chatobby/src/frontend-sandbox-contracts.ts. Do not edit.
/** Browser-safe display/consent projection. The native journal and permission domains remain authoritative. */
export type FrontendSandboxGrantStatus =
	| "setup-required"
	| "provisioning"
	| "configured"
	| "revoking"
	| "recovery-required"
	| "revoked";
export interface FrontendSandboxRoot {
	readonly stableId: string;
	readonly path: string;
}
export interface FrontendSandboxSetupPayload {
	readonly expectedSessionId: string;
	readonly expectedBindingRevision: number;
	readonly expectedPolicyRevision: number;
	readonly expectedGrantRevision: number;
	readonly targetFingerprint: string;
}
export interface FrontendSandboxRevokePayload {
	readonly expectedSessionId: string;
	readonly expectedGrantRevision: number;
	readonly grantId: string;
	readonly targetFingerprint: string;
}
export interface FrontendSandboxVerifyPayload {
	readonly expectedSessionId: string;
	readonly expectedVerificationRevision: number;
	readonly installationFingerprint: string;
	readonly action: "verify" | "recover";
}
export interface FrontendSandboxSetupViewModel {
	readonly sessionId: string;
	readonly verification?:
		| { readonly status: "unavailable"; readonly backendId?: "landstrip"; readonly reason: string }
		| {
				readonly status: "available";
				readonly backendId?: "windows-appcontainer" | "linux-bubblewrap" | "macos-seatbelt" | "landstrip";
				readonly revision: number;
				readonly installationFingerprint: string;
				readonly busy: boolean;
				readonly recoveryRequired: boolean;
				readonly historicalCleanupUnproved?: true;
				readonly ready: boolean;
				readonly reason?: string;
		  };
	readonly current:
		| { readonly status: "unavailable"; readonly reason: string; readonly roots: readonly FrontendSandboxRoot[] }
		| { readonly status: "not-required"; readonly roots: readonly FrontendSandboxRoot[] }
		| {
				readonly status: "available";
				readonly bindingRevision: number;
				readonly policyRevision: number;
				readonly accessMode: "read-only" | "workspace";
				readonly networkAccess: boolean;
				readonly roots: readonly FrontendSandboxRoot[];
				readonly grant: {
					readonly revision: number;
					readonly targetFingerprint: string;
					readonly status: FrontendSandboxGrantStatus;
					readonly reason?: string;
				};
		  };
	readonly owned:
		| { readonly status: "unavailable"; readonly reason: string }
		| {
				readonly status: "available";
				readonly revision: number;
				readonly grants: readonly {
					readonly grantId: string;
					readonly targetFingerprint: string;
					readonly status: Exclude<FrontendSandboxGrantStatus, "setup-required">;
					readonly accessMode: "read-only" | "workspace";
					readonly networkAccess: boolean;
					readonly bindingRevision: number;
					readonly policyRevision: number;
					readonly roots: readonly FrontendSandboxRoot[];
				}[];
		  };
}

export function parseFrontendSandboxSetupPayload(input: unknown): FrontendSandboxSetupPayload {
	const value = record(input, [
		"expectedSessionId",
		"expectedBindingRevision",
		"expectedPolicyRevision",
		"expectedGrantRevision",
		"targetFingerprint",
	]);
	return {
		expectedSessionId: string(value.expectedSessionId),
		expectedBindingRevision: revision(value.expectedBindingRevision, 1),
		expectedPolicyRevision: revision(value.expectedPolicyRevision, 1),
		expectedGrantRevision: revision(value.expectedGrantRevision),
		targetFingerprint: fingerprint(value.targetFingerprint),
	};
}
export function parseFrontendSandboxRevokePayload(input: unknown): FrontendSandboxRevokePayload {
	const value = record(input, ["expectedSessionId", "expectedGrantRevision", "grantId", "targetFingerprint"]);
	return {
		expectedSessionId: string(value.expectedSessionId),
		expectedGrantRevision: revision(value.expectedGrantRevision),
		grantId: grantId(value.grantId),
		targetFingerprint: fingerprint(value.targetFingerprint),
	};
}
export function parseFrontendSandboxVerifyPayload(input: unknown): FrontendSandboxVerifyPayload {
	const value = record(input, [
		"expectedSessionId",
		"expectedVerificationRevision",
		"installationFingerprint",
		"action",
	]);
	if (value.action !== "verify" && value.action !== "recover") throw invalid();
	return {
		expectedSessionId: string(value.expectedSessionId),
		expectedVerificationRevision: revision(value.expectedVerificationRevision),
		installationFingerprint: fingerprint(value.installationFingerprint),
		action: value.action,
	};
}
export function validateFrontendSandboxSetupView(input: unknown): void {
	const value = record(input, ["sessionId", "current", "owned", "verification"]);
	string(value.sessionId);
	if (value.verification !== undefined) {
		const verification = record(value.verification, [
			"status",
			"backendId",
			"reason",
			"revision",
			"installationFingerprint",
			"busy",
			"recoveryRequired",
			"historicalCleanupUnproved",
			"ready",
		]);
		if (verification.status === "unavailable") {
			record(verification, ["status", "backendId", "reason"]);
			if (verification.backendId !== undefined && verification.backendId !== "landstrip") throw invalid();
			string(verification.reason);
		} else {
			if (verification.status !== "available") throw invalid();
			if (
				verification.backendId !== undefined &&
				!["windows-appcontainer", "linux-bubblewrap", "macos-seatbelt", "landstrip"].includes(
					String(verification.backendId),
				)
			)
				throw invalid();
			revision(verification.revision);
			fingerprint(verification.installationFingerprint);
			boolean(verification.busy);
			boolean(verification.recoveryRequired);
			if (
				verification.historicalCleanupUnproved !== undefined &&
				(verification.historicalCleanupUnproved !== true || verification.backendId !== "landstrip")
			)
				throw invalid();
			boolean(verification.ready);
			if (verification.reason !== undefined) string(verification.reason);
		}
	}
	const current = record(value.current, [
		"status",
		"reason",
		"roots",
		"bindingRevision",
		"policyRevision",
		"accessMode",
		"networkAccess",
		"grant",
	]);
	validateRoots(current.roots);
	if (current.status === "not-required") {
		record(current, ["status", "roots"]);
	} else if (current.status === "unavailable") {
		record(current, ["status", "reason", "roots"]);
		string(current.reason);
	} else {
		if (current.status !== "available") throw invalid();
		record(current, ["status", "roots", "bindingRevision", "policyRevision", "accessMode", "networkAccess", "grant"]);
		revision(current.bindingRevision, 1);
		revision(current.policyRevision, 1);
		mode(current.accessMode);
		boolean(current.networkAccess);
		const grant = record(current.grant, ["revision", "targetFingerprint", "status", "reason"]);
		revision(grant.revision);
		fingerprint(grant.targetFingerprint);
		status(grant.status);
		if (grant.reason !== undefined) string(grant.reason);
	}
	const owned = record(value.owned, ["status", "reason", "revision", "grants"]);
	if (owned.status === "unavailable") {
		record(owned, ["status", "reason"]);
		string(owned.reason);
	} else {
		if (owned.status !== "available") throw invalid();
		record(owned, ["status", "revision", "grants"]);
		revision(owned.revision);
		if (!Array.isArray(owned.grants)) throw invalid();
		const ids = new Set<string>();
		for (const raw of owned.grants) {
			const grant = record(raw, [
				"grantId",
				"targetFingerprint",
				"status",
				"accessMode",
				"networkAccess",
				"bindingRevision",
				"policyRevision",
				"roots",
			]);
			const id = grantId(grant.grantId);
			if (ids.has(id)) throw invalid();
			ids.add(id);
			fingerprint(grant.targetFingerprint);
			status(grant.status);
			if (grant.status === "setup-required") throw invalid();
			mode(grant.accessMode);
			boolean(grant.networkAccess);
			revision(grant.bindingRevision, 1);
			revision(grant.policyRevision, 1);
			validateRoots(grant.roots);
		}
	}
}
function validateRoots(value: unknown): void {
	if (!Array.isArray(value) || value.length > 64) throw invalid();
	const ids = new Set<string>();
	for (const raw of value) {
		const root = record(raw, ["stableId", "path"]);
		const id = string(root.stableId);
		if (ids.has(id)) throw invalid();
		ids.add(id);
		string(root.path);
	}
}
function record(value: unknown, allowed: readonly string[]): Record<string, unknown> {
	if (
		!value ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		Object.keys(value).some((key) => !allowed.includes(key))
	)
		throw invalid();
	return value as Record<string, unknown>;
}
function string(value: unknown): string {
	if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw invalid();
	return value;
}
function revision(value: unknown, minimum = 0): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw invalid();
	return value;
}
function fingerprint(value: unknown): string {
	const text = string(value);
	if (!/^[a-f0-9]{64}$/u.test(text)) throw invalid();
	return text;
}
function grantId(value: unknown): string {
	const text = string(value);
	if (!/^[a-f0-9-]{36}$/u.test(text)) throw invalid();
	return text;
}
function mode(value: unknown): void {
	if (value !== "read-only" && value !== "workspace") throw invalid();
}
function boolean(value: unknown): void {
	if (typeof value !== "boolean") throw invalid();
}
function status(value: unknown): void {
	if (
		!["setup-required", "provisioning", "configured", "revoking", "recovery-required", "revoked"].includes(
			string(value),
		)
	)
		throw invalid();
}
function invalid(): Error {
	return new Error("Native setup display or consent is invalid.");
}
