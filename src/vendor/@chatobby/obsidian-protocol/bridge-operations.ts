// Operation name constants and types for the Obsidian bridge protocol.
// Operation names are the bridge-level identifiers sent in ObsidianBridgeInvoke.
// MCP tool names remain obsidian_*.

// --- Core operations ---

export const OBSIDIAN_CORE_OPERATIONS = [
	"context.get",
	"note.resolve",
	"note.read",
	"vault.search",
	"attachment.read",
	"vault.list",
	"note.write",
	"note.edit",
	"note.open",
	"app.open",
] as const;

export type ObsidianCoreOperationName = (typeof OBSIDIAN_CORE_OPERATIONS)[number];

// --- Plugin-native operations ---

export const OBSIDIAN_PLUGIN_NATIVE_OPERATIONS = [
	"registry.status",
	"metadata.get",
	"folder.create",
	"entry.copy",
	"entry.move",
	"entry.trash",
	"attachment.import",
	"links.generate",
	"tags.list",
	"properties.list",
	"frontmatter.update",
	"links.get",
	"links.audit",
	"graph.traverse",
	"tasks.list",
	"tasks.update",
	"editor.get",
	"editor.edit",
	"editor.focus",
	"workspace.get",
	"workspace.manage",
	"commands.list",
	"commands.execute",
	"hotkeys.list",
] as const;

export type ObsidianPluginNativeOperationName = (typeof OBSIDIAN_PLUGIN_NATIVE_OPERATIONS)[number];

// --- Browser operations ---

export const OBSIDIAN_BROWSER_OPERATIONS = [
	"browser.open",
	"browser.navigate",
	"browser.list",
	"browser.snapshot",
	"browser.read",
	"browser.click",
	"browser.type",
	"browser.wait",
	"browser.evaluate",
	"browser.close",
] as const;

export type ObsidianBrowserOperationName = (typeof OBSIDIAN_BROWSER_OPERATIONS)[number];

// --- Retrieval operations ---

export const OBSIDIAN_RETRIEVAL_OPERATIONS = [
	"retrieval.explore",
	"retrieval.trace",
	"retrieval.related",
	"retrieval.hubs",
	"retrieval.communities",
	"retrieval.explain",
] as const;

export type ObsidianRetrievalOperationName = (typeof OBSIDIAN_RETRIEVAL_OPERATIONS)[number];

// --- CLI operations (static names only; `cli.native.*` handled separately) ---

export const OBSIDIAN_CLI_OPERATIONS = [
	"cli.result.read",
	"cli.daily",
	"cli.base",
	"cli.fileHistory",
	"cli.sync",
	"cli.bookmarks",
	"cli.template",
	"cli.plugin",
	"cli.appearance",
	"cli.quickadd",
	"cli.devDiagnostics",
	"cli.run",
	"cli.outline",
	"cli.backlinks",
	"cli.orphans",
	"cli.unresolved",
	"cli.wordcount",
	"cli.deadends",
	"cli.recents",
	"cli.random",
] as const;

export type ObsidianCliStaticOperationName = (typeof OBSIDIAN_CLI_OPERATIONS)[number];

export type ObsidianCliOperationName = ObsidianCliStaticOperationName | `cli.native.${string}`;

// --- Union of all operation names ---

export type ObsidianOperationName =
	| ObsidianCoreOperationName
	| ObsidianPluginNativeOperationName
	| ObsidianBrowserOperationName
	| ObsidianRetrievalOperationName
	| ObsidianCliOperationName;

/** Runtime set of all known static operation names for validation. */
export const OBSIDIAN_ALL_OPERATIONS: ReadonlySet<string> = new Set<string>([
	...OBSIDIAN_CORE_OPERATIONS,
	...OBSIDIAN_PLUGIN_NATIVE_OPERATIONS,
	...OBSIDIAN_BROWSER_OPERATIONS,
	...OBSIDIAN_RETRIEVAL_OPERATIONS,
	...OBSIDIAN_CLI_OPERATIONS,
]);

/**
 * Check if a string is a known operation name.
 * Matches static names from the operation sets and `cli.native.*` prefixed names.
 */
export function isOperationName(value: string): value is ObsidianOperationName {
	if (OBSIDIAN_ALL_OPERATIONS.has(value)) {
		return true;
	}
	return value.startsWith("cli.native.") && value.length > "cli.native.".length;
}
