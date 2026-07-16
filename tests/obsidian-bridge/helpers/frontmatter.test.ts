// Unit tests for the frontmatter helper (split / parse / serialize / merge).

import { describe, it, expect } from "vitest";
import {
  splitFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  mergeFrontmatter,
} from "../../../src/obsidian-bridge/operations/helpers/frontmatter";
import { BridgeError } from "../../../src/obsidian-bridge/types";

describe("splitFrontmatter", () => {
  it("extracts a leading frontmatter block", () => {
    const { fmText, body, hasFrontmatter } = splitFrontmatter("---\ntitle: Hi\n---\n# Body");
    expect(hasFrontmatter).toBe(true);
    expect(fmText).toBe("title: Hi");
    expect(body).toBe("# Body");
  });

  it("returns no frontmatter when absent", () => {
    const { fmText, body, hasFrontmatter } = splitFrontmatter("# just a body");
    expect(hasFrontmatter).toBe(false);
    expect(fmText).toBeNull();
    expect(body).toBe("# just a body");
  });

  it("treats an unclosed opening fence as body", () => {
    const { hasFrontmatter } = splitFrontmatter("---\ntitle: Hi\nno close");
    expect(hasFrontmatter).toBe(false);
  });
});

describe("parseFrontmatter", () => {
  it("parses scalars", () => {
    expect(parseFrontmatter("a: 1\nb: true\nc: hello\nd: null")).toEqual({ a: 1, b: true, c: "hello", d: null });
  });

  it("parses inline and block sequences", () => {
    expect(parseFrontmatter("tags: [x, y]\nlist:\n  - 1\n  - 2")).toEqual({ tags: ["x", "y"], list: [1, 2] });
  });

  it("throws on nested maps", () => {
    expect(() => parseFrontmatter("a: {b: c}")).toThrow(BridgeError);
  });
});

describe("serializeFrontmatter + round-trip", () => {
  it("round-trips a simple object", () => {
    const obj = { title: "Hi", count: 3, done: true, tags: ["a", "b"] };
    expect(parseFrontmatter(serializeFrontmatter(obj))).toEqual(obj);
  });

  it("quotes values that look like other types", () => {
    expect(serializeFrontmatter({ tricky: "true" })).toContain('tricky: "true"');
  });
});

describe("mergeFrontmatter", () => {
  it("merges updates and preserves untouched keys", () => {
    const content = "---\ntitle: Old\nkeep: me\n---\nbody";
    const { content: next, changed } = mergeFrontmatter(content, { title: "New", added: 1 });
    expect(changed).toBe(true);
    expect(next).toContain("title: New");
    expect(next).toContain("keep: me");
    expect(next).toContain("added: 1");
  });

  it("deletes keys set to null", () => {
    const { content: next, changed } = mergeFrontmatter("---\na: 1\nb: 2\n---\nx", { a: null });
    expect(changed).toBe(true);
    expect(next).not.toContain("a: 1");
    expect(next).toContain("b: 2");
  });

  it("creates a frontmatter block when absent", () => {
    const { content, changed } = mergeFrontmatter("# body", { title: "Created" });
    expect(changed).toBe(true);
    expect(content.startsWith("---\n")).toBe(true);
    expect(content).toContain("title: Created");
  });

  it("reports no change when values are identical", () => {
    const content = "---\na: 1\n---\nbody";
    expect(mergeFrontmatter(content, { a: 1 }).changed).toBe(false);
  });
});
