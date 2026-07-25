import type { FrontendMcpCatalogItemViewModel, FrontendMcpScreenViewModel, FrontendMcpServerState, FrontendMcpServerViewModel } from "./frontend-contracts.js";
export type FrontendChatobbyPluginSource = "built-in" | "reference" | "first-party" | "community" | "custom";
export type FrontendChatobbyPluginBrandIcon = "chatobby" | "github" | "notion" | "atlassian" | "figma" | "stripe" | "linear" | "sentry" | "cloudflare" | "google" | "gmail" | "google-drive" | "google-sheets" | "google-slides" | "google-calendar" | "microsoft" | "slack" | "dropbox" | "box" | "canva" | "airtable" | "postman";
export type FrontendChatobbyPluginCapabilityKind = "mcp-server" | "skill" | "command" | "workflow" | "context-query";
export interface FrontendChatobbyPluginCapability {
    readonly kind: FrontendChatobbyPluginCapabilityKind;
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly detail?: string;
}
export interface FrontendChatobbyPluginCapabilityCounts {
    readonly mcpServers: number;
    readonly skills: number;
    readonly commands: number;
    readonly workflows: number;
    readonly contextQueries: number;
}
export interface FrontendChatobbyPluginMetric {
    readonly id: "npm-downloads";
    readonly label: string;
    readonly value: number;
    readonly period: string;
    readonly sourceUrl: string;
}
export interface FrontendChatobbyPluginSummary {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly version?: string;
    readonly publisher: string;
    readonly source: FrontendChatobbyPluginSource;
    readonly sourceLabel: string;
    readonly verifiedPublisher: boolean;
    readonly brandIcon?: FrontendChatobbyPluginBrandIcon;
    readonly installed: boolean;
    readonly enabled: boolean;
    readonly state: FrontendMcpServerState | "available";
    readonly transport?: "local" | "remote";
    readonly transportLabel?: string;
    readonly repositoryUrl?: string;
    readonly updatedAt?: string;
    readonly capabilityCounts: FrontendChatobbyPluginCapabilityCounts;
    readonly canConfigure: boolean;
    readonly unavailableReason?: string;
}
export interface FrontendChatobbyPluginDetail extends FrontendChatobbyPluginSummary {
    readonly capabilities: readonly FrontendChatobbyPluginCapability[];
    readonly setup: readonly {
        readonly label: string;
        readonly value: string;
    }[];
    readonly permissions: readonly string[];
    readonly cautions: readonly string[];
    readonly metrics: readonly FrontendChatobbyPluginMetric[];
    readonly server?: FrontendMcpServerViewModel;
    readonly catalog?: FrontendMcpCatalogItemViewModel;
}
/**
 * Additive plugin projection carried by the existing MCP screen transport.
 * Keeping the generic MCP configuration fields available lets older
 * configuration and permission code remain authoritative while the user-facing
 * page works with complete plugin manifests.
 */
export interface FrontendPluginMcpScreenViewModel extends FrontendMcpScreenViewModel {
    readonly installedPlugins: readonly FrontendChatobbyPluginSummary[];
    readonly catalogPlugins: readonly FrontendChatobbyPluginSummary[];
    readonly catalogError?: string;
    readonly selectedPluginId?: string;
    readonly selectedPlugin?: FrontendChatobbyPluginDetail;
}
export interface FrontendPublicSkillMetadata {
    readonly name: string;
    readonly description: string;
    readonly scope: "user" | "project" | "temporary";
}
