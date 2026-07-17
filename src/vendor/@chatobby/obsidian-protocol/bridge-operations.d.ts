export declare const OBSIDIAN_CORE_OPERATIONS: readonly ["context.get", "note.resolve", "note.read", "vault.search", "attachment.read", "vault.list", "note.write", "note.edit", "note.open", "app.open"];
export type ObsidianCoreOperationName = (typeof OBSIDIAN_CORE_OPERATIONS)[number];
export declare const OBSIDIAN_PLUGIN_NATIVE_OPERATIONS: readonly ["registry.status", "metadata.get", "folder.create", "entry.copy", "entry.move", "entry.trash", "attachment.import", "links.generate", "tags.list", "properties.list", "frontmatter.update", "links.get", "links.audit", "graph.traverse", "tasks.list", "tasks.update", "editor.get", "editor.edit", "editor.focus", "workspace.get", "workspace.manage", "commands.list", "commands.execute", "hotkeys.list"];
export type ObsidianPluginNativeOperationName = (typeof OBSIDIAN_PLUGIN_NATIVE_OPERATIONS)[number];
export declare const OBSIDIAN_BROWSER_OPERATIONS: readonly ["browser.open", "browser.navigate", "browser.list", "browser.snapshot", "browser.read", "browser.dom", "browser.click", "browser.type", "browser.press", "browser.wait", "browser.evaluate", "browser.screenshot", "browser.close"];
export type ObsidianBrowserOperationName = (typeof OBSIDIAN_BROWSER_OPERATIONS)[number];
export declare const OBSIDIAN_RETRIEVAL_OPERATIONS: readonly ["retrieval.explore", "retrieval.trace", "retrieval.related", "retrieval.hubs", "retrieval.communities", "retrieval.explain"];
export type ObsidianRetrievalOperationName = (typeof OBSIDIAN_RETRIEVAL_OPERATIONS)[number];
export declare const OBSIDIAN_CLI_OPERATIONS: readonly ["cli.result.read", "cli.daily", "cli.base", "cli.fileHistory", "cli.sync", "cli.bookmarks", "cli.template", "cli.plugin", "cli.appearance", "cli.quickadd", "cli.devDiagnostics", "cli.run", "cli.outline", "cli.backlinks", "cli.orphans", "cli.unresolved", "cli.wordcount", "cli.deadends", "cli.recents", "cli.random"];
export type ObsidianCliStaticOperationName = (typeof OBSIDIAN_CLI_OPERATIONS)[number];
export type ObsidianCliOperationName = ObsidianCliStaticOperationName | `cli.native.${string}`;
export type ObsidianOperationName = ObsidianCoreOperationName | ObsidianPluginNativeOperationName | ObsidianBrowserOperationName | ObsidianRetrievalOperationName | ObsidianCliOperationName;
/** Runtime set of all known static operation names for validation. */
export declare const OBSIDIAN_ALL_OPERATIONS: ReadonlySet<string>;
/**
 * Check if a string is a known operation name.
 * Matches static names from the operation sets and `cli.native.*` prefixed names.
 */
export declare function isOperationName(value: string): value is ObsidianOperationName;
