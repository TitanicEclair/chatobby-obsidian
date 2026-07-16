export declare const OBSIDIAN_BRIDGE_PROTOCOL_VERSION = 1;
export type ObsidianBridgeErrorCode = "OBSIDIAN_UNAVAILABLE" | "BRIDGE_PROTOCOL_MISMATCH" | "OBSIDIAN_VAULT_AMBIGUOUS" | "OBSIDIAN_BRIDGE_DISCONNECTED" | "DEADLINE_EXCEEDED" | "OPERATION_CANCELLED" | "NOTE_NOT_FOUND" | "PATH_AMBIGUOUS" | "REVISION_CONFLICT" | "PATH_EXISTS" | "INVALID_INPUT" | "UNSUPPORTED_OPERATION" | "COMMAND_NOT_ALLOWED" | "OBSIDIAN_OPERATION_FAILED" | "OBSIDIAN_CLI_NOT_FOUND" | "OBSIDIAN_CLI_FAILED" | "CLI_RESULT_NOT_FOUND";
export interface ObsidianBridgeErrorPayload {
    code: ObsidianBridgeErrorCode;
    message: string;
    retryable: boolean;
    details?: unknown;
}
/** Runtime set of all valid error codes for parser validation. */
export declare const OBSIDIAN_BRIDGE_ERROR_CODES: ReadonlySet<string>;
/**
 * Parse an unknown value into a validated ObsidianBridgeErrorPayload.
 *
 * Validates that `code` is a known ObsidianBridgeErrorCode, `message` is a
 * string, and `retryable` is a boolean. Throws on invalid input.
 */
export declare function parseBridgeErrorPayload(input: unknown): ObsidianBridgeErrorPayload;
