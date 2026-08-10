// Vault selector types and parser for the Obsidian bridge protocol.
// All bridge-backed operations accept a selector. Omitting the selector is
// valid only when exactly one bridge connection is registered.

export interface ObsidianVaultSelector {
	vaultId?: string;
	vaultName?: string;
	vaultRoot?: string;
}

const SELECTOR_KEYS = new Set(["vaultId", "vaultName", "vaultRoot"]);

/**
 * Parse an unknown value into a validated ObsidianVaultSelector.
 *
 * Accepts only `vaultId`, `vaultName`, and `vaultRoot` as optional string
 * fields. Rejects unknown fields and non-string values. Returns an empty
 * selector for undefined/null input.
 */
export function parseVaultSelector(input: unknown): ObsidianVaultSelector {
	if (input === undefined || input === null) {
		return {};
	}
	if (typeof input !== "object" || Array.isArray(input)) {
		throw new TypeError("Vault selector must be an object");
	}

	const obj = input as Record<string, unknown>;
	const result: ObsidianVaultSelector = {};

	for (const key of Object.keys(obj)) {
		if (!SELECTOR_KEYS.has(key)) {
			throw new TypeError(`Unknown vault selector field: ${key}`);
		}
	}

	if (obj.vaultId !== undefined) {
		if (typeof obj.vaultId !== "string") {
			throw new TypeError("vaultId must be a string");
		}
		result.vaultId = obj.vaultId;
	}
	if (obj.vaultName !== undefined) {
		if (typeof obj.vaultName !== "string") {
			throw new TypeError("vaultName must be a string");
		}
		result.vaultName = obj.vaultName;
	}
	if (obj.vaultRoot !== undefined) {
		if (typeof obj.vaultRoot !== "string") {
			throw new TypeError("vaultRoot must be a string");
		}
		result.vaultRoot = obj.vaultRoot;
	}

	return result;
}
