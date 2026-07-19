import { describe, expect, it, vi } from "vitest";
import {
  DefaultChatobbyRuntimeManager,
  type RuntimeControlClientLike,
  type RuntimeLeaseStoreLike,
} from "../../src/runtime/application/runtime-manager";
import type {
  ManagedProcessHandle,
  PreparedRuntimeLease,
  ReadyRuntime,
  RuntimeConfiguration,
  RuntimeLeaseCandidate,
  RuntimeReadyDescriptor,
} from "../../src/runtime/contracts";
import type { ManagedProcessLauncher } from "../../src/runtime/infrastructure/managed-process";
import { deriveRuntimeVaultId } from "../../src/runtime/infrastructure/runtime-lease-store";
import type { ChatobbyVaultRuntimePaths } from "../../src/vault-runtime";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

const VAULT_PATHS: ChatobbyVaultRuntimePaths = {
  vaultRoot: "C:\\vault",
  chatobbyRoot: "C:\\vault\\.chatobby",
  agentDir: "C:\\vault\\.chatobby\\agent",
  attachmentDir: "C:\\vault\\.chatobby\\attachments",
};

const DESCRIPTOR: RuntimeReadyDescriptor = {
  schemaVersion: 2,
  instanceId: "instance-1",
  vaultId: "vault-expected",
  pid: 100,
  startedAt: 1_700_000_000_000,
  runtimeVersion: "0.1.0",
  protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
  runtimePackageFingerprint: "c".repeat(64),
  host: "127.0.0.1",
  port: 43125,
  controlTokenFingerprint: "a".repeat(64),
  sessionTokenFingerprint: "b".repeat(64),
};

const CANDIDATE: RuntimeLeaseCandidate = {
  descriptor: DESCRIPTOR,
  controlToken: "control-token",
  sessionToken: "session-token",
  paths: {
    directory: "C:\\runtime",
    descriptorFile: "C:\\runtime\\ready.json",
    controlTokenFile: "C:\\runtime\\control.token",
    sessionTokenFile: "C:\\runtime\\session.token",
    logFile: "C:\\runtime\\runtime.log",
  },
};

describe("DefaultChatobbyRuntimeManager", () => {
  it("shares one in-flight ensureReady operation", async () => {
    const connected = deferred<void>();
    const connectRuntime = vi.fn(() => connected.promise);
    const manager = createManager({
      configuration: { mode: "external", lifetime: "obsidian-session", externalUrl: "ws://127.0.0.1:7777", developerCommand: "", developerArgs: [] },
      connectRuntime,
    });

    const first = manager.ensureReady({ reason: "view-open" });
    const second = manager.ensureReady({ reason: "user-action" });
    expect(second).toBe(first);
    expect(connectRuntime).toHaveBeenCalledOnce();

    connected.resolve();
    await expect(first).resolves.toMatchObject({ endpoint: "ws://127.0.0.1:7777", ownership: "external" });
    expect(manager.state.status).toBe("ready");
  });

  it("reattaches only after authenticated descriptor identity succeeds", async () => {
    const leaseStore = fakeLeaseStore(CANDIDATE);
    const controlClient = fakeControlClient();
    const processLauncher = fakeProcessLauncher();
    const connectRuntime = vi.fn(async (_runtime: ReadyRuntime) => {});
    const manager = createManager({ leaseStore, controlClient, processLauncher, connectRuntime });

    const runtime = await manager.ensureReady({ reason: "view-open" });

    expect(controlClient.status).toHaveBeenCalledWith(DESCRIPTOR, CANDIDATE.controlToken);
    expect(processLauncher.spawn).not.toHaveBeenCalled();
    expect(runtime).toMatchObject({
      endpoint: "ws://127.0.0.1:43125",
      ownership: "managed",
      session: {
        instanceId: DESCRIPTOR.instanceId,
        vaultId: DESCRIPTOR.vaultId,
        sessionToken: CANDIDATE.sessionToken,
      },
    });
    expect(connectRuntime).toHaveBeenCalledWith(runtime);
  });

  it("replaces a live runtime whose package fingerprint does not match the signed release", async () => {
    const mismatched = {
      ...CANDIDATE,
      descriptor: { ...DESCRIPTOR, runtimePackageFingerprint: "d".repeat(64) },
    } satisfies RuntimeLeaseCandidate;
    let spawned = false;
    const leaseStore = fakeLeaseStore(mismatched);
    vi.mocked(leaseStore.readCandidate).mockImplementation(async () => spawned ? CANDIDATE : mismatched);
    const controlClient = fakeControlClient();
    const processLauncher = fakeProcessLauncher();
    vi.mocked(processLauncher.spawn).mockImplementation(async () => {
      spawned = true;
      return processHandle();
    });
    const manager = createManager({ leaseStore, controlClient, processLauncher });

    await manager.ensureReady({ reason: "view-open" });

    expect(controlClient.shutdown).toHaveBeenCalledWith(mismatched.descriptor, mismatched.controlToken);
    expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledWith(deriveRuntimeVaultId(VAULT_PATHS.vaultRoot));
    expect(processLauncher.spawn).toHaveBeenCalledOnce();
  });

  it("uses schema-v1 descriptors only for authenticated upgrade shutdown", async () => {
    let spawned = false;
    const legacy = {
      descriptor: { host: "127.0.0.1" as const, port: 43124 },
      controlToken: "legacy-control-token",
    };
    const leaseStore: RuntimeLeaseStoreLike = {
      ...fakeLeaseStore(null),
      readCandidate: vi.fn(async () => spawned ? CANDIDATE : null),
      readLegacyShutdownTarget: vi.fn(async () => legacy),
    };
    const processLauncher = fakeProcessLauncher();
    vi.mocked(processLauncher.spawn).mockImplementation(async () => {
      spawned = true;
      return processHandle();
    });
    const controlClient = fakeControlClient();
    const manager = createManager({ leaseStore, processLauncher, controlClient });

    await manager.ensureReady({ reason: "view-open" });

    expect(controlClient.shutdown).toHaveBeenCalledWith(legacy.descriptor, legacy.controlToken);
    expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledWith(deriveRuntimeVaultId(VAULT_PATHS.vaultRoot));
    expect(processLauncher.spawn).toHaveBeenCalledOnce();
  });

  it("treats a failed descriptor as stale and launches on a dynamic port without killing a listener", async () => {
    let spawned = false;
    const prepared: PreparedRuntimeLease = {
      instanceId: DESCRIPTOR.instanceId,
      vaultId: DESCRIPTOR.vaultId,
      controlToken: CANDIDATE.controlToken,
      sessionToken: CANDIDATE.sessionToken,
      paths: CANDIDATE.paths,
    };
    const leaseStore: RuntimeLeaseStoreLike = {
      readCandidate: vi.fn(async () => spawned ? CANDIDATE : CANDIDATE),
      prepare: vi.fn(async () => prepared),
      discardStaleDescriptor: vi.fn(async () => {
        spawned = true;
      }),
    };
    const controlClient = fakeControlClient();
    vi.mocked(controlClient.status)
      .mockRejectedValueOnce(new Error("stale"))
      .mockResolvedValue({});
    const handle = processHandle();
    const processLauncher: ManagedProcessLauncher = {
      spawn: vi.fn(async () => handle),
    };
    const manager = createManager({
      leaseStore,
      controlClient,
      processLauncher,
      runtimePublicKey: "test-public-key",
      isProcessAlive: () => false,
      configuration: {
        mode: "managed",
        lifetime: "obsidian-session",
        externalUrl: "ws://127.0.0.1:9222",
        developerCommand: "node",
        developerArgs: ["backend.js"],
        shellCommand: "bash",
      },
    });

    await manager.ensureReady({ reason: "manual-start" });

    expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledOnce();
    expect(processLauncher.spawn).toHaveBeenCalledOnce();
    const launch = vi.mocked(processLauncher.spawn).mock.calls[0]![0];
    expect(launch.args).toEqual(expect.arrayContaining([
      "--port", "0",
      "--instance-id", DESCRIPTOR.instanceId,
      "--ready-file", CANDIDATE.paths.descriptorFile,
    ]));
    expect(launch.args).not.toContain("9222");
    expect(launch.env.CHATOBBY_RUNTIME_PUBLIC_KEY).toBe("test-public-key");
    expect(launch.env.CHATOBBY_SHELL).toBe("bash");
  });

  it("reattaches through the websocket when a live runtime control probe is transiently unavailable", async () => {
    const leaseStore = fakeLeaseStore(CANDIDATE);
    const controlClient = fakeControlClient();
    vi.mocked(controlClient.status).mockRejectedValue(new Error("control timeout"));
    const processLauncher = fakeProcessLauncher();
    const connectRuntime = vi.fn(async () => {});
    const manager = createManager({
      leaseStore,
      controlClient,
      processLauncher,
      connectRuntime,
      isProcessAlive: () => true,
    });

    await expect(manager.ensureReady({ reason: "view-open" })).resolves.toMatchObject({
      endpoint: "ws://127.0.0.1:43125",
    });
    expect(connectRuntime).toHaveBeenCalledOnce();
    expect(leaseStore.discardStaleDescriptor).not.toHaveBeenCalled();
    expect(processLauncher.spawn).not.toHaveBeenCalled();
  });

  it("does not launch a duplicate while an unresponsive candidate process is still alive", async () => {
    const leaseStore = fakeLeaseStore(CANDIDATE);
    const controlClient = fakeControlClient();
    vi.mocked(controlClient.status).mockRejectedValue(new Error("control timeout"));
    const processLauncher = fakeProcessLauncher();
    const manager = createManager({
      leaseStore,
      controlClient,
      processLauncher,
      connectRuntime: vi.fn(async () => {
        throw new Error("websocket timeout");
      }),
      isProcessAlive: () => true,
    });

    await expect(manager.ensureReady({ reason: "view-open" })).rejects.toThrow(
      "still running but did not reconnect",
    );
    expect(leaseStore.discardStaleDescriptor).not.toHaveBeenCalled();
    expect(processLauncher.spawn).not.toHaveBeenCalled();
  });

  it("bounds frontend authentication so startup cannot remain pending forever", async () => {
    vi.useFakeTimers();
    try {
      const manager = createManager({
        leaseStore: fakeLeaseStore(CANDIDATE),
        connectRuntime: vi.fn(() => new Promise<void>(() => {})),
        authenticationTimeoutMs: 20,
      });

      const ready = manager.ensureReady({ reason: "view-open" });
      await vi.advanceTimersByTimeAsync(20);
      await expect(ready).rejects.toThrow("authentication timed out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers automatically after three transient start failures", async () => {
    vi.useFakeTimers();
    try {
      const leaseStore = fakeLeaseStore(null);
      let attempts = 0;
      let spawned = false;
      vi.mocked(leaseStore.readCandidate).mockImplementation(async () => spawned ? CANDIDATE : null);
      const processLauncher: ManagedProcessLauncher = {
        spawn: vi.fn(async () => {
          attempts += 1;
          if (attempts <= 3) throw new Error("package replacement in progress");
          spawned = true;
          return processHandle();
        }),
      };
      const manager = createManager({ leaseStore, processLauncher });

      await expect(manager.ensureReady({ reason: "view-open" })).rejects.toThrow("package replacement in progress");
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(4_000);
      await vi.waitFor(() => expect(manager.state.status).toBe("ready"));

      expect(processLauncher.spawn).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry while the managed runtime is not installed", async () => {
    vi.useFakeTimers();
    try {
      const processLauncher = fakeProcessLauncher();
      const manager = createManager({ managedCommand: null, processLauncher });

      await expect(manager.ensureReady({ reason: "view-open" })).rejects.toThrow("runtime is not installed");
      expect(manager.state).toMatchObject({
        status: "error",
        diagnostics: { code: "runtime_not_installed" },
      });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(processLauncher.spawn).not.toHaveBeenCalled();
      expect(manager.state.status).toBe("error");
      expect(manager.state).not.toHaveProperty("retryAt");
    } finally {
      vi.useRealTimers();
    }
  });

  it("classifies an invalid signed package as repairable and does not retry it", async () => {
    vi.useFakeTimers();
    try {
      const processLauncher = fakeProcessLauncher();
      const manager = createManager({
        managedCommandError: new Error("Runtime package signature is invalid"),
        processLauncher,
      });

      await expect(manager.ensureReady({ reason: "view-open" })).rejects.toThrow("signature is invalid");
      expect(manager.state).toMatchObject({
        status: "error",
        diagnostics: { code: "runtime_package_invalid" },
      });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(processLauncher.spawn).not.toHaveBeenCalled();
      expect(manager.state).not.toHaveProperty("retryAt");
    } finally {
      vi.useRealTimers();
    }
  });

  it("enters a crash loop after five failed starts and manual restart resets it", async () => {
    vi.useFakeTimers();
    try {
      const leaseStore = fakeLeaseStore(null);
      const processLauncher: ManagedProcessLauncher = {
        spawn: vi.fn(async () => {
          throw new Error("spawn failed");
        }),
      };
      const manager = createManager({ leaseStore, processLauncher });

      await expect(manager.ensureReady({ reason: "view-open" })).rejects.toThrow("spawn failed");
      expect(manager.state).toMatchObject({ status: "error", retryAt: expect.any(Number) });
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(4_000);
      await vi.advanceTimersByTimeAsync(8_000);
      expect(processLauncher.spawn).toHaveBeenCalledTimes(5);
      expect(manager.state.status).toBe("crash_loop");

      await expect(manager.restart("manual-restart")).rejects.toThrow("spawn failed");
      expect(manager.state.status).toBe("error");
      expect(processLauncher.spawn).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never starts or stops a process in external mode", async () => {
    const processLauncher = fakeProcessLauncher();
    const controlClient = fakeControlClient();
    const disconnectRuntime = vi.fn(async () => {});
    const manager = createManager({
      configuration: { mode: "external", lifetime: "obsidian-session", externalUrl: "wss://runtime.example.test", developerCommand: "", developerArgs: [] },
      processLauncher,
      controlClient,
      disconnectRuntime,
    });

    await manager.ensureReady({ reason: "view-open" });
    await manager.stop("user-action");

    expect(processLauncher.spawn).not.toHaveBeenCalled();
    expect(controlClient.shutdown).not.toHaveBeenCalled();
    expect(disconnectRuntime).toHaveBeenCalledOnce();
  });

  it("detaches a managed runtime without terminating its exact child", async () => {
    const leaseStore = fakeLeaseStore(CANDIDATE);
    const controlClient = fakeControlClient();
    const processLauncher = fakeProcessLauncher();
    const disconnectRuntime = vi.fn(async () => {});
    const manager = createManager({ leaseStore, controlClient, processLauncher, disconnectRuntime });
    await manager.ensureReady({ reason: "view-open" });

    await manager.detach("plugin-unload");

    expect(controlClient.detach).toHaveBeenCalledWith(
		DESCRIPTOR,
		CANDIDATE.controlToken,
		expect.any(String),
	);
    expect(vi.mocked(controlClient.detach).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(disconnectRuntime).mock.invocationCallOrder[0]!,
    );
    expect(processLauncher.spawn).not.toHaveBeenCalled();
    expect(manager.state.status).toBe("detached");
  });

  it("launches background mode detached and leaves it running across plugin unload", async () => {
    const leaseStore = fakeLeaseStore(null);
    let spawned = false;
    vi.mocked(leaseStore.readCandidate).mockImplementation(async () => spawned ? CANDIDATE : null);
    const processLauncher = fakeProcessLauncher();
    vi.mocked(processLauncher.spawn).mockImplementation(async () => {
      spawned = true;
      return processHandle();
    });
    const controlClient = fakeControlClient();
    const manager = createManager({
      configuration: {
        mode: "managed",
        lifetime: "background",
        externalUrl: "ws://127.0.0.1:9222",
        developerCommand: "node",
        developerArgs: [],
      },
      leaseStore,
      processLauncher,
      controlClient,
    });

    await manager.ensureReady({ reason: "view-open" });
    const launch = vi.mocked(processLauncher.spawn).mock.calls[0]![0];
    expect(launch.detached).toBe(true);
    expect(launch.args).not.toContain("--parent-pid");
    await manager.detach("plugin-unload");
    expect(controlClient.detach).not.toHaveBeenCalled();
  });

	it("replaces an adopted runtime when both websocket and control probes fail", async () => {
		vi.useFakeTimers();
		try {
			let stale = true;
			let spawned = false;
			const leaseStore: RuntimeLeaseStoreLike = {
				readCandidate: vi.fn(async () => stale ? CANDIDATE : spawned ? CANDIDATE : null),
				prepare: vi.fn(async () => ({
					instanceId: DESCRIPTOR.instanceId,
					vaultId: DESCRIPTOR.vaultId,
					controlToken: CANDIDATE.controlToken,
					sessionToken: CANDIDATE.sessionToken,
					paths: CANDIDATE.paths,
				})),
				discardStaleDescriptor: vi.fn(async () => {
					stale = false;
				}),
			};
			const controlClient = fakeControlClient();
			vi.mocked(controlClient.status)
				.mockResolvedValueOnce({})
				.mockRejectedValueOnce(new Error("runtime unavailable"))
				.mockResolvedValue({});
			const processLauncher = fakeProcessLauncher();
			vi.mocked(processLauncher.spawn).mockImplementation(async () => {
				spawned = true;
				return processHandle();
			});
			const disconnectRuntime = vi.fn(async () => {});
			const manager = createManager({ leaseStore, controlClient, processLauncher, disconnectRuntime });
			await manager.ensureReady({ reason: "view-open" });

			await manager.reportConnectionFailure("WebSocket connection closed");
			expect(manager.state).toMatchObject({ status: "error", diagnostics: { code: "connection_failed" } });
			expect(disconnectRuntime).toHaveBeenCalledOnce();
			expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledWith(DESCRIPTOR.vaultId);

			await vi.advanceTimersByTimeAsync(0);
			await vi.waitFor(() => expect(processLauncher.spawn).toHaveBeenCalledOnce());
			expect(manager.state.status).toBe("ready");
		} finally {
			vi.useRealTimers();
		}
	});
});

function createManager(overrides: ManagerOverrides = {}) {
  const configuration = overrides.configuration ?? {
    mode: "managed",
    lifetime: "obsidian-session",
    externalUrl: "ws://127.0.0.1:9222",
    developerCommand: "node",
    developerArgs: ["backend.js"],
  } satisfies RuntimeConfiguration;
  return new DefaultChatobbyRuntimeManager({
    getConfiguration: () => configuration,
    getVaultPaths: () => VAULT_PATHS,
    resolveManagedCommand: () => {
      if (overrides.managedCommandError) throw overrides.managedCommandError;
      return "managedCommand" in overrides
        ? overrides.managedCommand ?? null
        : {
          command: "chatobby",
          args: [],
          runtimePackageFingerprint: DESCRIPTOR.runtimePackageFingerprint ?? undefined,
        };
    },
    connectRuntime: overrides.connectRuntime ?? (async () => {}),
    disconnectRuntime: overrides.disconnectRuntime ?? (async () => {}),
    pluginVersion: "0.1.0-test",
    runtimePublicKey: overrides.runtimePublicKey,
    leaseStore: overrides.leaseStore ?? fakeLeaseStore(null),
    controlClient: overrides.controlClient ?? fakeControlClient(),
    processLauncher: overrides.processLauncher ?? fakeProcessLauncher(),
    startupTimeoutMs: 100,
    descriptorPollMs: 1,
    authenticationTimeoutMs: overrides.authenticationTimeoutMs,
    isProcessAlive: overrides.isProcessAlive,
  });
}

function fakeLeaseStore(candidate: RuntimeLeaseCandidate | null): RuntimeLeaseStoreLike {
  return {
    readCandidate: vi.fn(async () => candidate),
    prepare: vi.fn(async () => ({
      instanceId: DESCRIPTOR.instanceId,
      vaultId: DESCRIPTOR.vaultId,
      controlToken: CANDIDATE.controlToken,
      sessionToken: CANDIDATE.sessionToken,
      paths: CANDIDATE.paths,
    })),
    discardStaleDescriptor: vi.fn(async () => {}),
  };
}

function fakeControlClient(): RuntimeControlClientLike {
  return {
    status: vi.fn(async () => ({})),
    detach: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
  };
}

function fakeProcessLauncher(): ManagedProcessLauncher {
  return { spawn: vi.fn(async () => processHandle()) };
}

function processHandle(): ManagedProcessHandle {
  const exit = deferred<{ code: number | null; signal: NodeJS.Signals | null; expected: boolean }>();
  return {
    pid: 100,
    startedAt: Date.now(),
    exited: exit.promise,
    recentLogs: () => [],
    terminate: vi.fn(async () => exit.resolve({ code: 0, signal: null, expected: true })),
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

interface ManagerOverrides {
  configuration?: RuntimeConfiguration;
  leaseStore?: RuntimeLeaseStoreLike;
  controlClient?: RuntimeControlClientLike;
  processLauncher?: ManagedProcessLauncher;
  connectRuntime?: (runtime: ReadyRuntime) => Promise<void>;
  disconnectRuntime?: () => Promise<void>;
  runtimePublicKey?: string | null;
  managedCommand?: { command: string; args: string[]; runtimePackageFingerprint?: string } | null;
  managedCommandError?: Error;
  authenticationTimeoutMs?: number;
  isProcessAlive?: (pid: number) => boolean;
}
