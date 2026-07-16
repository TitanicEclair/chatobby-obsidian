// Unit tests for core 10 operations against mock App.
// Updated for MCP contract alignment (Phase 4).

import { describe, it, expect } from "vitest";
import { createMockApp, createMockFile, createMockVault, createMockMetadataCache, createMockWorkspace } from "./helpers/mock-app";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { BridgeError } from "../../src/obsidian-bridge/types";

function makeSignal(): AbortSignal {
  return new AbortController().signal;
}

describe("core operations", () => {
  describe("context.get", () => {
    it("returns MCP-compatible note refs and heading text", async () => {
      const cache = new Map([
        ["active.md", { headings: [{ heading: "Title", level: 1, position: { start: { line: 0 } } }] }],
      ]);
      const app = createMockApp(new Map([["active.md", "# Title\nbody"], ["other.md", ""]]), {
        activeView: { path: "active.md", cursor: { line: 1, ch: 0 }, selection: "body" },
        openNotes: ["other.md"],
        cache,
      });

      const result = await executeOperation("context.get", {}, makeSignal(), app) as Record<string, unknown>;
      const activeNote = result.activeNote as Record<string, unknown>;
      const openNotes = result.openNotes as Array<Record<string, unknown>>;
      const headings = result.headings as Array<Record<string, unknown>>;
      const selection = result.selection as Record<string, unknown>;
      const environment = result.environment as Record<string, unknown>;

      expect(activeNote.path).toBe("active.md");
      expect(activeNote.basename).toBe("active");
      expect(openNotes.every((note) => typeof note.basename === "string")).toBe(true);
      expect(headings[0]!.text).toBe("Title");
      expect(selection.text).toBe("body");
      expect(environment.time).toBeDefined();
    });
  });

  describe("note.read", () => {
    it("reads a note with paging", async () => {
      const files = new Map([["test.md", "line 0\nline 1\nline 2\nline 3\nline 4"]]);
      const app = createMockApp(files);
      const result = await executeOperation("note.read", { path: "test.md" }, makeSignal(), app) as Record<string, unknown>;

      expect(result.note).toBeDefined();
      expect((result.note as Record<string, unknown>).path).toBe("test.md");
      expect(result.content).toBe("line 0\nline 1\nline 2\nline 3\nline 4");
      expect(result.totalLines).toBe(5);
    });

    it("paginates note content", async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
      const files = new Map([["big.md", content]]);
      const app = createMockApp(files);

      const result = await executeOperation("note.read", {
        path: "big.md",
        startLine: 10,
        lineLimit: 5,
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.startLine).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it("throws NOTE_NOT_FOUND for missing file", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("note.read", { path: "missing.md" }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("throws INVALID_INPUT for missing path", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("note.read", {}, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });
  });

  describe("note.write", () => {
    it("creates a new note", async () => {
      const app = createMockApp(new Map());
      const result = await executeOperation("note.write", {
        path: "new-note.md",
        content: "# Hello",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.path).toBe("new-note.md");
    });

    it("throws PATH_EXISTS for existing file", async () => {
      const files = new Map([["existing.md", "content"]]);
      const app = createMockApp(files);

      await expect(
        executeOperation("note.write", { path: "existing.md", content: "new" }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });
  });

  describe("note.resolve", () => {
    it("returns resolved for direct path match", async () => {
      const files = new Map([["notes/test.md", "# Test"]]);
      const app = createMockApp(files);
      const result = await executeOperation("note.resolve", {
        ref: "notes/test.md",
        mode: "path",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.status).toBe("resolved");
      expect((result.note as Record<string, unknown>).path).toBe("notes/test.md");
    });

    it("returns not_found for missing path", async () => {
      const app = createMockApp(new Map());
      const result = await executeOperation("note.resolve", {
        ref: "nonexistent.md",
        mode: "path",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.status).toBe("not_found");
      expect(result.candidates).toEqual([]);
    });

    it("returns not_found when no name match exists", async () => {
      const files = new Map([["other.md", "content"]]);
      const app = createMockApp(files);
      const result = await executeOperation("note.resolve", {
        ref: "nonexistent",
        mode: "name",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.status).toBe("not_found");
    });

    it("accepts legacy linktext alias", async () => {
      const app = createMockApp(new Map());
      const result = await executeOperation("note.resolve", {
        linktext: "nonexistent",
        mode: "path",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.status).toBe("not_found");
    });

    it("throws INVALID_INPUT for missing ref", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("note.resolve", {}, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("returns resolved for name match", async () => {
      const files = new Map([["folder/MyNote.md", "content"]]);
      const app = createMockApp(files);
      const result = await executeOperation("note.resolve", {
        ref: "MyNote",
        mode: "name",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.status).toBe("resolved");
      expect((result.note as Record<string, unknown>).path).toBe("folder/MyNote.md");
    });
  });

  describe("vault.search", () => {
    it("finds matches in vault with new result shape", async () => {
      const files = new Map([
        ["note1.md", "hello world"],
        ["note2.md", "goodbye world"],
        ["note3.md", "nothing here"],
      ]);
      const app = createMockApp(files);

      const result = await executeOperation("vault.search", {
        query: "world",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect((result.results as unknown[]).length).toBeGreaterThan(0);
      expect(result.page).toBeDefined();
      expect((result.page as Record<string, unknown>).limit).toBe(50);
    });

    it("returns page info with hasMore", async () => {
      const files = new Map([
        ["a.md", "match match match"],
        ["b.md", "match match"],
      ]);
      const app = createMockApp(files);

      const result = await executeOperation("vault.search", {
        query: "match",
        limit: 2,
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.page).toBeDefined();
      const page = result.page as Record<string, unknown>;
      expect(page.limit).toBe(2);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBeDefined();
    });

    it("caps long matching lines and context lines", async () => {
      const longLine = `data:image/png;base64,${"a".repeat(10_000)} target`;
      const files = new Map([["image-preview.md", `before ${"b".repeat(10_000)}\n${longLine}\nafter ${"c".repeat(10_000)}`]]);
      const app = createMockApp(files);

      const result = await executeOperation("vault.search", {
        query: "target",
        contextLines: 1,
      }, makeSignal(), app) as Record<string, unknown>;

      const results = result.results as Array<Record<string, unknown>>;
      const first = results[0]!;
      expect((first.match as string).length).toBeLessThan(560);
      expect(first.match).toContain("[truncated");
      expect(((first.before as string[])[0]!).length).toBeLessThan(560);
      expect(((first.after as string[])[0]!).length).toBeLessThan(560);
    });

    it("supports folder filtering", async () => {
      const files = new Map([
        ["folder/a.md", "target content"],
        ["other/b.md", "target content"],
      ]);
      const app = createMockApp(files);

      const result = await executeOperation("vault.search", {
        query: "target",
        folder: "folder",
      }, makeSignal(), app) as Record<string, unknown>;

      const results = result.results as Array<Record<string, unknown>>;
      expect(results.length).toBe(1);
      expect((results[0]!.note as Record<string, unknown>).path).toBe("folder/a.md");
    });

    it("supports cursor-based pagination", async () => {
      const files = new Map([
        ["a.md", "x"],
        ["b.md", "x"],
        ["c.md", "x"],
      ]);
      const app = createMockApp(files);

      // First page
      const page1 = await executeOperation("vault.search", {
        query: "x",
        limit: 1,
      }, makeSignal(), app) as Record<string, unknown>;

      expect((page1.page as Record<string, unknown>).hasMore).toBe(true);
      const nextCursor = (page1.page as Record<string, unknown>).nextCursor as string;

      // Second page
      const page2 = await executeOperation("vault.search", {
        query: "x",
        limit: 1,
        cursor: nextCursor,
      }, makeSignal(), app) as Record<string, unknown>;

      const results2 = page2.results as Array<Record<string, unknown>>;
      expect(results2.length).toBe(1);
      expect((results2[0]!.note as Record<string, unknown>).path).toBe("b.md");
    });

    it("returns empty for no matches", async () => {
      const files = new Map([["note.md", "nothing"]]);
      const app = createMockApp(files);

      const result = await executeOperation("vault.search", {
        query: "nonexistent",
      }, makeSignal(), app) as Record<string, unknown>;

      expect((result.results as unknown[]).length).toBe(0);
      expect((result.page as Record<string, unknown>).hasMore).toBe(false);
    });

    it("throws INVALID_INPUT for missing query", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("vault.search", {}, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("accepts legacy maxResults alias", async () => {
      const files = new Map([["a.md", "match"]]);
      const app = createMockApp(files);

      const result = await executeOperation("vault.search", {
        query: "match",
        maxResults: 10,
      }, makeSignal(), app) as Record<string, unknown>;

      expect((result.page as Record<string, unknown>).limit).toBe(10);
    });
  });

  describe("vault.list", () => {
    it("lists root entries with MCP-compatible basename/type fields", async () => {
      const app = createMockApp(new Map([["root.md", "root"], ["folder/note.md", "child"], ["image.png", "png"]]));
      const result = await executeOperation("vault.list", { folder: "/" }, makeSignal(), app) as Record<string, unknown>;
      const entries = result.entries as Array<Record<string, unknown>>;

      expect(entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: "root.md", basename: "root", type: "note", extension: "md" }),
        expect.objectContaining({ path: "folder", basename: "folder", type: "folder" }),
        expect.objectContaining({ path: "image.png", basename: "image", type: "attachment", extension: "png" }),
      ]));
    });

    it("throws NOTE_NOT_FOUND for non-existent folder", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("vault.list", { folder: "/nonexistent" }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });
  });

  describe("attachment.read", () => {
    it("throws INVALID_INPUT for missing path", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("attachment.read", {}, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("throws NOTE_NOT_FOUND for missing attachment", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("attachment.read", { path: "missing.png" }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("returns sizeBytes and mimeType for image", async () => {
      const pngPath = "images/test.png";
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      // Pre-populate files map before creating vault
      const files = new Map([[pngPath, "binary-placeholder"]]);
      const vault = createMockVault(files);

      // Override readBinary to return known binary content
      (vault as unknown as Record<string, unknown>).readBinary = async () => pngBytes.buffer;

      const app = {
        vault,
        metadataCache: createMockMetadataCache(),
        workspace: createMockWorkspace(),
      } as unknown as import("obsidian").App;

      const result = await executeOperation("attachment.read", {
        path: pngPath,
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.path).toBe(pngPath);
      expect(result.mimeType).toBe("image/png");
      expect(result.sizeBytes).toBe(pngBytes.byteLength);
      expect(result.base64).toBeDefined();
    });

    it("rejects unsupported MIME types", async () => {
      const files = new Map([["docs/readme.pdf", "content"]]);
      const app = createMockApp(files);
      await expect(
        executeOperation("attachment.read", { path: "docs/readme.pdf" }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("enforces maxBytes limit", async () => {
      const imgPath = "images/large.png";
      // Pre-populate files map before creating vault
      const files = new Map([[imgPath, "x".repeat(1000)]]);
      const vault = createMockVault(files);

      const bigContent = new Uint8Array(1000);
      (vault as unknown as Record<string, unknown>).readBinary = async () => bigContent.buffer;

      const app = {
        vault,
        metadataCache: createMockMetadataCache(),
        workspace: createMockWorkspace(),
      } as unknown as import("obsidian").App;

      // Set maxBytes smaller than file size
      await expect(
        executeOperation("attachment.read", { path: imgPath, maxBytes: 100 }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("supports SVG attachments", async () => {
      const svgPath = "images/icon.svg";
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
      // Pre-populate files map before creating vault
      const files = new Map([[svgPath, svgContent]]);
      const vault = createMockVault(files);

      const encoder = new TextEncoder();
      (vault as unknown as Record<string, unknown>).readBinary = async () => encoder.encode(svgContent).buffer;

      const app = {
        vault,
        metadataCache: createMockMetadataCache(),
        workspace: createMockWorkspace(),
      } as unknown as import("obsidian").App;

      const result = await executeOperation("attachment.read", {
        path: svgPath,
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.mimeType).toBe("image/svg+xml");
      expect(result.svgContent).toBe(svgContent);
      expect(result.base64).toBeUndefined();
    });
  });

  describe("note.edit", () => {
    it("throws INVALID_INPUT for missing path", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("note.edit", {}, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("throws NOTE_NOT_FOUND for missing file", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("note.edit", { path: "missing.md", edit: { mode: "append", content: "x" } }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });
  });

  describe("note.open", () => {
    it("throws INVALID_INPUT for missing path", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("note.open", {}, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });

    it("opens with target=current", async () => {
      const files = new Map([["test.md", "content"]]);
      const openedFiles: string[] = [];
      const vault = createMockVault(files);
      const workspace = {
        getLeavesOfType: () => [],
        getLeaf: (_target: unknown) => ({
          openFile: async (f: import("obsidian").TFile) => { openedFiles.push(f.path); },
          view: { getViewType: () => "markdown" },
        }),
        setActiveLeaf: () => {},
        openPopoutLeaf: () => ({
          openFile: async (f: import("obsidian").TFile) => { openedFiles.push(f.path); },
        }),
      } as unknown as import("obsidian").Workspace;
      const app = { vault, metadataCache: createMockMetadataCache(), workspace } as unknown as import("obsidian").App;

      const result = await executeOperation("note.open", {
        path: "test.md",
        target: "current",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.opened).toBe(true);
      expect(result.target).toBe("current");
      expect(result.note).toBeDefined();
      expect(openedFiles).toContain("test.md");
    });

    it("opens with target=new-tab", async () => {
      const files = new Map([["test.md", "content"]]);
      let leafTarget: unknown;
      const vault = createMockVault(files);
      const workspace = {
        getLeavesOfType: () => [],
        getLeaf: (target: unknown) => {
          leafTarget = target;
          return {
            openFile: async () => {},
            view: { getViewType: () => "markdown" },
          };
        },
        setActiveLeaf: () => {},
        openPopoutLeaf: () => ({ openFile: async () => {} }),
      } as unknown as import("obsidian").Workspace;
      const app = { vault, metadataCache: createMockMetadataCache(), workspace } as unknown as import("obsidian").App;

      const result = await executeOperation("note.open", {
        path: "test.md",
        target: "new-tab",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.target).toBe("new-tab");
      expect(leafTarget).toBe("tab");
    });

    it("opens with target=split-right", async () => {
      const files = new Map([["test.md", "content"]]);
      let leafArgs: unknown[] = [];
      const vault = createMockVault(files);
      const workspace = {
        getLeavesOfType: () => [],
        getLeaf: (...args: unknown[]) => {
          leafArgs = args;
          return {
            openFile: async () => {},
            view: { getViewType: () => "markdown" },
          };
        },
        setActiveLeaf: () => {},
        openPopoutLeaf: () => ({ openFile: async () => {} }),
      } as unknown as import("obsidian").Workspace;
      const app = { vault, metadataCache: createMockMetadataCache(), workspace } as unknown as import("obsidian").App;

      const result = await executeOperation("note.open", {
        path: "test.md",
        target: "split-right",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.target).toBe("split-right");
      expect(leafArgs[0]).toBe("split");
      expect(leafArgs[1]).toBe("vertical");
    });

    it("opens with target=split-down", async () => {
      const files = new Map([["test.md", "content"]]);
      let leafArgs: unknown[] = [];
      const vault = createMockVault(files);
      const workspace = {
        getLeavesOfType: () => [],
        getLeaf: (...args: unknown[]) => {
          leafArgs = args;
          return {
            openFile: async () => {},
            view: { getViewType: () => "markdown" },
          };
        },
        setActiveLeaf: () => {},
        openPopoutLeaf: () => ({ openFile: async () => {} }),
      } as unknown as import("obsidian").Workspace;
      const app = { vault, metadataCache: createMockMetadataCache(), workspace } as unknown as import("obsidian").App;

      const result = await executeOperation("note.open", {
        path: "test.md",
        target: "split-down",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.target).toBe("split-down");
      expect(leafArgs[0]).toBe("split");
      expect(leafArgs[1]).toBe("horizontal");
    });

    it("maps legacy mode=tab to target=new-tab", async () => {
      const files = new Map([["test.md", "content"]]);
      let leafTarget: unknown;
      const vault = createMockVault(files);
      const workspace = {
        getLeavesOfType: () => [],
        getLeaf: (target: unknown) => {
          leafTarget = target;
          return { openFile: async () => {}, view: { getViewType: () => "markdown" } };
        },
        setActiveLeaf: () => {},
        openPopoutLeaf: () => ({ openFile: async () => {} }),
      } as unknown as import("obsidian").Workspace;
      const app = { vault, metadataCache: createMockMetadataCache(), workspace } as unknown as import("obsidian").App;

      const result = await executeOperation("note.open", {
        path: "test.md",
        mode: "tab",
      }, makeSignal(), app) as Record<string, unknown>;

      expect(result.target).toBe("new-tab");
      expect(leafTarget).toBe("tab");
    });

    it("focuses leaf when focus=true", async () => {
      const files = new Map([["test.md", "content"]]);
      let focusedLeaf: unknown = null;
      const vault = createMockVault(files);
      const mockLeaf = {
        openFile: async () => {},
        view: { getViewType: () => "markdown" },
      };
      const workspace = {
        getLeavesOfType: () => [],
        getLeaf: () => mockLeaf,
        setActiveLeaf: (leaf: unknown, opts: { focus: boolean }) => {
          if (opts.focus) focusedLeaf = leaf;
        },
        openPopoutLeaf: () => mockLeaf,
      } as unknown as import("obsidian").Workspace;
      const app = { vault, metadataCache: createMockMetadataCache(), workspace } as unknown as import("obsidian").App;

      await executeOperation("note.open", {
        path: "test.md",
        target: "current",
        focus: true,
      }, makeSignal(), app);

      expect(focusedLeaf).toBe(mockLeaf);
    });

    it("throws NOTE_NOT_FOUND for missing file", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("note.open", { path: "missing.md" }, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });
  });

  describe("app.open", () => {
    it("opens with vaultRoot and notePath", async () => {
      const app = createMockApp(new Map());
      let openedUri: string | undefined;

      // Mock window.open
      const originalOpen = globalThis.window.open;
      globalThis.window.open = ((uri: string) => {
        openedUri = uri;
        return null;
      }) as typeof window.open;

      try {
        const result = await executeOperation("app.open", {
          vaultRoot: "MyVault",
          notePath: "notes/test.md",
        }, makeSignal(), app) as Record<string, unknown>;

        expect(result.attempted).toBe(true);
        expect(result.method).toBe("obsidian-uri");
        expect(openedUri).toContain("obsidian://open?vault=MyVault");
        expect(openedUri).toContain("file=notes%2Ftest.md");
      } finally {
        globalThis.window.open = originalOpen;
      }
    });

    it("opens with legacy uri", async () => {
      const app = createMockApp(new Map());
      let openedUri: string | undefined;

      const originalOpen = globalThis.window.open;
      globalThis.window.open = ((uri: string) => {
        openedUri = uri;
        return null;
      }) as typeof window.open;

      try {
        const result = await executeOperation("app.open", {
          uri: "obsidian://open?vault=Test",
        }, makeSignal(), app) as Record<string, unknown>;

        expect(result.attempted).toBe(true);
        expect(openedUri).toBe("obsidian://open?vault=Test");
      } finally {
        globalThis.window.open = originalOpen;
      }
    });

    it("throws INVALID_INPUT for missing args", async () => {
      const app = createMockApp(new Map());
      await expect(
        executeOperation("app.open", {}, makeSignal(), app),
      ).rejects.toThrow(BridgeError);
    });
  });

  describe("result/error JSON serialization", () => {
    it("all operation results are JSON-serializable", async () => {
      const files = new Map([["test.md", "content"]]);
      const app = createMockApp(files);

      const operations = [
        { op: "note.read", args: { path: "test.md" } },
        { op: "vault.search", args: { query: "content" } },
      ];

      for (const { op, args } of operations) {
        const result = await executeOperation(op as import("../../src/vendor/@chatobby/obsidian-protocol/bridge-operations").ObsidianCoreOperationName, args, makeSignal(), app);
        const serialized = JSON.stringify(result);
        expect(() => JSON.parse(serialized)).not.toThrow();
      }
    });

    it("BridgeError produces JSON-serializable ObsidianBridgeErrorPayload", () => {
      const error = new BridgeError("NOTE_NOT_FOUND", "Not found", false, { path: "x.md" });
      const payload = {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        details: error.details,
      };
      const serialized = JSON.stringify(payload);
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      expect(parsed.code).toBe("NOTE_NOT_FOUND");
      expect(parsed.message).toBe("Not found");
      expect(parsed.retryable).toBe(false);
      expect(parsed.details).toEqual({ path: "x.md" });
    });
  });
});
