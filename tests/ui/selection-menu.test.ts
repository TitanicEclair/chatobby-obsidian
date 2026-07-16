import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SelectionMenu } from "../../src/ui/composer/selection-menu";

describe("SelectionMenu", () => {
  it("keeps long option collections inside a bounded scroll region", () => {
    const css = readFileSync("src/ui/composer/composer.css", "utf8");
    const listRule = css.match(/\.chatobby-selection-menu__list\s*\{([^}]*)\}/u)?.[1] ?? "";

    expect(listRule).toContain("max-height: 260px");
    expect(listRule).toContain("overflow-y: auto");
  });

  it("filters a long list and chooses the keyboard-active option", async () => {
    const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn();
    try {
      const anchor = document.createElement("button");
      const host = document.createElement("div");
      document.body.append(anchor, host);
      const onChoose = vi.fn(async () => {});
      const onClose = vi.fn();
      const menu = new SelectionMenu({
        anchor,
        title: "Policy",
        searchPlaceholder: "Search policies…",
        items: Array.from({ length: 30 }, (_, index) => ({ value: String(index), label: `Policy ${index + 1}` })),
        selectedValue: "0",
        onChoose,
        onClose,
      });
      menu.render(host);
      const search = host.querySelector<HTMLInputElement>(".chatobby-selection-menu__search");
      if (!search) throw new Error("Search input was not rendered");

      search.value = "Policy 29";
      search.dispatchEvent(new Event("input"));
      expect(host.querySelectorAll(".chatobby-selection-menu__option")).toHaveLength(1);
      expect(host.textContent).toContain("Policy 29");

      search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await vi.waitFor(() => expect(onChoose).toHaveBeenCalledWith({ value: "28", label: "Policy 29" }));
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
      menu.destroy();
    } finally {
      HTMLElement.prototype.scrollIntoView = previousScrollIntoView;
    }
  });

  it("closes without stealing focus when the user clicks outside", () => {
    const anchor = document.createElement("button");
    const host = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(anchor, host, outside);
    const onClose = vi.fn();
    const menu = new SelectionMenu({
      anchor,
      title: "Effort",
      searchPlaceholder: "Search effort levels…",
      items: [{ value: "medium", label: "Medium" }],
      selectedValue: "medium",
      onChoose: vi.fn(),
      onClose,
    });
    menu.render(host);

    outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(onClose).toHaveBeenCalledWith(false);
    menu.destroy();
  });
});
