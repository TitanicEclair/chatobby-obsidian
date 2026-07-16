// Search helpers — ported from chaude/src/read-tools.ts:27.
// findLiteralMatches: literal string search with surrounding context.
//
// See docs/tooling/bridge-executor.md §8 for the vault.search mapping.

import type { App, TFile } from "obsidian";
import type { ObsidianNoteRef } from "./note-io";

const MAX_SEARCH_RESULT_LINE_CHARS = 500;

/** A single search result matching the MCP contract. */
export interface SearchResult {
  note: ObsidianNoteRef;
  line: number;
  match: string;
  before?: string[];
  after?: string[];
}

/**
 * Find literal string matches in content with surrounding context lines.
 *
 * Returns matches for both path and content. Each match includes the note
 * reference, line number, match text, and surrounding context lines.
 *
 * Bounds: contextLines 0–10 (default 2).
 */
export function findLiteralMatches(
  note: ObsidianNoteRef,
  content: string,
  query: string,
  contextLines: number,
  caseSensitive: boolean,
): SearchResult[] {
  const wanted = caseSensitive ? query : query.toLocaleLowerCase();
  if (!wanted) return [];

  const results: SearchResult[] = [];
  const surrounding = Math.max(0, Math.min(Number.isFinite(contextLines) ? Math.floor(contextLines) : 2, 10));

  const lines = content.split(/\r?\n/);
  for (let line = 0; line < lines.length; line++) {
    const source = lines[line]!;
    const haystack = caseSensitive ? source : source.toLocaleLowerCase();
    let col = haystack.indexOf(wanted);

    while (col >= 0) {
      const fromLine = Math.max(0, line - surrounding);
      const toLine = Math.min(lines.length - 1, line + surrounding);

      const before = surrounding > 0 ? lines.slice(fromLine, line).map(truncateSearchLine) : undefined;
      const after = surrounding > 0 ? lines.slice(line + 1, toLine + 1).map(truncateSearchLine) : undefined;

      results.push({
        note,
        line,
        match: truncateSearchLine(source),
        ...(before && before.length > 0 ? { before } : {}),
        ...(after && after.length > 0 ? { after } : {}),
      });

      col = haystack.indexOf(wanted, col + Math.max(1, wanted.length));
    }
  }

  return results;
}

function truncateSearchLine(line: string): string {
  if (line.length <= MAX_SEARCH_RESULT_LINE_CHARS) return line;
  return `${line.slice(0, MAX_SEARCH_RESULT_LINE_CHARS)}... [truncated ${line.length - MAX_SEARCH_RESULT_LINE_CHARS} chars]`;
}

/**
 * Get markdown files filtered by optional folder prefix.
 */
export function getFilteredMarkdownFiles(app: App, folder?: string): TFile[] {
  const files = app.vault.getMarkdownFiles();
  if (!folder) return files;

  // Normalize folder: strip leading/trailing slashes, ensure trailing /
  const prefix = folder.replace(/^\/+|\/+$/g, "");
  if (!prefix) return files;

  return files.filter((f) => f.path.startsWith(prefix + "/") || f.path === prefix);
}

/** Convert a TFile to a note ref (duplicated here to avoid circular import). */
export function fileToNoteRef(file: TFile): ObsidianNoteRef {
  return {
    path: file.path,
    basename: file.basename,
    mtime: file.stat.mtime,
    ctime: file.stat.ctime,
  };
}
