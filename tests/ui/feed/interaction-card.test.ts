import { describe, expect, it } from "vitest";
import { createInteractionState } from "../../../src/types";
import { SelectCard } from "../../../src/ui/feed/select-card";
import { ConfirmCard } from "../../../src/ui/feed/confirm-card";
import { InputCard } from "../../../src/ui/feed/input-card";
import { EditorCard } from "../../../src/ui/feed/editor-card";
import { createMockInteractionHost } from "../helpers/mock-host";
import { mount } from "../helpers/mount";

describe("interaction cards", () => {
  it("renders select options and responds with a selection", () => {
    const host = createMockInteractionHost();
    const card = new SelectCard(host);
    const el = mount(card);
    card.setState(createInteractionState("ui_1", "select", { options: ["a", "b"] }));
    card.setOptions(["a", "b"]);
    expect(el.querySelector(".chatobby-select-card__options")).toBeTruthy();
    expect(el.querySelectorAll(".chatobby-select-card__option")).toHaveLength(2);
    expect(el.querySelector(".chatobby-select-card__option-key")?.textContent).toBe("1");
    expect(el.querySelector(".chatobby-select-card__option-label")?.textContent).toBe("a");
    card.select();
    expect(host.respond).toHaveBeenCalledWith("ui_1", "a");
  });

  it("moves select options with arrow keys and number shortcuts", () => {
    const host = createMockInteractionHost();
    const card = new SelectCard(host);
    const el = mount(card);
    card.setState(createInteractionState("ui_keys", "select", { options: ["first", "second", "third"] }));

    expect(el.querySelector(".chatobby-select-card__option.is-selected")?.textContent).toContain("first");
    expect(card.handleKeydown(new KeyboardEvent("keydown", { key: "ArrowDown" }))).toBe(true);
    expect(el.querySelector(".chatobby-select-card__option.is-selected")?.textContent).toContain("second");
    expect(card.handleKeydown(new KeyboardEvent("keydown", { key: "3" }))).toBe(true);
    expect(host.respond).toHaveBeenCalledWith("ui_keys", "third");
  });

  it("renders confirm actions and responds", () => {
    const host = createMockInteractionHost();
    const card = new ConfirmCard(host);
    const el = mount(card);
    card.setState(createInteractionState("ui_2", "confirm", {}));
    expect(el.querySelector(".chatobby-confirm-card__confirm")).toBeTruthy();
    expect(el.querySelector(".chatobby-confirm-card__confirm")?.textContent).toContain("Y / Enter");
    expect(el.querySelector(".chatobby-confirm-card__deny")?.textContent).toContain("N / Esc");
    card.confirm();
    expect(host.respond).toHaveBeenCalledWith("ui_2", true);
  });

  it("renders input and responds with text", () => {
    const host = createMockInteractionHost();
    const card = new InputCard(host);
    const el = mount(card);
    card.setState(createInteractionState("ui_3", "input", { prefill: "seed" }));
    const input = el.querySelector(".chatobby-input-card__input");
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (input instanceof HTMLInputElement) input.value = "typed";
    card.submit();
    expect(host.respond).toHaveBeenCalledWith("ui_3", "typed");
  });

  it("renders editor and responds with text", () => {
    const host = createMockInteractionHost();
    const card = new EditorCard(host);
    const el = mount(card);
    card.setState(createInteractionState("ui_4", "editor", { prefill: "draft" }));
    const textarea = el.querySelector(".chatobby-editor-card__textarea");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    if (textarea instanceof HTMLTextAreaElement) textarea.value = "edited";
    card.submit();
    expect(host.respond).toHaveBeenCalledWith("ui_4", "edited");
  });
});
