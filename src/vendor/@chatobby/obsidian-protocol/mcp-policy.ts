// MCP adapter policy types and factory for the Obsidian bridge protocol.
// Defines the direct-tool set, policy options, and server entry shape for
// @chatobby/mcp-client integration.
//
// This module exports only types and a pure construction function.
// The executable factory that wires into @chatobby/mcp-client belongs to Phase 2
// under packages/chatobby-obsidian-agent/src/mcp/.

export type ObsidianDirectToolName = "obsidian_context" | "obsidian_find";

export interface ObsidianMcpPolicyOptions {
	bridgeUrl?: string;
	bridgeToken?: string;
	lifecycle?: "eager" | "lazy" | "keep-alive";
	idleTimeoutMinutes?: number;
	bridgeTimeoutMs?: number;
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

/** Context is direct; exact note resolution remains a deferred specialist. */
export const OBSIDIAN_DEFAULT_DIRECT_TOOLS: readonly ObsidianDirectToolName[] = ["obsidian_context"];

const DEFAULT_BRIDGE_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_MINUTES = 10;

/**
 * Create an Obsidian MCP server policy from the given options.
 *
 * This is a browser-safe pure function that constructs a plain object
 * representing the server entry for @chatobby/mcp-client. Defaults:
 * - lifecycle: "eager"
 * - idleTimeout: 10 minutes
 * - bridge timeout: 30000 ms
 * - direct tools: the compact context-only list
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
	env.CHATOBBY_OBSIDIAN_BRIDGE_TIMEOUT_MS = String(options?.bridgeTimeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS);

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
