// Unit tests for bridge connection state machine.

import { describe, it, expect } from "vitest";
import { transitionBridgeConnection, canRetryBridge } from "../../src/obsidian-bridge/bridge-connection-state";
import { INITIAL_BRIDGE_STATE } from "../../src/obsidian-bridge/types";
import type { BridgeConnectionState } from "../../src/obsidian-bridge/types";

describe("transitionBridgeConnection", () => {
  it("transitions from idle to configuring on configure", () => {
    const state = transitionBridgeConnection(INITIAL_BRIDGE_STATE, {
      type: "configure",
      url: "ws://127.0.0.1:9222",
      token: "test-token",
    });
    expect(state.status).toBe("configuring");
    expect(state.url).toBe("ws://127.0.0.1:9222");
    expect(state.token).toBe("test-token");
    expect(state.reconnectAttempt).toBe(0);
  });

  it("transitions from configuring to connecting on connect", () => {
    const state = transitionBridgeConnection(
      { status: "configuring", url: "ws://x", token: "t", reconnectAttempt: 0 },
      { type: "connect" },
    );
    expect(state.status).toBe("connecting");
  });

  it("transitions from connecting to hello_sent", () => {
    const state = transitionBridgeConnection(
      { status: "connecting", url: "ws://x", token: "t", reconnectAttempt: 0 },
      { type: "hello_sent" },
    );
    expect(state.status).toBe("hello_sent");
  });

  it("transitions from hello_sent to ready", () => {
    const state = transitionBridgeConnection(
      { status: "hello_sent", url: "ws://x", token: "t", reconnectAttempt: 0 },
      { type: "ready" },
    );
    expect(state.status).toBe("ready");
    expect(state.reconnectAttempt).toBe(0);
    expect(state.error).toBeUndefined();
  });

  it("transitions from ready to disconnected", () => {
    const state = transitionBridgeConnection(
      { status: "ready", url: "ws://x", token: "t", reconnectAttempt: 0 },
      { type: "disconnected", code: 1006, reason: "abnormal" },
    );
    expect(state.status).toBe("disconnected");
    expect(state.closeCode).toBe(1006);
  });

  it("transitions from disconnected to error on terminal close code 4000", () => {
    const state = transitionBridgeConnection(
      { status: "disconnected", url: "ws://x", token: "t", reconnectAttempt: 0, closeCode: 4000 },
      { type: "retry" },
    );
    expect(state.status).toBe("error");
    expect(state.closeCode).toBe(4000);
  });

  it("transitions from disconnected to error on terminal close code 4401", () => {
    const state = transitionBridgeConnection(
      { status: "disconnected", url: "ws://x", token: "t", reconnectAttempt: 0, closeCode: 4401 },
      { type: "retry" },
    );
    expect(state.status).toBe("error");
  });

  it("transitions from disconnected to error on terminal close code 4503", () => {
    const state = transitionBridgeConnection(
      { status: "disconnected", url: "ws://x", token: "t", reconnectAttempt: 0, closeCode: 4503 },
      { type: "retry" },
    );
    expect(state.status).toBe("error");
  });

  it("retries from disconnected with transient close code 4003", () => {
    const state = transitionBridgeConnection(
      { status: "disconnected", url: "ws://x", token: "t", reconnectAttempt: 2, closeCode: 4003 },
      { type: "retry" },
    );
    expect(state.status).toBe("connecting");
    expect(state.reconnectAttempt).toBe(3);
  });

  it("retries from disconnected with no close code", () => {
    const state = transitionBridgeConnection(
      { status: "disconnected", url: "ws://x", token: "t", reconnectAttempt: 1 },
      { type: "retry" },
    );
    expect(state.status).toBe("connecting");
    expect(state.reconnectAttempt).toBe(2);
  });

  it("stops retrying at max attempts", () => {
    const state = transitionBridgeConnection(
      { status: "disconnected", url: "ws://x", token: "t", reconnectAttempt: 10 },
      { type: "retry" },
    );
    expect(state.status).toBe("error");
    expect(state.error).toBe("Max reconnect attempts reached");
  });

  it("configure resets state from any status", () => {
    const state = transitionBridgeConnection(
      { status: "error", url: "old", token: "old", reconnectAttempt: 5, error: "old error" },
      { type: "configure", url: "new", token: "new" },
    );
    expect(state.status).toBe("configuring");
    expect(state.url).toBe("new");
    expect(state.token).toBe("new");
    expect(state.reconnectAttempt).toBe(0);
    expect(state.error).toBeUndefined();
  });

  it("error event transitions to error state", () => {
    const state = transitionBridgeConnection(
      { status: "connecting", url: "ws://x", token: "t", reconnectAttempt: 0 },
      { type: "error", error: "Connection refused" },
    );
    expect(state.status).toBe("error");
    expect(state.error).toBe("Connection refused");
  });
});

describe("canRetryBridge", () => {
  it("returns true for disconnected with transient close code", () => {
    expect(canRetryBridge({
      status: "disconnected",
      url: "ws://x",
      token: "t",
      reconnectAttempt: 0,
      closeCode: 4003,
    })).toBe(true);
  });

  it("returns true for disconnected with no close code", () => {
    expect(canRetryBridge({
      status: "disconnected",
      url: "ws://x",
      token: "t",
      reconnectAttempt: 0,
    })).toBe(true);
  });

  it("returns false for terminal close code 4000", () => {
    expect(canRetryBridge({
      status: "disconnected",
      url: "ws://x",
      token: "t",
      reconnectAttempt: 0,
      closeCode: 4000,
    })).toBe(false);
  });

  it("returns false for terminal close code 4401", () => {
    expect(canRetryBridge({
      status: "disconnected",
      url: "ws://x",
      token: "t",
      reconnectAttempt: 0,
      closeCode: 4401,
    })).toBe(false);
  });

  it("returns false for terminal close code 4503", () => {
    expect(canRetryBridge({
      status: "disconnected",
      url: "ws://x",
      token: "t",
      reconnectAttempt: 0,
      closeCode: 4503,
    })).toBe(false);
  });

  it("returns false at max attempts", () => {
    expect(canRetryBridge({
      status: "disconnected",
      url: "ws://x",
      token: "t",
      reconnectAttempt: 10,
    })).toBe(false);
  });

  it("returns false for non-disconnected/error states", () => {
    expect(canRetryBridge({ status: "idle", url: "", token: "", reconnectAttempt: 0 })).toBe(false);
    expect(canRetryBridge({ status: "connecting", url: "", token: "", reconnectAttempt: 0 })).toBe(false);
    expect(canRetryBridge({ status: "ready", url: "", token: "", reconnectAttempt: 0 })).toBe(false);
    expect(canRetryBridge({ status: "hello_sent", url: "", token: "", reconnectAttempt: 0 })).toBe(false);
  });
});
