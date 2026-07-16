export declare const OBSIDIAN_BRIDGE_CAPABILITIES: readonly ["vault", "metadata", "links", "tasks", "attachments", "editor", "workspace", "commands", "hotkeys", "browser", "retrieval", "cli"];
export type ObsidianBridgeCapability = (typeof OBSIDIAN_BRIDGE_CAPABILITIES)[number];
/** Runtime set of all known capability values for validation. */
export declare const OBSIDIAN_BRIDGE_CAPABILITY_SET: ReadonlySet<string>;
/**
 * Check whether a string is a known bridge capability.
 * Used by the hello parser to reject unknown capability values.
 */
export declare function isBridgeCapability(value: string): value is ObsidianBridgeCapability;
