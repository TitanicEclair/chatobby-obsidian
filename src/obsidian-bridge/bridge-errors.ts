// Bridge error mapping — Obsidian errors → ObsidianBridgeErrorCode.
// See docs/tooling/bridge-executor.md for the error code table.

import type { ObsidianBridgeErrorPayload } from "../vendor/@chatobby/obsidian-protocol/bridge-errors";
import { BridgeError } from "./types";

/**
 * Create a standardized error payload from a BridgeError or unknown error.
 * Maps Obsidian API errors to the correct bridge error codes.
 */
export function toBridgeErrorPayload(error: unknown): ObsidianBridgeErrorPayload {
  if (error instanceof BridgeError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.details !== undefined ? { details: error.details } : {}),
    };
  }

  // Map common Obsidian errors to bridge codes
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes("file not found") || msg.includes("no such file")) {
      return { code: "NOTE_NOT_FOUND", message: error.message, retryable: false };
    }
    if (msg.includes("already exists") || msg.includes("file exists")) {
      return { code: "PATH_EXISTS", message: error.message, retryable: false };
    }
    if (msg.includes("ambiguous") || msg.includes("multiple matches")) {
      return { code: "PATH_AMBIGUOUS", message: error.message, retryable: false };
    }
    if (msg.includes("revision") || msg.includes("mtime") || msg.includes("modified")) {
      return { code: "REVISION_CONFLICT", message: error.message, retryable: false };
    }
    if (msg.includes("timeout") || msg.includes("deadline")) {
      return { code: "DEADLINE_EXCEEDED", message: error.message, retryable: true };
    }

    return { code: "OBSIDIAN_OPERATION_FAILED", message: error.message, retryable: false };
  }

  return {
    code: "OBSIDIAN_OPERATION_FAILED",
    message: String(error),
    retryable: false,
  };
}

// I dont think the below are being used.
/**
 * Create an INVALID_INPUT error payload.
 */
export function invalidInputError(message: string, details?: unknown): ObsidianBridgeErrorPayload {
  return {
    code: "INVALID_INPUT",
    message,
    retryable: false,
    ...(details !== undefined ? { details } : {}),
  };
}

/**
 * Create an UNSUPPORTED_OPERATION error payload.
 */
export function unsupportedOperationError(operation: string): ObsidianBridgeErrorPayload {
  return {
    code: "UNSUPPORTED_OPERATION",
    message: `Operation not yet implemented: ${operation}`,
    retryable: false,
  };
}

/**
 * Create a DEADLINE_EXCEEDED error payload.
 */
export function deadlineExceededError(requestId: string): ObsidianBridgeErrorPayload {
  return {
    code: "DEADLINE_EXCEEDED",
    message: `Request ${requestId} exceeded its deadline`,
    retryable: true,
  };
}
