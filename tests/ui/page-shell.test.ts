import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  createPageActionRow,
  createPageMasterDetail,
  createPageSection,
  focusPageNavigation,
  movePageNavigation,
  PageShell,
} from "../../src/ui/shared/page-shell";

describe("PageShell", () => {
  it("mounts stable semantic regions and complete tab keyboard behavior", () => {
    const parent = document.body.createDiv();
    const shell = new PageShell(parent, { title: "Memory", subtitle: "Current project", width: "wide" });
    const selectMemories = vi.fn();
    const selectSuggestions = vi.fn();
    shell.setTabs([
      { id: "memories", label: "Memories", active: true, onSelect: selectMemories },
      { id: "suggestions", label: "Suggestions", active: false, count: 2, onSelect: selectSuggestions },
    ]);

    expect(shell.header.tagName).toBe("HEADER");
    expect(shell.title.tagName).toBe("H2");
    expect(shell.body.tagName).toBe("MAIN");
    expect(shell.body.getAttribute("role")).toBe("tabpanel");
    const tabs = shell.tabs.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs[0]?.tabIndex).toBe(0);
    expect(tabs[1]?.tabIndex).toBe(-1);

    tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(selectSuggestions).toHaveBeenCalledOnce();
  });

  it("preserves controls, disclosures, scrolling, and focus within one body scope", () => {
    const parent = document.body.createDiv();
    const shell = new PageShell(parent, { title: "Queries" });
    const render = (value: string): void => {
      const input = shell.body.createEl("input", {
        value,
        attr: { "aria-label": "Query name", "data-page-state-key": "query-name" },
      });
      const details = shell.body.createEl("details", { attr: { "data-page-state-key": "details:query" } });
      details.createEl("summary", { text: "Details" });
      input.focus();
    };

    shell.updateBody("queries", () => render("Initial"));
    const input = shell.body.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("input missing");
    input.value = "Draft";
    input.setSelectionRange(2, 4);
    const details = shell.body.querySelector<HTMLDetailsElement>("details");
    if (!details) throw new Error("details missing");
    details.open = true;
    shell.body.scrollTop = 24;

    shell.updateBody("queries", () => render("Server value"));

    const restored = shell.body.querySelector<HTMLInputElement>("input");
    expect(restored?.value).toBe("Draft");
    expect(restored?.selectionStart).toBe(2);
    expect(restored?.selectionEnd).toBe(4);
    expect(shell.body.querySelector<HTMLDetailsElement>("details")?.open).toBe(true);
    expect(document.activeElement).toBe(restored);
    expect(shell.body.scrollTop).toBe(24);
  });

  it("resets interaction state when the body scope changes", () => {
    const parent = document.body.createDiv();
    const shell = new PageShell(parent, { title: "Events" });
    shell.updateBody("automations", (body) => {
      const field = body.createEl("input", { attr: { "aria-label": "Name" } });
      field.value = "Automation";
    });
    const input = shell.body.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("input missing");
    input.value = "Unsaved";

    shell.updateBody("history", (body) => {
      const field = body.createEl("input", { attr: { "aria-label": "Name" } });
      field.value = "History";
    });

    expect(shell.body.querySelector<HTMLInputElement>("input")?.value).toBe("History");
  });

  it("keeps focus without overwriting authoritative unmarked controls", () => {
    const parent = document.body.createDiv();
    const shell = new PageShell(parent, { title: "Permissions" });
    shell.updateBody("policy", (body) => {
      const input = body.createEl("input");
      input.value = "Old server value";
      input.focus();
    });
    const current = shell.body.querySelector<HTMLInputElement>("input");
    if (!current) throw new Error("input missing");
    current.value = "Transient value";

    shell.updateBody("policy", (body) => {
      const input = body.createEl("input");
      input.value = "New server value";
    });

    const updated = shell.body.querySelector<HTMLInputElement>("input");
    expect(updated?.value).toBe("New server value");
    expect(document.activeElement).toBe(updated);
  });

  it("provides shared section, action, and master-detail hierarchy", () => {
    const parent = document.body.createDiv();
    const section = createPageSection(parent, {
      title: "Capabilities",
      description: "Choose what this policy may do.",
      surface: "divided",
    });
    createPageActionRow(section.content).createEl("button", { text: "Save" });
    const split = createPageMasterDetail(parent, {
      masterLabel: "Channels",
      detailLabel: "Channel messages",
    });

    expect(section.section.querySelector("h3")?.textContent).toBe("Capabilities");
    expect(section.section.hasClass("is-divided")).toBe(true);
    expect(split.master.getAttribute("aria-label")).toBe("Channels");
    expect(split.detail.getAttribute("aria-label")).toBe("Channel messages");

    const css = readFileSync("src/ui/shared/page-shell.css", "utf8");
    expect(css).toMatch(/\.chatobby-page__master\s*\{[\s\S]*max-width:\s*none;/u);
  });

  it("exposes page tab navigation for Obsidian commands", () => {
    const parent = document.body.createDiv();
    const shell = new PageShell(parent, { title: "Memory" });
    const selectSuggestions = vi.fn();
    shell.setTabs([
      { id: "memories", label: "Memories", active: true, onSelect: vi.fn() },
      { id: "suggestions", label: "Suggestions", active: false, onSelect: selectSuggestions },
    ]);

    expect(focusPageNavigation(parent)).toBe(true);
    expect(document.activeElement?.textContent).toBe("Memories");
    expect(movePageNavigation(parent, 1)).toBe(true);
    expect(selectSuggestions).toHaveBeenCalledOnce();
    expect(document.activeElement?.textContent).toBe("Suggestions");
  });
});
