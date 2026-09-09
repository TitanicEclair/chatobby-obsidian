import { describe, expect, it, vi } from "vitest";
import { ThinkingBlockView } from "../../src/ui/feed/thinking-block";
import type { FeedHost } from "../../src/ui/feed";
import type { ThinkingBlock } from "../../src/types";

describe("streaming reasoning window", () => {
  it("follows new deltas only when already at the bottom and preserves completion folding", () => {
    const block: ThinkingBlock = { type: "thinking", id: "thinking", turnId: "turn", text: "First", status: "streaming", startIndex: 0, endIndex: 0, displayMode: null };
    const host = { getThinkingDisplay: () => "collapsed", feedViewActions: { setThinkingDisplay: vi.fn() } } as unknown as FeedHost;
    const view = new ThinkingBlockView(host, block);
    const container = document.body.createDiv();
    view.render(container);
    const body = container.querySelector<HTMLElement>(".chatobby-thinking-block__body")!;
    Object.defineProperties(body, { scrollHeight: { configurable: true, value: 800 }, clientHeight: { configurable: true, value: 250 } });
    body.scrollTop = 100;
    view.setStreaming("First\nSecond");
    expect(body.scrollTop).toBe(100);
    body.scrollTop = 550;
    view.setStreaming("First\nSecond\nThird");
    expect(body.scrollTop).toBe(800);
    expect(container.querySelector(".chatobby-thinking-block")!.classList.contains("is-streaming")).toBe(true);
    view.complete(1500);
    expect(container.querySelector(".chatobby-thinking-block")!.classList.contains("is-streaming")).toBe(false);
    expect(container.querySelector(".chatobby-thinking-block")!.classList.contains("is-collapsed")).toBe(true);
    view.toggleExpanded();
    expect(container.querySelector(".chatobby-thinking-block")!.classList.contains("is-collapsed")).toBe(false);
    expect(body.getAttribute("aria-label")).toBe("Reasoning");
  });
});
