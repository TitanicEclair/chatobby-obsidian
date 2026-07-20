import type { AutoNameStrategy, WsAutoCompactionSettings, WsBashResult, WsBridgeConfig, WsExtensionUIRequest, WsForkMessage, WsPromptAttachment, WsPromptContextPacket, WsProviderInfo, WsRuntimeInfo, WsSessionInfo, WsSessionStats } from "./connector-types.js";
import { type RuntimeClientHello } from "./control/contracts.js";
import { type FrontendBootstrap, type FrontendBootstrapRequest, type FrontendIntent, type FrontendIntentResult, type FrontendPatch, type FrontendScreenRequest, type FrontendScreenViewModel, type FrontendSubscriptionAck, type FrontendSubscriptionRequest } from "./frontend-contracts.js";
export type { RuntimeClientHello, RuntimeIdentity, RuntimeReadyDescriptor, RuntimeServerHello, RuntimeStatusResponse, } from "./control/contracts.js";
export { CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION, CHATOBBY_RUNTIME_PROTOCOL_VERSION, parseRuntimeReadyDescriptor, RUNTIME_CLOSE_CODES, } from "./control/contracts.js";
export { CHATOBBY_FRONTEND_PROTOCOL_VERSION } from "./frontend-contracts.js";
export interface WsClientOptions {
    url: string;
    autoReconnect?: boolean;
    reconnectDelay?: number;
    onClose?: () => void;
    runtime?: Omit<RuntimeClientHello, "type">;
    helloTimeout?: number;
    connectTimeout?: number;
    requestTimeout?: number;
    disconnectTimeout?: number;
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
    disconnect(): Promise<void>;
    getFrontendBootstrap(request: FrontendBootstrapRequest): Promise<FrontendBootstrap>;
    getFrontendScreen(request: FrontendScreenRequest): Promise<FrontendScreenViewModel>;
    subscribeFrontend(request: FrontendSubscriptionRequest): Promise<FrontendSubscriptionAck>;
    dispatchFrontendIntent(intent: FrontendIntent): Promise<FrontendIntentResult>;
    prompt(message: string, attachments?: WsPromptAttachment[], context?: WsPromptContextPacket, submissionId?: string): Promise<"started" | "retracted">;
    steer(message: string): Promise<"accepted" | "promoted-to-prompt">;
    followUp(message: string): Promise<"started" | "promoted-to-prompt">;
    abort(): Promise<void>;
    retractPrompt(submissionId: string): Promise<{
        retracted: boolean;
        reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed";
    }>;
    listSessions(cwdOverride?: string, includeDescendants?: boolean): Promise<WsSessionInfo[]>;
    deleteSession(sessionPath: string, cwdRoot: string): Promise<{
        sessionId: string;
    }>;
    renameStoredSession(sessionPath: string, cwdRoot: string, name: string): Promise<void>;
    getStoredSessionForkMessages(sessionPath: string, cwdRoot: string): Promise<WsForkMessage[]>;
    cloneStoredSession(sessionPath: string, cwdRoot: string): Promise<{
        sessionId: string;
        sessionPath: string;
    }>;
    forkStoredSession(sessionPath: string, cwdRoot: string, entryId: string): Promise<{
        sessionId: string;
        sessionPath: string;
    }>;
    exportStoredSession(sessionPath: string, cwdRoot: string, format: "html" | "jsonl", outputPath?: string): Promise<string>;
    getSessionStats(): Promise<WsSessionStats>;
    getLastAssistantText(): Promise<string | null>;
    setOperatorViewOpen(open: boolean): Promise<void>;
    getProviders(): Promise<WsProviderInfo[]>;
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
