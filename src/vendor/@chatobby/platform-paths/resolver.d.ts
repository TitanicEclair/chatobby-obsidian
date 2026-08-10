import type { DeviceId, ProjectId, VaultId } from "@chatobby/project-contracts";
export type ChatobbyPlatform = "win32" | "darwin" | "linux";
export type AgentDataPathRole = "permission-profiles" | "permission-config" | "permission-logs-root";
export interface ChatobbyPlatformPathEnvironment {
    readonly platform: ChatobbyPlatform;
    readonly homeDirectory: string;
    readonly currentWorkingDirectory?: string;
    readonly variables?: Readonly<{
        CHATOBBY_AGENT_DIR?: string;
        CHATOBBY_DEVICE_DATA_ROOT?: string;
        LOCALAPPDATA?: string;
        XDG_DATA_HOME?: string;
        XDG_STATE_HOME?: string;
    }>;
    readonly deviceDataRoot?: string;
    readonly connectorDataRoot?: string;
    readonly connectorStateRoot?: string;
}
export type SourcePlatformPathRequest = {
    readonly role: "agent-data-root" | "permission-profiles" | "permission-config" | "permission-logs-root";
} | {
    readonly role: "device-data-root" | "device-bindings-root" | "projects-device-identity";
} | {
    readonly role: "projects-device-bindings-root";
    readonly vaultId: VaultId;
    readonly deviceId: DeviceId;
} | {
    readonly role: "projects-marker-index";
    readonly vaultId: VaultId;
    readonly deviceId: DeviceId;
} | {
    readonly role: "projects-root-operation-journal";
    readonly vaultId: VaultId;
    readonly deviceId: DeviceId;
    readonly operationId: string;
} | {
    readonly role: "permission-vault-binding";
    readonly vaultId: VaultId;
} | {
    readonly role: "installation-migration-lock";
} | {
    readonly role: "installation-migration-work" | "installation-migration-journal" | "installation-migration-archive" | "installation-migration-archive-manifest" | "installation-migration-receipt";
    readonly migrationId: string;
    readonly runId: string;
} | {
    readonly role: "vault-state-root" | "vault-identity" | "projects-root" | "projects-index" | "session-workspace-bindings";
    readonly vaultRoot: string;
} | {
    readonly role: "project-record" | "project-brief";
    readonly vaultRoot: string;
    readonly projectId: ProjectId;
} | {
    readonly role: "directory-marker";
    readonly registeredRoot: string;
} | {
    readonly role: "vault-migration-lock";
    readonly vaultRoot: string;
} | {
    readonly role: "vault-migration-work" | "vault-migration-journal" | "vault-migration-archive" | "vault-migration-archive-manifest" | "vault-migration-receipt";
    readonly vaultRoot: string;
    readonly migrationId: string;
    readonly runId: string;
};
export type ConnectorPlatformPathRequest = {
    readonly role: "runtime-data-root" | "runtime-state-root" | "runtime-versions-root" | "runtime-current-pointer" | "runtime-leases-root" | "runtime-log-root";
} | {
    readonly role: "runtime-version";
    readonly version: string;
} | {
    readonly role: "runtime-vault-lease" | "runtime-vault-log";
    readonly vaultId: VaultId;
};
export declare function resolveSourcePlatformPath(environment: ChatobbyPlatformPathEnvironment, request: SourcePlatformPathRequest): string;
export declare function resolveConnectorPlatformPath(environment: ChatobbyPlatformPathEnvironment, request: ConnectorPlatformPathRequest): string;
export declare function resolveAgentDataRoot(environment: ChatobbyPlatformPathEnvironment): string;
/** Resolve an installation-global path from an already selected agent-data root. */
export declare function resolveAgentDataPath(agentDataRoot: string, role: AgentDataPathRole, platform: ChatobbyPlatform): string;
export declare function resolveDeviceDataRoot(environment: ChatobbyPlatformPathEnvironment): string;
export declare function encodePlatformPathKey(value: string): string;
