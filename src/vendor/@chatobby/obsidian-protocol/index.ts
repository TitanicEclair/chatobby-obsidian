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
export type { ObsidianBridgeConnectionConfig } from "./bridge-config.ts";
export { parseObsidianBridgeConnectionConfig } from "./bridge-config.ts";
export type { ObsidianBridgeErrorCode, ObsidianBridgeErrorPayload } from "./bridge-errors.ts";
// --- Bridge errors ---
export {
	OBSIDIAN_BRIDGE_ERROR_CODES,
	OBSIDIAN_BRIDGE_PROTOCOL_VERSION,
	parseBridgeErrorPayload,
} from "./bridge-errors.ts";
export type {
	ObsidianBrowserOperationName,
	ObsidianCoreOperationName,
	ObsidianOperationName,
	ObsidianPluginNativeOperationName,
	ObsidianUiOperationName,
} from "./bridge-operations.ts";
// --- Bridge operations ---
export {
	isOperationName,
	OBSIDIAN_ALL_OPERATIONS,
	OBSIDIAN_BROWSER_OPERATIONS,
	OBSIDIAN_CORE_OPERATIONS,
	OBSIDIAN_PLUGIN_NATIVE_OPERATIONS,
	OBSIDIAN_UI_OPERATIONS,
} from "./bridge-operations.ts";
export type {
	ObsidianBridgeCancel,
	ObsidianBridgeCapabilitiesChanged,
	ObsidianBridgeContextChanged,
	ObsidianBridgeError,
	ObsidianBridgeHello,
	ObsidianBridgeInvoke,
	ObsidianBridgePing,
	ObsidianBridgePong,
	ObsidianBridgeResult,
	ObsidianBridgeVault,
	ObsidianContextChangedDomain,
	ObsidianContextRevisions,
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
export { OBSIDIAN_INVOCATION_METADATA_KEY, readObsidianInvocationCapability } from "./invocation-metadata.ts";
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
	ObsidianNonDirectToolName,
	ObsidianPluginNativeToolName,
	ObsidianToolName,
	ObsidianUiToolName,
} from "./mcp-tool-catalog.ts";
export {
	OBSIDIAN_ALL_TOOL_NAMES,
	OBSIDIAN_ALL_TOOL_OPERATION_MAP,
	OBSIDIAN_BROWSER_TOOL_NAMES,
	OBSIDIAN_BROWSER_TOOL_OPERATION_MAP,
	OBSIDIAN_DIRECT_TOOL_OPERATION_MAP,
	OBSIDIAN_EXCLUDED_COMPAT_TOOL_NAMES,
	OBSIDIAN_NON_DIRECT_TOOL_NAMES,
	OBSIDIAN_NON_DIRECT_TOOL_OPERATION_MAP,
	OBSIDIAN_PLUGIN_NATIVE_TOOL_NAMES,
	OBSIDIAN_PLUGIN_NATIVE_TOOL_OPERATION_MAP,
	OBSIDIAN_UI_TOOL_NAMES,
	OBSIDIAN_UI_TOOL_OPERATION_MAP,
} from "./mcp-tool-catalog.ts";
export type {
	ProjectDirectoryObservationResult,
	ProjectDirectoryObservationStatus,
	ProjectDirectoryObserved,
	ProjectDirectoryRescanReason,
	ProjectDirectoryRescanRequested,
	ProjectDirectoryRescanResult,
} from "./project-directory-protocol.ts";
export {
	PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION,
	parseProjectDirectoryObservationResult,
	parseProjectDirectoryObserved,
	parseProjectDirectoryRescanRequested,
	parseProjectDirectoryRescanResult,
} from "./project-directory-protocol.ts";
export type {
	ObsidianCapabilityState,
	ObsidianPluginKind,
	ObsidianPluginState,
	ObsidianRuntimeDependencyState,
	ObsidianToolAvailability,
	ObsidianToolCapabilityDescriptor,
} from "./tool-capabilities.ts";
export { evaluateObsidianToolAvailability, OBSIDIAN_TOOL_CAPABILITY_CATALOG } from "./tool-capabilities.ts";
// --- Vault-relative paths ---
export { normalizeVaultFolderPath } from "./vault-paths.ts";
