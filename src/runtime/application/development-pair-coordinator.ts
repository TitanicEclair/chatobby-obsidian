import { createHash, randomUUID } from "node:crypto";
import { CHATOBBY_NATIVE_SANDBOX_ENABLED } from "../../vendor/chatobby-client/control/product.generated";
import { copyFile, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fingerprintRuntimeBundle, isRuntimeAssetDirectory, isRuntimeAssetPath, parseRuntimeAssetInventory, RUNTIME_MAX_ASSET_FILES, WINDOWS_SANDBOX_HELPER_ENTRY, type RuntimeAssetFile } from "../../vendor/chatobby-client/runtime-assets";
import type { ChatobbyRuntimeManager, ReadyRuntime } from "../public";
import type { ManagedCommand } from "./runtime-manager";
import type { DevelopmentPairActivationProof } from "./development-pair-bootstrap";

interface DevelopmentPairReceipt {
  schemaVersion: 1 | 2 | 3;
  pairId: string;
  state: "pending" | "current";
  action: "reuse-pair" | "connector-only" | "runtime-only" | "paired-contract";
  createdAt: string;
  source: DevelopmentPairRepositoryIdentity;
  connector: DevelopmentPairRepositoryIdentity;
  protocol: { runtime: number; frontend: number; projectionSha256: string };
  runtime: { version: string; path: string; sha256: string; developmentBuildFingerprint: string; assets?: RuntimeAssetFile[] };
  connectorArtifacts: Array<{ file: "main.js" | "manifest.json" | "styles.css"; size: number; sha256: string }>;
  vault: { root: string; markerSha256: string };
  timingsMs: Record<string, number>;
  observations: string[];
  activation?: DevelopmentPairActivationProof;
  /** Connector-owned location only; absent means the historical Vault cache. */
  runtimeCacheLocation?: "external-v1";
  [key: string]: unknown;
}

interface DevelopmentPairRepositoryIdentity {
  revision: string;
  dirty: boolean;
  contentFingerprint: string;
}

export interface DevelopmentPairCoordinatorDeps {
  enabled: boolean;
  vaultRoot: string;
  configDir: string;
  pluginRoot: string;
  /** Canonical external device-local path role; never read from a receipt. */
  externalRuntimeCacheRoot: string;
  runtime: ChatobbyRuntimeManager;
  protocolVersion: number;
  frontendProtocolVersion: number;
  verifyFrontendBootstrap(
    runtime: ReadyRuntime,
    pairId: string,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<DevelopmentPairActivationProof>;
  bootstrapTimeoutMs?: number;
}

export type DevelopmentPairAdoption = "none" | "activated" | "deferred";

const DEFAULT_FRONTEND_BOOTSTRAP_TIMEOUT_MS = 20_000;

/** Adopt only the exact prebuilt pair staged by @chatobby/devops. */
export class DevelopmentPairCoordinator {
  private readonly receiptDirectory: string;
  private readonly externalRuntimeCacheRoot: string;

  constructor(private readonly deps: DevelopmentPairCoordinatorDeps) {
    this.receiptDirectory = join(deps.vaultRoot, deps.configDir, ".chatobby-dev", "development-pair");
    if (!isAbsolute(deps.externalRuntimeCacheRoot)) throw new Error("Development runtime cache root must be absolute");
    this.externalRuntimeCacheRoot = resolve(deps.externalRuntimeCacheRoot);
  }

  async adoptPending(): Promise<DevelopmentPairAdoption> {
    if (!this.deps.enabled) return "none";
    const pendingPath = join(this.receiptDirectory, "pending.json");
    const pending = await readReceipt(pendingPath, "pending");
    const previous = await readReceipt(join(this.receiptDirectory, "current.json"), "current");
    if (!pending) {
      await this.configureCurrentRuntime(previous);
      return "none";
    }
    let existing: ReadyRuntime | null = null;
    let replacementAttempted = false;
    let bootstrapStarted = false;
    let activation: DevelopmentPairActivationProof;
    const timeoutMs = this.deps.bootstrapTimeoutMs ?? DEFAULT_FRONTEND_BOOTSTRAP_TIMEOUT_MS;
    try {
      const pendingAssets = parseRuntimeAssetInventory(pending.runtime.assets);
      if (pendingAssets.some((asset) => asset.path === WINDOWS_SANDBOX_HELPER_ENTRY)) {
        // Historical Host-only state is readable, never a newly admitted bundle.
        parseRuntimeAssetInventory(pendingAssets, { requireWindowsSandboxHelper: true });
      }
      await this.verifyReceipt(pending, pending.runtime.path);
      if (CHATOBBY_NATIVE_SANDBOX_ENABLED && previous?.schemaVersion === 3 && parseRuntimeAssetInventory(previous.runtime.assets)
        .some((asset) => asset.path === WINDOWS_SANDBOX_HELPER_ENTRY)) {
        // Historical base-only receipts remain readable, but a current native
        // closure cannot silently disappear from a replacement candidate.
        parseRuntimeAssetInventory(pending.runtime.assets, { requireWindowsSandboxHelper: true });
      }
      const pendingRuntimeCommand = await this.materializeRuntime(pending);
      // A persisted lease can outlive its process. Only an authenticated live
      // runtime is part of the recoverable pre-adoption state; normal startup
      // handles an unreachable candidate as stale.
      existing = await this.deps.runtime.reattachExistingForMaintenance().catch(() => null);
      const needsReplacement = existing?.identity.developmentBuildFingerprint
        !== pending.runtime.developmentBuildFingerprint
        || previous?.schemaVersion !== 3
        || previous.activation?.runtimeInstanceId !== existing?.identity.instanceId
        || this.cachedRuntimePath(previous) !== pendingRuntimeCommand.command;
      if (needsReplacement) {
        const operationId = `development-reconcile-${pending.pairId.slice(0, 24)}`;
        const admission = await this.deps.runtime.admitMaintenance(operationId, "development-reconcile", {
          runtimeVersion: pending.runtime.version,
          runtimePackageFingerprint: null,
          developmentBuildFingerprint: pending.runtime.developmentBuildFingerprint,
        });
        if (admission?.status === "deferred") {
          await this.writeResult(pending.pairId, "deferred", admission.activeWorkKinds.join(", "));
          return "deferred";
        }
        if (existing && !admission) throw new Error("Existing development runtime did not admit bundle replacement");
        replacementAttempted = true;
        if (admission) {
          await this.deps.runtime.commitMaintenance(operationId, admission.leaseId);
        }
      }
      if (pending.schemaVersion === 3) await verifyRuntimeBundle(pendingRuntimeCommand.command, pending, true);
      const runtime = await this.deps.runtime.ensureReady(
        { reason: "manual-restart" },
        pendingRuntimeCommand,
      );
      if (
        runtime.identity.developmentBuildFingerprint !== pending.runtime.developmentBuildFingerprint
        || runtime.identity.runtimePackageFingerprint !== null
        || runtime.identity.runtimeVersion !== pending.runtime.version
        || runtime.identity.protocolVersion !== pending.protocol.runtime
      ) {
        throw new Error("Reconnected development runtime identity does not match the pending pair");
      }
      bootstrapStarted = true;
      activation = await withBootstrapTimeout(
        timeoutMs,
        (signal) => this.deps.verifyFrontendBootstrap(runtime, pending.pairId, timeoutMs, signal),
      );
      assertActivationProof(activation, pending, runtime, timeoutMs);
      await this.verifyReceipt(pending, pendingRuntimeCommand.command);
      const currentPath = join(this.receiptDirectory, "current.json");
      await atomicWriteJson(currentPath, { ...pending, state: "current", activation, runtimeCacheLocation: "external-v1" });
      this.deps.runtime.setDevelopmentCommandOverride(pendingRuntimeCommand);
    } catch (error) {
      let rollback: DevelopmentPairRollbackResult | undefined;
      let rollbackError: unknown = null;
      if (replacementAttempted) {
        try {
          rollback = await this.restorePreAdoptionState(previous, existing);
        } catch (restoreError) {
          rollbackError = restoreError;
          rollback = { status: "failed", detail: errorMessage(restoreError) };
        }
      }
      await rm(pendingPath, { force: true });
      await this.writeResult(pending.pairId, "failed", {
        code: rollbackError
          ? "rollback-failed"
          : error instanceof DevelopmentPairBootstrapTimeoutError
            ? "frontend-bootstrap-timeout"
            : bootstrapStarted
              ? "frontend-bootstrap-failed"
              : "adoption-failed",
        detail: rollbackError
          ? `${errorMessage(error)} Development pair rollback also failed: ${errorMessage(rollbackError)}`
          : errorMessage(error),
        timeoutMs,
        ...(rollback ? { rollback } : {}),
      });
      if (rollbackError) {
        throw new Error(`${errorMessage(error)} Development pair rollback also failed: ${errorMessage(rollbackError)}`);
      }
      throw error;
    }
    await rm(pendingPath, { force: true });
    await this.writeResult(pending.pairId, "activated", { activation, timeoutMs });
    return "activated";
  }

  private async restorePreAdoptionState(
    previous: DevelopmentPairReceipt | null,
    existing: ReadyRuntime | null,
  ): Promise<DevelopmentPairRollbackResult> {
    await this.deps.runtime.stop("user-action");
    if (!existing) {
      return {
        status: "restored-stopped-state",
        detail: "No authenticated pre-adoption runtime was running",
      };
    }
    if (
      previous
      && existing.identity.developmentBuildFingerprint === previous.runtime.developmentBuildFingerprint
    ) {
      const restored = await this.restorePreviousRuntime(previous);
      return restored
        ? { status: "restored-previous-pair" }
        : {
            status: "restored-stopped-state",
            detail: "Previous connector artifacts are not installed as the exact receipted pair",
          };
    }
    // The pending connector bytes are already loaded. Do not reconnect an
    // unreceipted configured runtime and silently create a mixed pair.
    return {
      status: "restored-stopped-state",
      detail: "The pre-adoption runtime is not bound to the installed connector by the current receipt",
    };
  }

  private async configureCurrentRuntime(current: DevelopmentPairReceipt | null): Promise<void> {
    if (!current) {
      this.deps.runtime.setDevelopmentCommandOverride(null);
      return;
    }
    const path = this.cachedRuntimePath(current);
    await this.verifyReceipt(current, path);
    this.deps.runtime.setDevelopmentCommandOverride(runtimeCommand(current, path));
  }

  private async restorePreviousRuntime(previous: DevelopmentPairReceipt): Promise<boolean> {
    if (!await this.installedConnectorMatches(previous)) return false;
    const command = await this.materializeRuntime(previous);
    await this.verifyReceipt(previous, command.command);
    const runtime = await this.deps.runtime.ensureReady(
      { reason: "automatic-restart" },
      command,
    );
    if (runtime.identity.developmentBuildFingerprint !== previous.runtime.developmentBuildFingerprint) {
      throw new Error("Previous development runtime rollback identity did not reconnect");
    }
    this.deps.runtime.setDevelopmentCommandOverride(command);
    return true;
  }

  private async installedConnectorMatches(receipt: DevelopmentPairReceipt): Promise<boolean> {
    const expectedFiles = ["main.js", "manifest.json", "styles.css"];
    if (JSON.stringify(receipt.connectorArtifacts.map((artifact) => artifact.file)) !== JSON.stringify(expectedFiles)) {
      throw new Error("Development connector artifact inventory is not exact");
    }
    for (const artifact of receipt.connectorArtifacts) {
      const path = join(this.deps.pluginRoot, artifact.file);
      let state;
      try {
        state = await lstat(path);
      } catch (error) {
        if (errorCode(error) === "ENOENT") return false;
        throw error;
      }
      if (
        !state.isFile()
        || state.isSymbolicLink()
        || state.size !== artifact.size
        || await sha256File(path) !== artifact.sha256
      ) {
        return false;
      }
    }
    return true;
  }

  private async materializeRuntime(receipt: DevelopmentPairReceipt): Promise<ManagedCommand> {
    const target = this.cachedRuntimePath(receipt);
    if (receipt.schemaVersion === 3) {
      const targetDirectory = dirname(target);
      const existing = await lstat(targetDirectory).catch((error: unknown) => {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
      });
      if (existing) {
        await verifyRuntimeBundle(target, receipt, true);
        return runtimeCommand(receipt, target);
      }
      await verifyRuntimeBundle(receipt.runtime.path, receipt, false);
      const cacheParent = dirname(targetDirectory);
      await assertRegularAncestors(cacheParent, true);
      await mkdir(cacheParent, { recursive: true, mode: 0o700 });
      const staging = join(cacheParent, `.stage-${randomUUID()}`);
      await mkdir(staging, { mode: 0o700 });
      try {
        await copyFile(receipt.runtime.path, join(staging, basename(target)));
        for (const asset of parseRuntimeAssetInventory(receipt.runtime.assets)) {
          const destination = join(staging, asset.path);
          await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
          await copyFile(join(dirname(receipt.runtime.path), asset.path), destination);
        }
        await verifyRuntimeBundle(join(staging, basename(target)), receipt, true);
        await rename(staging, targetDirectory);
      } finally {
        await removeOwnedRuntimeStaging(cacheParent, staging);
      }
      await verifyRuntimeBundle(target, receipt, true);
      return runtimeCommand(receipt, target);
    }
    try {
      await verifyRuntimeFile(target, receipt.runtime.sha256);
      return runtimeCommand(receipt, target);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
    }
    await verifyRuntimeFile(receipt.runtime.path, receipt.runtime.sha256);
    await mkdir(join(this.receiptDirectory, "runtimes", receipt.runtime.sha256), { recursive: true });
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await copyFile(receipt.runtime.path, temporary);
      await verifyRuntimeFile(temporary, receipt.runtime.sha256);
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
    await verifyRuntimeFile(target, receipt.runtime.sha256);
    return runtimeCommand(receipt, target);
  }

  private cachedRuntimePath(receipt: DevelopmentPairReceipt): string {
    const identity = receipt.schemaVersion === 3
      ? fingerprintRuntimeBundle(receipt.runtime.sha256, receipt.runtime.assets)
      : receipt.runtime.sha256;
    const cacheRoot = receipt.state === "pending" || receipt.runtimeCacheLocation === "external-v1"
      ? this.externalRuntimeCacheRoot
      : join(this.receiptDirectory, "runtimes");
    return join(cacheRoot, identity, basename(receipt.runtime.path));
  }

  private async verifyReceipt(receipt: DevelopmentPairReceipt, runtimePath: string): Promise<void> {
    const expectedPairId = sha256Json({
      source: receipt.source.contentFingerprint,
      connector: receipt.connector.contentFingerprint,
      projection: receipt.protocol.projectionSha256,
      protocol: {
        version: receipt.runtime.version,
        protocolVersion: receipt.protocol.runtime,
        frontendProtocolVersion: receipt.protocol.frontend,
      },
      runtime: receipt.runtime.sha256,
      ...(receipt.schemaVersion === 3 ? { runtimeAssets: parseRuntimeAssetInventory(receipt.runtime.assets) } : {}),
      artifacts: receipt.connectorArtifacts,
      vault: receipt.vault.markerSha256,
    });
    if (receipt.pairId !== expectedPairId) throw new Error("Development pair identity does not match its exact contents");
    if (comparablePath(receipt.vault.root) !== comparablePath(this.deps.vaultRoot)) throw new Error("Development pair vault identity does not match");
    if (receipt.protocol.runtime !== this.deps.protocolVersion) throw new Error("Development pair runtime protocol is unsupported");
    if (receipt.protocol.frontend !== this.deps.frontendProtocolVersion) throw new Error("Development pair frontend protocol is unsupported");
    const markerPath = join(this.deps.vaultRoot, this.deps.configDir, ".chatobby-dev-vault.json");
    if (await sha256File(markerPath) !== receipt.vault.markerSha256) throw new Error("Development pair vault registration changed");
    if (!isAbsolute(receipt.runtime.path)) throw new Error("Development runtime path must be absolute");
    await verifyRuntimeFile(runtimePath, receipt.runtime.sha256);
    if (receipt.schemaVersion === 3) await verifyRuntimeBundle(runtimePath, receipt, comparablePath(runtimePath) === comparablePath(this.cachedRuntimePath(receipt)));
    if (receipt.runtime.developmentBuildFingerprint !== receipt.source.contentFingerprint) throw new Error("Development runtime fingerprint is not source-bound");
    const expectedFiles = ["main.js", "manifest.json", "styles.css"];
    if (JSON.stringify(receipt.connectorArtifacts.map((artifact) => artifact.file)) !== JSON.stringify(expectedFiles)) {
      throw new Error("Development connector artifact inventory is not exact");
    }
    for (const artifact of receipt.connectorArtifacts) {
      const path = join(this.deps.pluginRoot, artifact.file);
      const state = await lstat(path);
      if (!state.isFile() || state.isSymbolicLink() || state.size !== artifact.size || await sha256File(path) !== artifact.sha256) {
        throw new Error(`Installed development connector artifact does not match: ${artifact.file}`);
      }
    }
  }

  private async writeResult(
    pairId: string,
    status: "activated" | "deferred" | "failed",
    details: DevelopmentPairResultDetails | string = {},
  ): Promise<void> {
    const normalized = typeof details === "string" ? { detail: details } : details;
    await atomicWriteJson(join(this.receiptDirectory, "adoption-result.json"), {
      schemaVersion: 2,
      pairId,
      status,
      ...normalized,
      recordedAt: new Date().toISOString(),
    });
  }
}

type DevelopmentPairRollbackResult =
  | { status: "restored-previous-pair" }
  | { status: "restored-pre-adoption-runtime" }
  | { status: "restored-stopped-state"; detail?: string }
  | { status: "failed"; detail: string };

interface DevelopmentPairResultDetails {
  readonly code?: "frontend-bootstrap-failed" | "frontend-bootstrap-timeout" | "adoption-failed" | "rollback-failed";
  readonly detail?: string;
  readonly timeoutMs?: number;
  readonly activation?: DevelopmentPairActivationProof;
  readonly rollback?: DevelopmentPairRollbackResult;
}

async function readReceipt(path: string, state: DevelopmentPairReceipt["state"]): Promise<DevelopmentPairReceipt | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isRecord(value) || value.state !== state) throw new Error("Development pair receipt is invalid");
    if ("runtimeCacheLocation" in value && (state !== "current" || value.schemaVersion !== 3 || value.runtimeCacheLocation !== "external-v1")) {
      throw new Error("Development pair cache location is invalid");
    }
    if (state === "pending" && (value.schemaVersion !== 3 || "activation" in value)) {
      throw new Error("Pending development pair receipt is invalid");
    }
    if (state === "current" && value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3) {
      throw new Error("Current development pair receipt is invalid");
    }
    const receipt = value as unknown as DevelopmentPairReceipt;
    if (!sha256(receipt.pairId) || !sha256(receipt.runtime?.sha256) || !sha256(receipt.runtime?.developmentBuildFingerprint)) {
      throw new Error("Development pair receipt fingerprints are invalid");
    }
    if (state === "current" && receipt.schemaVersion !== 1 && !receipt.activation) {
      throw new Error("Current development pair activation proof is missing");
    }
    return receipt;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function withBootstrapTimeout(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<DevelopmentPairActivationProof>,
): Promise<DevelopmentPairActivationProof> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("Development pair frontend bootstrap timeout is invalid");
  const controller = new AbortController();
  let timer: number | undefined;
  const timeout = new Promise<never>((_resolvePromise, reject) => {
    timer = window.setTimeout(() => {
      const error = new DevelopmentPairBootstrapTimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) window.clearTimeout(timer);
  }
}

class DevelopmentPairBootstrapTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Development pair frontend bootstrap timed out after ${timeoutMs}ms`);
    this.name = "DevelopmentPairBootstrapTimeoutError";
  }
}

function assertActivationProof(
  proof: DevelopmentPairActivationProof,
  receipt: DevelopmentPairReceipt,
  runtime: ReadyRuntime,
  timeoutMs: number,
): void {
  if (
    proof.status !== "frontend-bootstrap-complete"
    || proof.pairId !== receipt.pairId
    || proof.runtimeInstanceId !== runtime.identity.instanceId
    || proof.bootstrapRuntimeInstanceId !== runtime.identity.instanceId
    || proof.frontendProtocolVersion !== receipt.protocol.frontend
    || proof.selectedCapabilities.length === 0
    || proof.subscriptionStatus !== "bootstrapped"
    || proof.subscriptionSequence !== proof.bootstrapSequence
    || proof.subscriptionRevision !== proof.bootstrapRevision
    || proof.bootstrapViewId !== proof.viewId
    || proof.timeoutMs !== timeoutMs
  ) {
    throw new Error("Development pair frontend bootstrap proof does not match the pending pair");
  }
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function comparablePath(path: string): string {
  const value = normalize(resolve(path));
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function runtimeCommand(receipt: DevelopmentPairReceipt, path: string): ManagedCommand {
  return {
    command: path,
    args: [],
    developmentBuildFingerprint: receipt.runtime.developmentBuildFingerprint,
  };
}

async function verifyRuntimeFile(path: string, expectedSha256: string): Promise<void> {
  const state = await lstat(path);
  if (!state.isFile() || state.isSymbolicLink()) throw new Error("Development runtime path is unsafe");
  if (await sha256File(path) !== expectedSha256) throw new Error("Development runtime hash does not match the receipt");
}

async function assertRegularAncestors(path: string, allowMissing = false): Promise<void> {
  for (let current = resolve(path);;) {
    const state = await lstat(current).catch((error: unknown) => {
      if (allowMissing && errorCode(error) === "ENOENT") return null;
      throw error;
    });
    if (state && (!state.isDirectory() || state.isSymbolicLink())) throw new Error("Development runtime asset parent is unsafe");
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

async function removeOwnedRuntimeStaging(cacheParent: string, staging: string): Promise<void> {
  await assertRegularAncestors(cacheParent);
  const stage = await lstat(staging).catch((error: unknown) => {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  });
  if (!stage) return;
  if (!stage.isDirectory() || stage.isSymbolicLink()) throw new Error("Development runtime staging is unsafe");
  await rm(staging, { recursive: true });
}

async function verifyRuntimeBundle(executable: string, receipt: DevelopmentPairReceipt, cached: boolean): Promise<void> {
  const root = dirname(executable);
  await assertRegularAncestors(root);
  await verifyRuntimeFile(executable, receipt.runtime.sha256);
  const expected = parseRuntimeAssetInventory(receipt.runtime.assets);
  const inventory: RuntimeAssetFile[] = [];
  let totalBytes = 0;
  async function visit(directory: string, prefix: string): Promise<void> {
    const state = await lstat(directory);
    if (!state.isDirectory() || state.isSymbolicLink()) throw new Error("Development runtime asset directory is unsafe");
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${prefix}/${entry.name}`;
      const absolute = join(directory, entry.name);
      const file = await lstat(absolute);
      if (file.isSymbolicLink()) throw new Error("Development runtime asset link is unsafe");
      if (file.isDirectory() && isRuntimeAssetDirectory(path)) await visit(absolute, path);
      else if (file.isFile() && isRuntimeAssetPath(path)) {
        totalBytes += file.size;
        if (file.size > 64 * 1024 * 1024 || totalBytes > 512 * 1024 * 1024 || inventory.length >= RUNTIME_MAX_ASSET_FILES) throw new Error("Development runtime asset limit exceeded");
        inventory.push({ path, size: file.size, sha256: await sha256File(absolute) });
      } else throw new Error("Development runtime asset is not allowlisted");
    }
  }
  if (cached) {
    const allowed = new Set([basename(executable), "assets", "export-html"]);
    if ((await readdir(root)).some((entry) => !allowed.has(entry))) throw new Error("Development runtime cache contains unexpected files");
  }
  for (const directory of ["assets", "export-html"]) await visit(join(root, directory), directory);
  const actual = parseRuntimeAssetInventory(inventory.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Development runtime asset hashes do not match the receipt");
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
