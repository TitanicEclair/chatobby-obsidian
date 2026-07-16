// Bridge error codes and error payload types for the Obsidian bridge protocol.
// These error codes are used across bridge messages, MCP tool results, and
// internal Chatobby error envelopes.

export const OBSIDIAN_BRIDGE_PROTOCOL_VERSION = 1;

export type ObsidianBridgeErrorCode =
	| "OBSIDIAN_UNAVAILABLE"
	| "BRIDGE_PROTOCOL_MISMATCH"
	| "OBSIDIAN_VAULT_AMBIGUOUS"
	| "OBSIDIAN_BRIDGE_DISCONNECTED"
	| "DEADLINE_EXCEEDED"
	| "OPERATION_CANCELLED"
	| "NOTE_NOT_FOUND"
	| "PATH_AMBIGUOUS"
	| "REVISION_CONFLICT"
	| "PATH_EXISTS"
	| "INVALID_INPUT"
	| "UNSUPPORTED_OPERATION"
	| "COMMAND_NOT_ALLOWED"
	| "OBSIDIAN_OPERATION_FAILED"
	| "OBSIDIAN_CLI_NOT_FOUND"
	| "OBSIDIAN_CLI_FAILED"
	| "CLI_RESULT_NOT_FOUND";

export interface ObsidianBridgeErrorPayload {
	code: ObsidianBridgeErrorCode;
	message: string;
	retryable: boolean;
	details?: unknown;
}

/** Runtime set of all valid error codes for parser validation. */
export const OBSIDIAN_BRIDGE_ERROR_CODES: ReadonlySet<string> = new Set<string>([
	"OBSIDIAN_UNAVAILABLE",
	"BRIDGE_PROTOCOL_MISMATCH",
	"OBSIDIAN_VAULT_AMBIGUOUS",
	"OBSIDIAN_BRIDGE_DISCONNECTED",
	"DEADLINE_EXCEEDED",
	"OPERATION_CANCELLED",
	"NOTE_NOT_FOUND",
	"PATH_AMBIGUOUS",
	"REVISION_CONFLICT",
	"PATH_EXISTS",
	"INVALID_INPUT",
	"UNSUPPORTED_OPERATION",
	"COMMAND_NOT_ALLOWED",
	"OBSIDIAN_OPERATION_FAILED",
	"OBSIDIAN_CLI_NOT_FOUND",
	"OBSIDIAN_CLI_FAILED",
	"CLI_RESULT_NOT_FOUND",
]);

/**
 * Parse an unknown value into a validated ObsidianBridgeErrorPayload.
 *
 * Validates that `code` is a known ObsidianBridgeErrorCode, `message` is a
 * string, and `retryable` is a boolean. Throws on invalid input.
 */
export function parseBridgeErrorPayload(input: unknown): ObsidianBridgeErrorPayload {
	if (input === null || typeof input !== "object") {
		throw new TypeError("Bridge error payload must be an object");
	}
	const obj = input as Record<string, unknown>;

	if (typeof obj.code !== "string" || !OBSIDIAN_BRIDGE_ERROR_CODES.has(obj.code)) {
		throw new TypeError(`Invalid bridge error code: ${String(obj.code)}`);
	}
	if (typeof obj.message !== "string") {
		throw new TypeError("Bridge error message must be a string");
	}
	if (typeof obj.retryable !== "boolean") {
		throw new TypeError("Bridge error retryable must be a boolean");
	}

	return {
		code: obj.code as ObsidianBridgeErrorCode,
		message: obj.message,
		retryable: obj.retryable,
		...(obj.details !== undefined ? { details: obj.details } : {}),
	};
}
