// Handler tests for the Phase C plugin-native operations (data + runtime).
// Each op gets a happy path and at least one error path via executeOperation.

import { describe, it, expect } from "vitest";
import { createMockApp } from "./helpers/mock-app";
import type { MockFileCache, MockAppOptions } from "./helpers/mock-app";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { BridgeError } from "../../src/obsidian-bridge/types";

const signal = new AbortController().signal;
type Obj = Record<string, unknown>;

function appWith(files: [string, string][], opts?: MockAppOptions) {
  return createMockApp(new Map(files), opts);
}

// ── Data ops ──────────────────────────────────────────────────────────

describe("registry.status", () => {
  it("returns vault identity + advertised capabilities", async () => {
    const r = (await executeOperation("registry.status", {}, signal, appWith([]))) as Obj;
    expect((r.vault as Obj).name).toBe("Test Vault");
    expect((r.capabilities as string[]).length).toBe(11);
    expect(r.capabilities).not.toContain("cli");
  });
});

describe("metadata.get", () => {
  const cache: Map<string, MockFileCache> = new Map([
    ["n.md", { frontmatter: { a: 1 }, tags: [{ tag: "#x" }], links: [{ link: "b.md" }] }],
  ]);
  it("returns frontmatter / tags / links / stat", async () => {
    const r = (await executeOperation("metadata.get", { path: "n.md" }, signal, appWith([["n.md", "# n"]], { cache }))) as Obj;
    expect(r.frontmatter).toEqual({ a: 1 });
    expect(r.tags as unknown[]).toHaveLength(1);
    expect(r.links as unknown[]).toHaveLength(1);
    expect(r.stat).toBeDefined();
  });
  it("throws NOTE_NOT_FOUND for a missing note", async () => {
    await expect(executeOperation("metadata.get", { path: "nope.md" }, signal, appWith([], { cache }))).rejects.toThrow(BridgeError);
  });
  it("throws INVALID_INPUT when path missing", async () => {
    await expect(executeOperation("metadata.get", {}, signal, appWith([]))).rejects.toThrow(BridgeError);
  });
});

describe("properties.list", () => {
  it("aggregates frontmatter keys with inferred types + counts", async () => {
    const cache: Map<string, MockFileCache> = new Map([
      ["a.md", { frontmatter: { score: 1, tag: "x" } }],
      ["b.md", { frontmatter: { score: 2, done: true } }],
    ]);
    const r = (await executeOperation("properties.list", {}, signal, appWith([["a.md", ""], ["b.md", ""]], { cache }))) as Obj;
    const props = r.properties as Array<Obj>;
    const score = props.find((p) => p.key === "score")!;
    expect(score.count).toBe(2);
    expect(score.type).toBe("number");
  });
});

describe("frontmatter.update", () => {
  it("merges a new key into the frontmatter block", async () => {
    const app = appWith([["n.md", "---\na: 1\n---\nbody"]]);
    const r = (await executeOperation("frontmatter.update", { path: "n.md", properties: { b: 2 } }, signal, app)) as Obj;
    expect(r.changed).toBe(true);
    const file = app.vault.getAbstractFileByPath("n.md")!;
    expect(await app.vault.read(file as never)).toContain("b: 2");
  });
  it("rejects a non-object properties argument", async () => {
    await expect(executeOperation("frontmatter.update", { path: "n.md", properties: "x" }, signal, appWith([["n.md", "x"]]))).rejects.toThrow(BridgeError);
  });
  it("honours expectedMtime (revision conflict guard)", async () => {
    const app = appWith([["n.md", "---\na: 1\n---\nbody"]]);
    // wrong mtime → REVISION_CONFLICT
    await expect(
      executeOperation("frontmatter.update", { path: "n.md", properties: { a: 2 }, expectedMtime: 9999 }, signal, app),
    ).rejects.toThrow(BridgeError);
  });
  it("mode=replace replaces all frontmatter keys", async () => {
    const app = appWith([["n.md", "---\na: 1\nb: 2\n---\nbody"]]);
    const r = (await executeOperation("frontmatter.update", { path: "n.md", properties: { c: 3 }, mode: "replace" }, signal, app)) as Obj;
    expect(r.changed).toBe(true);
    const content = await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never);
    expect(content).toContain("c: 3");
    expect(content).not.toContain("a: 1");
    expect(content).not.toContain("b: 2");
  });
});

describe("tags.list", () => {
  it("aggregates tags with counts across files", async () => {
    const cache: Map<string, MockFileCache> = new Map([
      ["a.md", { tags: [{ tag: "#foo" }, { tag: "#bar" }] }],
      ["b.md", { tags: [{ tag: "#foo" }] }],
    ]);
    const r = (await executeOperation("tags.list", {}, signal, appWith([["a.md", ""], ["b.md", ""]], { cache }))) as Obj;
    const tags = r.tags as Array<Obj>;
    expect(tags.find((t) => t.name === "foo")!.count).toBe(2);
    expect(tags.find((t) => t.name === "bar")!.count).toBe(1);
  });
});

describe("links.generate", () => {
  it("builds a wikilink and a markdown link", async () => {
    const app = appWith([["Note.md", "x"]]);
    const wiki = (await executeOperation("links.generate", { path: "Note.md" }, signal, app)) as Obj;
    expect(wiki.link).toBe("[[Note]]");
    const md = (await executeOperation("links.generate", { path: "Note.md", format: "markdown", alias: "See" }, signal, app)) as Obj;
    expect(md.link).toBe("[See](Note.md)");
  });
  it("throws INVALID_INPUT without path or ref", async () => {
    await expect(executeOperation("links.generate", {}, signal, appWith([]))).rejects.toThrow(BridgeError);
  });
});

describe("links.get", () => {
  const resolvedLinks = { "a.md": { "b.md": 1 } };
  const cache: Map<string, MockFileCache> = new Map([["a.md", { links: [{ link: "b.md" }] }]]);
  it("returns outgoing for a note", async () => {
    const r = (await executeOperation("links.get", { path: "a.md" }, signal, appWith([["a.md", ""]], { cache, resolvedLinks }))) as Obj;
    expect((r.outgoing as unknown[])).toHaveLength(1);
  });
  it("returns incoming (backlinks) for the target", async () => {
    const app = appWith([["a.md", ""], ["b.md", ""]], { cache, resolvedLinks });
    const r = (await executeOperation("links.get", { path: "b.md", direction: "in" }, signal, app)) as Obj;
    expect((r.incoming as Array<Obj>)[0]!.source).toBe("a.md");
  });
});

describe("links.audit", () => {
  it("flags unresolved links as broken", async () => {
    const cache: Map<string, MockFileCache> = new Map([["n.md", { links: [{ link: "ghost.md" }, { link: "n.md" }] }]]);
    const app = appWith([["n.md", ""]], { cache });
    const r = (await executeOperation("links.audit", {}, signal, app)) as Obj;
    const broken = r.broken as Array<Obj>;
    expect(broken).toHaveLength(1);
    expect(broken[0]!.target).toBe("ghost.md");
  });
});

describe("graph.traverse", () => {
  const resolvedLinks = { "a.md": { "b.md": 1 }, "b.md": { "c.md": 1 } };
  it("walks the link graph by depth", async () => {
    const app = appWith([["a.md", ""], ["b.md", ""], ["c.md", ""]], { resolvedLinks });
    const r = (await executeOperation("graph.traverse", { path: "a.md", depth: 2 }, signal, app)) as Obj;
    const nodes = r.nodes as Array<Obj>;
    expect(nodes.map((n) => n.path)).toEqual(expect.arrayContaining(["a.md", "b.md", "c.md"]));
  });
  it("accepts MCP startPath/maxDepth/maxNodes arguments", async () => {
    const app = appWith([["a.md", ""], ["b.md", ""], ["c.md", ""]], { resolvedLinks });
    const r = (await executeOperation("graph.traverse", { startPath: "a.md", maxDepth: 2, maxNodes: 2 }, signal, app)) as Obj;
    expect((r.nodes as Array<Obj>).map((n) => n.path)).toContain("a.md");
  });
  it("throws NOTE_NOT_FOUND for an unknown root", async () => {
    await expect(executeOperation("graph.traverse", { path: "nope.md" }, signal, appWith([], { resolvedLinks }))).rejects.toThrow(BridgeError);
  });
});

describe("tasks.list / tasks.update", () => {
  it("lists tasks and toggles one by line", async () => {
    const app = appWith([["n.md", "- [ ] one\n- [x] two"]]);
    const listed = (await executeOperation("tasks.list", {}, signal, app)) as Obj;
    expect((listed.tasks as unknown[])).toHaveLength(2);

    const updated = (await executeOperation("tasks.update", { path: "n.md", line: 1, status: "checked" }, signal, app)) as Obj;
    expect(updated.changed).toBe(true);
    expect(await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never)).toContain("- [x] one");
  });
  it("accepts MCP task statuses", async () => {
    const app = appWith([["n.md", "- [ ] one"]]);
    const updated = (await executeOperation("tasks.update", { path: "n.md", line: 1, status: "done" }, signal, app)) as Obj;
    expect(updated.changed).toBe(true);
    expect(await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never)).toContain("- [x] one");
  });
  it("sets in_progress status to [>] marker (not cancelled)", async () => {
    const app = appWith([["n.md", "- [ ] one"]]);
    const updated = (await executeOperation("tasks.update", { path: "n.md", line: 1, status: "in_progress" }, signal, app)) as Obj;
    expect(updated.changed).toBe(true);
    const content = await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never);
    expect(content).toContain("- [>] one");
    expect(content).not.toContain("- [-] one");
  });
  it("toggles by find and rejects bad status", async () => {
    const app = appWith([["n.md", "- [ ] one"]]);
    const r = (await executeOperation("tasks.update", { path: "n.md", find: "one", status: "checked" }, signal, app)) as Obj;
    expect(r.changed).toBe(true);
    await expect(executeOperation("tasks.update", { path: "n.md", status: "bogus" }, signal, app)).rejects.toThrow(BridgeError);
  });
});

describe("folder.create / entry.copy / entry.move / entry.trash / attachment.import", () => {
  it("creates a folder and rejects duplicates", async () => {
    const app = appWith([]);
    await executeOperation("folder.create", { path: "new" }, signal, app);
    await expect(executeOperation("folder.create", { path: "new" }, signal, app)).rejects.toThrow(BridgeError);
  });
  it("copies, moves, and trashes entries", async () => {
    const app = appWith([["a.md", "hello"]]);
    const copy = (await executeOperation("entry.copy", { source: "a.md", destination: "b.md" }, signal, app)) as Obj;
    expect((copy.note as Obj).path).toBe("b.md");
    const move = (await executeOperation("entry.move", { source: "a.md", destination: "c.md" }, signal, app)) as Obj;
    expect((move.note as Obj).path).toBe("c.md");
    const trash = (await executeOperation("entry.trash", { path: "b.md" }, signal, app)) as Obj;
    expect(trash.trashed).toBe(true);
    expect(app.vault.getAbstractFileByPath("b.md")).toBeNull();
  });
  it("throws when fileManager.trashFile is unavailable (never hard-deletes)", async () => {
    const app = appWith([["a.md", "x"]]);
    (app.fileManager as unknown as { trashFile?: unknown }).trashFile = undefined;
    await expect(executeOperation("entry.trash", { path: "a.md" }, signal, app)).rejects.toThrow(BridgeError);
    expect(app.vault.getAbstractFileByPath("a.md")).not.toBeNull();
  });
  it("accepts MCP sourcePath/targetPath for copy and move", async () => {
    const app = appWith([["a.md", "hello"]]);
    const copy = (await executeOperation("entry.copy", { sourcePath: "a.md", targetPath: "b.md" }, signal, app)) as Obj;
    expect((copy.note as Obj).path).toBe("b.md");
    const move = (await executeOperation("entry.move", { sourcePath: "a.md", targetPath: "c.md" }, signal, app)) as Obj;
    expect((move.note as Obj).path).toBe("c.md");
  });
  it("imports an attachment from base64", async () => {
    const app = appWith([]);
    const r = (await executeOperation("attachment.import", { path: "img.png", base64: "AAEC" }, signal, app)) as Obj;
    expect(r.sizeBytes).toBe(3);
    await expect(executeOperation("attachment.import", { path: "img.png", base64: "AAEC" }, signal, app)).rejects.toThrow(BridgeError);
  });
  it("accepts MCP-canonical targetPath + content fields", async () => {
    const app = appWith([]);
    const r = (await executeOperation("attachment.import", { targetPath: "pic.webp", content: "AQID", mimeType: "image/webp" }, signal, app)) as Obj;
    expect(r.sizeBytes).toBe(3);
    expect((r as { path?: string }).path).toBe("pic.webp");
    expect((r as { mimeType?: string }).mimeType).toBe("image/webp");
    // duplicate still rejected
    await expect(executeOperation("attachment.import", { targetPath: "pic.webp", content: "AA" }, signal, app)).rejects.toThrow(BridgeError);
  });
  it("uses Obsidian's attachment location and returns a ready embed", async () => {
    const app = appWith([["Notes/source.md", "# Source"]], { activeView: { path: "Notes/source.md" } });
    const r = (await executeOperation(
      "attachment.import",
      { fileName: "photo.png", sourceNotePath: "Notes/source.md", content: "AQID", mimeType: "image/png" },
      signal,
      app,
    )) as Obj;
    expect(r).toMatchObject({
      path: "attachments/photo.png",
      markdownLink: "[[attachments/photo.png]]",
      markdownEmbed: "![[attachments/photo.png]]",
    });
    expect(app.vault.getAbstractFileByPath("attachments/photo.png")).not.toBeNull();
  });
  it("rejects copy/move onto an existing destination", async () => {
    const app = appWith([["a.md", "x"], ["b.md", "y"]]);
    await expect(executeOperation("entry.copy", { source: "a.md", destination: "b.md" }, signal, app)).rejects.toThrow(BridgeError);
  });
});

// ── Runtime ops ───────────────────────────────────────────────────────

describe("editor.get / editor.edit", () => {
  it("returns the active editor state", async () => {
    const app = appWith([["n.md", "body"]], { activeView: { path: "n.md", cursor: { line: 1, ch: 2 }, selection: "sel" } });
    const r = (await executeOperation("editor.get", { path: "n.md" }, signal, app)) as Obj;
    expect(r.available).toBe(true);
    expect(r.cursor).toEqual({ line: 2, ch: 2 });
    expect(r.selection).toBe("sel");
  });
  it("reports unavailable with no active view", async () => {
    const r = (await executeOperation("editor.get", {}, signal, appWith([]))) as Obj;
    expect(r.available).toBe(false);
  });
  it("edits the live editor buffer", async () => {
    const app = appWith([["n.md", "body"]], { activeView: { path: "n.md" } });
    const r = (await executeOperation("editor.edit", { path: "n.md", edit: { mode: "append", content: "!" } }, signal, app)) as Obj;
    expect(r.appliedTo).toBe("editor");
    expect(r.changed).toBe(true);
  });
  it("accepts MCP insert and replace editor edits", async () => {
    const app = appWith([["n.md", "body"]], { activeView: { path: "n.md" } });
    await executeOperation("editor.edit", { edit: { mode: "insert", content: "pre-", at: { line: 0, ch: 0 } } }, signal, app);
    await executeOperation("editor.edit", { edit: { mode: "replace", content: "BODY", from: { line: 0, ch: 4 }, to: { line: 0, ch: 8 } } }, signal, app);
    expect(await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never)).toBe("pre-BODY");
  });
});

describe("editor.focus", () => {
  it("focuses a note", async () => {
    const app = appWith([["n.md", "body"]]);
    const r = (await executeOperation("editor.focus", { path: "n.md", line: 3 }, signal, app)) as Obj;
    expect(r.focused).toBe(true);
  });
  it("throws NOTE_NOT_FOUND for a missing note", async () => {
    await expect(executeOperation("editor.focus", { path: "nope.md" }, signal, appWith([]))).rejects.toThrow(BridgeError);
  });
});

describe("workspace.get / workspace.manage", () => {
  it("lists open notes", async () => {
    const app = appWith([["a.md", ""], ["b.md", ""]], { openNotes: ["a.md", "b.md"] });
    const r = (await executeOperation("workspace.get", {}, signal, app)) as Obj;
    expect((r.openNotes as unknown[])).toHaveLength(2);
    expect(r).toMatchObject({ activeLeafId: "leaf-1" });
    expect((r.leaves as Array<Obj>).map((leaf) => leaf.leafId)).toEqual(["leaf-1", "leaf-2"]);
    expect(r.layout).toBeDefined();
  });
  it("opens a note via manage", async () => {
    const app = appWith([["n.md", ""]]);
    const r = (await executeOperation("workspace.manage", { action: "open", path: "n.md" }, signal, app)) as Obj;
    expect(r.applied).toBe(true);
  });
  it("accepts MCP split/duplicate/close manage actions", async () => {
    const app = appWith([["n.md", ""]], { activeView: { path: "n.md" } });
    const split = (await executeOperation("workspace.manage", { action: "split", leafId: "leaf-1", direction: "right" }, signal, app)) as Obj;
    const duplicate = (await executeOperation("workspace.manage", { action: "duplicate", leafId: "leaf-1" }, signal, app)) as Obj;
    const close = (await executeOperation("workspace.manage", { action: "close", leafId: split.leafId }, signal, app)) as Obj;
    expect(split).toMatchObject({ applied: true, leafId: "leaf-2", sourceLeafId: "leaf-1" });
    expect(duplicate).toMatchObject({ applied: true, leafId: "leaf-3", sourceLeafId: "leaf-1" });
    expect(close).toMatchObject({ applied: true, leafId: "leaf-2" });
    await expect(executeOperation("workspace.manage", { action: "close", leafId: "missing" }, signal, app))
      .rejects.toThrow("Workspace leaf not found");
  });
  it("rejects an unknown action", async () => {
    await expect(executeOperation("workspace.manage", { action: "bogus" }, signal, appWith([]))).rejects.toThrow(BridgeError);
  });
});

describe("commands.list / commands.execute / hotkeys.list", () => {
  const commands = [{ id: "cmd:a", name: "A" }];
  const hotkeys = { "cmd:a": [{ modifiers: "Mod", key: "k" }] };
  it("lists commands and hotkeys", async () => {
    const app = appWith([], { commands, hotkeys });
    const list = (await executeOperation("commands.list", {}, signal, app)) as Obj;
    expect(list.available).toBe(true);
    expect((list.commands as unknown[])).toHaveLength(1);
    const hk = (await executeOperation("hotkeys.list", {}, signal, app)) as Obj;
    expect((hk.hotkeys as Array<Obj>)[0]!.keys).toEqual(["Mod-k"]);
  });
  it("executes a command by id", async () => {
    const app = appWith([], { commands });
    const r = (await executeOperation("commands.execute", { id: "editor:save-file" }, signal, app)) as Obj;
    expect(r.executed).toBe(true);
  });
  it("executes a command by MCP commandId", async () => {
    const app = appWith([], { commands });
    const r = (await executeOperation("commands.execute", { commandId: "editor:save-file" }, signal, app)) as Obj;
    expect(r.commandId).toBe("editor:save-file");
  });
  it("rejects a non-allowlisted command id with COMMAND_NOT_ALLOWED", async () => {
    const app = appWith([], { commands });
    await expect(executeOperation("commands.execute", { id: "cmd:a" }, signal, app)).rejects.toThrow(BridgeError);
    await expect(executeOperation("commands.execute", { id: "editor:dangerous-macro" }, signal, app)).rejects.toThrow(BridgeError);
  });
  it("reports unavailable when no command registry", async () => {
    const r = (await executeOperation("commands.list", {}, signal, appWith([]))) as Obj;
    expect(r.available).toBe(false);
  });
});
