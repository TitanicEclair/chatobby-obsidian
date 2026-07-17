import type { ChatobbyTransport } from "../transport/ws-client";
import type {
  FrontendBootstrapRequest,
  FrontendIntent,
  FrontendIntentResult,
  FrontendPatch,
  FrontendScreenRequest,
  FrontendScreenViewModel,
} from "../vendor/chatobby-client/frontend-contracts.js";
import { FRONTEND_RESYNC_MIN_INTERVAL_MS } from "../ui/shared/constants";
import { FrontendResyncRequiredError, FrontendStore } from "./frontend-store";
import { chatobbyPerformance } from "./performance-monitor";

export interface FrontendProtocolControllerOptions {
  readonly store: FrontendStore;
  readonly createBootstrapRequest: () => FrontendBootstrapRequest;
  readonly onError: (error: unknown) => void;
}

/** Owns bootstrap, ordered subscription, and bounded resynchronization for one leaf. */
export class FrontendProtocolController {
  private transport: ChatobbyTransport | null = null;
  private unsubscribePatch: (() => void) | null = null;
  private synchronizePromise: Promise<void> | null = null;
  private lastSynchronizeAt = 0;

  constructor(private readonly options: FrontendProtocolControllerOptions) {}

  bind(transport: ChatobbyTransport | null): void {
    if (transport === this.transport) return;
    this.unsubscribePatch?.();
    this.unsubscribePatch = null;
    this.transport = transport;
    if (!transport) return;
    this.unsubscribePatch = transport.onFrontendPatch((patch) => this.handlePatch(patch));
  }

  async synchronize(transport = this.transport): Promise<void> {
    if (!transport?.isConnected || transport !== this.transport) return;
    if (this.synchronizePromise) return this.synchronizePromise;
    const synchronizePromise = this.performSynchronize(transport);
    this.synchronizePromise = synchronizePromise;
    try {
      await synchronizePromise;
    } finally {
      if (this.synchronizePromise === synchronizePromise) this.synchronizePromise = null;
    }
  }

  async dispatch(intent: FrontendIntent): Promise<FrontendIntentResult> {
    const transport = this.transport;
    if (!transport?.isConnected) throw new Error("Chatobby runtime is not connected");
    return transport.dispatchFrontendIntent(intent);
  }

  async loadScreen(request: FrontendScreenRequest): Promise<FrontendScreenViewModel> {
    const transport = this.transport;
    if (!transport?.isConnected) throw new Error("Chatobby runtime is not connected");
    const screen = await transport.getFrontendScreen(request);
    if (transport === this.transport) this.options.store.replaceScreen(screen);
    return screen;
  }

  destroy(): void {
    this.unsubscribePatch?.();
    this.unsubscribePatch = null;
    this.transport = null;
  }

  private async performSynchronize(transport: ChatobbyTransport): Promise<void> {
    this.lastSynchronizeAt = Date.now();
    const request = this.options.createBootstrapRequest();
    const bootstrap = await transport.getFrontendBootstrap(request);
    if (transport !== this.transport) return;
    this.options.store.replace(bootstrap);
    await transport.subscribeFrontend({
      schemaVersion: 1,
      viewId: request.viewId,
      afterSequence: bootstrap.sequence,
	  deliveryMode: "patch-only",
    });
  }

  private handlePatch(patch: FrontendPatch): void {
	chatobbyPerformance.recordPatch();
    try {
      this.options.store.apply(patch);
    } catch (error) {
      if (!(error instanceof FrontendResyncRequiredError)) {
        this.options.onError(error);
        return;
      }
      const remainingDelay = Math.max(
        0,
        FRONTEND_RESYNC_MIN_INTERVAL_MS - (Date.now() - this.lastSynchronizeAt),
      );
      globalThis.setTimeout(() => {
        void this.synchronize().catch(this.options.onError);
      }, remainingDelay);
    }
  }
}
