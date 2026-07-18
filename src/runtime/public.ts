export type {
  EnsureRuntimeRequest,
  ReadyRuntime,
  RuntimeActionReason,
  RuntimeConfiguration,
  RuntimeDetachReason,
  RuntimeDiagnostics,
  RuntimeFailureCode,
  RuntimeIdentity,
  RuntimeLifecycleState,
  RuntimeMode,
  RuntimeOwnership,
} from "./contracts";

export { RuntimeUpdateManager } from "./application/runtime-update-manager";
export type {
  RuntimeUpdateInstallPhase,
  RuntimeUpdateManagerDeps,
  RuntimeUpdateOfferKind,
  RuntimeUpdateState,
} from "./application/runtime-update-manager";
export type { RuntimeUpdateDescriptor } from "./infrastructure/runtime-update-client";

import type {
  EnsureRuntimeRequest,
  ReadyRuntime,
  RuntimeActionReason,
  RuntimeDetachReason,
  RuntimeLifecycleState,
} from "./contracts";

/** Stable lifecycle surface consumed by plugin composition and product UI. */
export interface ChatobbyRuntimeManager {
  readonly state: RuntimeLifecycleState;
  onStateChange(listener: (state: RuntimeLifecycleState) => void): () => void;
  ensureReady(request: EnsureRuntimeRequest): Promise<ReadyRuntime>;
	reportConnectionFailure(message: string): Promise<void>;
  restart(reason: RuntimeActionReason): Promise<ReadyRuntime>;
  stop(reason: RuntimeActionReason): Promise<void>;
  detach(reason: RuntimeDetachReason): Promise<void>;
}

export type RuntimeDemandKind = "visible-view" | "pending-user-action" | "agent-work" | "background-event";

export interface RuntimeDemandSnapshot {
  id: string;
  kind: RuntimeDemandKind;
  ownerId: string;
  acquiredAt: number;
}

export interface RuntimeDemandHandle {
  id: string;
  kind: RuntimeDemandKind;
  release(): void;
}

export interface RuntimeDemandRegistry {
  acquire(kind: RuntimeDemandKind, ownerId: string): RuntimeDemandHandle;
  hasDemand(kind?: RuntimeDemandKind): boolean;
  snapshot(): readonly RuntimeDemandSnapshot[];
}
