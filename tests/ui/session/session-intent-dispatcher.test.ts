import { describe, expect, it, vi } from "vitest";
import type { ChatobbyTransport } from "../../../src/transport/ws-client";
import type { FrontendBootstrap, FrontendIntentResult } from "../../../src/vendor/chatobby-client/frontend-contracts.js";
import { dispatchSessionMutation } from "../../../src/ui/controller/session-intent-dispatcher";

// @see docs/architecture/managed-runtime-lifecycle.md#leaf-session-recovery
describe("session intent connection admission", () => {
  it("aborts an old bootstrap wait without waiting for its reply or dispatching its intent", async () => {
    const oldReply = deferred();
    const transport = { isConnected: true } as ChatobbyTransport;
    const options = harness(transport);
    const old = new AbortController();
    const current = new AbortController();
    const addOld = vi.spyOn(old.signal, "addEventListener");
    const addCurrent = vi.spyOn(current.signal, "addEventListener");
    const removeOld = vi.spyOn(old.signal, "removeEventListener");
    const removeCurrent = vi.spyOn(current.signal, "removeEventListener");
    options.protocol.synchronize.mockImplementationOnce(() => oldReply.promise);
    const request = { type: "session.resume" as const, payload: { sessionPath: "C:/synthetic/chat.jsonl" } };
    const previous = dispatchSessionMutation(options, request, { transport, signal: old.signal, isCurrent: () => !old.signal.aborted }).catch((error: Error) => error);
    old.abort();
    expect(await previous).toMatchObject({ message: "Chatobby connection changed while restoring this session." });
    expect(options.protocol.dispatch).not.toHaveBeenCalled();
    await expect(dispatchSessionMutation(options, request, { transport, signal: current.signal, isCurrent: () => true })).resolves.toBe(true);
    expect(options.protocol.dispatch).toHaveBeenCalledOnce();
    for (const call of addOld.mock.calls) expect(removeOld).toHaveBeenCalledWith("abort", call[1]);
    for (const call of addCurrent.mock.calls) expect(removeCurrent).toHaveBeenCalledWith("abort", call[1]);
    oldReply.resolve(); await flush();
    expect(options.protocol.dispatch).toHaveBeenCalledOnce();
    expect(options.ensureTransport).not.toHaveBeenCalled();
  });

  it("keeps ordinary user actions waiting for global readiness", async () => {
    const gate = deferred();
    const transport = { isConnected: true } as ChatobbyTransport;
    const options = harness(transport);
    options.ensureTransport.mockImplementation(async () => { await gate.promise; return transport; });
    const dispatch = dispatchSessionMutation(options, { type: "session.resume", payload: { sessionPath: "C:/synthetic/chat.jsonl" } });
    try {
      await flush();
      expect(options.ensureTransport).toHaveBeenCalledOnce();
      expect(options.protocol.synchronize).not.toHaveBeenCalled();
      expect(options.protocol.dispatch).not.toHaveBeenCalled();
      gate.resolve();
      await expect(dispatch).resolves.toBe(true);
    } finally { gate.resolve(); await dispatch; }
  });

  it.each(["before-bootstrap", "after-bootstrap", "after-dispatch"] as const)("rejects a retired epoch %s even when the transport object is reused", async (stage) => {
    const transport = { isConnected: true } as ChatobbyTransport;
    const options = harness(transport);
    let current = stage !== "before-bootstrap";
    if (stage === "after-bootstrap") options.protocol.synchronize.mockImplementation(async () => { current = false; });
    if (stage === "after-dispatch") options.protocol.dispatch.mockImplementation(async () => { current = false; return applied(); });
    await expect(dispatchSessionMutation(options, {
      type: "session.resume", payload: { sessionPath: "C:/synthetic/chat.jsonl" },
    }, { transport, signal: new AbortController().signal, isCurrent: () => current })).rejects.toThrow("connection changed");
    expect(options.ensureTransport).not.toHaveBeenCalled();
    expect(options.protocol.dispatch).toHaveBeenCalledTimes(stage === "after-dispatch" ? 1 : 0);
  });

  it.each(["disconnected", "replaced"] as const)("rejects a %s restoration connection", async (state) => {
    const transport = { isConnected: state !== "disconnected" } as ChatobbyTransport;
    const options = harness(state === "replaced" ? { isConnected: true } as ChatobbyTransport : transport);
    await expect(dispatchSessionMutation(options, {
      type: "session.resume", payload: { sessionPath: "C:/synthetic/chat.jsonl" },
    }, { transport, signal: new AbortController().signal, isCurrent: () => true })).rejects.toThrow("connection changed");
    expect(options.protocol.synchronize).not.toHaveBeenCalled();
  });

  it("preserves informational no-op and structured session rejection outcomes", async () => {
    const options = harness({ isConnected: true } as ChatobbyTransport);
    const request = { type: "session.resume" as const, payload: { sessionPath: "C:/synthetic/chat.jsonl" } };
    options.protocol.dispatch.mockResolvedValue({ ...applied(), status: "rejected", errorCode: "CANCELLED", notice: { level: "info", message: "Cancelled" } });
    await expect(dispatchSessionMutation(options, request)).resolves.toBe(false);
    options.protocol.dispatch.mockResolvedValue({ ...applied(), status: "rejected", errorCode: "SESSION_NOT_FOUND", notice: { level: "error", message: "Missing saved chat" } });
    await expect(dispatchSessionMutation(options, request)).rejects.toMatchObject({ code: "SESSION_NOT_FOUND", message: "Missing saved chat" });
  });
});

function harness(transport: ChatobbyTransport) {
  const snapshot: FrontendBootstrap = {
    schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime", revision: 1, sequence: 1,
    viewId: "view", session: null, composer: { controls: [], canSubmit: true },
    agentRail: { items: [] }, feed: { revision: 1, blocks: [] }, screens: [], screenModels: [], localCommands: [],
  };
  return {
    getTransport: () => transport, ensureTransport: vi.fn(async () => transport), getSnapshot: () => snapshot,
    protocol: { synchronize: vi.fn(async () => {}), dispatch: vi.fn(async (): Promise<FrontendIntentResult> => applied()) },
  };
}
function applied(): FrontendIntentResult {
  return { schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "runtime", viewId: "view", intentId: "intent", status: "applied", revision: 2 };
}
function deferred() {
  let resolve!: () => void;
  return { promise: new Promise<void>((done) => { resolve = done; }), resolve };
}
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
