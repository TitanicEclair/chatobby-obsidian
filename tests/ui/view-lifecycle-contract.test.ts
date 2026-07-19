import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Chatobby view lifecycle contract", () => {
  it("keeps the static work surface out of Obsidian file navigation without forced pinning", () => {
    const source = readFileSync("src/ui/view.ts", "utf8");

    expect(source).toContain("this.navigation = false;");
    expect(source).not.toContain("this.leaf.setPinned(true);");
  });
});
