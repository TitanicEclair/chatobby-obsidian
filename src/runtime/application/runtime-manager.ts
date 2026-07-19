import { createHash, randomUUID } from "node:crypto";
import type { ChatobbyVaultRuntimePaths } from "../../vault-runtime";
import type {
  EnsureRuntimeRequest,
  ManagedProcessHandle,
  ManagedRuntimeLaunch,
  PreparedRuntimeLease,
  ReadyRuntime,
  RuntimeActionReason,
  RuntimeConfiguration,
  RuntimeDetachReason,
  RuntimeDiagnostics,
  RuntimeFailureCode,
  RuntimeLeaseCandidate,
  RuntimeLifecycleState,
  RuntimeMode,
  RuntimeReadyDescriptor,
} from "../contracts";
import type { ChatobbyRuntimeManager } from "../public";
import {
  NodeManagedProcessLauncher,
  type ManagedProcessLauncher,
} from "../infrastructure/managed-process";
import {
  RuntimeControlClient,
  type RuntimeControlDescriptor,
} from "../infrastructure/runtime-control-client";
import {
  deriveRuntimeVaultId,
  type LegacyRuntimeShutdownTarget,
  RuntimeLeaseStore,
} from "../infrastructure/runtime-lease-store";
import { RuntimeRestartPolicy } from "./restart-policy";

const STARTUP_TIMEOUT_MS = 20_000;
const AUTHENTICATION_TIMEOUT_MS = 15_000;
const DESCRIPTOR_POLL_MS = 100;
const SHUTDOWN_WAIT_MS = 5_000;

export interface ManagedCommand {
  command: string;
  args: string[];
  runtimePackageFingerprint?: string;
}

export interface RuntimeManagerDeps {
  getConfiguration(): RuntimeConfiguration;
  getVaultPaths(): ChatobbyVaultRuntimePaths | null;
  resolveManagedCommand(): ManagedCommand | null;
  connectRuntime(runtime: ReadyRuntime): Promise<void>;
  disconnectRuntime(): Promise<void>;
  pluginVersion: string;
  runtimePublicKey?: string | null;
  leaseStore?: RuntimeLeaseStoreLike;
  controlClient?: RuntimeControlClientLike;
  processLauncher?: ManagedProcessLauncher;
  startupTimeoutMs?: number;
  descriptorPollMs?: number;
  authenticationTimeoutMs?: number;
  isProcessAlive?: (pid: number) => boolean;
}

export interface RuntimeLeaseStoreLike {
  readCandidate(vaultId: string): Promise<RuntimeLeaseCandidate | null>;
  readLegacyShutdownTarget?(vaultId: string): Promise<LegacyRuntimeShutdownTarget | null>;
  prepare(vaultId: string): Promise<PreparedRuntimeLease>;
  discardStaleDescriptor(vaultId: string): Promise<void>;
}

export interface RuntimeControlClientLike {
  status(descriptor: RuntimeReadyDescriptor, controlToken: string): Promise<unknown>;
  detach(descriptor: RuntimeReadyDescriptor, controlToken: string, attachmentId: string): Promise<void>;
  shutdown(descriptor: RuntimeControlDescriptor, controlToken: string): Promise<void>;
}

type RuntimeStateListener = (state: RuntimeLifecycleState) => void;

/** Resolve, authenticate, launch, supervise, and stop the vault runtime. */
export class DefaultChatobbyRuntimeManager implements ChatobbyRuntimeManager {
  private readonly deps: RuntimeManagerDeps;
  private readonly leases: RuntimeLeaseStoreLike;
  private readonly control: RuntimeControlClientLike;
  private readonly processes: ManagedProcessLauncher;
  private readonly isProcessAlive: (pid: number) => boolean;
  private readonly restartPolicy = new RuntimeRestartPolicy();
  private readonly attachmentId = randomUUID();
  private readonly listeners = new Set<RuntimeStateListener>();
  private stateValue: RuntimeLifecycleState;
  private ensurePromise: Promise<ReadyRuntime> | null = null;
  private processHandle: ManagedProcessHandle | null = null;
  private candidate: RuntimeLeaseCandidate | null = null;
  private readyRuntime: ReadyRuntime | null = null;
  private desiredRunning = false;
  private generation = 0;
  private launchAttempt = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private stabilityTimer: ReturnType<typeof setTimeout> | null = null;
  private recoveryPromise: Promise<void> | null = null;

  constructor(deps: RuntimeManagerDeps) {
    this.deps = deps;
    this.leases = deps.leaseStore ?? new RuntimeLeaseStore();
    this.control = deps.controlClient ?? new RuntimeControlClient();
    this.processes = deps.processLauncher ?? new NodeManagedProcessLauncher();
    this.isProcessAlive = deps.isProcessAlive ?? processIsAlive;
    this.stateValue = { status: "idle", mode: deps.getConfiguration().mode };
  }

  get state(): RuntimeLifecycleState {
    return this.stateValue;
  }

  onStateChange(listener: RuntimeStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ensureReady(request: EnsureRuntimeRequest): Promise<ReadyRuntime> {
    const mode = this.deps.getConfiguration().mode;
    if (this.readyRuntime?.ownership === mode && this.stateValue.status === "ready") {
      return Promise.resolve(this.readyRuntime);
    }
    if (this.ensurePromise) return this.ensurePromise;
    this.desiredRunning = true;
    const generation = this.generation;
    const attempt = this.ensureReadyInternal(mode, request.reason, generation);
    this.ensurePromise = attempt;
    void attempt.finally(() => {
      if (this.ensurePromise === attempt) this.ensurePromise = null;
    }).catch(() => {});
    return attempt;
  }

  async restart(_reason: RuntimeActionReason): Promise<ReadyRuntime> {
    this.restartPolicy.reset();
    this.launchAttempt = 0;
    await this.stop("manual-restart");
    this.desiredRunning = true;
    return this.ensureReady({ reason: "manual-restart" });
  }

  reportConnectionFailure(message: string): Promise<void> {
    if (this.recoveryPromise) return this.recoveryPromise;
    const runtime = this.readyRuntime;
    const candidate = this.candidate;
    if (!this.desiredRunning || !runtime || !candidate || runtime.ownership === "external") {
      return Promise.resolve();
    }
    const recovery = this.recoverUnavailableRuntime(runtime, candidate, message).finally(() => {
      if (this.recoveryPromise === recovery) this.recoveryPromise = null;
    });
    this.recoveryPromise = recovery;
    return recovery;
  }

  async stop(_reason: RuntimeActionReason): Promise<void> {
    const mode = this.deps.getConfiguration().mode;
    this.desiredRunning = false;
    this.generation += 1;
    this.cancelTimers();
    this.emit({ status: "stopping", mode });
    await this.deps.disconnectRuntime().catch(() => {});

    const candidate = this.candidate;
    const processHandle = this.processHandle;
    this.readyRuntime = null;
    this.candidate = null;
    this.processHandle = null;
    if (mode !== "external" && candidate) {
      await this.control.shutdown(candidate.descriptor, candidate.controlToken).catch(() => {});
    }
    if (processHandle) {
      const exited = await Promise.race([
        processHandle.exited.then(() => true),
        delay(SHUTDOWN_WAIT_MS).then(() => false),
      ]);
      if (!exited) await processHandle.terminate();
    }
    this.emit({ status: "idle", mode });
  }

  async detach(_reason: RuntimeDetachReason): Promise<void> {
    const configuration = this.deps.getConfiguration();
    const mode = configuration.mode;
    this.desiredRunning = false;
    this.generation += 1;
    this.cancelTimers();
    const keepBackgroundRuntime = mode === "managed" && configuration.lifetime === "background";
    if (mode !== "external" && !keepBackgroundRuntime && this.candidate) {
      // Ask the runtime to enter its reattach grace period before closing the
      // current socket. A replacement plugin instance can then attach after
      // this request and cancel shutdown; reversing this order lets a late
      // unload request terminate a freshly reattached runtime.
      await this.control.detach(
        this.candidate.descriptor,
        this.candidate.controlToken,
        this.attachmentId,
      ).catch(() => {});
    }
    await this.deps.disconnectRuntime().catch(() => {});
    this.readyRuntime = null;
    this.candidate = null;
    this.processHandle = null;
    this.emit({ status: "detached", mode });
  }

  private async ensureReadyInternal(
    mode: RuntimeMode,
    reason: RuntimeActionReason,
    generation: number,
  ): Promise<ReadyRuntime> {
    this.emit({ status: "resolving", mode });
    try {
      if (mode === "external") return await this.connectExternal(generation);
      return await this.resolveOrLaunch(mode, generation);
    } catch (error) {
      const failure = error instanceof RuntimeStartError
        ? error
        : new RuntimeStartError("connection_failed", errorMessage(error));
      const diagnostics = this.diagnostics(failure.code, failure.message);
      if (this.processHandle) {
        const handle = this.processHandle;
        this.processHandle = null;
        await handle.terminate().catch(() => {});
      }
      if (generation !== this.generation || !this.desiredRunning) throw error;
      if (mode === "external") {
        this.emit({ status: "error", mode, diagnostics });
        throw failure;
      }
      if (failure.code === "runtime_not_installed" || failure.code === "runtime_package_invalid") {
        this.emit({ status: "error", mode, diagnostics });
        throw failure;
      }
      const decision = this.restartPolicy.recordFailure();
      if (decision.crashLoop) {
        this.emit({ status: "crash_loop", mode, diagnostics });
      } else {
        const retryAt = Date.now() + decision.delayMs!;
        this.emit({ status: "error", mode, diagnostics, retryAt });
        this.scheduleRestart(decision.delayMs!, reason);
      }
      throw failure;
    }
  }

  private async connectExternal(generation: number): Promise<ReadyRuntime> {
    const url = normalizeWsUrl(this.deps.getConfiguration().externalUrl);
    const identity = {
      instanceId: `external-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`,
      vaultId: "external",
      pid: 0,
      startedAt: 0,
      runtimeVersion: "external",
      protocolVersion: 0,
      runtimePackageFingerprint: null,
    };
    const runtime: ReadyRuntime = { identity, endpoint: url, ownership: "external" };
    this.assertCurrent(generation);
    this.emit({ status: "authenticating", mode: "external", endpoint: url });
    await this.deps.connectRuntime(runtime);
    this.assertCurrent(generation);
    return this.acceptReady(runtime, null, null);
  }

  private async resolveOrLaunch(
    mode: "managed" | "developer",
    generation: number,
  ): Promise<ReadyRuntime> {
    const vaultPaths = this.deps.getVaultPaths();
    if (!vaultPaths) throw new RuntimeStartError("configuration_invalid", "Chatobby requires a filesystem-backed vault");
    const vaultId = deriveRuntimeVaultId(vaultPaths.vaultRoot);
    let managedCommand: ManagedCommand | null = null;
    if (mode === "managed") {
      try {
        managedCommand = this.deps.resolveManagedCommand();
      } catch (error) {
        throw new RuntimeStartError("runtime_package_invalid", errorMessage(error));
      }
    }
    if (mode === "managed" && !managedCommand) {
      throw new RuntimeStartError("runtime_not_installed", "The Chatobby runtime is not installed");
    }
    const expectedFingerprint = managedCommand?.runtimePackageFingerprint;
    const existing = await this.leases.readCandidate(vaultId);
    if (existing) {
      if (expectedFingerprint && existing.descriptor.runtimePackageFingerprint !== expectedFingerprint) {
        await this.control.shutdown(existing.descriptor, existing.controlToken).catch(() => {});
        await this.leases.discardStaleDescriptor(vaultId);
      } else {
        let controlError: unknown = null;
        try {
          await this.control.status(existing.descriptor, existing.controlToken);
        } catch (error) {
          controlError = error;
        }
        if (controlError === null) {
          return await this.authenticateCandidate(existing, mode, generation, null);
        }
        if (this.isProcessAlive(existing.descriptor.pid)) {
          try {
            return await this.authenticateCandidate(existing, mode, generation, null);
          } catch (connectionError) {
            throw new RuntimeStartError(
              classifyConnectionFailure(connectionError),
              `The existing Chatobby runtime is still running but did not reconnect: ${errorMessage(connectionError)}. `
                + `The control probe also failed: ${errorMessage(controlError)}`,
            );
          }
        }
        await this.leases.discardStaleDescriptor(vaultId);
      }
    }
    if (!existing && expectedFingerprint && this.leases.readLegacyShutdownTarget) {
      const legacy = await this.leases.readLegacyShutdownTarget(vaultId);
      if (legacy) {
        await this.control.shutdown(legacy.descriptor, legacy.controlToken).catch(() => {});
        await this.leases.discardStaleDescriptor(vaultId);
      }
    }

    this.assertCurrent(generation);
    const prepared = await this.leases.prepare(vaultId);
    const launch = this.buildLaunch(mode, prepared, vaultPaths, managedCommand);
    this.launchAttempt += 1;
    this.emit({ status: "spawning", mode, attempt: this.launchAttempt });
    let handle: ManagedProcessHandle;
    try {
      handle = await this.processes.spawn(launch);
    } catch (error) {
      throw new RuntimeStartError("spawn_failed", errorMessage(error));
    }
    this.processHandle = handle;
    const candidate = await this.waitForCandidate(prepared, handle, generation);
    await this.control.status(candidate.descriptor, candidate.controlToken).catch((error) => {
      throw new RuntimeStartError("authentication_failed", errorMessage(error));
    });
    return this.authenticateCandidate(candidate, mode, generation, handle);
  }

  private async authenticateCandidate(
    candidate: RuntimeLeaseCandidate,
    mode: "managed" | "developer",
    generation: number,
    handle: ManagedProcessHandle | null,
  ): Promise<ReadyRuntime> {
    const endpoint = `ws://127.0.0.1:${candidate.descriptor.port}`;
    const runtime: ReadyRuntime = {
      identity: candidate.descriptor,
      endpoint,
      ownership: mode,
      session: {
        protocolVersion: candidate.descriptor.protocolVersion,
        pluginVersion: this.deps.pluginVersion,
        attachmentId: this.attachmentId,
        instanceId: candidate.descriptor.instanceId,
        vaultId: candidate.descriptor.vaultId,
        sessionToken: candidate.sessionToken,
      },
    };
    this.assertCurrent(generation);
    this.emit({ status: "authenticating", mode, endpoint });
    try {
      await promiseWithTimeout(
        this.deps.connectRuntime(runtime),
        this.deps.authenticationTimeoutMs ?? AUTHENTICATION_TIMEOUT_MS,
        "Chatobby runtime authentication timed out",
      );
    } catch (error) {
      throw new RuntimeStartError(classifyConnectionFailure(error), errorMessage(error));
    }
    this.assertCurrent(generation);
    return this.acceptReady(runtime, candidate, handle);
  }

  private acceptReady(
    runtime: ReadyRuntime,
    candidate: RuntimeLeaseCandidate | null,
    handle: ManagedProcessHandle | null,
  ): ReadyRuntime {
    this.readyRuntime = runtime;
    this.candidate = candidate;
    this.processHandle = handle;
    if (handle && runtime.ownership !== "external") this.watchProcess(handle, runtime.ownership);
    this.emit({ status: "ready", runtime, readyAt: Date.now() });
    this.cancelStabilityTimer();
    this.stabilityTimer = setTimeout(() => {
      this.stabilityTimer = null;
      this.restartPolicy.reset();
      this.launchAttempt = 0;
    }, this.restartPolicy.stabilityResetMs);
    return runtime;
  }

  private async waitForCandidate(
    prepared: PreparedRuntimeLease,
    handle: ManagedProcessHandle,
    generation: number,
  ): Promise<RuntimeLeaseCandidate> {
    const timeoutMs = this.deps.startupTimeoutMs ?? STARTUP_TIMEOUT_MS;
    const pollMs = this.deps.descriptorPollMs ?? DESCRIPTOR_POLL_MS;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      this.assertCurrent(generation);
      const candidate = await this.leases.readCandidate(prepared.vaultId);
      if (candidate) {
        if (candidate.descriptor.instanceId !== prepared.instanceId) {
          throw new RuntimeStartError("identity_mismatch", "Ready descriptor belongs to another runtime instance");
        }
        return candidate;
      }
      const outcome = await Promise.race([
        delay(pollMs).then(() => "poll" as const),
        handle.exited.then(() => "exit" as const),
      ]);
      if (outcome === "exit") {
        throw new RuntimeStartError("runtime_exited", "Chatobby runtime exited before becoming ready");
      }
    }
    throw new RuntimeStartError("startup_timeout", `Chatobby runtime did not become ready within ${timeoutMs}ms`);
  }

  private buildLaunch(
    mode: "managed" | "developer",
    lease: PreparedRuntimeLease,
    vaultPaths: ChatobbyVaultRuntimePaths,
    managedCommand: ManagedCommand | null,
  ): ManagedRuntimeLaunch {
    const configuration = this.deps.getConfiguration();
    const detached = mode === "managed" && configuration.lifetime === "background";
    const command = mode === "managed"
      ? managedCommand ?? this.deps.resolveManagedCommand()
      : { command: configuration.developerCommand, args: [...configuration.developerArgs] };
    if (!command) throw new RuntimeStartError("runtime_not_installed", "The Chatobby runtime is not installed");
    if (!command.command.trim()) {
      throw new RuntimeStartError("configuration_invalid", "Chatobby runtime command is empty");
    }
    assertNoReservedLifecycleArgs(command.args);
    const lifecycleArgs = detached ? [] : ["--parent-pid", String(process.pid)];
    return {
      command: command.command,
      args: [
        ...command.args,
        "serve",
        "--host", "127.0.0.1",
        "--port", "0",
        "--cwd", vaultPaths.vaultRoot,
        "--agent-dir", vaultPaths.agentDir,
        "--attachment-dir", vaultPaths.attachmentDir,
        "--vault-id", lease.vaultId,
        "--instance-id", lease.instanceId,
        "--ready-file", lease.paths.descriptorFile,
        "--control-token-file", lease.paths.controlTokenFile,
        "--session-token-file", lease.paths.sessionTokenFile,
        ...lifecycleArgs,
      ],
      env: {
        PI_CODING_AGENT_DIR: vaultPaths.agentDir,
        CHATOBBY_VAULT_ROOT: vaultPaths.vaultRoot,
        CHATOBBY_ATTACHMENT_DIR: vaultPaths.attachmentDir,
        CHATOBBY_RUNTIME_LOG_FILE: lease.paths.logFile,
        ...(configuration.shellCommand ? { CHATOBBY_SHELL: configuration.shellCommand } : {}),
        ...(mode === "managed" && this.deps.runtimePublicKey?.trim()
          ? { CHATOBBY_RUNTIME_PUBLIC_KEY: this.deps.runtimePublicKey.trim() }
          : {}),
      },
      cwd: vaultPaths.vaultRoot,
      instanceId: lease.instanceId,
      detached,
    };
  }

  private watchProcess(handle: ManagedProcessHandle, mode: "managed" | "developer"): void {
    void handle.exited.then((exit) => {
      if (this.processHandle !== handle || exit.expected) return;
      this.processHandle = null;
      this.readyRuntime = null;
      this.candidate = null;
      if (!this.desiredRunning) return;
      const diagnostics = this.diagnostics(
        "runtime_exited",
        `Chatobby runtime exited unexpectedly${exit.code === null ? "" : ` with code ${exit.code}`}`,
        handle,
      );
      const decision = this.restartPolicy.recordFailure();
      if (decision.crashLoop) {
        this.emit({ status: "crash_loop", mode, diagnostics });
        return;
      }
      const retryAt = Date.now() + decision.delayMs!;
      this.emit({ status: "error", mode, diagnostics, retryAt });
      this.scheduleRestart(decision.delayMs!, "automatic-restart");
    });
  }

  private async recoverUnavailableRuntime(
    runtime: ReadyRuntime,
    candidate: RuntimeLeaseCandidate,
    message: string,
  ): Promise<void> {
    try {
      await this.control.status(candidate.descriptor, candidate.controlToken);
      return;
    } catch {
      // A live runtime will be reconnected by the transport. Only replace a
      // descriptor after the authenticated control probe also fails.
    }
    if (this.readyRuntime !== runtime || this.candidate !== candidate || !this.desiredRunning) return;
    const mode = runtime.ownership;
    if (mode === "external") return;
    this.generation += 1;
    this.cancelTimers();
    const handle = this.processHandle;
    this.readyRuntime = null;
    this.candidate = null;
    this.processHandle = null;
    await this.deps.disconnectRuntime().catch(() => {});
    await this.leases.discardStaleDescriptor(candidate.descriptor.vaultId).catch(() => {});
    await handle?.terminate().catch(() => {});
    if (!this.desiredRunning) return;
    const diagnostics = this.diagnostics(
      "connection_failed",
      `Chatobby runtime became unreachable: ${message}`,
      handle,
    );
    this.emit({ status: "error", mode, diagnostics, retryAt: Date.now() });
    this.scheduleRestart(0, "automatic-restart");
  }

  private scheduleRestart(delayMs: number, _reason: RuntimeActionReason): void {
    if (this.restartTimer || !this.desiredRunning) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.desiredRunning || this.ensurePromise) return;
      void this.ensureReady({ reason: "automatic-restart" }).catch(() => {});
    }, delayMs);
  }

  private diagnostics(
    code: RuntimeFailureCode,
    message: string,
    handle = this.processHandle,
  ): RuntimeDiagnostics {
    return { code, message, recentLogs: handle?.recentLogs() ?? [], occurredAt: Date.now() };
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation || !this.desiredRunning) {
      throw new RuntimeStartError("connection_failed", "Chatobby runtime startup was cancelled");
    }
  }

  private emit(state: RuntimeLifecycleState): void {
    this.stateValue = state;
    for (const listener of this.listeners) listener(state);
  }

  private cancelTimers(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.cancelStabilityTimer();
  }

  private cancelStabilityTimer(): void {
    if (this.stabilityTimer) clearTimeout(this.stabilityTimer);
    this.stabilityTimer = null;
  }
}

class RuntimeStartError extends Error {
  readonly code: RuntimeFailureCode;

  constructor(code: RuntimeFailureCode, message: string) {
    super(message);
    this.name = "RuntimeStartError";
    this.code = code;
  }
}

function normalizeWsUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") throw new Error("unsupported protocol");
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new RuntimeStartError("configuration_invalid", "External runtime URL must be a valid ws:// or wss:// URL");
  }
}

function assertNoReservedLifecycleArgs(args: readonly string[]): void {
  const reserved = new Set([
    "--host",
    "--port",
    "--cwd",
    "--agent-dir",
    "--attachment-dir",
    "--vault-id",
    "--instance-id",
    "--ready-file",
    "--control-token-file",
    "--session-token-file",
    "--parent-pid",
  ]);
  const conflict = args.find((arg) => reserved.has(arg.split("=", 1)[0]!));
  if (conflict) {
    throw new RuntimeStartError("configuration_invalid", `Developer arguments cannot override managed lifecycle option ${conflict}`);
  }
}

function classifyConnectionFailure(error: unknown): RuntimeFailureCode {
  const message = errorMessage(error).toLowerCase();
  if (message.includes("authentication")) return "authentication_failed";
  if (message.includes("protocol") || message.includes("version")) return "protocol_incompatible";
  if (message.includes("identity")) return "identity_mismatch";
  return "connection_failed";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
