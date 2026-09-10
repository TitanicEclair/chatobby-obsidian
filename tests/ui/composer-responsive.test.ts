import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposerControls } from "../../src/ui/composer/composer-controls";
import { SelectionMenu } from "../../src/ui/composer/selection-menu";
import type { FrontendComposerViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";

const model: FrontendComposerViewModel = {
  canSubmit: true,
  controls: [
    { id: "permission", label: "Access", value: "workspace", options: [
      { value: "read-only", label: "Read-only" }, { value: "workspace", label: "Workspace" }, { value: "full", label: "Full" },
    ] },
    { id: "provider", label: "Provider", value: "synthetic", options: [{ value: "synthetic", label: "Synthetic provider" }] },
    { id: "model", label: "Model", value: "synthetic/model", options: [{ value: "synthetic/model", label: "Synthetic long model name", description: "synthetic" }] },
    { id: "effort", label: "Effort", value: "medium", options: [{ value: "medium", label: "Medium" }, { value: "high", label: "High" }] },
  ],
};

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("composer responsive controls", () => {
  it("keeps provider, model and effort icons in DOM order while hiding legacy access controls", () => {
    const controls = new ComposerControls({ getViewModel: () => model, isBackendAvailable: () => true, applyControl: vi.fn() });
    controls.render(document.body);
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".chatobby-control-button")];
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Provider: Synthetic provider", "Model: Synthetic long model name", "Effort: Medium",
    ]);
    for (const button of buttons) {
      expect(button.title).toBe(button.getAttribute("aria-label"));
      expect(button.tabIndex).toBe(0);
      expect(button.disabled).toBe(false);
      expect(button.querySelector("[aria-hidden='true']")).not.toBeNull();
    }
    buttons[0]?.click();
    expect([...document.querySelectorAll(".chatobby-selection-menu__option-name")].map((option) => option.textContent))
      .toEqual(["Synthetic provider"]);
    controls.destroy();
  });

  it("collapses words against actual control space and wraps icons without hiding controls or clipping menus", () => {
    // CSS contract proof, not a browser layout/visual acceptance claim.
    const css = readFileSync("src/ui/composer/composer.css", "utf8");
    const tokens = readFileSync("src/ui/shared/tokens.css", "utf8");
    expect(css).toMatch(/\.chatobby-composer-controls-host\s*\{[^}]*container:\s*chatobby-controls \/ inline-size;/s);
    expect(css).toContain("@container chatobby-controls (max-width: 480px)");
    expect(css).toContain("@container chatobby-controls (max-width: 220px)");
    expect(css).toMatch(/@container chatobby-controls \(max-width: 220px\)\s*\{\s*\.chatobby-composer-controls\s*\{\s*flex-wrap:\s*wrap;/s);
    expect(css).not.toMatch(/button\.chatobby-control--effort\s*\{\s*display:\s*none/);
    expect(tokens).not.toMatch(/\.chatobby-composer-controls\s*\{[^}]*overflow-y:/s);
    expect(css).toMatch(/\.chatobby-selection-menu\s*\{[^}]*position:\s*fixed;/s);
  });

  it("does not invent an effort control for a model without projected effort, and closes a removed control's menu", () => {
    let current = model;
    const controls = new ComposerControls({ getViewModel: () => current, isBackendAvailable: () => true, applyControl: vi.fn() });
    controls.render(document.body);
    document.querySelector<HTMLButtonElement>(".chatobby-control--effort")?.click();
    current = { ...model, controls: model.controls.filter((control) => control.id !== "effort") };
    controls.refresh();
    expect(document.querySelector(".chatobby-control--effort")).toBeNull();
    expect(document.querySelector(".chatobby-selection-menu")).toBeNull();
    expect(document.querySelectorAll(".chatobby-control-button")).toHaveLength(2);
    controls.destroy();
  });

  it.each([240, 320, 440, 600, 1024].flatMap((width) => ["medium", "high"].map((value) => ({ width, value }))))(
    "keeps effort operable at viewport $width for projected $value", async ({ width, value }) => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
    const applyControl = vi.fn(async () => {});
    const controls = new ComposerControls({ getViewModel: () => model, isBackendAvailable: () => true, applyControl });
    controls.render(document.body);
    const anchor = document.querySelector<HTMLButtonElement>(".chatobby-control--effort")!;
    anchor.click();
    const menu = document.querySelector<HTMLElement>(".chatobby-selection-menu")!;
    expect(Number.parseFloat(menu.style.left) + Number.parseFloat(menu.style.width)).toBeLessThanOrEqual(width - 8);
    const index = model.controls.find((control) => control.id === "effort")!.options.findIndex((option) => option.value === value);
    document.querySelectorAll<HTMLButtonElement>(".chatobby-selection-menu__option")[index]?.click();
    await vi.waitFor(() => expect(applyControl).toHaveBeenCalledExactlyOnceWith("effort", value));
    expect(document.querySelectorAll(".chatobby-control-button")).toHaveLength(3);
    await vi.waitFor(() => expect(document.activeElement).toBe(anchor));
    controls.destroy();
  });
});

describe("picker viewport and lifecycle", () => {
  function mount(width: number, height: number, x = width - 34, y = height - 50) {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
    const host = document.body.createDiv();
    host.style.overflow = "hidden";
    const anchor = host.createEl("button");
    vi.spyOn(anchor, "getBoundingClientRect").mockImplementation(() => new DOMRect(x, y, 32, 32));
    const onClose = vi.fn((restore: boolean) => { menu.destroy(); if (restore) anchor.focus(); });
    const menu = new SelectionMenu({ anchor, title: "Access", searchPlaceholder: "Search access", selectedValue: "workspace",
      items: model.controls[0]!.options, onChoose: vi.fn(), onClose });
    menu.render(host);
    const element = document.getElementById(menu.id)!;
    return { host, anchor, menu, element, onClose };
  }

  it.each([240, 320, 440, 600, 1024])("bounds an open menu at viewport width %i outside the clipped composer", (width) => {
    const { host, menu, element } = mount(width, 500);
    expect(element.parentElement).toBe(document.body);
    expect(host.contains(element)).toBe(false);
    const left = Number.parseFloat(element.style.left);
    const menuWidth = Number.parseFloat(element.style.width);
    expect(left).toBeGreaterThanOrEqual(8);
    expect(left + menuWidth).toBeLessThanOrEqual(width - 8);
    expect(Number.parseFloat(element.style.top)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(element.style.maxHeight)).toBeLessThanOrEqual(360);
    menu.destroy();
  });

  it("repositions on resize/scroll, restores focus on Escape, and removes owned listeners", () => {
    const { anchor, menu, element, onClose } = mount(600, 500);
    const initialLeft = element.style.left;
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 40, 32, 32));
    window.dispatchEvent(new Event("resize"));
    expect(element.style.left).not.toBe(initialLeft);
    expect(Number.parseFloat(element.style.top)).toBe(78);
    const remove = vi.spyOn(document, "removeEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(onClose).toHaveBeenCalledWith(true);
    expect(document.activeElement).toBe(anchor);
    expect(document.getElementById(menu.id)).toBeNull();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    expect(removeWindow).toHaveBeenCalledWith("resize", expect.any(Function));
    document.dispatchEvent(new Event("scroll"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clamps the actual menu height above a low anchor and below a high anchor on scroll", () => {
    const { anchor, menu, element } = mount(320, 260, 280, 220);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 304, 190));
    document.dispatchEvent(new Event("scroll"));
    expect(Number.parseFloat(element.style.top)).toBe(24);
    expect(Number.parseFloat(element.style.maxHeight)).toBe(206);
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 32, 32));
    document.dispatchEvent(new Event("scroll"));
    expect(Number.parseFloat(element.style.top)).toBe(38);
    expect(Number.parseFloat(element.style.top) + 190).toBeLessThanOrEqual(252);
    menu.destroy();
  });

  it.each([false, true])("releases Tab to native composer focus order (shift=%s)", (shiftKey) => {
    const { anchor, element, onClose } = mount(320, 500);
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    expect(onClose).toHaveBeenCalledWith(true);
    expect(document.activeElement).toBe(anchor);
    expect(event.defaultPrevented).toBe(false);
  });

  it("cancels pending focus and anchor observation on destroy without stealing later focus", async () => {
    const disconnect = vi.spyOn(ResizeObserver.prototype, "disconnect");
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const { menu } = mount(320, 500);
    const outside = document.body.createEl("button");
    outside.focus();
    menu.destroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    expect(document.activeElement).toBe(outside);
  });

  it("dismisses an orphaned anchor without restoring focus to a detached pane", () => {
    const { host, menu, onClose } = mount(320, 500);
    host.remove();
    window.dispatchEvent(new Event("resize"));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(document.getElementById(menu.id)).toBeNull();
  });

  it("dismisses the portal when a blocking interaction or hidden pane hides its trigger", () => {
    let notify: ResizeObserverCallback | undefined;
    class ObserverFixture {
      constructor(callback: ResizeObserverCallback) { notify = callback; }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", ObserverFixture);
    const { anchor, menu, onClose } = mount(320, 500);
    notify?.([{ target: anchor, contentRect: new DOMRect(0, 0, 0, 0), borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] }], new ObserverFixture(() => {}));
    expect(onClose).toHaveBeenCalledExactlyOnceWith(false);
    expect(document.getElementById(menu.id)).toBeNull();
  });

  it("uses the visual viewport's reduced size and offset under zoom", () => {
    const viewport = Object.assign(new EventTarget(), { width: 240, height: 360, offsetLeft: 40, offsetTop: 20 });
    vi.stubGlobal("visualViewport", viewport);
    const remove = vi.spyOn(viewport, "removeEventListener");
    const { menu, element } = mount(1024, 768, 240, 280);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 224, 200));
    viewport.dispatchEvent(new Event("resize"));
    expect(Number.parseFloat(element.style.width)).toBe(224);
    expect(Number.parseFloat(element.style.left)).toBe(48);
    expect(Number.parseFloat(element.style.top)).toBeGreaterThanOrEqual(28);
    expect(Number.parseFloat(element.style.top) + 200).toBeLessThanOrEqual(372);
    menu.destroy();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
