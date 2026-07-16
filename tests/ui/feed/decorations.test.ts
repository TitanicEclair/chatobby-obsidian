import { describe, expect, it, vi } from "vitest";
import { decorateAfterMarkdown, decorateFeedLinks } from "../../../src/ui/feed/decorations";

describe("feed decorations", () => {
  it("opens Obsidian internal links by linktext", () => {
    const container = document.createElement("div");
    container.innerHTML = `<a class="internal-link" data-href="Folder/Note.md" href="Folder/Note.md">Note</a>`;
    const openVaultLink = vi.fn();
    const openSystemPath = vi.fn();

    decorateFeedLinks(container, { openVaultLink, openSystemPath });
    container.querySelector("a")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(openVaultLink).toHaveBeenCalledWith("Folder/Note");
    expect(openSystemPath).not.toHaveBeenCalled();
  });

  it("decodes obsidian URI file targets before opening", () => {
    const container = document.createElement("div");
    container.innerHTML = `<a href="obsidian://open?vault=Vault&file=Projects%2FChatobby%2FPlan.md">Plan</a>`;
    const openVaultLink = vi.fn();
    const openSystemPath = vi.fn();

    decorateFeedLinks(container, { openVaultLink, openSystemPath });
    container.querySelector("a")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(openVaultLink).toHaveBeenCalledWith("Projects/Chatobby/Plan");
    expect(openSystemPath).not.toHaveBeenCalled();
  });

  it("linkifies plain wikilinks and bare vault markdown paths", () => {
    const container = document.createElement("div");
    container.textContent = "See [[Daily/Today|today]] and Projects/Chatobby/Plan.md.";
    const openVaultLink = vi.fn();
    const openSystemPath = vi.fn();

    decorateFeedLinks(container, { openVaultLink, openSystemPath });
    const links = Array.from(container.querySelectorAll("a"));
    links.forEach((link) => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));

    expect(links.map((link) => link.textContent)).toEqual(["today", "Projects/Chatobby/Plan.md"]);
    expect(openVaultLink).toHaveBeenNthCalledWith(1, "Daily/Today");
    expect(openVaultLink).toHaveBeenNthCalledWith(2, "Projects/Chatobby/Plan");
    expect(openSystemPath).not.toHaveBeenCalled();
  });

  it("linkifies explicit Windows system paths separately from vault links", () => {
    const container = document.createElement("div");
    container.textContent = "Open C:\\Temp\\report.pdf";
    const openVaultLink = vi.fn();
    const openSystemPath = vi.fn();

    decorateFeedLinks(container, { openVaultLink, openSystemPath });
    container.querySelector("a")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(openSystemPath).toHaveBeenCalledWith("C:\\Temp\\report.pdf");
    expect(openVaultLink).not.toHaveBeenCalled();
  });

  it("waits for async markdown rendering before decorating", async () => {
    const container = document.createElement("div");
    const openVaultLink = vi.fn();
    const openSystemPath = vi.fn();
    const rendered = Promise.resolve().then(() => {
      container.innerHTML = `<a class="internal-link" data-href="Async.md" href="Async.md">Async</a>`;
    });

    decorateAfterMarkdown(container, rendered, { openVaultLink, openSystemPath });
    await rendered;
    await Promise.resolve();
    container.querySelector("a")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(openVaultLink).toHaveBeenCalledWith("Async");
  });
});
