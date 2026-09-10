import { randomUUID } from "node:crypto";
import type { RuntimeMaintenanceAdmission } from "../../vendor/chatobby-client/ws-client.js";
import {
  runtimePackageFingerprint,
  type PendingRuntimePackageInstallation,
  type RuntimePackageInstaller,
} from "../infrastructure/runtime-installation";
import type { ManagedCommand } from "./runtime-manager";
import type { RuntimeIdentity } from "../contracts";
import {
  compareRuntimeVersions,
  RuntimeUpdateError,
  type RuntimeUpdateClientLike,
  type RuntimeUpdateDescriptor,
  type RuntimeUpdateTransferProgress,
} from "../infrastructure/runtime-update-client";

export type RuntimeUpdateInstallPhase = "downloading" | "extracting" | "installing" | "reconnecting";
export type RuntimeUpdateOfferKind = "install" | "update" | "repair";
export type RuntimeProvisionResult = "current" | "installed" | "deferred";

export type RuntimeUpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | {
    status: "available";
    descriptor: RuntimeUpdateDescriptor;
    installedVersion: string | null;
    kind: RuntimeUpdateOfferKind;
  }
  | { status: "current"; installedVersion: string; checkedAt: number }
  | {
    status: "deferred";
    descriptor: RuntimeUpdateDescriptor;
    installedVersion: string | null;
    kind: RuntimeUpdateOfferKind;
    reason: "active-work";
  }
  | {
    status: "installing";
    descriptor: RuntimeUpdateDescriptor;
    installedVersion: string | null;
    kind: RuntimeUpdateOfferKind;
    phase: RuntimeUpdateInstallPhase;
    completed: number;
    total: number;
  }
  | {
    status: "error";
    message: string;
    code?: RuntimeUpdateError["code"];
    descriptor?: RuntimeUpdateDescriptor;
    kind?: RuntimeUpdateOfferKind;
  };

export interface RuntimeUpdateManagerDeps {
  pluginVersion: string;
  enabled: boolean;
  client: RuntimeUpdateClientLike;
  installer: Pick<RuntimePackageInstaller, "prepareInstall" | "readVerifiedInstalledVersion" | "resumePendingInstall">;
  getInstalledVersion(): string | null;
  admitMaintenance(
    operationId: string,
    target: { runtimeVersion: string; runtimePackageFingerprint: string | null; developmentBuildFingerprint: null },
  ): Promise<RuntimeMaintenanceAdmission | null>;
  cancelMaintenance(operationId: string, leaseId: string): Promise<void>;
  commitMaintenance(operationId: string, leaseId: string): Promise<void>;
  stopRuntime(): Promise<void>;
  startRuntime(command?: ManagedCommand): Promise<void>;
  now?: () => number;
}

type RuntimeUpdateListener = (state: RuntimeUpdateState) => void;

/** Coordinate exact-pair provisioning, explicit repair, and rollback-aware activation. */
export class RuntimeUpdateManager {
  private readonly listeners = new Set<RuntimeUpdateListener>();
  private stateValue: RuntimeUpdateState = { status: "idle" };
  private checked = false;
  private checkPromise: Promise<RuntimeUpdateDescriptor | null> | null = null;
  private ensurePromise: Promise<RuntimeProvisionResult> | null = null;
  private installPromise: Promise<string> | null = null;
  private pendingInstallation: PendingRuntimePackageInstallation | null = null;
  private pendingInstallationRecovered = false;
  private recoveredFinalization: Promise<void> | null = null;
  private recoveredRollback: Promise<boolean> | null = null;
  private progressKey: string | null = null;

  constructor(private readonly deps: RuntimeUpdateManagerDeps) {}

  get state(): RuntimeUpdateState {
    return this.stateValue;
  }

  onStateChange(listener: RuntimeUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ensure the signed runtime paired with this connector without a second confirmation. */
  ensureRequiredRuntime(signal?: AbortSignal): Promise<RuntimeProvisionResult> {
    if (this.ensurePromise) return this.ensurePromise;
    const operation = this.ensureRequiredRuntimeInternal(signal).finally(() => {
      if (this.ensurePromise === operation) this.ensurePromise = null;
    });
    this.ensurePromise = operation;
    return operation;
  }

  async checkIfNeeded(): Promise<RuntimeUpdateDescriptor | null> {
    if (!this.deps.enabled || this.checked) return this.availableDescriptor();
    try {
      return await this.check(false);
    } catch {
      this.emit({ status: "idle" });
      return null;
    }
  }

  reset(): void {
    this.checked = false;
    this.progressKey = null;
    this.emit({ status: "idle" });
  }

  check(force = true): Promise<RuntimeUpdateDescriptor | null> {
    if (!this.deps.enabled) return Promise.reject(new Error("Runtime updates are available only in release builds"));
    if (!force && this.checked) return Promise.resolve(this.availableDescriptor());
    if (this.checkPromise) return this.checkPromise;
    const operation = this.checkInternal().finally(() => {
      if (this.checkPromise === operation) this.checkPromise = null;
    });
    this.checkPromise = operation;
    return operation;
  }

  async checkForRepair(): Promise<RuntimeUpdateDescriptor> {
    if (!this.deps.enabled) throw new Error("Runtime repair is available only in release builds");
    if (this.checkPromise) await this.checkPromise.catch(() => undefined);
    const descriptor = await this.checkInternal(true);
    if (!descriptor) throw new Error("No compatible Chatobby runtime is available for repair");
    return descriptor;
  }

  install(signal?: AbortSignal, stopActiveWork = false): Promise<string> {
    if (this.installPromise) return this.installPromise;
    const operation = this.installInternal(signal, stopActiveWork).finally(() => {
      if (this.installPromise === operation) this.installPromise = null;
    });
    this.installPromise = operation;
    return operation;
  }

  /** Activate only the exact candidate that requested startup admission. */
  async activatePendingRuntime(input: {
    runtimeVersion: string;
    runtimePackageFingerprint: string | null;
    operation: "activate" | "rollback";
  }): Promise<void> {
    const installation = this.pendingInstallation;
    if (!installation) throw new Error("No Chatobby runtime installation is awaiting activation");
    if (
      input.runtimeVersion !== installation.runtimeVersion
      || input.runtimePackageFingerprint !== installation.runtimePackageFingerprint
    ) {
      throw new Error("Runtime activation identity does not match the prepared package");
    }
    if (input.operation === "activate") await installation.activate();
    else await installation.rollback();
  }

  /** Restore the rollback handle that cannot safely live only in plugin memory. */
  async recoverInterruptedInstallation(): Promise<"none" | "rolled-back" | "awaiting-runtime"> {
    if (!this.deps.enabled) return "none";
    if (this.pendingInstallation) throw new Error("A Chatobby runtime installation is already active");
    const installation = await this.deps.installer.resumePendingInstall(this.deps.pluginVersion);
    if (!installation) return "none";
    if (installation.activationState === "prepared") {
      await this.deps.stopRuntime();
      await installation.rollback();
      return "rolled-back";
    }
    this.pendingInstallation = installation;
    this.pendingInstallationRecovered = true;
    return "awaiting-runtime";
  }

  /** Seal an activated recovered package only after its exact runtime reconnects. */
  async finalizeRecoveredRuntime(identity: RuntimeIdentity): Promise<void> {
    if (!this.pendingInstallationRecovered) return;
    const installation = this.pendingInstallation;
    if (!installation) throw new Error("Recovered Chatobby runtime installation state is unavailable");
    if (
      identity.runtimeVersion !== installation.runtimeVersion
      || identity.runtimePackageFingerprint !== installation.runtimePackageFingerprint
    ) {
      throw new Error("The reconnected runtime does not match the interrupted installation");
    }
    // Restored leaves share readiness but each awaits acceptance. Join the
    // journal mutation so one tab cannot fail and stop another tab's runtime.
    if (this.recoveredFinalization) return this.recoveredFinalization;
    if (this.recoveredRollback) throw new Error("Recovered runtime rollback is already in progress");
    const operation = installation.finalize().then(() => {
      if (this.pendingInstallation === installation) this.pendingInstallation = null;
      this.pendingInstallationRecovered = false;
    }).finally(() => {
      if (this.recoveredFinalization === operation) this.recoveredFinalization = null;
    });
    this.recoveredFinalization = operation;
    return operation;
  }

  /** Restore the previous package when a recovered activated candidate cannot reconnect. */
  async rollbackRecoveredRuntime(): Promise<boolean> {
    // A different leaf's failed request must not roll back an accepted runtime
    // while its successful reconnect is still finalizing the journal.
    await this.recoveredFinalization?.catch(() => undefined);
    if (this.recoveredRollback) return this.recoveredRollback;
    if (!this.pendingInstallationRecovered) return false;
    const installation = this.pendingInstallation;
    if (!installation) throw new Error("Recovered Chatobby runtime installation state is unavailable");
    const operation = this.deps.stopRuntime().then(async () => {
      await installation.rollback();
      if (this.pendingInstallation === installation) this.pendingInstallation = null;
      this.pendingInstallationRecovered = false;
      return true;
    }).finally(() => {
      if (this.recoveredRollback === operation) this.recoveredRollback = null;
    });
    this.recoveredRollback = operation;
    return operation;
  }

  private async checkInternal(repair = false): Promise<RuntimeUpdateDescriptor | null> {
    this.emit({ status: "checking" });
    try {
      const installedVersion = this.deps.getInstalledVersion();
      const verifiedInstalledVersion = await this.verifiedInstalledVersion();
      if (!repair && verifiedInstalledVersion) {
        const comparison = compareRuntimeVersions(verifiedInstalledVersion, this.deps.pluginVersion);
        if (comparison >= 0) {
          this.checked = true;
          this.emit({
            status: "current",
            installedVersion: verifiedInstalledVersion,
            checkedAt: (this.deps.now ?? Date.now)(),
          });
          return null;
        }
      }
      if (
        !repair
        && installedVersion
        && compareRuntimeVersions(installedVersion, this.deps.pluginVersion) > 0
      ) {
        throw new Error(
          `Installed runtime ${installedVersion} is newer than Chatobby ${this.deps.pluginVersion}; automatic provisioning will not downgrade it`,
        );
      }
      const descriptor = await this.deps.client.fetchExact(this.deps.pluginVersion);
      this.checked = true;
      if (repair && installedVersion) {
        const comparison = compareRuntimeVersions(installedVersion, descriptor.version);
        if (comparison > 0) {
          throw new Error(
            `Installed runtime ${installedVersion} is newer than the latest compatible repair package ${descriptor.version}`,
          );
        }
        this.emit({
          status: "available",
          descriptor,
          installedVersion,
          kind: comparison === 0 ? "repair" : "update",
        });
        return descriptor;
      }
      const kind = installedVersion === descriptor.version
        ? "repair"
        : installedVersion
          ? "update"
          : "install";
      this.emit({ status: "available", descriptor, installedVersion, kind });
      return descriptor;
    } catch (error) {
      this.emit({
        status: "error",
        message: errorMessage(error),
        ...(error instanceof RuntimeUpdateError ? { code: error.code } : {}),
      });
      throw error;
    }
  }

  private async ensureRequiredRuntimeInternal(signal?: AbortSignal): Promise<RuntimeProvisionResult> {
    if (!this.deps.enabled) return "current";
    const descriptor = await this.check(false);
    if (!descriptor) return "current";
    await this.install(signal);
    return this.stateValue.status === "deferred" ? "deferred" : "installed";
  }

  private async installInternal(signal?: AbortSignal, stopActiveWork = false): Promise<string> {
    if (!this.deps.enabled) throw new Error("Runtime installation is available only in release builds");
    const offer = this.availableOffer();
    const descriptor = offer?.descriptor ?? await this.check(true);
    if (!descriptor) return this.deps.getInstalledVersion() ?? "current";
    const installedVersion = offer?.installedVersion ?? this.deps.getInstalledVersion();
    const kind = offer?.kind ?? (installedVersion ? "update" : "install");
    this.progressKey = null;
    this.emitInstall(descriptor, installedVersion, kind, "downloading", 0, descriptor.bundle.size);
    let staged: Awaited<ReturnType<RuntimeUpdateClientLike["stage"]>> | null = null;
    let installation: PendingRuntimePackageInstallation | null = null;
    let stopped = false;
    const operationId = `runtime-update-${randomUUID()}`;
    let admission: Extract<RuntimeMaintenanceAdmission, { status: "admitted" }> | null = null;
    let maintenanceCommitted = false;
    try {
      staged = await this.deps.client.stage(
        descriptor,
        this.deps.pluginVersion,
        signal,
        (progress) => this.handleProgress(descriptor, installedVersion, kind, progress),
      );
      const maintenance = await this.deps.admitMaintenance(operationId, {
        runtimeVersion: descriptor.version,
        runtimePackageFingerprint: runtimePackageFingerprint(staged.manifest),
        developmentBuildFingerprint: null,
      });
      if (maintenance?.status === "deferred" && (!stopActiveWork || maintenance.activeWorkKinds.includes("maintenance"))) {
        this.emit({ status: "deferred", descriptor, installedVersion, kind, reason: "active-work" });
        return installedVersion ?? "deferred";
      }
		admission = maintenance?.status === "admitted" ? maintenance : null;
      this.emitInstall(descriptor, installedVersion, kind, "installing", 0, 1);
      if (admission) {
        await this.deps.commitMaintenance(operationId, admission.leaseId);
        maintenanceCommitted = true;
        stopped = true;
      } else {
        await this.deps.stopRuntime();
        stopped = true;
      }
      installation = await this.deps.installer.prepareInstall(staged.directory, staged.manifest, this.deps.pluginVersion);
      this.pendingInstallation = installation;
      this.pendingInstallationRecovered = false;
      this.emitInstall(descriptor, installedVersion, kind, "reconnecting", 1, 1);
      await this.deps.startRuntime({
        command: installation.executable,
        args: [],
        runtimePackageFingerprint: installation.runtimePackageFingerprint,
        runtimeActivationRequired: true,
      });
      stopped = false;
      if (this.pendingInstallation === installation) this.pendingInstallation = null;
      this.pendingInstallationRecovered = false;
      await installation.finalize();
      this.checked = true;
      this.emit({ status: "current", installedVersion: descriptor.version, checkedAt: (this.deps.now ?? Date.now)() });
      return descriptor.version;
    } catch (error) {
      let recoveryError: unknown = null;
      if (installation) {
        try {
          if (this.pendingInstallation === installation) this.pendingInstallation = null;
          this.pendingInstallationRecovered = false;
          await this.deps.stopRuntime();
          await installation.rollback();
          await this.deps.startRuntime();
          stopped = false;
        } catch (candidate) {
          recoveryError = candidate;
        }
      } else if (stopped) {
        try {
          await this.deps.startRuntime();
        } catch (candidate) {
          recoveryError = candidate;
        }
      }
      const failure: unknown = recoveryError
        ? new Error(`${errorMessage(error)} Automatic rollback could not restore Chatobby: ${errorMessage(recoveryError)}`)
        : error;
      if (failure instanceof Error && failure.name === "AbortError") {
        this.emit({ status: "available", descriptor, installedVersion, kind });
      } else {
        this.emit({
          status: "error",
          message: errorMessage(failure),
          ...(failure instanceof RuntimeUpdateError ? { code: failure.code } : {}),
          descriptor,
          kind,
        });
      }
      throw failure;
    } finally {
		if (admission && !maintenanceCommitted) {
			await this.deps.cancelMaintenance(operationId, admission.leaseId).catch(() => undefined);
		}
      if (this.pendingInstallation === installation) this.pendingInstallation = null;
      if (installation) this.pendingInstallationRecovered = false;
      await staged?.cleanup().catch(() => undefined);
    }
  }

  private handleProgress(
    descriptor: RuntimeUpdateDescriptor,
    installedVersion: string | null,
    kind: RuntimeUpdateOfferKind,
    progress: RuntimeUpdateTransferProgress,
  ): void {
    const percent = progress.total <= 0 ? 0 : Math.floor((progress.completed / progress.total) * 100);
    const key = `${progress.phase}:${percent}`;
    if (key === this.progressKey) return;
    this.progressKey = key;
    this.emitInstall(descriptor, installedVersion, kind, progress.phase, progress.completed, progress.total);
  }

  private emitInstall(
    descriptor: RuntimeUpdateDescriptor,
    installedVersion: string | null,
    kind: RuntimeUpdateOfferKind,
    phase: RuntimeUpdateInstallPhase,
    completed: number,
    total: number,
  ): void {
    this.emit({ status: "installing", descriptor, installedVersion, kind, phase, completed, total });
  }

  private availableOffer(): Extract<RuntimeUpdateState, { status: "available" }> | null {
    if (this.stateValue.status === "available") return this.stateValue;
    if (this.stateValue.status === "deferred") {
      return {
        status: "available",
        descriptor: this.stateValue.descriptor,
        installedVersion: this.stateValue.installedVersion,
        kind: this.stateValue.kind,
      };
    }
    return null;
  }

  private availableDescriptor(): RuntimeUpdateDescriptor | null {
    if (
      this.stateValue.status === "available"
      || this.stateValue.status === "deferred"
      || this.stateValue.status === "installing"
    ) {
      return this.stateValue.descriptor;
    }
    if (this.stateValue.status === "error" && this.stateValue.descriptor) return this.stateValue.descriptor;
    return null;
  }

  private emit(state: RuntimeUpdateState): void {
    this.stateValue = state;
    for (const listener of this.listeners) listener(state);
  }

  private async verifiedInstalledVersion(): Promise<string | null> {
    try {
      return await this.deps.installer.readVerifiedInstalledVersion(this.deps.pluginVersion);
    } catch {
      return null;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
