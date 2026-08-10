// Capability families the plugin advertises in its hello frame.
// A capability describes a feature domain the plugin/vault supports; the
// executable actions within a domain are the operation names in bridge-operations.ts.
// This is the single source of truth for the capability vocabulary — consumers
// (Chatobby bridge, Obsidian plugin, MCP server) import from here, never redefine.

export const OBSIDIAN_BRIDGE_CAPABILITIES = [
	"vault",
	"metadata",
	"links",
	"tasks",
	"attachments",
	"editor",
	"workspace",
	"commands",
	"hotkeys",
	"browser",
	"retrieval",
	"cli",
] as const;

export type ObsidianBridgeCapability = (typeof OBSIDIAN_BRIDGE_CAPABILITIES)[number];

/** Runtime set of all known capability values for validation. */
export const OBSIDIAN_BRIDGE_CAPABILITY_SET: ReadonlySet<string> = new Set<string>(OBSIDIAN_BRIDGE_CAPABILITIES);

/**
 * Check whether a string is a known bridge capability.
 * Used by the hello parser to reject unknown capability values.
 */
export function isBridgeCapability(value: string): value is ObsidianBridgeCapability {
	return OBSIDIAN_BRIDGE_CAPABILITY_SET.has(value);
}
