import type {
  PendingRuntimePackageInstallation,
  RuntimePackageInstaller,
} from "../infrastructure/runtime-installation";
import {
  compareRuntimeVersions,
  type RuntimeUpdateClientLike,
  type RuntimeUpdateDescriptor,
  type RuntimeUpdateTransferProgress,
} from "../infrastructure/runtime-update-client";

export type RuntimeUpdateInstallPhase = "downloading" | "extracting" | "installing" | "reconnecting";
export type RuntimeUpdateOfferKind = "install" | "update" | "repair";

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
    status: "installing";
    descriptor: RuntimeUpdateDescriptor;
    installedVersion: string | null;
    kind: RuntimeUpdateOfferKind;
    phase: RuntimeUpdateInstallPhase;
    completed: number;
    total: number;
  }
  | { status: "error"; message: string; descriptor?: RuntimeUpdateDescriptor; kind?: RuntimeUpdateOfferKind };

export interface RuntimeUpdateManagerDeps {
  pluginVersion: string;
  enabled: boolean;
  client: RuntimeUpdateClientLike;
  installer: Pick<RuntimePackageInstaller, "prepareInstall">;
  getInstalledVersion(): string | null;
  hasActiveWork(): boolean;
  stopRuntime(): Promise<void>;
  startRuntime(): Promise<void>;
  now?: () => number;
}

type RuntimeUpdateListener = (state: RuntimeUpdateState) => void;

/** Coordinate explicit runtime installs and passive, non-installing update checks. */
export class RuntimeUpdateManager {
  private readonly listeners = new Set<RuntimeUpdateListener>();
  private stateValue: RuntimeUpdateState = { status: "idle" };
  private checked = false;
  private checkPromise: Promise<RuntimeUpdateDescriptor | null> | null = null;
  private installPromise: Promise<string> | null = null;
  private progressKey: string | null = null;

  constructor(private readonly deps: RuntimeUpdateManagerDeps) {}

  get state(): RuntimeUpdateState {
    return this.stateValue;
  }

  onStateChange(listener: RuntimeUpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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

  install(signal?: AbortSignal): Promise<string> {
    if (this.installPromise) return this.installPromise;
    const operation = this.installInternal(signal).finally(() => {
      if (this.installPromise === operation) this.installPromise = null;
    });
    this.installPromise = operation;
    return operation;
  }

  private async checkInternal(repair = false): Promise<RuntimeUpdateDescriptor | null> {
    this.emit({ status: "checking" });
    try {
      const descriptor = await this.deps.client.fetchLatest(this.deps.pluginVersion);
      this.checked = true;
      const installedVersion = this.deps.getInstalledVersion();
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
      if (installedVersion && compareRuntimeVersions(installedVersion, descriptor.version) >= 0) {
        this.emit({ status: "current", installedVersion, checkedAt: (this.deps.now ?? Date.now)() });
        return null;
      }
      this.emit({ status: "available", descriptor, installedVersion, kind: installedVersion ? "update" : "install" });
      return descriptor;
    } catch (error) {
      this.emit({ status: "error", message: errorMessage(error) });
      throw error;
    }
  }

  private async installInternal(signal?: AbortSignal): Promise<string> {
    if (!this.deps.enabled) throw new Error("Runtime installation is available only in release builds");
    if (this.deps.hasActiveWork()) throw new Error("Finish the current Chatobby response before updating the runtime");
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
    try {
      staged = await this.deps.client.stage(
        descriptor,
        this.deps.pluginVersion,
        signal,
        (progress) => this.handleProgress(descriptor, installedVersion, kind, progress),
      );
      this.emitInstall(descriptor, installedVersion, kind, "installing", 0, 1);
      await this.deps.stopRuntime();
      stopped = true;
      installation = await this.deps.installer.prepareInstall(staged.directory, staged.manifest, this.deps.pluginVersion);
      this.emitInstall(descriptor, installedVersion, kind, "reconnecting", 1, 1);
      await this.deps.startRuntime();
      stopped = false;
      await installation.commit();
      this.checked = true;
      this.emit({ status: "current", installedVersion: descriptor.version, checkedAt: (this.deps.now ?? Date.now)() });
      return descriptor.version;
    } catch (error) {
      let recoveryError: unknown = null;
      if (installation) {
        try {
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
      const failure = recoveryError
        ? new Error(`${errorMessage(error)} Automatic rollback could not restore Chatobby: ${errorMessage(recoveryError)}`)
        : error;
      if (failure instanceof Error && failure.name === "AbortError") {
        this.emit({ status: "available", descriptor, installedVersion, kind });
      } else {
        this.emit({ status: "error", message: errorMessage(failure), descriptor, kind });
      }
      throw failure;
    } finally {
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
    return this.stateValue.status === "available" ? this.stateValue : null;
  }

  private availableDescriptor(): RuntimeUpdateDescriptor | null {
    if (this.stateValue.status === "available" || this.stateValue.status === "installing") {
      return this.stateValue.descriptor;
    }
    if (this.stateValue.status === "error" && this.stateValue.descriptor) return this.stateValue.descriptor;
    return null;
  }

  private emit(state: RuntimeUpdateState): void {
    this.stateValue = state;
    for (const listener of this.listeners) listener(state);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
