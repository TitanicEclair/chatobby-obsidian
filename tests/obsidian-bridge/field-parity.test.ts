// Field-level parity test: verifies every bridge operation accepts the field
// names the MCP server forwards (the canonical arg shapes from
// packages/chatobby-mcp-servers/chatobby-obsidian/src/schemas/).
//
// This catches the class of mismatch that let attachment.import fail
// end-to-end (#1): the operation was "implemented" (name present) but the
// plugin read different arg names than the MCP schema sent.
//
// Each parity case specifies:
//   op           — bridge operation name
//   required     — args that MUST be present (handler throws INVALID_INPUT without them)
//   optional     — args the handler accepts but doesn't require
//   sample       — minimal valid args for the happy path (may overlap with required)
//   needsFile    — creates a mock file at this path so requireFile succeeds
//   needsCache   — creates a mock metadata cache entry
//   needsRL      — creates mock resolvedLinks

import { afterAll, describe, it, expect, vi } from "vitest";
import { createMockApp, createMockFile } from "./helpers/mock-app";
import type { MockFileCache } from "./helpers/mock-app";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { BridgeError } from "../../src/obsidian-bridge/types";

const signal = new AbortController().signal;

type ParityCase = {
  op: string;
  required?: string[];
  optional?: string[];
  sample?: Record<string, unknown>;
  needsFile?: string[];
  needsContent?: Record<string, string>;
  needsCache?: Map<string, MockFileCache>;
  needsRL?: Record<string, Record<string, number>>;
  /** For operations that need a file but also take sample args referencing it. */
  skipEmptyArgsTest?: boolean;
};

const PARITY_CASES: ParityCase[] = [
  // ── Core (10) ──────────────────────────────────────────────────────
  { op: "context.get", sample: {} },
  { op: "note.resolve", required: ["ref"], sample: { ref: "a.md" }, needsFile: ["a.md"] },
  { op: "note.read", required: ["path"], sample: { path: "a.md" }, needsFile: ["a.md"] },
  { op: "vault.search", required: ["query"], sample: { query: "hello" } },
  { op: "attachment.read", required: ["path"], sample: { path: "a.png" }, needsFile: ["a.png"] },
  { op: "vault.list", sample: { folder: "/" } },
  { op: "note.write", required: ["path", "content"], sample: { path: "new.md", content: "body" } },
  { op: "note.edit", required: ["path", "edit"], sample: { path: "a.md", edit: { mode: "append", content: "!" } }, needsFile: ["a.md"] },
  { op: "note.open", required: ["path"], sample: { path: "a.md" }, needsFile: ["a.md"] },
  { op: "app.open", sample: { uri: "obsidian://open?vault=Test" } },

  // ── Plugin-native data (16) ───────────────────────────────────────
  { op: "registry.status", sample: {} },
  { op: "metadata.get", required: ["path"], sample: { path: "a.md" }, needsFile: ["a.md"] },
  { op: "folder.create", required: ["path"], sample: { path: "newfolder" } },
  { op: "entry.copy", required: ["sourcePath", "targetPath"], sample: { sourcePath: "a.md", targetPath: "b.md" }, needsFile: ["a.md"] },
  { op: "entry.move", required: ["sourcePath", "targetPath"], sample: { sourcePath: "a.md", targetPath: "c.md" }, needsFile: ["a.md"] },
  { op: "entry.trash", required: ["path"], sample: { path: "a.md" }, needsFile: ["a.md"] },
  { op: "attachment.import", required: ["targetPath", "content"], sample: { targetPath: "att.png", content: "AAEC" } },
  { op: "links.generate", sample: { path: "a.md" }, needsFile: ["a.md"] },
  { op: "links.get", required: ["path"], sample: { path: "a.md" }, needsFile: ["a.md"] },
  { op: "links.audit", sample: {} },
  { op: "tags.list", sample: {} },
  { op: "properties.list", sample: {} },
  { op: "frontmatter.update", required: ["path", "updates"], sample: { path: "a.md", updates: { tag: "x" } }, needsFile: ["a.md"],
    needsCache: new Map([["a.md", { frontmatter: { existing: 1 } }]]),
  },
  { op: "graph.traverse", required: ["startPath"], sample: { startPath: "a.md" }, needsFile: ["a.md"], needsRL: { "a.md": { "b.md": 1 } } },
  { op: "tasks.list", sample: {} },
  { op: "tasks.update", required: ["path", "status"], sample: { path: "a.md", line: 1, status: "checked" }, needsFile: ["a.md"],
    needsContent: { "a.md": "- [ ] task one\n- [ ] task two" },
    skipEmptyArgsTest: true,
  },

  // ── Plugin-native runtime (8) ─────────────────────────────────────
  { op: "editor.get", sample: {} },
  { op: "editor.edit", required: ["edit"], sample: { path: "a.md", edit: { mode: "append", content: "!" } }, needsFile: ["a.md"] },
  { op: "editor.focus", required: ["path"], sample: { path: "a.md" }, needsFile: ["a.md"] },
  { op: "workspace.get", sample: {} },
  { op: "workspace.manage", required: ["action"], sample: { action: "split" } },
  { op: "commands.list", sample: {} },
  { op: "commands.execute", required: ["commandId"], sample: { commandId: "editor:save-file" } },
  { op: "hotkeys.list", sample: {} },

  // ── Retrieval (6) ─────────────────────────────────────────────────
  { op: "retrieval.explore", required: ["query", "provider"], sample: { query: "test", provider: "lexical" } },
  { op: "retrieval.trace", required: ["fromRef", "toRef", "provider"], sample: { fromRef: "a.md", toRef: "b.md", provider: "obsidian-links" } },
  { op: "retrieval.related", required: ["path", "provider"], sample: { path: "a.md", provider: "lexical" } },
  { op: "retrieval.hubs", required: ["provider"], sample: { provider: "obsidian-links" } },
  { op: "retrieval.communities", required: ["provider"], sample: { provider: "obsidian-links" } },
  { op: "retrieval.explain", required: ["path", "provider"], sample: { path: "a.md", provider: "obsidian-links" } },
];

// ── Tests ─────────────────────────────────────────────────────────────

describe("field-level parity (MCP schema → plugin handler args)", () => {
  const openWindow = vi.spyOn(window, "open").mockReturnValue(null);
  afterAll(() => openWindow.mockRestore());

  for (const tc of PARITY_CASES) {
    it(`${tc.op}: rejects empty args when required fields exist`, async () => {
      if (!tc.required?.length) return; // no required fields — skip
      if (tc.skipEmptyArgsTest) return;

      const app = createMockApp(new Map((tc.needsFile ?? []).map((p) => [p, ""])), {
        cache: tc.needsCache,
        resolvedLinks: tc.needsRL,
      });
      await expect(executeOperation(tc.op, {}, signal, app)).rejects.toThrow(BridgeError);
    });

    it(`${tc.op}: accepts canonical MCP arg names`, async () => {
      const files = (tc.needsFile ?? []).map((p) => [p, tc.needsContent?.[p] ?? ""] as [string, string]);
      const app = createMockApp(new Map(files), {
        cache: tc.needsCache,
        resolvedLinks: tc.needsRL,
      });
      const args = tc.sample ?? {};
      // Should not throw INVALID_INPUT (may throw NOTE_NOT_FOUND, PATH_EXISTS,
      // etc. depending on state — those are fine, they mean args were accepted).
      try {
        await executeOperation(tc.op, args, signal, app);
      } catch (e) {
        if (e instanceof BridgeError && e.code === "INVALID_INPUT") {
          throw new Error(`${tc.op} rejected canonical args as INVALID_INPUT: ${e.message}`);
        }
        // Other errors (NOTE_NOT_FOUND, etc.) are fine — args were accepted.
      }
    });
  }

});

describe("field-name parity — specific regression checks", () => {
  it("attachment.import accepts both MCP-canonical (targetPath+content) and legacy (path+base64)", async () => {
    const app = createMockApp(new Map());

    // MCP canonical
    const r1 = (await executeOperation("attachment.import", { targetPath: "a.png", content: "AQID" }, signal, app)) as Record<string, unknown>;
    expect(r1.path).toBe("a.png");
    expect(r1.sizeBytes).toBe(3);

    // Legacy
    const r2 = (await executeOperation("attachment.import", { path: "b.png", base64: "AAEC" }, signal, app)) as Record<string, unknown>;
    expect(r2.path).toBe("b.png");
  });

  it("frontmatter.update accepts MCP arg names (path, updates, mode, expectedMtime)", async () => {
    const app = createMockApp(new Map([["n.md", "---\na: 1\n---\nbody"]]));
    const r = (await executeOperation("frontmatter.update", {
      path: "n.md",
      updates: { b: 2 },
      mode: "merge",
      expectedMtime: 1000, // mock mtime
    }, signal, app)) as Record<string, unknown>;
    expect(r.changed).toBe(true);
  });

  it("tasks.update accepts MCP arg names (path, line, status: in_progress)", async () => {
    const app = createMockApp(new Map([["n.md", "- [ ] one"]]));
    const r = (await executeOperation("tasks.update", {
      path: "n.md",
      line: 1,
      status: "in_progress",
    }, signal, app)) as Record<string, unknown>;
    expect(r.changed).toBe(true);
    const content = await app.vault.read(app.vault.getAbstractFileByPath("n.md") as never);
    expect(content).toContain("[>]");
  });

  it("entry.copy accepts MCP canonical sourcePath+targetPath", async () => {
    const app = createMockApp(new Map([["a.md", "content"]]));
    const r = (await executeOperation("entry.copy", { sourcePath: "a.md", targetPath: "b.md" }, signal, app)) as Record<string, unknown>;
    expect((r.note as Record<string, unknown>).path).toBe("b.md");
  });
});
