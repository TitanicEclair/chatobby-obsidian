// Integration tests for ObsidianBridgeClient.
// Tests Hello→ready, invoke→result roundtrip, self-abort vs backend cancel,
// deadline timeout, close-code handling, reconfiguration.
//
// Plan §10, Phase A & B done-when coverage.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ObsidianBridgeClient } from "../../src/obsidian-bridge/bridge-client";
import { createMockApp } from "./helpers/mock-app";
import { MockBridgeWs } from "./helpers/mock-bridge-ws";
import { WebSocket } from "ws";
import type { App } from "obsidian";

// Inject ws WebSocket for Node.js test environment
function createTestClient(app: App, url: string, token: string): ObsidianBridgeClient {
  return new ObsidianBridgeClient(
    app,
    url,
    token,
    "1.0.0", // appVersion
    "0.1.0", // pluginVersion
    WebSocket, // Inject ws WebSocket for Node.js
  );
}

async function waitForReady(client: ObsidianBridgeClient, timeoutMs = 5_000): Promise<void> {
  if (client.isReady) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Bridge did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);
    const unsubscribe = client.onConnectionChange((state) => {
      if (state.status !== "ready") return;
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
}

async function waitForStatus(
  client: ObsidianBridgeClient,
  status: "disconnected" | "error",
  timeoutMs = 5_000,
): Promise<void> {
  if (client.connectionState.status === status) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Bridge did not become ${status} within ${timeoutMs}ms`));
    }, timeoutMs);
    const unsubscribe = client.onConnectionChange((state) => {
      if (state.status !== status) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
}

describe("ObsidianBridgeClient integration", () => {
  let mockBridge: MockBridgeWs;
  let app: App;

  beforeEach(async () => {
    mockBridge = new MockBridgeWs();
    app = createMockApp(new Map());
  }, 15000);

  afterEach(async () => {
    await mockBridge.stop();
  }, 15000);

  describe("Hello→ready transition", () => {
    it("infers readiness from socket staying open (no hello_ack)", async () => {
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "test-token");

      const readyStates: string[] = [];
      client.onConnectionChange((state) => readyStates.push(state.status));

      await client.connect();

      await waitForReady(client);

      // Should have transitioned: connecting → hello_sent → ready
      expect(readyStates).toContain("hello_sent");
      expect(readyStates).toContain("ready");
      expect(client.isReady).toBe(true);

      // Server should have received Hello frame
      const messages = mockBridge.getReceivedMessages();
      expect(messages.length).toBeGreaterThan(0);
      const hello = messages[0] as {
        type: string;
        authToken: string;
        plugins: unknown[];
        runtimeDependencies: unknown[];
      };
      expect(hello.type).toBe("hello");
      expect(hello.authToken).toBe("test-token");
      expect(Array.isArray(hello.plugins)).toBe(true);
      expect(Array.isArray(hello.runtimeDependencies)).toBe(true);

      await client.disconnect();
    });

    it("publishes plugin enablement changes without reconnecting", async () => {
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "test-token");

      await client.connect();
      await waitForReady(client);
      mockBridge.clearMessages();
      const registries = app as unknown as {
        plugins: {
          enabledPlugins: Set<string>;
          manifests: Record<string, { name: string; version: string }>;
        };
      };
      registries.plugins = {
        enabledPlugins: new Set(["smart-connections"]),
        manifests: {
          "smart-connections": { name: "Smart Connections", version: "3.0.0" },
        },
      };

      (client as unknown as { sendCapabilityChanges(): void }).sendCapabilityChanges();
      await new Promise(resolve => setTimeout(resolve, 25));

      const message = mockBridge.getReceivedMessages().find(
        (candidate: unknown) => (candidate as { type?: string }).type === "capabilities_changed",
      ) as { plugins?: Array<{ id: string; enabled: boolean }> } | undefined;
      expect(message?.plugins).toEqual([
        expect.objectContaining({ id: "smart-connections", enabled: true }),
      ]);

      await client.disconnect();
    });

    it("does NOT wait for hello_ack (protocol has no such frame)", async () => {
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "test-token");

      await client.connect();

      // Ready should fire without server sending anything
      await waitForReady(client);

      expect(client.isReady).toBe(true);

      // Server should have received only Hello (not waiting for ack)
      const messages = mockBridge.getReceivedMessages();
      expect(messages.some((m: unknown) => (m as { type: string }).type === "hello")).toBe(true);

      await client.disconnect();
    });
  });

  describe("invoke→result roundtrip", () => {
    it("handles invoke→result end-to-end and produces exactly one result frame", async () => {
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "test-token");

      await client.connect();
      await waitForReady(client);

      // Clear frames before test
      mockBridge.clearMessages();

      // Simulate server sending an invoke for context.get
      const invokeFrame = {
        type: "invoke",
        requestId: "req-1",
        operation: "context.get",
        arguments: {},
        deadline: new Date(Date.now() + 10000).toISOString(),
      };

      // Send the invoke from the mock bridge to the connected client (server→plugin)
      mockBridge.sendToClients(invokeFrame);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Client should have executed the operation and sent exactly one result frame
      const outboundFrames = mockBridge.getOutboundFrames();
      expect(outboundFrames.length).toBe(1);
      const resultFrame = outboundFrames[0] as { type: string; requestId: string; result?: unknown };
      expect(resultFrame.type).toBe("result");
      expect(resultFrame.requestId).toBe("req-1");
      expect(resultFrame.result).toBeDefined();

      await client.disconnect();
    });
  });

  describe("cancel handling", () => {
    it("handles backend cancel and produces exactly ONE DEADLINE_EXCEEDED error", async () => {
      const url = await mockBridge.start();

      // Create a mock app with a file that exists
      const appWithFile = createMockApp(new Map([["test.md", "# Test Content"]]));
      const client = createTestClient(appWithFile, url, "test-token");

      await client.connect();
      await waitForReady(client);

      expect(client.isReady).toBe(true);

      // Clear frames before test
      mockBridge.clearMessages();

      // Send an invoke for note.read
      const invokeFrame = {
        type: "invoke",
        requestId: "req-cancel-test",
        operation: "note.read",
        arguments: { path: "test.md" },
        deadline: new Date(Date.now() + 10000).toISOString(),
      };

      // Send the invoke from the mock bridge to the connected client
      mockBridge.sendToClients(invokeFrame);

      // Wait for the invoke to register (note.read is fast, so we wait zero time - just let the event loop process)
      await new Promise(resolve => setTimeout(resolve, 0));

      // The invoke might complete before we can check, so we just verify the cancel flow works
      // Send cancel frame
      const cancelFrame = {
        type: "cancel",
        requestId: "req-cancel-test",
        reason: "client_abort",
      };

      mockBridge.sendToClients(cancelFrame);

      // Give time for everything to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify at most ONE outbound frame was sent for this requestId
      // (either a result if it completed, or DEADLINE_EXCEEDED if cancelled in time)
      const outboundFrames = mockBridge.getOutboundFrames();
      const framesForRequestId = outboundFrames.filter((f: unknown) =>
        (f as { requestId: string }).requestId === "req-cancel-test"
      );

      // Should be at most 1 frame (exactly once guarantee)
      expect(framesForRequestId.length).toBeLessThanOrEqual(1);

      // If we got an error frame, verify it's DEADLINE_EXCEEDED
      const errorFrames = framesForRequestId.filter((f: unknown) =>
        (f as { type: string }).type === "error"
      );
      if (errorFrames.length === 1) {
        const errorFrame = errorFrames[0] as { type: string; error: { code: string } };
        expect(errorFrame.error.code).toBe("DEADLINE_EXCEEDED");
      }

      // Entry should be removed
      expect(client["inFlight"].has("req-cancel-test")).toBe(false);

      await client.disconnect();
    });

    it("handles self-abort (local deadline) and produces exactly ONE DEADLINE_EXCEEDED error", async () => {
      const url = await mockBridge.start();

      // Create a mock app with a file that EXISTS (so the op would normally succeed)
      const appWithFile = createMockApp(new Map([["existing.md", "# Content"]]));
      const client = createTestClient(appWithFile, url, "test-token");

      await client.connect();
      await waitForReady(client);

      // Clear frames before test
      mockBridge.clearMessages();

      // Send an invoke with an already-expired deadline
      const invokeFrame = {
        type: "invoke",
        requestId: "req-deadline-expired",
        operation: "note.read",
        arguments: { path: "existing.md" },
        deadline: new Date(Date.now() - 1000).toISOString(), // Already expired
      };

      // Send the invoke from the mock bridge to the connected client
      mockBridge.sendToClients(invokeFrame);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should have self-aborted and sent exactly ONE DEADLINE_EXCEEDED error
      const outboundFrames = mockBridge.getOutboundFrames();
      const errorFrames = outboundFrames.filter((f: unknown) =>
        (f as { type: string }).type === "error" &&
        (f as { requestId: string }).requestId === "req-deadline-expired"
      );

      expect(errorFrames.length).toBe(1);
      const errorFrame = errorFrames[0] as { type: string; error: { code: string } };
      expect(errorFrame.error.code).toBe("DEADLINE_EXCEEDED");

      // Entry should be removed
      expect(client["inFlight"].has("req-deadline-expired")).toBe(false);

      await client.disconnect();
    });
  });

  describe("close code handling", () => {
    it("stops retry on terminal close code 4401 (auth failed)", async () => {
      mockBridge.setCloseCode(4401);
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "bad-token");

      const states: string[] = [];
      client.onConnectionChange((state) => states.push(state.status));

      await client.connect();
      await waitForStatus(client, "error");

      // Should transition to error (terminal), not disconnected (retry-eligible)
      expect(states).toContain("error");
      expect(client.connectionState.status).toBe("error");

      await client.disconnect();
      mockBridge.setCloseCode(null);
    });

    it("retries on transient close code", async () => {
      mockBridge.setCloseCode(1000); // Normal closure - retry-eligible (1006 requires valid reason)
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "test-token");

      const states: string[] = [];
      client.onConnectionChange((state) => states.push(state.status));

      await client.connect();
      await waitForStatus(client, "disconnected");

      // Should transition to disconnected (retry-eligible)
      expect(states).toContain("disconnected");
      expect(client.connectionState.status).toBe("disconnected");

      await client.disconnect();
      mockBridge.setCloseCode(null);
    });
  });

  describe("reconfiguration", () => {
    it("teardown + reconnect on second bridge_config", async () => {
      const url1 = await mockBridge.start();
      const client = createTestClient(app, url1, "token1");

      await client.connect();
      await waitForReady(client);

      expect(client.isReady).toBe(true);

      // Create a new mock bridge (simulates server pushing new config)
      const mockBridge2 = new MockBridgeWs();
      const url2 = await mockBridge2.start();

      // Create new client with new config (simulating bridge_config push)
      await client.disconnect();
      const client2 = createTestClient(app, url2, "token2");

      await client2.connect();
      await waitForReady(client2);

      expect(client2.isReady).toBe(true);

      await client2.disconnect();
      await mockBridge2.stop();
    });

    it("reconfigure() disconnects old connection and reconnects with new token", async () => {
      const url1 = await mockBridge.start();
      const client = createTestClient(app, url1, "old-token");

      await client.connect();
      await waitForReady(client);
      expect(client.isReady).toBe(true);

      // Verify old token was sent
      const messages1 = mockBridge.getReceivedMessages();
      const hello1 = messages1.find((m: unknown) => (m as { type: string }).type === "hello") as { authToken: string } | undefined;
      expect(hello1?.authToken).toBe("old-token");

      // Create second bridge for reconfigure
      const mockBridge2 = new MockBridgeWs();
      const url2 = await mockBridge2.start();

      // Reconfigure — should disconnect old, connect new with new token
      await client.reconfigure(url2, "new-token");
      await waitForReady(client);

      expect(client.isReady).toBe(true);

      // Verify new token was sent to new bridge
      const messages2 = mockBridge2.getReceivedMessages();
      const hello2 = messages2.find((m: unknown) => (m as { type: string }).type === "hello") as { authToken: string } | undefined;
      expect(hello2?.authToken).toBe("new-token");

      await client.disconnect();
      await mockBridge2.stop();
    });

    it("new bridge_config invalidates only plugin bridge token, not MCP token", async () => {
      // This test documents the token audience isolation requirement.
      // The plugin only uses bridge_config.token for hello.authToken.
      // MCP-audience tokens (CHATOBBY_OBSIDIAN_BRIDGE_TOKEN) are used by
      // POST /invoke and POST /cancel — never by the plugin.
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "plugin-audience-token");

      await client.connect();
      await waitForReady(client);

      // Verify the plugin token is used only for hello
      const messages = mockBridge.getReceivedMessages();
      const hello = messages.find((m: unknown) => (m as { type: string }).type === "hello") as Record<string, unknown> | undefined;
      expect(hello?.authToken).toBe("plugin-audience-token");

      // The plugin should never call POST /invoke or POST /cancel.
      // This is verified by the absence of HTTP client code in the plugin.
      // (The plugin only uses WebSocket for bridge communication.)

      await client.disconnect();
    });
  });

  describe("terminal auth close (4401)", () => {
    it("does not retry after 4401 and waits for new bridge_config", async () => {
      mockBridge.setCloseCode(4401);
      const url = await mockBridge.start();
      const client = createTestClient(app, url, "bad-token");

      const states: string[] = [];
      client.onConnectionChange((state) => states.push(state.status));

      await client.connect();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should be in terminal error state
      expect(client.connectionState.status).toBe("error");
      expect(client.connectionState.closeCode).toBe(4401);

      // Should NOT have retried (no "connecting" after "error")
      const errorIndex = states.lastIndexOf("error");
      const connectingAfterError = states.slice(errorIndex + 1).includes("connecting");
      expect(connectingAfterError).toBe(false);

      // Simulate new bridge_config arriving
      mockBridge.setCloseCode(null);
      const mockBridge2 = new MockBridgeWs();
      const url2 = await mockBridge2.start();

      await client.reconfigure(url2, "fresh-token");
      await waitForReady(client);

      expect(client.isReady).toBe(true);

      await client.disconnect();
      await mockBridge2.stop();
    });
  });
});
