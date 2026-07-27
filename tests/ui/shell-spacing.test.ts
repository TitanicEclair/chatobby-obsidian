import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Chatobby view spacing", () => {
  it("overrides theme view padding with the compact Chatobby outer inset", () => {
    const css = readFileSync("src/ui/shell/shell.css", "utf8");
    const rule =
      css.match(
        /\.workspace-leaf-content\[data-type="chatobby-view"\] \.view-content\.chatobby-view\s*\{([^}]*)\}/u,
      )?.[1] ?? "";

    expect(rule).toContain("padding: var(--size-4-3) var(--size-4-2) var(--size-4-4)");
    expect(rule).toContain("overflow: hidden");
  });
});
