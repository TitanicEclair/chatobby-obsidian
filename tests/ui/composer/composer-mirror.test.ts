import { describe, expect, it, vi } from "vitest";
import { EMPTY_SESSION_STATE, DEFAULT_SESSION_PREFERENCES } from "../../../src/types";
import { Composer, type ComposerHost } from "../../../src/ui/composer/composer";

function createBoundComposer(): {
  composer: Composer;
  highlight: HTMLDivElement;
  input: HTMLTextAreaElement;
} {
  const host: ComposerHost = {
    send: vi.fn(),
    steer: vi.fn(),
    abort: vi.fn(),
    canAbort: () => true,
    getSessionState: () => ({ ...EMPTY_SESSION_STATE }),
    getSessionPreferences: () => DEFAULT_SESSION_PREFERENCES,
  };
  const composer = new Composer(host);
  const card = document.createElement("div");
  card.className = "chatobby-composer-card";
  const inputWrap = document.createElement("div");
  inputWrap.className = "chatobby-input-wrap";
  const highlight = document.createElement("div");
  const input = document.createElement("textarea");
  const controls = document.createElement("div");
  controls.className = "chatobby-composer-controls-host";
  const actions = document.createElement("div");
  actions.className = "chatobby-composer-actions";
  const send = document.createElement("button");
  send.className = "chatobby-send-btn";
  const stop = document.createElement("button");
  stop.className = "chatobby-stop-btn is-hidden";

  inputWrap.append(highlight, input);
  actions.append(send, stop);
  card.append(inputWrap, controls, actions);
  composer.bind(input, send, stop, highlight);
  return { composer, highlight, input };
}

describe("composer text mirror", () => {
  it("retains the textarea's final visual line after a trailing newline", () => {
    const { composer, highlight, input } = createBoundComposer();
    input.value = "first line\n";
    composer.handleInput();

    expect(highlight.textContent).toBe("first line\n ");
    composer.destroy();
  });

  it("tracks native textarea scroll movement", () => {
    const { composer, highlight, input } = createBoundComposer();
    input.scrollTop = 96;
    input.scrollLeft = 18;
    input.dispatchEvent(new Event("scroll"));

    expect(highlight.scrollTop).toBe(96);
    expect(highlight.scrollLeft).toBe(18);
    composer.destroy();
  });
});
