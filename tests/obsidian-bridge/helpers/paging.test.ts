// Unit tests for paging helpers — pageTextLines bounds, ported from chaude.
// Includes cursor encode/decode tests for vault.search pagination.

import { describe, it, expect } from "vitest";
import { pageTextLines, parsePageInput, makePageInfo, encodeSearchCursor, decodeSearchCursor } from "../../../src/obsidian-bridge/operations/helpers/paging";

describe("pageTextLines", () => {
  const tenLines = "a\nb\nc\nd\ne\nf\ng\nh\ni\nj";

  it("returns full content when within bounds", () => {
    const page = pageTextLines(tenLines, 0, 10, 100_000);
    expect(page.content).toBe(tenLines);
    expect(page.totalLines).toBe(10);
    expect(page.startLine).toBe(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextStartLine).toBeNull();
    expect(page.truncated).toBe(false);
    expect(page.charTruncated).toBe(false);
  });

  it("paginates from a start line", () => {
    const page = pageTextLines(tenLines, 5, 3, 100_000);
    expect(page.startLine).toBe(5);
    expect(page.content).toBe("f\ng\nh");
    expect(page.hasMore).toBe(true);
    expect(page.nextStartLine).toBe(8);
  });

  it("clamps startLine to 0", () => {
    const page = pageTextLines(tenLines, -5, 5, 100_000);
    expect(page.startLine).toBe(0);
  });

  it("clamps startLine to content length", () => {
    const page = pageTextLines(tenLines, 100, 5, 100_000);
    expect(page.startLine).toBe(10);
    expect(page.content).toBe("");
  });

  it("clamps lineLimit to max 5000", () => {
    const bigContent = Array.from({ length: 6000 }, (_, i) => `line ${i}`).join("\n");
    const page = pageTextLines(bigContent, 0, 10000, 500_000);
    expect(page.lineLimit).toBe(5000);
  });

  it("clamps lineLimit to min 1", () => {
    const page = pageTextLines(tenLines, 0, 0, 100_000);
    expect(page.lineLimit).toBe(1);
  });

  it("clamps maxChars to max 500000", () => {
    const page = pageTextLines(tenLines, 0, 10, 1_000_000);
    // Should not error; charTruncated reflects actual truncation
    expect(page).toBeDefined();
  });

  it("clamps maxChars to min 1000", () => {
    const page = pageTextLines(tenLines, 0, 10, 100);
    // Should not error
    expect(page).toBeDefined();
  });

  it("sets charTruncated when content exceeds maxChars", () => {
    const longContent = "x".repeat(2000);
    const page = pageTextLines(longContent, 0, 100, 1000);
    expect(page.charTruncated).toBe(true);
    expect(page.content.length).toBeLessThanOrEqual(1000);
  });

  it("handles single line content", () => {
    const page = pageTextLines("hello", 0, 10, 100_000);
    expect(page.totalLines).toBe(1);
    expect(page.startLine).toBe(0);
    expect(page.endLine).toBe(0);
    expect(page.hasMore).toBe(false);
  });

  it("handles empty content", () => {
    const page = pageTextLines("", 0, 10, 100_000);
    expect(page.totalLines).toBe(1);
    expect(page.content).toBe("");
    expect(page.hasMore).toBe(false);
  });
});

describe("parsePageInput", () => {
  it("returns defaults for empty args", () => {
    const result = parsePageInput({});
    expect(result.startLine).toBe(0);
    expect(result.lineLimit).toBe(500);
    expect(result.maxChars).toBe(100_000);
  });

  it("parses provided values", () => {
    const result = parsePageInput({ startLine: 10, lineLimit: 100, maxChars: 50000 });
    expect(result.startLine).toBe(10);
    expect(result.lineLimit).toBe(100);
    expect(result.maxChars).toBe(50000);
  });
});

describe("makePageInfo", () => {
  it("creates page info from text page", () => {
    const page = pageTextLines("a\nb\nc", 0, 2, 100_000);
    const info = makePageInfo(page);
    expect(info.startLine).toBe(0);
    expect(info.lineCount).toBe(2);
    expect(info.totalLines).toBe(3);
    expect(info.hasMore).toBe(true);
    expect(info.nextStartLine).toBe(2);
  });

  it("omits nextStartLine when hasMore is false", () => {
    const page = pageTextLines("a\nb", 0, 10, 100_000);
    const info = makePageInfo(page);
    expect(info.hasMore).toBe(false);
    expect(info.nextStartLine).toBeUndefined();
  });
});

describe("search cursor encode/decode", () => {
  it("round-trips a cursor through encode → decode", () => {
    const cursor = { fileIndex: 3, matchIndex: 7 };
    const encoded = encodeSearchCursor(cursor);
    const decoded = decodeSearchCursor(encoded);
    expect(decoded).toEqual(cursor);
  });

  it("returns null for invalid base64", () => {
    expect(decodeSearchCursor("not-valid-base64!!!")).toBeNull();
  });

  it("returns null for valid base64 but wrong shape", () => {
    const encoded = btoa(JSON.stringify({ foo: "bar" }));
    expect(decodeSearchCursor(encoded)).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    const encoded = btoa(JSON.stringify("just a string"));
    expect(decodeSearchCursor(encoded)).toBeNull();
  });

  it("floors fractional indices", () => {
    const encoded = encodeSearchCursor({ fileIndex: 2.7, matchIndex: 4.3 });
    const decoded = decodeSearchCursor(encoded);
    expect(decoded).toEqual({ fileIndex: 2, matchIndex: 4 });
  });

  it("handles zero indices", () => {
    const cursor = { fileIndex: 0, matchIndex: 0 };
    const encoded = encodeSearchCursor(cursor);
    const decoded = decodeSearchCursor(encoded);
    expect(decoded).toEqual(cursor);
  });
});
