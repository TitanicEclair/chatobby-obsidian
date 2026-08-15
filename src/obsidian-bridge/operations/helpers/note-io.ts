import type { App, TFile } from "obsidian";
import { isTFile } from "./file-types";

/** JSON-serializable note reference; no TFile crosses the bridge. */
export interface ObsidianNoteRef {
  path: string;
  basename: string;
  mtime?: number;
  ctime?: number;
}

export type NoteResolveResult =
  | { status: "resolved"; note: ObsidianNoteRef }
  | { status: "ambiguous"; candidates: ObsidianNoteRef[] }
  | { status: "not_found"; candidates: ObsidianNoteRef[] };

/** Resolve a note by exact path, wikilink context, name, or that order. */
export function resolveNote(
  app: App,
  ref: string,
  sourcePath: string,
  mode: "path" | "name" | "wikilink" | "any" = "any",
  limit = 5,
): NoteResolveResult {
  const tryPath = (): ObsidianNoteRef | null => {
    const file = app.vault.getAbstractFileByPath(ref);
    return isTFile(file) ? toNoteRef(file) : null;
  };

  const tryWikilink = (): ObsidianNoteRef | null => {
    const resolved = app.metadataCache.getFirstLinkpathDest(ref, sourcePath);
    return resolved ? toNoteRef(resolved) : null;
  };

  const tryName = (): ObsidianNoteRef[] => {
    const lower = ref.toLowerCase();
    return app.vault
      .getMarkdownFiles()
      .filter((file) => file.basename.toLowerCase() === lower || file.name.toLowerCase() === lower)
      .slice(0, limit)
      .map(toNoteRef);
  };

  if (mode === "path") {
    const found = tryPath();
    return found ? { status: "resolved", note: found } : { status: "not_found", candidates: [] };
  }
  if (mode === "wikilink") {
    const found = tryWikilink();
    return found ? { status: "resolved", note: found } : { status: "not_found", candidates: [] };
  }
  if (mode === "name") return candidatesResult(tryName());

  const byPath = tryPath();
  if (byPath) return { status: "resolved", note: byPath };
  const byWikilink = tryWikilink();
  if (byWikilink) return { status: "resolved", note: byWikilink };
  return candidatesResult(tryName());
}

/** Build the bounded active-note excerpt shared by semantic context. */
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

function candidatesResult(candidates: ObsidianNoteRef[]): NoteResolveResult {
  if (candidates.length === 1) return { status: "resolved", note: candidates[0]! };
  if (candidates.length > 1) return { status: "ambiguous", candidates };
  return { status: "not_found", candidates: [] };
}

function toNoteRef(file: TFile): ObsidianNoteRef {
  return {
    path: file.path,
    basename: file.basename,
    mtime: file.stat.mtime,
    ctime: file.stat.ctime,
  };
}
