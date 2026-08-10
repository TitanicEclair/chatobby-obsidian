// Bridge message types and parsers for the Obsidian bridge protocol.
// Defines the bidirectional message format between the Obsidian plugin
// (client) and the Chatobby bridge service (server).

import type { ObsidianBridgeCapability } from "./bridge-capabilities.ts";
import { isBridgeCapability } from "./bridge-capabilities.ts";
import type { ObsidianBridgeErrorPayload } from "./bridge-errors.ts";
import { OBSIDIAN_BRIDGE_PROTOCOL_VERSION, parseBridgeErrorPayload } from "./bridge-errors.ts";
import type { ObsidianOperationName } from "./bridge-operations.ts";
import { isOperationName } from "./bridge-operations.ts";
import type {
	ProjectDirectoryObservationResult,
	ProjectDirectoryObserved,
	ProjectDirectoryRescanRequested,
	ProjectDirectoryRescanResult,
} from "./project-directory-protocol.ts";
import {
	parseProjectDirectoryObservationResult,
	parseProjectDirectoryObserved,
	parseProjectDirectoryRescanRequested,
	parseProjectDirectoryRescanResult,
} from "./project-directory-protocol.ts";
import type { ObsidianPluginState, ObsidianRuntimeDependencyState } from "./tool-capabilities.ts";

// --- Shared sub-types ---

export interface ObsidianBridgeVault {
	id: string;
	name: string;
	root?: string;
}

export interface ObsidianEnabledPlugin {
	id: string;
	name?: string;
	version?: string;
}

// --- Plugin-to-server messages ---

export interface ObsidianBridgeHello {
	type: "hello";
	authToken: string;
	protocolVersion: typeof OBSIDIAN_BRIDGE_PROTOCOL_VERSION;
	connectionId: string;
	vault: ObsidianBridgeVault;
	appVersion: string;
	pluginVersion: string;
	capabilities: ObsidianBridgeCapability[];
	enabledPlugins?: ObsidianEnabledPlugin[];
	plugins?: ObsidianPluginState[];
	runtimeDependencies?: ObsidianRuntimeDependencyState[];
}

export interface ObsidianBridgeCapabilitiesChanged {
	type: "capabilities_changed";
	capabilities: ObsidianBridgeCapability[];
	plugins: ObsidianPluginState[];
	runtimeDependencies: ObsidianRuntimeDependencyState[];
}

export type ObsidianContextChangedDomain = "focus" | "workspace" | "editor" | "page" | "capabilities";

export interface ObsidianContextRevisions {
	workspace: number;
	editor: number;
	page: number;
	capabilities: number;
}

/**
 * Compact invalidation notice. The connector remains the snapshot authority;
 * the runtime uses this event only to invalidate cached projections and detect
 * missed updates before requesting fresh context.
 */
export interface ObsidianBridgeContextChanged {
	type: "context_changed";
	sequence: number;
	capturedAt: string;
	changed: ObsidianContextChangedDomain[];
	revisions: ObsidianContextRevisions;
	summary?: {
		activeLeafId?: string;
		viewType?: string;
		path?: string;
	};
}

export interface ObsidianBridgePing {
	type: "ping";
	requestId?: string;
	sentAt: string;
}

export interface ObsidianBridgeResult {
	type: "result";
	requestId: string;
	result: unknown;
}

export interface ObsidianBridgeError {
	type: "error";
	requestId: string;
	error: ObsidianBridgeErrorPayload;
}

export type ObsidianPluginToServerMessage =
	| ObsidianBridgeHello
	| ObsidianBridgePing
	| ObsidianBridgeCapabilitiesChanged
	| ObsidianBridgeContextChanged
	| ProjectDirectoryObserved
	| ProjectDirectoryRescanRequested
	| ObsidianBridgeResult
	| ObsidianBridgeError;

// --- Server-to-plugin messages ---

export interface ObsidianBridgePong {
	type: "pong";
	requestId?: string;
	sentAt: string;
}

export interface ObsidianBridgeInvoke {
	type: "invoke";
	requestId: string;
	operation: ObsidianOperationName;
	arguments: Record<string, unknown>;
	deadline: string;
}

export interface ObsidianBridgeCancel {
	type: "cancel";
	requestId: string;
	reason: "timeout" | "client_abort" | "disconnect" | "shutdown";
}

export type ObsidianServerToPluginMessage =
	| ObsidianBridgePong
	| ObsidianBridgeInvoke
	| ObsidianBridgeCancel
	| ProjectDirectoryObservationResult
	| ProjectDirectoryRescanResult;

// --- Parsers ---

function isPlainObject(input: unknown): input is Record<string, unknown> {
	return input !== null && typeof input === "object" && !Array.isArray(input);
}

function parseVault(input: unknown): ObsidianBridgeVault {
	if (!isPlainObject(input)) throw new TypeError("Vault must be an object");
	if (typeof input.id !== "string") throw new TypeError("Vault id must be a string");
	if (typeof input.name !== "string") throw new TypeError("Vault name must be a string");
	const result: ObsidianBridgeVault = { id: input.id, name: input.name };
	if (input.root !== undefined) {
		if (typeof input.root !== "string") throw new TypeError("Vault root must be a string");
		result.root = input.root;
	}
	return result;
}

function parseEnabledPlugin(input: unknown): ObsidianEnabledPlugin {
	if (!isPlainObject(input)) throw new TypeError("Enabled plugin must be an object");
	if (typeof input.id !== "string") throw new TypeError("Enabled plugin id must be a string");
	const result: ObsidianEnabledPlugin = { id: input.id };
	if (input.name !== undefined) {
		if (typeof input.name !== "string") throw new TypeError("Enabled plugin name must be a string");
		result.name = input.name;
	}
	if (input.version !== undefined) {
		if (typeof input.version !== "string") throw new TypeError("Enabled plugin version must be a string");
		result.version = input.version;
	}
	return result;
}

function parsePluginState(input: unknown): ObsidianPluginState {
	if (!isPlainObject(input)) throw new TypeError("Plugin state must be an object");
	if (typeof input.id !== "string" || typeof input.name !== "string") {
		throw new TypeError("Plugin state requires string id and name");
	}
	if (input.kind !== "community" && input.kind !== "core") throw new TypeError("Plugin state kind is invalid");
	if (typeof input.installed !== "boolean" || typeof input.enabled !== "boolean") {
		throw new TypeError("Plugin state requires installed and enabled booleans");
	}
	return {
		id: input.id,
		name: input.name,
		...(typeof input.version === "string" ? { version: input.version } : {}),
		kind: input.kind,
		installed: input.installed,
		enabled: input.enabled,
	};
}

function parseRuntimeDependency(input: unknown): ObsidianRuntimeDependencyState {
	if (!isPlainObject(input)) throw new TypeError("Runtime dependency must be an object");
	if (typeof input.id !== "string" || typeof input.name !== "string" || typeof input.available !== "boolean") {
		throw new TypeError("Runtime dependency requires id, name, and available state");
	}
	return {
		id: input.id,
		name: input.name,
		available: input.available,
		...(typeof input.detail === "string" ? { detail: input.detail } : {}),
	};
}

function parseCapabilities(input: unknown): ObsidianBridgeCapability[] {
	if (!Array.isArray(input)) throw new TypeError("capabilities must be an array");
	return input.map((capability: unknown) => {
		if (typeof capability !== "string") throw new TypeError("Capability must be a string");
		if (!isBridgeCapability(capability)) throw new TypeError(`Unknown bridge capability: ${capability}`);
		return capability;
	});
}

function parseHello(input: Record<string, unknown>): ObsidianBridgeHello {
	if (typeof input.authToken !== "string") throw new TypeError("hello.authToken must be a string");
	if (input.protocolVersion !== OBSIDIAN_BRIDGE_PROTOCOL_VERSION) {
		throw new TypeError(
			`Protocol version mismatch: expected ${OBSIDIAN_BRIDGE_PROTOCOL_VERSION}, got ${String(input.protocolVersion)}`,
		);
	}
	if (typeof input.connectionId !== "string") throw new TypeError("hello.connectionId must be a string");
	if (typeof input.appVersion !== "string") throw new TypeError("hello.appVersion must be a string");
	if (typeof input.pluginVersion !== "string") throw new TypeError("hello.pluginVersion must be a string");
	const capabilities = parseCapabilities(input.capabilities);

	const result: ObsidianBridgeHello = {
		type: "hello",
		authToken: input.authToken,
		protocolVersion: OBSIDIAN_BRIDGE_PROTOCOL_VERSION,
		connectionId: input.connectionId,
		vault: parseVault(input.vault),
		appVersion: input.appVersion,
		pluginVersion: input.pluginVersion,
		capabilities,
	};

	if (input.enabledPlugins !== undefined) {
		if (!Array.isArray(input.enabledPlugins)) throw new TypeError("hello.enabledPlugins must be an array");
		result.enabledPlugins = input.enabledPlugins.map(parseEnabledPlugin);
	}
	if (input.plugins !== undefined) {
		if (!Array.isArray(input.plugins)) throw new TypeError("hello.plugins must be an array");
		result.plugins = input.plugins.map(parsePluginState);
	}
	if (input.runtimeDependencies !== undefined) {
		if (!Array.isArray(input.runtimeDependencies)) throw new TypeError("hello.runtimeDependencies must be an array");
		result.runtimeDependencies = input.runtimeDependencies.map(parseRuntimeDependency);
	}

	return result;
}

function parseCapabilitiesChanged(input: Record<string, unknown>): ObsidianBridgeCapabilitiesChanged {
	if (!Array.isArray(input.plugins) || !Array.isArray(input.runtimeDependencies)) {
		throw new TypeError("capabilities_changed requires plugin and runtime dependency arrays");
	}
	return {
		type: "capabilities_changed",
		capabilities: parseCapabilities(input.capabilities),
		plugins: input.plugins.map(parsePluginState),
		runtimeDependencies: input.runtimeDependencies.map(parseRuntimeDependency),
	};
}

const CONTEXT_CHANGED_DOMAINS = new Set<ObsidianContextChangedDomain>([
	"focus",
	"workspace",
	"editor",
	"page",
	"capabilities",
]);

function parseNonNegativeInteger(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
		throw new TypeError(`${field} must be a non-negative integer`);
	}
	return value;
}

function parseContextRevisions(input: unknown): ObsidianContextRevisions {
	if (!isPlainObject(input)) throw new TypeError("context_changed.revisions must be an object");
	return {
		workspace: parseNonNegativeInteger(input.workspace, "context_changed.revisions.workspace"),
		editor: parseNonNegativeInteger(input.editor, "context_changed.revisions.editor"),
		page: parseNonNegativeInteger(input.page, "context_changed.revisions.page"),
		capabilities: parseNonNegativeInteger(input.capabilities, "context_changed.revisions.capabilities"),
	};
}

function parseContextChanged(input: Record<string, unknown>): ObsidianBridgeContextChanged {
	const sequence = parseNonNegativeInteger(input.sequence, "context_changed.sequence");
	if (typeof input.capturedAt !== "string" || !Number.isFinite(Date.parse(input.capturedAt))) {
		throw new TypeError("context_changed.capturedAt must be an ISO timestamp");
	}
	if (!Array.isArray(input.changed) || input.changed.length === 0) {
		throw new TypeError("context_changed.changed must be a non-empty array");
	}
	const changed = input.changed.map((domain) => {
		if (typeof domain !== "string" || !CONTEXT_CHANGED_DOMAINS.has(domain as ObsidianContextChangedDomain)) {
			throw new TypeError(`Unknown context change domain: ${String(domain)}`);
		}
		return domain as ObsidianContextChangedDomain;
	});
	const result: ObsidianBridgeContextChanged = {
		type: "context_changed",
		sequence,
		capturedAt: input.capturedAt,
		changed,
		revisions: parseContextRevisions(input.revisions),
	};
	if (input.summary !== undefined) {
		if (!isPlainObject(input.summary)) throw new TypeError("context_changed.summary must be an object");
		const summary: NonNullable<ObsidianBridgeContextChanged["summary"]> = {};
		for (const field of ["activeLeafId", "viewType", "path"] as const) {
			const value = input.summary[field];
			if (value !== undefined && typeof value !== "string") {
				throw new TypeError(`context_changed.summary.${field} must be a string`);
			}
			if (typeof value === "string") summary[field] = value;
		}
		result.summary = summary;
	}
	return result;
}

function parsePing(input: Record<string, unknown>): ObsidianBridgePing {
	if (typeof input.sentAt !== "string") throw new TypeError("ping.sentAt must be a string");
	const result: ObsidianBridgePing = { type: "ping", sentAt: input.sentAt };
	if (input.requestId !== undefined) {
		if (typeof input.requestId !== "string") throw new TypeError("ping.requestId must be a string");
		result.requestId = input.requestId;
	}
	return result;
}

function parseResult(input: Record<string, unknown>): ObsidianBridgeResult {
	if (typeof input.requestId !== "string") throw new TypeError("result.requestId must be a string");
	return { type: "result", requestId: input.requestId, result: input.result };
}

function parseError(input: Record<string, unknown>): ObsidianBridgeError {
	if (typeof input.requestId !== "string") throw new TypeError("error.requestId must be a string");
	return {
		type: "error",
		requestId: input.requestId,
		error: parseBridgeErrorPayload(input.error),
	};
}

function parsePong(input: Record<string, unknown>): ObsidianBridgePong {
	if (typeof input.sentAt !== "string") throw new TypeError("pong.sentAt must be a string");
	const result: ObsidianBridgePong = { type: "pong", sentAt: input.sentAt };
	if (input.requestId !== undefined) {
		if (typeof input.requestId !== "string") throw new TypeError("pong.requestId must be a string");
		result.requestId = input.requestId;
	}
	return result;
}

const VALID_CANCEL_REASONS = new Set(["timeout", "client_abort", "disconnect", "shutdown"]);

function parseInvoke(input: Record<string, unknown>): ObsidianBridgeInvoke {
	if (typeof input.requestId !== "string") throw new TypeError("invoke.requestId must be a string");
	if (typeof input.operation !== "string") throw new TypeError("invoke.operation must be a string");
	if (!isOperationName(input.operation)) {
		throw new TypeError(`Invalid operation name: ${input.operation}`);
	}
	if (!isPlainObject(input.arguments)) throw new TypeError("invoke.arguments must be an object");
	if (typeof input.deadline !== "string") throw new TypeError("invoke.deadline must be a string");
	return {
		type: "invoke",
		requestId: input.requestId,
		operation: input.operation,
		arguments: input.arguments,
		deadline: input.deadline,
	};
}

function parseCancel(input: Record<string, unknown>): ObsidianBridgeCancel {
	if (typeof input.requestId !== "string") throw new TypeError("cancel.requestId must be a string");
	if (typeof input.reason !== "string" || !VALID_CANCEL_REASONS.has(input.reason)) {
		throw new TypeError(`Invalid cancel reason: ${String(input.reason)}`);
	}
	return {
		type: "cancel",
		requestId: input.requestId,
		reason: input.reason as ObsidianBridgeCancel["reason"],
	};
}

/**
 * Parse an unknown value into a validated ObsidianPluginToServerMessage.
 *
 * Valid message types: hello, ping, result, error.
 * Throws on invalid input, missing required fields, wrong protocol version,
 * or non-object payloads.
 */
export function parsePluginToServerMessage(input: unknown): ObsidianPluginToServerMessage {
	if (!isPlainObject(input)) {
		throw new TypeError("Bridge message must be a non-null object");
	}
	const type = input.type;
	switch (type) {
		case "hello":
			return parseHello(input);
		case "ping":
			return parsePing(input);
		case "capabilities_changed":
			return parseCapabilitiesChanged(input);
		case "context_changed":
			return parseContextChanged(input);
		case "project_directory_observed":
			return parseProjectDirectoryObserved(input);
		case "project_directory_rescan_requested":
			return parseProjectDirectoryRescanRequested(input);
		case "result":
			return parseResult(input);
		case "error":
			return parseError(input);
		default:
			throw new TypeError(`Unknown plugin-to-server message type: ${String(type)}`);
	}
}

/**
 * Parse an unknown value into a validated ObsidianServerToPluginMessage.
 *
 * Valid message types: pong, invoke, cancel.
 * Throws on invalid input, missing required fields, or unknown types.
 */
export function parseServerToPluginMessage(input: unknown): ObsidianServerToPluginMessage {
	if (!isPlainObject(input)) {
		throw new TypeError("Bridge message must be a non-null object");
	}
	const type = input.type;
	switch (type) {
		case "pong":
			return parsePong(input);
		case "invoke":
			return parseInvoke(input);
		case "cancel":
			return parseCancel(input);
		case "project_directory_observation_result":
			return parseProjectDirectoryObservationResult(input);
		case "project_directory_rescan_result":
			return parseProjectDirectoryRescanResult(input);
		default:
			throw new TypeError(`Unknown server-to-plugin message type: ${String(type)}`);
	}
}
