import type { ObsidianBridgeCapability } from "./bridge-capabilities.js";
import type { ObsidianBridgeErrorPayload } from "./bridge-errors.js";
import type { ObsidianOperationName } from "./bridge-operations.js";
import type { ObsidianPluginState, ObsidianRuntimeDependencyState } from "./tool-capabilities.js";
export interface ObsidianBridgeVault {
    id: string;
    name: string;
    root?: string;
}
export interface ObsidianEnabledPlugin {
    id: string;
    name?: string;
    version?: string;
}
export interface ObsidianBridgeHello {
    type: "hello";
    authToken: string;
    protocolVersion: 1;
    connectionId: string;
    vault: ObsidianBridgeVault;
    appVersion: string;
    pluginVersion: string;
    capabilities: ObsidianBridgeCapability[];
    enabledPlugins?: ObsidianEnabledPlugin[];
    plugins?: ObsidianPluginState[];
    runtimeDependencies?: ObsidianRuntimeDependencyState[];
}
export interface ObsidianBridgeCapabilitiesChanged {
    type: "capabilities_changed";
    capabilities: ObsidianBridgeCapability[];
    plugins: ObsidianPluginState[];
    runtimeDependencies: ObsidianRuntimeDependencyState[];
}
export interface ObsidianBridgePing {
    type: "ping";
    requestId?: string;
    sentAt: string;
}
export interface ObsidianBridgeResult {
    type: "result";
    requestId: string;
    result: unknown;
}
export interface ObsidianBridgeError {
    type: "error";
    requestId: string;
    error: ObsidianBridgeErrorPayload;
}
export type ObsidianPluginToServerMessage = ObsidianBridgeHello | ObsidianBridgePing | ObsidianBridgeCapabilitiesChanged | ObsidianBridgeResult | ObsidianBridgeError;
export interface ObsidianBridgePong {
    type: "pong";
    requestId?: string;
    sentAt: string;
}
export interface ObsidianBridgeInvoke {
    type: "invoke";
    requestId: string;
    operation: ObsidianOperationName;
    arguments: Record<string, unknown>;
    deadline: string;
}
export interface ObsidianBridgeCancel {
    type: "cancel";
    requestId: string;
    reason: "timeout" | "client_abort" | "disconnect" | "shutdown";
}
export type ObsidianServerToPluginMessage = ObsidianBridgePong | ObsidianBridgeInvoke | ObsidianBridgeCancel;
/**
 * Parse an unknown value into a validated ObsidianPluginToServerMessage.
 *
 * Valid message types: hello, ping, result, error.
 * Throws on invalid input, missing required fields, wrong protocol version,
 * or non-object payloads.
 */
export declare function parsePluginToServerMessage(input: unknown): ObsidianPluginToServerMessage;
/**
 * Parse an unknown value into a validated ObsidianServerToPluginMessage.
 *
 * Valid message types: pong, invoke, cancel.
 * Throws on invalid input, missing required fields, or unknown types.
 */
export declare function parseServerToPluginMessage(input: unknown): ObsidianServerToPluginMessage;
