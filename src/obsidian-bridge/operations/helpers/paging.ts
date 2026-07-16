// Paging helpers — ported from chaude/src/read-tools.ts:13.
// pageTextLines: bounded line/char paging for note content.
//
// See docs/tooling/bridge-executor.md §8 for the note.read mapping.

export interface TextPage {
  content: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  lineLimit: number;
  hasMore: boolean;
  nextStartLine: number | null;
  truncated: boolean;
  charTruncated: boolean;
}

/**
 * Page text content by line range with character budget.
 *
 * Bounds: lines 1–5000 (default 500), chars 1000–500000 (default 100000).
 * Returns a TextPage with pagination metadata.
 */
export function pageTextLines(
  fullContent: string,
  startLine: number,
  lineLimit: number,
  maxChars: number,
): TextPage {
  const lines = fullContent.split(/\r?\n/);
  const start = Math.max(0, Math.min(Number.isFinite(startLine) ? Math.floor(startLine) : 0, lines.length));
  const count = Math.max(1, Math.min(Number.isFinite(lineLimit) ? Math.floor(lineLimit) : 500, 5_000));
  const boundedChars = Math.max(1_000, Math.min(Number.isFinite(maxChars) ? Math.floor(maxChars) : 100_000, 500_000));
  const selected = lines.slice(start, start + count);
  const page = selected.join("\n");
  const content = page.slice(0, boundedChars);
  const charTruncated = page.length > boundedChars;
  const consumedLines = charTruncated ? Math.max(1, content.split("\n").length - 1) : selected.length;
  const nextStartLine = start + consumedLines < lines.length ? start + consumedLines : null;
  return {
    content,
    totalLines: lines.length,
    startLine: start,
    endLine: selected.length ? start + consumedLines - 1 : start,
    lineLimit: count,
    hasMore: nextStartLine !== null,
    nextStartLine,
    truncated: nextStartLine !== null,
    charTruncated,
  };
}

/** Parse page input arguments with defaults. */
export function parsePageInput(args: Record<string, unknown>): {
  startLine: number;
  lineLimit: number;
  maxChars: number;
} {
  return {
    startLine: typeof args.startLine === "number" ? args.startLine : 0,
    lineLimit: typeof args.lineLimit === "number" ? args.lineLimit : 500,
    maxChars: typeof args.maxChars === "number" ? args.maxChars : 100_000,
  };
}

/** Create a PageInfo object from a TextPage for the note.read response. */
export function makePageInfo(page: TextPage): {
  startLine: number;
  lineCount: number;
  totalLines: number;
  hasMore: boolean;
  nextStartLine?: number;
} {
  return {
    startLine: page.startLine,
    lineCount: page.endLine - page.startLine + 1,
    totalLines: page.totalLines,
    hasMore: page.hasMore,
    ...(page.nextStartLine !== null ? { nextStartLine: page.nextStartLine } : {}),
  };
}

// ── Cursor helpers for vault.search pagination ─────────────────────────

export interface SearchCursor {
  fileIndex: number;
  matchIndex: number;
}

/** Encode a search cursor to a base64 string. */
export function encodeSearchCursor(cursor: SearchCursor): string {
  return btoa(JSON.stringify(cursor));
}

/** Decode a base64 search cursor string. Returns null if invalid. */
export function decodeSearchCursor(encoded: string): SearchCursor | null {
  try {
    const obj = JSON.parse(atob(encoded));
    if (typeof obj === "object" && obj !== null &&
        typeof obj.fileIndex === "number" && typeof obj.matchIndex === "number") {
      return { fileIndex: Math.floor(obj.fileIndex), matchIndex: Math.floor(obj.matchIndex) };
    }
    return null;
  } catch {
    return null;
  }
}

/** Standard page info shape matching the MCP ObsidianPageInfo contract. */
export interface PageInfo {
  limit: number;
  cursor?: string;
  nextCursor?: string;
  hasMore: boolean;
}
