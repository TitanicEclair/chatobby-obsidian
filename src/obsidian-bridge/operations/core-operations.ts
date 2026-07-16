// Core 10 operations — Phase B implementation.
// These are the direct MCP tools the agent uses inside an Obsidian vault.
//
// See docs/tooling/bridge-executor.md §8 for the Obsidian API mapping.

import type { TFile } from "obsidian";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { findLiteralMatches, getFilteredMarkdownFiles, fileToNoteRef } from "./helpers/search";
import type { SearchResult } from "./helpers/search";
import { decodeSearchCursor, encodeSearchCursor } from "./helpers/paging";
import type { PageInfo } from "./helpers/paging";
import { getVaultIdentity } from "./helpers/vault-identity";
import { readNote, writeNote, editNote, resolveNote, listEntries, buildNoteContextExcerpt } from "./helpers/note-io";
import { arrayBufferToBase64 } from "./helpers/binary";
import { CONTEXT_EXCERPT_BEFORE, CONTEXT_EXCERPT_AFTER } from "../../prompt/constants";
import { gatherEnvironmentContext } from "../../prompt/environment";

// ── context.get ────────────────────────────────────────────────────────

export const handleContextGet: OperationHandler = async (_args, _signal, app) => {
  // Prefer the workspace's active leaf (correct when multiple notes are open);
  // fall back to the first markdown leaf.
  type LeafLike = { view: unknown };
  const ws = app.workspace as unknown as {
    activeLeaf?: LeafLike | null;
    getLeavesOfType(type: string): LeafLike[];
  };
  const activeLeaf = ws.activeLeaf;
  const activeIsMarkdown =
    !!activeLeaf?.view && (activeLeaf.view as { getViewType?: () => string }).getViewType?.() === "markdown";
  const markdownLeaf: LeafLike | undefined = activeIsMarkdown
    ? activeLeaf!
    : ws.getLeavesOfType("markdown").find(
        (leaf) => (leaf.view as { getViewType?: () => string }).getViewType?.() === "markdown",
      );

  if (!markdownLeaf) {
    return {
      vault: getVaultIdentity(app),
      capabilities: [] as string[],
      warnings: ["NO_ACTIVE_NOTE: No active markdown note"],
    };
  }

  const view = markdownLeaf.view as import("obsidian").MarkdownView;
  const editor = view.editor;
  const file = view.file;

  if (!file) {
    return {
      vault: getVaultIdentity(app),
      capabilities: [] as string[],
      warnings: ["NO_ACTIVE_NOTE: No file in active view"],
    };
  }

  const content = await app.vault.cachedRead(file);
  const cursor = editor.getCursor();
  const selection = editor.getSelection();

  // Build excerpt around cursor
  const anchorFromLine = cursor.line;
  const anchorToLine = selection ? editor.getCursor("to").line : cursor.line;
  const excerpt = buildNoteContextExcerpt(
    content,
    anchorFromLine,
    anchorToLine,
    CONTEXT_EXCERPT_BEFORE,
    CONTEXT_EXCERPT_AFTER,
  );

  // Get headings from metadata cache
  const cached = app.metadataCache.getFileCache(file);
  const headings = cached?.headings?.map((h) => ({
    level: h.level,
    text: h.heading,
    heading: h.heading,
    line: h.position.start.line,
  }));

  // Get open notes
  const openNotes = app.workspace.getLeavesOfType("markdown")
    .map((leaf) => {
      const v = leaf.view as import("obsidian").MarkdownView;
      const f = v.file;
      if (!f) return null;
      return {
        path: f.path,
        basename: f.basename,
        title: f.basename,
        mtime: f.stat.mtime,
        ctime: f.stat.ctime,
        isActive: (leaf as unknown) === (markdownLeaf as unknown),
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  return {
    vault: getVaultIdentity(app),
    environment: gatherEnvironmentContext(app),
    activeNote: {
      path: file.path,
      basename: file.basename,
      title: file.basename,
      mtime: file.stat.mtime,
      ctime: file.stat.ctime,
      excerpt: excerpt.text,
      fromLine: excerpt.fromLine + 1,
      toLine: excerpt.toLine + 1,
    },
    cursor: { line: cursor.line + 1, ch: cursor.ch },
    selection: selection
      ? {
          text: selection,
          from: editor.getCursor("from").line + 1,
          to: editor.getCursor("to").line + 1,
        }
      : undefined,
    headings,
    openNotes,
    capabilities: ["context", "notes", "search"],
  };
};

// ── note.read ──────────────────────────────────────────────────────────

export const handleNoteRead: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  if (!path) throw new BridgeError("INVALID_INPUT", "note.read requires a 'path' argument");

  // Accept 1-indexed startLine from model, convert to 0-indexed for internal use
  const startLine = typeof args.startLine === "number" ? Math.max(0, args.startLine - 1) : 0;
  const lineLimit = typeof args.lineLimit === "number" ? args.lineLimit : 500;
  const maxChars = typeof args.maxChars === "number" ? args.maxChars : 100_000;

  const result = await readNote(app, path, { startLine, lineLimit, maxChars });
  if (!result) throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);

  return result;
};

// ── vault.search ───────────────────────────────────────────────────────

export const handleVaultSearch: OperationHandler = async (args, signal, app) => {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query) throw new BridgeError("INVALID_INPUT", "vault.search requires a 'query' argument");

  const caseSensitive = args.caseSensitive === true;
  const contextLines = typeof args.contextLines === "number" ? args.contextLines : 2;
  // Accept both `limit` (MCP contract) and `maxResults` (legacy alias)
  const limit = typeof args.limit === "number" ? args.limit
    : typeof args.maxResults === "number" ? args.maxResults
    : 50;
  const folder = typeof args.folder === "string" ? args.folder : undefined;

  // Cursor-based pagination
  const cursorStr = typeof args.cursor === "string" ? args.cursor : undefined;
  const cursor = cursorStr ? decodeSearchCursor(cursorStr) : null;

  const files = getFilteredMarkdownFiles(app, folder);
  const allResults: SearchResult[] = [];
  const startFileIndex = cursor?.fileIndex ?? 0;
  const startMatchIndex = cursor?.matchIndex ?? 0;

  // Track the resume point for the next page: (fileIndex, matchIndex within file).
  // Only set when we stop at exactly `limit` results.
  let nextCursor: { fileIndex: number; matchIndex: number } | undefined;

  fileLoop:
  for (let fi = startFileIndex; fi < files.length; fi++) {
    if (signal.aborted) break;
    const file = files[fi]!;
    const content = await app.vault.cachedRead(file);
    const note = fileToNoteRef(file);
    const matches = findLiteralMatches(note, content, query, contextLines, caseSensitive);

    // Resume within this file from the cursor's matchIndex.
    const matchStart = fi === startFileIndex ? startMatchIndex : 0;
    for (let mi = matchStart; mi < matches.length; mi++) {
      allResults.push(matches[mi]!);
      if (allResults.length === limit) {
        // Next resume point: immediately after this match.
        const nextMi = mi + 1;
        if (nextMi < matches.length) {
          nextCursor = { fileIndex: fi, matchIndex: nextMi };
        } else {
          // Exhausted this file; next page starts at the next file.
          for (let nfi = fi + 1; nfi < files.length; nfi++) {
            nextCursor = { fileIndex: nfi, matchIndex: 0 };
            break;
          }
          // If no more files, nextCursor stays undefined (last page).
        }
        break fileLoop;
      }
    }
  }

  const hasMore = !!nextCursor;
  const nextCursorStr = nextCursor ? encodeSearchCursor(nextCursor) : undefined;

  const page: PageInfo = {
    limit,
    ...(cursorStr ? { cursor: cursorStr } : {}),
    ...(nextCursorStr ? { nextCursor: nextCursorStr } : {}),
    hasMore,
  };

  return { results: allResults, page };
};

// ── note.resolve ───────────────────────────────────────────────────────

export const handleNoteResolve: OperationHandler = async (args, _signal, app) => {
  // Accept both MCP `ref` and legacy `linktext` for backward compat
  const ref = typeof args.ref === "string" ? args.ref
    : typeof args.linktext === "string" ? args.linktext
    : undefined;
  if (!ref) throw new BridgeError("INVALID_INPUT", "note.resolve requires a 'ref' argument");

  const sourcePath = typeof args.sourcePath === "string" ? args.sourcePath : "";
  const mode = typeof args.mode === "string" ? args.mode as "path" | "name" | "wikilink" | "any" : "any";
  const limit = typeof args.limit === "number" ? args.limit : 5;

  return resolveNote(app, ref, sourcePath, mode, limit);
};

// ── attachment.read ────────────────────────────────────────────────────

export const handleAttachmentRead: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  if (!path) throw new BridgeError("INVALID_INPUT", "attachment.read requires a 'path' argument");

  const maxBytes = typeof args.maxBytes === "number" ? args.maxBytes : undefined;

  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("stat" in file)) throw new BridgeError("NOTE_NOT_FOUND", `Attachment not found: ${path}`);

  const tfile = file as TFile;

  // Check if it's a supported image type
  const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|svg)$/i;
  if (!IMAGE_EXTENSION.test(path)) {
    throw new BridgeError("UNSUPPORTED_OPERATION", "Only image attachments are supported (png, jpg, gif, webp, svg)");
  }

  // Enforce maxBytes before reading the file
  if (maxBytes !== undefined && tfile.stat.size > maxBytes) {
    throw new BridgeError(
      "INVALID_INPUT",
      `Attachment size (${tfile.stat.size} bytes) exceeds maxBytes limit (${maxBytes})`,
      false,
      { sizeBytes: tfile.stat.size, maxBytes },
    );
  }

  const data = await app.vault.readBinary(tfile);
  const mimeType = getMimeType(path);

  // SVG is text-based; for binary images, encode to base64
  const isSvg = mimeType === "image/svg+xml";
  const base64 = isSvg ? undefined : arrayBufferToBase64(data);
  const svgContent = isSvg ? new TextDecoder().decode(data) : undefined;

  return {
    path,
    mimeType,
    sizeBytes: data.byteLength,
    ...(base64 ? { base64 } : {}),
    ...(svgContent ? { svgContent } : {}),
  };
};

// ── vault.list ─────────────────────────────────────────────────────────

export const handleVaultList: OperationHandler = async (args, _signal, app) => {
  const folder = typeof args.folder === "string" ? args.folder : "/";
  const recursive = args.recursive === true;
  const entryTypes = Array.isArray(args.entryTypes)
    ? args.entryTypes.filter((entry): entry is string => typeof entry === "string")
    : undefined;
  const result = listEntries(app, folder, { recursive, entryTypes });
  if (!result) throw new BridgeError("NOTE_NOT_FOUND", `Folder not found: ${folder}`);
  return result;
};

// ── note.write ─────────────────────────────────────────────────────────

export const handleNoteWrite: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  const content = typeof args.content === "string" ? args.content : undefined;
  if (!path) throw new BridgeError("INVALID_INPUT", "note.write requires a 'path' argument");
  if (content === undefined) throw new BridgeError("INVALID_INPUT", "note.write requires a 'content' argument");

  return writeNote(app, path, content);
};

// ── note.edit ──────────────────────────────────────────────────────────

export const handleNoteEdit: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  if (!path) throw new BridgeError("INVALID_INPUT", "note.edit requires a 'path' argument");

  const edit = args.edit as Record<string, unknown> | undefined;
  if (!edit || typeof edit !== "object") {
    throw new BridgeError("INVALID_INPUT", "note.edit requires an 'edit' argument");
  }

  const expectedMtime = typeof args.expectedMtime === "number" ? args.expectedMtime : undefined;

  return editNote(app, path, edit, expectedMtime);
};

// ── note.open ──────────────────────────────────────────────────────────

export const handleNoteOpen: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  if (!path) throw new BridgeError("INVALID_INPUT", "note.open requires a 'path' argument");

  // Accept both `target` (MCP contract) and `mode` (legacy alias)
  const targetArg = typeof args.target === "string" ? args.target
    : typeof args.mode === "string" ? mapLegacyMode(args.mode)
    : "current";
  const focus = args.focus === true;

  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("stat" in file)) throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);
  const tfile = file as TFile;

  // Resolve target to a leaf
  type LeafTarget = "current" | "new-tab" | "split-right" | "split-down" | "new-window";
  const target = targetArg as LeafTarget;

  let leaf: import("obsidian").WorkspaceLeaf;
  switch (target) {
    case "current":
      leaf = app.workspace.getLeaf(false);
      break;
    case "new-tab":
      leaf = app.workspace.getLeaf("tab");
      break;
    case "split-right":
      leaf = app.workspace.getLeaf("split", "vertical");
      break;
    case "split-down":
      leaf = app.workspace.getLeaf("split", "horizontal");
      break;
    case "new-window":
      leaf = app.workspace.openPopoutLeaf();
      break;
    default:
      leaf = app.workspace.getLeaf(false);
      break;
  }

  await leaf.openFile(tfile);

  if (focus) {
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  return {
    opened: true,
    note: { path: tfile.path, basename: tfile.basename, mtime: tfile.stat.mtime, ctime: tfile.stat.ctime },
    target,
  };
};

/** Map legacy mode values to MCP target values. */
function mapLegacyMode(mode: string): string {
  switch (mode) {
    case "tab": return "new-tab";
    case "split": return "split-right";
    default: return "current";
  }
}

// ── app.open ───────────────────────────────────────────────────────────

export const handleAppOpen: OperationHandler = async (args, _signal, app) => {
  // Accept MCP contract: { vaultRoot?, notePath? }
  // Also accept legacy: { uri }
  const vaultRoot = typeof args.vaultRoot === "string" ? args.vaultRoot : undefined;
  const notePath = typeof args.notePath === "string" ? args.notePath : undefined;
  const uriArg = typeof args.uri === "string" ? args.uri : undefined;

  // Construct URI from vaultRoot + notePath if provided
  let uri: string;
  if (vaultRoot !== undefined || notePath !== undefined) {
    // Get vault name from the current vault identity
    const identity = getVaultIdentity(app);
    const vaultParam = encodeURIComponent(vaultRoot ?? identity.name);
    const fileParam = notePath ? encodeURIComponent(notePath) : "";
    uri = fileParam
      ? `obsidian://open?vault=${vaultParam}&file=${fileParam}`
      : `obsidian://open?vault=${vaultParam}`;
  } else if (uriArg) {
    uri = uriArg;
  } else {
    throw new BridgeError("INVALID_INPUT", "app.open requires either 'uri' or 'vaultRoot'/'notePath' arguments");
  }

  // Open via window.open
  window.open(uri);

  return {
    attempted: true,
    method: "obsidian-uri" as const,
    message: `Opened: ${uri}`,
  };
};

// ── Helpers ────────────────────────────────────────────────────────────

function getMimeType(path: string): string {
  const ext = path.toLowerCase().split(".").pop();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}
