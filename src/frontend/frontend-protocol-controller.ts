import type { ChatobbyTransport } from "../transport/ws-client";
import type {
  FrontendLifecycleState,
  FrontendCapability,
  FrontendIntent,
  FrontendIntentResult,
  FrontendNegotiationRequest,
  FrontendPatch,
  FrontendProtocolError,
  FrontendScreenId,
  FrontendScreenRequest,
  FrontendScreenViewModel,
} from "../vendor/chatobby-client/frontend-contracts.js";
import {
  CHATOBBY_FRONTEND_PROTOCOL_VERSION,
  CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES,
  frontendId,
  isFrontendLifecycleTransition,
} from "../vendor/chatobby-client/frontend-contracts.js";
import type {
  WsProjectDirectoryCandidateRequest,
  WsProjectDirectoryCandidateResult,
} from "../vendor/chatobby-client/ws-client.js";
import { FRONTEND_RESYNC_MIN_INTERVAL_MS } from "../ui/shared/constants";
import { FrontendResyncRequiredError, FrontendStore } from "./frontend-store";
import { chatobbyPerformance } from "./performance-monitor";

export interface FrontendProtocolControllerOptions {
  readonly store: FrontendStore;
  readonly createNegotiationRequest: () => FrontendNegotiationRequest;
  readonly onError: (error: unknown) => void;
  readonly onLifecycleChange?: (state: FrontendLifecycleState) => void;
}

export interface FrontendScreenQuery {
  readonly schemaVersion?: 1;
  readonly viewId?: string;
  readonly screenId: FrontendScreenId;
  readonly preferredEntityId?: string;
}

export type FrontendIntentInput = FrontendIntent extends infer Candidate
  ? Candidate extends FrontendIntent
    ? Omit<Candidate, "schemaVersion" | "protocolVersion" | "runtimeInstanceId" | "viewId" | "intentId"> & {
        readonly schemaVersion?: 1;
        readonly protocolVersion?: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
        readonly runtimeInstanceId?: string;
        readonly viewId?: string;
        readonly intentId: string;
      }
    : never
  : never;

/** Owns bootstrap, ordered subscription, and bounded resynchronization for one leaf. */
export class FrontendProtocolController {
  private transport: ChatobbyTransport | null = null;
  private unsubscribePatch: (() => void) | null = null;
  private unsubscribeProtocolError: (() => void) | null = null;
  private synchronizePromise: Promise<void> | null = null;
  private lastSynchronizeAt = 0;
  private lifecycleValue: FrontendLifecycleState = "disconnected";
  private negotiatedCapabilities = new Set<FrontendCapability>();
  private negotiationEpoch = 0;
  private readonly screenEpochs = new Map<FrontendScreenId, number>();

  constructor(private readonly options: FrontendProtocolControllerOptions) {}

  bind(transport: ChatobbyTransport | null): void {
    if (transport === this.transport) return;
    if (this.lifecycleValue === "closed" && transport) {
      throw new Error("Illegal frontend lifecycle transition: closed -> connecting");
    }
    this.unsubscribePatch?.();
    this.unsubscribePatch = null;
    this.unsubscribeProtocolError?.();
    this.unsubscribeProtocolError = null;
    if (this.transport && this.lifecycleValue !== "closed") this.setLifecycle("disconnected");
    this.transport = transport;
    this.clearNegotiatedCapabilities();
    if (!transport) return this.setLifecycle("disconnected");
    this.unsubscribePatch = transport.onFrontendPatch((patch) => this.handlePatch(patch));
    this.unsubscribeProtocolError = transport.onFrontendProtocolError((error) => this.handleProtocolError(error));
    this.setLifecycle("connecting");
  }

  async synchronize(transport = this.transport): Promise<void> {
    if (!transport?.isConnected || transport !== this.transport) return;
    if (this.synchronizePromise) return this.synchronizePromise;
    const synchronizePromise = this.performSynchronize(transport);
    const epoch = this.negotiationEpoch;
    this.synchronizePromise = synchronizePromise;
    try {
      await synchronizePromise;
    } catch (error) {
      if (epoch === this.negotiationEpoch && transport === this.transport && this.lifecycleValue !== "closed" && this.lifecycleValue !== "disconnected") {
        this.clearNegotiatedCapabilities();
        this.setLifecycle("degraded");
      }
      throw error;
    } finally {
      if (this.synchronizePromise === synchronizePromise) this.synchronizePromise = null;
    }
  }

  async dispatch(input: FrontendIntentInput): Promise<FrontendIntentResult> {
    const transport = this.transport;
    if (!transport?.isConnected) throw new Error("Chatobby runtime is not connected");
    const snapshot = this.options.store.snapshot;
    if (!snapshot) throw new FrontendResyncRequiredError("Frontend bootstrap is missing", "sequence-gap");
    const intent = {
      ...input,
      schemaVersion: 1,
      protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
      runtimeInstanceId: snapshot.runtimeInstanceId,
      viewId: snapshot.viewId,
      intentId: frontendId(input.intentId, "intentId"),
    } as FrontendIntent;
    return transport.dispatchFrontendIntent(intent);
  }

  /** Optional features require this connection's completed negotiation. */
  supportsCapability(capability: FrontendCapability): boolean {
    return this.transport?.isConnected === true && this.negotiatedCapabilities.has(capability);
  }

  /** A disconnected/replaced transport cannot retain prior feature admission. */
  clearNegotiatedCapabilities(): void {
    this.negotiatedCapabilities.clear();
    this.negotiationEpoch += 1;
    this.synchronizePromise = null;
  }

  async registerProjectDirectoryCandidate(
    request: WsProjectDirectoryCandidateRequest,
  ): Promise<WsProjectDirectoryCandidateResult> {
    const transport = this.transport;
    if (!transport?.isConnected) throw new Error("Chatobby runtime is not connected");
    return transport.registerProjectDirectoryCandidate(request);
  }

  async loadScreen(query: FrontendScreenQuery): Promise<FrontendScreenViewModel> {
    const transport = this.transport;
    if (!transport?.isConnected) throw new Error("Chatobby runtime is not connected");
    const snapshot = this.options.store.snapshot;
    if (!snapshot) throw new FrontendResyncRequiredError("Frontend bootstrap is missing", "sequence-gap");
    const requestEpoch = (this.screenEpochs.get(query.screenId) ?? 0) + 1;
    this.screenEpochs.set(query.screenId, requestEpoch);
    const request: FrontendScreenRequest = {
      schemaVersion: 1,
      protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
      runtimeInstanceId: snapshot.runtimeInstanceId,
      viewId: snapshot.viewId,
      requestId: frontendId(window.crypto.randomUUID(), "requestId"),
      requestEpoch,
      baseSequence: snapshot.sequence,
      screenId: query.screenId,
      preferredEntityId: query.preferredEntityId,
    };
    const response = await transport.getFrontendScreen(request);
    if (transport === this.transport) this.options.store.replaceScreen(response);
    return response.screen;
  }

  async synchronizeMcpCredential(reference: string, secret: string | null): Promise<void> {
    const transport = this.transport;
    if (!transport?.isConnected) throw new Error("Chatobby runtime is not connected");
    await transport.synchronizeMcpCredential(reference, secret);
  }

  destroy(): void {
    this.unsubscribePatch?.();
    this.unsubscribePatch = null;
    this.unsubscribeProtocolError?.();
    this.unsubscribeProtocolError = null;
    this.transport = null;
    this.clearNegotiatedCapabilities();
    this.setLifecycle("closed");
  }

  private async performSynchronize(transport: ChatobbyTransport): Promise<void> {
    this.clearNegotiatedCapabilities();
    const epoch = this.negotiationEpoch;
    const isCurrent = () => transport === this.transport && transport.isConnected && epoch === this.negotiationEpoch;
    this.lastSynchronizeAt = Date.now();
    if (this.lifecycleValue === "live" || this.lifecycleValue === "bootstrapping" || this.lifecycleValue === "replaying") {
      this.setLifecycle("resynchronizing");
    }
    this.setLifecycle("negotiating");
    const request = this.options.createNegotiationRequest();
    const negotiation = await transport.negotiateFrontend(request);
    if (!isCurrent()) return;
    const requiredCapabilities = CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES;
    const missingCapability = requiredCapabilities.find(
      (capability) => !negotiation.selectedCapabilities.includes(capability),
    );
    if (missingCapability) {
      this.setLifecycle("degraded");
      throw new Error(`Chatobby runtime did not negotiate required capability: ${missingCapability}`);
    }
    const previous = this.options.store.snapshot;
    const canResume = previous?.runtimeInstanceId === negotiation.runtimeInstanceId
      && previous.viewId === negotiation.viewId;
    this.setLifecycle(canResume ? "replaying" : "bootstrapping");
    let subscription = await transport.subscribeFrontend({
      schemaVersion: 1,
      protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
      requestId: frontendId(window.crypto.randomUUID(), "requestId"),
      runtimeInstanceId: negotiation.runtimeInstanceId,
      viewId: negotiation.viewId,
      resume: canResume && previous
        ? { afterSequence: previous.sequence, revision: previous.revision }
        : undefined,
    });
    if (!isCurrent()) return;
    if (subscription.status === "resync-required") {
      this.setLifecycle("resynchronizing");
      this.setLifecycle("bootstrapping");
      subscription = await transport.subscribeFrontend({
        schemaVersion: 1,
        protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
        requestId: frontendId(window.crypto.randomUUID(), "requestId"),
        runtimeInstanceId: negotiation.runtimeInstanceId,
        viewId: negotiation.viewId,
      });
    }
    if (!isCurrent()) return;
    if (subscription.status === "resync-required") throw new Error(subscription.error.message);
    this.negotiatedCapabilities = new Set(negotiation.selectedCapabilities.filter(
      (capability) => request.capabilities.protocolCapabilities.includes(capability),
    ));
    if (subscription.status === "bootstrapped") this.options.store.replace(subscription.bootstrap);
    else this.options.store.applyReplay(subscription);
    transport.activateFrontendLive();
    this.setLifecycle("live");
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
      window.setTimeout(() => {
        this.setLifecycle("resynchronizing");
        void this.synchronize().catch(this.options.onError);
      }, remainingDelay);
    }
  }

  get lifecycle(): FrontendLifecycleState {
    return this.lifecycleValue;
  }

  private handleProtocolError(error: FrontendProtocolError): void {
    this.clearNegotiatedCapabilities();
    if (error.resync === "full-bootstrap" || error.resync === "retry") {
      this.setLifecycle("resynchronizing");
      void this.synchronize().catch(this.options.onError);
      return;
    }
    this.setLifecycle("degraded");
    this.options.onError(error);
  }

  private setLifecycle(state: FrontendLifecycleState): void {
    if (this.lifecycleValue === state) return;
    if (!isFrontendLifecycleTransition(this.lifecycleValue, state)) {
      throw new Error(`Illegal frontend lifecycle transition: ${this.lifecycleValue} -> ${state}`);
    }
    this.lifecycleValue = state;
    this.options.onLifecycleChange?.(state);
  }
}
