import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { BridgeError } from "../../src/obsidian-bridge/types";
import { createMockApp, type MockAppOptions, type MockFileCache } from "./helpers/mock-app";

const signal = new AbortController().signal;
type Obj = Record<string, unknown>;

function appWith(files: [string, string][], options?: MockAppOptions) {
  return createMockApp(new Map(files), options);
}

describe("retained plugin-native operations", () => {
  it("audits unresolved links with Obsidian metadata semantics", async () => {
    const cache: Map<string, MockFileCache> = new Map([
      ["n.md", { links: [{ link: "ghost.md" }, { link: "n.md" }] }],
    ]);
    const result = await executeOperation("links.audit", {}, signal, appWith([["n.md", ""]], { cache })) as Obj;
    expect(result.broken).toEqual([expect.objectContaining({ path: "n.md", target: "ghost.md" })]);
  });

  it("imports an attachment through the canonical content contract", async () => {
    const app = appWith([["Notes/source.md", "# Source"]], { activeView: { path: "Notes/source.md" } });
    const result = await executeOperation("attachment.import", {
      fileName: "photo.png",
      sourceNotePath: "Notes/source.md",
      content: "AQID",
      mimeType: "image/png",
    }, signal, app) as Obj;
    expect(result).toMatchObject({
      path: "attachments/photo.png",
      sizeBytes: 3,
      markdownEmbed: "![[attachments/photo.png]]",
    });
  });

  it("reads and edits only a live editor with an exact content revision", async () => {
    const app = appWith([["n.md", "body"]], { activeView: { path: "n.md", cursor: { line: 1, ch: 2 } } });
    const state = await executeOperation(
      "editor.get",
      { target: { path: "n.md" }, includeContent: true },
      signal,
      app,
    ) as Obj;
    expect(state).toMatchObject({ path: "n.md", content: "body" });

    const result = await executeOperation("editor.edit", {
      target: { path: "n.md" },
      expectedContentHash: createHash("sha256").update("body").digest("hex"),
      changes: [{ from: 4, text: "!" }],
    }, signal, app) as Obj;
    expect(result).toMatchObject({ appliedTo: "live-editor", changed: true });
    expect(await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never)).toBe("body!");
  });

  it("rejects stale editor revisions without mutating", async () => {
    const app = appWith([["n.md", "body"]], { activeView: { path: "n.md" } });
    await expect(executeOperation("editor.edit", {
      target: { path: "n.md" },
      expectedContentHash: "a".repeat(64),
      changes: [{ from: 0, text: "x" }],
    }, signal, app)).rejects.toMatchObject({ code: "EDITOR_TRANSFORM_STALE" });
    expect(await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never)).toBe("body");
  });

  it("focuses an existing note and rejects a missing note", async () => {
    expect(await executeOperation("editor.focus", { path: "n.md" }, signal, appWith([["n.md", ""]])))
      .toMatchObject({ focused: true });
    await expect(executeOperation("editor.focus", { path: "missing.md" }, signal, appWith([])))
      .rejects.toBeInstanceOf(BridgeError);
  });

  it("projects and manages the live workspace", async () => {
    const app = appWith([["a.md", ""], ["b.md", ""]], { openNotes: ["a.md", "b.md"] });
    const workspace = await executeOperation("workspace.get", {}, signal, app) as Obj;
    expect(workspace).toMatchObject({ activeLeafId: "leaf-1" });
    expect(workspace.openNotes).toHaveLength(2);
    expect(await executeOperation("workspace.manage", { action: "open", path: "a.md" }, signal, app))
      .toMatchObject({ applied: true });
  });

  it("rejects removed generic metadata, command, and graph operations", async () => {
    for (const operation of ["frontmatter.update", "commands.execute", "retrieval.explore"]) {
      await expect(executeOperation(operation as never, {}, signal, appWith([])))
        .rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    }
  });
});
