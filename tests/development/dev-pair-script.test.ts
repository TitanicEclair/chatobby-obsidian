import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RUNTIME_REQUIRED_ASSET_PATHS, WINDOWS_SANDBOX_ASSET_PATHS } from "../../src/vendor/chatobby-client/runtime-assets";
import {
  assertActivatedReceipt,
  assertSourceArtifacts,
  runDevelopmentPairCommand,
} from "../../scripts/dev-pair.mjs";

const artifactNames = ["main.js", "manifest.json", "styles.css"] as const;

describe("development-pair connector transaction", () => {
  it("rejects historical Host-only pending assets before lock, deploy or reload", async () => {
    const root = await mkdtemp(join(tmpdir(), "chatobby-dev-pair-host-only-"));
    const path = join(root, "pending.json");
    const assets = [...RUNTIME_REQUIRED_ASSET_PATHS, ...WINDOWS_SANDBOX_ASSET_PATHS]
      .filter((entry) => !entry.includes("/Chatobby.SandboxSetup."))
      .sort().map((path) => ({ path, size: 1, sha256: "a".repeat(64) }));
    await writeFile(path, JSON.stringify({ schemaVersion: 3, state: "pending", pairId: "a".repeat(64), runtime: { assets } }));
    const deploy = vi.fn(async () => {});
    const reload = vi.fn(async () => false);
    await expect(runDevelopmentPairCommand(["--pending-receipt", path], { lockRoot: join(root, "lock"), deploy, reload })).rejects.toThrow(/Complete Windows/u);
    expect(deploy).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    await expect(readFile(join(root, "lock"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["legacy", "missing-assets", "invalid-path", "cache-location"])("rejects %s pending input before any connector deployment", async (failure) => {
    const root = await mkdtemp(join(tmpdir(), "chatobby-dev-pair-rejected-"));
    const path = join(root, "pending.json");
    const assets = [...RUNTIME_REQUIRED_ASSET_PATHS].sort().map((path) => ({ path, size: 1, sha256: "a".repeat(64) }));
    if (failure === "invalid-path") assets[0].path = "../outside";
    await writeFile(path, JSON.stringify({ schemaVersion: failure === "legacy" ? 2 : 3, state: "pending", pairId: "a".repeat(64), runtime: { assets: failure === "missing-assets" ? [] : assets }, ...(failure === "cache-location" ? { runtimeCacheLocation: "external-v1" } : {}) }));
    const deploy = vi.fn(async () => {});
    const reload = vi.fn(async () => false);
    await expect(runDevelopmentPairCommand(["--pending-receipt", path], { lockRoot: join(root, "lock"), connectorRoot: join(root, "connector"), deploy, reload })).rejects.toThrow(failure === "legacy" || failure === "cache-location" ? /receipt/u : /asset/u);
    expect(deploy).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
  it("refuses changed source artifacts before vault mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "chatobby-dev-pair-artifacts-"));
    const connectorRoot = join(root, "connector");
    const artifacts = await sourceArtifacts(connectorRoot);
    artifacts[0] = { ...artifacts[0], sha256: "0".repeat(64) };

    await expect(assertSourceArtifacts(artifacts, connectorRoot)).rejects.toThrow("Pending connector artifact hash changed: main.js");
  });

  it("keeps a staged pending pair when Obsidian is unavailable and restores on adoption failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "chatobby-dev-pair-script-"));
    const vaultRoot = join(root, "vault");
    const pluginRoot = join(vaultRoot, ".obsidian", "plugins", "chatobby");
    const receiptRoot = join(vaultRoot, ".obsidian", ".chatobby-dev", "development-pair");
    const pendingPath = join(receiptRoot, "pending.json");
    const connectorRoot = join(root, "connector");
    await mkdir(pluginRoot, { recursive: true });
    await mkdir(receiptRoot, { recursive: true });
    for (const file of artifactNames) await writeFile(join(pluginRoot, file), `old-${file}\n`);
    const artifacts = await sourceArtifacts(connectorRoot);
    await writeFile(pendingPath, `${JSON.stringify({
      schemaVersion: 3,
      state: "pending",
      pairId: "pair-test",
      vault: { root: vaultRoot },
      connectorArtifacts: artifacts,
      runtime: { assets: [...RUNTIME_REQUIRED_ASSET_PATHS].sort().map((path) => ({ path, size: 1, sha256: "a".repeat(64) })) },
    }, null, 2)}\n`);

    const deploy = vi.fn(async () => {
      for (const file of artifactNames) await cp(join(connectorRoot, file), join(pluginRoot, file), { force: true });
    });
    const staged = await runDevelopmentPairCommand(["--pending-receipt", pendingPath], {
      lockRoot: join(root, "machine-lock"),
      connectorRoot,
      deploy,
      reload: async () => false,
    });

    expect(staged).toBe(4);
    expect(deploy).toHaveBeenCalledOnce();
    expect(await readFile(join(pluginRoot, "main.js"), "utf8")).not.toBe("old-main.js\n");
    expect(await readFile(join(receiptRoot, "connector-backup-pair-test", "main.js"), "utf8")).toBe("old-main.js\n");

    await expect(runDevelopmentPairCommand(["--pending-receipt", pendingPath], {
      lockRoot: join(root, "machine-lock"),
      connectorRoot,
      deploy,
      reload: async () => true,
      wait: async () => ({ schemaVersion: 1, pairId: "pair-test", status: "failed", detail: "bootstrap failed" }),
    })).rejects.toThrow("Development pair adoption failed: bootstrap failed");
    for (const file of artifactNames) expect(await readFile(join(pluginRoot, file), "utf8")).toBe(`old-${file}\n`);
  });

  it("requires an activated result to match the promoted current bootstrap proof", () => {
    const pending = { schemaVersion: 3, state: "pending", pairId: "a".repeat(64), protocol: { frontend: 2 } };
    const activation = {
      status: "frontend-bootstrap-complete",
      pairId: pending.pairId,
      runtimeInstanceId: "runtime-1",
      frontendProtocolVersion: 2,
      viewId: "view-1",
      selectedCapabilities: ["atomic-bootstrap-cutover"],
      subscriptionStatus: "bootstrapped",
      subscriptionSequence: 2,
      subscriptionRevision: 3,
      bootstrapRuntimeInstanceId: "runtime-1",
      bootstrapViewId: "view-1",
      bootstrapSequence: 2,
      bootstrapRevision: 3,
      completedAt: "2026-09-04T00:00:00.000Z",
      timeoutMs: 20_000,
    };
    const current = { ...pending, state: "current", activation };
    const result = {
      schemaVersion: 2,
      pairId: pending.pairId,
      status: "activated",
      timeoutMs: activation.timeoutMs,
      activation,
    };
    expect(() => assertActivatedReceipt(current, pending, result)).not.toThrow();
    expect(() => assertActivatedReceipt({ ...current, runtimeCacheLocation: "external-v1" }, pending, result)).not.toThrow();
    expect(() => assertActivatedReceipt({ ...current, runtimeCacheLocation: "external-v2" }, pending, result)).toThrow(/exact frontend/u);
    expect(() => assertActivatedReceipt(current, { ...pending, runtimeCacheLocation: "external-v1" }, result)).toThrow(/exact frontend/u);
    expect(() => assertActivatedReceipt(
      { ...current, activation: { ...activation, bootstrapSequence: 1 } },
      pending,
      result,
    )).toThrow("exact frontend bootstrap proof");
  });
});

async function sourceArtifacts(connectorRoot: string): Promise<Array<{ file: string; size: number; sha256: string }>> {
  await mkdir(connectorRoot, { recursive: true });
  const artifacts = [];
  for (const file of artifactNames) {
    const path = join(connectorRoot, file);
    await writeFile(path, `new-${file}\n`);
    const bytes = await readFile(path);
    artifacts.push({ file, size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  return artifacts;
}
