import type { ObsidianOperationName } from "./bridge-operations.ts";
import type { ObsidianDirectToolName } from "./mcp-policy.ts";

export const OBSIDIAN_DIRECT_TOOL_OPERATION_MAP = {
	obsidian_get_context: "context.get",
	obsidian_resolve_note: "note.resolve",
	obsidian_read_note: "note.read",
	obsidian_search: "vault.search",
	obsidian_read_image: "attachment.read",
	obsidian_list_entries: "vault.list",
	obsidian_create_note: "note.write",
	obsidian_edit_note: "note.edit",
	obsidian_open_note: "note.open",
	obsidian_open_app: "app.open",
} as const satisfies Record<ObsidianDirectToolName, ObsidianOperationName>;

export const OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP = {
	obsidian_get_capabilities: "registry.status",
	obsidian_get_metadata: "metadata.get",
	obsidian_create_folder: "folder.create",
	obsidian_copy_entry: "entry.copy",
	obsidian_move_entry: "entry.move",
	obsidian_trash_entry: "entry.trash",
	obsidian_import_attachment: "attachment.import",
	obsidian_generate_link: "links.generate",
	obsidian_get_links: "links.get",
	obsidian_audit_links: "links.audit",
	obsidian_list_tags: "tags.list",
	obsidian_list_properties: "properties.list",
	obsidian_update_frontmatter: "frontmatter.update",
	obsidian_traverse_graph: "graph.traverse",
	obsidian_list_tasks: "tasks.list",
	obsidian_update_task: "tasks.update",
	obsidian_get_editor_state: "editor.get",
	obsidian_edit_editor: "editor.edit",
	obsidian_focus_location: "editor.focus",
	obsidian_get_workspace: "workspace.get",
	obsidian_manage_leaf: "workspace.manage",
	obsidian_list_commands: "commands.list",
	obsidian_execute_command: "commands.execute",
	obsidian_list_hotkeys: "hotkeys.list",
} as const satisfies Record<string, ObsidianOperationName>;

export const OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP = {
	obsidian_vault_explore: "retrieval.explore",
	obsidian_vault_trace: "retrieval.trace",
	obsidian_vault_related: "retrieval.related",
	obsidian_vault_hubs: "retrieval.hubs",
	obsidian_vault_communities: "retrieval.communities",
	obsidian_vault_explain: "retrieval.explain",
} as const satisfies Record<string, ObsidianOperationName>;

export const OBSIDIAN_BROWSER_TOOL_OPERATION_MAP = {
	obsidian_browser_open: "browser.open",
	obsidian_browser_navigate: "browser.navigate",
	obsidian_browser_list: "browser.list",
	obsidian_browser_snapshot: "browser.snapshot",
	obsidian_browser_read: "browser.read",
	obsidian_browser_dom: "browser.dom",
	obsidian_browser_click: "browser.click",
	obsidian_browser_type: "browser.type",
	obsidian_browser_press: "browser.press",
	obsidian_browser_wait: "browser.wait",
	obsidian_browser_screenshot: "browser.screenshot",
	obsidian_browser_close: "browser.close",
} as const satisfies Record<string, ObsidianOperationName>;

export const OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP = {
	obsidian_daily_note: "cli.daily",
	obsidian_base: "cli.base",
	obsidian_file_history: "cli.fileHistory",
	obsidian_sync: "cli.sync",
	obsidian_bookmarks: "cli.bookmarks",
	obsidian_template: "cli.template",
	obsidian_plugin: "cli.plugin",
	obsidian_appearance: "cli.appearance",
	obsidian_quickadd: "cli.quickadd",
	obsidian_dev_diagnostics: "cli.devDiagnostics",
	obsidian_outline: "cli.outline",
	obsidian_backlinks: "cli.backlinks",
	obsidian_orphans: "cli.orphans",
	obsidian_unresolved: "cli.unresolved",
	obsidian_wordcount: "cli.wordcount",
	obsidian_deadends: "cli.deadends",
	obsidian_recents: "cli.recents",
	obsidian_random: "cli.random",
} as const satisfies Record<string, ObsidianOperationName>;

export const OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP = {
	obsidian_run_cli: "cli.run",
	obsidian_read_cli_result: "cli.result.read",
} as const satisfies Record<string, ObsidianOperationName>;

export type ObsidianPluginNativeToolName = keyof typeof OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP;
export type ObsidianRetrievalToolName = keyof typeof OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP;
export type ObsidianBrowserToolName = keyof typeof OBSIDIAN_BROWSER_TOOL_OPERATION_MAP;
export type ObsidianCliFamilyToolName = keyof typeof OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP;
export type ObsidianCliSubstrateToolName = keyof typeof OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP;
export type ObsidianNonDirectToolName =
	| ObsidianPluginNativeToolName
	| ObsidianRetrievalToolName
	| ObsidianBrowserToolName
	| ObsidianCliFamilyToolName
	| ObsidianCliSubstrateToolName;

export const OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES = Object.keys(
	OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
) as ObsidianPluginNativeToolName[];
export const OBSIDIAN_RETRIEVAL_TOOL_NAMES = Object.keys(
	OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP,
) as ObsidianRetrievalToolName[];
export const OBSIDIAN_BROWSER_TOOL_NAMES = Object.keys(
	OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
) as ObsidianBrowserToolName[];
export const OBSIDIAN_CLI_FAMILY_TOOL_NAMES = Object.keys(
	OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP,
) as ObsidianCliFamilyToolName[];
export const OBSIDIAN_CLI_SUBSTRATE_TOOL_NAMES = Object.keys(
	OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP,
) as ObsidianCliSubstrateToolName[];

export const OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP = {
	...OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
	...OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP,
	...OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
	...OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP,
	...OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP,
} as const satisfies Record<ObsidianNonDirectToolName, ObsidianOperationName>;

export const OBSIDIAN_NON_DIRECT_TOOL_NAMES = Object.keys(
	OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP,
) as ObsidianNonDirectToolName[];

export const OBSIDIAN_ALL_TOOL_OPERATION_MAP = {
	...OBSIDIAN_DIRECT_TOOL_OPERATION_MAP,
	...OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP,
} as const satisfies Record<string, ObsidianOperationName>;

export type ObsidianToolName = keyof typeof OBSIDIAN_ALL_TOOL_OPERATION_MAP;
export const OBSIDIAN_ALL_TOOL_NAMES = Object.keys(OBSIDIAN_ALL_TOOL_OPERATION_MAP) as ObsidianToolName[];

/** Historical aliases intentionally excluded from the canonical MCP surface. */
export const OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES = [
	"vault_*",
	"open_note",
	"get_active_note",
	"execute_command",
	"manage_workspace",
	"open_obsidian_app",
	"run_obsidian_cli",
] as const;
