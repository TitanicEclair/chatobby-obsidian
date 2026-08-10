import { OBSIDIAN_BRIDGE_PROTOCOL_VERSION } from "./bridge-errors.ts";
export interface ObsidianBridgeConnectionConfig {
    type: "bridge_config";
    schemaVersion: 1;
    url: string;
    token: string;
    protocolVersion: typeof OBSIDIAN_BRIDGE_PROTOCOL_VERSION;
    vaultId: string;
    vaultRoot: string;
}
export declare function parseObsidianBridgeConnectionConfig(input: unknown): ObsidianBridgeConnectionConfig;
