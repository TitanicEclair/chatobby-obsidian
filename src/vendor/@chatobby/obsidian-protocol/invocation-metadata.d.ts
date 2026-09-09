/** Private MCP transport metadata, never a model-visible argument or tool result. */
export declare const OBSIDIAN_INVOCATION_METADATA_KEY = "chatobby/obsidian-invocation";
/** Shape validation only. The runtime's in-memory issuer authenticates the capability. */
export declare function readObsidianInvocationCapability(metadata: unknown): string | undefined;
