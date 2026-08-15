// Generated from packages/chatobby/src/frontend-client.ts. Do not edit.
import { parseObsidianBridgeConnectionConfig } from "@chatobby/obsidian-protocol";
import type {
	AutoNameStrategy,
	WsAutoCompactionSettings,
	WsBashResult,
	WsBridgeConfig,
	WsExtensionUIRequest,
	WsForkMessage,
	WsLocalModelProvider,
	WsLocalModelProviderDocument,
	WsLocalModelProviderProbeResult,
	WsManagedLocalModelServerProfile,
	WsManagedLocalModelServerSnapshot,
	WsManagedLocalModelServerStatus,
	WsProjectDirectoryCandidateRequest,
	WsProjectDirectoryCandidateResult,
	WsPromptAttachment,
	WsPromptContextPacket,
	WsProviderInfo,
	WsRuntimeInfo,
	WsSessionInfo,
	WsSessionStats,
	WsStoredSessionSelector,
} from "./connector-types.ts";

export type {
	WsManagedLocalModelServerProfile,
	WsManagedLocalModelServerSnapshot,
	WsManagedLocalModelServerStatus,
	WsProjectDirectoryCandidateRequest,
	WsProjectDirectoryCandidateResult,
} from "./connector-types.ts";

import {
	CHATOBBY_COMPACTION_REQUEST_TIMEOUT_MS,
	CHATOBBY_PROMPT_REQUEST_TIMEOUT_MS,
	CHATOBBY_RUNTIME_HELLO_TIMEOUT_MS,
	CHATOBBY_RUNTIME_STARTUP_ADMISSION_TIMEOUT_MS,
	parseRuntimeServerActivationRequired,
	parseRuntimeServerHello,
	parseRuntimeServerPending,
	RUNTIME_CLOSE_CODES,
	type RuntimeClientActivationResult,
	type RuntimeClientHello,
	type RuntimeServerActivationRequired,
	type RuntimeServerHello,
	type RuntimeServerPending,
} from "./control/contracts.ts";
import {
	type FrontendBootstrap,
	type FrontendBootstrapRequest,
	type FrontendIntent,
	type FrontendIntentResult,
	type FrontendPatch,
	type FrontendScreenRequest,
	type FrontendScreenViewModel,
	type FrontendSubscriptionAck,
	type FrontendSubscriptionRequest,
	parseFrontendBootstrap,
	parseFrontendPatch,
	parseFrontendScreen,
} from "./frontend-contracts.ts";

const MCP_FRONTEND_OPERATION_TIMEOUT_MS = 105_000;

export type {
	RuntimeClientHello,
	RuntimeIdentity,
	RuntimeReadyDescriptor,
	RuntimeServerActivationRequired,
	RuntimeServerHello,
	RuntimeServerPending,
	RuntimeStatusResponse,
} from "./control/contracts.ts";
export {
	CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
	CHATOBBY_RUNTIME_PROTOCOL_VERSION,
	parseRuntimeReadyDescriptor,
	RUNTIME_CLOSE_CODES,
} from "./control/contracts.ts";
export { CHATOBBY_FRONTEND_PROTOCOL_VERSION } from "./frontend-contracts.ts";
export type {
	FrontendChatobbyPluginBrandIcon,
	FrontendChatobbyPluginCapability,
	FrontendChatobbyPluginCapabilityCounts,
	FrontendChatobbyPluginCapabilityKind,
	FrontendChatobbyPluginDetail,
	FrontendChatobbyPluginMetric,
	FrontendChatobbyPluginSource,
	FrontendChatobbyPluginSummary,
	FrontendPluginMcpScreenViewModel,
	FrontendPublicSkillMetadata,
} from "./frontend-plugin-contracts.ts";

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

export class ChatobbyWsError extends Error {
	readonly code: string;
	readonly diagnosticId?: string;
	readonly retryable: boolean;

	constructor(code: string, message: string, diagnosticId?: string, retryable = false) {
		super(message);
		this.name = "ChatobbyWsError";
		this.code = code;
		this.diagnosticId = diagnosticId;
		this.retryable = retryable;
	}
}

interface PendingRequest {
	resolve(result: unknown): void;
	reject(error: Error): void;
	timer: number;
}

interface Command {
	id: string;
	method: string;
	params: unknown;
}

interface ResponseFrame {
	id: string;
	type: "response" | "error";
	result?: unknown;
	error?: {
		code?: string;
		publicMessage?: string;
		message?: string;
		diagnosticId?: string;
		retryable?: boolean;
	};
}

type ExtensionUIHandler = (request: WsExtensionUIRequest) => Promise<unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isResponseFrame(value: unknown): value is ResponseFrame {
	return isRecord(value) && typeof value.id === "string" && (value.type === "response" || value.type === "error");
}

function resultField<T>(value: unknown, key: string): T {
	if (!isRecord(value) || !(key in value)) throw new Error(`Chatobby runtime response is missing ${key}`);
	return value[key] as T;
}

/**
 * Narrow public connector client. Product-domain behavior is available only
 * through versioned frontend snapshots, patches, and intents.
 */
export class ChatobbyWsClient {
	private readonly options: WsClientOptions;
	private ws: WebSocket | null = null;
	private connecting: Promise<void> | undefined;
	private reconnectTimer: number | undefined;
	private closedByUser = false;
	private connected = false;
	private reconnectBlocked = false;
	private requestId = 0;
	private readonly pending = new Map<string, PendingRequest>();
	private readonly bridgeConfigListeners = new Set<(config: WsBridgeConfig) => void>();
	private readonly frontendPatchListeners = new Set<(patch: FrontendPatch) => void>();
	private extensionUIHandler?: ExtensionUIHandler;

	constructor(options: WsClientOptions) {
		this.options = options;
	}

	async connect(): Promise<void> {
		if (this.connecting) return this.connecting;
		if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;
		const WebSocketConstructor = window.WebSocket;
		if (!WebSocketConstructor) throw new Error("WebSocket is not available in this runtime");

		this.closedByUser = false;
		this.connecting = new Promise<void>((resolve, reject) => {
			const socket = new WebSocketConstructor(this.options.url);
			let opened = false;
			let ready = false;
			let startupAdmissionPending = false;
			const activationRequests = new Set<string>();
			let helloTimer: number | undefined;
			const connectTimer = window.setTimeout(() => {
				socket.close();
				reject(new Error(`Chatobby runtime connection timed out for ${this.options.url}`));
			}, this.options.connectTimeout ?? 10_000);
			this.ws = socket;
			const clearConnectTimer = (): void => window.clearTimeout(connectTimer);
			const clearHelloTimer = (): void => {
				if (helloTimer) window.clearTimeout(helloTimer);
				helloTimer = undefined;
			};
			const acceptConnection = (): void => {
				if (ready) return;
				ready = true;
				this.connected = true;
				clearConnectTimer();
				clearHelloTimer();
				resolve();
			};

			socket.onopen = () => {
				opened = true;
				const runtime = this.options.runtime;
				if (!runtime) {
					acceptConnection();
					return;
				}
				const hello: RuntimeClientHello = { type: "hello", ...runtime };
				socket.send(JSON.stringify(hello));
				helloTimer = window.setTimeout(() => {
					socket.close(RUNTIME_CLOSE_CODES.helloTimeout, "hello timeout");
					reject(new Error(`Chatobby runtime handshake timed out for ${this.options.url}`));
				}, this.options.helloTimeout ?? CHATOBBY_RUNTIME_HELLO_TIMEOUT_MS);
			};
			socket.onerror = () => {
				if (!opened) {
					clearConnectTimer();
					reject(new Error(`Failed to connect to ${this.options.url}`));
				}
			};
			socket.onmessage = (event) => {
				if (!ready && this.options.runtime) {
					const activation = parseRuntimeServerActivationData(event.data);
					if (activation) {
						if (!matchesExpectedRuntimeHandshake(activation, this.options.runtime)) {
							socket.close(RUNTIME_CLOSE_CODES.identityMismatch, "invalid runtime activation request");
							reject(new Error("Chatobby runtime returned an invalid activation identity"));
							return;
						}
						if (!activationRequests.has(activation.activationId)) {
							activationRequests.add(activation.activationId);
							void this.respondToRuntimeActivation(socket, activation);
						}
						return;
					}
					const response = parseRuntimeServerHandshakeData(event.data);
					if (!response || !matchesExpectedRuntimeHandshake(response, this.options.runtime)) {
						clearHelloTimer();
						socket.close(RUNTIME_CLOSE_CODES.identityMismatch, "invalid hello acknowledgement");
						reject(new Error("Chatobby runtime returned an invalid hello acknowledgement"));
						return;
					}
					if (response.type === "hello_pending") {
						if (!startupAdmissionPending) {
							startupAdmissionPending = true;
							clearConnectTimer();
							clearHelloTimer();
							helloTimer = window.setTimeout(() => {
								socket.close(RUNTIME_CLOSE_CODES.helloTimeout, "startup admission timeout");
								reject(new Error(`Chatobby runtime startup admission timed out for ${this.options.url}`));
							}, this.options.startupAdmissionTimeout ?? CHATOBBY_RUNTIME_STARTUP_ADMISSION_TIMEOUT_MS);
						}
						return;
					}
					acceptConnection();
					return;
				}
				this.handleMessage(event.data);
			};
			socket.onclose = (event) => {
				clearConnectTimer();
				clearHelloTimer();
				this.connected = false;
				const terminalRuntimeFailure = isTerminalRuntimeCloseCode(event.code);
				if (terminalRuntimeFailure) this.reconnectBlocked = true;
				if (this.ws === socket) this.ws = null;
				if (!ready) reject(new Error(runtimeCloseMessage(this.options.url, event.code, event.reason, opened)));
				if (!this.closedByUser && !terminalRuntimeFailure) {
					this.options.onClose?.();
					this.rejectPending(new Error("WebSocket connection closed"));
					this.scheduleReconnect();
				}
			};
		});

		try {
			await this.connecting;
		} finally {
			this.connecting = undefined;
		}
	}

	private async respondToRuntimeActivation(
		socket: WebSocket,
		request: RuntimeServerActivationRequired,
	): Promise<void> {
		let status: RuntimeClientActivationResult["status"] = "failed";
		try {
			if (!this.options.activateRuntime) throw new Error("Runtime activation is unavailable");
			await this.options.activateRuntime(request);
			status = "applied";
		} catch {
			// The runtime receives only the bounded outcome. Connector diagnostics
			// retain the underlying local failure without crossing the wire.
		}
		if (socket.readyState !== WebSocket.OPEN) return;
		const response: RuntimeClientActivationResult = {
			type: "runtime_activation_result",
			protocolVersion: request.protocolVersion,
			instanceId: request.instanceId,
			vaultId: request.vaultId,
			activationId: request.activationId,
			operation: request.operation,
			status,
		};
		socket.send(JSON.stringify(response));
	}

	async disconnect(): Promise<void> {
		this.closedByUser = true;
		this.connected = false;
		if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
		this.reconnectTimer = undefined;
		this.rejectPending(new Error("WebSocket disconnected"));
		const socket = this.ws;
		this.ws = null;
		if (!socket || socket.readyState === WebSocket.CLOSED) return;
		await new Promise<void>((resolve) => {
			const timer = window.setTimeout(resolve, this.options.disconnectTimeout ?? 5_000);
			socket.onclose = () => {
				window.clearTimeout(timer);
				resolve();
			};
			socket.close();
		});
	}

	async getFrontendBootstrap(request: FrontendBootstrapRequest): Promise<FrontendBootstrap> {
		return parseFrontendBootstrap(resultField(await this.send("frontend_bootstrap", request), "bootstrap"));
	}

	async getFrontendScreen(request: FrontendScreenRequest): Promise<FrontendScreenViewModel> {
		return parseFrontendScreen(resultField(await this.send("frontend_screen", request), "screen"));
	}

	async subscribeFrontend(request: FrontendSubscriptionRequest): Promise<FrontendSubscriptionAck> {
		return resultField(await this.send("frontend_subscribe", request), "subscription");
	}

	async dispatchFrontendIntent(intent: FrontendIntent): Promise<FrontendIntentResult> {
		return resultField(await this.send("frontend_intent", intent), "outcome");
	}

	async registerProjectDirectoryCandidate(
		request: WsProjectDirectoryCandidateRequest,
	): Promise<WsProjectDirectoryCandidateResult> {
		return resultField(await this.send("projects_directory_candidate", request), "candidate");
	}

	async getMcpCredentialReferences(): Promise<readonly string[]> {
		return resultField(await this.send("mcp_credential_references", {}), "references");
	}

	async setMcpCredential(reference: string, secret?: string): Promise<void> {
		await this.send("mcp_credential_set", { reference, secret });
	}

	async prompt(
		message: string,
		attachments?: WsPromptAttachment[],
		context?: WsPromptContextPacket,
		submissionId?: string,
	): Promise<"started" | "retracted"> {
		return resultField(await this.send("prompt", { message, attachments, context, submissionId }), "status");
	}

	async steer(message: string, attachments?: WsPromptAttachment[]): Promise<"accepted" | "promoted-to-prompt"> {
		return resultField(await this.send("steer", { message, attachments }), "status");
	}

	async followUp(message: string, attachments?: WsPromptAttachment[]): Promise<"started" | "promoted-to-prompt"> {
		return resultField(await this.send("follow_up", { message, attachments }), "status");
	}

	async abort(): Promise<void> {
		await this.send("abort", {});
	}

	async retractPrompt(
		submissionId: string,
	): Promise<{ retracted: boolean; reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed" }> {
		const result = await this.send("retract_prompt", { submissionId });
		return {
			retracted: resultField(result, "retracted"),
			reason:
				isRecord(result) && typeof result.reason === "string"
					? (result.reason as "not-found" | "output-started" | "drain-timeout" | "prompt-failed")
					: undefined,
		};
	}

	async listSessions(cwdOverride?: string, includeDescendants = false): Promise<WsSessionInfo[]> {
		return resultField(await this.send("list_sessions", { cwdOverride, includeDescendants }), "sessions");
	}

	async deleteSession(selector: WsStoredSessionSelector, cwdRoot: string): Promise<{ sessionId: string }> {
		return {
			sessionId: resultField<string>(await this.send("delete_session", { ...selector, cwdRoot }), "sessionId"),
		};
	}

	async renameStoredSession(selector: WsStoredSessionSelector, cwdRoot: string, name: string): Promise<void> {
		await this.send("rename_stored_session", { ...selector, cwdRoot, name });
	}

	async getStoredSessionForkMessages(selector: WsStoredSessionSelector, cwdRoot: string): Promise<WsForkMessage[]> {
		return resultField(await this.send("get_stored_session_fork_messages", { ...selector, cwdRoot }), "messages");
	}

	async cloneStoredSession(
		selector: WsStoredSessionSelector,
		cwdRoot: string,
	): Promise<{ sessionId: string; sessionPath: string }> {
		const result = await this.send("clone_stored_session", { ...selector, cwdRoot });
		return { sessionId: resultField(result, "sessionId"), sessionPath: resultField(result, "sessionPath") };
	}

	async forkStoredSession(
		selector: WsStoredSessionSelector,
		cwdRoot: string,
		entryId: string,
	): Promise<{ sessionId: string; sessionPath: string }> {
		const result = await this.send("fork_stored_session", { ...selector, cwdRoot, entryId });
		return { sessionId: resultField(result, "sessionId"), sessionPath: resultField(result, "sessionPath") };
	}

	async exportStoredSession(
		selector: WsStoredSessionSelector,
		cwdRoot: string,
		format: "html" | "jsonl",
		outputPath?: string,
	): Promise<string> {
		return resultField(
			await this.send("export_stored_session", { ...selector, cwdRoot, format, outputPath }),
			"path",
		);
	}

	async getSessionStats(): Promise<WsSessionStats> {
		return resultField(await this.send("get_session_stats", {}), "stats");
	}

	async getLastAssistantText(): Promise<string | null> {
		return resultField(await this.send("get_last_assistant_text", {}), "text");
	}

	async setOperatorViewOpen(open: boolean): Promise<void> {
		await this.send("events_set_operator_view", { open });
	}

	async getProviders(): Promise<WsProviderInfo[]> {
		return resultField(await this.send("get_providers", {}), "providers");
	}

	async getLocalModelProviders(): Promise<WsLocalModelProviderDocument> {
		return resultField(await this.send("get_local_model_providers", {}), "document");
	}

	async saveLocalModelProvider(
		expectedRevision: number,
		provider: WsLocalModelProvider,
		apiKey?: string,
	): Promise<WsLocalModelProviderDocument> {
		return resultField(
			await this.send("save_local_model_provider", { expectedRevision, provider, apiKey }),
			"document",
		);
	}

	async deleteLocalModelProvider(
		expectedRevision: number,
		providerId: string,
		removeCredential = true,
	): Promise<WsLocalModelProviderDocument> {
		return resultField(
			await this.send("delete_local_model_provider", { expectedRevision, providerId, removeCredential }),
			"document",
		);
	}

	async testLocalModelProvider(
		provider: WsLocalModelProvider,
		apiKey?: string,
	): Promise<WsLocalModelProviderProbeResult> {
		return resultField(await this.send("test_local_model_provider", { provider, apiKey }), "result");
	}

	async getManagedLocalModelServers(): Promise<WsManagedLocalModelServerSnapshot> {
		return resultField(await this.send("get_managed_local_model_servers", {}), "snapshot");
	}

	async saveManagedLocalModelServer(
		expectedRevision: number,
		profile: WsManagedLocalModelServerProfile,
	): Promise<WsManagedLocalModelServerSnapshot> {
		return resultField(await this.send("save_managed_local_model_server", { expectedRevision, profile }), "snapshot");
	}

	async deleteManagedLocalModelServer(
		expectedRevision: number,
		profileId: string,
	): Promise<WsManagedLocalModelServerSnapshot> {
		return resultField(
			await this.send("delete_managed_local_model_server", { expectedRevision, profileId }),
			"snapshot",
		);
	}

	async controlManagedLocalModelServer(
		profileId: string,
		action: "start" | "stop" | "restart",
	): Promise<WsManagedLocalModelServerStatus> {
		return resultField(await this.send(`${action}_managed_local_model_server`, { profileId }), "status");
	}

	async setAutoCompaction(settings: {
		enabled?: boolean;
		thresholdPercent?: number;
		customInstructions?: string;
	}): Promise<WsAutoCompactionSettings> {
		return resultField(await this.send("set_auto_compaction", settings), "settings");
	}

	async setAutoNameStrategy(strategy: AutoNameStrategy): Promise<void> {
		await this.send("set_auto_name_strategy", { strategy });
	}

	async setProviderApiKey(provider: string, apiKey: string): Promise<void> {
		await this.send("credential_set_api_key", { provider, apiKey });
	}

	async removeProviderCredential(provider: string): Promise<void> {
		await this.send("credential_remove", { provider });
	}

	async bash(command: string, excludeFromContext?: boolean): Promise<WsBashResult> {
		return resultField(await this.send("bash", { command, excludeFromContext }), "result");
	}

	async compact(customInstructions?: string): Promise<void> {
		await this.send("compact", { customInstructions });
	}

	async reload(): Promise<void> {
		await this.send("reload", {});
	}

	async exportHtml(outputPath?: string): Promise<string> {
		return resultField(await this.send("export_html", { outputPath }), "path");
	}

	async exportJsonl(outputPath?: string): Promise<string> {
		return resultField(await this.send("export_jsonl", { outputPath }), "path");
	}

	async getRuntimeInfo(): Promise<WsRuntimeInfo> {
		return resultField(await this.send("get_runtime_info", {}), "info");
	}

	async getGuide(): Promise<{
		content: string;
		path: string;
		title: string;
		version: string;
		earlyAccess: boolean;
		confirmationNotice: string;
		files: Array<{ path: string; title: string; content: string }>;
	}> {
		return resultField(await this.send("get_guide", {}), "guide");
	}

	onBridgeConfig(listener: (config: WsBridgeConfig) => void): () => void {
		this.bridgeConfigListeners.add(listener);
		return () => this.bridgeConfigListeners.delete(listener);
	}

	onFrontendPatch(listener: (patch: FrontendPatch) => void): () => void {
		this.frontendPatchListeners.add(listener);
		return () => this.frontendPatchListeners.delete(listener);
	}

	onExtensionUI(handler: ExtensionUIHandler): void {
		this.extensionUIHandler = handler;
	}

	private scheduleReconnect(): void {
		if (this.options.autoReconnect === false || this.reconnectBlocked || this.reconnectTimer) return;
		this.reconnectTimer = window.setTimeout(() => {
			this.reconnectTimer = undefined;
			void this.connect().catch(() => this.scheduleReconnect());
		}, this.options.reconnectDelay ?? 2000);
	}

	private handleMessage(data: unknown): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(String(data));
		} catch {
			return;
		}
		if (isResponseFrame(parsed)) {
			const pending = this.pending.get(parsed.id);
			if (!pending) return;
			this.pending.delete(parsed.id);
			window.clearTimeout(pending.timer);
			if (parsed.type === "error") {
				pending.reject(
					new ChatobbyWsError(
						parsed.error?.code ?? "handler_error",
						parsed.error?.publicMessage ?? parsed.error?.message ?? "Chatobby runtime request failed",
						parsed.error?.diagnosticId,
						parsed.error?.retryable ?? false,
					),
				);
			} else {
				pending.resolve(parsed.result);
			}
			return;
		}
		if (!isRecord(parsed) || typeof parsed.type !== "string") return;
		if (parsed.type === "frontend_patch") {
			try {
				const patch = parseFrontendPatch(parsed.patch);
				for (const listener of this.frontendPatchListeners) listener(patch);
			} catch {
				return;
			}
			return;
		}
		if (parsed.type === "bridge_config") {
			try {
				const config: WsBridgeConfig = parseObsidianBridgeConnectionConfig(parsed);
				for (const listener of this.bridgeConfigListeners) listener(config);
			} catch {
				return;
			}
			return;
		}
		const request = parsed.request;
		if (parsed.type !== "extension_ui_request" || !this.extensionUIHandler || !isExtensionUIRequest(request)) {
			return;
		}
		void this.extensionUIHandler(request)
			.then((result) => this.sendExtensionUIResponse(request.id, result))
			.catch(() => this.sendExtensionUIResponse(request.id, undefined));
	}

	private sendExtensionUIResponse(id: string, result: unknown): void {
		this.sendRaw({ id: `ws_${++this.requestId}`, method: "extension_ui_response", params: { id, result } });
	}

	private sendRaw(command: Command): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not connected");
		this.ws.send(JSON.stringify(command));
	}

	private async send(method: string, params: unknown): Promise<unknown> {
		const id = `ws_${++this.requestId}`;
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error("WebSocket is not connected"));
				return;
			}
			const frontendIntentType =
				method === "frontend_intent" && params && typeof params === "object" && !Array.isArray(params)
					? (params as { readonly type?: unknown }).type
					: undefined;
			const timeout =
				this.options.requestTimeout ??
				(frontendIntentType === "mcp.connect" ||
				frontendIntentType === "mcp.discover" ||
				frontendIntentType === "mcp.auth-complete"
					? MCP_FRONTEND_OPERATION_TIMEOUT_MS
					: method === "compact"
						? CHATOBBY_COMPACTION_REQUEST_TIMEOUT_MS
						: method === "prompt"
							? CHATOBBY_PROMPT_REQUEST_TIMEOUT_MS
							: method === "bash"
								? 130_000
								: 30_000);
			const timer = window.setTimeout(() => {
				if (!this.pending.delete(id)) return;
				reject(new Error(`Chatobby runtime request timed out after ${timeout}ms: ${method}`));
			}, timeout);
			this.pending.set(id, { resolve, reject, timer });
			try {
				this.sendRaw({ id, method, params });
			} catch (sendError) {
				this.pending.delete(id);
				window.clearTimeout(timer);
				reject(sendError instanceof Error ? sendError : new Error(String(sendError)));
			}
		});
	}

	private rejectPending(error: Error): void {
		for (const pending of this.pending.values()) {
			window.clearTimeout(pending.timer);
			pending.reject(error);
		}
		this.pending.clear();
	}
}

function isExtensionUIRequest(value: unknown): value is WsExtensionUIRequest {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		["select", "confirm", "input", "editor", "notify", "setWidget", "setTitle"].includes(String(value.method)) &&
		isRecord(value.params)
	);
}

function parseRuntimeServerHandshakeData(data: unknown): RuntimeServerHello | RuntimeServerPending | null {
	try {
		const parsed: unknown = JSON.parse(String(data));
		return parseRuntimeServerHello(parsed) ?? parseRuntimeServerPending(parsed);
	} catch {
		return null;
	}
}

function parseRuntimeServerActivationData(data: unknown): RuntimeServerActivationRequired | null {
	try {
		return parseRuntimeServerActivationRequired(JSON.parse(String(data)));
	} catch {
		return null;
	}
}

function matchesExpectedRuntimeHandshake(
	acknowledgement: RuntimeServerHello | RuntimeServerPending | RuntimeServerActivationRequired,
	expected: Omit<RuntimeClientHello, "type">,
): boolean {
	return (
		acknowledgement.protocolVersion === expected.protocolVersion &&
		acknowledgement.instanceId === expected.instanceId &&
		acknowledgement.vaultId === expected.vaultId
	);
}

function isTerminalRuntimeCloseCode(code: number): boolean {
	return (
		code === RUNTIME_CLOSE_CODES.authenticationFailed ||
		code === RUNTIME_CLOSE_CODES.identityMismatch ||
		code === RUNTIME_CLOSE_CODES.protocolMismatch
	);
}

function runtimeCloseMessage(url: string, code: number, reason: string, opened: boolean): string {
	if (reason) return `Chatobby runtime connection closed (${code}): ${reason}`;
	return opened ? `Chatobby runtime connection closed during handshake (${code})` : `Failed to connect to ${url}`;
}
