import type { ObsidianBridgeCapability } from "./bridge-capabilities.ts";
import type { ObsidianOperationName } from "./bridge-operations.ts";
import { OBSIDIAN_ALL_TOOL_OPERATION_MAP, type ObsidianToolName } from "./mcp-tool-catalog.ts";

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
	executionOwner: "connector" | "runtime";
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

const TOOL_PLUGIN_REQUIREMENTS: Readonly<Partial<Record<ObsidianToolName, readonly string[]>>> = {
	obsidian_browser_open: ["webviewer"],
	obsidian_browser_navigate: ["webviewer"],
	obsidian_browser_list: ["webviewer"],
	obsidian_browser_snapshot: ["webviewer"],
	obsidian_browser_read: ["webviewer"],
	obsidian_browser_dom: ["webviewer"],
	obsidian_browser_click: ["webviewer"],
	obsidian_browser_pointer: ["webviewer"],
	obsidian_browser_type: ["webviewer"],
	obsidian_browser_press: ["webviewer"],
	obsidian_browser_wait: ["webviewer"],
	obsidian_browser_screenshot: ["webviewer"],
	obsidian_browser_diagnostics: ["webviewer"],
	obsidian_browser_close: ["webviewer"],
};

/** Commercially extensible source of truth for current and future plugin-backed tool surfaces. */
export const OBSIDIAN_TOOL_CAPABILITY_CATALOG: readonly ObsidianToolCapabilityDescriptor[] = Object.entries(
	OBSIDIAN_ALL_TOOL_OPERATION_MAP,
).map(([toolName, operation]) => {
	const name = toolName as ObsidianToolName;
	return {
		toolName: name,
		operation,
		capability: capabilityForOperation(operation),
		executionOwner: "connector",
		requiredPlugins: TOOL_PLUGIN_REQUIREMENTS[name] ?? [],
		requiredRuntimeDependencies: [],
		enhancedByPlugins: [],
	};
});

export function evaluateObsidianToolAvailability(
	descriptor: ObsidianToolCapabilityDescriptor,
	state: ObsidianCapabilityState,
): ObsidianToolAvailability {
	const plugins = new Map(state.plugins.map((plugin) => [plugin.id, plugin]));
	const runtime = new Map(state.runtimeDependencies.map((dependency) => [dependency.id, dependency]));
	const missingPlugins = descriptor.requiredPlugins.filter((id) => plugins.get(id)?.enabled !== true);
	const missingRuntimeDependencies = descriptor.requiredRuntimeDependencies.filter(
		(id) => runtime.get(id)?.available !== true,
	);
	const availableEnhancements = descriptor.enhancedByPlugins.filter((id) => plugins.get(id)?.enabled === true);
	const missingEnhancements = descriptor.enhancedByPlugins.filter((id) => plugins.get(id)?.enabled !== true);
	return {
		toolName: descriptor.toolName,
		available:
			(descriptor.executionOwner === "runtime" || state.capabilities.includes(descriptor.capability)) &&
			missingPlugins.length === 0 &&
			missingRuntimeDependencies.length === 0,
		missingPlugins,
		missingRuntimeDependencies,
		availableEnhancements,
		missingEnhancements,
	};
}

function capabilityForOperation(operation: ObsidianOperationName): ObsidianBridgeCapability {
	if (operation.startsWith("ui.")) return "workspace";
	if (operation.startsWith("browser.")) return "browser";
	if (operation.startsWith("links.")) return "links";
	if (operation.startsWith("attachment.")) return "attachments";
	if (operation.startsWith("editor.")) return "editor";
	if (operation.startsWith("workspace.")) return "workspace";
	return "vault";
}
