// Bridge router — parses inbound frames, dispatches to operation registry,
// serializes outbound result/error frames.
//
// See docs/tooling/bridge-executor.md §7.3 for the roundtrip diagram.

import type { App } from "obsidian";
import type {
  ObsidianBridgeResult,
  ObsidianBridgeError,
  ObsidianBridgePing,
  ObsidianBridgeInvoke,
  ObsidianBridgeCancel,
} from "../vendor/@chatobby/obsidian-protocol/bridge-protocol";
import { parseServerToPluginMessage } from "../vendor/@chatobby/obsidian-protocol/bridge-protocol";
import type { ObsidianBridgeErrorPayload } from "../vendor/@chatobby/obsidian-protocol/bridge-errors";
import type { InFlightRequest } from "./types";
import { executeOperation } from "./operation-registry";
import { toBridgeErrorPayload, deadlineExceededError } from "./bridge-errors";
import { BridgeError } from "./types";

/** Result of processing a single inbound frame. */
export interface RouteResult {
  /** Outbound messages to send back to the bridge. */
  outbound: Array<ObsidianBridgeResult | ObsidianBridgeError | ObsidianBridgePing>;
}

/**
 * Process a raw inbound WebSocket frame.
 * Mutates the in-flight table directly for invoke/cancel.
 * Returns outbound messages to send.
 */
export async function routeInboundFrame(
  raw: unknown,
  app: App,
  inFlight: Map<string, InFlightRequest>,
): Promise<RouteResult> {
  let parsed;
  try {
    parsed = parseServerToPluginMessage(raw);
  } catch (e) {
    // Malformed frame — send error back
    const payload: ObsidianBridgeErrorPayload = {
      code: "INVALID_INPUT",
      message: e instanceof Error ? e.message : String(e),
      retryable: false,
    };
    return {
      outbound: [{ type: "error", requestId: "unknown", error: payload }],
    };
  }

  switch (parsed.type) {
    case "invoke":
      return handleInvoke(parsed, app, inFlight);

    case "cancel":
      return handleCancel(parsed, inFlight);

    case "pong":
      // Pong is a keepalive ack — no action needed.
      return { outbound: [] };
  }
}

async function handleInvoke(
  invoke: ObsidianBridgeInvoke,
  app: App,
  inFlight: Map<string, InFlightRequest>,
): Promise<RouteResult> {
  const { requestId, operation, arguments: args, deadline } = invoke;

  // Parse deadline ISO string → AbortController timeout
  const deadlineDate = new Date(deadline);
  const now = Date.now();
  const timeoutMs = deadlineDate.getTime() - now;

  const abortController = new AbortController();

  // Arm local timeout if deadline is in the future
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);
    // Clear timer if aborted externally (cancel)
    abortController.signal.addEventListener("abort", () => {
      if (timer !== null) clearTimeout(timer);
    }, { once: true });
  } else {
    // Deadline already passed
    abortController.abort();
  }

  // Register in-flight entry BEFORE execution (so cancel can find it)
  const entry: InFlightRequest = {
    operation: operation as InFlightRequest["operation"],
    args,
    abortController,
    deadline: deadlineDate,
  };
  inFlight.set(requestId, entry);

  // Race operation execution against abort signal
  try {
    // Create a promise that rejects when abort fires
    const abortPromise = new Promise<never>((_, reject) => {
      if (abortController.signal.aborted) {
        reject(new BridgeError("DEADLINE_EXCEEDED", "Request aborted", true));
        return;
      }
      abortController.signal.addEventListener("abort", () => {
        reject(new BridgeError("DEADLINE_EXCEEDED", "Request aborted", true));
      }, { once: true });
    });

    // Race: if abort wins, we reject with DEADLINE_EXCEEDED; if operation wins, we get result
    const result = await Promise.race([
      executeOperation(operation as InFlightRequest["operation"], args, abortController.signal, app),
      abortPromise,
    ]);

    // Success — remove in-flight entry
    inFlight.delete(requestId);
    // Clean up timer
    if (timer !== null) clearTimeout(timer);

    return {
      outbound: [{ type: "result", requestId, result }],
    };
  } catch (e) {
    // Error — remove in-flight entry
    inFlight.delete(requestId);
    // Clean up timer
    if (timer !== null) clearTimeout(timer);

    // Check if aborted (either by cancel or local deadline)
    if (abortController.signal.aborted || e instanceof BridgeError && e.code === "DEADLINE_EXCEEDED") {
      return {
        outbound: [{ type: "error", requestId, error: deadlineExceededError(requestId) }],
      };
    }
    const payload = toBridgeErrorPayload(e);
    return {
      outbound: [{ type: "error", requestId, error: payload }],
    };
  }
}

function handleCancel(
  cancel: ObsidianBridgeCancel,
  inFlight: Map<string, InFlightRequest>,
): RouteResult {
  const { requestId, reason } = cancel;
  const entry = inFlight.get(requestId);

  // Abort the in-flight entry if it exists
  // Entry removal happens in handleInvoke when it settles
  if (entry) {
    // Stash cancel reason for forward-compat with Phase 4 distinct error codes
    entry.cancelReason = reason;
    entry.abortController.abort();
  }

  // Cancel emits nothing — handleInvoke will emit the DEADLINE_EXCEEDED error
  return { outbound: [] };
}

/**
 * Serialize an outbound message to JSON for the WebSocket.
 */
export function serializeOutbound(message: ObsidianBridgeResult | ObsidianBridgeError | ObsidianBridgePing): string {
  return JSON.stringify(message);
}
