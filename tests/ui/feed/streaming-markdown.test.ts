import { describe, expect, it } from "vitest";
import { prepareMarkdownForRender } from "../../../src/ui/feed/text-block";

describe("prepareMarkdownForRender", () => {
  it("keeps complete executable fences inert until streaming finishes", () => {
    const markdown = [
      "Before",
      "```dataview",
      "TABLE file.mtime",
      "```",
      "After",
    ].join("\n");

    expect(prepareMarkdownForRender(markdown, true)).toBe([
      "Before",
      "```text",
      "TABLE file.mtime",
      "```",
      "After",
    ].join("\n"));
    expect(prepareMarkdownForRender(markdown, false)).toBe(markdown);
  });

  it("closes and neutralizes an incomplete fence in every render state", () => {
    const markdown = [
      "Before",
      "~~~dataviewjs",
      "dv.list(",
    ].join("\n");
    const expected = [
      "Before",
      "~~~text",
      "dv.list(",
      "~~~",
    ].join("\n");

    expect(prepareMarkdownForRender(markdown, true)).toBe(expected);
    expect(prepareMarkdownForRender(markdown, false)).toBe(expected);
  });
});
