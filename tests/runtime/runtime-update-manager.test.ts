import { describe, expect, it, vi } from "vitest";
import { RuntimeUpdateManager } from "../../src/runtime/public";
import type { RuntimePackageManifest } from "../../src/runtime/infrastructure/runtime-installation";
import type {
  RuntimeUpdateClientLike,
  RuntimeUpdateDescriptor,
} from "../../src/runtime/infrastructure/runtime-update-client";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

describe("RuntimeUpdateManager", () => {
  it.each(["subagent", "response", "event"] as const)("an explicit update stops %s work even on an older runtime", async (kind) => {
    const stopRuntime = vi.fn(async () => {});
    const installer = installerFor();
    let manager!: RuntimeUpdateManager;
    manager = new RuntimeUpdateManager({
      ...deps(clientFor(descriptor("0.1.3")), installer, "0.1.2"),
      admitMaintenance: vi.fn(async () => ({ schemaVersion: 1, operationId: "update", status: "deferred", retryAfterMs: 1000, activeWorkKinds: [kind] })),
      stopRuntime,
      startRuntime: async () => { await manager.activatePendingRuntime({ runtimeVersion: "0.1.3", runtimePackageFingerprint: "f".repeat(64), operation: "activate" }); },
    });
    await manager.check();
    await expect(manager.install(undefined, true)).resolves.toBe("0.1.3");
    expect(stopRuntime).toHaveBeenCalledOnce();
    expect(installer.prepareInstall).toHaveBeenCalledOnce();
    expect(manager.state).toMatchObject({ status: "current", installedVersion: "0.1.3" });
  });

  it("does not install when stopping the old runtime fails", async () => {
    const installer = installerFor();
    const manager = new RuntimeUpdateManager({
      ...deps(clientFor(descriptor("0.1.3")), installer, "0.1.2"),
      stopRuntime: async () => { throw new Error("previous runtime has not stopped"); },
    });
    await manager.check();
    await expect(manager.install(undefined, true)).rejects.toThrow("previous runtime has not stopped");
    expect(installer.prepareInstall).not.toHaveBeenCalled();
  });
  it("uses an exact verified installed runtime without a network request", async () => {
    const client = clientFor(descriptor("0.1.3"));
    const installer = installerFor();
    const manager = new RuntimeUpdateManager(deps(client, installer, "0.1.3"));

    await expect(manager.ensureRequiredRuntime()).resolves.toBe("current");
    expect(client.fetchExact).not.toHaveBeenCalled();
    expect(manager.state).toMatchObject({ status: "current", installedVersion: "0.1.3" });
  });

  it("does not automatically downgrade a newer unverified pointer", async () => {
    const client = clientFor(descriptor("0.1.3"));
    const installer = installerFor();
    const managerDeps = deps(client, installer, "0.1.4");
    managerDeps.installer.readVerifiedInstalledVersion = vi.fn(async () => {
      throw new Error("not compatible with this connector");
    });
    const manager = new RuntimeUpdateManager(managerDeps);

    await expect(manager.ensureRequiredRuntime()).rejects.toThrow("will not downgrade it");
    expect(client.fetchExact).not.toHaveBeenCalled();
    expect(installer.prepareInstall).not.toHaveBeenCalled();
  });

  it("advertises newer releases without installing them", async () => {
    const client = clientFor(descriptor("0.1.3"));
    const installer = installerFor();
    const manager = new RuntimeUpdateManager(deps(client, installer, "0.1.2"));

    await manager.checkIfNeeded();

    expect(manager.state).toMatchObject({ status: "available", installedVersion: "0.1.2" });
    expect(installer.prepareInstall).not.toHaveBeenCalled();
  });

  it("stages before stopping, installs atomically, and reconnects", async () => {
    const order: string[] = [];
    const update = descriptor("0.1.3");
    const client: RuntimeUpdateClientLike = {
      fetchExact: vi.fn(async () => update),
      stage: vi.fn(async (_descriptor, _pluginVersion, _signal, progress) => {
        order.push("stage");
        progress({ phase: "downloading", completed: 10, total: 10 });
        return { directory: "staged", manifest: manifest("0.1.3"), cleanup: async () => { order.push("cleanup"); } };
      }),
    };
    const installer = {
      prepareInstall: vi.fn(async () => {
        order.push("install");
        return {
          executable: "runtime",
          runtimeVersion: "0.1.3",
          runtimePackageFingerprint: "f".repeat(64),
          activate: async () => { order.push("activate"); },
          finalize: async () => { order.push("finalize"); },
          rollback: async () => { order.push("rollback"); },
        };
      }),
    };
    let manager!: RuntimeUpdateManager;
    manager = new RuntimeUpdateManager({
      ...deps(client, installer, "0.1.2"),
      stopRuntime: async () => { order.push("stop"); },
      startRuntime: async (command) => {
        order.push("start");
        expect(command).toMatchObject({ runtimeActivationRequired: true });
        await manager.activatePendingRuntime({
          runtimeVersion: "0.1.3",
          runtimePackageFingerprint: "f".repeat(64),
          operation: "activate",
        });
      },
    });

    await manager.check();
    await expect(manager.install()).resolves.toBe("0.1.3");

    expect(order).toEqual(["stage", "stop", "install", "start", "activate", "finalize", "cleanup"]);
    expect(manager.state).toMatchObject({ status: "current", installedVersion: "0.1.3" });
  });

  it("does not interrupt active work and restarts the previous runtime after an install failure", async () => {
    const update = descriptor("0.1.3");
    const client = clientFor(update);
    const blocked = new RuntimeUpdateManager({
      ...deps(client, installerFor(), "0.1.2"),
      admitMaintenance: vi.fn(async () => ({
        schemaVersion: 1 as const,
        operationId: "runtime-update-test",
        status: "deferred" as const,
        retryAfterMs: 1_000,
        activeWorkKinds: ["response" as const],
      })),
    });
    await blocked.check();
    await expect(blocked.install()).resolves.toBe("0.1.2");
    expect(client.stage).toHaveBeenCalledOnce();
    expect(blocked.state).toMatchObject({ status: "deferred", reason: "active-work" });

    const order: string[] = [];
    const failing = new RuntimeUpdateManager({
      ...deps(clientFor(update), {
        prepareInstall: vi.fn(async () => {
          order.push("install");
          throw new Error("disk full");
        }),
      }, "0.1.2"),
      stopRuntime: async () => { order.push("stop"); },
      startRuntime: async () => { order.push("restart previous"); },
    });
    await failing.check();
    await expect(failing.install()).rejects.toThrow("disk full");
    expect(order).toEqual(["stop", "install", "restart previous"]);
    expect(failing.state).toMatchObject({ status: "error", descriptor: update });
  });

  it("offers a verified same-version package when repair is requested", async () => {
    const update = descriptor("0.1.3");
    const installer = installerFor();
    let manager!: RuntimeUpdateManager;
    manager = new RuntimeUpdateManager({
      ...deps(clientFor(update), installer, "0.1.3"),
      startRuntime: async () => {
        await manager.activatePendingRuntime({
          runtimeVersion: "0.1.3",
          runtimePackageFingerprint: "f".repeat(64),
          operation: "activate",
        });
      },
    });

    await manager.check();
    expect(manager.state).toMatchObject({ status: "current", installedVersion: "0.1.3" });

    await manager.checkForRepair();
    expect(manager.state).toMatchObject({ status: "available", kind: "repair", installedVersion: "0.1.3" });

    await expect(manager.install()).resolves.toBe("0.1.3");
    expect(installer.prepareInstall).toHaveBeenCalledOnce();
  });

  it("rolls back the pending package when the replacement cannot reconnect", async () => {
    const update = descriptor("0.1.3");
    const activate = vi.fn(async () => {});
    const finalize = vi.fn(async () => {});
    const rollback = vi.fn(async () => {});
    const startRuntime = vi.fn()
      .mockRejectedValueOnce(new Error("replacement failed to start"))
      .mockResolvedValueOnce(undefined);
    const manager = new RuntimeUpdateManager({
      ...deps(clientFor(update), {
        prepareInstall: vi.fn(async () => ({
          executable: "runtime",
          runtimeVersion: "0.1.3",
          runtimePackageFingerprint: "f".repeat(64),
          activate,
          finalize,
          rollback,
        })),
      }, "0.1.2"),
      startRuntime,
    });

    await manager.check();
    await expect(manager.install()).rejects.toThrow("replacement failed to start");

    expect(activate).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(rollback).toHaveBeenCalledOnce();
    expect(startRuntime).toHaveBeenCalledTimes(2);
  });

  it("allows only the authenticated candidate identity to activate or roll back", async () => {
    const installation = {
      executable: "runtime",
      runtimeVersion: "0.1.3",
      runtimePackageFingerprint: "f".repeat(64),
      activate: vi.fn(async () => {}),
      finalize: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };
    let manager!: RuntimeUpdateManager;
    manager = new RuntimeUpdateManager({
      ...deps(clientFor(descriptor("0.1.3")), { prepareInstall: vi.fn(async () => installation) }, "0.1.2"),
      startRuntime: async () => {
        await expect(manager.activatePendingRuntime({
          runtimeVersion: "0.1.4",
          runtimePackageFingerprint: installation.runtimePackageFingerprint,
          operation: "activate",
        })).rejects.toThrow("does not match");
        await manager.activatePendingRuntime({
          runtimeVersion: installation.runtimeVersion,
          runtimePackageFingerprint: installation.runtimePackageFingerprint,
          operation: "activate",
        });
      },
    });

    await manager.check();
    await manager.install();

    expect(installation.activate).toHaveBeenCalledOnce();
    expect(installation.finalize).toHaveBeenCalledOnce();
    expect(installation.rollback).not.toHaveBeenCalled();
  });

  it("rolls back a recovered prepared installation before runtime startup", async () => {
    const rollback = vi.fn(async () => {});
    const stopRuntime = vi.fn(async () => {});
    const manager = new RuntimeUpdateManager({
      ...deps(clientFor(descriptor("0.1.3")), installerFor(), "0.1.2"),
      installer: {
        prepareInstall: installerFor().prepareInstall,
        readVerifiedInstalledVersion: vi.fn(async () => "0.1.2"),
        resumePendingInstall: vi.fn(async () => ({
          executable: "runtime",
          runtimeVersion: "0.1.3",
          runtimePackageFingerprint: "f".repeat(64),
          activationState: "prepared" as const,
          activate: vi.fn(async () => {}),
          finalize: vi.fn(async () => {}),
          rollback,
        })),
      },
      stopRuntime,
    });

    await expect(manager.recoverInterruptedInstallation()).resolves.toBe("rolled-back");
    expect(stopRuntime).toHaveBeenCalledOnce();
    expect(rollback).toHaveBeenCalledOnce();
  });

  it("finalizes only the exact recovered activated runtime identity", async () => {
    const finalize = vi.fn(async () => {});
    const rollback = vi.fn(async () => {});
    const fingerprint = "f".repeat(64);
    const manager = new RuntimeUpdateManager({
      ...deps(clientFor(descriptor("0.1.3")), installerFor(), "0.1.2"),
      installer: {
        prepareInstall: installerFor().prepareInstall,
        readVerifiedInstalledVersion: vi.fn(async () => "0.1.2"),
        resumePendingInstall: vi.fn(async () => ({
          executable: "runtime",
          runtimeVersion: "0.1.3",
          runtimePackageFingerprint: fingerprint,
          activationState: "activated" as const,
          activate: vi.fn(async () => {}),
          finalize,
          rollback,
        })),
      },
    });

    await expect(manager.recoverInterruptedInstallation()).resolves.toBe("awaiting-runtime");
    await expect(manager.finalizeRecoveredRuntime({
      instanceId: "instance",
      vaultId: "vault",
      pid: 1,
      startedAt: 1,
      runtimeVersion: "0.1.2",
      protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
      runtimePackageFingerprint: fingerprint,
    })).rejects.toThrow("does not match");
    expect(finalize).not.toHaveBeenCalled();

    await manager.finalizeRecoveredRuntime({
      instanceId: "instance",
      vaultId: "vault",
      pid: 1,
      startedAt: 1,
      runtimeVersion: "0.1.3",
      protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
      runtimePackageFingerprint: fingerprint,
    });
    expect(finalize).toHaveBeenCalledOnce();
    expect(rollback).not.toHaveBeenCalled();
  });
  it.each(["accepted", "failed"] as const)("coordinates recovered rollback with %s concurrent finalization", async (outcome) => {
    let accept!: () => void;
    let reject!: (error: Error) => void;
    const acceptance = new Promise<void>((resolve, rejectPromise) => { accept = resolve; reject = rejectPromise; });
    const finalize = vi.fn(() => acceptance);
    const rollback = vi.fn(async () => {});
    const stopRuntime = vi.fn(async () => {});
    const base = deps(clientFor(descriptor("0.1.3")), installerFor(), "0.1.2");
    const manager = new RuntimeUpdateManager({
      ...base,
      installer: {
        ...base.installer,
        resumePendingInstall: async () => ({
          executable: "runtime", runtimeVersion: "0.1.3", runtimePackageFingerprint: "f".repeat(64),
          activationState: "activated", activate: async () => {}, finalize, rollback,
        }),
      },
      stopRuntime,
    });
    await manager.recoverInterruptedInstallation();
    const identity = {
      instanceId: "instance", vaultId: "vault", pid: 1, startedAt: 1,
      runtimeVersion: "0.1.3", protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
      runtimePackageFingerprint: "f".repeat(64),
    };
    const finalizations = Promise.allSettled(Array.from({ length: 4 }, () => manager.finalizeRecoveredRuntime(identity)));
    await expect(manager.finalizeRecoveredRuntime({ ...identity, runtimePackageFingerprint: "e".repeat(64) }))
      .rejects.toThrow("does not match");
    const rollbacks = Promise.all(Array.from({ length: 4 }, () => manager.rollbackRecoveredRuntime()));
    await Promise.resolve();
    expect(finalize).toHaveBeenCalledOnce();
    expect(stopRuntime).not.toHaveBeenCalled();
    if (outcome === "accepted") accept();
    else reject(new Error("journal write failed before cleanup"));
    const results = await finalizations;
    expect(results.every((result) => result.status === (outcome === "accepted" ? "fulfilled" : "rejected"))).toBe(true);
    expect(await rollbacks).toEqual(Array.from({ length: 4 }, () => outcome === "failed"));
    expect(stopRuntime).toHaveBeenCalledTimes(outcome === "failed" ? 1 : 0);
    expect(rollback).toHaveBeenCalledTimes(outcome === "failed" ? 1 : 0);
    await expect(manager.rollbackRecoveredRuntime()).resolves.toBe(false);
  });
});

function deps(
  client: RuntimeUpdateClientLike,
  installer: {
    prepareInstall: (
      source: string,
      manifest: RuntimePackageManifest,
      pluginVersion: string,
    ) => Promise<{
      executable: string;
      runtimeVersion: string;
      runtimePackageFingerprint: string;
      activate(): Promise<void>;
      finalize(): Promise<void>;
      rollback(): Promise<void>;
    }>;
  },
  installedVersion: string | null,
) {
  return {
    pluginVersion: "0.1.3",
    enabled: true,
    client,
    installer: {
      resumePendingInstall: vi.fn(async () => null),
      readVerifiedInstalledVersion: vi.fn(async () => installedVersion),
      prepareInstall: async (source: string, manifest: RuntimePackageManifest, pluginVersion: string) => ({
        activationState: "prepared" as const,
        ...await installer.prepareInstall(source, manifest, pluginVersion),
      }),
    },
    getInstalledVersion: () => installedVersion,
    admitMaintenance: vi.fn(async () => null),
    cancelMaintenance: vi.fn(async () => {}),
    commitMaintenance: vi.fn(async () => {}),
    stopRuntime: vi.fn(async () => {}),
    startRuntime: vi.fn(async () => {}),
  };
}

function installerFor() {
  return {
    resumePendingInstall: vi.fn(async () => null),
    readVerifiedInstalledVersion: vi.fn(async () => null),
    prepareInstall: vi.fn(async () => ({
      executable: "runtime",
      runtimeVersion: "0.1.3",
      runtimePackageFingerprint: "f".repeat(64),
      activationState: "prepared" as const,
      activate: vi.fn(async () => {}),
      finalize: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    })),
  };
}

function clientFor(update: RuntimeUpdateDescriptor): RuntimeUpdateClientLike {
  return {
    fetchExact: vi.fn(async () => update),
    stage: vi.fn(async () => ({
      directory: "staged",
      manifest: manifest(update.version),
      cleanup: vi.fn(async () => {}),
    })),
  };
}

function descriptor(version: string): RuntimeUpdateDescriptor {
  return {
    schemaVersion: 1,
    product: "Chatobby Runtime",
    version,
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    platform: process.platform,
    arch: process.arch,
    bundle: {
      format: "chatobby-runtime-bundle-v1",
      file: `chatobby-runtime-${version}-${process.platform}-${process.arch}.cbr.gz`,
      size: 10,
      sha256: "a".repeat(64),
      uncompressedSize: 20,
      entryCount: 1,
    },
    signatureAlgorithm: "ed25519",
    signature: "fixture",
  };
}

function manifest(version: string): RuntimePackageManifest {
  return {
    schemaVersion: 2,
    version,
    protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
    minimumPluginVersion: "0.1.0",
    maximumPluginVersion: "0.1.x",
    platform: process.platform,
    arch: process.arch,
    executable: process.platform === "win32" ? "chatobby.exe" : "chatobby",
    files: [],
    signatureAlgorithm: "ed25519",
    signature: "fixture",
  };
}
