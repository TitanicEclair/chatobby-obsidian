// Conformance for bridge WS close codes — terminal vs retry-eligible.
// Guards against the reconnect-storm regression: 4002 (protocol error) must be
// terminal so a deterministic handshake drift surfaces as an error, not a retry loop.

import { describe, it, expect } from "vitest";
import {
  TERMINAL_CLOSE_CODES,
  transitionBridgeConnection,
  canRetryBridge,
} from "../../src/obsidian-bridge/bridge-connection-state";
import type { BridgeConnectionState } from "../../src/obsidian-bridge/types";

function disconnected(code: number): BridgeConnectionState {
  return {
    status: "disconnected",
    url: "ws://127.0.0.1:0/api/obsidian/bridge",
    token: "t",
    reconnectAttempt: 0,
    closeCode: code,
  };
}

describe("bridge terminal close codes", () => {
  it("includes the backend's terminal codes", () => {
    // Backend close codes (packages/chatobby/src/obsidian-bridge/routes.ts):
    // 4000 replaced, 4002 protocol error, 4401 auth, 4503 disabled.
    expect(TERMINAL_CLOSE_CODES.has(4000)).toBe(true);
    expect(TERMINAL_CLOSE_CODES.has(4002)).toBe(true);
    expect(TERMINAL_CLOSE_CODES.has(4401)).toBe(true);
    expect(TERMINAL_CLOSE_CODES.has(4503)).toBe(true);
  });

  it("treats 4003 (bad JSON) and network codes as retry-eligible", () => {
    expect(TERMINAL_CLOSE_CODES.has(4003)).toBe(false);
    expect(TERMINAL_CLOSE_CODES.has(1006)).toBe(false);
    expect(TERMINAL_CLOSE_CODES.has(1001)).toBe(false);
  });
});

describe("canRetryBridge", () => {
  it("returns false for terminal codes", () => {
    for (const code of [4000, 4002, 4401, 4503]) {
      expect(canRetryBridge(disconnected(code))).toBe(false);
    }
  });

  it("returns true for transient codes (within attempt budget)", () => {
    expect(canRetryBridge(disconnected(4003))).toBe(true);
    expect(canRetryBridge(disconnected(1006))).toBe(true);
  });

  it("returns false once the attempt budget is exhausted", () => {
    const state = disconnected(1006);
    state.reconnectAttempt = 9999;
    expect(canRetryBridge(state)).toBe(false);
  });
});

describe("transitionBridgeConnection retry", () => {
  it("goes to error (no retry) for terminal codes", () => {
    for (const code of [4000, 4002, 4401, 4503]) {
      const next = transitionBridgeConnection(disconnected(code), { type: "retry" });
      expect(next.status).toBe("error");
    }
  });

  it("reconnects for transient codes", () => {
    const next = transitionBridgeConnection(disconnected(4003), { type: "retry" });
    expect(next.status).toBe("connecting");
    expect(next.reconnectAttempt).toBe(1);
  });

  it("configure resets a terminal error (new bridge_config re-enables retry)", () => {
    const errored = transitionBridgeConnection(disconnected(4002), { type: "retry" });
    expect(errored.status).toBe("error");
    const reconfigured = transitionBridgeConnection(errored, {
      type: "configure",
      url: "ws://127.0.0.1:1/api/obsidian/bridge",
      token: "t2",
    });
    expect(reconfigured.status).toBe("configuring");
    expect(reconfigured.reconnectAttempt).toBe(0);
  });
});
