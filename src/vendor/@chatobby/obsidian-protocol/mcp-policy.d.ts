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
export declare const OBSIDIAN_DEFAULT_DIRECT_TOOLS: readonly ObsidianDirectToolName[];
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
export declare function createObsidianMcpServerPolicy(options?: ObsidianMcpPolicyOptions): ObsidianMcpServerPolicy;
