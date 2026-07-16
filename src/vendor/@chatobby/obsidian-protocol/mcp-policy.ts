// MCP adapter policy types and factory for the Obsidian bridge protocol.
// Defines the direct-tool set, policy options, and server entry shape for
// pi-mcp-adapter integration.
//
// This module exports only types and a pure construction function.
// The executable factory that wires into pi-mcp-adapter belongs to Phase 2
// under packages/chatobby-obsidian-agent/src/mcp/.

export type ObsidianDirectToolName =
	| "obsidian_get_context"
	| "obsidian_resolve_note"
	| "obsidian_read_note"
	| "obsidian_search"
	| "obsidian_read_image"
	| "obsidian_list_entries"
	| "obsidian_create_note"
	| "obsidian_edit_note"
	| "obsidian_open_note"
	| "obsidian_open_app";

export interface ObsidianMcpPolicyOptions {
	bridgeUrl?: string;
	bridgeToken?: string;
	cliPath?: string;
	cliResultsDir?: string;
	lifecycle?: "eager" | "lazy" | "keep-alive";
	idleTimeoutMinutes?: number;
	bridgeTimeoutMs?: number;
	cliTimeoutMs?: number;
	directTools?: readonly ObsidianDirectToolName[];
	excludeTools?: readonly string[];
}

export interface ObsidianMcpServerPolicy {
	serverName: "chatobby-obsidian";
	command: string;
	args: readonly string[];
	env: Record<string, string>;
	lifecycle: "eager" | "lazy" | "keep-alive";
	idleTimeout: number;
	directTools: readonly ObsidianDirectToolName[];
	excludeTools: readonly string[];
}

/** The fixed 10-tool direct-tool list for the initial adapter policy. */
export const OBSIDIAN_DEFAULT_DIRECT_TOOLS: readonly ObsidianDirectToolName[] = [
	"obsidian_get_context",
	"obsidian_resolve_note",
	"obsidian_read_note",
	"obsidian_search",
	"obsidian_read_image",
	"obsidian_list_entries",
	"obsidian_create_note",
	"obsidian_edit_note",
	"obsidian_open_note",
	"obsidian_open_app",
];

const DEFAULT_BRIDGE_TIMEOUT_MS = 30_000;
const DEFAULT_CLI_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_MINUTES = 10;

/**
 * Create an Obsidian MCP server policy from the given options.
 *
 * This is a browser-safe pure function that constructs a plain object
 * representing the server entry for pi-mcp-adapter. Defaults:
 * - lifecycle: "eager"
 * - idleTimeout: 10 minutes
 * - bridge timeout: 30000 ms
 * - CLI timeout: 30000 ms
 * - direct tools: the fixed 10-tool list
 * - excluded tools: empty
 */
export function createObsidianMcpServerPolicy(options?: ObsidianMcpPolicyOptions): ObsidianMcpServerPolicy {
	const lifecycle = options?.lifecycle ?? "eager";
	const idleTimeout = options?.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES;
	const directTools = options?.directTools ?? OBSIDIAN_DEFAULT_DIRECT_TOOLS;
	const excludeTools = options?.excludeTools ?? [];

	const env: Record<string, string> = {};
	if (options?.bridgeUrl !== undefined) {
		env.CHATOBBY_OBSIDIAN_BRIDGE_URL = options.bridgeUrl;
	}
	if (options?.bridgeToken !== undefined) {
		env.CHATOBBY_OBSIDIAN_BRIDGE_TOKEN = options.bridgeToken;
	}
	if (options?.cliPath !== undefined) {
		env.CHATOBBY_OBSIDIAN_CLI = options.cliPath;
	}
	if (options?.cliResultsDir !== undefined) {
		env.CHATOBBY_OBSIDIAN_CLI_RESULTS_DIR = options.cliResultsDir;
	}
	env.CHATOBBY_OBSIDIAN_BRIDGE_TIMEOUT_MS = String(options?.bridgeTimeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS);
	env.CHATOBBY_OBSIDIAN_CLI_TIMEOUT_MS = String(options?.cliTimeoutMs ?? DEFAULT_CLI_TIMEOUT_MS);

	return {
		serverName: "chatobby-obsidian",
		// Logical entry: the published bin name. The SDK layer
		// (createObsidianServerEntry) resolves this to a concrete `node <abs path>`
		// invocation at runtime when the MCP server package is installed; this
		// browser-safe default is the fallback when resolution is not possible
		// (e.g. inside a sealed binary that bundles the server itself).
		command: "chatobby-obsidian",
		args: [],
		env,
		lifecycle,
		idleTimeout,
		directTools,
		excludeTools,
	};
}
