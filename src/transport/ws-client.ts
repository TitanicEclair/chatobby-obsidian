import type { ProviderLoginMethod, ProviderLoginState } from "../vendor/chatobby-client/ws-client";
// ChatobbyTransport — thin wrapper around ChatobbyWsClient
// Owns the connection state machine. Proxies all commands with error handling.
// Does NOT own the session state — that's the view's job.

import { ChatobbyWsClient } from "../vendor/chatobby-client/ws-client.js";
import type { GuideContent } from "../features/guide/public";
import type {
  WsExtensionUIRequest,
  WsBridgeConfig,
  WsAutoCompactionSettings,
  WsSessionStats,
  WsProviderInfo,
  WsLocalModelProvider,
  WsLocalModelProviderDocument,
  WsLocalModelProviderProbeResult,
  WsLocalModelDiscoveryResult,
  WsManagedLocalModelServerProfile,
  WsManagedLocalModelServerSnapshot,
  WsManagedLocalModelServerStatus,
  WsForkMessage,
  WsBashResult,
  WsPromptAttachment,
  WsPromptContextPacket,
  WsRuntimeInfo,
  SessionListItem,
  WsSessionInfo,
} from "../types";
import type { ConnectionState, ConnectionEvent } from "../types";
import { INITIAL_CONNECTION_STATE } from "../types";
import { transitionConnection, canRetry } from "../transitions";
import {
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
} from "../ui/shared/constants";
import { errorMessage } from "../utils";
import type {
  ReadyRuntime,
  RuntimeSessionCredentials,
} from "../runtime/contracts";
import type {
  FrontendIntent,
  FrontendIntentResult,
  FrontendLifecycleState,
  FrontendNegotiationRequest,
  FrontendNegotiationResult,
  FrontendPatch,
  FrontendProtocolError,
  FrontendScreenRequest,
  FrontendScreenResponse,
  FrontendSubscriptionResult,
  FrontendSubscriptionRequest,
} from "../vendor/chatobby-client/frontend-contracts.js";
import type { WsStoredSessionSelector } from "../vendor/chatobby-client/connector-types.js";
import type {
  WsProjectDirectoryCandidateRequest,
  WsProjectDirectoryCandidateResult,
} from "../vendor/chatobby-client/ws-client.js";
import type { RuntimeServerActivationRequired } from "../vendor/chatobby-client/ws-client.js";

export type McpCredentialSource = (reference: string) => string | null;

export class ChatobbyTransport {
  private client: ChatobbyWsClient | null = null;
  private connectPromise: Promise<void> | null = null;
  private connectionState: ConnectionState = INITIAL_CONNECTION_STATE;
  private reconnectTimer: number | null = null;
  private connectionListeners: Set<(state: ConnectionState) => void> =
    new Set();
  private frontendPatchListeners: Set<(patch: FrontendPatch) => void> =
    new Set();
  private frontendProtocolErrorListeners: Set<(error: FrontendProtocolError) => void> = new Set();
  private frontendLifecycleListeners: Set<(state: FrontendLifecycleState) => void> = new Set();
  private bridgeConfigListeners: Set<(config: WsBridgeConfig) => void> =
    new Set();
  private extensionUIHandler:
    ((request: WsExtensionUIRequest) => Promise<unknown>) | null = null;

  private serverUrl: string;
  private runtimeSession: RuntimeSessionCredentials | undefined;
  private readonly mcpCredentialSource: McpCredentialSource | undefined;

  constructor(
    runtime: ReadyRuntime,
    mcpCredentialSource?: McpCredentialSource,
    private readonly activateRuntime?: (
      request: RuntimeServerActivationRequired,
    ) => Promise<void>,
  ) {
    this.serverUrl = runtime.endpoint;
    this.runtimeSession = runtime.session;
    this.mcpCredentialSource = mcpCredentialSource;
  }

  // ── Subscriptions ───────────────────────────────────────────────

  /** Subscribe to connection state changes. Returns unsubscribe function. */
  onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  /** Subscribe to validated runtime-owned frontend read-model patches. */
  onFrontendPatch(listener: (patch: FrontendPatch) => void): () => void {
    this.frontendPatchListeners.add(listener);
    return () => this.frontendPatchListeners.delete(listener);
  }

  onFrontendProtocolError(listener: (error: FrontendProtocolError) => void): () => void {
    this.frontendProtocolErrorListeners.add(listener);
    return () => this.frontendProtocolErrorListeners.delete(listener);
  }

  onFrontendLifecycle(listener: (state: FrontendLifecycleState) => void): () => void {
    this.frontendLifecycleListeners.add(listener);
    return () => this.frontendLifecycleListeners.delete(listener);
  }

  /** Register a handler for extension UI requests. */
  onExtensionUI(
    handler: (request: WsExtensionUIRequest) => Promise<unknown>,
  ): void {
    this.extensionUIHandler = handler;
    this.client?.onExtensionUI(handler);
  }

  /** Subscribe to bridge_config pushes from the server. Returns unsubscribe. */
  onBridgeConfig(listener: (config: WsBridgeConfig) => void): () => void {
    this.bridgeConfigListeners.add(listener);
    return () => this.bridgeConfigListeners.delete(listener);
  }

  /** Emit a bridge_config event to listeners. Called when a bridge_config frame arrives. */
  emitBridgeConfig(config: WsBridgeConfig): void {
    for (const listener of this.bridgeConfigListeners) {
      listener(config);
    }
  }

  // ── Connection lifecycle ─────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connectionState.status === "connected" && this.client) return;
    if (this.connectPromise) return this.connectPromise;

    this.clearReconnectTimer();
    this.dispatch({ type: "connect" });

    const previousClient = this.client;
    this.client = null;
    if (previousClient) {
      await previousClient.disconnect().catch(() => {});
    }

    const client = new ChatobbyWsClient({
      url: this.serverUrl,
      autoReconnect: false,
      onClose: () => this.handleClientClose(client),
      runtime: this.runtimeSession,
      activateRuntime: this.activateRuntime,
    });
    this.client = client;
    client.onFrontendPatch((patch) => this.emitFrontendPatch(patch));
    client.onFrontendProtocolError((error) => {
      for (const listener of this.frontendProtocolErrorListeners) listener(error);
    });
    client.onFrontendLifecycle((state) => {
      for (const listener of this.frontendLifecycleListeners) listener(state);
    });
    client.onBridgeConfig((config) => this.emitBridgeConfig(config));
    if (this.extensionUIHandler) {
      client.onExtensionUI(this.extensionUIHandler);
    }

    const attempt = this.connectClient(client);
    this.connectPromise = attempt;
    return attempt;
  }

  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.connectPromise = null;
    this.dispatch({ type: "disconnected" });
    if (this.client) {
      const client = this.client;
      this.client = null;
      await client.disconnect().catch(() => {});
    }
  }

  /** Replace the runtime endpoint and scoped session identity. */
  async setRuntime(runtime: ReadyRuntime): Promise<void> {
    const reconnect =
      this.connectionState.status === "connected" ||
      this.connectionState.status === "connecting";
    if (reconnect) await this.disconnect();
    this.serverUrl = runtime.endpoint;
    this.runtimeSession = runtime.session;
    if (reconnect) await this.connect();
  }

  get state(): ConnectionState {
    return this.connectionState;
  }

  get isConnected(): boolean {
    return this.connectionState.status === "connected";
  }

  // ── Runtime-owned frontend protocol ──────────────────────────────

  async negotiateFrontend(
    request: FrontendNegotiationRequest,
  ): Promise<FrontendNegotiationResult> {
    return this.requireClient().negotiateFrontend(request);
  }

  async getFrontendScreen(
    request: FrontendScreenRequest,
  ): Promise<FrontendScreenResponse> {
    return this.requireClient().getFrontendScreen(request);
  }

  async subscribeFrontend(
    request: FrontendSubscriptionRequest,
  ): Promise<FrontendSubscriptionResult> {
    return this.requireClient().subscribeFrontend(request);
  }

  activateFrontendLive(): void {
    this.requireClient().activateFrontendLive();
  }

  async dispatchFrontendIntent(
    intent: FrontendIntent,
  ): Promise<FrontendIntentResult> {
    return this.requireClient().dispatchFrontendIntent(intent);
  }

  async registerProjectDirectoryCandidate(
    request: WsProjectDirectoryCandidateRequest,
  ): Promise<WsProjectDirectoryCandidateResult> {
    return this.requireClient().registerProjectDirectoryCandidate(request);
  }

  async synchronizeMcpCredential(
    reference: string,
    secret: string | null,
  ): Promise<void> {
    await this.requireClient().setMcpCredential(reference, secret ?? undefined);
  }

  // ── Prompting ──────────────────────────────────────────────────────

  async prompt(
    message: string,
    attachments?: WsPromptAttachment[],
    context?: WsPromptContextPacket,
    submissionId?: string,
  ): Promise<"started" | "retracted"> {
    const client = this.requireClient();
    return client.prompt(message, attachments, context, submissionId);
  }

  async steer(
    message: string,
    attachments?: WsPromptAttachment[],
  ): Promise<"accepted" | "promoted-to-prompt"> {
    const client = this.requireClient();
    return client.steer(message, attachments);
  }

  async followUp(
    message: string,
    attachments?: WsPromptAttachment[],
  ): Promise<"started" | "promoted-to-prompt"> {
    const client = this.requireClient();
    return client.followUp(message, attachments);
  }

  async abort(): Promise<void> {
    const client = this.requireClient();
    await client.abort();
  }

  async retractPrompt(
    submissionId: string,
  ): Promise<{
    retracted: boolean;
    reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed";
  }> {
    return this.requireClient().retractPrompt(submissionId);
  }

  // ── Session lifecycle ──────────────────────────────────────────────

  async listSessions(
    cwdOverride?: string,
    includeDescendants = false,
  ): Promise<SessionListItem[]> {
    const client = this.requireClient();
    const sessions = await client.listSessions(cwdOverride, includeDescendants);
    return sessions.map(sessionListItemFromWire);
  }

  async deleteSession(
    selector: WsStoredSessionSelector,
    cwdRoot: string,
  ): Promise<{ sessionId: string }> {
    return this.requireClient().deleteSession(selector, cwdRoot);
  }

  /** Rename a persisted session without replacing the backend's active session. */
  async renameStoredSession(
    selector: WsStoredSessionSelector,
    cwdRoot: string,
    name: string,
  ): Promise<void> {
    await this.requireClient().renameStoredSession(selector, cwdRoot, name);
  }

  /** Read stable-ID-first fork points without replacing the backend's active session. */
  async getStoredSessionForkMessages(
    selector: WsStoredSessionSelector,
    cwdRoot: string,
  ): Promise<WsForkMessage[]> {
    const messages = await this.requireClient().getStoredSessionForkMessages(
      selector,
      cwdRoot,
    );
    return messages;
  }

  /** Clone a persisted session without replacing the backend's active session. */
  async cloneStoredSession(
    selector: WsStoredSessionSelector,
    cwdRoot: string,
  ): Promise<{ sessionId: string; sessionPath: string }> {
    return this.requireClient().cloneStoredSession(selector, cwdRoot);
  }

  /** Fork a persisted session without replacing the backend's active session. */
  async forkStoredSession(
    selector: WsStoredSessionSelector,
    cwdRoot: string,
    entryId: string,
  ): Promise<{ sessionId: string; sessionPath: string }> {
    return this.requireClient().forkStoredSession(selector, cwdRoot, entryId);
  }

  /** Export a persisted session without replacing the backend's active session. */
  async exportStoredSession(
    selector: WsStoredSessionSelector,
    cwdRoot: string,
    format: "html" | "jsonl",
    outputPath?: string,
  ): Promise<string> {
    return this.requireClient().exportStoredSession(
      selector,
      cwdRoot,
      format,
      outputPath,
    );
  }

  // ── State & messages ───────────────────────────────────────────────

  /** Read current host eligibility for passive Obsidian context on this authenticated session. */
  async getObsidianVaultAccessContext() {
    return this.requireClient().getObsidianVaultAccessContext();
  }

  async getSessionStats(): Promise<WsSessionStats> {
    const client = this.requireClient();
    return client.getSessionStats();
  }

  async getLastAssistantText(): Promise<string | null> {
    const client = this.requireClient();
    return client.getLastAssistantText();
  }

  // ── Subagent orchestration ────────────────────────────────────────

  // ── Agent communication channels ────────────────────────────────

  // ── Persistent events ────────────────────────────────────────────

  async setOperatorViewOpen(open: boolean): Promise<void> {
    await this.requireClient().setOperatorViewOpen(open);
  }

  // ── Model & thinking ───────────────────────────────────────────────

  async startProviderLogin(provider: string, method: ProviderLoginMethod): Promise<ProviderLoginState> {
    return this.requireClient().startProviderLogin(provider, method);
  }

  async getProviderLogin(loginId: string): Promise<ProviderLoginState> {
    return this.requireClient().getProviderLogin(loginId);
  }

  async respondToProviderLogin(loginId: string, promptId: string, value: string): Promise<ProviderLoginState> {
    return this.requireClient().respondToProviderLogin(loginId, promptId, value);
  }

  async cancelProviderLogin(loginId: string): Promise<ProviderLoginState> {
    return this.requireClient().cancelProviderLogin(loginId);
  }

  async getProviders(): Promise<WsProviderInfo[]> {
    const client = this.requireClient();
    return client.getProviders();
  }

  async getLocalModelProviders(): Promise<WsLocalModelProviderDocument> {
    return this.requireClient().getLocalModelProviders();
  }

  async saveLocalModelProvider(
    expectedRevision: number,
    provider: WsLocalModelProvider,
    apiKey?: string,
  ): Promise<WsLocalModelProviderDocument> {
    return this.requireClient().saveLocalModelProvider(
      expectedRevision,
      provider,
      apiKey,
    );
  }

  async deleteLocalModelProvider(
    expectedRevision: number,
    providerId: string,
    removeCredential = true,
  ): Promise<WsLocalModelProviderDocument> {
    return this.requireClient().deleteLocalModelProvider(
      expectedRevision,
      providerId,
      removeCredential,
    );
  }

  async discoverLocalModels(provider: WsLocalModelProvider, apiKey?: string): Promise<WsLocalModelDiscoveryResult> {
    return this.requireClient().discoverLocalModels(provider, apiKey);
  }

  async testLocalModelProvider(
    provider: WsLocalModelProvider,
    apiKey?: string,
  ): Promise<WsLocalModelProviderProbeResult> {
    return this.requireClient().testLocalModelProvider(provider, apiKey);
  }

  async getManagedLocalModelServers(): Promise<WsManagedLocalModelServerSnapshot> {
    return this.requireClient().getManagedLocalModelServers();
  }

  async saveManagedLocalModelServer(
    expectedRevision: number,
    profile: WsManagedLocalModelServerProfile,
  ): Promise<WsManagedLocalModelServerSnapshot> {
    return this.requireClient().saveManagedLocalModelServer(
      expectedRevision,
      profile,
    );
  }

  async deleteManagedLocalModelServer(
    expectedRevision: number,
    profileId: string,
  ): Promise<WsManagedLocalModelServerSnapshot> {
    return this.requireClient().deleteManagedLocalModelServer(
      expectedRevision,
      profileId,
    );
  }

  async controlManagedLocalModelServer(
    action: "start" | "stop" | "restart",
    profileId: string,
  ): Promise<WsManagedLocalModelServerStatus> {
    return this.requireClient().controlManagedLocalModelServer(
      profileId,
      action,
    );
  }

  // ── Session settings ───────────────────────────────────────────────

  async setAutoCompaction(settings: {
    mode?: WsAutoCompactionSettings["mode"];
    enabled?: boolean;
    thresholdPercent?: number;
  }): Promise<WsAutoCompactionSettings> {
    const client = this.requireClient();
    return client.setAutoCompaction(settings);
  }

  async setAutoNameStrategy(strategy: "truncate" | "model"): Promise<void> {
    const client = this.requireClient();
    return client.setAutoNameStrategy(strategy);
  }

  async setProviderApiKey(provider: string, apiKey: string): Promise<void> {
    return this.requireClient().setProviderApiKey(provider, apiKey);
  }

  async removeProviderCredential(provider: string): Promise<void> {
    return this.requireClient().removeProviderCredential(provider);
  }

  // ── Bash ────────────────────────────────────────────────────────────

  async bash(
    command: string,
    excludeFromContext?: boolean,
  ): Promise<WsBashResult> {
    const client = this.requireClient();
    return client.bash(command, excludeFromContext);
  }

  // ── Compaction & reload ────────────────────────────────────────────

  async compact(customInstructions?: string): Promise<void> {
    const client = this.requireClient();
    return client.compact(customInstructions);
  }

  async reload(): Promise<void> {
    const client = this.requireClient();
    return client.reload();
  }

  // ── Export ──────────────────────────────────────────────────────────

  async exportHtml(outputPath?: string): Promise<string> {
    const client = this.requireClient();
    return client.exportHtml(outputPath);
  }

  async exportJsonl(outputPath?: string): Promise<string> {
    const client = this.requireClient();
    return client.exportJsonl(outputPath);
  }

  // ── Discovery ──────────────────────────────────────────────────────

  async getRuntimeInfo(): Promise<WsRuntimeInfo> {
    const client = this.requireClient();
    return client.getRuntimeInfo();
  }

  // Compatibility-only transport retained for one product-version window.
  async getGuide(): Promise<GuideContent> {
    const compatibilityClient = this.requireClient() as unknown as {
      getGuide(): Promise<GuideContent>;
    };
    return compatibilityClient.getGuide();
  }

  // ── Private helpers ──────────────────────────────────────────────

  private requireClient(): ChatobbyWsClient {
    if (!this.client) throw new Error("Not connected to chatobby server");
    return this.client;
  }

  private dispatch(event: ConnectionEvent): void {
    this.connectionState = transitionConnection(this.connectionState, event);
    for (const listener of this.connectionListeners) {
      listener(this.connectionState);
    }
  }

  private emitFrontendPatch(patch: FrontendPatch): void {
    for (const listener of this.frontendPatchListeners) listener(patch);
  }

  private async connectClient(client: ChatobbyWsClient): Promise<void> {
    try {
      await client.connect();
      await this.synchronizeMcpCredentials(client);
      if (this.client !== client) {
        await client.disconnect().catch(() => {});
        return;
      }
      this.dispatch({ type: "connected" });
    } catch (e) {
      if (this.client === client) {
        this.client = null;
        this.dispatch({ type: "error", error: errorMessage(e) });
        this.scheduleReconnect();
      }
      throw e;
    } finally {
      if (this.client === client || this.client === null) {
        this.connectPromise = null;
      }
    }
  }

  private async synchronizeMcpCredentials(
    client: ChatobbyWsClient,
  ): Promise<void> {
    if (!this.mcpCredentialSource) return;
    const references = await client.getMcpCredentialReferences();
    for (const reference of references) {
      await client.setMcpCredential(
        reference,
        this.mcpCredentialSource(reference) ?? undefined,
      );
    }
  }

  private handleClientClose(client: ChatobbyWsClient): void {
    if (this.client !== client) return;
    this.client = null;
    this.connectPromise = null;
    this.dispatch({ type: "error", error: "WebSocket connection closed" });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!canRetry(this.connectionState)) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS *
        Math.pow(2, this.connectionState.reconnectAttempt),
      RECONNECT_MAX_DELAY_MS,
    );

    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.dispatch({ type: "retry" });
      this.connect().catch(() => {});
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

function sessionListItemFromWire(session: WsSessionInfo): SessionListItem {
  return {
    ...session,
    firstMessage: session.firstMessage,
    created: new Date(session.created),
    modified: new Date(session.modified),
  };
}
