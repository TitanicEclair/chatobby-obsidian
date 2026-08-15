import type { AutoNameStrategy, WsAutoCompactionSettings, WsBashResult, WsBridgeConfig, WsExtensionUIRequest, WsForkMessage, WsLocalModelProvider, WsLocalModelProviderDocument, WsLocalModelProviderProbeResult, WsManagedLocalModelServerProfile, WsManagedLocalModelServerSnapshot, WsManagedLocalModelServerStatus, WsProjectDirectoryCandidateRequest, WsProjectDirectoryCandidateResult, WsPromptAttachment, WsPromptContextPacket, WsProviderInfo, WsRuntimeInfo, WsSessionInfo, WsSessionStats, WsStoredSessionSelector } from "./connector-types.js";
export type { WsManagedLocalModelServerProfile, WsManagedLocalModelServerSnapshot, WsManagedLocalModelServerStatus, WsProjectDirectoryCandidateRequest, WsProjectDirectoryCandidateResult, } from "./connector-types.js";
import { type RuntimeClientHello, type RuntimeServerActivationRequired } from "./control/contracts.js";
import { type FrontendBootstrap, type FrontendBootstrapRequest, type FrontendIntent, type FrontendIntentResult, type FrontendPatch, type FrontendScreenRequest, type FrontendScreenViewModel, type FrontendSubscriptionAck, type FrontendSubscriptionRequest } from "./frontend-contracts.js";
export type { RuntimeClientHello, RuntimeIdentity, RuntimeReadyDescriptor, RuntimeServerActivationRequired, RuntimeServerHello, RuntimeServerPending, RuntimeStatusResponse, } from "./control/contracts.js";
export { CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION, CHATOBBY_RUNTIME_PROTOCOL_VERSION, parseRuntimeReadyDescriptor, RUNTIME_CLOSE_CODES, } from "./control/contracts.js";
export { CHATOBBY_FRONTEND_PROTOCOL_VERSION } from "./frontend-contracts.js";
export type { FrontendChatobbyPluginBrandIcon, FrontendChatobbyPluginCapability, FrontendChatobbyPluginCapabilityCounts, FrontendChatobbyPluginCapabilityKind, FrontendChatobbyPluginDetail, FrontendChatobbyPluginMetric, FrontendChatobbyPluginSource, FrontendChatobbyPluginSummary, FrontendPluginMcpScreenViewModel, FrontendPublicSkillMetadata, } from "./frontend-plugin-contracts.js";
export interface WsClientOptions {
    url: string;
    autoReconnect?: boolean;
    reconnectDelay?: number;
    onClose?: () => void;
    runtime?: Omit<RuntimeClientHello, "type">;
    helloTimeout?: number;
    startupAdmissionTimeout?: number;
    activateRuntime?: (request: RuntimeServerActivationRequired) => Promise<void>;
    connectTimeout?: number;
    requestTimeout?: number;
    disconnectTimeout?: number;
}
export declare class ChatobbyWsError extends Error {
    readonly code: string;
    readonly diagnosticId?: string;
    readonly retryable: boolean;
    constructor(code: string, message: string, diagnosticId?: string, retryable?: boolean);
}
type ExtensionUIHandler = (request: WsExtensionUIRequest) => Promise<unknown>;
/**
 * Narrow public connector client. Product-domain behavior is available only
 * through versioned frontend snapshots, patches, and intents.
 */
export declare class ChatobbyWsClient {
    private readonly options;
    private ws;
    private connecting;
    private reconnectTimer;
    private closedByUser;
    private connected;
    private reconnectBlocked;
    private requestId;
    private readonly pending;
    private readonly bridgeConfigListeners;
    private readonly frontendPatchListeners;
    private extensionUIHandler?;
    constructor(options: WsClientOptions);
    connect(): Promise<void>;
    private respondToRuntimeActivation;
    disconnect(): Promise<void>;
    getFrontendBootstrap(request: FrontendBootstrapRequest): Promise<FrontendBootstrap>;
    getFrontendScreen(request: FrontendScreenRequest): Promise<FrontendScreenViewModel>;
    subscribeFrontend(request: FrontendSubscriptionRequest): Promise<FrontendSubscriptionAck>;
    dispatchFrontendIntent(intent: FrontendIntent): Promise<FrontendIntentResult>;
    registerProjectDirectoryCandidate(request: WsProjectDirectoryCandidateRequest): Promise<WsProjectDirectoryCandidateResult>;
    getMcpCredentialReferences(): Promise<readonly string[]>;
    setMcpCredential(reference: string, secret?: string): Promise<void>;
    prompt(message: string, attachments?: WsPromptAttachment[], context?: WsPromptContextPacket, submissionId?: string): Promise<"started" | "retracted">;
    steer(message: string, attachments?: WsPromptAttachment[]): Promise<"accepted" | "promoted-to-prompt">;
    followUp(message: string, attachments?: WsPromptAttachment[]): Promise<"started" | "promoted-to-prompt">;
    abort(): Promise<void>;
    retractPrompt(submissionId: string): Promise<{
        retracted: boolean;
        reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed";
    }>;
    listSessions(cwdOverride?: string, includeDescendants?: boolean): Promise<WsSessionInfo[]>;
    deleteSession(selector: WsStoredSessionSelector, cwdRoot: string): Promise<{
        sessionId: string;
    }>;
    renameStoredSession(selector: WsStoredSessionSelector, cwdRoot: string, name: string): Promise<void>;
    getStoredSessionForkMessages(selector: WsStoredSessionSelector, cwdRoot: string): Promise<WsForkMessage[]>;
    cloneStoredSession(selector: WsStoredSessionSelector, cwdRoot: string): Promise<{
        sessionId: string;
        sessionPath: string;
    }>;
    forkStoredSession(selector: WsStoredSessionSelector, cwdRoot: string, entryId: string): Promise<{
        sessionId: string;
        sessionPath: string;
    }>;
    exportStoredSession(selector: WsStoredSessionSelector, cwdRoot: string, format: "html" | "jsonl", outputPath?: string): Promise<string>;
    getSessionStats(): Promise<WsSessionStats>;
    getLastAssistantText(): Promise<string | null>;
    setOperatorViewOpen(open: boolean): Promise<void>;
    getProviders(): Promise<WsProviderInfo[]>;
    getLocalModelProviders(): Promise<WsLocalModelProviderDocument>;
    saveLocalModelProvider(expectedRevision: number, provider: WsLocalModelProvider, apiKey?: string): Promise<WsLocalModelProviderDocument>;
    deleteLocalModelProvider(expectedRevision: number, providerId: string, removeCredential?: boolean): Promise<WsLocalModelProviderDocument>;
    testLocalModelProvider(provider: WsLocalModelProvider, apiKey?: string): Promise<WsLocalModelProviderProbeResult>;
    getManagedLocalModelServers(): Promise<WsManagedLocalModelServerSnapshot>;
    saveManagedLocalModelServer(expectedRevision: number, profile: WsManagedLocalModelServerProfile): Promise<WsManagedLocalModelServerSnapshot>;
    deleteManagedLocalModelServer(expectedRevision: number, profileId: string): Promise<WsManagedLocalModelServerSnapshot>;
    controlManagedLocalModelServer(profileId: string, action: "start" | "stop" | "restart"): Promise<WsManagedLocalModelServerStatus>;
    setAutoCompaction(settings: {
        enabled?: boolean;
        thresholdPercent?: number;
        customInstructions?: string;
    }): Promise<WsAutoCompactionSettings>;
    setAutoNameStrategy(strategy: AutoNameStrategy): Promise<void>;
    setProviderApiKey(provider: string, apiKey: string): Promise<void>;
    removeProviderCredential(provider: string): Promise<void>;
    bash(command: string, excludeFromContext?: boolean): Promise<WsBashResult>;
    compact(customInstructions?: string): Promise<void>;
    reload(): Promise<void>;
    exportHtml(outputPath?: string): Promise<string>;
    exportJsonl(outputPath?: string): Promise<string>;
    getRuntimeInfo(): Promise<WsRuntimeInfo>;
    getGuide(): Promise<{
        content: string;
        path: string;
        title: string;
        version: string;
        earlyAccess: boolean;
        confirmationNotice: string;
        files: Array<{
            path: string;
            title: string;
            content: string;
        }>;
    }>;
    onBridgeConfig(listener: (config: WsBridgeConfig) => void): () => void;
    onFrontendPatch(listener: (patch: FrontendPatch) => void): () => void;
    onExtensionUI(handler: ExtensionUIHandler): void;
    private scheduleReconnect;
    private handleMessage;
    private sendExtensionUIResponse;
    private sendRaw;
    private send;
    private rejectPending;
}
