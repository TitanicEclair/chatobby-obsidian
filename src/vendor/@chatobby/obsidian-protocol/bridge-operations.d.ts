export declare const OBSIDIAN_CORE_OPERATIONS: readonly ["context.get", "note.resolve"];
export type ObsidianCoreOperationName = (typeof OBSIDIAN_CORE_OPERATIONS)[number];
export declare const OBSIDIAN_PLUGIN_NATIVE_OPERATIONS: readonly ["attachment.import", "links.audit", "editor.get", "editor.edit", "editor.focus", "editor.history", "workspace.get", "workspace.manage"];
export type ObsidianPluginNativeOperationName = (typeof OBSIDIAN_PLUGIN_NATIVE_OPERATIONS)[number];
export declare const OBSIDIAN_UI_OPERATIONS: readonly ["ui.snapshot", "ui.interact"];
export type ObsidianUiOperationName = (typeof OBSIDIAN_UI_OPERATIONS)[number];
export declare const OBSIDIAN_BROWSER_OPERATIONS: readonly ["browser.open", "browser.navigate", "browser.list", "browser.snapshot", "browser.read", "browser.dom", "browser.click", "browser.pointer", "browser.type", "browser.press", "browser.wait", "browser.screenshot", "browser.diagnostics", "browser.close"];
export type ObsidianBrowserOperationName = (typeof OBSIDIAN_BROWSER_OPERATIONS)[number];
export type ObsidianOperationName = ObsidianCoreOperationName | ObsidianPluginNativeOperationName | ObsidianUiOperationName | ObsidianBrowserOperationName;
/** Runtime set of all known static operation names for validation. */
export declare const OBSIDIAN_ALL_OPERATIONS: ReadonlySet<string>;
/**
 * Check if a string is a known operation name.
 * Matches only current static connector operations. The canonical Obsidian CLI
 * runs in the Chatobby runtime and never crosses this bridge protocol.
 */
export declare function isOperationName(value: string): value is ObsidianOperationName;
