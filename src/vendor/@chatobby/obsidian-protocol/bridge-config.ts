import { OBSIDIAN_BRIDGE_PROTOCOL_VERSION } from "./bridge-errors.ts";

export interface ObsidianBridgeConnectionConfig {
	type: "bridge_config";
	schemaVersion: 1;
	url: string;
	token: string;
	protocolVersion: typeof OBSIDIAN_BRIDGE_PROTOCOL_VERSION;
	vaultId: string;
	vaultRoot: string;
}

export function parseObsidianBridgeConnectionConfig(input: unknown): ObsidianBridgeConnectionConfig {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		throw new TypeError("bridge_config must be an object");
	}
	const value = input as Record<string, unknown>;
	const allowed = new Set(["type", "schemaVersion", "url", "token", "protocolVersion", "vaultId", "vaultRoot"]);
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) throw new TypeError(`bridge_config contains unknown field: ${key}`);
	}
	if (value.type !== "bridge_config") throw new TypeError("bridge_config.type must be bridge_config");
	if (value.schemaVersion !== 1) throw new TypeError("bridge_config.schemaVersion must be 1");
	if (value.protocolVersion !== OBSIDIAN_BRIDGE_PROTOCOL_VERSION) {
		throw new TypeError(`bridge_config.protocolVersion must be ${OBSIDIAN_BRIDGE_PROTOCOL_VERSION}`);
	}
	const url = requireNonEmptyString(value.url, "bridge_config.url");
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		throw new TypeError("bridge_config.url must be an absolute WebSocket URL");
	}
	if (parsedUrl.protocol !== "ws:" && parsedUrl.protocol !== "wss:") {
		throw new TypeError("bridge_config.url must use ws or wss");
	}
	if (!["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname)) {
		throw new TypeError("bridge_config.url must target loopback");
	}
	const vaultRoot = requireNonEmptyString(value.vaultRoot, "bridge_config.vaultRoot");
	if (!isPortableAbsolutePath(vaultRoot)) {
		throw new TypeError("bridge_config.vaultRoot must be an absolute canonical root");
	}
	return {
		type: "bridge_config",
		schemaVersion: 1,
		url,
		token: requireNonEmptyString(value.token, "bridge_config.token"),
		protocolVersion: OBSIDIAN_BRIDGE_PROTOCOL_VERSION,
		vaultId: requireBoundedIdentifier(value.vaultId, "bridge_config.vaultId"),
		vaultRoot,
	};
}

function requireBoundedIdentifier(input: unknown, field: string): string {
	const value = requireNonEmptyString(input, field);
	if (value.length > 256) throw new TypeError(`${field} must not exceed 256 characters`);
	return value;
}

function isPortableAbsolutePath(value: string): boolean {
	return value.startsWith("/") || value.startsWith("\\\\") || /^[A-Za-z]:[\\/]/u.test(value);
}

function requireNonEmptyString(input: unknown, field: string): string {
	if (typeof input !== "string" || input.trim().length === 0 || input !== input.trim()) {
		throw new TypeError(`${field} must be a non-empty string`);
	}
	return input;
}
