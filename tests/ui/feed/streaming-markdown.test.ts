import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareMarkdownForRender, TextBlockView } from "../../../src/ui/feed/text-block";
import { createMockFeedHost } from "../helpers/mock-host";
import { mount } from "../helpers/mount";

describe("streamed Markdown scheduling", () => {
  afterEach(() => vi.useRealTimers());
  it("joins a slow render and coalesces pending deltas without starving visible text", async () => {
    vi.useFakeTimers();
    const host = createMockFeedHost();
    const finishes: (() => void)[] = [];
    host.renderMarkdown = vi.fn((markdown, element) => new Promise<void>((resolve) => {
      finishes.push(() => { element.textContent = markdown; resolve(); });
    }));
    const view = new TextBlockView(host, { type: "text", id: "stream", turnId: "turn", text: "one", status: "streaming", startIndex: 0, endIndex: 0 });
    const el = mount(view);
    view.setStreaming("one two");
    await vi.advanceTimersByTimeAsync(300);
    view.setStreaming("one two three");
    expect(host.renderMarkdown).toHaveBeenCalledTimes(1);
    finishes.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(el.querySelector(".chatobby-text-block__content")?.textContent).toBe("one");
    expect(host.renderMarkdown).toHaveBeenCalledTimes(2);
    view.complete();
    finishes.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    finishes.shift()!();
    await vi.advanceTimersByTimeAsync(0);
    expect(el.querySelector(".chatobby-text-block__content")?.textContent).toBe("one two three");
    view.destroy();
  });
  it("keeps unchanged paragraph elements while the trailing paragraph grows", async () => {
    vi.useFakeTimers();
    const host = createMockFeedHost();
    host.renderMarkdown = (markdown, element) => {
      for (const paragraph of markdown.split("\n\n")) element.createEl("p", { text: paragraph });
    };
    const view = new TextBlockView(host, { type: "text", id: "stream", turnId: "turn", text: "stable\n\ntail", status: "streaming", startIndex: 0, endIndex: 0 });
    const el = mount(view);
    const first = el.querySelector(".chatobby-text-block__content p");
    view.setStreaming("stable\n\ntail grows");
    await vi.advanceTimersByTimeAsync(100);
    expect(el.querySelector(".chatobby-text-block__content p")).toBe(first);
    expect(el.textContent).toContain("tail grows");
    view.destroy();
  });
});

describe("prepareMarkdownForRender", () => {
  it("keeps complete executable fences inert until streaming finishes", () => {
    const markdown = [
      "Before",
      "```dataview",
      "TABLE file.mtime",
      "```",
      "After",
    ].join("\n");

    expect(prepareMarkdownForRender(markdown, true)).toBe([
      "Before",
      "```text",
      "TABLE file.mtime",
      "```",
      "After",
    ].join("\n"));
    expect(prepareMarkdownForRender(markdown, false)).toBe(markdown);
  });

  it("closes and neutralizes an incomplete fence in every render state", () => {
    const markdown = [
      "Before",
      "~~~dataviewjs",
      "dv.list(",
    ].join("\n");
    const expected = [
      "Before",
      "~~~text",
      "dv.list(",
      "~~~",
    ].join("\n");

    expect(prepareMarkdownForRender(markdown, true)).toBe(expected);
    expect(prepareMarkdownForRender(markdown, false)).toBe(expected);
  });
});
