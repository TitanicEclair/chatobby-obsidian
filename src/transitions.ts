// State transitions for connection lifecycle + event application for session state.
//
// Connection: genuine state machine with discrete states and transitions.
// Session: event reducer — applies events to state, not a state machine.
//
// No side effects. No DOM. Fully unit-testable.
//
// Note: the compaction divider block is NOT driven by SessionEvent — the
// runtime projects it as a `divider` feed block via the patch stream (see
// feed-adapter), so the feed store renders/updates it like any other block.

import type {
  ConnectionState,
  ConnectionEvent,
  SessionState,
  SessionEvent,
} from "./types";
import { EMPTY_SESSION_STATE } from "./types";
import { RECONNECT_MAX_ATTEMPTS } from "./ui/shared/constants";

// ── Connection State Machine ─────────────────────────────────────────
//
//   ┌─────────────┐    connect()    ┌────────────┐
//   │ disconnected │ ──────────────> │ connecting  │
//   └─────────────┘                 └─────┬──────┘
//        ▲                          ws.onopen│    │ws.onerror
//        │ws.onclose                ┌───────┘    └──────┐
//        │    ┌─────────────────────┘                   ▼
//        │    │                               ┌────────────┐
//   ┌────┴────┴──┐                            │   error     │
//   │  connected  │<───────────────────────────│             │
//   └────────────┘  (any state: connect())     └──────┬─────┘
//                                                     │retry()
//                                                     │(if attempts < max)
//                                                     └──> connecting
//

export function transitionConnection(
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState {
  switch (event.type) {
    case "connect":
      return { status: "connecting", reconnectAttempt: 0 };

    case "connected":
      return { status: "connected", reconnectAttempt: 0 };

    case "error":
      return { status: "error", error: event.error, reconnectAttempt: state.reconnectAttempt };

    case "disconnected":
      return { status: "disconnected", reconnectAttempt: state.reconnectAttempt };

    case "retry":
      if (state.reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
        return { status: "error", error: "Max reconnect attempts reached", reconnectAttempt: state.reconnectAttempt };
      }
      return { status: "connecting", reconnectAttempt: state.reconnectAttempt + 1 };
  }
}

/** Whether a reconnect retry is allowed from the current state. */
export function canRetry(state: ConnectionState): boolean {
  return state.status === "error" && state.reconnectAttempt < RECONNECT_MAX_ATTEMPTS;
}

// ── Session Event Reducer ────────────────────────────────────────────
//
// NOT a state machine — session state is a flat struct with boolean flags,
// not discrete states. This is an event applier (reducer pattern).
//
// Events:
//   new_session   → reset to empty, set sessionId
//   state_update  → merge server-authoritative fields
//   message       → append to messages array
//   stream_start  → set isStreaming = true
//   stream_end    → set isStreaming = false
//   compact_start → set isCompacting = true
//   compact_end   → set isCompacting = false
//

export function applySessionEvent(
  state: SessionState,
  event: SessionEvent,
): SessionState {
  switch (event.type) {
    case "new_session":
      return {
        ...EMPTY_SESSION_STATE,
        sessionId: event.sessionId,
      };

    case "state_update":
      return {
        ...state,
        sessionId: event.state.sessionId,
        model: event.state.model,
        thinkingLevel: event.state.thinkingLevel,
        isStreaming: event.state.isStreaming,
        isCompacting: event.state.isCompacting,
        autoCompaction: event.state.autoCompaction,
      };

    case "message":
      return {
        ...state,
        messages: [...state.messages, event.message],
      };

    case "stream_start":
      return { ...state, isStreaming: true };

    case "stream_end":
      return { ...state, isStreaming: false };

    case "compact_start":
      return { ...state, isCompacting: true };

    case "compact_end":
      return { ...state, isCompacting: false };

    case "queue_update":
      return { ...state, steering: event.steering, followUp: event.followUp };

    case "thinking_changed":
      return { ...state, thinkingLevel: event.level };

    case "retry_start":
      return { ...state, isRetrying: true };

    case "retry_end":
      return { ...state, isRetrying: false };

    case "auto_compaction":
      return { ...state, autoCompaction: event.settings };
  }
}
