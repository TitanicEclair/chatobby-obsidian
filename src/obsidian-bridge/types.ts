// Bridge executor local types.
// See docs/tooling/bridge-executor.md for architecture.

import type { App } from "obsidian";
import type { ObsidianBridgeErrorCode } from "../vendor/@chatobby/obsidian-protocol/bridge-errors";
import type { ObsidianOperationName } from "../vendor/@chatobby/obsidian-protocol/bridge-operations";

// ── Bridge connection state machine ────────────────────────────────────

export type BridgeConnectionStatus =
  | "idle"
  | "configuring"
  | "connecting"
  | "hello_sent"
  | "ready"
  | "disconnected"
  | "error";

export interface BridgeConnectionState {
  status: BridgeConnectionStatus;
  url: string;
  token: string;
  reconnectAttempt: number;
  error?: string;
  /** Close code from the bridge WS, if any. Drives retry decisions. */
  closeCode?: number;
}

export type BridgeConnectionEvent =
  | { type: "configure"; url: string; token: string }
  | { type: "connect" }
  | { type: "hello_sent" }
  | { type: "ready" }
  | { type: "disconnected"; code?: number; reason?: string }
  | { type: "error"; error: string; code?: number }
  | { type: "retry" };

// ── In-flight request tracking ─────────────────────────────────────────

export interface InFlightRequest {
  operation: ObsidianOperationName;
  args: Record<string, unknown>;
  abortController: AbortController;
  deadline: Date;
  /** Cancel reason stashed for forward-compat with Phase 4 distinct error codes */
  cancelReason?: "timeout" | "client_abort" | "disconnect" | "shutdown";
}

// ── Operation handler signature ────────────────────────────────────────

export type OperationHandler = (
  args: Record<string, unknown>,
  signal: AbortSignal,
  app: App,
) => Promise<unknown>;

// ── Bridge error (thrown by operation handlers) ────────────────────────

export class BridgeError extends Error {
  constructor(
    public readonly code: ObsidianBridgeErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

// ── Initial state ──────────────────────────────────────────────────────

export const INITIAL_BRIDGE_STATE: BridgeConnectionState = {
  status: "idle",
  url: "",
  token: "",
  reconnectAttempt: 0,
};
