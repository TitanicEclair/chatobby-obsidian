// Bridge connection state machine — pure, side-effect-free.
// Mirrors the pattern in src/transitions.ts.
//
// States: idle → configuring → connecting → hello_sent → ready
//                                                    ↘ disconnected/error
//
// Close codes drive retry decisions:
//   4000 (replaced)        → terminal error, no retry
//   4002 (protocol error)  → terminal error, no retry (deterministic handshake drift)
//   4401 (auth failed)     → terminal error, no retry (wait for new bridge_config)
//   4503 (disabled)        → terminal error, no retry
//   4003 (bad JSON)        → retry-eligible (transient — single unparseable frame)
//   other                  → retry-eligible (network/transient)
//
// 4002 is terminal because protocol errors are deterministic: resending the same
// hello would fail identically, so retrying would storm. The backend emits 4002 on
// an unknown capability, wrong protocolVersion, or malformed hello shape.
//
// See docs/tooling/bridge-executor.md §7.1 for the full close-code table.

import type { BridgeConnectionState, BridgeConnectionEvent } from "./types";
import { RECONNECT_MAX_ATTEMPTS } from "../ui/shared/constants";

/**
 * Close codes that should NOT be retried — terminal until a new bridge_config arrives.
 * Single source of truth; imported by bridge-client.ts (onclose) and used here
 * (canRetryBridge / transitionBridgeConnection) so the two never drift.
 */
export const TERMINAL_CLOSE_CODES: ReadonlySet<number> = new Set<number>([4000, 4002, 4401, 4503]);

/** @deprecated alias — use {@link TERMINAL_CLOSE_CODES}. Kept for any external callers. */
export const NON_RETRYABLE_CLOSE_CODES = TERMINAL_CLOSE_CODES;

export function transitionBridgeConnection(
  state: BridgeConnectionState,
  event: BridgeConnectionEvent,
): BridgeConnectionState {
  switch (event.type) {
    case "configure":
      // New bridge_config always resets — prior token is invalidated.
      return {
        status: "configuring",
        url: event.url,
        token: event.token,
        reconnectAttempt: 0,
      };

    case "connect":
      return {
        ...state,
        status: "connecting",
      };

    case "hello_sent":
      return {
        ...state,
        status: "hello_sent",
      };

    case "ready":
      return {
        ...state,
        status: "ready",
        reconnectAttempt: 0,
        error: undefined,
        closeCode: undefined,
      };

    case "disconnected":
      return {
        ...state,
        status: "disconnected",
        closeCode: event.code,
        error: event.reason,
      };

    case "error":
      return {
        ...state,
        status: "error",
        error: event.error,
        closeCode: event.code,
      };

    case "retry": {
      if (state.reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
        return {
          ...state,
          status: "error",
          error: "Max reconnect attempts reached",
        };
      }
      // Check if the close code is non-retryable
      if (state.closeCode !== undefined && TERMINAL_CLOSE_CODES.has(state.closeCode)) {
        return {
          ...state,
          status: "error",
          error: state.error ?? `Non-retryable close code: ${state.closeCode}`,
        };
      }
      return {
        ...state,
        status: "connecting",
        reconnectAttempt: state.reconnectAttempt + 1,
      };
    }
  }
}

/** Whether a reconnect retry is allowed from the current state. */
export function canRetryBridge(state: BridgeConnectionState): boolean {
  if (state.status !== "disconnected" && state.status !== "error") return false;
  if (state.reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) return false;
  // Non-retryable close codes
  if (state.closeCode !== undefined && TERMINAL_CLOSE_CODES.has(state.closeCode)) return false;
  return true;
}
