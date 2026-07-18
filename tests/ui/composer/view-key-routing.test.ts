import { describe, expect, it, vi } from "vitest";
import { routePrintableKeyToComposer } from "../../../src/ui/composer/view-key-routing";

describe("routePrintableKeyToComposer", () => {
  it("moves ordinary feed typing into the composer at its caret", () => {
    const feed = document.body.createDiv();
    const composer = document.body.createEl("textarea");
    composer.value = "helo";
    composer.setSelectionRange(3, 3);
    const onInput = vi.fn();
    composer.addEventListener("input", onInput);
    const event = new KeyboardEvent("keydown", { key: "l", bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { configurable: true, value: feed });

    expect(routePrintableKeyToComposer(event, composer)).toBe(true);
    expect(composer.value).toBe("hello");
    expect(document.activeElement).toBe(composer);
    expect(event.defaultPrevented).toBe(true);
    expect(onInput).toHaveBeenCalledOnce();
  });

  it("does not steal text-entry, copy shortcuts, navigation, or button Space", () => {
    const composer = document.body.createEl("textarea");
    const otherInput = document.body.createEl("input");
    const button = document.body.createEl("button");
    const cases: Array<[KeyboardEvent, EventTarget]> = [
      [new KeyboardEvent("keydown", { key: "x", bubbles: true, cancelable: true }), otherInput],
      [new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true, cancelable: true }), document.body],
      [new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }), document.body],
      [new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }), button],
    ];

    for (const [event, target] of cases) {
      Object.defineProperty(event, "target", { configurable: true, value: target });
      expect(routePrintableKeyToComposer(event, composer)).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    }
  });
});
