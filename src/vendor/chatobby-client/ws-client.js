// packages/chatobby/src/control/contracts.ts
var CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION = 2;
var CHATOBBY_RUNTIME_PROTOCOL_VERSION = 3;
var CHATOBBY_RUNTIME_HELLO_TIMEOUT_MS = 5e3;
var RUNTIME_CLOSE_CODES = {
  authenticationFailed: 4401,
  identityMismatch: 4403,
  protocolMismatch: 4406,
  helloTimeout: 4408
};
function parseRuntimeServerHello(value) {
  if (!isRecord(value) || value.type !== "hello_ack") return null;
  if (!Number.isInteger(value.protocolVersion) || typeof value.protocolVersion !== "number") return null;
  if (!isNonEmptyString(value.runtimeVersion)) return null;
  if (!isNonEmptyString(value.instanceId)) return null;
  if (!isNonEmptyString(value.vaultId)) return null;
  return {
    type: "hello_ack",
    protocolVersion: value.protocolVersion,
    runtimeVersion: value.runtimeVersion,
    instanceId: value.instanceId,
    vaultId: value.vaultId
  };
}
function parseRuntimeReadyDescriptor(value) {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION) return null;
  if (!isNonEmptyString(value.instanceId) || !isNonEmptyString(value.vaultId)) return null;
  if (!isPositiveInteger(value.pid) || !isPositiveInteger(value.startedAt)) return null;
  if (!isNonEmptyString(value.runtimeVersion) || !isPositiveInteger(value.protocolVersion)) return null;
  if (value.runtimePackageFingerprint !== null && !isSha256Fingerprint(value.runtimePackageFingerprint)) return null;
  if (value.host !== "127.0.0.1" || !isPort(value.port)) return null;
  if (!isSha256Fingerprint(value.controlTokenFingerprint)) return null;
  if (!isSha256Fingerprint(value.sessionTokenFingerprint)) return null;
  return {
    schemaVersion: CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
    instanceId: value.instanceId,
    vaultId: value.vaultId,
    pid: value.pid,
    startedAt: value.startedAt,
    runtimeVersion: value.runtimeVersion,
    protocolVersion: value.protocolVersion,
    runtimePackageFingerprint: value.runtimePackageFingerprint,
    host: "127.0.0.1",
    port: value.port,
    controlTokenFingerprint: value.controlTokenFingerprint,
    sessionTokenFingerprint: value.sessionTokenFingerprint
  };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function isPort(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 65535;
}
function isSha256Fingerprint(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

// packages/chatobby/src/frontend-contracts.ts
var CHATOBBY_FRONTEND_PROTOCOL_VERSION = 1;
function parseFrontendScreen(value) {
  const input = requireRecord(value, "frontend screen");
  if (input.screenId !== "channels" && input.screenId !== "memory" && input.screenId !== "permissions" && input.screenId !== "events" && input.screenId !== "queries" && input.screenId !== "subagents") {
    throw new Error(`Unknown frontend screen: ${String(input.screenId)}`);
  }
  requireSafeInteger(input.revision, "revision");
  requireBoolean(input.loading, "loading");
  if (input.screenId === "channels") {
    requireArray(input.groups, "groups");
    requireString(input.heading, "heading");
    requireArray(input.messages, "messages");
    return value;
  }
  if (input.screenId === "memory") {
    requireArray(input.filters, "filters");
    requireArray(input.records, "records");
    requireArray(input.candidates, "candidates");
    requireArray(input.learningSettings, "learningSettings");
    return value;
  }
  if (input.screenId === "queries") {
    requireString(input.projectName, "projectName");
    requireString(input.projectDirectory, "projectDirectory");
    requireBoolean(input.trusted, "trusted");
    requireArray(input.items, "items");
    return value;
  }
  if (input.screenId === "permissions") {
    requireString(input.selectedProfileId, "selectedProfileId");
    requireArray(input.profiles, "profiles");
    requireRecord(input.selectedProfile, "selectedProfile");
    requireArray(input.capabilities, "capabilities");
    requireArray(input.channels, "channels");
    requireArray(input.advancedGroups, "advancedGroups");
    return value;
  }
  if (input.screenId === "subagents") {
    requireSafeInteger(input.sequence, "sequence");
    requireArray(input.runIds, "runIds");
    requireArray(input.runSummaries, "runSummaries");
    requireArray(input.runs, "runs");
    requireArray(input.definitions, "definitions");
    requireArray(input.workflows, "workflows");
    requireArray(input.messages, "messages");
    requireRecord(input.focusedFeed, "focusedFeed");
    return value;
  }
  requireArray(input.definitions, "definitions");
  requireArray(input.occurrences, "occurrences");
  requireSafeInteger(input.pendingApprovalCount, "pendingApprovalCount");
  return value;
}
function parseFrontendBootstrap(value) {
  const input = requireRecord(value, "frontend bootstrap");
  requireSchemaVersion(input);
  if (input.protocolVersion !== CHATOBBY_FRONTEND_PROTOCOL_VERSION) {
    throw new Error(`Unsupported frontend protocol version: ${String(input.protocolVersion)}`);
  }
  requireString(input.runtimeInstanceId, "runtimeInstanceId");
  requireString(input.viewId, "viewId");
  requireSafeInteger(input.revision, "revision");
  requireRecord(input.taskPlan, "taskPlan");
  requireRecord(input.composer, "composer");
  requireRecord(input.agentRail, "agentRail");
  requireRecord(input.feed, "feed");
  requireArray(input.screens, "screens");
  requireArray(input.screenModels, "screenModels");
  requireArray(input.localCommands, "localCommands");
  return value;
}
function parseFrontendPatch(value) {
  const input = requireRecord(value, "frontend patch");
  requireSchemaVersion(input);
  requireString(input.runtimeInstanceId, "runtimeInstanceId");
  requireSafeInteger(input.sequence, "sequence");
  requireSafeInteger(input.baseRevision, "baseRevision");
  requireSafeInteger(input.revision, "revision");
  requireRecord(input.scope, "scope");
  requireArray(input.operations, "operations");
  return value;
}
function requireSchemaVersion(input) {
  if (input.schemaVersion !== 1)
    throw new Error(`Unsupported frontend schema version: ${String(input.schemaVersion)}`);
}
function requireRecord(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value;
}
function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}
function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  return value;
}
function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}
function requireSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

// packages/chatobby/src/frontend-client.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null;
}
function isResponseFrame(value) {
  return isRecord2(value) && typeof value.id === "string" && (value.type === "response" || value.type === "error");
}
function resultField(value, key) {
  if (!isRecord2(value) || !(key in value)) throw new Error(`Chatobby runtime response is missing ${key}`);
  return value[key];
}
var ChatobbyWsClient = class {
  constructor(options) {
    this.ws = null;
    this.closedByUser = false;
    this.connected = false;
    this.reconnectBlocked = false;
    this.requestId = 0;
    this.pending = /* @__PURE__ */ new Map();
    this.bridgeConfigListeners = /* @__PURE__ */ new Set();
    this.frontendPatchListeners = /* @__PURE__ */ new Set();
    this.options = options;
  }
  async connect() {
    if (this.connecting) return this.connecting;
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;
    const WebSocketConstructor = globalThis.WebSocket;
    if (!WebSocketConstructor) throw new Error("WebSocket is not available in this runtime");
    this.closedByUser = false;
    this.connecting = new Promise((resolve, reject) => {
      const socket = new WebSocketConstructor(this.options.url);
      let opened = false;
      let ready = false;
      let helloTimer;
      const connectTimer = setTimeout(() => {
        socket.close();
        reject(new Error(`Chatobby runtime connection timed out for ${this.options.url}`));
      }, this.options.connectTimeout ?? 1e4);
      this.ws = socket;
      const clearConnectTimer = () => clearTimeout(connectTimer);
      const clearHelloTimer = () => {
        if (helloTimer) clearTimeout(helloTimer);
        helloTimer = void 0;
      };
      const acceptConnection = () => {
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
        const hello = { type: "hello", ...runtime };
        socket.send(JSON.stringify(hello));
        helloTimer = setTimeout(() => {
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
          const acknowledgement = parseRuntimeServerHelloData(event.data);
          if (!acknowledgement || !matchesExpectedRuntimeHello(acknowledgement, this.options.runtime)) {
            clearHelloTimer();
            socket.close(RUNTIME_CLOSE_CODES.identityMismatch, "invalid hello acknowledgement");
            reject(new Error("Chatobby runtime returned an invalid hello acknowledgement"));
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
      this.connecting = void 0;
    }
  }
  async disconnect() {
    this.closedByUser = true;
    this.connected = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = void 0;
    this.rejectPending(new Error("WebSocket disconnected"));
    const socket = this.ws;
    this.ws = null;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, this.options.disconnectTimeout ?? 5e3);
      socket.onclose = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.close();
    });
  }
  async getFrontendBootstrap(request) {
    return parseFrontendBootstrap(resultField(await this.send("frontend_bootstrap", request), "bootstrap"));
  }
  async getFrontendScreen(request) {
    return parseFrontendScreen(resultField(await this.send("frontend_screen", request), "screen"));
  }
  async subscribeFrontend(request) {
    return resultField(await this.send("frontend_subscribe", request), "subscription");
  }
  async dispatchFrontendIntent(intent) {
    return resultField(await this.send("frontend_intent", intent), "outcome");
  }
  async prompt(message, attachments, context, submissionId) {
    return resultField(await this.send("prompt", { message, attachments, context, submissionId }), "status");
  }
  async steer(message) {
    return resultField(await this.send("steer", { message }), "status");
  }
  async followUp(message) {
    return resultField(await this.send("follow_up", { message }), "status");
  }
  async abort() {
    await this.send("abort", {});
  }
  async retractPrompt(submissionId) {
    const result = await this.send("retract_prompt", { submissionId });
    return {
      retracted: resultField(result, "retracted"),
      reason: isRecord2(result) && typeof result.reason === "string" ? result.reason : void 0
    };
  }
  async listSessions(cwdOverride, includeDescendants = false) {
    return resultField(await this.send("list_sessions", { cwdOverride, includeDescendants }), "sessions");
  }
  async deleteSession(sessionPath, cwdRoot) {
    return {
      sessionId: resultField(await this.send("delete_session", { sessionPath, cwdRoot }), "sessionId")
    };
  }
  async renameStoredSession(sessionPath, cwdRoot, name) {
    await this.send("rename_stored_session", { sessionPath, cwdRoot, name });
  }
  async getStoredSessionForkMessages(sessionPath, cwdRoot) {
    return resultField(await this.send("get_stored_session_fork_messages", { sessionPath, cwdRoot }), "messages");
  }
  async cloneStoredSession(sessionPath, cwdRoot) {
    const result = await this.send("clone_stored_session", { sessionPath, cwdRoot });
    return { sessionId: resultField(result, "sessionId"), sessionPath: resultField(result, "sessionPath") };
  }
  async forkStoredSession(sessionPath, cwdRoot, entryId) {
    const result = await this.send("fork_stored_session", { sessionPath, cwdRoot, entryId });
    return { sessionId: resultField(result, "sessionId"), sessionPath: resultField(result, "sessionPath") };
  }
  async exportStoredSession(sessionPath, cwdRoot, format, outputPath) {
    return resultField(
      await this.send("export_stored_session", { sessionPath, cwdRoot, format, outputPath }),
      "path"
    );
  }
  async getSessionStats() {
    return resultField(await this.send("get_session_stats", {}), "stats");
  }
  async getLastAssistantText() {
    return resultField(await this.send("get_last_assistant_text", {}), "text");
  }
  async setOperatorViewOpen(open) {
    await this.send("events_set_operator_view", { open });
  }
  async getProviders() {
    return resultField(await this.send("get_providers", {}), "providers");
  }
  async setAutoCompaction(settings) {
    return resultField(await this.send("set_auto_compaction", settings), "settings");
  }
  async setAutoNameStrategy(strategy) {
    await this.send("set_auto_name_strategy", { strategy });
  }
  async setProviderApiKey(provider, apiKey) {
    await this.send("credential_set_api_key", { provider, apiKey });
  }
  async removeProviderCredential(provider) {
    await this.send("credential_remove", { provider });
  }
  async bash(command, excludeFromContext) {
    return resultField(await this.send("bash", { command, excludeFromContext }), "result");
  }
  async compact(customInstructions) {
    await this.send("compact", { customInstructions });
  }
  async reload() {
    await this.send("reload", {});
  }
  async exportHtml(outputPath) {
    return resultField(await this.send("export_html", { outputPath }), "path");
  }
  async exportJsonl(outputPath) {
    return resultField(await this.send("export_jsonl", { outputPath }), "path");
  }
  async getRuntimeInfo() {
    return resultField(await this.send("get_runtime_info", {}), "info");
  }
  onBridgeConfig(listener) {
    this.bridgeConfigListeners.add(listener);
    return () => this.bridgeConfigListeners.delete(listener);
  }
  onFrontendPatch(listener) {
    this.frontendPatchListeners.add(listener);
    return () => this.frontendPatchListeners.delete(listener);
  }
  onExtensionUI(handler) {
    this.extensionUIHandler = handler;
  }
  scheduleReconnect() {
    if (this.options.autoReconnect === false || this.reconnectBlocked || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = void 0;
      void this.connect().catch(() => this.scheduleReconnect());
    }, this.options.reconnectDelay ?? 2e3);
  }
  handleMessage(data) {
    let parsed;
    try {
      parsed = JSON.parse(String(data));
    } catch {
      return;
    }
    if (isResponseFrame(parsed)) {
      const pending = this.pending.get(parsed.id);
      if (!pending) return;
      this.pending.delete(parsed.id);
      clearTimeout(pending.timer);
      if (parsed.type === "error") {
        pending.reject(new Error(parsed.error?.message ?? "Chatobby runtime request failed"));
      } else {
        pending.resolve(parsed.result);
      }
      return;
    }
    if (!isRecord2(parsed) || typeof parsed.type !== "string") return;
    if (parsed.type === "frontend_patch") {
      try {
        const patch = parseFrontendPatch(parsed.patch);
        for (const listener of this.frontendPatchListeners) listener(patch);
      } catch {
        return;
      }
      return;
    }
    if (parsed.type === "bridge_config" && typeof parsed.url === "string" && typeof parsed.token === "string") {
      const config = { type: "bridge_config", url: parsed.url, token: parsed.token };
      for (const listener of this.bridgeConfigListeners) listener(config);
      return;
    }
    const request = parsed.request;
    if (parsed.type !== "extension_ui_request" || !this.extensionUIHandler || !isExtensionUIRequest(request)) {
      return;
    }
    void this.extensionUIHandler(request).then((result) => this.sendExtensionUIResponse(request.id, result)).catch(() => this.sendExtensionUIResponse(request.id, void 0));
  }
  sendExtensionUIResponse(id, result) {
    this.sendRaw({ id: `ws_${++this.requestId}`, method: "extension_ui_response", params: { id, result } });
  }
  sendRaw(command) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not connected");
    this.ws.send(JSON.stringify(command));
  }
  async send(method, params) {
    const id = `ws_${++this.requestId}`;
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket is not connected"));
        return;
      }
      const timeout = this.options.requestTimeout ?? (method === "bash" || method === "compact" ? 13e4 : 3e4);
      const timer = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`Chatobby runtime request timed out after ${timeout}ms: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.sendRaw({ id, method, params });
      } catch (sendError) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(sendError instanceof Error ? sendError : new Error(String(sendError)));
      }
    });
  }
  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
};
function isExtensionUIRequest(value) {
  return isRecord2(value) && typeof value.id === "string" && ["select", "confirm", "input", "editor", "notify", "setWidget", "setTitle"].includes(String(value.method)) && isRecord2(value.params);
}
function parseRuntimeServerHelloData(data) {
  try {
    return parseRuntimeServerHello(JSON.parse(String(data)));
  } catch {
    return null;
  }
}
function matchesExpectedRuntimeHello(acknowledgement, expected) {
  return acknowledgement.protocolVersion === expected.protocolVersion && acknowledgement.instanceId === expected.instanceId && acknowledgement.vaultId === expected.vaultId;
}
function isTerminalRuntimeCloseCode(code) {
  return code === RUNTIME_CLOSE_CODES.authenticationFailed || code === RUNTIME_CLOSE_CODES.identityMismatch || code === RUNTIME_CLOSE_CODES.protocolMismatch;
}
function runtimeCloseMessage(url, code, reason, opened) {
  if (reason) return `Chatobby runtime connection closed (${code}): ${reason}`;
  return opened ? `Chatobby runtime connection closed during handshake (${code})` : `Failed to connect to ${url}`;
}
export {
  CHATOBBY_FRONTEND_PROTOCOL_VERSION,
  CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION,
  CHATOBBY_RUNTIME_PROTOCOL_VERSION,
  ChatobbyWsClient,
  RUNTIME_CLOSE_CODES,
  parseRuntimeReadyDescriptor
};
