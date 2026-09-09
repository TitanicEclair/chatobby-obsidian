import type ChatobbyPlugin from "../../main";
import type { ChatobbyTransport } from "../../transport/ws-client";
import { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import { FrontendStore } from "../../frontend/frontend-store";
import { createFrontendNegotiationRequest } from "../controller/frontend-bootstrap-request";

/** A page has its own projection subscription; it never adopts a conversation's session. */
export class WorkspaceConnection {
  readonly channelId = crypto.randomUUID();
  readonly store = new FrontendStore();
  readonly protocol: FrontendProtocolController;
  private transport: ChatobbyTransport | null = null;
  private unsubscribeRuntime: (() => void) | null = null;
  private unsubscribeConnection: (() => void) | null = null;
  private closed = false;
  private connecting: Promise<void> | null = null;
  private opening: Promise<void> | null = null;
  private synchronizing: Promise<void> | null = null;

  constructor(
    private readonly plugin: ChatobbyPlugin,
    private readonly onReady: () => void,
    private readonly onError: (error: unknown) => void,
  ) {
    this.protocol = new FrontendProtocolController({
      store: this.store,
      createNegotiationRequest: () => createFrontendNegotiationRequest(plugin.app, plugin, this.channelId, "workspace"),
      onError,
    });
  }

  open(): Promise<void> {
    if (this.closed) return Promise.resolve();
    this.opening ??= this.openCurrent();
    return this.opening;
  }

  private async openCurrent(): Promise<void> {
    this.unsubscribeRuntime = this.plugin.onRuntimeStateChange((state) => {
      if (state.status === "ready") void this.connect().catch(this.onError);
    });
    await this.plugin.registerWorkspaceChannel(this.channelId);
    await this.connect();
  }

  async connect(): Promise<void> {
    if (this.closed) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.connectCurrent().finally(() => { this.connecting = null; });
    return this.connecting;
  }

  private async connectCurrent(): Promise<void> {
    const transport = await this.plugin.ensureWorkspaceChannel(this.channelId);
    if (this.closed) return;
    if (this.transport !== transport) {
      this.unsubscribeConnection?.();
      this.transport = transport;
      this.protocol.bind(transport);
      this.unsubscribeConnection = transport.onConnectionChange((state) => {
        if (state.status === "connected") void this.synchronize().catch(this.onError);
        else this.protocol.clearNegotiatedCapabilities();
      });
    }
    await this.synchronize();
  }

  private synchronize(): Promise<void> {
    this.synchronizing ??= this.synchronizeCurrent().finally(() => { this.synchronizing = null; });
    return this.synchronizing;
  }

  private async synchronizeCurrent(): Promise<void> {
    if (this.closed) return;
    await this.protocol.synchronize();
    if (!this.closed && this.store.snapshot) this.onReady();
  }

  getTransport(): ChatobbyTransport | null { return this.transport; }

  async close(): Promise<void> {
    this.closed = true;
    this.unsubscribeRuntime?.();
    this.unsubscribeConnection?.();
    this.protocol.destroy();
    await Promise.allSettled([this.opening, this.connecting, this.synchronizing]);
    await this.plugin.unregisterWorkspaceChannel(this.channelId);
  }
}
