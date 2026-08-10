export type ObsidianDirectToolName = "obsidian_context" | "obsidian_find" | "obsidian_read" | "obsidian_write" | "obsidian_files" | "obsidian_open";
/** Legacy core primitives remain selectable for explicit compatibility policies. */
export type ObsidianLegacyDirectToolName = "obsidian_get_context" | "obsidian_resolve_note" | "obsidian_read_note" | "obsidian_search" | "obsidian_read_image" | "obsidian_list_entries" | "obsidian_create_note" | "obsidian_edit_note" | "obsidian_open_note" | "obsidian_open_app";
export interface ObsidianMcpPolicyOptions {
    bridgeUrl?: string;
    bridgeToken?: string;
    cliPath?: string;
    cliResultsDir?: string;
    lifecycle?: "eager" | "lazy" | "keep-alive";
    idleTimeoutMinutes?: number;
    bridgeTimeoutMs?: number;
    cliTimeoutMs?: number;
    directTools?: readonly (ObsidianDirectToolName | ObsidianLegacyDirectToolName)[];
    excludeTools?: readonly string[];
}
export interface ObsidianMcpServerPolicy {
    serverName: "chatobby-obsidian";
    command: string;
    args: readonly string[];
    env: Record<string, string>;
    lifecycle: "eager" | "lazy" | "keep-alive";
    idleTimeout: number;
    directTools: readonly (ObsidianDirectToolName | ObsidianLegacyDirectToolName)[];
    excludeTools: readonly string[];
}
/** The compact six-façade direct surface; primitives remain deferred specialists. */
export declare const OBSIDIAN_DEFAULT_DIRECT_TOOLS: readonly ObsidianDirectToolName[];
/**
 * Create an Obsidian MCP server policy from the given options.
 *
 * This is a browser-safe pure function that constructs a plain object
 * representing the server entry for @chatobby/mcp-client. Defaults:
 * - lifecycle: "eager"
 * - idleTimeout: 10 minutes
 * - bridge timeout: 30000 ms
 * - CLI timeout: 30000 ms
 * - direct tools: the compact six-façade list
 * - excluded tools: empty
 */
export declare function createObsidianMcpServerPolicy(options?: ObsidianMcpPolicyOptions): ObsidianMcpServerPolicy;
