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
export { runtimeDevelopmentPairsRoot } from "./infrastructure/platform-paths";
export type {
  RuntimeProvisionResult,
  RuntimeUpdateInstallPhase,
  RuntimeUpdateManagerDeps,
  RuntimeUpdateOfferKind,
  RuntimeUpdateState,
} from "./application/runtime-update-manager";
export {
  automaticRuntimeProvisioningEnabled,
  RuntimeBootstrapCoordinator,
} from "./application/runtime-bootstrap-coordinator";
export type { RuntimeBootstrapCoordinatorDeps } from "./application/runtime-bootstrap-coordinator";
export type { RuntimeUpdateDescriptor } from "./infrastructure/runtime-update-client";

import type {
  EnsureRuntimeRequest,
  ReadyRuntime,
  RuntimeActionReason,
  RuntimeDetachReason,
  RuntimeLifecycleState,
} from "./contracts";
import type {
  RuntimeMaintenanceAdmission,
  RuntimeMaintenancePurpose,
  RuntimeMaintenanceTargetIdentity,
} from "../vendor/chatobby-client/ws-client.js";
import type { ManagedCommand } from "./application/runtime-manager";

/** Stable lifecycle surface consumed by plugin composition and product UI. */
export interface ChatobbyRuntimeManager {
  readonly state: RuntimeLifecycleState;
  onStateChange(listener: (state: RuntimeLifecycleState) => void): () => void;
  setDevelopmentCommandOverride(command: ManagedCommand | null): void;
  ensureReady(request: EnsureRuntimeRequest, managedCommand?: ManagedCommand): Promise<ReadyRuntime>;
	reportConnectionFailure(message: string): Promise<void>;
  restart(reason: RuntimeActionReason): Promise<ReadyRuntime>;
  reattachExistingForMaintenance(): Promise<ReadyRuntime | null>;
  stop(reason: RuntimeActionReason): Promise<void>;
  detach(reason: RuntimeDetachReason): Promise<void>;
  admitMaintenance(
    operationId: string,
    purpose: RuntimeMaintenancePurpose,
    target: RuntimeMaintenanceTargetIdentity,
  ): Promise<RuntimeMaintenanceAdmission | null>;
  cancelMaintenance(operationId: string, leaseId: string): Promise<void>;
  commitMaintenance(operationId: string, leaseId: string): Promise<void>;
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
