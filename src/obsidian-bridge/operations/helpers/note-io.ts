// Note I/O helpers — read/write/edit/resolve against app.vault + app.metadataCache.
// Ported business logic from chaude/src/read-tools.ts and chaude/src/vault-refs.ts.
//
// See docs/tooling/bridge-executor.md §8 for the Obsidian API mapping.

import type { App, TFile, TFolder } from "obsidian";
import { BridgeError } from "../../types";
import { pageTextLines } from "./paging";
import { computeDiff, type DiffHunk } from "../../../utils/diff";

/** ObsidianNoteRef — JSON-serializable note reference (no TFile crosses the wire). */
export interface ObsidianNoteRef {
  path: string;
  basename: string;
  mtime?: number;
  ctime?: number;
}

export interface ObsidianEntryRef {
  path: string;
  name: string;
  basename: string;
  type: "folder" | "file" | "note" | "attachment";
  extension?: string;
  mtime?: number;
  ctime?: number;
}

/** Note read result with paging metadata. */
export interface NoteReadResult {
  note: ObsidianNoteRef;
  content: string;
  frontmatter?: Record<string, unknown>;
  startLine: number;
  lineCount: number;
  totalLines: number;
  hasMore: boolean;
  nextStartLine?: number;
}

/**
 * Read a note with paging.
 * Returns null if the note is not found.
 */
export async function readNote(
  app: App,
  path: string,
  opts: { startLine: number; lineLimit: number; maxChars: number },
): Promise<NoteReadResult | null> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("stat" in file)) return null;

  const tfile = file as TFile;
  const content = await app.vault.cachedRead(tfile);
  const page = pageTextLines(content, opts.startLine, opts.lineLimit, opts.maxChars);

  // Get frontmatter from metadata cache
  const cached = app.metadataCache.getFileCache(tfile);
  const frontmatter = cached?.frontmatter as Record<string, unknown> | undefined;

  return {
    note: toNoteRef(tfile),
    content: page.content,
    ...(frontmatter ? { frontmatter } : {}),
    startLine: page.startLine + 1,
    lineCount: page.endLine - page.startLine + 1,
    totalLines: page.totalLines,
    hasMore: page.hasMore,
    ...(page.nextStartLine !== null ? { nextStartLine: page.nextStartLine + 1 } : {}),
  };
}

/**
 * Write a new note.
 * Throws PATH_EXISTS if the file already exists.
 */
export async function writeNote(
  app: App,
  path: string,
  content: string,
): Promise<ObsidianNoteRef> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) {
    throw new BridgeError("PATH_EXISTS", `File already exists: ${path}`);
  }

  // Ensure parent folder exists
  const parts = path.split("/");
  if (parts.length > 1) {
    const folderPath = parts.slice(0, -1).join("/");
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await app.vault.createFolder(folderPath).catch(() => {});
    }
  }

  const file = await app.vault.create(path, content);
  return toNoteRef(file);
}

/**
 * Edit a note with conflict detection.
 * Throws REVISION_CONFLICT if expectedMtime doesn't match.
 * Throws NOTE_NOT_FOUND if the file doesn't exist.
 */
export async function editNote(
  app: App,
  path: string,
  edit: Record<string, unknown>,
  expectedMtime?: number,
): Promise<{ note: ObsidianNoteRef; changed: boolean; mtime: number; diff?: DiffHunk[] }> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("stat" in file)) {
    throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);
  }

  const tfile = file as TFile;

  // Revision conflict check
  if (expectedMtime !== undefined && tfile.stat.mtime !== expectedMtime) {
    throw new BridgeError(
      "REVISION_CONFLICT",
      `File was modified since last read (expected mtime ${expectedMtime}, got ${tfile.stat.mtime})`,
    );
  }

  const mode = edit.mode as string;
  const editContent = edit.content as string | undefined;
  let diff: DiffHunk[] = [];
  await app.vault.process(tfile, (currentContent) => {
    if (expectedMtime !== undefined && tfile.stat.mtime !== expectedMtime) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        `File was modified since last read (expected mtime ${expectedMtime}, got ${tfile.stat.mtime})`,
      );
    }

    let newContent: string;
    switch (mode) {
      case "append":
        newContent = currentContent + (editContent ?? "");
        break;
      case "prepend":
        newContent = (editContent ?? "") + currentContent;
        break;
      case "replace_all":
        newContent = editContent ?? "";
        break;
      case "replace_exact": {
        const find = edit.find as string | undefined;
        const replace = edit.replace as string | undefined;
        if (find === undefined) {
          throw new BridgeError("INVALID_INPUT", "replace_exact requires 'find'");
        }
        if (!currentContent.includes(find)) {
          throw new BridgeError("INVALID_INPUT", `Find string not found in note: ${find}`);
        }
        newContent = currentContent.replace(find, replace ?? "");
        break;
      }
      default:
        throw new BridgeError("INVALID_INPUT", `Unknown edit mode: ${mode}`);
    }

    // Capture a unified diff before writing so the edit tool can render hunks (the result
    // round-trips bridge → server → tool_execution_end → renderer).
    diff = computeDiff(currentContent, newContent);
    return newContent;
  });

  return {
    note: toNoteRef(tfile),
    changed: true,
    mtime: tfile.stat.mtime,
    ...(diff.length > 0 ? { diff } : {}),
  };
}

/**
 * note.resolve result — structured status matching the MCP contract.
 */
export type NoteResolveResult =
  | { status: "resolved"; note: ObsidianNoteRef }
  | { status: "ambiguous"; candidates: ObsidianNoteRef[] }
  | { status: "not_found"; candidates: ObsidianNoteRef[] };

/**
 * Resolve a reference to a note using the specified mode.
 *
 * Modes:
 *   - "path": direct vault path lookup
 *   - "wikilink": metadataCache linkpath resolution (needs sourcePath)
 *   - "name": basename match across all markdown files
 *   - "any" (default): try path → wikilink → name
 *
 * Returns structured resolved/ambiguous/not_found with candidates.
 */
export function resolveNote(
  app: App,
  ref: string,
  sourcePath: string,
  mode: "path" | "name" | "wikilink" | "any" = "any",
  limit = 5,
): NoteResolveResult {
  const tryPath = (): ObsidianNoteRef | null => {
    const file = app.vault.getAbstractFileByPath(ref);
    if (file && "stat" in file) return toNoteRef(file as TFile);
    return null;
  };

  const tryWikilink = (): ObsidianNoteRef | null => {
    const resolved = app.metadataCache.getFirstLinkpathDest(ref, sourcePath);
    if (resolved) return toNoteRef(resolved);
    return null;
  };

  const tryName = (): ObsidianNoteRef[] => {
    const lower = ref.toLowerCase();
    return app.vault
      .getMarkdownFiles()
      .filter((f) => f.basename.toLowerCase() === lower || f.name.toLowerCase() === lower)
      .slice(0, limit)
      .map(toNoteRef);
  };

  // Single-mode resolution
  if (mode === "path") {
    const found = tryPath();
    return found
      ? { status: "resolved", note: found }
      : { status: "not_found", candidates: [] };
  }

  if (mode === "wikilink") {
    const found = tryWikilink();
    return found
      ? { status: "resolved", note: found }
      : { status: "not_found", candidates: [] };
  }

  if (mode === "name") {
    const candidates = tryName();
    if (candidates.length === 1) return { status: "resolved", note: candidates[0]! };
    if (candidates.length > 1) return { status: "ambiguous", candidates };
    return { status: "not_found", candidates: [] };
  }

  // mode === "any": try path → wikilink → name
  const byPath = tryPath();
  if (byPath) return { status: "resolved", note: byPath };

  const byWikilink = tryWikilink();
  if (byWikilink) return { status: "resolved", note: byWikilink };

  const byName = tryName();
  if (byName.length === 1) return { status: "resolved", note: byName[0]! };
  if (byName.length > 1) return { status: "ambiguous", candidates: byName };
  return { status: "not_found", candidates: [] };
}

/**
 * List entries in a folder.
 * Returns null if the folder doesn't exist.
 */
export function listEntries(
  app: App,
  folderPath: string,
  opts: { recursive?: boolean; entryTypes?: string[] } = {},
): { entries: ObsidianEntryRef[] } | null {
  const normalizedFolder = folderPath === "/" ? "" : folderPath.replace(/^\/+|\/+$/g, "");
  const vaultWithRoot = app.vault as unknown as { getRoot?: () => TFolder };
  const folder = normalizedFolder === ""
    ? vaultWithRoot.getRoot?.()
    : app.vault.getAbstractFileByPath(normalizedFolder);
  if (!folder || !("children" in folder)) return null;

  const tFolder = folder as TFolder;
  const allowedTypes = opts.entryTypes ? new Set(opts.entryTypes) : null;
  const entries: ObsidianEntryRef[] = [];

  const visit = (current: TFolder): void => {
    for (const child of current.children) {
      const entry = toEntryRef(child);
      if (!allowedTypes || allowedTypes.has(entry.type) || (entry.type === "note" && allowedTypes.has("file"))) {
        entries.push(entry);
      }
      if (opts.recursive && "children" in child) {
        visit(child as TFolder);
      }
    }
  };

  visit(tFolder);

  return { entries };
}

/**
 * Build a context excerpt around anchor lines.
 * Ported from chaude/src/note-context.ts:40.
 */
export function buildNoteContextExcerpt(
  content: string,
  anchorFromLine: number,
  anchorToLine = anchorFromLine,
  linesBefore = 12,
  linesAfter = 6,
): { fromLine: number; toLine: number; text: string } {
  const lines = content.split(/\r?\n/);
  const lastLine = Math.max(0, lines.length - 1);
  const anchorFrom = Math.max(0, Math.min(anchorFromLine, lastLine));
  const anchorTo = Math.max(anchorFrom, Math.min(anchorToLine, lastLine));
  const fromLine = Math.max(0, anchorFrom - linesBefore);
  const toLine = Math.min(lastLine, anchorTo + linesAfter);
  return { fromLine, toLine, text: lines.slice(fromLine, toLine + 1).join("\n") };
}

/** Convert a TFile to a JSON-serializable ObsidianNoteRef. */
function toNoteRef(file: TFile): ObsidianNoteRef {
  return {
    path: file.path,
    basename: file.basename,
    mtime: file.stat.mtime,
    ctime: file.stat.ctime,
  };
}

function toEntryRef(entry: import("obsidian").TAbstractFile): ObsidianEntryRef {
  if ("children" in entry) {
    return {
      path: entry.path,
      name: entry.name,
      basename: entry.name,
      type: "folder",
    };
  }

  const file = entry as TFile;
  const extension = file.extension || file.name.split(".").pop() || "";
  return {
    path: file.path,
    name: file.name,
    basename: file.basename,
    type: extension === "md" ? "note" : "attachment",
    ...(extension ? { extension } : {}),
    mtime: file.stat.mtime,
    ctime: file.stat.ctime,
  };
}
