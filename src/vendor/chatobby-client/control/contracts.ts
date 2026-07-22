// Generated from packages/chatobby/src/control/contracts.ts. Do not edit.
export const CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION = 2 as const;
export const CHATOBBY_RUNTIME_PROTOCOL_VERSION = 3 as const;
export const CHATOBBY_RUNTIME_VERSION = "0.1.16";
export const CHATOBBY_RUNTIME_HELLO_TIMEOUT_MS = 5_000;
export const CHATOBBY_RUNTIME_REATTACH_GRACE_MS = 15_000;

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

export function parseRuntimeReadyDescriptor(value: unknown): RuntimeReadyDescriptor | null {
	if (!isRecord(value)) return null;
	if (value.schemaVersion !== CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION) return null;
	if (!isNonEmptyString(value.instanceId) || !isNonEmptyString(value.vaultId)) return null;
	if (!isPositiveInteger(value.pid) || !isPositiveInteger(value.startedAt)) return null;
	if (!isNonEmptyString(value.runtimeVersion) || !isPositiveInteger(value.protocolVersion)) return null;
	if (value.runtimePackageFingerprint !== null && !isSha256Fingerprint(value.runtimePackageFingerprint)) return null;
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
		host: "127.0.0.1",
		port: value.port,
		controlTokenFingerprint: value.controlTokenFingerprint,
		sessionTokenFingerprint: value.sessionTokenFingerprint,
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
