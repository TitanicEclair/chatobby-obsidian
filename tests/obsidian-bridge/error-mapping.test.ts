// Unit tests for error mapping — Obsidian errors → correct bridge error codes.

import { describe, it, expect } from "vitest";
import {
  toBridgeErrorPayload,
  invalidInputError,
  unsupportedOperationError,
  deadlineExceededError,
} from "../../src/obsidian-bridge/bridge-errors";
import { BridgeError } from "../../src/obsidian-bridge/types";

describe("toBridgeErrorPayload", () => {
  it("maps BridgeError directly", () => {
    const error = new BridgeError("NOTE_NOT_FOUND", "Note not found: test.md");
    const payload = toBridgeErrorPayload(error);
    expect(payload.code).toBe("NOTE_NOT_FOUND");
    expect(payload.message).toBe("Note not found: test.md");
    expect(payload.retryable).toBe(false);
  });

  it("maps BridgeError with retryable flag", () => {
    const error = new BridgeError("DEADLINE_EXCEEDED", "Timeout", true);
    const payload = toBridgeErrorPayload(error);
    expect(payload.code).toBe("DEADLINE_EXCEEDED");
    expect(payload.retryable).toBe(true);
  });

  it("maps 'file not found' Error to NOTE_NOT_FOUND", () => {
    const payload = toBridgeErrorPayload(new Error("File not found: test.md"));
    expect(payload.code).toBe("NOTE_NOT_FOUND");
  });

  it("maps 'already exists' Error to PATH_EXISTS", () => {
    const payload = toBridgeErrorPayload(new Error("File already exists: test.md"));
    expect(payload.code).toBe("PATH_EXISTS");
  });

  it("maps 'ambiguous' Error to PATH_AMBIGUOUS", () => {
    const payload = toBridgeErrorPayload(new Error("Multiple matches found, ambiguous path"));
    expect(payload.code).toBe("PATH_AMBIGUOUS");
  });

  it("maps 'mtime' Error to REVISION_CONFLICT", () => {
    const payload = toBridgeErrorPayload(new Error("File mtime mismatch"));
    expect(payload.code).toBe("REVISION_CONFLICT");
  });

  it("maps 'timeout' Error to DEADLINE_EXCEEDED", () => {
    const payload = toBridgeErrorPayload(new Error("Operation timeout"));
    expect(payload.code).toBe("DEADLINE_EXCEEDED");
    expect(payload.retryable).toBe(true);
  });

  it("maps generic Error to OBSIDIAN_OPERATION_FAILED", () => {
    const payload = toBridgeErrorPayload(new Error("Something went wrong"));
    expect(payload.code).toBe("OBSIDIAN_OPERATION_FAILED");
  });

  it("maps non-Error values to OBSIDIAN_OPERATION_FAILED", () => {
    const payload = toBridgeErrorPayload("string error");
    expect(payload.code).toBe("OBSIDIAN_OPERATION_FAILED");
    expect(payload.message).toBe("string error");
  });
});

describe("error factories", () => {
  it("invalidInputError creates INVALID_INPUT payload", () => {
    const payload = invalidInputError("Missing path", { field: "path" });
    expect(payload.code).toBe("INVALID_INPUT");
    expect(payload.message).toBe("Missing path");
    expect(payload.details).toEqual({ field: "path" });
  });

  it("unsupportedOperationError creates UNSUPPORTED_OPERATION payload", () => {
    const payload = unsupportedOperationError("test.op");
    expect(payload.code).toBe("UNSUPPORTED_OPERATION");
    expect(payload.message).toContain("test.op");
  });

  it("deadlineExceededError creates DEADLINE_EXCEEDED payload", () => {
    const payload = deadlineExceededError("req-123");
    expect(payload.code).toBe("DEADLINE_EXCEEDED");
    expect(payload.message).toContain("req-123");
    expect(payload.retryable).toBe(true);
  });
});
