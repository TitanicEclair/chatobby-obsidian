import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INITIAL_LEGACY_FEED_STATE } from "../../../src/features/feed/public";
import type { FeedBlock, UserMessage } from "../../../src/types";
import { FeedRenderer } from "../../../src/ui/feed";
import { StickyPromptController } from "../../../src/ui/feed/sticky-prompt-controller";
import { createMockFeedHost } from "../helpers/mock-host";
import { mount } from "../helpers/mount";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const prompt = (id: string, content: UserMessage["content"]): FeedBlock => ({
  type: "user", id, messageId: id, message: { role: "user", content },
});

describe("sticky prompt", () => {
  it("shows the current prompt once its opening line leaves the reading viewport", () => {
    const container = document.createElement("div");
    const scroll = container.createDiv();
    const block = scroll.createDiv();
    scroll.getBoundingClientRect = () => new DOMRect(0, 100, 320, 400);
    block.getBoundingClientRect = () => new DOMRect(0, 100, 320, 100);
    const controller = new StickyPromptController({
      getScroll: () => scroll, getOrderedBlocks: () => [prompt("one", "A visible prompt")],
      getBlockElement: () => block,
    });
    controller.mount(container);
    controller.update(true);
    const button = container.querySelector("button");
    expect(button?.classList.contains("is-hidden")).toBe(true);
    block.getBoundingClientRect = () => new DOMRect(0, 50, 320, 100);
    controller.update(true);
    expect(button?.classList.contains("is-hidden")).toBe(false);
    controller.clear();
  });

  it("retains full accessible text and navigates to the correct preceding prompt", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    const scroll = container.createDiv();
    const one = scroll.createDiv();
    const two = scroll.createDiv();
    const text = "A long synthetic prompt with Unicode 漢字 and wrapping ".repeat(30).trim();
    const blocks = [prompt("one", text), prompt("two", "Next prompt")];
    const beforeNavigate = vi.fn();
    scroll.getBoundingClientRect = () => new DOMRect(0, 100, 320, 400);
    one.getBoundingClientRect = () => new DOMRect(0, -200, 320, 100);
    two.getBoundingClientRect = () => new DOMRect(0, 200, 320, 100);
    one.scrollIntoView = vi.fn();
    const controller = new StickyPromptController({
      getScroll: () => scroll, getOrderedBlocks: () => blocks,
      getBlockElement: (id) => id === "one" ? one : two, beforeNavigate,
    });
    controller.mount(container);
    controller.update(true);
    const button = container.querySelector("button");
    expect(button?.getAttribute("type")).toBe("button");
    expect(button?.getAttribute("aria-label")).toBe(`Return to prompt: ${text}`);
    expect(button?.querySelector(".chatobby-feed__sticky-prompt-text")?.textContent).toBe(text);
    button?.click();
    expect(beforeNavigate).toHaveBeenCalledOnce();
    expect(one.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(one.classList.contains("is-feed-target")).toBe(true);
    two.getBoundingClientRect = () => new DOMRect(0, 50, 320, 100);
    controller.update(true);
    expect(button?.getAttribute("aria-label")).toBe("Return to prompt: Next prompt");
    controller.clear();
    expect(one.classList.contains("is-feed-target")).toBe(false);
    vi.advanceTimersByTime(1_000);
  });

  it("names attachment-only prompts and hides on source mode or empty history", () => {
    const container = document.createElement("div");
    const scroll = container.createDiv();
    const block = scroll.createDiv();
    scroll.getBoundingClientRect = () => new DOMRect(0, 100, 320, 400);
    block.getBoundingClientRect = () => new DOMRect(0, -100, 320, 100);
    let blocks = [prompt("attachment", [{ type: "image", mimeType: "image/png", data: "aGVsbG8=" }])];
    const controller = new StickyPromptController({ getScroll: () => scroll, getOrderedBlocks: () => blocks, getBlockElement: () => block });
    controller.mount(container);
    controller.update(true);
    const button = container.querySelector("button");
    expect(button?.textContent).toBe("Attached files");
    controller.update(false);
    expect(button?.classList.contains("is-hidden")).toBe(true);
    blocks = [];
    controller.update(true);
    expect(button?.classList.contains("is-hidden")).toBe(true);
    expect(button?.getAttribute("aria-label")).toBe("Return to the preceding prompt");
    controller.clear();
  });

  it("does not re-show the banner on source scrolling and refreshes unpinned resize geometry", () => {
    vi.useFakeTimers();
    let resize: (() => void) | undefined;
    vi.stubGlobal("ResizeObserver", class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) { resize = () => callback([], this); }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    });
    const renderer = new FeedRenderer(createMockFeedHost({
      ...INITIAL_LEGACY_FEED_STATE, isAtBottom: false, scrollTop: 200,
      blocks: [prompt("one", "Synthetic preceding prompt")],
    }));
    const element = mount(renderer);
    const scroll = element.querySelector<HTMLElement>(".chatobby-feed__scroll");
    const block = element.querySelector<HTMLElement>("[data-block-id='one']");
    const button = element.querySelector("button.chatobby-feed__sticky-prompt");
    if (!scroll || !block || !button) throw new Error("Missing synthetic feed");
    Object.defineProperties(scroll, { scrollHeight: { value: 1_000 }, clientHeight: { value: 400 } });
    scroll.getBoundingClientRect = () => new DOMRect(0, 100, 320, 400);
    block.getBoundingClientRect = () => new DOMRect(0, -100, 320, 100);
    scroll.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(50);
    expect(button.classList.contains("is-hidden")).toBe(false);
    renderer.toggleSourceViewMode();
    scroll.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(50);
    expect(button.classList.contains("is-hidden")).toBe(true);
    renderer.toggleSourceViewMode();
    block.getBoundingClientRect = () => new DOMRect(0, 150, 320, 100);
    resize?.();
    vi.advanceTimersByTime(50);
    expect(button.classList.contains("is-hidden")).toBe(true);
    expect(scroll.scrollTop).toBe(200);
    renderer.destroy();
  });

  it("uses a wrapping theme-aware row outside the only scrolling region", () => {
    const css = readFileSync("src/ui/feed/feed.css", "utf8");
    const rule = css.match(/\.chatobby-feed__sticky-prompt \{([^}]+)\}/)?.[1] ?? "";
    expect(rule).not.toContain("position: absolute");
    for (const declaration of ["justify-content: flex-start", "height: auto", "text-align: left", "box-sizing: border-box", "var(--chatobby-surface-muted)"]) expect(rule).toContain(declaration);
    expect(css).toContain("-webkit-line-clamp: 2");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toMatch(/\.chatobby-feed__sticky-prompt:focus-visible\s*\{[^}]*outline:/);
  });
});
