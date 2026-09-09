import type { ReadyRuntime } from "../contracts";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type {
  FrontendNegotiationRequest,
  FrontendSubscriptionResult,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import { frontendId } from "../../vendor/chatobby-client/frontend-contracts.js";

export interface DevelopmentPairActivationProof {
  readonly status: "frontend-bootstrap-complete";
  readonly pairId: string;
  readonly runtimeInstanceId: string;
  readonly frontendProtocolVersion: number;
  readonly viewId: string;
  readonly selectedCapabilities: readonly string[];
  readonly subscriptionStatus: "bootstrapped";
  readonly subscriptionSequence: number;
  readonly subscriptionRevision: number;
  readonly bootstrapRuntimeInstanceId: string;
  readonly bootstrapViewId: string;
  readonly bootstrapSequence: number;
  readonly bootstrapRevision: number;
  readonly completedAt: string;
  readonly timeoutMs: number;
}

export interface DevelopmentPairBootstrapOptions {
  readonly pairId: string;
  readonly runtime: ReadyRuntime;
  readonly transport: Pick<
    ChatobbyTransport,
    "isConnected" | "negotiateFrontend" | "subscribeFrontend" | "activateFrontendLive"
  >;
  readonly request: FrontendNegotiationRequest;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
  readonly now?: () => Date;
}

/** Prove a real authenticated protocol-v2 atomic bootstrap for one exact pair. */
export async function verifyDevelopmentPairFrontendBootstrap(
  options: DevelopmentPairBootstrapOptions,
): Promise<DevelopmentPairActivationProof> {
  throwIfAborted(options.signal);
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("Development pair frontend bootstrap timeout is invalid");
  }
  if (!options.transport.isConnected) throw new Error("Development pair frontend transport is not authenticated");

  const negotiation = await options.transport.negotiateFrontend(options.request);
  throwIfAborted(options.signal);
  if (negotiation.protocolVersion !== options.request.supportedProtocolVersions[0]) {
    throw new Error("Development pair frontend negotiation selected the wrong protocol");
  }
  if (negotiation.runtimeInstanceId !== options.runtime.identity.instanceId) {
    throw new Error("Development pair frontend negotiation returned the wrong runtime instance");
  }
  if (negotiation.viewId !== options.request.viewId) {
    throw new Error("Development pair frontend negotiation returned the wrong view identity");
  }
  const missingCapability = options.request.capabilities.protocolCapabilities.find(
    (capability) => !negotiation.selectedCapabilities.includes(capability),
  );
  if (missingCapability) {
    throw new Error(`Development pair frontend negotiation omitted required capability: ${missingCapability}`);
  }
  if (new Set(negotiation.selectedCapabilities).size !== negotiation.selectedCapabilities.length) {
    throw new Error("Development pair frontend negotiation returned duplicate capabilities");
  }

  const subscription = await options.transport.subscribeFrontend({
    schemaVersion: 1,
    protocolVersion: negotiation.protocolVersion,
    requestId: frontendId(window.crypto.randomUUID(), "requestId"),
    runtimeInstanceId: negotiation.runtimeInstanceId,
    viewId: negotiation.viewId,
  });
  throwIfAborted(options.signal);
  assertExactBootstrap(subscription, negotiation.runtimeInstanceId, negotiation.viewId);
  options.transport.activateFrontendLive();

  return {
    status: "frontend-bootstrap-complete",
    pairId: options.pairId,
    runtimeInstanceId: negotiation.runtimeInstanceId,
    frontendProtocolVersion: negotiation.protocolVersion,
    viewId: negotiation.viewId,
    selectedCapabilities: [...negotiation.selectedCapabilities],
    subscriptionStatus: "bootstrapped",
    subscriptionSequence: subscription.sequence,
    subscriptionRevision: subscription.revision,
    bootstrapRuntimeInstanceId: subscription.bootstrap.runtimeInstanceId,
    bootstrapViewId: subscription.bootstrap.viewId,
    bootstrapSequence: subscription.bootstrap.sequence,
    bootstrapRevision: subscription.bootstrap.revision,
    completedAt: (options.now?.() ?? new Date()).toISOString(),
    timeoutMs: options.timeoutMs,
  };
}

function assertExactBootstrap(
  subscription: FrontendSubscriptionResult,
  runtimeInstanceId: string,
  viewId: string,
): asserts subscription is Extract<FrontendSubscriptionResult, { status: "bootstrapped" }> {
  if (subscription.status === "resync-required") throw new Error(subscription.error.message);
  if (subscription.status !== "bootstrapped") {
    throw new Error("Development pair frontend subscription did not return a fresh bootstrap");
  }
  if (
    subscription.runtimeInstanceId !== runtimeInstanceId
    || subscription.bootstrap.runtimeInstanceId !== runtimeInstanceId
  ) {
    throw new Error("Development pair frontend bootstrap returned the wrong runtime instance");
  }
  if (subscription.viewId !== viewId || subscription.bootstrap.viewId !== viewId) {
    throw new Error("Development pair frontend bootstrap returned the wrong view identity");
  }
  if (
    subscription.bootstrap.sequence !== subscription.sequence
    || subscription.bootstrap.revision !== subscription.revision
  ) {
    throw new Error("Development pair frontend bootstrap cutover is inconsistent");
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof Error ? signal.reason : new Error("Development pair frontend bootstrap was cancelled");
}
