/** Private MCP transport metadata, never a model-visible argument or tool result. */
export const OBSIDIAN_INVOCATION_METADATA_KEY = "chatobby/obsidian-invocation";

/** Shape validation only. The runtime's in-memory issuer authenticates the capability. */
export function readObsidianInvocationCapability(metadata: unknown): string | undefined {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
	const value = (metadata as Record<string, unknown>)[OBSIDIAN_INVOCATION_METADATA_KEY];
	return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/u.test(value) ? value : undefined;
}
