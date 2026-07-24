import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Chatobby view lifecycle contract", () => {
  it("keeps the static work surface out of Obsidian file navigation without forced pinning", () => {
    const source = readFileSync("src/ui/view.ts", "utf8");

    expect(source).toContain("this.navigation = false;");
    expect(source).not.toContain("this.leaf.setPinned(true);");
  });

  it("contains Escape inside Chatobby and routes chat cancellation through the composer", () => {
    const source = readFileSync("src/ui/view.ts", "utf8");

    expect(source).toContain("this.scope = new Scope(this.app.scope);");
    expect(source).toContain("this.composer.handleScopedKeydown(event, this.viewMode === \"chat\")");
    expect(source).toMatch(/this\.scope\.register\(null, null,[\s\S]*handleScopedKeydown[\s\S]*\? false : undefined\);/u);
  });
});
