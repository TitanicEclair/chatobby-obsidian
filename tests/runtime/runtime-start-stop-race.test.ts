import { describe, expect, it, vi } from "vitest";
import { DefaultChatobbyRuntimeManager } from "../../src/runtime/application/runtime-manager";
import type { ManagedProcessExit, RuntimeLeaseCandidate } from "../../src/runtime/contracts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("runtime startup cancellation boundary", () => {
  it("drains a late managed process before launching its replacement", async () => {
    const spawned = deferred();
    const firstSpawn = deferred();
    const released = deferred();
    let finishExit!: (exit: ManagedProcessExit) => void;
    const exited = new Promise<ManagedProcessExit>((resolve) => { finishExit = resolve; });
    let candidate: RuntimeLeaseCandidate | null = null;
    let sequence = 0;
    const paths = { directory: "/test/runtime", descriptorFile: "/test/runtime/ready.json", controlTokenFile: "/test/runtime/control", sessionTokenFile: "/test/runtime/session", logFile: "/test/runtime/log" };
    const firstTerminate = vi.fn(async () => {
      await released.promise;
      candidate = null;
      finishExit({ code: 0, signal: null, expected: true });
    });
    const spawn = vi.fn(async () => {
      if (sequence === 1) { spawned.resolve(); await firstSpawn.promise; }
      candidate = {
        descriptor: { schemaVersion: 2, instanceId: `instance-${sequence}`, vaultId: "test-vault", pid: sequence, startedAt: 1, runtimeVersion: "0.5.2", protocolVersion: 2, runtimePackageFingerprint: null, host: "127.0.0.1", port: 7777, controlTokenFingerprint: "a".repeat(64), sessionTokenFingerprint: "b".repeat(64) },
        controlToken: "test-control", sessionToken: "test-session", paths,
      };
      return { pid: sequence, startedAt: 1, exited: sequence === 1 ? exited : Promise.resolve({ code: 0, signal: null, expected: true }), recentLogs: () => [], terminate: sequence === 1 ? firstTerminate : async () => {} };
    });
    const manager = new DefaultChatobbyRuntimeManager({
      getConfiguration: () => ({ mode: "managed", lifetime: "obsidian-session", externalUrl: "", developerCommand: "", developerArgs: [] }),
      getVaultPaths: () => ({ vaultRoot: "/test/vault", chatobbyRoot: "/test/vault/.chatobby", agentDir: "/test/vault/.chatobby/agent", attachmentDir: "/test/vault/.chatobby/attachments", vaultId: "test-vault", legacyVaultId: "test-vault" }),
      assertRuntimeStartAllowed() {},
      resolveManagedCommand: () => ({ command: "chatobby-test", args: [] }),
      connectRuntime: async () => {}, disconnectRuntime: async () => {},
      pluginVersion: "0.5.2",
      processLauncher: { spawn },
      leaseStore: {
        readCandidate: async () => candidate,
        prepare: async () => ({ instanceId: `instance-${++sequence}`, vaultId: "test-vault", controlToken: "test-control", sessionToken: "test-session", paths }),
        discardStaleDescriptor: async () => {},
      },
      controlClient: {
        status: async () => ({}), detach: async () => {}, shutdown: async () => {},
        admitMaintenance: async () => { throw new Error("Not used by this fixture"); },
        cancelMaintenance: async () => ({}), commitMaintenance: async () => ({}),
      },
    });
    const starting = manager.ensureReady({ reason: "view-open" });
    const cancelled = expect(starting).rejects.toThrow("startup was cancelled");
    await spawned.promise;
    const restarting = manager.restart("user-action");
    const ready = expect(restarting).resolves.toMatchObject({ identity: { instanceId: "instance-2" } });
    firstSpawn.resolve();
    await vi.waitFor(() => expect(firstTerminate).toHaveBeenCalledOnce());
    try {
      expect(spawn).toHaveBeenCalledOnce();
      expect(manager.state.status).toBe("stopping");
    } finally {
      released.resolve();
      await cancelled;
      await ready;
      await manager.stop("user-action");
    }
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(firstTerminate).toHaveBeenCalledOnce();
  });

  it("starts a fresh attempt when Restart interrupts an in-flight connection", async () => {
    const firstConnection = deferred();
    const connectRuntime = vi.fn(async () => {});
    connectRuntime.mockImplementationOnce(() => firstConnection.promise);
    const manager = new DefaultChatobbyRuntimeManager({
      getConfiguration: () => ({ mode: "external", lifetime: "obsidian-session", externalUrl: "ws://127.0.0.1:7777", developerCommand: "", developerArgs: [] }),
      getVaultPaths: () => null,
      assertRuntimeStartAllowed() {},
      resolveManagedCommand: () => null,
      connectRuntime,
      disconnectRuntime: async () => {},
      pluginVersion: "0.5.2",
    });
    const starting = manager.ensureReady({ reason: "view-open" });
    const cancelled = expect(starting).rejects.toThrow("startup was cancelled");
    const restarting = manager.restart("user-action");
    const ready = expect(restarting).resolves.toMatchObject({ ownership: "external" });
    await Promise.resolve();
    firstConnection.resolve();
    try {
      await cancelled;
      await ready;
      expect(connectRuntime).toHaveBeenCalledTimes(2);
      expect(manager.state.status).toBe("ready");
    } finally {
      await manager.stop("user-action");
    }
  });

  it("does not report stopped while a cancelled startup is still releasing its connection", async () => {
    const firstConnection = deferred();
    const cleanup = deferred();
    const disconnectRuntime = vi.fn(async () => {});
    disconnectRuntime.mockImplementationOnce(async () => {}).mockImplementationOnce(() => cleanup.promise);
    const manager = new DefaultChatobbyRuntimeManager({
      getConfiguration: () => ({ mode: "external", lifetime: "obsidian-session", externalUrl: "ws://127.0.0.1:7777", developerCommand: "", developerArgs: [] }),
      getVaultPaths: () => null,
      assertRuntimeStartAllowed() {},
      resolveManagedCommand: () => null,
      connectRuntime: () => firstConnection.promise,
      disconnectRuntime,
      pluginVersion: "0.5.2",
    });
    const starting = manager.ensureReady({ reason: "view-open" });
    const cancelled = expect(starting).rejects.toThrow("startup was cancelled");
    let stopped = false;
    const stopping = manager.stop("user-action").then(() => { stopped = true; });
    firstConnection.resolve();
    await vi.waitFor(() => expect(disconnectRuntime).toHaveBeenCalledTimes(2));
    try {
      expect(stopped).toBe(false);
      expect(manager.state.status).toBe("stopping");
    } finally {
      cleanup.resolve();
      await cancelled;
      await stopping;
    }
    expect(manager.state.status).toBe("idle");
  });
});
