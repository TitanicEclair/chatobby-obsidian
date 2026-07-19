import type { ChatobbyTransport } from "../../transport/ws-client";
import type { ReadyRuntime } from "../contracts";

interface FrontendSessionEntry {
  visible: boolean;
  transport: ChatobbyTransport | null;
  runtimeInstanceId: string | null;
  unbindTransport: (() => void) | null;
  connecting: {
    runtimeInstanceId: string;
    promise: Promise<ChatobbyTransport>;
  } | null;
}

export interface FrontendSessionRegistryDependencies {
  createTransport(runtime: ReadyRuntime): ChatobbyTransport;
  bindTransport(channelId: string, transport: ChatobbyTransport): () => void;
  operatorVisibilityTimeoutMs?: number;
}

const DEFAULT_OPERATOR_VISIBILITY_TIMEOUT_MS = 3_000;

/**
 * Owns one authenticated backend runtime channel per Chatobby leaf.
 *
 * The backend process is shared, but every registered channel receives a
 * distinct WebSocket, agent runtime, extension event bus, and bridge token.
 */
export class FrontendSessionRegistry {
  private readonly entries = new Map<string, FrontendSessionEntry>();
  private runtime: ReadyRuntime | null = null;
  private utilityTransport: ChatobbyTransport | null = null;
  private utilityRuntimeInstanceId: string | null = null;
  private generation = 0;

  constructor(private readonly dependencies: FrontendSessionRegistryDependencies) {}

  async register(channelId: string): Promise<void> {
    if (!this.entries.has(channelId)) {
      this.entries.set(channelId, {
        visible: false,
        transport: null,
        runtimeInstanceId: null,
        unbindTransport: null,
        connecting: null,
      });
    }
    if (!this.runtime) return;
    await this.ensure(channelId);
    await this.releaseUtilityTransport();
  }

  async unregister(channelId: string): Promise<void> {
    const entry = this.entries.get(channelId);
    if (!entry) return;
    this.entries.delete(channelId);
    entry.unbindTransport?.();
    entry.unbindTransport = null;
    await entry.transport?.disconnect().catch(() => {});
    entry.transport = null;
    entry.runtimeInstanceId = null;
    entry.connecting = null;
  }

  /** Drop registrations whose Obsidian leaves no longer exist. */
  async reconcile(liveChannelIds: ReadonlySet<string>): Promise<void> {
    await Promise.all(
      [...this.entries.keys()]
        .filter((channelId) => !liveChannelIds.has(channelId))
        .map((channelId) => this.unregister(channelId)),
    );
  }

  get(channelId: string): ChatobbyTransport | null {
    return this.entries.get(channelId)?.transport ?? null;
  }

  primary(preferredChannelId?: string): ChatobbyTransport | null {
    const preferred = preferredChannelId ? this.get(preferredChannelId) : null;
    if (preferred) return preferred;
    for (const entry of this.entries.values()) {
      if (entry.transport) return entry.transport;
    }
    return this.utilityTransport;
  }

  connected(): ChatobbyTransport[] {
    const transports = [...this.entries.values()]
      .map((entry) => entry.transport)
      .filter((transport): transport is ChatobbyTransport => transport?.isConnected ?? false);
    if (this.utilityTransport?.isConnected) transports.push(this.utilityTransport);
    return transports;
  }

  async bindRuntime(runtime: ReadyRuntime): Promise<void> {
    this.runtime = runtime;
    this.generation += 1;
    if (this.entries.size === 0) {
      await this.ensureUtility();
      return;
    }
    await Promise.all([...this.entries.keys()].map((channelId) => this.ensure(channelId)));
    await this.releaseUtilityTransport();
  }

  async ensure(channelId: string): Promise<ChatobbyTransport> {
    const entry = this.entries.get(channelId);
    if (!entry) throw new Error(`Unknown Chatobby frontend channel: ${channelId}`);
    const runtime = this.runtime;
    if (!runtime) throw new Error("Chatobby runtime is not ready");
    if (entry.transport?.isConnected && entry.runtimeInstanceId === runtime.identity.instanceId) {
      return entry.transport;
    }
    const inFlight = entry.connecting;
    if (inFlight && inFlight.runtimeInstanceId === runtime.identity.instanceId) {
      return inFlight.promise;
    }
    if (inFlight) {
      await inFlight.promise.catch(() => {});
      return this.ensure(channelId);
    }

    const generation = this.generation;
    const connecting = this.connectEntry(channelId, entry, runtime, generation).finally(() => {
      if (entry.connecting?.promise === connecting) entry.connecting = null;
    });
    entry.connecting = { runtimeInstanceId: runtime.identity.instanceId, promise: connecting };
    return connecting;
  }

  async ensureUtility(): Promise<ChatobbyTransport> {
    const runtime = this.runtime;
    if (!runtime) throw new Error("Chatobby runtime is not ready");
    if (!this.utilityTransport) {
      this.utilityTransport = this.dependencies.createTransport(runtime);
      this.utilityRuntimeInstanceId = runtime.identity.instanceId;
    } else if (this.utilityRuntimeInstanceId !== runtime.identity.instanceId) {
      await this.utilityTransport.setRuntime(runtime);
      this.utilityRuntimeInstanceId = runtime.identity.instanceId;
    }
    if (!this.utilityTransport.isConnected) await this.utilityTransport.connect();
    return this.utilityTransport;
  }

  async setVisible(channelId: string, visible: boolean): Promise<void> {
    const entry = this.entries.get(channelId);
    if (!entry) return;
    entry.visible = visible;
    if (entry.transport?.isConnected) await this.synchronizeVisibility(entry.transport, visible);
  }

  /** Disconnect runtime sockets while preserving leaf registrations for restart. */
  async disconnectRuntime(): Promise<void> {
    this.runtime = null;
    this.generation += 1;
    const transports = [...this.entries.values()]
      .map((entry) => entry.transport)
      .filter((transport): transport is ChatobbyTransport => transport !== null);
    for (const entry of this.entries.values()) entry.runtimeInstanceId = null;
    if (this.utilityTransport) transports.push(this.utilityTransport);
    this.utilityRuntimeInstanceId = null;
    await Promise.all(transports.map((transport) => transport.disconnect().catch(() => {})));
  }

  async dispose(): Promise<void> {
    await this.disconnectRuntime();
    for (const entry of this.entries.values()) entry.unbindTransport?.();
    this.entries.clear();
    this.utilityTransport = null;
    this.utilityRuntimeInstanceId = null;
  }

  private async connectEntry(
    channelId: string,
    entry: FrontendSessionEntry,
    runtime: ReadyRuntime,
    generation: number,
  ): Promise<ChatobbyTransport> {
    if (!entry.transport) {
      entry.transport = this.dependencies.createTransport(runtime);
      entry.unbindTransport = this.dependencies.bindTransport(channelId, entry.transport);
    } else if (entry.runtimeInstanceId !== runtime.identity.instanceId) {
      await entry.transport.setRuntime(runtime);
    }
    await entry.transport.connect();
    if (generation !== this.generation || this.runtime !== runtime || !this.entries.has(channelId)) {
      await entry.transport.disconnect().catch(() => {});
      throw new Error("Chatobby frontend channel changed while connecting");
    }
    entry.runtimeInstanceId = runtime.identity.instanceId;
    await this.synchronizeVisibility(entry.transport, entry.visible);
    return entry.transport;
  }

  private async synchronizeVisibility(transport: ChatobbyTransport, visible: boolean): Promise<void> {
    const timeoutMs = this.dependencies.operatorVisibilityTimeoutMs ?? DEFAULT_OPERATOR_VISIBILITY_TIMEOUT_MS;
    await Promise.race([
      transport.setOperatorViewOpen(visible).catch(() => {}),
      delay(timeoutMs),
    ]);
  }

  private async releaseUtilityTransport(): Promise<void> {
    const transport = this.utilityTransport;
    this.utilityTransport = null;
    this.utilityRuntimeInstanceId = null;
    await transport?.disconnect().catch(() => {});
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
