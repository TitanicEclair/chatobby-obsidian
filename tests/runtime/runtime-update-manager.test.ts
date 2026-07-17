import { describe, expect, it, vi } from "vitest";
import { RuntimeUpdateManager } from "../../src/runtime/public";
import type { RuntimePackageManifest } from "../../src/runtime/infrastructure/runtime-installation";
import type {
  RuntimeUpdateClientLike,
  RuntimeUpdateDescriptor,
} from "../../src/runtime/infrastructure/runtime-update-client";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

describe("RuntimeUpdateManager", () => {
  it("advertises newer releases without installing them", async () => {
    const client = clientFor(descriptor("0.1.3"));
    const installer = { install: vi.fn(async () => "unused") };
    const manager = new RuntimeUpdateManager(deps(client, installer, "0.1.2"));

    await manager.checkIfNeeded();

    expect(manager.state).toMatchObject({ status: "available", installedVersion: "0.1.2" });
    expect(installer.install).not.toHaveBeenCalled();
  });

  it("stages before stopping, installs atomically, and reconnects", async () => {
    const order: string[] = [];
    const update = descriptor("0.1.3");
    const client: RuntimeUpdateClientLike = {
      fetchLatest: vi.fn(async () => update),
      stage: vi.fn(async (_descriptor, _pluginVersion, _signal, progress) => {
        order.push("stage");
        progress({ phase: "downloading", completed: 10, total: 10 });
        return { directory: "staged", manifest: manifest("0.1.3"), cleanup: async () => { order.push("cleanup"); } };
      }),
    };
    const installer = { install: vi.fn(async () => { order.push("install"); return "runtime"; }) };
    const manager = new RuntimeUpdateManager({
      ...deps(client, installer, "0.1.2"),
      stopRuntime: async () => { order.push("stop"); },
      startRuntime: async () => { order.push("start"); },
    });

    await manager.check();
    await expect(manager.install()).resolves.toBe("0.1.3");

    expect(order).toEqual(["stage", "stop", "install", "start", "cleanup"]);
    expect(manager.state).toMatchObject({ status: "current", installedVersion: "0.1.3" });
  });

  it("does not interrupt active work and restarts the previous runtime after an install failure", async () => {
    const update = descriptor("0.1.3");
    const client = clientFor(update);
    const blocked = new RuntimeUpdateManager({
      ...deps(client, { install: vi.fn() }, "0.1.2"),
      hasActiveWork: () => true,
    });
    await blocked.check();
    await expect(blocked.install()).rejects.toThrow("Finish the current Chatobby response");
    expect(client.stage).not.toHaveBeenCalled();

    const order: string[] = [];
    const failing = new RuntimeUpdateManager({
      ...deps(clientFor(update), { install: vi.fn(async () => { order.push("install"); throw new Error("disk full"); }) }, "0.1.2"),
      stopRuntime: async () => { order.push("stop"); },
      startRuntime: async () => { order.push("restart previous"); },
    });
    await failing.check();
    await expect(failing.install()).rejects.toThrow("disk full");
    expect(order).toEqual(["stop", "install", "restart previous"]);
    expect(failing.state).toMatchObject({ status: "error", descriptor: update });
  });
});

function deps(
  client: RuntimeUpdateClientLike,
  installer: { install: (source: string, manifest: RuntimePackageManifest, pluginVersion: string) => Promise<string> },
  installedVersion: string | null,
) {
  return {
    pluginVersion: "0.1.2",
    enabled: true,
    client,
    installer,
    getInstalledVersion: () => installedVersion,
    hasActiveWork: () => false,
    stopRuntime: vi.fn(async () => {}),
    startRuntime: vi.fn(async () => {}),
  };
}

function clientFor(update: RuntimeUpdateDescriptor): RuntimeUpdateClientLike {
  return {
    fetchLatest: vi.fn(async () => update),
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
