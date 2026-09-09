import { describe, expect, it, vi } from "vitest";
import {
  DefaultChatobbyRuntimeManager,
  type RuntimeControlClientLike,
  type RuntimeLeaseStoreLike,
} from "../../src/runtime/application/runtime-manager";
import { DevelopmentPairStartupGate } from "../../src/runtime/application/development-pair-startup-gate";
import type {
  ManagedProcessHandle,
  PreparedRuntimeLease,
  ReadyRuntime,
  RuntimeConfiguration,
  RuntimeLeaseCandidate,
  RuntimeReadyDescriptor,
} from "../../src/runtime/contracts";
import type { ManagedProcessLauncher } from "../../src/runtime/infrastructure/managed-process";
import { deriveLegacyRuntimeVaultId } from "../../src/vault-runtime";
import type { ChatobbyVaultRuntimePaths } from "../../src/vault-runtime";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "../../src/vendor/chatobby-client/ws-client.js";

const VAULT_PATHS: ChatobbyVaultRuntimePaths = {
  vaultRoot: "C:\\vault",
  chatobbyRoot: "C:\\vault\\.chatobby",
  agentDir: "C:\\vault\\.chatobby\\agent",
  attachmentDir: "C:\\vault\\.chatobby\\attachments",
	vaultId: "vault-expected",
	legacyVaultId: deriveLegacyRuntimeVaultId("C:\\vault"),
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

	it("retires an authenticated path-addressed lease before using the stable Vault lease", async () => {
		const legacyCandidate: RuntimeLeaseCandidate = {
			...CANDIDATE,
			descriptor: { ...DESCRIPTOR, instanceId: "legacy-instance", vaultId: VAULT_PATHS.legacyVaultId, pid: 91 },
		};
		const leaseStore = fakeLeaseStore(null);
		vi.mocked(leaseStore.readCandidate).mockImplementation(async (vaultId) =>
			vaultId === VAULT_PATHS.legacyVaultId ? legacyCandidate : CANDIDATE
		);
		const controlClient = fakeControlClient();
		const manager = createManager({ leaseStore, controlClient });

		await expect(manager.ensureReady({ reason: "view-open" })).resolves.toMatchObject({
			session: { vaultId: VAULT_PATHS.vaultId },
		});
		expect(controlClient.shutdown).toHaveBeenCalledWith(
			legacyCandidate.descriptor,
			legacyCandidate.controlToken,
		);
		expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledWith(VAULT_PATHS.legacyVaultId);
	});

	it("refuses to start a stable lease when a live path-addressed runtime cannot be stopped", async () => {
		const legacyCandidate: RuntimeLeaseCandidate = {
			...CANDIDATE,
			descriptor: { ...DESCRIPTOR, instanceId: "legacy-instance", vaultId: VAULT_PATHS.legacyVaultId, pid: 91 },
		};
		const leaseStore = fakeLeaseStore(null);
		vi.mocked(leaseStore.readCandidate).mockImplementation(async (vaultId) =>
			vaultId === VAULT_PATHS.legacyVaultId ? legacyCandidate : null
		);
		const controlClient = fakeControlClient();
		vi.mocked(controlClient.shutdown).mockRejectedValue(new Error("legacy control unavailable"));
		const processLauncher = fakeProcessLauncher();
		const manager = createManager({
			leaseStore,
			controlClient,
			processLauncher,
			isProcessAlive: (pid) => pid === legacyCandidate.descriptor.pid,
		});

		await expect(manager.ensureReady({ reason: "view-open" })).rejects.toThrow(/could not be stopped safely/u);
		expect(processLauncher.spawn).not.toHaveBeenCalled();
		expect(leaseStore.discardStaleDescriptor).not.toHaveBeenCalledWith(VAULT_PATHS.legacyVaultId);
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
    expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledWith(VAULT_PATHS.vaultId);
    expect(processLauncher.spawn).toHaveBeenCalledOnce();
  });

  it("honors an exact development-pair command while developer mode is configured", async () => {
    const developmentBuildFingerprint = "d".repeat(64);
    const existing = {
      ...CANDIDATE,
      descriptor: {
        ...DESCRIPTOR,
        pid: 91,
        runtimePackageFingerprint: null,
        developmentBuildFingerprint: null,
      },
    } satisfies RuntimeLeaseCandidate;
    const target = {
      ...CANDIDATE,
      descriptor: {
        ...DESCRIPTOR,
        runtimePackageFingerprint: null,
        developmentBuildFingerprint,
      },
    } satisfies RuntimeLeaseCandidate;
    let spawned = false;
    const leaseStore = fakeLeaseStore(existing);
    vi.mocked(leaseStore.readCandidate).mockImplementation(async () => spawned ? target : existing);
    const controlClient = fakeControlClient();
    const processLauncher = fakeProcessLauncher();
    vi.mocked(processLauncher.spawn).mockImplementation(async () => {
      spawned = true;
      return processHandle();
    });
    const manager = createManager({
      configuration: {
        mode: "developer",
        lifetime: "obsidian-session",
        externalUrl: "ws://127.0.0.1:9222",
        developerCommand: "node",
        developerArgs: ["backend.js"],
      },
      leaseStore,
      controlClient,
      processLauncher,
    });

    await manager.ensureReady(
      { reason: "manual-restart" },
      { command: "C:\\exact\\chatobby.exe", args: [], developmentBuildFingerprint },
    );

    expect(controlClient.shutdown).toHaveBeenCalledWith(existing.descriptor, existing.controlToken);
    expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledWith(VAULT_PATHS.vaultId);
    expect(processLauncher.spawn).toHaveBeenCalledWith(expect.objectContaining({
      command: "C:\\exact\\chatobby.exe",
      env: expect.objectContaining({
        CHATOBBY_DEVELOPMENT_BUILD_FINGERPRINT: developmentBuildFingerprint,
      }),
    }));
    expect(vi.mocked(processLauncher.spawn).mock.calls[0]?.[0].args).not.toContain("backend.js");
  });

  it("reuses the pinned development-pair command for an ordinary developer start", async () => {
    const developmentBuildFingerprint = "d".repeat(64);
    const target = {
      ...CANDIDATE,
      descriptor: {
        ...DESCRIPTOR,
        runtimePackageFingerprint: null,
        developmentBuildFingerprint,
      },
    } satisfies RuntimeLeaseCandidate;
    let spawned = false;
    const leaseStore = fakeLeaseStore(null);
    vi.mocked(leaseStore.readCandidate).mockImplementation(async () => spawned ? target : null);
    const processLauncher = fakeProcessLauncher();
    vi.mocked(processLauncher.spawn).mockImplementation(async () => {
      spawned = true;
      return processHandle();
    });
    const manager = createManager({
      configuration: {
        mode: "developer",
        lifetime: "obsidian-session",
        externalUrl: "ws://127.0.0.1:9222",
        developerCommand: "node",
        developerArgs: ["stale-backend.js"],
      },
      leaseStore,
      processLauncher,
    });
    manager.setDevelopmentCommandOverride({
      command: "C:\\exact\\chatobby.exe",
      args: [],
      developmentBuildFingerprint,
    });

    await manager.ensureReady({ reason: "view-open" });

    expect(processLauncher.spawn).toHaveBeenCalledWith(expect.objectContaining({
      command: "C:\\exact\\chatobby.exe",
      env: expect.objectContaining({
        CHATOBBY_DEVELOPMENT_BUILD_FINGERPRINT: developmentBuildFingerprint,
      }),
    }));
    expect(vi.mocked(processLauncher.spawn).mock.calls[0]?.[0].args).not.toContain("stale-backend.js");
  });

  it("reuses the pinned development-pair command before managed resolution on reload", async () => {
    const developmentBuildFingerprint = "d".repeat(64);
    const target = {
      ...CANDIDATE,
      descriptor: {
        ...DESCRIPTOR,
        runtimePackageFingerprint: null,
        developmentBuildFingerprint,
      },
    } satisfies RuntimeLeaseCandidate;
    let spawned = false;
    const leaseStore = fakeLeaseStore(null);
    vi.mocked(leaseStore.readCandidate).mockImplementation(async () => spawned ? target : null);
    const processLauncher = fakeProcessLauncher();
    vi.mocked(processLauncher.spawn).mockImplementation(async () => {
      spawned = true;
      return processHandle();
    });
    const manager = createManager({
      managedCommandError: new Error("managed resolver must not replace a verified current pair"),
      leaseStore,
      processLauncher,
    });
    manager.setDevelopmentCommandOverride({
      command: "C:\\verified-pair\\chatobby.exe",
      args: [],
      developmentBuildFingerprint,
    });

    await manager.ensureReady({ reason: "automatic-restart" });

    expect(processLauncher.spawn).toHaveBeenCalledWith(expect.objectContaining({
      command: "C:\\verified-pair\\chatobby.exe",
      env: expect.objectContaining({
        CHATOBBY_DEVELOPMENT_BUILD_FINGERPRINT: developmentBuildFingerprint,
      }),
    }));
  });

  it("keeps an external runtime independent of a pinned development-pair command", async () => {
    const connectRuntime = vi.fn(async () => {});
    const processLauncher = fakeProcessLauncher();
    const manager = createManager({
      configuration: {
        mode: "external",
        lifetime: "obsidian-session",
        externalUrl: "ws://127.0.0.1:7777",
        developerCommand: "chatobby",
        developerArgs: [],
      },
      connectRuntime,
      processLauncher,
    });
    manager.setDevelopmentCommandOverride({
      command: "C:\\verified-pair\\chatobby.exe",
      args: [],
      developmentBuildFingerprint: "d".repeat(64),
    });

    await manager.ensureReady({ reason: "view-open" });

    expect(connectRuntime).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: "ws://127.0.0.1:7777",
      ownership: "external",
    }));
    expect(processLauncher.spawn).not.toHaveBeenCalled();
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
      readLegacyShutdownTarget: vi.fn(async (vaultId) => vaultId === VAULT_PATHS.vaultId ? legacy : null),
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
    expect(leaseStore.discardStaleDescriptor).toHaveBeenCalledWith(VAULT_PATHS.vaultId);
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
		expect(launch.env.CHATOBBY_LEGACY_VAULT_ID).toBe(VAULT_PATHS.legacyVaultId);
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

  it("does not preempt a valid startup-admission handshake at the former 15-second bound", async () => {
    vi.useFakeTimers();
    try {
      const connected = deferred<void>();
      const manager = createManager({
        leaseStore: fakeLeaseStore(CANDIDATE),
        connectRuntime: vi.fn(() => connected.promise),
      });

      const ready = manager.ensureReady({ reason: "view-open" });
      await vi.advanceTimersByTimeAsync(15_000);
      connected.resolve();

      await expect(ready).resolves.toMatchObject({
        endpoint: "ws://127.0.0.1:43125",
      });
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

  it("cancels a failed exact-pair rollback retry when the startup gate latches", async () => {
    vi.useFakeTimers();
    try {
      const gate = new DevelopmentPairStartupGate();
      const resolveManagedCommand = vi.fn(async () => ({
        command: "chatobby",
        args: [],
        runtimePackageFingerprint: DESCRIPTOR.runtimePackageFingerprint ?? undefined,
      }));
      const processLauncher: ManagedProcessLauncher = {
        spawn: vi.fn(async () => {
          throw new Error("previous exact runtime failed to restart");
        }),
      };
      const connectRuntime = vi.fn(async () => {});
      const manager = createManager({
        assertRuntimeStartAllowed: () => gate.assertRuntimeStartAllowed(),
        resolveManagedCommand,
        processLauncher,
        connectRuntime,
      });

      const failure = await gate.capture("managed", () => manager.ensureReady(
        { reason: "manual-restart" },
        {
          command: "C:\\verified-pair\\chatobby.exe",
          args: [],
          developmentBuildFingerprint: "d".repeat(64),
        },
      ));
      expect(failure?.state.diagnostics.code).toBe("development_pair_adoption_failed");
      manager.blockRuntimeStartsUntilReload();

      expect(() => manager.ensureReady({ reason: "user-action" })).toThrow(
        "Restage a valid exact pair, then reload Chatobby",
      );
      await vi.advanceTimersByTimeAsync(60_000);

      expect(processLauncher.spawn).toHaveBeenCalledOnce();
      expect(resolveManagedCommand).not.toHaveBeenCalled();
      expect(connectRuntime).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not restart a restored exact runtime after the startup gate latches", async () => {
    vi.useFakeTimers();
    try {
      const gate = new DevelopmentPairStartupGate();
      const exit = deferred<{ code: number | null; signal: NodeJS.Signals | null; expected: boolean }>();
      const handle: ManagedProcessHandle = {
        pid: 100,
        startedAt: Date.now(),
        exited: exit.promise,
        recentLogs: () => [],
        terminate: vi.fn(async () => exit.resolve({ code: 0, signal: null, expected: true })),
      };
      let spawned = false;
      const leaseStore = fakeLeaseStore(null);
      vi.mocked(leaseStore.readCandidate).mockImplementation(async () => spawned ? CANDIDATE : null);
      const processLauncher: ManagedProcessLauncher = {
        spawn: vi.fn(async () => {
          spawned = true;
          return handle;
        }),
      };
      const resolveManagedCommand = vi.fn(async () => ({
        command: "chatobby",
        args: [],
        runtimePackageFingerprint: DESCRIPTOR.runtimePackageFingerprint ?? undefined,
      }));
      const connectRuntime = vi.fn(async () => {});
      const manager = createManager({
        assertRuntimeStartAllowed: () => gate.assertRuntimeStartAllowed(),
        resolveManagedCommand,
        leaseStore,
        processLauncher,
        connectRuntime,
      });

      const failure = await gate.capture("managed", async () => {
        await manager.ensureReady(
          { reason: "manual-restart" },
          {
            command: "C:\\verified-pair\\chatobby.exe",
            args: [],
            runtimePackageFingerprint: DESCRIPTOR.runtimePackageFingerprint ?? undefined,
          },
        );
        throw new Error("new pair failed after the previous pair was restored");
      });
      expect(failure).not.toBeNull();
      manager.blockRuntimeStartsUntilReload();

      exit.resolve({ code: 17, signal: null, expected: false });
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(processLauncher.spawn).toHaveBeenCalledOnce();
      expect(resolveManagedCommand).not.toHaveBeenCalled();
      expect(connectRuntime).toHaveBeenCalledOnce();
      await expect(manager.restart("manual-restart")).rejects.toThrow(
        "Restage a valid exact pair, then reload Chatobby",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("rechecks startup admission after an asynchronous runtime probe", async () => {
    const gate = new DevelopmentPairStartupGate();
    const status = deferred<unknown>();
    const controlClient = fakeControlClient();
    vi.mocked(controlClient.status).mockImplementation(() => status.promise);
    const connectRuntime = vi.fn(async () => {});
    const processLauncher = fakeProcessLauncher();
    const manager = createManager({
      assertRuntimeStartAllowed: () => gate.assertRuntimeStartAllowed(),
      leaseStore: fakeLeaseStore(CANDIDATE),
      controlClient,
      processLauncher,
      connectRuntime,
    });

    const ready = manager.ensureReady({ reason: "view-open" });
    await vi.waitFor(() => expect(controlClient.status).toHaveBeenCalledOnce());
    await gate.capture("managed", async () => {
      throw new Error("pair verification failed while the runtime probe was pending");
    });
    manager.blockRuntimeStartsUntilReload();
    status.resolve({});

    await expect(ready).rejects.toThrow("startup was cancelled");
    expect(processLauncher.spawn).not.toHaveBeenCalled();
    expect(connectRuntime).not.toHaveBeenCalled();
    expect(manager.state.status).not.toBe("ready");
  });

  it("terminates a process whose spawn resolves after the startup gate latches", async () => {
    const gate = new DevelopmentPairStartupGate();
    const spawnedHandle = deferred<ManagedProcessHandle>();
    const exited = deferred<{ code: number | null; signal: NodeJS.Signals | null; expected: boolean }>();
    const handle: ManagedProcessHandle = {
      pid: 100,
      startedAt: Date.now(),
      exited: exited.promise,
      recentLogs: () => [],
      terminate: vi.fn(async () => exited.resolve({ code: 0, signal: null, expected: true })),
    };
    const processLauncher: ManagedProcessLauncher = {
      spawn: vi.fn(() => spawnedHandle.promise),
    };
    const connectRuntime = vi.fn(async () => {});
    const manager = createManager({
      assertRuntimeStartAllowed: () => gate.assertRuntimeStartAllowed(),
      leaseStore: fakeLeaseStore(null),
      processLauncher,
      connectRuntime,
    });

    const ready = manager.ensureReady(
      { reason: "manual-restart" },
      { command: "C:\\verified-pair\\chatobby.exe", args: [] },
    );
    await vi.waitFor(() => expect(processLauncher.spawn).toHaveBeenCalledOnce());
    await gate.capture("managed", async () => {
      throw new Error("pair verification failed while process creation was pending");
    });
    manager.blockRuntimeStartsUntilReload();
    spawnedHandle.resolve(handle);

    await expect(ready).rejects.toThrow("startup was cancelled");
    expect(handle.terminate).toHaveBeenCalledOnce();
    expect(connectRuntime).not.toHaveBeenCalled();
    expect(manager.state.status).not.toBe("ready");
  });

  it("does not bind frontend sessions when timed-out authentication finishes after the gate latches", async () => {
    vi.useFakeTimers();
    try {
      const gate = new DevelopmentPairStartupGate();
      const reconciled = deferred<void>();
      const bindRuntime = vi.fn(async () => {});
      const connectRuntime = vi.fn(async () => {
        await reconciled.promise;
        gate.assertRuntimeStartAllowed();
        await bindRuntime();
      });
      const manager = createManager({
        assertRuntimeStartAllowed: () => gate.assertRuntimeStartAllowed(),
        leaseStore: fakeLeaseStore(CANDIDATE),
        connectRuntime,
        authenticationTimeoutMs: 10,
      });

      const ready = manager.ensureReady({ reason: "view-open" });
      await vi.waitFor(() => expect(connectRuntime).toHaveBeenCalledOnce());
      await vi.advanceTimersByTimeAsync(10);
      await expect(ready).rejects.toThrow("authentication timed out");

      await gate.capture("managed", async () => {
        throw new Error("pair verification failed after authentication timed out");
      });
      manager.blockRuntimeStartsUntilReload();
      const lateConnection = connectRuntime.mock.results[0]?.value;
      if (!lateConnection) throw new Error("Expected the delayed frontend connection attempt");
      reconciled.resolve();
      await expect(lateConnection).rejects.toThrow("Restage a valid exact pair, then reload Chatobby");

      expect(bindRuntime).not.toHaveBeenCalled();
      expect(manager.state.status).not.toBe("ready");
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
    assertRuntimeStartAllowed: overrides.assertRuntimeStartAllowed ?? (() => {}),
    resolveManagedCommand: overrides.resolveManagedCommand ?? (() => {
      if (overrides.managedCommandError) throw overrides.managedCommandError;
      return "managedCommand" in overrides
        ? overrides.managedCommand ?? null
        : {
          command: "chatobby",
          args: [],
          runtimePackageFingerprint: DESCRIPTOR.runtimePackageFingerprint ?? undefined,
        };
    }),
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
  assertRuntimeStartAllowed?: () => void;
  resolveManagedCommand?: () => {
    command: string;
    args: string[];
    runtimePackageFingerprint?: string;
    developmentBuildFingerprint?: string;
  } | null | Promise<{
    command: string;
    args: string[];
    runtimePackageFingerprint?: string;
    developmentBuildFingerprint?: string;
  } | null>;
  runtimePublicKey?: string | null;
  managedCommand?: {
    command: string;
    args: string[];
    runtimePackageFingerprint?: string;
    developmentBuildFingerprint?: string;
  } | null;
  managedCommandError?: Error;
  authenticationTimeoutMs?: number;
  isProcessAlive?: (pid: number) => boolean;
}
