// ObsidianBridgeClient — 2nd WebSocket to the bridge endpoint.
// Manages: lifecycle, Hello, ping/pong, in-flight table, reconnect.
//
// See docs/tooling/bridge-executor.md §7 for architecture.

import type { App } from "obsidian";
import type {
  ObsidianBridgeHello,
  ObsidianEnabledPlugin,
  ObsidianBridgePing,
} from "../vendor/@chatobby/obsidian-protocol/bridge-protocol";
import {
  OBSIDIAN_BRIDGE_PROTOCOL_VERSION,
} from "../vendor/@chatobby/obsidian-protocol/bridge-errors";
import type { BridgeConnectionEvent, BridgeConnectionState, InFlightRequest } from "./types";
import { INITIAL_BRIDGE_STATE } from "./types";
import {
  transitionBridgeConnection,
  canRetryBridge,
  TERMINAL_CLOSE_CODES,
} from "./bridge-connection-state";
import { routeInboundFrame, serializeOutbound } from "./bridge-router";
import { getVaultIdentity } from "./operations/helpers/vault-identity";
import { PLUGIN_CAPABILITIES } from "./capabilities";
import { capabilityStateFingerprint, collectObsidianCapabilityState } from "./dependency-snapshot";
import {
  BRIDGE_PING_INTERVAL_MS,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  BRIDGE_READY_GRACE_MS,
} from "../ui/shared/constants";

export class ObsidianBridgeClient {
  private ws: WebSocket | null = null;
  private state: BridgeConnectionState = INITIAL_BRIDGE_STATE;
  private inFlight: Map<string, InFlightRequest> = new Map();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private capabilityTimer: ReturnType<typeof setInterval> | null = null;
  private capabilityFingerprint = "";
  private connectionListeners: Set<(state: BridgeConnectionState) => void> = new Set();

  constructor(
    private app: App,
    private url: string,
    private token: string,
    private appVersion: string,
    private pluginVersion: string,
    private wsFactory?: { new(url: string, protocols?: string | string[] | undefined): WebSocket } | null,
  ) {}

  // ── Subscriptions ──────────────────────────────────────────────────

  /** Subscribe to bridge connection state changes. Returns unsubscribe. */
  onConnectionChange(listener: (state: BridgeConnectionState) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  // ── Connection lifecycle ───────────────────────────────────────────

  /** Connect to the bridge WebSocket and send Hello. */
  async connect(): Promise<void> {
    // Configure with the provided url/token
    this.dispatch({ type: "configure", url: this.url, token: this.token });
    this.dispatch({ type: "connect" });

    try {
      // Use injected WebSocket constructor for testing, native WebSocket in production
      const WebSocketImpl = this.wsFactory ?? WebSocket;
      this.ws = new WebSocketImpl(this.url);

      this.ws.onopen = () => {
        this.sendHello();
        this.dispatch({ type: "hello_sent" });

        // No hello_ack — readiness inferred from socket staying open.
        // After a brief grace period, transition to ready.
        setTimeout(() => {
          if (this.state.status === "hello_sent") {
            this.dispatch({ type: "ready" });
            this.startPing();
            this.startCapabilityWatch();
          }
        }, BRIDGE_READY_GRACE_MS);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data as string).catch((e) => {
          console.error("Chatobby bridge: error handling message", e);
        });
      };

      this.ws.onclose = (event) => {
        this.stopPing();
        this.stopCapabilityWatch();
        const isTerminal = TERMINAL_CLOSE_CODES.has(event.code);

        if (isTerminal) {
          this.dispatch({
            type: "error",
            error: event.reason || `Bridge closed with code ${event.code}`,
            code: event.code,
          });
          // Do not retry terminal close codes
        } else {
          this.dispatch({
            type: "disconnected",
            code: event.code,
            reason: event.reason,
          });
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onerror is always followed by onclose — let onclose handle it
      };
    } catch (e) {
      this.dispatch({
        type: "error",
        error: e instanceof Error ? e.message : String(e),
      });
      this.scheduleReconnect();
    }
  }

  /**
   * Apply a new bridge_config — invalidates the old token, disconnects, and
   * reconnects with the new url/token. The old token is discarded; the new
   * token is used only for the next hello.authToken.
   */
  async reconfigure(url: string, token: string): Promise<void> {
    this.url = url;
    this.token = token;
    await this.disconnect();
    this.dispatch({ type: "configure", url, token });
    await this.connect();
  }

  /** Disconnect from the bridge. */
  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.stopPing();
    this.stopCapabilityWatch();

    // Abort all in-flight requests
    for (const [, entry] of this.inFlight) {
      entry.abortController.abort();
    }
    this.inFlight.clear();

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }

    this.state = INITIAL_BRIDGE_STATE;
    this.emitState();
  }

  get connectionState(): BridgeConnectionState {
    return this.state;
  }

  get isReady(): boolean {
    return this.state.status === "ready";
  }

  // ── Private helpers ────────────────────────────────────────────────

  private sendHello(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const vault = getVaultIdentity(this.app);
    const capabilityState = collectObsidianCapabilityState(this.app);
    this.capabilityFingerprint = capabilityStateFingerprint(capabilityState);
    const hello: ObsidianBridgeHello = {
      type: "hello",
      authToken: this.token,
      protocolVersion: OBSIDIAN_BRIDGE_PROTOCOL_VERSION as 1,
      connectionId: crypto.randomUUID(),
      vault,
      appVersion: this.appVersion,
      pluginVersion: this.pluginVersion,
      capabilities: PLUGIN_CAPABILITIES,
      enabledPlugins: getEnabledPlugins(this.app),
      plugins: capabilityState.plugins,
      runtimeDependencies: capabilityState.runtimeDependencies,
    };

    this.ws.send(JSON.stringify(hello));
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, BRIDGE_PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private startCapabilityWatch(): void {
    this.stopCapabilityWatch();
    this.capabilityTimer = setInterval(() => this.sendCapabilityChanges(), 2_000);
  }

  private stopCapabilityWatch(): void {
    if (this.capabilityTimer !== null) {
      clearInterval(this.capabilityTimer);
      this.capabilityTimer = null;
    }
  }

  private sendCapabilityChanges(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const state = collectObsidianCapabilityState(this.app);
    const fingerprint = capabilityStateFingerprint(state);
    if (fingerprint === this.capabilityFingerprint) return;
    this.capabilityFingerprint = fingerprint;
    this.ws.send(JSON.stringify({ type: "capabilities_changed", ...state }));
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const ping: ObsidianBridgePing = {
      type: "ping",
      requestId: crypto.randomUUID(),
      sentAt: new Date().toISOString(),
    };

    this.ws.send(JSON.stringify(ping));
  }

  private async handleMessage(data: string): Promise<void> {
    let raw: unknown;
    try {
      raw = JSON.parse(data);
    } catch {
      console.error("Chatobby bridge: invalid JSON frame");
      return;
    }

    // routeInboundFrame mutates this.inFlight directly for invoke/cancel
    const result = await routeInboundFrame(raw, this.app, this.inFlight);

    // Send outbound messages
    for (const msg of result.outbound) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(serializeOutbound(msg));
      }
    }
  }

  private dispatch(event: BridgeConnectionEvent): void {
    this.state = transitionBridgeConnection(this.state, event);
    this.emitState();
  }

  private emitState(): void {
    for (const listener of this.connectionListeners) {
      listener(this.state);
    }
  }

  private scheduleReconnect(): void {
    if (!canRetryBridge(this.state)) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.state.reconnectAttempt),
      RECONNECT_MAX_DELAY_MS,
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.dispatch({ type: "retry" });
      this.connect().catch(() => {});
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

function getEnabledPlugins(app: App): ObsidianEnabledPlugin[] {
  const pluginRegistry = (app as unknown as {
    plugins?: {
      enabledPlugins?: Set<string> | string[];
      manifests?: Record<string, { id?: string; name?: string; version?: string }>;
    };
  }).plugins;
  const enabled = pluginRegistry?.enabledPlugins;
  const ids = enabled instanceof Set ? Array.from(enabled) : enabled ?? [];
  return ids.map((id) => {
    const manifest = pluginRegistry?.manifests?.[id];
    return {
      id,
      name: manifest?.name ?? id,
      version: manifest?.version,
    };
  });
}
