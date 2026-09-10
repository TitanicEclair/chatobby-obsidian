import { afterEach, describe, expect, it, vi } from "vitest";
import { chatobbyPerformance } from "../../../src/frontend/performance-monitor";
import { createFeedStore, feedSelectors, INITIAL_LEGACY_FEED_STATE, type LegacyFeedState } from "../../../src/features/feed/public";
import { FeedRenderer } from "../../../src/ui/feed";
import { createMockFeedHost } from "../helpers/mock-host";
import { mount } from "../helpers/mount";

/** Resolves after the scroll listener's requestAnimationFrame callback has run. */
const flushScrollFrame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));

describe("FeedRenderer", () => {
  it("shows an animated Working status until concrete run activity appears", () => {
    const latency = vi.spyOn(chatobbyPerformance, "recordFirstOutputLatency");
    const host = createMockFeedHost();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const working = el.querySelector<HTMLElement>(".chatobby-feed__working");
    expect(working?.classList.contains("is-hidden")).toBe(true);

    host.getFeedStore().dispatch({
      type: "feed.user-prompt-submitted",
      text: "Test the pending provider state",
      startRun: true,
    });

    expect(working?.classList.contains("is-hidden")).toBe(false);
    expect(working?.textContent).toContain("Working...");
    expect(working?.getAttribute("role")).toBe("status");

    host.getFeedStore().dispatch({ type: "feed.runtime-activity-synchronized", active: false });
    expect(working?.classList.contains("is-hidden")).toBe(true);

    host.getFeedStore().dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [{
        type: "text",
        id: "first-provider-output",
        turnId: "turn-first-provider-output",
        text: "The provider has started responding.",
        startIndex: 0,
        endIndex: 0,
        status: "streaming",
      }] },
    });
    expect(latency).toHaveBeenCalledOnce();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the feed skeleton hooks", () => {
    const renderer = new FeedRenderer(createMockFeedHost());
    const el = mount(renderer);
    expect(el.querySelector(".chatobby-feed__scroll")).toBeTruthy();
    expect(el.querySelector(".chatobby-feed__blocks")).toBeTruthy();
    expect(el.querySelector(".chatobby-feed__jump-pill")).toBeTruthy();
    expect(el.querySelector(".chatobby-feed__jump-pill")?.classList.contains("is-hidden")).toBe(true);
    expect(el.querySelector(".chatobby-feed__blocks")?.getAttribute("aria-label")).toBeNull();
    const scroll = el.querySelector(".chatobby-feed__scroll");
    const labelId = scroll?.getAttribute("aria-labelledby");
    expect(scroll?.getAttribute("aria-label")).toBeNull();
    expect(labelId).toBeTruthy();
    expect(el.querySelector(`#${labelId}`)?.textContent).toBe("Conversation feed");
  });

  it("renders clickable empty-state prompts without a decorative emoji", () => {
    const host = createMockFeedHost();
    host.onEmptyPrompt = vi.fn();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-feed__empty-title")?.textContent).toBe("Chatobby");
    expect(el.querySelector(".chatobby-feed__empty-mark")).toBeNull();
    const suggestion = [...el.querySelectorAll<HTMLButtonElement>(".chatobby-feed__empty-capabilities button")]
      .find((button) => button.textContent === "Summarize the note I’m viewing and list any next actions.");
    suggestion?.click();
    expect(host.onEmptyPrompt).toHaveBeenCalledWith("Summarize the note I’m viewing and list any next actions.");
  });

  it("releases bottom pinning immediately when the user scrolls upward", () => {
    const host = createMockFeedHost();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const scroll = el.querySelector(".chatobby-feed__scroll");
    expect(scroll).toBeInstanceOf(HTMLElement);
    if (!(scroll instanceof HTMLElement)) return;
    Object.defineProperties(scroll, {
      scrollTop: { value: 300, writable: true },
      scrollHeight: { value: 1_000 },
      clientHeight: { value: 500 },
    });

    scroll.dispatchEvent(new WheelEvent("wheel", { deltaY: -20 }));

    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(false);
    expect(el.querySelector(".chatobby-feed__jump-pill")?.classList.contains("is-hidden")).toBe(false);
  });

  it("releases bottom pinning when the reader scrolls up via scrollbar or keyboard", async () => {
    const host = createMockFeedHost();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const scroll = el.querySelector(".chatobby-feed__scroll");
    expect(scroll).toBeInstanceOf(HTMLElement);
    if (!(scroll instanceof HTMLElement)) return;
    Object.defineProperties(scroll, {
      scrollTop: { value: 500, writable: true, configurable: true },
      scrollHeight: { value: 1_000, configurable: true },
      clientHeight: { value: 500, configurable: true },
    });

    // Prime the bottom anchor the way a streaming flush would.
    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();
    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(true);

    // A scrollbar drag is explicit user intent even while still inside the bottom zone.
    scroll.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    Object.defineProperty(scroll, "scrollTop", { value: 460, writable: true, configurable: true });
    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();

    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(false);
    expect(el.querySelector(".chatobby-feed__jump-pill")?.classList.contains("is-hidden")).toBe(false);
  });

  it("re-attaches auto-follow when the reader scrolls back down to the bottom", async () => {
    const host = createMockFeedHost();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const scroll = el.querySelector(".chatobby-feed__scroll");
    expect(scroll).toBeInstanceOf(HTMLElement);
    if (!(scroll instanceof HTMLElement)) return;
    Object.defineProperties(scroll, {
      scrollTop: { value: 500, writable: true, configurable: true },
      scrollHeight: { value: 1_000, configurable: true },
      clientHeight: { value: 500, configurable: true },
    });

    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();
    scroll.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp", bubbles: true }));
    Object.defineProperty(scroll, "scrollTop", { value: 300, writable: true, configurable: true });
    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();
    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(false);

    // Scrolling back down into the bottom zone re-engages auto-follow.
    Object.defineProperty(scroll, "scrollTop", { value: 500, writable: true, configurable: true });
    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();
    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(true);
    expect(el.querySelector(".chatobby-feed__jump-pill")?.classList.contains("is-hidden")).toBe(true);
  });

  it("keeps following when streaming content growth moves the physical bottom", async () => {
    const host = createMockFeedHost();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const scroll = el.querySelector(".chatobby-feed__scroll");
    expect(scroll).toBeInstanceOf(HTMLElement);
    if (!(scroll instanceof HTMLElement)) return;
    Object.defineProperties(scroll, {
      scrollTop: { value: 500, writable: true, configurable: true },
      scrollHeight: { value: 1_000, writable: true, configurable: true },
      clientHeight: { value: 500, configurable: true },
    });
    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();

    Object.defineProperty(scroll, "scrollHeight", { value: 1_800, writable: true, configurable: true });
    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();

    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(true);
    expect(scroll.scrollTop).toBe(1_800);
  });

  it("only shows the latest jump pill when the feed is not at the bottom", () => {
    const state: LegacyFeedState = { ...INITIAL_LEGACY_FEED_STATE, isAtBottom: false, scrollTop: 120 };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const pill = el.querySelector(".chatobby-feed__jump-pill");

    expect(pill?.classList.contains("is-hidden")).toBe(false);

    host.feedViewActions.setScroll(true, 0);

    expect(pill?.classList.contains("is-hidden")).toBe(true);
  });

  it("pins the preceding prompt and returns to it from the reading position", async () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [
        {
          type: "user",
          id: "prompt-one",
          messageId: "message-one",
          message: { role: "user", content: "Review the architecture and list the important gaps." },
        },
        {
          type: "text",
          id: "answer-one",
          turnId: "turn-one",
          text: "Working through the architecture.",
          startIndex: 0,
          endIndex: 0,
          status: "complete",
        },
        {
          type: "user",
          id: "prompt-two",
          messageId: "message-two",
          message: { role: "user", content: "Now verify the tests." },
        },
      ],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const element = mount(renderer);
    const scroll = element.querySelector<HTMLElement>(".chatobby-feed__scroll");
    const first = element.querySelector<HTMLElement>("[data-block-id='prompt-one']");
    const second = element.querySelector<HTMLElement>("[data-block-id='prompt-two']");
    if (!scroll || !first || !second) throw new Error("prompt fixtures did not render");
    scroll.getBoundingClientRect = () => ({ top: 0 } as DOMRect);
    first.getBoundingClientRect = () => new DOMRect(0, -120, 320, 100);
    second.getBoundingClientRect = () => new DOMRect(0, 120, 320, 100);
    first.scrollIntoView = vi.fn();

    scroll.dispatchEvent(new Event("scroll"));
    await flushScrollFrame();

    const sticky = element.querySelector<HTMLButtonElement>(".chatobby-feed__sticky-prompt");
    expect(sticky?.classList.contains("is-hidden")).toBe(false);
    expect(sticky?.textContent).toBe("Review the architecture and list the important gaps.");
    host.feedViewActions.setScroll(true, 0);
    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(true);
    sticky?.click();
    expect(first.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(first.classList.contains("is-feed-target")).toBe(true);
    expect(host.getFeedStore().select(feedSelectors.scroll).isAtBottom).toBe(false);
  });

  it("renders feed blocks through block components and markdown host", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [
        {
          type: "user",
          id: "block-user",
          messageId: "msg-user",
          message: { role: "user", content: [{ type: "text", text: "hello" }] },
        },
        {
          type: "text",
          id: "block-text",
          turnId: "turn-1",
          text: "**world**",
          startIndex: 0,
          endIndex: 0,
          status: "complete",
        },
      ],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-user-block__content")?.textContent).toContain("hello");
    expect(el.querySelector(".chatobby-text-block__content")?.textContent).toContain("**world**");
    expect(host.renderMarkdown).toHaveBeenCalledWith("**world**", expect.any(HTMLElement));
  });

  it("renders Markdown while the response is still streaming", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      activeTurnId: "turn-live",
      blocks: [{
        type: "text",
        id: "block-live",
        turnId: "turn-live",
        text: "**live**",
        startIndex: 0,
        endIndex: 0,
        status: "streaming",
      }],
    };
    const host = createMockFeedHost(state);
    host.renderMarkdown = vi.fn((_markdown, container) => {
      container.innerHTML = "<p><strong>live</strong></p>";
    });

    const renderer = new FeedRenderer(host);
    const element = mount(renderer);

    expect(element.querySelector(".chatobby-text-block__content strong")?.textContent).toBe("live");
    expect(host.renderMarkdown).toHaveBeenCalledWith("**live**", expect.any(HTMLElement));
  });

  it("finishes an in-flight Markdown pass before rendering the latest completed response", async () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      activeTurnId: "turn-race",
      blocks: [{
        type: "text",
        id: "block-race",
        turnId: "turn-race",
        text: "old",
        startIndex: 0,
        endIndex: 0,
        status: "streaming",
      }],
    };
    const host = createMockFeedHost(state);
    const finishes: Array<() => void> = [];
    host.renderMarkdown = vi.fn((markdown, container) => new Promise<void>((resolve) => {
      finishes.push(() => {
        container.textContent = markdown;
        resolve();
      });
    }));
    const renderer = new FeedRenderer(host);
    const element = mount(renderer);

    host.getFeedStore().dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [{
        type: "text",
        id: "block-race",
        turnId: "turn-race",
        text: "new",
        startIndex: 0,
        endIndex: 0,
        status: "complete",
      }] },
    });
    expect(finishes).toHaveLength(1);
    finishes[0]?.();
    await vi.waitFor(() => expect(finishes).toHaveLength(2));
    expect(element.querySelector(".chatobby-text-block__content")?.textContent).not.toBe("old");
    finishes[1]?.();
    await Promise.resolve();
    expect(element.querySelector(".chatobby-text-block__content")?.textContent).toBe("new");
  });

  it("renders persisted user image attachments in the feed", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "user",
        id: "block-user-image",
        messageId: "msg-user-image",
        message: {
          role: "user",
          content: [
            { type: "text", text: "Inspect this" },
            { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
          ],
        },
      }],
    };
    const renderer = new FeedRenderer(createMockFeedHost(state));
    const el = mount(renderer);
    const image = el.querySelector<HTMLImageElement>(".chatobby-media-card__image");

    expect(image?.src).toBe("data:image/png;base64,aGVsbG8=");
    expect(image?.alt).toBe("Attached image/png");
  });

  it("renders trailing @ references as a dedicated summary instead of message prose", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "user",
        id: "block-user-references",
        messageId: "msg-user-references",
        message: {
          role: "user",
          content: "Compare these @[[Notes/Cerebrum.md]] @[[Projects/Plans/]]",
        },
      }],
    };
    const renderer = new FeedRenderer(createMockFeedHost(state));
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-user-block__content")?.textContent).toContain("Compare these");
    expect(el.querySelector(".chatobby-user-block__content")?.textContent).not.toContain("Notes/Cerebrum.md");
    expect(el.querySelector(".chatobby-message-reference-summary")?.textContent).toBe("@2 references");
  });

  it("names the referenced file when a user message has one @ reference", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "user",
        id: "block-user-reference",
        messageId: "msg-user-reference",
        message: { role: "user", content: "Review @[[Notes/Cerebrum.md]]" },
      }],
    };
    const renderer = new FeedRenderer(createMockFeedHost(state));
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-message-reference-summary")?.textContent).toBe("@Cerebrum.md");
  });

  it("renders an invoked skill as a compact chip without exposing its instructions", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "user",
        id: "block-user-skill",
        messageId: "msg-user-skill",
        message: {
          role: "user",
          content: "Turn this into revision notes.",
          skillInvocations: [{ name: "study-notes" }],
        },
      }],
    };
    const renderer = new FeedRenderer(createMockFeedHost(state));
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-user-block__content")?.textContent).toContain("Turn this into revision notes.");
    expect(el.querySelector(".chatobby-message-skill-invocation")?.textContent).toBe("study-notes");
    expect(el.querySelector(".chatobby-user-block__content")?.textContent).not.toContain("SKILL.md");
  });

  it("renders named file attachments and reveals the stored file on click", () => {
    const path = "C:/vault/.chatobby/attachments/report.xlsx";
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "user",
        id: "block-user-file",
        messageId: "msg-user-file",
        message: {
          role: "user",
          content: [
            { type: "text", text: "Inspect this workbook" },
            {
              type: "attachment",
              name: "report.xlsx",
              kind: "binary",
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              path,
              sizeBytes: 4096,
            },
          ],
        },
      }],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const attachment = el.querySelector<HTMLButtonElement>(".chatobby-message-attachment");

    expect(attachment?.textContent).toContain("report.xlsx");
    expect(attachment?.textContent).toContain("XLSX");
    expect(attachment?.dataset.fileKind).toBe("spreadsheet");
    attachment?.click();
    expect(host.revealSystemPath).toHaveBeenCalledWith(path);
  });

  it("renders queued steer attachments and preserves them across status updates", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "queued",
        id: "queued-image",
        kind: "steer",
        text: "",
        attachments: [{
          type: "attachment",
          name: "correction.png",
          kind: "image",
          mimeType: "image/png",
          path: "C:/vault/.chatobby/attachments/correction.png",
          sizeBytes: 2048,
        }],
        status: "pending",
      }],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-message-attachment")?.textContent).toContain("correction.png");
    host.getFeedStore().dispatch({
      type: "feed.document-projection-synchronized",
      projection: {
        blocks: [{
          ...state.blocks[0],
          status: "queued",
        }],
      },
    });
    expect(el.querySelector(".chatobby-message-attachment")?.textContent).toContain("correction.png");
    expect(el.querySelector(".chatobby-queued")?.classList.contains("is-queued")).toBe(true);
  });

  it("copies a complete response from its bottom-right action as source Markdown", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "text",
        id: "block-copy",
        turnId: "turn-1",
        text: "**Bold** and [link](https://example.com)",
        startIndex: 0,
        endIndex: 0,
        status: "complete",
      }],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const copy = el.querySelector<HTMLButtonElement>('.chatobby-text-block__copy[aria-label="Copy response as Markdown"]');
    copy?.click();

    expect(host.copyToClipboard).toHaveBeenCalledWith("**Bold** and [link](https://example.com)");
  });

  it("writes Markdown to the clipboard when copying a rendered selection", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "text",
        id: "block-selection",
        turnId: "turn-1",
        text: "**Bold** and *italic*",
        startIndex: 0,
        endIndex: 0,
        status: "complete",
      }],
    };
    const host = createMockFeedHost(state);
    host.renderMarkdown = (_markdown, container) => {
      container.innerHTML = "<p><strong>Bold</strong> and <em>italic</em></p>";
    };
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const content = el.querySelector<HTMLElement>(".chatobby-text-block__content");
    const scroll = el.querySelector<HTMLElement>(".chatobby-feed__scroll");
    if (!content || !scroll) throw new Error("feed selection surface missing");
    const range = document.createRange();
    range.selectNodeContents(content);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const clipboardData = new DataTransfer();
    scroll.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true, clipboardData }));

    expect(clipboardData.getData("text/plain")).toBe("**Bold** and *italic*");
    expect(clipboardData.getData("text/markdown")).toBe("**Bold** and *italic*");
  });

  it("keeps supervisor lifecycle blocks out of the conversation feed", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "subagent",
        id: "subagent-run-a",
        agentId: "run-a",
        status: "streaming",
        activity: {
          agentId: "run-a",
          name: "General purpose",
          type: "Subagent run",
          description: "Test communication routing",
          source: "chatobby-supervisor",
          status: "waiting",
          resultPreview: "This verbose result belongs in the child feed.",
          compactionCount: 0,
        },
      }],
    };
    const renderer = new FeedRenderer(createMockFeedHost(state));
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-subagent")).toBeNull();
    expect(el.querySelector(".chatobby-feed__empty")).not.toBeNull();
  });

  it("does not install block-level navigation or synthetic cursor mode in reading view", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [
        {
          type: "user",
          id: "block-user",
          messageId: "msg-user",
          message: { role: "user", content: "first" },
        },
        {
          type: "text",
          id: "block-text",
          turnId: "turn-1",
          text: "second",
          startIndex: 0,
          endIndex: 0,
          status: "complete",
        },
      ],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const scroll = el.querySelector(".chatobby-feed__scroll") as HTMLElement;
    const blocks = el.querySelector(".chatobby-feed__blocks") as HTMLElement;
    expect(blocks.contentEditable).toBe("inherit");
    expect(blocks.getAttribute("aria-readonly")).toBe("true");
    expect(el.querySelector("[data-block-id='block-user']")?.classList.contains("is-selected")).toBe(false);
    expect(el.querySelector("[data-block-id='block-text']")?.classList.contains("is-selected")).toBe(false);

    const blockArrow = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    scroll.dispatchEvent(blockArrow);

    expect(blockArrow.defaultPrevented).toBe(false);
    expect(el.querySelector("[data-block-id='block-user']")?.classList.contains("is-selected")).toBe(false);
    expect(el.querySelector("[data-block-id='block-text']")?.classList.contains("is-selected")).toBe(false);
  });

	it("suspends hidden feed rendering and performs one catch-up render on activation", () => {
		vi.useFakeTimers();
		const host = createMockFeedHost();
		const renderer = new FeedRenderer(host);
		const element = mount(renderer);
		renderer.setActive(false);

		host.getFeedStore().dispatch({
			type: "feed.document-projection-synchronized",
			projection: { blocks: [{
				type: "text",
				id: "hidden-response",
				turnId: "turn-hidden",
				text: "**finished while hidden**",
				startIndex: 0,
				endIndex: 0,
				status: "complete",
			}] },
		});
		vi.advanceTimersByTime(1_000);
		expect(element.textContent).not.toContain("finished while hidden");
		expect(host.renderMarkdown).not.toHaveBeenCalled();

		renderer.setActive(true);
		expect(element.textContent).toContain("finished while hidden");
		expect(host.renderMarkdown).toHaveBeenCalledTimes(1);
		renderer.setActive(true);
		expect(host.renderMarkdown).toHaveBeenCalledTimes(1);
	});

	it("fully replaces hidden feed DOM when the active session store changes", () => {
		const host = createMockFeedHost({
			...INITIAL_LEGACY_FEED_STATE,
			blocks: [{
				type: "text",
				id: "previous-session-response",
				turnId: "turn-previous",
				text: "Previous session response",
				startIndex: 0,
				endIndex: 0,
				status: "complete",
			}],
		});
		const renderer = new FeedRenderer(host);
		const element = mount(renderer);
		expect(element.textContent).toContain("Previous session response");

		renderer.setActive(false);
		const emptySessionStore = createFeedStore();
		renderer.switchStore(emptySessionStore);
		renderer.setActive(true);

		expect(element.textContent).not.toContain("Previous session response");
		expect(element.querySelectorAll(".chatobby-feed__empty")).toHaveLength(1);
	});

  it("toggles to a read-only source view of the feed", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [
        {
          type: "user",
          id: "block-user",
          messageId: "msg-user",
          message: { role: "user", content: "hello" },
        },
        {
          type: "text",
          id: "block-text",
          turnId: "turn-1",
          text: "**world**",
          startIndex: 0,
          endIndex: 0,
          status: "complete",
        },
      ],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const source = el.querySelector(".chatobby-feed__source") as HTMLTextAreaElement;

    expect(source.value).toBe("");

    renderer.toggleSourceViewMode();

    expect(el.classList.contains("is-source-mode")).toBe(true);
    expect(source.readOnly).toBe(true);
    expect(source.value).toContain("## User");
    expect(source.value).toContain("hello");
    expect(source.value).toContain("**world**");
  });

  it("decorates rendered markdown tables so separators and wide rows render correctly", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      activeTurnId: "turn-1",
      blocks: [{
        type: "text",
        id: "block-table",
        turnId: "turn-1",
        text: "| A | B |\n|---|---|\n| 1 | 2 |",
        startIndex: 0,
        endIndex: 0,
        status: "complete",
      }],
    };
    const host = createMockFeedHost(state);
    host.renderMarkdown = (_markdown, container) => {
      const table = container.createEl("table");
      const thead = table.createEl("thead");
      const headRow = thead.createEl("tr");
      headRow.createEl("th", { text: "A" });
      headRow.createEl("th", { text: "B" });
      const tbody = table.createEl("tbody");
      const row = tbody.createEl("tr");
      row.createEl("td", { text: "1" });
      row.createEl("td", { text: "2" });
    };

    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    const wrapper = el.querySelector(".chatobby-markdown-table-wrap");
    const table = wrapper?.querySelector("table");
    expect(wrapper).toBeTruthy();
    expect(table?.classList.contains("chatobby-markdown-table")).toBe(true);
    expect(table?.querySelectorAll("th,td")).toHaveLength(4);
  });

  it("keeps the same block wrapper when a keyed block updates", () => {
    vi.useFakeTimers();
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      activeTurnId: "turn-1",
      blocks: [{
        type: "text",
        id: "block-text",
        turnId: "turn-1",
        text: "one",
        startIndex: 0,
        endIndex: 0,
        status: "streaming",
      }],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    const first = el.querySelector("[data-block-id='block-text']");
    host.getFeedStore().dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [{
        type: "text",
        id: "block-text",
        turnId: "turn-1",
        text: "one",
        startIndex: 0,
        endIndex: 0,
        status: "complete",
      }] },
    });
    vi.advanceTimersByTime(500);

    expect(el.querySelector("[data-block-id='block-text']")).toBe(first);
    expect(first?.textContent).toContain("one");
    expect(first?.querySelector(".chatobby-text-block")?.classList.contains("is-streaming")).toBe(false);
  });

  it("detaches folded reasoning mounts instead of leaving stale thought rows after the response", () => {
    vi.useFakeTimers();
    const host = createMockFeedHost({
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "thinking",
        id: "reasoning",
        turnId: "turn-1",
        text: "reasoning",
        startIndex: 0,
        endIndex: 0,
        status: "complete",
        displayMode: "collapsed",
      }],
    });
    const renderer = new FeedRenderer(host);
    const element = mount(renderer);
    expect(element.querySelector(".chatobby-feed__blocks > .chatobby-feed__block--thinking")).toBeTruthy();
    host.getFeedStore().dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [{
        type: "summary",
        id: "summary",
        turnId: "turn-1",
        text: "Thought for a moment",
        toolCounts: {},
        isExpanded: false,
        blocks: [{
          type: "thinking",
          id: "reasoning",
          turnId: "turn-1",
          text: "reasoning",
          startIndex: 0,
          endIndex: 0,
          status: "complete",
          displayMode: "collapsed",
        }],
      }, {
        type: "text",
        id: "response",
        turnId: "turn-1",
        text: "ok",
        startIndex: 1,
        endIndex: 1,
        status: "complete",
      }] },
    });
    vi.advanceTimersByTime(500);

    expect(element.querySelectorAll(".chatobby-feed__blocks > .chatobby-feed__block--summary")).toHaveLength(1);
    expect(element.querySelectorAll(".chatobby-feed__blocks > .chatobby-feed__block--thinking")).toHaveLength(0);
    expect(element.querySelectorAll(".chatobby-feed__blocks > .chatobby-feed__block--text")).toHaveLength(1);
  });

  it("does not move stable block mounts during metadata-only renders", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [
        {
          type: "text",
          id: "block-one",
          turnId: "turn-1",
          text: "one",
          startIndex: 0,
          endIndex: 0,
          status: "complete",
        },
        {
          type: "text",
          id: "block-two",
          turnId: "turn-1",
          text: "two",
          startIndex: 1,
          endIndex: 1,
          status: "complete",
        },
      ],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const element = mount(renderer);
    const blocks = element.querySelector(".chatobby-feed__blocks") as HTMLElement;
    const insertBefore = vi.spyOn(blocks, "insertBefore");
    const appendChild = vi.spyOn(blocks, "appendChild");

    host.feedViewActions.setScroll(false, 50);

    expect(insertBefore).not.toHaveBeenCalled();
    expect(appendChild).not.toHaveBeenCalled();
  });

  it("renders a work summary with collapsed tool groups inside the expanded trace", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "summary",
        id: "block-summary",
        turnId: "turn-1",
        startedAt: 0,
        completedAt: 78_000,
        durationMs: 78_000,
        text: "Worked for 1m 18s",
        toolCounts: { read: 2 },
        isExpanded: true,
        blocks: [
          {
            type: "text",
            id: "block-inner-text",
            turnId: "turn-1",
            text: "Need another call.",
            startIndex: 2,
            endIndex: 2,
            status: "complete",
          },
          {
            type: "tools",
            id: "block-inner-tools",
            turnId: "turn-1",
            startIndex: 3,
            endIndex: 4,
            status: "complete",
            isExpanded: false,
            items: [
              { id: "t1", name: "read_file", category: "read", arguments: "{\"path\":\"a.md\"}", semanticKind: "vault.note.read", displayTitle: "read file", status: "succeeded", isExpanded: false },
              { id: "t2", name: "read_file", category: "read", arguments: "{\"path\":\"b.md\"}", semanticKind: "vault.note.read", displayTitle: "read file", status: "succeeded", isExpanded: false },
            ],
          },
        ],
      }],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-turn-summary__text")?.textContent).toBe("Worked for 1m 18s");
    expect(el.querySelector(".chatobby-turn-summary__child--text")?.textContent).toContain("Need another call.");
    const toolGroup = el.querySelector(".chatobby-turn-summary__child--tools");
    expect(toolGroup?.querySelector(".chatobby-turn-summary__tool-text")?.textContent).toBe("read file (2)");
    expect(toolGroup?.classList.contains("is-tool-expanded")).toBe(false);
    (toolGroup?.querySelector(".chatobby-turn-summary__tool-header") as HTMLElement | null)?.click();
    expect(toolGroup?.classList.contains("is-tool-expanded")).toBe(true);
  });

  it("keeps legacy subagent lifecycle blocks in state but not in the feed", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "subagent",
        id: "block-subagent",
        agentId: "agent-1",
        status: "complete",
        activity: {
          agentId: "agent-1",
          type: "Research",
          description: "Map the API surface",
          source: "@gotgenes/pi-subagents",
          status: "completed",
          durationMs: 250,
          tokens: { input: 10, output: 20, total: 30 },
          toolUses: 2,
          resultPreview: "Found the relevant event bus route.",
          compactionCount: 1,
        },
      }],
      subagents: {
        "agent-1": {
          agentId: "agent-1",
          type: "Research",
          description: "Map the API surface",
          source: "@gotgenes/pi-subagents",
          status: "completed",
          durationMs: 250,
          tokens: { input: 10, output: 20, total: 30 },
          toolUses: 2,
          resultPreview: "Found the relevant event bus route.",
          compactionCount: 1,
        },
      },
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-subagent")).toBeNull();
    expect(host.getFeedStore().select(feedSelectors.blockById("block-subagent"))?.type).toBe("subagent");
  });

  it("persists summary, nested tool group, and tool item expansion across rerenders", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "summary",
        id: "block-summary",
        turnId: "turn-1",
        summaryKind: "call",
        text: "Thought for 2s · called 1 tool",
        toolCounts: { read: 1 },
        isExpanded: false,
        blocks: [{
          type: "thinking",
          id: "block-inner-thinking",
          turnId: "turn-1",
          text: "reasoning",
          startIndex: 0,
          endIndex: 0,
          status: "complete",
          displayMode: "collapsed",
          durationMs: 2_000,
        }, {
          type: "tools",
          id: "block-inner-tools",
          turnId: "turn-1",
          startIndex: 1,
          endIndex: 1,
          status: "complete",
          isExpanded: false,
          items: [
            { id: "t1", name: "read_file", category: "read", arguments: "{\"path\":\"a.md\"}", semanticKind: "vault.note.read", displayTitle: "read file", result: "ok", status: "succeeded", isExpanded: false },
          ],
        }],
      }],
      runStartMs: Date.now(),
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);
    (el.querySelector(".chatobby-turn-summary__header") as HTMLElement | null)?.click();
    expect(el.querySelector(".chatobby-turn-summary")?.classList.contains("is-expanded")).toBe(true);

    (el.querySelector(".chatobby-thinking-block__header") as HTMLElement | null)?.click();
    expect(el.querySelector(".chatobby-thinking-block")?.classList.contains("is-collapsed")).toBe(false);

    (el.querySelector(".chatobby-turn-summary__tool-header") as HTMLElement | null)?.click();
    expect(el.querySelector(".chatobby-turn-summary__child--tools")?.classList.contains("is-tool-expanded")).toBe(true);

    (el.querySelector(".chatobby-tool-item__row") as HTMLElement | null)?.click();
    expect(el.querySelector(".chatobby-tool-item")?.classList.contains("is-expanded")).toBe(true);
  });

  it("debounces streaming frontend document projections", () => {
    vi.useFakeTimers();
    const host = createMockFeedHost();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    host.getFeedStore().dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [{
        type: "text",
        id: "streaming-text",
        turnId: "turn-1",
        text: "delayed",
        startIndex: 0,
        endIndex: 0,
        status: "streaming",
      }] },
    });

    expect(el.textContent).not.toContain("delayed");
	vi.advanceTimersByTime(31);
    expect(el.textContent).not.toContain("delayed");
	vi.advanceTimersByTime(1);
    expect(el.textContent).toContain("delayed");
  });

  it("renders thinking blocks as plain text without markdown rendering", () => {
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "thinking",
        id: "block-thinking",
        turnId: "turn-1",
        text: "**plain reasoning**",
        startIndex: 0,
        endIndex: 0,
        status: "streaming",
        displayMode: "expanded",
      }],
    };
    const host = createMockFeedHost(state);
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    expect(el.querySelector(".chatobby-thinking-block__body")?.textContent).toBe("**plain reasoning**");
    expect(host.renderMarkdown).not.toHaveBeenCalled();
  });

  it("renders extension panel actions and routes clicks to the host", () => {
    const action = { id: "memory:insights", label: "Show stored memory", icon: "database" };
    const state: LegacyFeedState = {
      ...INITIAL_LEGACY_FEED_STATE,
      blocks: [{
        type: "extension-panel",
        id: "panel-1",
        panelKind: "screen",
        title: "Memory",
        body: "Memory controls",
        source: "memory-service",
        actions: [action],
        createdAt: Date.now(),
      }],
    };
    const host = createMockFeedHost(state);
    host.onExtensionPanelAction = vi.fn();
    const renderer = new FeedRenderer(host);
    const el = mount(renderer);

    const button = el.querySelector(".chatobby-extension-panel__action") as HTMLButtonElement | null;
    expect(button?.textContent).toContain("Show stored memory");
    button?.click();
    expect(host.onExtensionPanelAction).toHaveBeenCalledWith(action);
  });
});
