// Generated from packages/chatobby/src/control/contracts.ts. Do not edit.
import {
	CHATOBBY_PRODUCT_VERSION,
	CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
	CHATOBBY_RUNTIME_PROTOCOL_VERSION,
} from "./product.generated.ts";

export { CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION, CHATOBBY_RUNTIME_PROTOCOL_VERSION };
export const CHATOBBY_RUNTIME_VERSION = CHATOBBY_PRODUCT_VERSION;
export const CHATOBBY_RUNTIME_HELLO_TIMEOUT_MS = 5_000;
export const CHATOBBY_RUNTIME_STARTUP_ADMISSION_TIMEOUT_MS = 10 * 60 * 1000;
export const CHATOBBY_RUNTIME_REATTACH_GRACE_MS = 15_000;
/** Outer connector wait includes cancellation of cold native helpers and owned cleanup. */
export const CHATOBBY_RUNTIME_SHUTDOWN_TIMEOUT_MS = 75_000;
/** Allows the five-minute engine deadline to settle and report before the transport gives up. */
export const CHATOBBY_COMPACTION_REQUEST_TIMEOUT_MS = 5 * 60 * 1000 + 30_000;
/** A prompt may wait behind a bounded manual checkpoint before it is accepted. */
export const CHATOBBY_PROMPT_REQUEST_TIMEOUT_MS = CHATOBBY_COMPACTION_REQUEST_TIMEOUT_MS;

export const RUNTIME_CLOSE_CODES = {
	authenticationFailed: 4401,
	identityMismatch: 4403,
	protocolMismatch: 4406,
	helloTimeout: 4408,
} as const;

export interface RuntimeIdentity {
	instanceId: string;
	vaultId: string;
	pid: number;
	startedAt: number;
	runtimeVersion: string;
	protocolVersion: number;
	runtimePackageFingerprint: string | null;
	/** Exact private-source development build; never substitutes for a verified release package fingerprint. */
	developmentBuildFingerprint: string | null;
}

export interface RuntimeReadyDescriptor extends RuntimeIdentity {
	schemaVersion: typeof CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION;
	host: "127.0.0.1";
	port: number;
	controlTokenFingerprint: string;
	sessionTokenFingerprint: string;
}

export interface RuntimeStatusResponse {
	ready: boolean;
	identity: RuntimeIdentity;
	maintenance: RuntimeMaintenanceSnapshot;
}

export type RuntimeMaintenancePurpose = "runtime-update" | "development-reconcile";

export type RuntimeMaintenanceActiveWorkKind =
	| "maintenance"
	| "response"
	| "compaction"
	| "queued-prompt"
	| "subagent"
	| "event";

export interface RuntimeMaintenanceSnapshot {
	acceptingWork: boolean;
	activeWorkKinds: RuntimeMaintenanceActiveWorkKind[];
}

export interface RuntimeMaintenanceCurrentIdentity {
	instanceId: string;
	runtimePackageFingerprint: string | null;
	developmentBuildFingerprint: string | null;
}

export interface RuntimeMaintenanceTargetIdentity {
	runtimeVersion: string;
	runtimePackageFingerprint: string | null;
	developmentBuildFingerprint: string | null;
}

export interface RuntimeMaintenanceAdmitRequest {
	schemaVersion: 1;
	operationId: string;
	purpose: RuntimeMaintenancePurpose;
	current: RuntimeMaintenanceCurrentIdentity;
	target: RuntimeMaintenanceTargetIdentity;
}

export type RuntimeMaintenanceAdmission =
	| {
			schemaVersion: 1;
			status: "admitted";
			operationId: string;
			leaseId: string;
			expiresAt: number;
	  }
	| {
			schemaVersion: 1;
			status: "deferred";
			operationId: string;
			retryAfterMs: number;
			activeWorkKinds: RuntimeMaintenanceActiveWorkKind[];
	  };

export interface RuntimeMaintenanceLeaseRequest {
	schemaVersion: 1;
	operationId: string;
	leaseId: string;
}

export interface RuntimeMaintenanceLeaseResult {
	schemaVersion: 1;
	status: "committed" | "cancelled";
	operationId: string;
	leaseId: string;
}

export interface RuntimeClientHello {
	type: "hello";
	protocolVersion: number;
	pluginVersion: string;
	attachmentId: string;
	instanceId: string;
	vaultId: string;
	sessionToken: string;
}

export interface RuntimeServerHello {
	type: "hello_ack";
	protocolVersion: number;
	runtimeVersion: string;
	instanceId: string;
	vaultId: string;
}

/** Authenticated runtime that is completing a host-controlled startup gate. */
export interface RuntimeServerPending {
	type: "hello_pending";
	protocolVersion: number;
	runtimeVersion: string;
	instanceId: string;
	vaultId: string;
	phase: "migration";
}

/** Request that the connector atomically activate this verified runtime package. */
export interface RuntimeServerActivationRequired {
	type: "runtime_activation_required";
	protocolVersion: number;
	runtimeVersion: string;
	instanceId: string;
	vaultId: string;
	runtimePackageFingerprint: string;
	activationId: string;
	operation: "activate" | "rollback";
}

/** Connector acknowledgement for one exact runtime-package activation. */
export interface RuntimeClientActivationResult {
	type: "runtime_activation_result";
	protocolVersion: number;
	instanceId: string;
	vaultId: string;
	activationId: string;
	operation: "activate" | "rollback";
	status: "applied" | "failed";
}

export function parseRuntimeClientHello(value: unknown): RuntimeClientHello | null {
	if (!isRecord(value) || value.type !== "hello") return null;
	if (!Number.isInteger(value.protocolVersion) || typeof value.protocolVersion !== "number") return null;
	if (!isNonEmptyString(value.pluginVersion)) return null;
	if (!isNonEmptyString(value.attachmentId)) return null;
	if (!isNonEmptyString(value.instanceId)) return null;
	if (!isNonEmptyString(value.vaultId)) return null;
	if (!isNonEmptyString(value.sessionToken)) return null;
	return {
		type: "hello",
		protocolVersion: value.protocolVersion,
		pluginVersion: value.pluginVersion,
		attachmentId: value.attachmentId,
		instanceId: value.instanceId,
		vaultId: value.vaultId,
		sessionToken: value.sessionToken,
	};
}

export function parseRuntimeServerHello(value: unknown): RuntimeServerHello | null {
	if (!isRecord(value) || value.type !== "hello_ack") return null;
	if (!Number.isInteger(value.protocolVersion) || typeof value.protocolVersion !== "number") return null;
	if (!isNonEmptyString(value.runtimeVersion)) return null;
	if (!isNonEmptyString(value.instanceId)) return null;
	if (!isNonEmptyString(value.vaultId)) return null;
	return {
		type: "hello_ack",
		protocolVersion: value.protocolVersion,
		runtimeVersion: value.runtimeVersion,
		instanceId: value.instanceId,
		vaultId: value.vaultId,
	};
}

export function parseRuntimeServerPending(value: unknown): RuntimeServerPending | null {
	if (!isRecord(value) || value.type !== "hello_pending" || value.phase !== "migration") return null;
	if (!Number.isInteger(value.protocolVersion) || typeof value.protocolVersion !== "number") return null;
	if (!isNonEmptyString(value.runtimeVersion)) return null;
	if (!isNonEmptyString(value.instanceId)) return null;
	if (!isNonEmptyString(value.vaultId)) return null;
	return {
		type: "hello_pending",
		protocolVersion: value.protocolVersion,
		runtimeVersion: value.runtimeVersion,
		instanceId: value.instanceId,
		vaultId: value.vaultId,
		phase: "migration",
	};
}

export function parseRuntimeServerActivationRequired(value: unknown): RuntimeServerActivationRequired | null {
	if (!isRecord(value) || value.type !== "runtime_activation_required") return null;
	if (!Number.isInteger(value.protocolVersion) || typeof value.protocolVersion !== "number") return null;
	if (!isNonEmptyString(value.runtimeVersion)) return null;
	if (!isNonEmptyString(value.instanceId) || !isNonEmptyString(value.vaultId)) return null;
	if (!isSha256Fingerprint(value.runtimePackageFingerprint) || !isNonEmptyString(value.activationId)) return null;
	if (value.operation !== "activate" && value.operation !== "rollback") return null;
	return {
		type: "runtime_activation_required",
		protocolVersion: value.protocolVersion,
		runtimeVersion: value.runtimeVersion,
		instanceId: value.instanceId,
		vaultId: value.vaultId,
		runtimePackageFingerprint: value.runtimePackageFingerprint,
		activationId: value.activationId,
		operation: value.operation,
	};
}

export function parseRuntimeClientActivationResult(value: unknown): RuntimeClientActivationResult | null {
	if (!isRecord(value) || value.type !== "runtime_activation_result") return null;
	if (!Number.isInteger(value.protocolVersion) || typeof value.protocolVersion !== "number") return null;
	if (!isNonEmptyString(value.instanceId) || !isNonEmptyString(value.vaultId)) return null;
	if (!isNonEmptyString(value.activationId)) return null;
	if (value.operation !== "activate" && value.operation !== "rollback") return null;
	if (value.status !== "applied" && value.status !== "failed") return null;
	return {
		type: "runtime_activation_result",
		protocolVersion: value.protocolVersion,
		instanceId: value.instanceId,
		vaultId: value.vaultId,
		activationId: value.activationId,
		operation: value.operation,
		status: value.status,
	};
}

export function parseRuntimeReadyDescriptor(value: unknown): RuntimeReadyDescriptor | null {
	if (!isRecord(value)) return null;
	if (value.schemaVersion !== CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION) return null;
	if (!isNonEmptyString(value.instanceId) || !isNonEmptyString(value.vaultId)) return null;
	if (!isPositiveInteger(value.pid) || !isPositiveInteger(value.startedAt)) return null;
	if (!isNonEmptyString(value.runtimeVersion) || !isPositiveInteger(value.protocolVersion)) return null;
	if (value.runtimePackageFingerprint !== null && !isSha256Fingerprint(value.runtimePackageFingerprint)) return null;
	const developmentBuildFingerprint = value.developmentBuildFingerprint ?? null;
	if (developmentBuildFingerprint !== null && !isSha256Fingerprint(developmentBuildFingerprint)) return null;
	if (value.host !== "127.0.0.1" || !isPort(value.port)) return null;
	if (!isSha256Fingerprint(value.controlTokenFingerprint)) return null;
	if (!isSha256Fingerprint(value.sessionTokenFingerprint)) return null;
	return {
		schemaVersion: CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
		instanceId: value.instanceId,
		vaultId: value.vaultId,
		pid: value.pid,
		startedAt: value.startedAt,
		runtimeVersion: value.runtimeVersion,
		protocolVersion: value.protocolVersion,
		runtimePackageFingerprint: value.runtimePackageFingerprint,
		developmentBuildFingerprint,
		host: "127.0.0.1",
		port: value.port,
		controlTokenFingerprint: value.controlTokenFingerprint,
		sessionTokenFingerprint: value.sessionTokenFingerprint,
	};
}

export function parseRuntimeMaintenanceAdmitRequest(value: unknown): RuntimeMaintenanceAdmitRequest | null {
	if (!isRecord(value) || value.schemaVersion !== 1 || !isOperationId(value.operationId)) return null;
	if (value.purpose !== "runtime-update" && value.purpose !== "development-reconcile") return null;
	const current = parseMaintenanceCurrentIdentity(value.current);
	const target = parseMaintenanceTargetIdentity(value.target);
	if (!current || !target) return null;
	if ((target.runtimePackageFingerprint === null) === (target.developmentBuildFingerprint === null)) return null;
	return { schemaVersion: 1, operationId: value.operationId, purpose: value.purpose, current, target };
}

export function parseRuntimeMaintenanceLeaseRequest(value: unknown): RuntimeMaintenanceLeaseRequest | null {
	if (
		!isRecord(value) ||
		value.schemaVersion !== 1 ||
		!isOperationId(value.operationId) ||
		!isOperationId(value.leaseId)
	) {
		return null;
	}
	return { schemaVersion: 1, operationId: value.operationId, leaseId: value.leaseId };
}

function parseMaintenanceCurrentIdentity(value: unknown): RuntimeMaintenanceCurrentIdentity | null {
	if (!isRecord(value) || !isOperationId(value.instanceId)) return null;
	if (!isNullableFingerprint(value.runtimePackageFingerprint)) return null;
	if (!isNullableFingerprint(value.developmentBuildFingerprint)) return null;
	return {
		instanceId: value.instanceId,
		runtimePackageFingerprint: value.runtimePackageFingerprint,
		developmentBuildFingerprint: value.developmentBuildFingerprint,
	};
}

function parseMaintenanceTargetIdentity(value: unknown): RuntimeMaintenanceTargetIdentity | null {
	if (!isRecord(value) || !isNonEmptyString(value.runtimeVersion)) return null;
	if (!isNullableFingerprint(value.runtimePackageFingerprint)) return null;
	if (!isNullableFingerprint(value.developmentBuildFingerprint)) return null;
	return {
		runtimeVersion: value.runtimeVersion,
		runtimePackageFingerprint: value.runtimePackageFingerprint,
		developmentBuildFingerprint: value.developmentBuildFingerprint,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isPort(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 65_535;
}

function isSha256Fingerprint(value: unknown): value is string {
	return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isNullableFingerprint(value: unknown): value is string | null {
	return value === null || isSha256Fingerprint(value);
}

function isOperationId(value: unknown): value is string {
	return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/u.test(value);
}
