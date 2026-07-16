// Unit tests for bridge router — parse invoke → dispatch → result; cancel → abort; malformed → error.

import { describe, it, expect, vi } from "vitest";
import { routeInboundFrame } from "../../src/obsidian-bridge/bridge-router";
import { createMockApp } from "./helpers/mock-app";
import type { InFlightRequest } from "../../src/obsidian-bridge/types";

function makeInFlight(): Map<string, InFlightRequest> {
  return new Map();
}

describe("routeInboundFrame", () => {
  const app = createMockApp(new Map());

  it("returns INVALID_INPUT for malformed frames", async () => {
    const result = await routeInboundFrame("not-an-object", app, makeInFlight());
    expect(result.outbound).toHaveLength(1);
    const msg = result.outbound[0]!;
    expect(msg.type).toBe("error");
    if (msg.type === "error") {
      expect(msg.error.code).toBe("INVALID_INPUT");
    }
  });

  it("returns INVALID_INPUT for unknown message type", async () => {
    const result = await routeInboundFrame({ type: "unknown" }, app, makeInFlight());
    expect(result.outbound).toHaveLength(1);
    const msg = result.outbound[0]!;
    expect(msg.type).toBe("error");
    if (msg.type === "error") {
      expect(msg.error.code).toBe("INVALID_INPUT");
    }
  });

  it("handles pong frames without action", async () => {
    const result = await routeInboundFrame(
      { type: "pong", sentAt: new Date().toISOString() },
      app,
      makeInFlight(),
    );
    expect(result.outbound).toHaveLength(0);
  });

  it("handles cancel frames and aborts in-flight entry without emitting", async () => {
    const inFlight = makeInFlight();
    const abortController = new AbortController();
    inFlight.set("req-1", {
      operation: "note.read",
      args: {},
      abortController,
      deadline: new Date(Date.now() + 10000),
    });

    const result = await routeInboundFrame(
      { type: "cancel", requestId: "req-1", reason: "client_abort" },
      app,
      inFlight,
    );

    // Cancel emits nothing (handleInvoke will emit DEADLINE_EXCEEDED)
    expect(result.outbound).toHaveLength(0);
    // Controller should be aborted
    expect(abortController.signal.aborted).toBe(true);
    // Entry should still be present (handleInvoke removes it when it settles)
    expect(inFlight.has("req-1")).toBe(true);
  });

  it("handles cancel for non-existent request gracefully (no-op)", async () => {
    const inFlight = makeInFlight();
    const result = await routeInboundFrame(
      { type: "cancel", requestId: "nonexistent", reason: "timeout" },
      app,
      inFlight,
    );

    // Cancel for non-existent request emits nothing
    expect(result.outbound).toHaveLength(0);
    // Should not throw
  });

  it("registers invoke in in-flight table before execution", async () => {
    const inFlight = makeInFlight();

    // Mock a slow operation
    const mockExecute = vi.fn().mockImplementation(async () => {
      // Check that entry is registered during execution
      expect(inFlight.has("req-slow")).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 10));
      return { result: "done" };
    });

    // Temporarily replace executeOperation (would be better with dependency injection,
    // but this proves the registration happens before execution)
    const originalExecute = (await import("../../src/obsidian-bridge/operation-registry")).executeOperation;
    vi.spyOn(await import("../../src/obsidian-bridge/operation-registry"), "executeOperation").mockImplementation(mockExecute);

    const deadline = new Date(Date.now() + 10000).toISOString();
    const result = await routeInboundFrame(
      { type: "invoke", requestId: "req-slow", operation: "note.read", arguments: {}, deadline },
      app,
      inFlight,
    );

    // Entry should be removed after completion
    expect(inFlight.has("req-slow")).toBe(false);
    expect(result.outbound).toHaveLength(1);
    expect(result.outbound[0]!.type).toBe("result");

    mockExecute.mockRestore();
  });

  it("demonstrates cancel does NOT emit outbound (only aborts controller)", async () => {
    const inFlight = makeInFlight();

    // Create an AbortController and add it to the map manually
    const testController = new AbortController();
    inFlight.set("req-cancel-test", {
      operation: "note.read",
      args: {},
      abortController: testController,
      deadline: new Date(Date.now() + 10000),
    });

    // Verify it's in the map
    expect(inFlight.has("req-cancel-test")).toBe(true);
    expect(testController.signal.aborted).toBe(false);

    // Now send cancel
    const cancelResult = await routeInboundFrame(
      { type: "cancel", requestId: "req-cancel-test", reason: "client_abort" },
      app,
      inFlight,
    );

    // The controller should be aborted
    expect(testController.signal.aborted).toBe(true);

    // Entry should still be present (handleInvoke removes it when it settles)
    expect(inFlight.has("req-cancel-test")).toBe(true);

    // Cancel should emit NOTHING (handleInvoke will emit DEADLINE_EXCEEDED)
    expect(cancelResult.outbound).toHaveLength(0);
  });

  it("demonstrates invoke→cancel→abort yields exactly ONE DEADLINE_EXCEEDED from invoke", async () => {
    const inFlight = makeInFlight();

    // Mock a slow operation that does NOT reject on abort (so we can test the race)
    let operationStarted = false;
    let operationReturned = false;

    const mockExecute = vi.fn().mockImplementation(async (_op, _args, signal) => {
      operationStarted = true;
      // Wait for signal to be aborted
      await new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          if (signal.aborted) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 10);
        // Timeout after 500ms
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 500);
      });
      operationReturned = true;
      return { mock: "result" };
    });

    vi.spyOn(await import("../../src/obsidian-bridge/operation-registry"), "executeOperation").mockImplementation(mockExecute);

    // Start invoke - this registers the entry BEFORE awaiting executeOperation
    const invokePromise = routeInboundFrame(
      { type: "invoke", requestId: "req-slow-cancel", operation: "note.read", arguments: {}, deadline: new Date(Date.now() + 10000).toISOString() },
      app,
      inFlight,
    );

    // Give the invoke a moment to start and register
    await new Promise(resolve => setTimeout(resolve, 20));

    // Verify the entry was registered (REAL registration, not pre-seeded)
    expect(inFlight.has("req-slow-cancel")).toBe(true);
    expect(operationStarted).toBe(true);

    // Get the entry BEFORE cancel (this is the real reference)
    const entryBeforeCancel = inFlight.get("req-slow-cancel");
    expect(entryBeforeCancel).toBeDefined();
    expect(entryBeforeCancel!.abortController.signal.aborted).toBe(false);

    // Now send cancel - handleCancel should abort THIS controller but emit NOTHING
    const cancelResult = await routeInboundFrame(
      { type: "cancel", requestId: "req-slow-cancel", reason: "client_abort" },
      app,
      inFlight,
    );

    // The SAME controller we captured should now be aborted
    expect(entryBeforeCancel!.abortController.signal.aborted).toBe(true);

    // Cancel should emit NOTHING
    expect(cancelResult.outbound).toHaveLength(0);

    // Wait for invoke to complete - it should emit exactly ONE DEADLINE_EXCEEDED
    const invokeResult = await invokePromise;

    // Entry should be removed by handleInvoke
    expect(inFlight.has("req-slow-cancel")).toBe(false);

    // Invoke should emit exactly ONE error (DEADLINE_EXCEEDED)
    expect(invokeResult.outbound).toHaveLength(1);
    expect(invokeResult.outbound[0]!.type).toBe("error");
    if (invokeResult.outbound[0]!.type === "error") {
      expect(invokeResult.outbound[0]!.error.code).toBe("DEADLINE_EXCEEDED");
    }

    // Total frames for this requestId: cancel emits 0, invoke emits 1 = 1 total
    expect(cancelResult.outbound.length + invokeResult.outbound.length).toBe(1);

    mockExecute.mockRestore();
  });
});
