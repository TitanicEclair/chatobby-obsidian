import { describe, expect, it } from "vitest";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { BridgeError } from "../../src/obsidian-bridge/types";
import { createMockApp } from "./helpers/mock-app";

const signal = new AbortController().signal;

describe("retained core operations", () => {
  it("returns live semantic context and environment facts", async () => {
    const app = createMockApp(new Map([["active.md", "# Title\nbody"]]), {
      activeView: { path: "active.md", cursor: { line: 1, ch: 0 }, selection: "body" },
    });
    const result = await executeOperation("context.get", {}, signal, app) as Record<string, unknown>;
    expect(result.activeNote).toMatchObject({ path: "active.md", basename: "active" });
    expect(result.selection).toMatchObject({ text: "body" });
    expect(result.environment).toBeDefined();
  });

  it("resolves exact note paths without reading their contents", async () => {
    const app = createMockApp(new Map([["notes/test.md", "# Test"]]));
    const result = await executeOperation(
      "note.resolve",
      { ref: "notes/test.md", mode: "path" },
      signal,
      app,
    ) as Record<string, unknown>;
    expect(result).toMatchObject({ status: "resolved", note: { path: "notes/test.md" } });
  });

  it("fails invalid resolution input truthfully", async () => {
    await expect(executeOperation("note.resolve", {}, signal, createMockApp(new Map())))
      .rejects.toBeInstanceOf(BridgeError);
  });

  it("rejects removed generic note and vault operations", async () => {
    for (const operation of ["note.read", "note.write", "vault.search", "attachment.read"]) {
      await expect(executeOperation(operation as never, {}, signal, createMockApp(new Map())))
        .rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    }
  });
});
