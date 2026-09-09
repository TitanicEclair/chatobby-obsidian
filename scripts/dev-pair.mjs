import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deployDevVault, obsidianVaultCommand } from "./dev-vault.mjs";
import { parseRuntimeAssetInventory, WINDOWS_SANDBOX_HELPER_ENTRY } from "../src/vendor/chatobby-client/runtime-assets.ts";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function runDevelopmentPairCommand(arguments_, dependencies = {}) {
  const pendingOption = requiredOption(arguments_, "--pending-receipt");
  if (!isAbsolute(pendingOption)) throw new Error("--pending-receipt must be absolute");
  const pendingReceiptPath = resolve(pendingOption);
  const pending = JSON.parse(await readFile(pendingReceiptPath, "utf8"));
  if (pending?.schemaVersion !== 3 || pending?.state !== "pending" || typeof pending?.pairId !== "string" || "activation" in pending || "runtimeCacheLocation" in pending) {
    throw new Error("Pending development pair receipt is invalid");
  }
  const assets = parseRuntimeAssetInventory(pending.runtime?.assets);
  if (assets.some((asset) => asset.path === WINDOWS_SANDBOX_HELPER_ENTRY)) {
    parseRuntimeAssetInventory(assets, { requireWindowsSandboxHelper: true });
  }
  const vaultRoot = resolve(requiredString(pending.vault?.root, "vault root"));
  const receiptDirectory = dirname(pendingReceiptPath);
  const pluginDirectory = join(vaultRoot, ".obsidian", "plugins", "chatobby");
  const lockRoot = dependencies.lockRoot ?? (process.env.LOCALAPPDATA?.trim()
    ? join(process.env.LOCALAPPDATA, "Chatobby", "development-pair.lock")
    : join(homedir(), ".chatobby", "development-pair.lock"));
  const deploy = dependencies.deploy ?? deployDevVault;
  const reload = dependencies.reload ?? runObsidianReload;
  const wait = dependencies.wait ?? waitForAdoption;
  const connectorRoot = dependencies.connectorRoot ?? repositoryRoot;

  return withMachineLock(lockRoot, async () => {
    await assertSourceArtifacts(pending.connectorArtifacts, connectorRoot);
    const backupRoot = join(receiptDirectory, `connector-backup-${pending.pairId}`);
    const inventoryPath = join(backupRoot, "inventory.json");
    let inventory;
    try {
      inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(backupRoot, { recursive: true });
      inventory = await backupInstalledArtifacts(pluginDirectory, backupRoot);
      await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
    }
    try {
      await deploy({
        vaultRoot,
        repositoryRoot: connectorRoot,
        includeManifest: true,
        reload: false,
      }, { build: async () => {} });
      const reloaded = await reload(vaultRoot).catch(() => false);
      if (!reloaded) return 4;
      const result = await wait(join(receiptDirectory, "adoption-result.json"), pending.pairId, 30_000);
      if (!result) return 4;
      if (result.status === "activated") {
        const current = JSON.parse(await readFile(join(receiptDirectory, "current.json"), "utf8"));
        assertActivatedReceipt(current, pending, result);
        await rm(backupRoot, { recursive: true, force: true });
        return 0;
      }
      if (result.status === "deferred") return 3;
      await restoreInstalledArtifacts(pluginDirectory, backupRoot, inventory);
      await reload(vaultRoot).catch(() => false);
      throw new Error(`Development pair adoption failed: ${result.detail ?? "unknown failure"}`);
    } catch (error) {
      await restoreInstalledArtifacts(pluginDirectory, backupRoot, inventory).catch(() => undefined);
      throw error;
    }
  });
}

export async function assertSourceArtifacts(artifacts, sourceRoot = repositoryRoot) {
  const expected = ["main.js", "manifest.json", "styles.css"];
  if (!Array.isArray(artifacts) || JSON.stringify(artifacts.map((item) => item.file)) !== JSON.stringify(expected)) {
    throw new Error("Pending connector artifact inventory is not exact");
  }
  for (const artifact of artifacts) {
    const source = join(sourceRoot, artifact.file);
    const state = await lstat(source);
    if (!state.isFile() || state.isSymbolicLink() || state.size !== artifact.size) {
      throw new Error(`Pending connector artifact changed: ${artifact.file}`);
    }
    const sha256 = createHash("sha256").update(await readFile(source)).digest("hex");
    if (sha256 !== artifact.sha256) throw new Error(`Pending connector artifact hash changed: ${artifact.file}`);
  }
}

export async function backupInstalledArtifacts(pluginDirectory, backupRoot) {
  const inventory = [];
  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    const source = join(pluginDirectory, file);
    const state = await lstat(source).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    inventory.push({ file, existed: Boolean(state) });
    if (state) {
      if (!state.isFile() || state.isSymbolicLink()) throw new Error(`Installed connector artifact is unsafe: ${file}`);
      await cp(source, join(backupRoot, file), { force: false });
    }
  }
  return inventory;
}

export async function restoreInstalledArtifacts(pluginDirectory, backupRoot, inventory) {
  for (const item of inventory) {
    const target = join(pluginDirectory, item.file);
    if (item.existed) await cp(join(backupRoot, item.file), target, { force: true });
    else await rm(target, { force: true });
  }
  await rm(backupRoot, { recursive: true, force: true });
}

export function assertActivatedReceipt(current, pending, result) {
  const activation = current?.activation;
  if (
    current?.schemaVersion !== 3
    || current?.state !== "current"
    || ("runtimeCacheLocation" in current && current.runtimeCacheLocation !== "external-v1")
    || "runtimeCacheLocation" in pending
    || current?.pairId !== pending.pairId
    || activation?.status !== "frontend-bootstrap-complete"
    || activation?.pairId !== pending.pairId
    || activation?.runtimeInstanceId !== activation?.bootstrapRuntimeInstanceId
    || activation?.viewId !== activation?.bootstrapViewId
    || activation?.frontendProtocolVersion !== pending?.protocol?.frontend
    || activation?.subscriptionStatus !== "bootstrapped"
    || activation?.subscriptionSequence !== activation?.bootstrapSequence
    || activation?.subscriptionRevision !== activation?.bootstrapRevision
    || !Array.isArray(activation?.selectedCapabilities)
    || activation.selectedCapabilities.length === 0
    || new Set(activation.selectedCapabilities).size !== activation.selectedCapabilities.length
    || !Number.isSafeInteger(activation?.subscriptionSequence)
    || activation.subscriptionSequence < 0
    || !Number.isSafeInteger(activation?.subscriptionRevision)
    || activation.subscriptionRevision < 0
    || !Number.isFinite(Date.parse(activation?.completedAt))
    || !Number.isSafeInteger(activation?.timeoutMs)
    || activation.timeoutMs <= 0
    || result?.schemaVersion !== 2
    || result?.status !== "activated"
    || result?.pairId !== pending.pairId
    || result?.timeoutMs !== activation.timeoutMs
    || !samePendingEvidence(current, pending)
    || JSON.stringify(result?.activation) !== JSON.stringify(activation)
  ) {
    throw new Error("Activated development pair receipt does not contain the exact frontend bootstrap proof");
  }
}

function samePendingEvidence(current, pending) {
  const fields = [
    "action",
    "createdAt",
    "source",
    "connector",
    "protocol",
    "runtime",
    "connectorArtifacts",
    "vault",
    "timingsMs",
    "observations",
  ];
  return fields.every((field) => JSON.stringify(current?.[field]) === JSON.stringify(pending?.[field]));
}

async function runObsidianReload(vaultRoot) {
  const command = process.env.CHATOBBY_OBSIDIAN_CLI?.trim() || (process.platform === "win32" ? "Obsidian.com" : "obsidian");
  const result = await run(
    command,
    obsidianVaultCommand(basename(vaultRoot), ["plugin:reload", "id=chatobby"]),
    repositoryRoot,
  );
  return result.exitCode === 0;
}

async function waitForAdoption(path, pairId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = JSON.parse(await readFile(path, "utf8"));
      if (value?.schemaVersion === 2 && value?.pairId === pairId) return value;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  return null;
}

export async function withMachineLock(path, operation) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await mkdir(path);
  } catch (error) {
    if (error?.code !== "EEXIST" || !await staleLock(path)) throw new Error("Another Chatobby development-pair reconciliation is active");
    await rm(path, { recursive: true, force: true });
    await mkdir(path);
  }
  try {
    await writeFile(join(path, "owner.json"), `${JSON.stringify({ schemaVersion: 1, pid: process.pid, containsSecrets: false })}\n`, "utf8");
    return await operation();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}

async function staleLock(path) {
  try {
    const owner = JSON.parse(await readFile(join(path, "owner.json"), "utf8"));
    if (Number.isSafeInteger(owner?.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); return false; } catch { return true; }
    }
  } catch {}
  const state = await lstat(path).catch(() => null);
  return Boolean(state && Date.now() - state.mtimeMs >= 30_000);
}

function run(command, arguments_, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, { cwd, windowsHide: true, shell: false });
    child.once("error", reject);
    child.once("close", (code) => resolvePromise({ exitCode: code ?? 1 }));
  });
}

function requiredOption(arguments_, name) {
  const index = arguments_.indexOf(name);
  const value = index >= 0 ? arguments_[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Pending development pair ${label} is invalid`);
  return value;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runDevelopmentPairCommand(process.argv.slice(2));
}
