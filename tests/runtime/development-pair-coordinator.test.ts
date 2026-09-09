import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DevelopmentPairCoordinator } from "../../src/runtime/application/development-pair-coordinator";
import type { DevelopmentPairActivationProof } from "../../src/runtime/application/development-pair-bootstrap";
import type { ChatobbyRuntimeManager, ReadyRuntime } from "../../src/runtime/public";
import type { RuntimeMaintenanceAdmission } from "../../src/vendor/chatobby-client/ws-client";
import { RUNTIME_MAX_ASSET_FILES, RUNTIME_REQUIRED_ASSET_PATHS, WINDOWS_SANDBOX_ASSET_PATHS, WINDOWS_SANDBOX_ASSET_ROOT, type RuntimeAssetFile } from "../../src/vendor/chatobby-client/runtime-assets";

const roots: string[] = [];
// The finite complete staging/hash fixture competes with the full suite's disk
// work on Windows. Bound only these cases; assertions and retry policy stay fixed.
const HELPER_FIXTURE_TIMEOUT_MS = 20_000;

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("development pair coordinator", () => {
  it.each([false, true])("moves only new adoption to the external cache and preserves historical rollback, bootstrap failure=%s", async (failBootstrap) => {
    const fixture = await createFixture();
    const previous = { ...fixture.receipt, state: "current", activation: activationProof(fixture.receipt.pairId) };
    const oldBytes = JSON.stringify(previous);
    const currentPath = join(fixture.receiptRoot, "current.json");
    const historicalPath = cachedRuntimePath(fixture, previous);
    await writeFile(currentPath, oldBytes);
    await mkdir(dirname(historicalPath), { recursive: true });
    await writeFile(historicalPath, "runtime");
    await writeAssets(dirname(historicalPath));
    const runtime = runtimeFixture(fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(fixture, runtime.manager, vi.fn(async () => {
      if (failBootstrap) throw new Error("new bootstrap failed");
      return activationProof(fixture.receipt.pairId);
    }));
    if (failBootstrap) {
      await expect(coordinator.adoptPending()).rejects.toThrow("new bootstrap failed");
      expect(await readFile(currentPath, "utf8")).toBe(oldBytes);
      expect(runtime.ensureReady.mock.calls.at(-1)?.[1]).toMatchObject({ command: historicalPath });
    } else {
      await expect(coordinator.adoptPending()).resolves.toBe("activated");
      expect(JSON.parse(await readFile(currentPath, "utf8"))).toMatchObject({ runtimeCacheLocation: "external-v1" });
      expect(runtime.ensureReady.mock.calls[0]?.[1]).toMatchObject({ command: cachedRuntimePath(fixture) });
    }
    expect(runtime.admitMaintenance).toHaveBeenCalledOnce();
    expect(historicalPath).not.toBe(cachedRuntimePath(fixture));
    expect(await readFile(historicalPath, "utf8")).toBe("runtime");
    expect(await readFile(cachedRuntimePath(fixture), "utf8")).toBe("runtime");
  });

  it.each(["pending", "unknown", "legacy"])("rejects %s cache location before materialization or runtime effects", async (fault) => {
    const fixture = await createFixture();
    const state = fault === "pending" ? "pending" : "current";
    const invalid = { ...fixture.receipt, state, schemaVersion: fault === "legacy" ? 1 : 3,
      runtimeCacheLocation: fault === "unknown" ? "external-v2" : "external-v1",
      ...(state === "current" ? { activation: activationProof(fixture.receipt.pairId) } : {}) };
    await writeFile(join(fixture.receiptRoot, `${state}.json`), JSON.stringify(invalid));
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/cache location/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
    await expect(readFile(cachedRuntimePath(fixture))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([false, true])("rejects a new Host-only pending bundle while preserving historical current=%s", async (hasCurrent) => {
    const fixture = await createFixture();
    await addWindowsHelper(fixture);
    const setup = fixture.receipt.runtime.assets.filter((asset) => asset.path.includes("/Chatobby.SandboxSetup."));
    for (const asset of setup) await unlink(join(dirname(fixture.receipt.runtime.path), asset.path));
    fixture.receipt.runtime.assets = fixture.receipt.runtime.assets.filter((asset) => !asset.path.includes("/Chatobby.SandboxSetup."));
    fixture.receipt.pairId = developmentPairId(fixture.receipt);
    const pendingPath = join(fixture.receiptRoot, "pending.json");
    const currentPath = join(fixture.receiptRoot, "current.json");
    const previousReceipt = { ...fixture.receipt, state: "current", activation: activationProof(fixture.receipt.pairId) };
    const previous = JSON.stringify(previousReceipt);
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId)));
    if (hasCurrent) {
      await writeFile(currentPath, previous);
      await mkdir(dirname(cachedRuntimePath(fixture, previousReceipt)), { recursive: true });
      await writeFile(cachedRuntimePath(fixture, previousReceipt), "runtime");
      await writeAssets(dirname(cachedRuntimePath(fixture, previousReceipt)), fixture.receipt.runtime.assets.map((asset) => asset.path));
      await unlink(pendingPath);
      await expect(coordinator.adoptPending()).resolves.toBe("none");
      expect(runtime.setDevelopmentCommandOverride).toHaveBeenCalledOnce();
      runtime.setDevelopmentCommandOverride.mockClear();
    }
    await writeFile(pendingPath, JSON.stringify(fixture.receipt));
    await expect(coordinator.adoptPending()).rejects.toThrow(/Complete Windows/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.reattachExistingForMaintenance).not.toHaveBeenCalled();
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
    expect(runtime.setDevelopmentCommandOverride).not.toHaveBeenCalled();
    expect(runtime.stop).not.toHaveBeenCalled();
    if (hasCurrent) expect(await readFile(currentPath, "utf8")).toBe(previous);
    else await expect(readFile(cachedRuntimePath(fixture))).rejects.toMatchObject({ code: "ENOENT" });
  }, HELPER_FIXTURE_TIMEOUT_MS);

  it("copies and verifies the complete finite Windows helper bundle without invoking it", async () => {
    const fixture = await createFixture();
    await addWindowsHelper(fixture);
    // Base/OCR plus the complete Windows helper, without the separate Landstrip assets.
    expect(fixture.receipt.runtime.assets).toHaveLength(222);
    expect(fixture.receipt.runtime.assets.length).toBeLessThanOrEqual(RUNTIME_MAX_ASSET_FILES);
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).resolves.toBe("activated");
    for (const path of WINDOWS_SANDBOX_ASSET_PATHS) {
      expect(await readFile(join(dirname(cachedRuntimePath(fixture)), path), "utf8")).toBe("fixture asset");
    }
    expect(runtime.ensureReady).toHaveBeenCalledOnce();
    expect(runtime.ensureReady.mock.calls[0]?.[1]).toMatchObject({ command: cachedRuntimePath(fixture), args: [] });
  }, HELPER_FIXTURE_TIMEOUT_MS);

  it.each(["missing", "tampered", "partial-inventory"] as const)("rejects %s helper closure with zero launch or maintenance", async (failure) => {
    const fixture = await createFixture();
    await addWindowsHelper(fixture);
    const path = `${WINDOWS_SANDBOX_ASSET_ROOT}/LICENSE.dotnet.txt`;
    if (failure === "missing") await unlink(join(dirname(fixture.receipt.runtime.path), path));
    if (failure === "tampered") await writeFile(join(dirname(fixture.receipt.runtime.path), path), "modified");
    if (failure === "partial-inventory") {
      fixture.receipt.runtime.assets = fixture.receipt.runtime.assets.filter((asset) => asset.path !== path);
      fixture.receipt.pairId = developmentPairId(fixture.receipt);
      await writeFile(join(fixture.receiptRoot, "pending.json"), JSON.stringify(fixture.receipt));
    }
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow();
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.reattachExistingForMaintenance).not.toHaveBeenCalled();
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
  }, HELPER_FIXTURE_TIMEOUT_MS);

  it("does not downgrade a native-capable current pair to a base-only pending bundle", async () => {
    const fixture = await createFixture();
    await addWindowsHelper(fixture);
    const initial = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await createCoordinator(fixture, initial.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending();
    const previous = await readFile(join(fixture.receiptRoot, "current.json"), "utf8");
    for (const path of WINDOWS_SANDBOX_ASSET_PATHS) await unlink(join(dirname(fixture.receipt.runtime.path), path));
    fixture.receipt.runtime.assets = fixture.receipt.runtime.assets.filter((asset) => !asset.path.startsWith(`${WINDOWS_SANDBOX_ASSET_ROOT}/`));
    fixture.receipt.pairId = developmentPairId(fixture.receipt);
    await writeFile(join(fixture.receiptRoot, "pending.json"), JSON.stringify(fixture.receipt));
    const runtime = runtimeFixture(fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/helper/u);
    expect(await readFile(join(fixture.receiptRoot, "current.json"), "utf8")).toBe(previous);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
    expect(runtime.stop).not.toHaveBeenCalled();
  }, HELPER_FIXTURE_TIMEOUT_MS);

  it("rechecks helper bytes after maintenance admission before starting a runtime", async () => {
    const fixture = await createFixture();
    await addWindowsHelper(fixture);
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    runtime.admitMaintenance.mockImplementationOnce(async () => {
      await writeFile(join(dirname(cachedRuntimePath(fixture)), WINDOWS_SANDBOX_ASSET_ROOT, "coreclr.dll"), "changed");
      return null;
    });
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/asset hashes/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
  }, HELPER_FIXTURE_TIMEOUT_MS);

  it("replaces a same-source runtime when asset bytes change instead of accepting the old ready process", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const previous = { ...fixture.receipt, runtime: { ...fixture.receipt.runtime }, state: "current", runtimeCacheLocation: "external-v1", activation: activationProof(fixture.receipt.pairId) };
    await writeFile(join(fixture.receiptRoot, "current.json"), JSON.stringify(previous));
    const changed = "new asset bytes";
    const path = "assets/web-tree-sitter.wasm";
    await writeFile(join(dirname(fixture.receipt.runtime.path), path), changed);
    fixture.receipt.runtime.assets = fixture.receipt.runtime.assets.map((asset) => asset.path === path ? { path, size: Buffer.byteLength(changed), sha256: sha256(changed) } : asset);
    fixture.receipt.pairId = developmentPairId(fixture.receipt);
    await writeFile(join(fixture.receiptRoot, "pending.json"), JSON.stringify(fixture.receipt));
    runtime.admitMaintenance.mockResolvedValueOnce({ schemaVersion: 1, operationId: "asset-operation", status: "admitted", leaseId: "asset-lease", expiresAt: Date.now() + 10_000 });
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).resolves.toBe("activated");
    expect(cachedRuntimePath(fixture)).not.toBe(cachedRuntimePath(fixture, previous));
    expect(runtime.commitMaintenance).toHaveBeenCalledWith(expect.any(String), "asset-lease");
    expect(runtime.commitMaintenance.mock.invocationCallOrder[0]).toBeLessThan(runtime.ensureReady.mock.invocationCallOrder[0]!);
    expect(await readFile(join(dirname(cachedRuntimePath(fixture)), path), "utf8")).toBe(changed);
  });

  it("does not replace the exact schema3 bundle during a connector-only adoption", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const previous = { ...fixture.receipt, state: "current", runtimeCacheLocation: "external-v1", activation: activationProof(fixture.receipt.pairId) };
    await writeFile(join(fixture.receiptRoot, "current.json"), JSON.stringify(previous));
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).resolves.toBe("activated");
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
    expect(runtime.commitMaintenance).not.toHaveBeenCalled();
  });

  it("requires maintenance for a same-fingerprint instance not bound to the current activation proof", async () => {
    const fixture = await createFixture();
    const previous = { ...fixture.receipt, state: "current", runtimeCacheLocation: "external-v1", activation: { ...activationProof(fixture.receipt.pairId), runtimeInstanceId: "retired-instance", bootstrapRuntimeInstanceId: "retired-instance" } };
    await writeFile(join(fixture.receiptRoot, "current.json"), JSON.stringify(previous));
    const runtime = runtimeFixture(fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).resolves.toBe("activated");
    expect(runtime.admitMaintenance).toHaveBeenCalledOnce();
    expect(runtime.commitMaintenance).toHaveBeenCalledOnce();
  });

  it("does not reuse a live runtime when required maintenance authority disappears", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    runtime.admitMaintenance.mockResolvedValueOnce(null);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/did not admit bundle replacement/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.stop).not.toHaveBeenCalled();
  });

  it.each([false, true])("preserves previous current receipt on a failed replacement and rejects corrupted rollback assets=%s", async (corrupt) => {
    const fixture = await createFixture();
    const initial = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await createCoordinator(fixture, initial.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending();
    const originalCurrent = await readFile(join(fixture.receiptRoot, "current.json"), "utf8");
    const previousCache = cachedRuntimePath(fixture);
    const changed = "replacement asset";
    const path = "assets/web-tree-sitter.wasm";
    await writeFile(join(dirname(fixture.receipt.runtime.path), path), changed);
    fixture.receipt.runtime.assets = fixture.receipt.runtime.assets.map((asset) => asset.path === path ? { path, size: Buffer.byteLength(changed), sha256: sha256(changed) } : asset);
    fixture.receipt.pairId = developmentPairId(fixture.receipt);
    await writeFile(join(fixture.receiptRoot, "pending.json"), JSON.stringify(fixture.receipt));
    if (corrupt) await writeFile(join(dirname(previousCache), path), "corrupt previous cache");
    const runtime = runtimeFixture(fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    runtime.ensureReady.mockRejectedValueOnce(new Error("replacement start failed"));
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/replacement start failed/u);
    expect(await readFile(join(fixture.receiptRoot, "current.json"), "utf8")).toBe(originalCurrent);
    expect(runtime.ensureReady).toHaveBeenCalledTimes(corrupt ? 1 : 2);
    if (!corrupt) expect(runtime.ensureReady).toHaveBeenLastCalledWith({ reason: "automatic-restart" }, expect.objectContaining({ command: previousCache }));
    const result = JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"));
    expect(result.rollback.status).toBe(corrupt ? "failed" : "restored-previous-pair");
  });

  it.each(["missing", "tampered", "extra", "junction"] as const)("never launches or admits maintenance with %s source assets", async (failure) => {
    const fixture = await createFixture();
    const root = dirname(fixture.receipt.runtime.path);
    if (failure === "missing") await unlink(join(root, "assets/web-tree-sitter.wasm"));
    if (failure === "tampered") await writeFile(join(root, "assets/tree-sitter-bash.wasm"), "changed asset");
    if (failure === "extra") await writeFile(join(root, "assets/extra.js"), "extra");
    if (failure === "junction") {
      const owned = join(fixture.vaultRoot, "owned-assets");
      await rename(join(root, "assets"), owned);
      await symlink(owned, join(root, "assets"), process.platform === "win32" ? "junction" : "dir");
    }
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId)));
    await expect(coordinator.adoptPending()).rejects.toThrow();
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.reattachExistingForMaintenance).not.toHaveBeenCalled();
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
    expect(runtime.stop).not.toHaveBeenCalled();
  });

  it.each(["../escape", "assets/web-tree-sitter.wasm:stream", "C:/escape", "assets\\web-tree-sitter.wasm"])("rejects inventory path %s before a start", async (path) => {
    const fixture = await createFixture();
    fixture.receipt.runtime.assets[0] = { ...fixture.receipt.runtime.assets[0], path };
    await writeFile(join(fixture.receiptRoot, "pending.json"), JSON.stringify(fixture.receipt));
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/asset/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
  });

  it.each([1, 2])("rejects a schema %s executable-only pending candidate without launching", async (schemaVersion) => {
    const fixture = await createFixture();
    await writeFile(join(fixture.receiptRoot, "pending.json"), JSON.stringify({ ...fixture.receipt, schemaVersion }));
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/receipt/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.admitMaintenance).not.toHaveBeenCalled();
  });

  it("rechecks cached assets after asynchronous maintenance admission before launch", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    runtime.admitMaintenance.mockImplementationOnce(async () => {
      await writeFile(join(dirname(cachedRuntimePath(fixture)), "assets/web-tree-sitter.wasm"), "changed");
      return null;
    });
    await expect(createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId))).adoptPending()).rejects.toThrow(/asset hashes/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
  });

  it("refuses changed current cache assets and does not repair or fall back", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(fixture, runtime.manager, vi.fn(async () => activationProof(fixture.receipt.pairId)));
    await coordinator.adoptPending();
    runtime.ensureReady.mockClear();
    runtime.setDevelopmentCommandOverride.mockClear();
    const path = join(dirname(cachedRuntimePath(fixture)), "assets/tree-sitter-bash.wasm");
    await writeFile(path, "changed");
    await expect(coordinator.adoptPending()).rejects.toThrow(/asset hashes/u);
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.setDevelopmentCommandOverride).not.toHaveBeenCalled();
    expect(await readFile(path, "utf8")).toBe("changed");
  });

  it("waits for exact frontend bootstrap proof before promoting current", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    let releaseProof: ((proof: DevelopmentPairActivationProof) => void) | undefined;
    const verifyFrontendBootstrap = vi.fn(() => new Promise<DevelopmentPairActivationProof>((resolvePromise) => {
      releaseProof = resolvePromise;
    }));
    const coordinator = createCoordinator(fixture, runtime.manager, verifyFrontendBootstrap);

    const adoption = coordinator.adoptPending();
    await vi.waitFor(() => expect(verifyFrontendBootstrap).toHaveBeenCalledOnce());
    await expect(readFile(join(fixture.receiptRoot, "current.json"))).rejects.toThrow();
    releaseProof?.(activationProof(fixture.receipt.pairId));
    await expect(adoption).resolves.toBe("activated");

    expect(runtime.ensureReady).toHaveBeenCalledWith(
      { reason: "manual-restart" },
      expect.objectContaining({
        command: cachedRuntimePath(fixture),
        developmentBuildFingerprint: fixture.receipt.runtime.developmentBuildFingerprint,
      }),
    );
    expect(runtime.setDevelopmentCommandOverride).toHaveBeenCalledWith({
      command: cachedRuntimePath(fixture),
      args: [],
      developmentBuildFingerprint: fixture.receipt.runtime.developmentBuildFingerprint,
    });
    const current = JSON.parse(await readFile(join(fixture.receiptRoot, "current.json"), "utf8"));
    expect(current).toMatchObject({
      schemaVersion: 3,
      pairId: fixture.receipt.pairId,
      state: "current",
      runtimeCacheLocation: "external-v1",
      activation: activationProof(fixture.receipt.pairId),
    });
    expect(current.runtime.path).toBe(fixture.receipt.runtime.path);
    await expect(readFile(cachedRuntimePath(fixture), "utf8")).resolves.toBe("runtime");
    await expect(readFile(join(fixture.receiptRoot, "pending.json"))).rejects.toThrow();
  });

  it.each([undefined, "external-v1"] as const)("pins the exact current location %s on reload without moving historical bytes", async (runtimeCacheLocation) => {
    const fixture = await createFixture();
    const current = {
      ...fixture.receipt,
      state: "current" as const,
      ...(runtimeCacheLocation ? { runtimeCacheLocation } : {}),
      activation: activationProof(fixture.receipt.pairId),
    };
    await writeFile(join(fixture.receiptRoot, "current.json"), JSON.stringify(current));
    await rm(join(fixture.receiptRoot, "pending.json"));
    await mkdir(dirname(cachedRuntimePath(fixture, current)), { recursive: true });
    await writeFile(cachedRuntimePath(fixture, current), "runtime");
    await writeAssets(dirname(cachedRuntimePath(fixture, current)));
    await rm(fixture.receipt.runtime.path);
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
    );

    await expect(coordinator.adoptPending()).resolves.toBe("none");

    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.setDevelopmentCommandOverride).toHaveBeenCalledWith({
      command: cachedRuntimePath(fixture, current),
      args: [],
      developmentBuildFingerprint: fixture.receipt.runtime.developmentBuildFingerprint,
    });
  });

  it("fails closed when the current pair cache is missing", async () => {
    const fixture = await createFixture();
    const current = {
      ...fixture.receipt,
      state: "current" as const,
      activation: activationProof(fixture.receipt.pairId),
    };
    await writeFile(join(fixture.receiptRoot, "current.json"), JSON.stringify(current));
    await rm(join(fixture.receiptRoot, "pending.json"));
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
    );

    await expect(coordinator.adoptPending()).rejects.toMatchObject({ code: "ENOENT" });
    expect(runtime.setDevelopmentCommandOverride).not.toHaveBeenCalled();
    expect(runtime.ensureReady).not.toHaveBeenCalled();
  });

  it("refuses to pin a current pair whose immutable runtime bytes changed", async () => {
    const fixture = await createFixture();
    const current = {
      ...fixture.receipt,
      state: "current" as const,
      activation: activationProof(fixture.receipt.pairId),
    };
    await writeFile(join(fixture.receiptRoot, "current.json"), JSON.stringify(current));
    await rm(join(fixture.receiptRoot, "pending.json"));
    await mkdir(dirname(cachedRuntimePath(fixture, current)), { recursive: true });
    await writeFile(cachedRuntimePath(fixture, current), "tampered-runtime");
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("runtime hash does not match");
    expect(runtime.setDevelopmentCommandOverride).not.toHaveBeenCalled();
    expect(runtime.ensureReady).not.toHaveBeenCalled();
  });

  it("defers without switching bytes while runtime-owned work is active", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture("1".repeat(64), fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    runtime.admitMaintenance.mockResolvedValue({
      schemaVersion: 1,
      operationId: `development-reconcile-${fixture.receipt.pairId.slice(0, 24)}`,
      status: "deferred",
      retryAfterMs: 1_000,
      activeWorkKinds: ["subagent"],
    });
    const verifyFrontendBootstrap = vi.fn(async () => activationProof(fixture.receipt.pairId));
    const coordinator = createCoordinator(fixture, runtime.manager, verifyFrontendBootstrap);

    await expect(coordinator.adoptPending()).resolves.toBe("deferred");
    expect(runtime.commitMaintenance).not.toHaveBeenCalled();
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(verifyFrontendBootstrap).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "pending.json"), "utf8"))).toMatchObject({ state: "pending" });
  });

  it("rejects a stale ready fingerprint and restores the stopped pre-adoption state", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(
      null,
      fixture.receipt.runtime.developmentBuildFingerprint,
      fixture.receipt.runtime.version,
      null,
      "9".repeat(64),
    );
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
    );

    await expect(coordinator.adoptPending()).rejects.toThrow(/does not match/u);
    expect(runtime.stop).toHaveBeenCalledOnce();
    await expect(readFile(join(fixture.receiptRoot, "pending.json"))).rejects.toThrow();
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"))).toMatchObject({
      status: "failed",
      code: "adoption-failed",
      rollback: { status: "restored-stopped-state" },
    });
  });

  it("rejects a pending pair built for a different frontend protocol", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
      { frontendProtocolVersion: 1 },
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("frontend protocol is unsupported");
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(runtime.stop).not.toHaveBeenCalled();
    await expect(readFile(join(fixture.receiptRoot, "pending.json"))).rejects.toThrow();
  });

  it("rejects a pair ID that is not bound to the exact staged contents", async () => {
    const fixture = await createFixture();
    await writeFile(
      join(fixture.receiptRoot, "pending.json"),
      JSON.stringify({ ...fixture.receipt, pairId: "a".repeat(64) }),
    );
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("identity does not match its exact contents");
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    const result = JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"));
    expect(result).toMatchObject({ status: "failed", code: "adoption-failed" });
    expect(result).not.toHaveProperty("rollback");
  });

  it("treats an unreachable persisted runtime lease as a stopped pre-adoption state", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    runtime.reattachExistingForMaintenance.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
    );

    await expect(coordinator.adoptPending()).resolves.toBe("activated");
    expect(runtime.ensureReady).toHaveBeenCalledWith(
      { reason: "manual-restart" },
      expect.objectContaining({ developmentBuildFingerprint: fixture.receipt.runtime.developmentBuildFingerprint }),
    );
  });

  it("records a bounded bootstrap timeout and restores a first-pair stopped state", async () => {
    const fixture = await createFixture();
    const runtime = runtimeFixture(null, fixture.receipt.runtime.developmentBuildFingerprint, fixture.receipt.runtime.version);
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(() => new Promise<DevelopmentPairActivationProof>(() => {})),
      { bootstrapTimeoutMs: 10 },
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("timed out after 10ms");
    await expect(readFile(join(fixture.receiptRoot, "current.json"))).rejects.toThrow();
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"))).toMatchObject({
      schemaVersion: 2,
      pairId: fixture.receipt.pairId,
      status: "failed",
      code: "frontend-bootstrap-timeout",
      timeoutMs: 10,
      rollback: { status: "restored-stopped-state" },
    });
  });

  it("retains a stopped state instead of reconnecting an unreceipted configured runtime", async () => {
    const fixture = await createFixture();
    const priorFingerprint = "d".repeat(64);
    const runtime = runtimeFixture(
      priorFingerprint,
      fixture.receipt.runtime.developmentBuildFingerprint,
      fixture.receipt.runtime.version,
      priorFingerprint,
    );
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => { throw new Error("bootstrap failed"); }),
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("bootstrap failed");
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(runtime.ensureReady).toHaveBeenCalledOnce();
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"))).toMatchObject({
      code: "frontend-bootstrap-failed",
      rollback: { status: "restored-stopped-state" },
    });
  });

  it("retains a stopped state when maintenance commit fails before the trial starts", async () => {
    const fixture = await createFixture();
    const priorFingerprint = "d".repeat(64);
    const runtime = runtimeFixture(
      priorFingerprint,
      fixture.receipt.runtime.developmentBuildFingerprint,
      fixture.receipt.runtime.version,
      priorFingerprint,
    );
    runtime.admitMaintenance.mockResolvedValueOnce({
      schemaVersion: 1,
      operationId: "operation-1",
      status: "admitted",
      leaseId: "lease-1",
      expiresAt: Date.now() + 10_000,
    });
    runtime.commitMaintenance.mockRejectedValueOnce(new Error("commit failed after shutdown"));
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => activationProof(fixture.receipt.pairId)),
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("commit failed after shutdown");
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(runtime.ensureReady).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"))).toMatchObject({
      code: "adoption-failed",
      rollback: { status: "restored-stopped-state" },
    });
  });

  it("restores the exact previous pair runtime when frontend bootstrap fails", async () => {
    const fixture = await createFixture();
    const previous = await writePreviousReceipt(fixture);
    const runtime = runtimeFixture(
      previous.runtime.developmentBuildFingerprint,
      fixture.receipt.runtime.developmentBuildFingerprint,
      fixture.receipt.runtime.version,
      previous.runtime.developmentBuildFingerprint,
    );
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => { throw new Error("bootstrap failed"); }),
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("bootstrap failed");
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(runtime.ensureReady).toHaveBeenLastCalledWith(
      { reason: "automatic-restart" },
      expect.objectContaining({
        command: cachedRuntimePath(fixture, previous),
        developmentBuildFingerprint: previous.runtime.developmentBuildFingerprint,
      }),
    );
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "current.json"), "utf8"))).toMatchObject({
      pairId: previous.pairId,
      state: "current",
    });
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"))).toMatchObject({
      rollback: { status: "restored-previous-pair" },
    });
  });

  it("does not reconnect a previous runtime when its connector bytes are no longer installed", async () => {
    const fixture = await createFixture();
    const previous = await writePreviousReceipt(fixture, {
      connectorArtifacts: fixture.receipt.connectorArtifacts.map((artifact) => artifact.file === "main.js"
        ? { ...artifact, size: 12, sha256: sha256("old-main.js\n") }
        : artifact),
    });
    const runtime = runtimeFixture(
      previous.runtime.developmentBuildFingerprint,
      fixture.receipt.runtime.developmentBuildFingerprint,
      fixture.receipt.runtime.version,
      previous.runtime.developmentBuildFingerprint,
    );
    const coordinator = createCoordinator(
      fixture,
      runtime.manager,
      vi.fn(async () => { throw new Error("bootstrap failed"); }),
    );

    await expect(coordinator.adoptPending()).rejects.toThrow("bootstrap failed");
    expect(runtime.stop).toHaveBeenCalledOnce();
    expect(runtime.ensureReady).toHaveBeenCalledOnce();
    expect(runtime.setDevelopmentCommandOverride).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(join(fixture.receiptRoot, "adoption-result.json"), "utf8"))).toMatchObject({
      rollback: {
        status: "restored-stopped-state",
        detail: "Previous connector artifacts are not installed as the exact receipted pair",
      },
    });
  });
});

interface CoordinatorFixture {
  vaultRoot: string;
  externalRuntimeCacheRoot: string;
  pluginRoot: string;
  receiptRoot: string;
  receipt: Awaited<ReturnType<typeof createFixture>>["receipt"];
}

function createCoordinator(
  fixture: CoordinatorFixture,
  runtime: ChatobbyRuntimeManager,
  verifyFrontendBootstrap: (
    runtime: ReadyRuntime,
    pairId: string,
    timeoutMs: number,
    signal: AbortSignal,
  ) => Promise<DevelopmentPairActivationProof>,
  overrides: { frontendProtocolVersion?: number; bootstrapTimeoutMs?: number } = {},
): DevelopmentPairCoordinator {
  return new DevelopmentPairCoordinator({
    enabled: true,
    vaultRoot: fixture.vaultRoot,
    configDir: ".obsidian",
    pluginRoot: fixture.pluginRoot,
    externalRuntimeCacheRoot: fixture.externalRuntimeCacheRoot,
    runtime,
    protocolVersion: 4,
    frontendProtocolVersion: overrides.frontendProtocolVersion ?? 2,
    verifyFrontendBootstrap,
    ...(overrides.bootstrapTimeoutMs ? { bootstrapTimeoutMs: overrides.bootstrapTimeoutMs } : {}),
  });
}

async function createFixture() {
  const vaultRoot = await mkdtemp(join(tmpdir(), "chatobby-dev-pair-"));
  roots.push(vaultRoot);
  const externalRuntimeCacheRoot = await mkdtemp(join(tmpdir(), "chatobby-external-pair-"));
  roots.push(externalRuntimeCacheRoot);
  const pluginRoot = join(vaultRoot, ".obsidian", "plugins", "chatobby");
  const receiptRoot = join(vaultRoot, ".obsidian", ".chatobby-dev", "development-pair");
  await mkdir(pluginRoot, { recursive: true });
  await mkdir(receiptRoot, { recursive: true });
  const markerPath = join(vaultRoot, ".obsidian", ".chatobby-dev-vault.json");
  await writeFile(markerPath, "marker\n");
  const runtimePath = join(vaultRoot, "source", "packages", "chatobby", "dist", "development", "runtime.exe");
  await mkdir(dirname(runtimePath), { recursive: true });
  await writeFile(runtimePath, "runtime");
  const connectorArtifacts = [];
  for (const file of ["main.js", "manifest.json", "styles.css"] as const) {
    const content = `${file}\n`;
    await writeFile(join(pluginRoot, file), content);
    connectorArtifacts.push({ file, size: Buffer.byteLength(content), sha256: sha256(content) });
  }
  const receiptBase = {
    schemaVersion: 3 as const,
    state: "pending" as const,
    action: "paired-contract" as const,
    createdAt: "2026-09-04T00:00:00.000Z",
    source: { revision: "1".repeat(40), dirty: false, contentFingerprint: "b".repeat(64) },
    connector: { revision: "2".repeat(40), dirty: false, contentFingerprint: "f".repeat(64) },
    protocol: { runtime: 4, frontend: 2, projectionSha256: "c".repeat(64) },
    runtime: {
      version: "0.4.3",
      path: runtimePath,
      sha256: sha256("runtime"),
      developmentBuildFingerprint: "b".repeat(64),
      assets: await writeAssets(dirname(runtimePath)),
    },
    connectorArtifacts,
    vault: { root: vaultRoot, markerSha256: sha256("marker\n") },
    timingsMs: {},
    observations: [],
  };
  const receipt = { ...receiptBase, pairId: developmentPairId(receiptBase) };
  await writeFile(join(receiptRoot, "pending.json"), JSON.stringify(receipt));
  return { vaultRoot, pluginRoot, receiptRoot, receipt, externalRuntimeCacheRoot };
}

async function writePreviousReceipt(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  overrides: { connectorArtifacts?: typeof fixture.receipt.connectorArtifacts } = {},
) {
  const runtimePath = join(fixture.vaultRoot, "previous", "runtime.exe");
  await mkdir(dirname(runtimePath), { recursive: true });
  await writeFile(runtimePath, "previous-runtime");
  const previousBase = {
    ...fixture.receipt,
    schemaVersion: 1 as const,
    state: "current" as const,
    source: { contentFingerprint: "d".repeat(64) },
    runtime: {
      version: fixture.receipt.runtime.version,
      path: runtimePath,
      sha256: sha256("previous-runtime"),
      developmentBuildFingerprint: "d".repeat(64),
    },
    connectorArtifacts: overrides.connectorArtifacts ?? fixture.receipt.connectorArtifacts,
  };
  const previous = { ...previousBase, pairId: developmentPairId(previousBase) };
  await writeFile(join(fixture.receiptRoot, "current.json"), JSON.stringify(previous));
  return previous;
}

function activationProof(pairId: string, timeoutMs = 20_000): DevelopmentPairActivationProof {
  return {
    status: "frontend-bootstrap-complete",
    pairId,
    runtimeInstanceId: "instance",
    frontendProtocolVersion: 2,
    viewId: "development-pair-view",
    selectedCapabilities: ["atomic-bootstrap-cutover"],
    subscriptionStatus: "bootstrapped",
    subscriptionSequence: 2,
    subscriptionRevision: 3,
    bootstrapRuntimeInstanceId: "instance",
    bootstrapViewId: "development-pair-view",
    bootstrapSequence: 2,
    bootstrapRevision: 3,
    completedAt: "2026-09-04T00:00:00.000Z",
    timeoutMs,
  };
}

function cachedRuntimePath(
  fixture: CoordinatorFixture,
  receipt: { schemaVersion: number; state?: string; runtimeCacheLocation?: string; runtime: { path: string; sha256: string; assets?: RuntimeAssetFile[] } } = fixture.receipt,
): string {
  const identity = receipt.schemaVersion === 3 ? sha256(JSON.stringify({ runtime: receipt.runtime.sha256, assets: receipt.runtime.assets })) : receipt.runtime.sha256;
  const cache = receipt.state === "pending" || receipt.runtimeCacheLocation === "external-v1"
    ? fixture.externalRuntimeCacheRoot
    : join(fixture.receiptRoot, "runtimes");
  return join(cache, identity, basename(receipt.runtime.path));
}

function runtimeFixture(
  existingFingerprint: string | null,
  targetFingerprint: string,
  version: string,
  configuredFingerprint: string | null = existingFingerprint,
  commandFingerprintOverride?: string,
) {
  const identity = (developmentBuildFingerprint: string | null) => ({
    instanceId: "instance",
    vaultId: "vault",
    pid: 1,
    startedAt: 1,
    runtimeVersion: version,
    protocolVersion: 4,
    runtimePackageFingerprint: null,
    developmentBuildFingerprint,
  });
  const reattachExistingForMaintenance = vi.fn(async () => (
    existingFingerprint ? { identity: identity(existingFingerprint) } : null
  ));
  const ensureReady = vi.fn(async (
    _request: { reason: string },
    command?: { developmentBuildFingerprint?: string },
  ) => ({
    identity: identity(
      command
        ? commandFingerprintOverride ?? command.developmentBuildFingerprint ?? targetFingerprint
        : configuredFingerprint ?? targetFingerprint,
    ),
  }));
  const admitMaintenance = vi.fn(async (): Promise<RuntimeMaintenanceAdmission | null> => existingFingerprint ? {
    schemaVersion: 1, status: "admitted", operationId: "fixture-operation", leaseId: "fixture-lease", expiresAt: Date.now() + 10_000,
  } : null);
  const commitMaintenance = vi.fn(async () => {});
  const stop = vi.fn(async () => {});
  const setDevelopmentCommandOverride = vi.fn();
  const manager = {
    setDevelopmentCommandOverride,
    reattachExistingForMaintenance,
    ensureReady,
    admitMaintenance,
    commitMaintenance,
    cancelMaintenance: vi.fn(async () => {}),
    stop,
  } as unknown as ChatobbyRuntimeManager;
  return {
    manager,
    reattachExistingForMaintenance,
    ensureReady,
    admitMaintenance,
    commitMaintenance,
    stop,
    setDevelopmentCommandOverride,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function developmentPairId(receipt: {
  schemaVersion: number;
  source: { contentFingerprint: string };
  connector: { contentFingerprint: string };
  protocol: { runtime: number; frontend: number; projectionSha256: string };
  runtime: { version: string; sha256: string; assets?: RuntimeAssetFile[] };
  connectorArtifacts: unknown[];
  vault: { markerSha256: string };
}): string {
  return sha256(JSON.stringify({
    source: receipt.source.contentFingerprint,
    connector: receipt.connector.contentFingerprint,
    projection: receipt.protocol.projectionSha256,
    protocol: {
      version: receipt.runtime.version,
      protocolVersion: receipt.protocol.runtime,
      frontendProtocolVersion: receipt.protocol.frontend,
    },
    runtime: receipt.runtime.sha256,
    ...(receipt.schemaVersion === 3 ? { runtimeAssets: receipt.runtime.assets } : {}),
    artifacts: receipt.connectorArtifacts,
    vault: receipt.vault.markerSha256,
  }));
}

async function addWindowsHelper(fixture: CoordinatorFixture): Promise<void> {
  const core = ["", "-relaxedsimd", "-simd"].flatMap((variant) =>
    ["", "-lstm"].flatMap((model) =>
      ["js", "wasm", "wasm.js"].map((extension) => `assets/node_modules/tesseract.js-core/tesseract-core${variant}${model}.${extension}`),
    ),
  );
  fixture.receipt.runtime.assets = await writeAssets(dirname(fixture.receipt.runtime.path), [
    ...new Set([...RUNTIME_REQUIRED_ASSET_PATHS, ...core, ...WINDOWS_SANDBOX_ASSET_PATHS]),
  ]);
  fixture.receipt.pairId = developmentPairId(fixture.receipt);
  await writeFile(join(fixture.receiptRoot, "pending.json"), JSON.stringify(fixture.receipt));
}

async function writeAssets(root: string, paths: readonly string[] = RUNTIME_REQUIRED_ASSET_PATHS): Promise<RuntimeAssetFile[]> {
  const assets = [];
  for (const path of [...paths].sort()) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), "fixture asset");
    assets.push({ path, size: 13, sha256: sha256("fixture asset") });
  }
  return assets;
}
