import type { ObsidianOperationName } from "./bridge-operations.ts";
import type { ObsidianDirectToolName } from "./mcp-policy.ts";

export const OBSIDIAN_DIRECT_TOOL_OPERATION_MAP = {
	obsidian_context: "context.get",
	obsidian_find: "note.resolve",
} as const satisfies Record<ObsidianDirectToolName, ObsidianOperationName>;

export const OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP = {
	obsidian_import_attachment: "attachment.import",
	obsidian_audit_links: "links.audit",
	obsidian_editor: "editor.get",
	obsidian_get_workspace: "workspace.get",
	obsidian_manage_leaf: "workspace.manage",
} as const satisfies Record<string, ObsidianOperationName>;

export const OBSIDIAN_UI_TOOL_OPERATION_MAP = {
	obsidian_ui_snapshot: "ui.snapshot",
	obsidian_ui_interact: "ui.interact",
} as const satisfies Record<string, ObsidianOperationName>;

export const OBSIDIAN_BROWSER_TOOL_OPERATION_MAP = {
	obsidian_browser_open: "browser.open",
	obsidian_browser_navigate: "browser.navigate",
	obsidian_browser_list: "browser.list",
	obsidian_browser_snapshot: "browser.snapshot",
	obsidian_browser_read: "browser.read",
	obsidian_browser_dom: "browser.dom",
	obsidian_browser_click: "browser.click",
	obsidian_browser_pointer: "browser.pointer",
	obsidian_browser_type: "browser.type",
	obsidian_browser_press: "browser.press",
	obsidian_browser_wait: "browser.wait",
	obsidian_browser_screenshot: "browser.screenshot",
	obsidian_browser_diagnostics: "browser.diagnostics",
	obsidian_browser_close: "browser.close",
} as const satisfies Record<string, ObsidianOperationName>;

export type ObsidianPluginNativeToolName = keyof typeof OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP;
export type ObsidianUiToolName = keyof typeof OBSIDIAN_UI_TOOL_OPERATION_MAP;
export type ObsidianBrowserToolName = keyof typeof OBSIDIAN_BROWSER_TOOL_OPERATION_MAP;
export type ObsidianNonDirectToolName = ObsidianPluginNativeToolName | ObsidianUiToolName | ObsidianBrowserToolName;

export const OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES = Object.keys(
	OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
) as ObsidianPluginNativeToolName[];
export const OBSIDIAN_UI_TOOL_NAMES = Object.keys(OBSIDIAN_UI_TOOL_OPERATION_MAP) as ObsidianUiToolName[];
export const OBSIDIAN_BROWSER_TOOL_NAMES = Object.keys(
	OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
) as ObsidianBrowserToolName[];

export const OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP = {
	...OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
	...OBSIDIAN_UI_TOOL_OPERATION_MAP,
	...OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
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

/** Historical provider aliases excluded from the 0.4 canonical surface. */
export const OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES = [
	"vault_*",
	"open_note",
	"get_active_note",
	"execute_command",
	"manage_workspace",
	"open_obsidian_app",
	"run_obsidian_cli",
] as const;
