// @chatobby/obsidian-protocol — Browser-safe source of truth for the Obsidian
// bridge protocol. Zero dependencies. No Node APIs, Obsidian APIs, MCP SDK,
// Chatobby runtime, or pi-coding-agent imports.

export type { ObsidianBridgeCapability } from "./bridge-capabilities.ts";
// --- Bridge capabilities ---
export {
	isBridgeCapability,
	OBSIDIAN_BRIDGE_CAPABILITIES,
	OBSIDIAN_BRIDGE_CAPABILITY_SET,
} from "./bridge-capabilities.ts";
export type { ObsidianBridgeErrorCode, ObsidianBridgeErrorPayload } from "./bridge-errors.ts";
// --- Bridge errors ---
export {
	OBSIDIAN_BRIDGE_ERROR_CODES,
	OBSIDIAN_BRIDGE_PROTOCOL_VERSION,
	parseBridgeErrorPayload,
} from "./bridge-errors.ts";
export type {
	ObsidianBrowserOperationName,
	ObsidianCliOperationName,
	ObsidianCliStaticOperationName,
	ObsidianCoreOperationName,
	ObsidianOperationName,
	ObsidianPluginNativeOperationName,
	ObsidianRetrievalOperationName,
} from "./bridge-operations.ts";
// --- Bridge operations ---
export {
	isOperationName,
	OBSIDIAN_ALL_OPERATIONS,
	OBSIDIAN_BROWSER_OPERATIONS,
	OBSIDIAN_CLI_OPERATIONS,
	OBSIDIAN_CORE_OPERATIONS,
	OBSIDIAN_PLUGIN_NATIVE_OPERATIONS,
	OBSIDIAN_RETRIEVAL_OPERATIONS,
} from "./bridge-operations.ts";
export type {
	ObsidianBridgeCancel,
	ObsidianBridgeCapabilitiesChanged,
	ObsidianBridgeError,
	ObsidianBridgeHello,
	ObsidianBridgeInvoke,
	ObsidianBridgePing,
	ObsidianBridgePong,
	ObsidianBridgeResult,
	ObsidianBridgeVault,
	ObsidianEnabledPlugin,
	ObsidianPluginToServerMessage,
	ObsidianServerToPluginMessage,
} from "./bridge-protocol.ts";
// --- Bridge protocol messages ---
export {
	parsePluginToServerMessage,
	parseServerToPluginMessage,
} from "./bridge-protocol.ts";
export type { ObsidianVaultSelector } from "./bridge-selectors.ts";
// --- Vault selectors ---
export { parseVaultSelector } from "./bridge-selectors.ts";
export type {
	ObsidianDirectToolName,
	ObsidianMcpPolicyOptions,
	ObsidianMcpServerPolicy,
} from "./mcp-policy.ts";
// --- MCP adapter policy ---
export {
	createObsidianMcpServerPolicy,
	OBSIDIAN_DEFAULT_DIRECT_TOOLS,
} from "./mcp-policy.ts";
export type {
	ObsidianBrowserToolName,
	ObsidianCliFamilyToolName,
	ObsidianCliSubstrateToolName,
	ObsidianNonDirectToolName,
	ObsidianPluginNativeToolName,
	ObsidianRetrievalToolName,
	ObsidianToolName,
} from "./mcp-tool-catalog.ts";
export {
	OBSIDIAN_ALL_TOOL_NAMES,
	OBSIDIAN_ALL_TOOL_OPERATION_MAP,
	OBSIDIAN_BROWSER_TOOL_NAMES,
	OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
	OBSIDIAN_CLI_FAMILY_TOOL_NAMES,
	OBSIDIAN_CLI_FAMILY_TOOL_OPERATION_MAP,
	OBSIDIAN_CLI_SUBSTRATE_TOOL_NAMES,
	OBSIDIAN_CLI_SUBSTRATE_TOOL_OPERATION_MAP,
	OBSIDIAN_DIRECT_TOOL_OPERATION_MAP,
	OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES,
	OBSIDIAN_NON_DIRECT_TOOL_NAMES,
	OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP,
	OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES,
	OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
	OBSIDIAN_RETRIEVAL_TOOL_NAMES,
	OBSIDIAN_RETRIEVAL_TOOL_OPERATION_MAP,
} from "./mcp-tool-catalog.ts";
export type {
	ObsidianGraphComponent,
	ObsidianRetrievalBackendStatus,
	ObsidianRetrievalCandidate,
	ObsidianRetrievalDiagnostics,
	ObsidianRetrievalEnvelope,
	ObsidianRetrievalEvidence,
	ObsidianRetrievalEvidenceKind,
	ObsidianRetrievalEvidenceProvider,
	ObsidianRetrievalWarning,
	ObsidianSemanticHit,
} from "./retrieval-protocol.ts";
// --- Retrieval protocol ---
export { parseRetrievalEnvelope } from "./retrieval-protocol.ts";
export type {
	ObsidianCapabilityState,
	ObsidianPluginKind,
	ObsidianPluginState,
	ObsidianRuntimeDependencyState,
	ObsidianToolAvailability,
	ObsidianToolCapabilityDescriptor,
} from "./tool-capabilities.ts";
export { evaluateObsidianToolAvailability, OBSIDIAN_TOOL_CAPABILITY_CATALOG } from "./tool-capabilities.ts";
