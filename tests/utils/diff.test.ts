import { describe, expect, it } from "vitest";
import { computeDiff } from "../../src/utils/diff";

describe("computeDiff", () => {
  it("returns no hunks for identical text", () => {
    expect(computeDiff("a\nb", "a\nb")).toEqual([]);
  });

  it("produces an added line", () => {
    const hunks = computeDiff("a\nb", "a\nb\nc");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]!.lines.some((l) => l.type === "add" && l.text === "c")).toBe(true);
    expect(hunks[0]!.newCount).toBeGreaterThan(hunks[0]!.oldCount);
  });

  it("produces a deleted line", () => {
    const hunks = computeDiff("a\nb\nc", "a\nc");
    expect(hunks.some((l) => l.lines.some((line) => line.type === "del" && line.text === "b"))).toBe(true);
  });

  it("splits far-apart edits into separate hunks with a line gap", () => {
    // 8 unchanged lines between two single-line changes → beyond a context=3 window, so two hunks.
    const lines = ["x", "1", "2", "3", "4", "5", "6", "7", "8", "y"];
    const oldText = ["a", ...lines.slice(1, -1), "b"].join("\n");
    const newText = ["A", ...lines.slice(1, -1), "B"].join("\n");
    const hunks = computeDiff(oldText, newText, 3);
    expect(hunks.length).toBe(2);
    // The hunk boundaries must not overlap (there's a real skip between them).
    const prev = hunks[0]!;
    const next = hunks[1]!;
    expect(next.oldStart).toBeGreaterThan(prev.oldStart + prev.oldCount);
  });

  it("merges nearby edits into a single hunk", () => {
    const hunks = computeDiff("a\nb\nc", "x\ny\nc", 3);
    expect(hunks).toHaveLength(1);
  });
});
