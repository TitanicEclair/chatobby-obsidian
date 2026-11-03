import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadyRuntime } from "../../src/runtime/public";
import { ChatobbyTransport } from "../../src/transport/ws-client";
import { RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_ATTEMPTS, RECONNECT_MAX_DELAY_MS } from "../../src/ui/shared/constants";

class RuntimeSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: RuntimeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  private hello?: { protocolVersion: number; instanceId: string; vaultId: string };

  constructor(readonly url: string) {
    RuntimeSocket.instances.push(this);
  }

  send(data: string): void {
    this.hello = JSON.parse(data);
  }

  open(): void {
    this.readyState = RuntimeSocket.OPEN;
    this.onopen?.();
    this.onmessage?.({ data: JSON.stringify({
      ...this.hello, type: "hello_pending", runtimeVersion: "test", phase: "migration",
    }) });
  }

  acknowledge(): void {
    this.onmessage?.({ data: JSON.stringify({ ...this.hello, type: "hello_ack", runtimeVersion: "test" }) });
  }

  close(code = 1000, reason = "closed"): void {
    this.readyState = RuntimeSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

function runtime(instanceId = "runtime-1"): ReadyRuntime {
  return {
    endpoint: `ws://127.0.0.1/${instanceId}`,
    ownership: "developer",
    identity: { instanceId, vaultId: "vault-test", pid: 1, startedAt: 0, runtimeVersion: "test", protocolVersion: 1 },
    session: {
      instanceId, vaultId: "vault-test", protocolVersion: 1, pluginVersion: "test",
      attachmentId: "attachment-test", sessionToken: "synthetic-session-token",
    },
  };
}

function latestSocket(): RuntimeSocket {
  const socket = RuntimeSocket.instances.at(-1);
  if (!socket) throw new Error("Expected a runtime socket");
  return socket;
}

async function rejectInitialization(): Promise<void> {
  const socket = latestSocket();
  socket.open();
  socket.close(1011, "Chatobby connection failed. synthetic-diagnostic");
  await vi.advanceTimersByTimeAsync(0);
}

describe("runtime reconnect policy", () => {
  let transport: ChatobbyTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    RuntimeSocket.instances = [];
    vi.stubGlobal("WebSocket", RuntimeSocket);
    transport = new ChatobbyTransport(runtime());
  });

  afterEach(async () => {
    await transport.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("backs off rejected initialization, closes each failed socket and stops at the existing retry limit", async () => {
    const first = transport.connect();
    const rejected = expect(first).rejects.toThrow("Chatobby connection failed");
    await rejectInitialization();
    await rejected;

    for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt += 1) {
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1), RECONNECT_MAX_DELAY_MS);
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(RuntimeSocket.instances).toHaveLength(attempt);
      await vi.advanceTimersByTimeAsync(1);
      expect(RuntimeSocket.instances).toHaveLength(attempt + 1);
      expect(transport.state).toMatchObject({ status: "connecting", reconnectAttempt: attempt });
      await rejectInitialization();
      expect(RuntimeSocket.instances.every((socket) => socket.readyState === RuntimeSocket.CLOSED)).toBe(true);
    }
    expect(transport.state).toMatchObject({ status: "error", reconnectAttempt: RECONNECT_MAX_ATTEMPTS });
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_DELAY_MS * 2);
    expect(RuntimeSocket.instances).toHaveLength(RECONNECT_MAX_ATTEMPTS + 1);
  });

  it("starts a fresh retry budget for an explicit connection and cancels the pending automatic retry", async () => {
    const first = transport.connect().catch(() => {});
    await rejectInitialization();
    await first;
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
    await rejectInitialization();
    expect(transport.state.reconnectAttempt).toBe(1);

    const explicit = transport.connect();
    expect(transport.state).toMatchObject({ status: "connecting", reconnectAttempt: 0 });
    latestSocket().open();
    latestSocket().acknowledge();
    await explicit;
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_DELAY_MS);
    expect(RuntimeSocket.instances).toHaveLength(3);
    expect(transport.state).toEqual({ status: "connected", reconnectAttempt: 0 });
  });

  it("uses a fresh retry budget and identity after runtime replacement", async () => {
    const first = transport.connect().catch(() => {});
    await rejectInitialization();
    await first;
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
    await rejectInitialization();
    await transport.setRuntime(runtime("runtime-2"));
    const replacement = transport.connect();
    expect(latestSocket().url).toBe("ws://127.0.0.1/runtime-2");
    expect(transport.state).toMatchObject({ status: "connecting", reconnectAttempt: 0 });
    latestSocket().open();
    latestSocket().acknowledge();
    await replacement;
    expect(transport.state).toEqual({ status: "connected", reconnectAttempt: 0 });
  });

  it("resets backoff after a successful automatic reconnect", async () => {
    const first = transport.connect().catch(() => {});
    await rejectInitialization();
    await first;
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS);
    latestSocket().open();
    latestSocket().acknowledge();
    await vi.advanceTimersByTimeAsync(0);
    expect(transport.state).toEqual({ status: "connected", reconnectAttempt: 0 });
    latestSocket().close(1006, "connection interrupted");
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS - 1);
    expect(RuntimeSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(RuntimeSocket.instances).toHaveLength(3);
    await rejectInitialization();
  });
});
