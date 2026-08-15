// Operation name constants and types for the Obsidian bridge protocol.
// Operation names are the bridge-level identifiers sent in ObsidianBridgeInvoke.
// MCP tool names remain obsidian_*.

// --- Core operations ---

export const OBSIDIAN_CORE_OPERATIONS = ["context.get", "note.resolve"] as const;

export type ObsidianCoreOperationName = (typeof OBSIDIAN_CORE_OPERATIONS)[number];

// --- Plugin-native operations ---

export const OBSIDIAN_PLUGIN_NATIVE_OPERATIONS = [
	"attachment.import",
	"links.audit",
	"editor.get",
	"editor.edit",
	"editor.focus",
	"editor.history",
	"workspace.get",
	"workspace.manage",
] as const;

export type ObsidianPluginNativeOperationName = (typeof OBSIDIAN_PLUGIN_NATIVE_OPERATIONS)[number];

// --- Obsidian UI operations ---

export const OBSIDIAN_UI_OPERATIONS = ["ui.snapshot", "ui.interact"] as const;

export type ObsidianUiOperationName = (typeof OBSIDIAN_UI_OPERATIONS)[number];

// --- Browser operations ---

export const OBSIDIAN_BROWSER_OPERATIONS = [
	"browser.open",
	"browser.navigate",
	"browser.list",
	"browser.snapshot",
	"browser.read",
	"browser.dom",
	"browser.click",
	"browser.pointer",
	"browser.type",
	"browser.press",
	"browser.wait",
	"browser.screenshot",
	"browser.diagnostics",
	"browser.close",
] as const;

export type ObsidianBrowserOperationName = (typeof OBSIDIAN_BROWSER_OPERATIONS)[number];

// --- Union of all operation names ---

export type ObsidianOperationName =
	| ObsidianCoreOperationName
	| ObsidianPluginNativeOperationName
	| ObsidianUiOperationName
	| ObsidianBrowserOperationName;

/** Runtime set of all known static operation names for validation. */
export const OBSIDIAN_ALL_OPERATIONS: ReadonlySet<string> = new Set<string>([
	...OBSIDIAN_CORE_OPERATIONS,
	...OBSIDIAN_PLUGIN_NATIVE_OPERATIONS,
	...OBSIDIAN_UI_OPERATIONS,
	...OBSIDIAN_BROWSER_OPERATIONS,
]);

/**
 * Check if a string is a known operation name.
 * Matches only current static connector operations. The canonical Obsidian CLI
 * runs in the Chatobby runtime and never crosses this bridge protocol.
 */
export function isOperationName(value: string): value is ObsidianOperationName {
	return OBSIDIAN_ALL_OPERATIONS.has(value);
}
