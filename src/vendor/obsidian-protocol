import type { ObsidianBridgeCapability } from "./bridge-capabilities.js";
import type { ObsidianOperationName } from "./bridge-operations.js";
import { type ObsidianToolName } from "./mcp-tool-catalog.js";
export type ObsidianPluginKind = "community" | "core";
/** Installed and enabled state reported by the live Obsidian plugin registry. */
export interface ObsidianPluginState {
    id: string;
    name: string;
    version?: string;
    kind: ObsidianPluginKind;
    installed: boolean;
    enabled: boolean;
}
/** Non-plugin executable or host feature required by a capability family. */
export interface ObsidianRuntimeDependencyState {
    id: string;
    name: string;
    available: boolean;
    detail?: string;
}
export interface ObsidianCapabilityState {
    capabilities: ObsidianBridgeCapability[];
    plugins: ObsidianPluginState[];
    runtimeDependencies: ObsidianRuntimeDependencyState[];
}
export interface ObsidianToolCapabilityDescriptor {
    toolName: ObsidianToolName;
    operation: ObsidianOperationName;
    capability: ObsidianBridgeCapability;
    requiredPlugins: readonly string[];
    requiredRuntimeDependencies: readonly string[];
    enhancedByPlugins: readonly string[];
}
export interface ObsidianToolAvailability {
    toolName: ObsidianToolName;
    available: boolean;
    missingPlugins: string[];
    missingRuntimeDependencies: string[];
    availableEnhancements: string[];
    missingEnhancements: string[];
}
/** Commercially extensible source of truth for current and future plugin-backed tool surfaces. */
export declare const OBSIDIAN_TOOL_CAPABILITY_CATALOG: readonly ObsidianToolCapabilityDescriptor[];
export declare function evaluateObsidianToolAvailability(descriptor: ObsidianToolCapabilityDescriptor, state: ObsidianCapabilityState): ObsidianToolAvailability;
