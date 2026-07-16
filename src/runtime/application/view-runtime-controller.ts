import type { ChatobbyTransport } from "../../transport/ws-client";
import type {
  ReadyRuntime,
  RuntimeDemandHandle,
  RuntimeDemandKind,
  RuntimeLifecycleState,
} from "../public";

export interface ViewRuntimeControllerHost {
  shouldAutoStart(): boolean;
  acquireDemand(kind: RuntimeDemandKind, ownerId: string): RuntimeDemandHandle;
  ensureRuntime(reason: "view-open" | "user-action"): Promise<ReadyRuntime>;
  getTransport(): ChatobbyTransport | null;
  onStateChange(listener: (state: RuntimeLifecycleState) => void): () => void;
  handleStateChange(): void;
}

/** Own one view's demand and runtime subscription without owning the runtime lifetime. */
export class ViewRuntimeController {
  private readonly host: ViewRuntimeControllerHost;
  private readonly ownerId = globalThis.crypto.randomUUID();
  private visibleDemand: RuntimeDemandHandle | null = null;
  private unsubscribe: (() => void) | null = null;
  private actionSequence = 0;

  constructor(host: ViewRuntimeControllerHost) {
    this.host = host;
  }

  open(): void {
    this.visibleDemand ??= this.host.acquireDemand("visible-view", this.ownerId);
    this.unsubscribe ??= this.host.onStateChange(() => this.host.handleStateChange());
    if (this.host.shouldAutoStart()) void this.host.ensureRuntime("view-open").catch(() => {});
  }

  close(): void {
    this.visibleDemand?.release();
    this.visibleDemand = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async ensureTransport(): Promise<ChatobbyTransport | null> {
    const demand = this.host.acquireDemand("pending-user-action", `${this.ownerId}:${++this.actionSequence}`);
    try {
      await this.host.ensureRuntime("user-action");
      const transport = this.host.getTransport();
      return transport?.isConnected ? transport : null;
    } finally {
      demand.release();
    }
  }
}
