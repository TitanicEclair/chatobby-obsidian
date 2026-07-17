import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatobbyTransport } from "../../src/transport/ws-client";
import type { ReadyRuntime } from "../../src/runtime/public";

function externalRuntime(endpoint = "ws://127.0.0.1:9222"): ReadyRuntime {
  return {
    endpoint,
    ownership: "external",
    identity: {
      instanceId: "external-test",
      vaultId: "external",
      pid: 0,
      startedAt: 0,
      runtimeVersion: "test",
      protocolVersion: 0,
    },
  };
}

interface FakeMessageEvent {
  data: string;
}

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: FakeMessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly sent: string[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }

  serverMessage(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

async function waitForSocketCount(count: number): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (FakeWebSocket.instances.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${count} sockets`);
}

async function waitForSent(socket: FakeWebSocket, count: number): Promise<void> {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (socket.sent.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${count} sent frames`);
}

describe("ChatobbyTransport", () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("deduplicates concurrent and repeated connect calls", async () => {
    const transport = new ChatobbyTransport(externalRuntime());
    const firstConnect = transport.connect();
    const secondConnect = transport.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0]!.open();
    await Promise.all([firstConnect, secondConnect]);
    expect(transport.state.status).toBe("connected");
    await transport.connect();
    expect(FakeWebSocket.instances).toHaveLength(1);
    await transport.disconnect();
  });

	it("rejects a backend request that never receives a response", async () => {
		const transport = new ChatobbyTransport(externalRuntime());
		const connect = transport.connect();
		FakeWebSocket.instances[0]!.open();
		await connect;
		vi.useFakeTimers();
		try {
			const pending = transport.getProviders();
			const rejection = expect(pending).rejects.toThrow(
				"Chatobby runtime request timed out after 30000ms: get_providers",
			);
			await vi.advanceTimersByTimeAsync(30_000);
			await rejection;
		} finally {
			vi.useRealTimers();
			await transport.disconnect();
		}
	});

  it("keeps independent transports connected to the same runtime URL", async () => {
    const first = new ChatobbyTransport(externalRuntime());
    const firstConnect = first.connect();
    FakeWebSocket.instances[0]!.open();
    await firstConnect;
    const second = new ChatobbyTransport(externalRuntime());
    const secondConnect = second.connect();
    await waitForSocketCount(2);
    FakeWebSocket.instances[1]!.open();
    await secondConnect;
    expect(first.state.status).toBe("connected");
    expect(second.state.status).toBe("connected");
    await first.disconnect();
    await second.disconnect();
  });

  it("keeps an extension UI handler registered before the socket exists", async () => {
    const transport = new ChatobbyTransport(externalRuntime());
    const handledIds: string[] = [];
    transport.onExtensionUI(async (request) => {
      handledIds.push(request.id);
      return { accepted: true };
    });
    const connect = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    await connect;
    socket.serverMessage({
      type: "extension_ui_request",
      request: { id: "ui-1", method: "confirm", params: { message: "Proceed?" } },
    });
    await Promise.resolve();
    expect(handledIds).toEqual(["ui-1"]);
    expect(JSON.parse(socket.sent[0]!)).toMatchObject({
      method: "extension_ui_response",
      params: { id: "ui-1", result: { accepted: true } },
    });
    await transport.disconnect();
  });

  it("forwards bridge credentials without exposing raw runtime events", async () => {
    const transport = new ChatobbyTransport(externalRuntime());
    const configs: unknown[] = [];
    transport.onBridgeConfig((config) => configs.push(config));
    const connect = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    await connect;
    socket.serverMessage({ type: "bridge_config", url: "http://127.0.0.1:1", token: "scoped" });
    expect(configs).toEqual([{ type: "bridge_config", url: "http://127.0.0.1:1", token: "scoped" }]);
    await transport.disconnect();
  });

  it("dispatches product changes only through the versioned frontend intent method", async () => {
    const transport = new ChatobbyTransport(externalRuntime());
    const connect = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    await connect;
    const intent = {
      schemaVersion: 1 as const,
      intentId: "intent-1",
      viewId: "view-1",
      mainSessionId: "session-1",
      type: "session.rename" as const,
      payload: { name: "Published connector" },
    };
    const pending = transport.dispatchFrontendIntent(intent);
    await waitForSent(socket, 1);
    const frame = JSON.parse(socket.sent[0]!);
    expect(frame).toMatchObject({ method: "frontend_intent", params: intent });
    socket.serverMessage({
      id: frame.id,
      type: "response",
      result: { outcome: { intentId: "intent-1", status: "completed", revision: 2 } },
    });
    await expect(pending).resolves.toEqual({ intentId: "intent-1", status: "completed", revision: 2 });
    await transport.disconnect();
  });

  it("loads and normalizes only public session-library metadata", async () => {
    const transport = new ChatobbyTransport(externalRuntime());
    const connect = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    await connect;
    const pending = transport.listSessions("C:/vault/Projects", true);
    await waitForSent(socket, 1);
    const frame = JSON.parse(socket.sent[0]!);
    expect(frame).toMatchObject({
      method: "list_sessions",
      params: { cwdOverride: "C:/vault/Projects", includeDescendants: true },
    });
    socket.serverMessage({
      id: frame.id,
      type: "response",
      result: {
        sessions: [{
          path: "C:/sessions/s1.jsonl",
          id: "s1",
          cwd: "C:/vault/Projects",
          created: "2026-07-01T00:00:00.000Z",
          modified: "2026-07-02T00:00:00.000Z",
          messageCount: 1,
          firstMessage: "resume me",
        }],
      },
    });
    await expect(pending).resolves.toMatchObject([{
      id: "s1",
      cwd: "C:/vault/Projects",
      firstMessage: "resume me",
      created: new Date("2026-07-01T00:00:00.000Z"),
    }]);
    await transport.disconnect();
  });

  it("keeps stored-session operations narrow and path-addressed", async () => {
    const transport = new ChatobbyTransport(externalRuntime());
    const connect = transport.connect();
    const socket = FakeWebSocket.instances[0]!;
    socket.open();
    await connect;
    const pending = transport.getStoredSessionForkMessages("C:/sessions/s1.jsonl", "C:/vault");
    await waitForSent(socket, 1);
    const frame = JSON.parse(socket.sent[0]!);
    expect(frame).toMatchObject({
      method: "get_stored_session_fork_messages",
      params: { sessionPath: "C:/sessions/s1.jsonl", cwdRoot: "C:/vault" },
    });
    socket.serverMessage({
      id: frame.id,
      type: "response",
      result: { messages: [{ entryId: "entry-1", text: "fork me" }] },
    });
    await expect(pending).resolves.toEqual([{ entryId: "entry-1", text: "fork me" }]);
    await transport.disconnect();
  });
});
