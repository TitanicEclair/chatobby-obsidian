import type { ConnectorBuildMode } from "../infrastructure/runtime-installation";
import type { RuntimeProvisionResult } from "./runtime-update-manager";

declare const __CHATOBBY_AUTOMATIC_RUNTIME_PROVISIONING__: boolean;

export interface RuntimeBootstrapCoordinatorDeps {
  enabled: boolean;
  hasInstalledRuntime(): boolean;
  shouldStartRuntime(): boolean;
  reattachCompatibleRuntime(): Promise<void>;
  ensureRequiredRuntime(signal?: AbortSignal): Promise<RuntimeProvisionResult>;
  stopProvisionedRuntime(): Promise<void>;
  reportFailure(error: unknown): void;
  retryDelayMs?: number;
  schedule?: (operation: () => void, delayMs: number) => number;
  cancelScheduled?: (handle: number) => void;
}

/**
 * Own the one release-runtime provisioning operation shared by every view.
 *
 * A compatible installed runtime is reattached before replacement. The update
 * manager retains signed-package and rollback authority; this coordinator only
 * sequences startup, automatic provisioning, retry, and disposal.
 */
export class RuntimeBootstrapCoordinator {
  private inFlight: Promise<void> | null = null;
  private retryTimer: number | null = null;
  private abortController: AbortController | null = null;
  private disposed = false;

  constructor(private readonly deps: RuntimeBootstrapCoordinatorDeps) {}

  start(): Promise<void> {
    if (!this.deps.enabled || this.disposed) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.cancelRetry();
    const operation = this.run().finally(() => {
      if (this.inFlight === operation) this.inFlight = null;
    });
    this.inFlight = operation;
    return operation;
  }

  async retry(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const previous = this.inFlight;
    this.abortController?.abort();
    this.abortController = null;
    await previous?.catch(() => undefined);
    return this.start();
  }

  dispose(): void {
    this.disposed = true;
    this.abortController?.abort();
    this.abortController = null;
    this.cancelRetry();
  }

  private async run(): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    try {
      const shouldStartRuntime = this.deps.shouldStartRuntime();
      if (shouldStartRuntime && this.deps.hasInstalledRuntime()) {
        await this.deps.reattachCompatibleRuntime().catch((error) => {
          if (!signal.aborted) this.deps.reportFailure(error);
        });
      }
      if (signal.aborted || this.disposed) return;
      const result = await this.deps.ensureRequiredRuntime(signal);
      if (result === "deferred" && !this.disposed) this.scheduleRetry();
      if (result === "installed" && !shouldStartRuntime && !signal.aborted && !this.disposed) {
        await this.deps.stopProvisionedRuntime();
      }
    } catch (error) {
      if (!signal.aborted && !this.disposed) this.deps.reportFailure(error);
    } finally {
      if (this.abortController?.signal === signal) this.abortController = null;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) return;
    const schedule = this.deps.schedule ?? ((operation, delayMs) => window.setTimeout(operation, delayMs));
    this.retryTimer = schedule(() => {
      this.retryTimer = null;
      void this.start();
    }, this.deps.retryDelayMs ?? 1_000);
  }

  private cancelRetry(): void {
    if (this.retryTimer === null) return;
    const cancel = this.deps.cancelScheduled ?? ((handle) => window.clearTimeout(handle));
    cancel(this.retryTimer);
    this.retryTimer = null;
  }
}

/** Keep public/release behavior disabled until the explicit review boundary is approved. */
export function automaticRuntimeProvisioningEnabled(buildMode: ConnectorBuildMode): boolean {
  return buildMode === "release"
    && typeof __CHATOBBY_AUTOMATIC_RUNTIME_PROVISIONING__ !== "undefined"
    && __CHATOBBY_AUTOMATIC_RUNTIME_PROVISIONING__ === true;
}
