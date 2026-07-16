// Unit tests for pure state transition functions

import { describe, it, expect } from "vitest";
import { transitionConnection, canRetry, applySessionEvent } from "../src/transitions";
import { INITIAL_CONNECTION_STATE, EMPTY_SESSION_STATE } from "../src/types";
import type { ConnectionState, SessionState } from "../src/types";

// ── Connection State Machine ─────────────────────────────────────────

describe("transitionConnection", () => {
  it("transitions from disconnected to connecting on connect", () => {
    const state = transitionConnection(INITIAL_CONNECTION_STATE, { type: "connect" });
    expect(state.status).toBe("connecting");
    expect(state.reconnectAttempt).toBe(0);
  });

  it("transitions from connecting to connected", () => {
    const state = transitionConnection(
      { status: "connecting", reconnectAttempt: 0 },
      { type: "connected" },
    );
    expect(state.status).toBe("connected");
    expect(state.reconnectAttempt).toBe(0);
  });

  it("transitions from connecting to error", () => {
    const state = transitionConnection(
      { status: "connecting", reconnectAttempt: 0 },
      { type: "error", error: "ECONNREFUSED" },
    );
    expect(state.status).toBe("error");
    expect(state.error).toBe("ECONNREFUSED");
  });

  it("transitions from connected to disconnected", () => {
    const state = transitionConnection(
      { status: "connected", reconnectAttempt: 0 },
      { type: "disconnected" },
    );
    expect(state.status).toBe("disconnected");
  });

  it("increments reconnect attempt on retry", () => {
    const state = transitionConnection(
      { status: "error", error: "timeout", reconnectAttempt: 3 },
      { type: "retry" },
    );
    expect(state.status).toBe("connecting");
    expect(state.reconnectAttempt).toBe(4);
  });

  it("stops retrying at max attempts", () => {
    const state = transitionConnection(
      { status: "error", error: "timeout", reconnectAttempt: 10 },
      { type: "retry" },
    );
    expect(state.status).toBe("error");
    expect(state.error).toBe("Max reconnect attempts reached");
  });

  it("resets attempts on new connect", () => {
    const state = transitionConnection(
      { status: "error", error: "timeout", reconnectAttempt: 5 },
      { type: "connect" },
    );
    expect(state.status).toBe("connecting");
    expect(state.reconnectAttempt).toBe(0);
  });
});

describe("canRetry", () => {
  it("returns true when in error state and under max attempts", () => {
    expect(canRetry({ status: "error", error: "x", reconnectAttempt: 5 })).toBe(true);
  });

  it("returns false when at max attempts", () => {
    expect(canRetry({ status: "error", error: "x", reconnectAttempt: 10 })).toBe(false);
  });

  it("returns false when not in error state", () => {
    expect(canRetry({ status: "connected", reconnectAttempt: 0 })).toBe(false);
    expect(canRetry({ status: "disconnected", reconnectAttempt: 0 })).toBe(false);
    expect(canRetry({ status: "connecting", reconnectAttempt: 0 })).toBe(false);
  });
});

// ── Session State Machine ────────────────────────────────────────────

describe("applySessionEvent", () => {
  it("creates new session with empty state", () => {
    const state = applySessionEvent(EMPTY_SESSION_STATE, {
      type: "new_session",
      sessionId: "abc-123",
    });
    expect(state.sessionId).toBe("abc-123");
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
  });

  it("merges state_update fields", () => {
    const state = applySessionEvent(
      { ...EMPTY_SESSION_STATE, sessionId: "abc" },
      {
        type: "state_update",
        state: {
          sessionId: "abc",
          model: "opus",
          thinkingLevel: "high",
          isStreaming: true,
          isCompacting: false,
          steeringMode: "all",
          followUpMode: "all",
          autoCompaction: { enabled: true, thresholdPercent: 85, effectiveThresholdPercent: 82 },
          messageCount: 5,
          pendingMessageCount: 0,
        },
      },
    );
    expect(state.model).toBe("opus");
    expect(state.thinkingLevel).toBe("high");
    expect(state.isStreaming).toBe(true);
    expect(state.autoCompaction).toEqual({ enabled: true, thresholdPercent: 85, effectiveThresholdPercent: 82 });
  });

  it("appends messages", () => {
    const msg = { role: "user" as const, content: [{ type: "text" as const, text: "hello" }] };
    const state = applySessionEvent(EMPTY_SESSION_STATE, {
      type: "message",
      message: msg,
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toBe(msg);
  });

  it("sets streaming flag on stream_start", () => {
    const state = applySessionEvent(EMPTY_SESSION_STATE, { type: "stream_start" });
    expect(state.isStreaming).toBe(true);
  });

  it("clears streaming flag on stream_end", () => {
    const state = applySessionEvent(
      { ...EMPTY_SESSION_STATE, isStreaming: true },
      { type: "stream_end" },
    );
    expect(state.isStreaming).toBe(false);
  });

  it("sets compacting flag on compact_start", () => {
    const state = applySessionEvent(EMPTY_SESSION_STATE, { type: "compact_start" });
    expect(state.isCompacting).toBe(true);
  });

  it("clears compacting flag on compact_end", () => {
    const state = applySessionEvent(
      { ...EMPTY_SESSION_STATE, isCompacting: true },
      { type: "compact_end" },
    );
    expect(state.isCompacting).toBe(false);
  });

  it("applies backend-resolved model compaction settings", () => {
    const settings = { enabled: false, thresholdPercent: 72, effectiveThresholdPercent: 72 };
    const state = applySessionEvent(EMPTY_SESSION_STATE, { type: "auto_compaction", settings });
    expect(state.autoCompaction).toEqual(settings);
  });
});
