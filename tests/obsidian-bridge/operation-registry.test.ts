// Unit tests for operation registry — allowlist, unknown ops, pre-aborted signal,
// and that every family now has a concrete handler (no more UNSUPPORTED stubs).

import { describe, it, expect } from "vitest";
import { executeOperation, listImplementedOperations } from "../../src/obsidian-bridge/operation-registry";
import { createMockApp } from "./helpers/mock-app";
import { BridgeError } from "../../src/obsidian-bridge/types";

describe("executeOperation", () => {
  const app = createMockApp(new Map());
  const signal = new AbortController().signal;

  it("throws UNSUPPORTED_OPERATION for unknown operation name", async () => {
    await expect(
      executeOperation("unknown.op" as never, {}, signal, app),
    ).rejects.toThrow(BridgeError);
  });

  it("throws DEADLINE_EXCEEDED for pre-aborted signal", async () => {
    const abortedController = new AbortController();
    abortedController.abort();

    await expect(
		executeOperation("context.get", {}, abortedController.signal, app),
    ).rejects.toThrow(BridgeError);
  });

  it("dispatches core operations", async () => {
		const result = await executeOperation("note.resolve", { ref: "nonexistent.md", mode: "path" }, signal, app);
		expect(result).toMatchObject({ status: "not_found" });
  });

	it("rejects runtime-owned CLI and removed connector operations", async () => {
    await expect(
      executeOperation("cli.daily", {}, signal, app),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
		await expect(executeOperation("note.read" as never, {}, signal, app))
			.rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
  });

  it("implements every static operation in the vendored protocol", () => {
    const implemented = new Set(listImplementedOperations());
		expect(implemented.size).toBe(26);
    for (const op of [
		"context.get", "note.resolve", "attachment.import", "links.audit",
		"editor.get", "editor.edit", "editor.focus", "editor.history", "workspace.get", "workspace.manage",
      "browser.open", "browser.navigate", "browser.list", "browser.snapshot",
      "browser.read", "browser.dom", "browser.click", "browser.pointer", "browser.type",
      "browser.press", "browser.wait", "browser.screenshot", "browser.diagnostics",
      "browser.close",
		"ui.snapshot", "ui.interact",
    ]) {
      expect(implemented.has(op)).toBe(true);
    }

		for (const op of ["cli.run", "cli.daily", "note.read", "commands.execute", "retrieval.explore"]) {
      expect(implemented.has(op)).toBe(false);
    }
  });
});
