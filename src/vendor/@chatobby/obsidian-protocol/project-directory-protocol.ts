import { normalizeVaultFolderPath } from "./vault-paths.ts";

export const PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION = 1 as const;

export type ProjectDirectoryObservationStatus = "applied" | "no-op" | "recovery-required" | "conflict" | "rejected";

export type ProjectDirectoryRescanReason = "startup" | "queue-overflow" | "disconnect-timeout" | "retry-exhausted";

export interface ProjectDirectoryObserved {
	type: "project_directory_observed";
	schemaVersion: 1;
	requestId: string;
	observationId: string;
	observedAt: string;
	changeKind: "rename-or-move";
	entryKind: "folder";
	oldVaultRelativePath: string;
	newVaultRelativePath: string;
}

export interface ProjectDirectoryObservationResult {
	type: "project_directory_observation_result";
	schemaVersion: 1;
	requestId: string;
	observationId: string;
	status: ProjectDirectoryObservationStatus;
	resultingSequence?: number;
	errorCode?: string;
	retryable: boolean;
}

export interface ProjectDirectoryRescanRequested {
	type: "project_directory_rescan_requested";
	schemaVersion: 1;
	requestId: string;
	rescanId: string;
	requestedAt: string;
	reason: ProjectDirectoryRescanReason;
}

export interface ProjectDirectoryRescanResult {
	type: "project_directory_rescan_result";
	schemaVersion: 1;
	requestId: string;
	rescanId: string;
	status: ProjectDirectoryObservationStatus;
	resultingSequence?: number;
	errorCode?: string;
	retryable: boolean;
}

const OBSERVATION_STATUSES = new Set<ProjectDirectoryObservationStatus>([
	"applied",
	"no-op",
	"recovery-required",
	"conflict",
	"rejected",
]);
const RESCAN_REASONS = new Set<ProjectDirectoryRescanReason>([
	"startup",
	"queue-overflow",
	"disconnect-timeout",
	"retry-exhausted",
]);

export function parseProjectDirectoryObserved(input: unknown): ProjectDirectoryObserved {
	const value = requireExactObject(input, "project_directory_observed", [
		"type",
		"schemaVersion",
		"requestId",
		"observationId",
		"observedAt",
		"changeKind",
		"entryKind",
		"oldVaultRelativePath",
		"newVaultRelativePath",
	]);
	requireLiteral(value.type, "project_directory_observed", "type");
	requireLiteral(value.schemaVersion, PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION, "schemaVersion");
	const oldVaultRelativePath = requireCanonicalFolderPath(value.oldVaultRelativePath, "oldVaultRelativePath");
	const newVaultRelativePath = requireCanonicalFolderPath(value.newVaultRelativePath, "newVaultRelativePath");
	if (oldVaultRelativePath === newVaultRelativePath) {
		throw new TypeError("Project directory observation paths must differ.");
	}
	return {
		type: "project_directory_observed",
		schemaVersion: PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION,
		requestId: requireIdentifier(value.requestId, "requestId"),
		observationId: requireIdentifier(value.observationId, "observationId"),
		observedAt: requireCanonicalTimestamp(value.observedAt, "observedAt"),
		changeKind: requireLiteral(value.changeKind, "rename-or-move", "changeKind"),
		entryKind: requireLiteral(value.entryKind, "folder", "entryKind"),
		oldVaultRelativePath,
		newVaultRelativePath,
	};
}

export function parseProjectDirectoryObservationResult(input: unknown): ProjectDirectoryObservationResult {
	const value = requireExactObject(input, "project_directory_observation_result", [
		"type",
		"schemaVersion",
		"requestId",
		"observationId",
		"status",
		"resultingSequence",
		"errorCode",
		"retryable",
	]);
	requireLiteral(value.type, "project_directory_observation_result", "type");
	requireLiteral(value.schemaVersion, PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION, "schemaVersion");
	return parseResultFields(value, {
		type: "project_directory_observation_result",
		requestId: requireIdentifier(value.requestId, "requestId"),
		correlationKey: "observationId",
		correlationValue: requireIdentifier(value.observationId, "observationId"),
	});
}

export function parseProjectDirectoryRescanRequested(input: unknown): ProjectDirectoryRescanRequested {
	const value = requireExactObject(input, "project_directory_rescan_requested", [
		"type",
		"schemaVersion",
		"requestId",
		"rescanId",
		"requestedAt",
		"reason",
	]);
	requireLiteral(value.type, "project_directory_rescan_requested", "type");
	requireLiteral(value.schemaVersion, PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION, "schemaVersion");
	if (typeof value.reason !== "string" || !RESCAN_REASONS.has(value.reason as ProjectDirectoryRescanReason)) {
		throw new TypeError(`Invalid project directory rescan reason: ${String(value.reason)}`);
	}
	return {
		type: "project_directory_rescan_requested",
		schemaVersion: PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION,
		requestId: requireIdentifier(value.requestId, "requestId"),
		rescanId: requireIdentifier(value.rescanId, "rescanId"),
		requestedAt: requireCanonicalTimestamp(value.requestedAt, "requestedAt"),
		reason: value.reason as ProjectDirectoryRescanReason,
	};
}

export function parseProjectDirectoryRescanResult(input: unknown): ProjectDirectoryRescanResult {
	const value = requireExactObject(input, "project_directory_rescan_result", [
		"type",
		"schemaVersion",
		"requestId",
		"rescanId",
		"status",
		"resultingSequence",
		"errorCode",
		"retryable",
	]);
	requireLiteral(value.type, "project_directory_rescan_result", "type");
	requireLiteral(value.schemaVersion, PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION, "schemaVersion");
	return parseResultFields(value, {
		type: "project_directory_rescan_result",
		requestId: requireIdentifier(value.requestId, "requestId"),
		correlationKey: "rescanId",
		correlationValue: requireIdentifier(value.rescanId, "rescanId"),
	});
}

interface ObservationResultIdentity {
	type: "project_directory_observation_result";
	requestId: string;
	correlationKey: "observationId";
	correlationValue: string;
}

interface RescanResultIdentity {
	type: "project_directory_rescan_result";
	requestId: string;
	correlationKey: "rescanId";
	correlationValue: string;
}

function parseResultFields(
	value: Record<string, unknown>,
	identity: ObservationResultIdentity,
): ProjectDirectoryObservationResult;
function parseResultFields(
	value: Record<string, unknown>,
	identity: RescanResultIdentity,
): ProjectDirectoryRescanResult;
function parseResultFields(
	value: Record<string, unknown>,
	identity: ObservationResultIdentity | RescanResultIdentity,
): ProjectDirectoryObservationResult | ProjectDirectoryRescanResult {
	if (
		typeof value.status !== "string" ||
		!OBSERVATION_STATUSES.has(value.status as ProjectDirectoryObservationStatus)
	) {
		throw new TypeError(`Invalid project directory result status: ${String(value.status)}`);
	}
	if (typeof value.retryable !== "boolean") throw new TypeError("retryable must be a boolean");
	const optionalFields: { resultingSequence?: number; errorCode?: string } = {};
	if (value.resultingSequence !== undefined) {
		if (
			typeof value.resultingSequence !== "number" ||
			!Number.isSafeInteger(value.resultingSequence) ||
			value.resultingSequence < 0
		) {
			throw new TypeError("resultingSequence must be a non-negative integer");
		}
		optionalFields.resultingSequence = value.resultingSequence;
	}
	if (value.errorCode !== undefined) optionalFields.errorCode = requireIdentifier(value.errorCode, "errorCode");
	if (identity.type === "project_directory_observation_result") {
		return {
			type: identity.type,
			schemaVersion: PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION,
			requestId: identity.requestId,
			observationId: identity.correlationValue,
			status: value.status as ProjectDirectoryObservationStatus,
			retryable: value.retryable,
			...optionalFields,
		};
	}
	return {
		type: identity.type,
		schemaVersion: PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION,
		requestId: identity.requestId,
		rescanId: identity.correlationValue,
		status: value.status as ProjectDirectoryObservationStatus,
		retryable: value.retryable,
		...optionalFields,
	};
}

function requireCanonicalFolderPath(input: unknown, field: string): string {
	if (typeof input !== "string") throw new TypeError(`${field} must be a string`);
	const normalized = normalizeVaultFolderPath(input);
	if (normalized.length === 0) throw new TypeError(`${field} must identify a folder below the vault root`);
	if (normalized !== input) throw new TypeError(`${field} must be a normalized vault-relative folder path`);
	return normalized;
}

function requireCanonicalTimestamp(input: unknown, field: string): string {
	if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(input)) {
		throw new TypeError(`${field} must be a canonical UTC ISO timestamp`);
	}
	const parsed = new Date(input);
	if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== input) {
		throw new TypeError(`${field} must be a valid canonical UTC ISO timestamp`);
	}
	return input;
}

function requireIdentifier(input: unknown, field: string): string {
	if (typeof input !== "string" || input.length === 0 || input !== input.trim() || input.length > 256) {
		throw new TypeError(`${field} must be a non-empty bounded identifier`);
	}
	return input;
}

function requireLiteral<T extends string | number>(input: unknown, expected: T, field: string): T {
	if (input !== expected) throw new TypeError(`${field} must be ${String(expected)}`);
	return expected;
}

function requireExactObject(input: unknown, label: string, allowedKeys: readonly string[]): Record<string, unknown> {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		throw new TypeError(`${label} must be an object`);
	}
	const value = input as Record<string, unknown>;
	const allowed = new Set(allowedKeys);
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) throw new TypeError(`${label} contains unknown field: ${key}`);
	}
	return value;
}
