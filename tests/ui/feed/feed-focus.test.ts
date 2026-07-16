import { describe, expect, it, vi } from "vitest";
import type { InteractionCard } from "../../../src/ui/feed/interaction-card";
import { FeedRenderer } from "../../../src/ui/feed";
import { createMockFeedHost } from "../helpers/mock-host";
import { mount } from "../helpers/mount";

describe("FeedRenderer composer focus", () => {
  it("does not auto-focus a newly mounted interaction card", () => {
    const renderer = new FeedRenderer(createMockFeedHost());
    mount(renderer);
    const card = {
      render: vi.fn((host: HTMLElement) => host.createEl("button", { text: "Allow" })),
      focus: vi.fn(),
    } as unknown as InteractionCard;

    renderer.mountInteraction(card);

    expect(card.focus).not.toHaveBeenCalled();
  });

  it("keeps the composer focused when feed buttons are clicked", () => {
    const input = document.body.createEl("textarea", { cls: "chatobby-input" });
    input.focus();
    const renderer = new FeedRenderer(createMockFeedHost());
    const element = mount(renderer);
    const suggestion = element.querySelector<HTMLButtonElement>(".chatobby-feed__empty-capabilities button");
    expect(suggestion).not.toBeNull();

    const pointerDown = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    suggestion?.dispatchEvent(pointerDown);

    expect(pointerDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it("does not cancel pointer selection on feed text", () => {
    const input = document.body.createEl("textarea", { cls: "chatobby-input" });
    input.focus();
    const renderer = new FeedRenderer(createMockFeedHost());
    const element = mount(renderer);
    const text = element.querySelector<HTMLElement>(".chatobby-feed__empty-copy");
    expect(text).not.toBeNull();

    const pointerDown = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    text?.dispatchEvent(pointerDown);

    expect(pointerDown.defaultPrevented).toBe(false);
  });
});
