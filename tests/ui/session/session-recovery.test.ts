import { describe, expect, it, vi } from 'vitest';
import type { ChatobbyTransport } from '../../../src/transport/ws-client';
import { SessionController, SessionIntentRejectedError, type SessionMutationRequest } from '../../../src/ui/controller/session-controller';
import type { FrontendBootstrap, FrontendIntentResult } from '../../../src/vendor/chatobby-client/frontend-contracts.js';
import { FrontendSessionRegistry } from '../../../src/runtime/application/frontend-session-registry';
import { ConnectedViewRestorationController } from '../../../src/ui/controller/connected-view-restoration';
import { dispatchSessionMutation } from '../../../src/ui/controller/session-intent-dispatcher';
import { createSessionControllerHarness as harness, sessionViewModel as session, flushMicrotasks } from '../../support/session/controller';

// @see docs/architecture/managed-runtime-lifecycle.md#leaf-session-recovery
describe("leaf session recovery composition", () => {
  it.each(["blank-bootstrap", "deleted-target-fallback"] as const)("does not queue a new saved target behind an aborted %s", async (source) => {
    let releaseOld!: () => void;
    const oldBootstrap = new Promise<void>((resolve) => { releaseOld = resolve; });
    const oldEpoch = new AbortController();
    const newEpoch = new AbortController();
    const transport = { isConnected: true } as ChatobbyTransport;
    const connection = (epoch: AbortController) => ({ transport, signal: epoch.signal, isCurrent: () => !epoch.signal.aborted });
    const synchronize = vi.fn(async () => { await oldBootstrap; });
    const { controller } = harness({
      synchronize,
      dispatch: async (request, target) => {
        if (request.type === "session.resume" && request.payload.sessionPath === "C:/synthetic/deleted.jsonl") {
          throw new SessionIntentRejectedError("SESSION_NOT_FOUND", "Deleted");
        }
        target.applyRuntimeSession(session("saved", { recoveryPath: "C:/synthetic/saved.jsonl" }));
        return true;
      },
    });
    if (source === "deleted-target-fallback") controller.setPendingSessionPath("C:/synthetic/deleted.jsonl");
    const first = controller.reconcileActiveSession(connection(oldEpoch)).catch((error: Error) => error);
    try {
      await vi.waitFor(() => expect(synchronize).toHaveBeenCalledOnce());
      controller.setPendingSessionPath("C:/synthetic/saved.jsonl");
      oldEpoch.abort();
      const next = controller.reconcileActiveSession(connection(newEpoch));
      await expect(first).resolves.toBeInstanceOf(Error);
      await next;
      expect(controller.activeTabId()).toBe("saved");
      expect(controller.recoverySessionPath).toBeNull();
      // The old bootstrap is deliberately unresolved until cleanup.
    } finally { releaseOld(); await first; }
  });

  it.each(["pending", "disconnected"] as const)("keeps a conflicted %s recovery retryable instead of reporting success", async (source) => {
    let releaseBusy!: () => void;
    const busy = new Promise<void>((resolve) => { releaseBusy = resolve; });
    const project = session("saved-project", { recoveryPath: "C:/synthetic/project.jsonl" });
    const dispatch = vi.fn(async (_request: SessionMutationRequest, target: SessionController) => { target.applyRuntimeSession(project); return true; });
    const { controller, operations } = harness({ dispatch });
    controller.applyRuntimeSession(project);
    if (source === "pending") controller.setPendingSessionPath(project.recoveryPath!);
    else controller.markTransportDisconnected();
    const owner = operations.run({ key: "session-transition", id: "competing", label: "Existing transition" }, () => busy);
    try {
      await expect(controller.reconcileActiveSession()).rejects.toMatchObject({ name: "OperationConflictError" });
      expect(dispatch).not.toHaveBeenCalled();
      expect(operations.current("session-transition")?.id).toBe("competing");
      releaseBusy(); await owner;
      await controller.reconcileActiveSession();
      expect(dispatch).toHaveBeenCalledOnce();
      expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ type: "session.resume", payload: { sessionPath: project.recoveryPath } });
      expect(controller.activeTabId()).toBe("saved-project");
      expect(controller.recoverySessionPath).toBeNull();
    } finally { releaseBusy(); await owner; }
  });

  it("retains the newest pending target token through A to B to A while old work settles", async () => {
    let releaseOld!: () => void;
    let releaseLatest!: () => void;
    const old = new Promise<void>((resolve) => { releaseOld = resolve; });
    const latest = new Promise<void>((resolve) => { releaseLatest = resolve; });
    const connection = { transport: { isConnected: true } as ChatobbyTransport, signal: new AbortController().signal, isCurrent: () => true };
    const path = "C:/synthetic/A.jsonl";
    let calls = 0;
    const { controller, operations } = harness({ dispatch: async (_request, target, current) => {
      await (++calls === 1 ? old : latest);
      if (!current?.isCurrent()) throw new Error("Retired target");
      target.applyRuntimeSession(session("A", { recoveryPath: path }));
      return true;
    } });
    controller.setPendingSessionPath(path);
    const first = controller.reconcileActiveSession(connection).catch((error: Error) => error);
    controller.setPendingSessionPath("C:/synthetic/B.jsonl");
    const middle = controller.reconcileActiveSession(connection).catch((error: Error) => error);
    controller.setPendingSessionPath(path);
    const last = controller.reconcileActiveSession(connection);
    let promptTarget: string | undefined;
    const prompt = controller.ensureActiveSessionTarget().then((target) => { promptTarget = target.sessionId; });
    try {
      releaseOld();
      expect(await first).toBeInstanceOf(Error);
      expect(await middle).toBeInstanceOf(Error);
      await vi.waitFor(() => expect(calls).toBe(2));
      expect(controller.recoverySessionPath).toBe(path);
      expect(promptTarget).toBeUndefined();
      expect(operations.current("session-transition")?.label).toBe("Restoring session");
      releaseLatest(); await last; await prompt;
      expect(promptTarget).toBe("A");
      expect(controller.recoverySessionPath).toBeNull();
    } finally { releaseOld(); releaseLatest(); await first; await middle; await last; await prompt; }
  });

  it("keeps the saved target and newer transition when an old connection epoch finishes late", async () => {
    let releaseOld!: () => void;
    let releaseNew!: () => void;
    const old = new Promise<void>((resolve) => { releaseOld = resolve; });
    const current = new Promise<void>((resolve) => { releaseNew = resolve; });
    const transport = { isConnected: true } as ChatobbyTransport;
    let epoch = 1;
    const oldConnection = { transport, signal: new AbortController().signal, isCurrent: () => epoch === 1 };
    const newConnection = { transport, signal: new AbortController().signal, isCurrent: () => epoch === 2 };
    const project = session("saved-project", { recoveryPath: "C:/synthetic/project.jsonl" });
    const requests: SessionMutationRequest[] = [];
    const { controller, operations } = harness({
      dispatch: async (request, target, connection) => {
        requests.push(request);
        await (connection?.signal === oldConnection.signal ? old : current);
        if (!connection?.isCurrent()) throw new Error("Old restoration epoch");
        target.applyRuntimeSession(project);
        return true;
      },
    });
    controller.applyRuntimeSession(project);
    controller.markTransportDisconnected();
    const first = controller.reconcileActiveSession(oldConnection).catch((error: Error) => error);
    let second: Promise<void> | undefined;
    try {
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      controller.applyRuntimeSession(session("temporary", { recoveryPath: "C:/synthetic/temporary.jsonl" }));
      controller.markTransportDisconnected();
      epoch = 2;
      second = controller.reconcileActiveSession(newConnection);
      expect(controller.reconcileActiveSession(newConnection)).toBe(second);
      releaseOld();
      expect(await first).toMatchObject({ message: "Chatobby session restoration target changed." });
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      expect(requests.map((request) => request.payload)).toEqual([
        { sessionPath: "C:/synthetic/project.jsonl", thinkingLevel: "medium" },
        { sessionPath: "C:/synthetic/project.jsonl", thinkingLevel: "medium" },
      ]);
      expect(operations.current("session-transition")?.label).toBe("Restoring session");
      releaseNew();
      await second;
      expect(controller.activeTabId()).toBe("saved-project");
      expect(operations.current("session-transition")).toBeNull();
    } finally {
      releaseOld(); releaseNew();
      await first; await second;
    }
  });

  // @see docs/architecture/managed-runtime-lifecycle.md#leaf-session-recovery
  it.each(["pending", "disconnected"] as const)("restores the active %s Project while a hidden leaf still blocks global readiness", async (source) => {
    let releaseHidden!: () => void;
    let releaseResume!: () => void;
    const hiddenReady = new Promise<void>((resolve) => { releaseHidden = resolve; });
    const resumed = new Promise<void>((resolve) => { releaseResume = resolve; });
    const project = session("saved-project", {
      recoveryPath: "C:/synthetic/project.jsonl", messageCount: 8,
      workspace: { kind: "project", projectId: "project:synthetic", label: "Synthetic" },
    });
    let runtimeSession = session("temporary-vault");
    let binding!: Promise<void>;
    let globallyReady = false;
    const active = {
      isConnected: false,
      connect: async () => { active.isConnected = true; restoration.synchronize(transport); },
      setOperatorViewOpen: async () => {},
      disconnect: async () => { active.isConnected = false; },
    };
    const transport = active as unknown as ChatobbyTransport;
    const ensureTransport = vi.fn(async () => { await binding; return transport; });
    const protocol = {
      synchronize: vi.fn(async () => { controller.applyRuntimeSession(runtimeSession); }),
      dispatch: vi.fn(async (): Promise<FrontendIntentResult> => {
        await resumed;
        runtimeSession = project;
        controller.applyRuntimeSession(project);
        return { schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "new-runtime", viewId: "active", intentId: "resume", status: "applied", revision: 2 };
      }),
    };
    const { controller, operations } = harness({
      dispatch: (request, _target, connection) => dispatchSessionMutation({
        getTransport: () => transport, ensureTransport, protocol,
        getSnapshot: (): FrontendBootstrap => ({
          schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "new-runtime",
          viewId: "active", revision: 1, sequence: 1, session: runtimeSession,
          composer: { controls: [], canSubmit: true }, agentRail: { items: [] },
          feed: { revision: 1, blocks: [] }, screens: [], screenModels: [], localCommands: [],
        }),
      }, request, connection),
    });
    controller.applyRuntimeSession(project);
    if (source === "pending") controller.setPendingSessionPath(project.recoveryPath!);
    else controller.markTransportDisconnected();
    const restored = vi.fn();
    const failed = vi.fn();
    const restoration = new ConnectedViewRestorationController({
      isCurrent: (candidate: ChatobbyTransport) => candidate === transport && candidate.isConnected,
      restoreSession: (connection) => controller.reconcileActiveSession(connection),
      synchronizeFrontend: protocol.synchronize, synchronizeActiveScreen: vi.fn(),
      markRestored: restored, reportSessionError: failed, reportFrontendError: failed,
    });
    let created = 0;
    const registry = new FrontendSessionRegistry({
      createTransport: () => ++created === 1 ? transport : {
        isConnected: false, connect: () => hiddenReady, setOperatorViewOpen: async () => {}, disconnect: async () => {},
      } as unknown as ChatobbyTransport,
      bindTransport: () => () => {},
    });
    await registry.register("active");
    await registry.register("hidden");
    binding = registry.bindRuntime({
      identity: { instanceId: "new-runtime", vaultId: "synthetic", pid: 1, startedAt: 1, runtimeVersion: "test", protocolVersion: 1 },
      endpoint: "ws://127.0.0.1:1", ownership: "managed",
    }).then(() => { globallyReady = true; });
    let promptTarget: string | undefined;
    let prompt: Promise<void> | undefined;
    try {
      await vi.waitFor(() => expect(protocol.dispatch).toHaveBeenCalledOnce());
      expect(globallyReady).toBe(false);
      expect(ensureTransport).not.toHaveBeenCalled();
      expect(operations.current("session-transition")?.label).toBe("Restoring session");
      if (source === "pending") expect(controller.recoverySessionPath).toBe(project.recoveryPath);
      restoration.synchronize(transport);
      prompt = controller.ensureActiveSessionTarget().then((target) => { promptTarget = target.sessionId; });
      await flushMicrotasks();
      expect(promptTarget).toBeUndefined();
      releaseResume();
      await vi.waitFor(() => expect(restored).toHaveBeenCalledOnce());
      await prompt;
      expect(promptTarget).toBe("saved-project");
      expect(controller.workspaceLabel()).toBe("Synthetic");
      expect(controller.recoverySessionPath).toBeNull();
      expect(operations.current("session-transition")).toBeNull();
      expect(protocol.dispatch).toHaveBeenCalledOnce();
      expect(failed).not.toHaveBeenCalled();
      expect(globallyReady).toBe(false);
    } finally {
      releaseResume(); releaseHidden();
      await binding; await prompt;
      await registry.dispose();
    }
  });

});
