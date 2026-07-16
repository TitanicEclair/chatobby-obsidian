import { describe, expect, it, vi } from "vitest";
import { SlashMenu } from "../../src/ui/composer/slash-menu";
import type { SlashCommandSpec } from "../../src/ui/composer/slash-command";
import { noArgs } from "../../src/ui/composer/slash-parsers";

function command(name: string): SlashCommandSpec {
  return {
    name,
    source: "local",
    argParser: noArgs(),
    surroundingTextPolicy: "allow",
    executionKind: "local",
  };
}

describe("SlashMenu", () => {
  it("scrolls the active command row into view as keyboard selection moves", async () => {
    const scrollIntoView = vi.fn();
    const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      const menu = new SlashMenu();
      const host = document.createElement("div");
      document.body.appendChild(host);
      menu.render(host);
      menu.setMatches([command("new"), command("reload"), command("set-model")]);

      await nextFrame();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
      expect(host.querySelector(".chatobby-slash-menu__item.is-active .chatobby-slash-menu__key")?.textContent).toBe("Tab");

      scrollIntoView.mockClear();
      menu.move(1);
      await nextFrame();

      expect(menu.current()?.name).toBe("reload");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
      expect(host.querySelector(".chatobby-slash-menu__item.is-active")?.getAttribute("aria-selected")).toBe("true");
    } finally {
      HTMLElement.prototype.scrollIntoView = previous;
    }
  });
});

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
