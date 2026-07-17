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
      executeOperation("note.read", { path: "test.md" }, abortedController.signal, app),
    ).rejects.toThrow(BridgeError);
  });

  it("dispatches core operations", async () => {
    // note.read with non-existent file should throw NOTE_NOT_FOUND
    await expect(
      executeOperation("note.read", { path: "nonexistent.md" }, signal, app),
    ).rejects.toThrow(BridgeError);
  });

  it("dispatches plugin-native operations (registry.status is implemented)", async () => {
    const result = await executeOperation("registry.status", {}, signal, app) as Record<string, unknown>;
    expect(result.vault).toBeDefined();
    expect(Array.isArray(result.capabilities)).toBe(true);
  });

  it("dispatches retrieval operations (implemented — invalid input throws)", async () => {
    await expect(
      executeOperation("retrieval.explore", {}, signal, app),
    ).rejects.toThrow(BridgeError);
  });

  it("rejects runtime-owned CLI process operations", async () => {
    await expect(
      executeOperation("cli.daily", {}, signal, app),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
  });

  it("implements every static operation in the vendored protocol", () => {
    const implemented = new Set(listImplementedOperations());
    // Only operations requiring the live Obsidian process are connector-owned.
    expect(implemented.size).toBe(52);
    for (const op of [
      "context.get", "note.read", "vault.search", "note.resolve", "attachment.read",
      "vault.list", "note.write", "note.edit", "note.open", "app.open",
      "registry.status", "metadata.get", "folder.create", "entry.copy", "entry.move",
      "entry.trash", "attachment.import", "links.generate", "tags.list", "properties.list",
      "frontmatter.update", "links.get", "links.audit", "graph.traverse", "tasks.list",
      "tasks.update", "editor.get", "editor.edit", "editor.focus", "workspace.get",
      "workspace.manage", "commands.list", "commands.execute", "hotkeys.list",
      "browser.open", "browser.navigate", "browser.list", "browser.snapshot",
      "browser.read", "browser.dom", "browser.click", "browser.type",
      "browser.press", "browser.wait", "browser.screenshot",
      "browser.close",
      "retrieval.explore", "retrieval.trace", "retrieval.related", "retrieval.hubs",
      "retrieval.communities", "retrieval.explain",
    ]) {
      expect(implemented.has(op)).toBe(true);
    }

    for (const op of ["cli.result.read", "cli.run", "cli.daily", "cli.outline"]) {
      expect(implemented.has(op)).toBe(false);
    }
  });
});
