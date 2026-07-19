import { describe, expect, it, vi } from "vitest";
import { EMPTY_SESSION_STATE, DEFAULT_SESSION_PREFERENCES, type SessionState } from "../../src/types";
import { Composer, type ComposerHost } from "../../src/ui/composer/composer";
import type { SlashArgumentOption, SlashCommandSpec, SlashParsedCommand, SlashSubmitPlan } from "../../src/ui/composer/slash-command";
import { fixedWhitespaceArgs, noArgs } from "../../src/ui/composer/slash-parsers";

function createHost(overrides: Partial<ComposerHost> = {}): ComposerHost {
  return {
    send: vi.fn(),
    steer: vi.fn(),
    abort: vi.fn(),
    canAbort: () => true,
    getSessionState: () => ({ ...EMPTY_SESSION_STATE }),
    getSessionPreferences: () => DEFAULT_SESSION_PREFERENCES,
    ...overrides,
  };
}

function bindComposer(host: ComposerHost): {
  composer: Composer;
  input: HTMLTextAreaElement;
  highlight: HTMLElement;
  card: HTMLElement;
  sendBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
} {
  const composer = new Composer(host);
  const input = document.createElement("textarea");
  const highlight = document.createElement("div");
  const sendBtn = document.createElement("button");
  const stopBtn = document.createElement("button");

  sendBtn.addClass("chatobby-send-btn");
  stopBtn.addClass("chatobby-stop-btn");
  stopBtn.addClass("is-hidden");

  const card = document.createElement("div");
  card.addClass("chatobby-composer-card");
  const inputWrap = card.createDiv({ cls: "chatobby-input-wrap" });
  inputWrap.append(highlight, input);
  card.append(sendBtn, stopBtn);

  composer.bind(input, sendBtn, stopBtn, highlight);
  return { composer, input, highlight, card, sendBtn, stopBtn };
}

function command(name: string, overrides: Partial<SlashCommandSpec> = {}): SlashCommandSpec {
  return {
    name,
    source: "local",
    argParser: noArgs(),
    surroundingTextPolicy: "allow",
    executionKind: "local",
    ...overrides,
  };
}

describe("Composer", () => {
  it("shows send (disabled, empty) and hides stop when idle with no text", () => {
    const { sendBtn, stopBtn } = bindComposer(createHost());
    expect(sendBtn.classList.contains("is-hidden")).toBe(false);
    expect(sendBtn.disabled).toBe(true); // nothing to send
    expect(stopBtn.classList.contains("is-hidden")).toBe(true); // stop only mid-turn
  });

  it("enables send once text is typed", () => {
    const { composer, input, sendBtn } = bindComposer(createHost());
    input.value = "hello";
    composer.handleInput();
    expect(sendBtn.disabled).toBe(false);
  });

  it("opens a native file picker from a compact attachment action", () => {
    const { card, sendBtn } = bindComposer(createHost({ storeFiles: vi.fn(async () => []) }));
    const attachBtn = card.querySelector<HTMLButtonElement>(".chatobby-attach-btn");
    const fileInput = card.querySelector<HTMLInputElement>(".chatobby-attachment-input");
    expect(attachBtn?.getAttribute("aria-label")).toBe("Attach files");
    expect(attachBtn?.nextElementSibling).toBe(sendBtn);
    expect(fileInput?.multiple).toBe(true);
    expect(fileInput?.accept).toContain(".pdf");
    expect(fileInput?.accept).toContain(".docx");
    expect(fileInput?.accept).toContain(".png");
    expect(fileInput?.accept).toContain(".webp");
    expect(fileInput?.accept).not.toContain(".doc,");

    if (!fileInput || !attachBtn) throw new Error("Attachment controls were not rendered");
    const openPicker = vi.spyOn(fileInput, "click").mockImplementation(() => undefined);
    attachBtn.click();
    expect(openPicker).toHaveBeenCalledTimes(1);
  });

  it("renders selected documents as compact, truncation-safe attachment rows", async () => {
    const attachmentName = "quarterly-forecast-with-a-very-long-descriptive-name.pdf";
    const storeFiles = vi.fn(async () => [{
      id: "attachment-1",
      name: attachmentName,
      prompt: {
        type: "file_ref" as const,
        path: "C:/vault/.chatobby/attachments/quarterly.pdf",
        name: attachmentName,
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
      delivery: "document" as const,
      mimeType: "application/pdf",
      sizeBytes: 2048,
      localPath: "C:/vault/.chatobby/attachments/quarterly.pdf",
    }]);
    const { card, sendBtn } = bindComposer(createHost({ storeFiles }));
    const fileInput = card.querySelector<HTMLInputElement>(".chatobby-attachment-input");
    if (!fileInput) throw new Error("Attachment input was not rendered");
    const file = new File(["test"], attachmentName, { type: "application/pdf" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event("change"));

    await vi.waitFor(() => expect(storeFiles).toHaveBeenCalledWith([file]));
    const name = card.querySelector<HTMLElement>(".chatobby-attachment-chip__name");
    expect(name?.textContent).toBe(attachmentName);
    expect(name?.getAttribute("title")).toBe(attachmentName);
    expect(card.querySelector(".chatobby-attachment-chip__meta")?.textContent).toBe("PDF · 2.0 KB");
    expect(card.querySelector<HTMLElement>(".chatobby-attachment-chip__icon")?.dataset.icon).toBe("file-text");
    expect(sendBtn.disabled).toBe(false);
  });

  it("enforces the eight-attachment composer limit before storage", async () => {
    const storeFiles = vi.fn(async () => []);
    const { card } = bindComposer(createHost({ storeFiles }));
    const fileInput = card.querySelector<HTMLInputElement>(".chatobby-attachment-input");
    if (!fileInput) throw new Error("Attachment input was not rendered");
    const files = Array.from({ length: 9 }, (_, index) => new File([String(index)], `file-${index}.txt`, { type: "text/plain" }));
    Object.defineProperty(fileInput, "files", { configurable: true, value: files });
    fileInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    expect(storeFiles).not.toHaveBeenCalled();
  });

  it("morphs to stop while a prompt is in flight, then back to send", async () => {
    let resolveSend: (() => void) | null = null;
    const send = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const { composer, input, sendBtn, stopBtn } = bindComposer(createHost({ send }));

    input.value = "hello";
    composer.handleInput();
    composer.send();

    expect(input.value).toBe("hello");
    expect(sendBtn.classList.contains("is-hidden")).toBe(true);
    expect(stopBtn.classList.contains("is-hidden")).toBe(false);

    resolveSend?.();
    await Promise.resolve();

    expect(input.value).toBe("");
    expect(stopBtn.classList.contains("is-hidden")).toBe(false);

    composer.setStreaming(false);
    expect(sendBtn.classList.contains("is-hidden")).toBe(false);
  });

  it("retains the editable draft when runtime preparation or prompt start fails", async () => {
    const send = vi.fn(async () => {
      throw new Error("runtime unavailable");
    });
    const { composer, input, sendBtn } = bindComposer(createHost({ send }));
    input.value = "keep this draft";
    composer.handleInput();

    composer.send();
    await Promise.resolve();
    await Promise.resolve();

    expect(input.value).toBe("keep this draft");
    expect(composer.text).toBe("keep this draft");
    expect(sendBtn.classList.contains("is-hidden")).toBe(false);
  });

  it("submits a pending draft exactly once and lets cancel preserve it", async () => {
    let signal: AbortSignal | undefined;
    const pending = new Promise<void>(() => {});
    const send = vi.fn((_message: string, _attachments: undefined, pendingSignal?: AbortSignal) => {
      signal = pendingSignal;
      return pending;
    });
    const { composer, input } = bindComposer(createHost({ send }));
    input.value = "one send";
    composer.handleInput();

    composer.send();
    composer.send();
    composer.stop();

    expect(send).toHaveBeenCalledOnce();
    expect(signal?.aborted).toBe(true);
    expect(input.value).toBe("one send");
  });

  it("Escape requires a second press before stopping a running turn", () => {
    const abort = vi.fn();
    const streaming: SessionState = { ...EMPTY_SESSION_STATE, isStreaming: true };
    const { composer, stopBtn } = bindComposer(createHost({ abort, getSessionState: () => streaming }));

    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(abort).not.toHaveBeenCalled();
    expect(stopBtn.textContent).toBe("Esc");

    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(abort).toHaveBeenCalledTimes(1);
  });

  it("Shift+Tab moves focus from composer to feed", () => {
    const focusFeed = vi.fn();
    const { composer } = bindComposer(createHost({ focusFeed }));
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true });

    composer.handleKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(focusFeed).toHaveBeenCalledTimes(1);
  });

  it("recalls the previous prompt only when the cursor is at the first character", () => {
    const { composer, input } = bindComposer(createHost({ getPromptHistory: () => ["first prompt", "second prompt"] }));
    input.value = "current draft";
    input.setSelectionRange(3, 3);
    composer.handleInput();

    composer.handleKeydown(new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true }));
    expect(input.value).toBe("current draft");

    input.setSelectionRange(0, 0);
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true }));
    expect(input.value).toBe("second prompt");
    expect(input.selectionStart).toBe(0);

    composer.handleKeydown(new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true }));
    expect(input.value).toBe("first prompt");
  });

  it("uses the configured previous-message shortcut instead of a hardcoded key", () => {
    const { composer, input } = bindComposer(createHost({
      getPromptHistory: () => ["remember me"],
      getComposerKeybindings: () => ({ previousMessage: "Mod+P", stashDraft: "Mod+S", cancelTurn: "Escape" }),
    }));
    input.setSelectionRange(0, 0);

    composer.handleKeydown(new KeyboardEvent("keydown", { key: "ArrowUp", cancelable: true }));
    expect(input.value).toBe("");
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "p", ctrlKey: true, cancelable: true }));
    expect(input.value).toBe("remember me");
  });

  it("stashes a draft and restores it after the next successful submission", () => {
    const send = vi.fn();
    const { composer, input } = bindComposer(createHost({ send }));
    input.value = "return to this later";
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }));
    expect(input.value).toBe("");

    input.value = "send this first";
    composer.handleInput();
    composer.send();

    expect(send).toHaveBeenCalledWith("send this first", undefined, expect.any(AbortSignal));
    expect(input.value).toBe("return to this later");
  });

  it("captures the stash shortcut before Obsidian handles its global hotkey", () => {
    const { composer, input } = bindComposer(createHost());
    input.value = "capture this draft";
    composer.handleInput();
    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      cancelable: true,
    });
    Object.defineProperty(event, "target", { value: input });

    expect(composer.handleCapturedKeydown(event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe("");
    expect(composer.handleCapturedKeydown(event)).toBe(false);
  });

  it("restores a just-submitted message when cancellation happens before output", () => {
    const abort = vi.fn();
    const { composer, input } = bindComposer(createHost({ abort, getTurnOutputMarker: () => "unchanged" }));
    input.value = "restore this request";
    composer.handleInput();
    composer.send();
    expect(input.value).toBe("");

    composer.stop();

    expect(abort).toHaveBeenCalledOnce();
    expect(input.value).toBe("restore this request");
  });

  it("does not restore a submitted message after visible turn output begins", () => {
    const abort = vi.fn();
    let marker = "before";
    const { composer, input } = bindComposer(createHost({ abort, getTurnOutputMarker: () => marker }));
    input.value = "do not restore after output";
    composer.handleInput();
    composer.send();
    marker = "after";
    composer.observeTurnProgress();

    composer.stop();

    expect(abort).toHaveBeenCalledOnce();
    expect(input.value).toBe("");
  });

  it("Escape clears the draft when idle and there is text (no abort)", () => {
    const abort = vi.fn();
    const { composer, input } = bindComposer(createHost({ abort }));

    input.value = "draft";
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(input.value).toBe("");
    expect(abort).not.toHaveBeenCalled();
  });

  it("Escape does nothing when idle and empty", () => {
    const abort = vi.fn();
    const { composer } = bindComposer(createHost({ abort }));

    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(abort).not.toHaveBeenCalled();
  });

  it("Enter steers (not sends) while a turn is running", () => {
    const send = vi.fn();
    const steer = vi.fn();
    const streaming: SessionState = { ...EMPTY_SESSION_STATE, isStreaming: true };
    const { composer, input } = bindComposer(createHost({ send, steer, getSessionState: () => streaming }));

    input.value = "correction";
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(steer).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

	it("hides send and shows stop while the session is streaming", () => {
    const streamingState: SessionState = { ...EMPTY_SESSION_STATE, isStreaming: true };
    const { sendBtn, stopBtn } = bindComposer(createHost({ getSessionState: () => streamingState }));

    expect(sendBtn.classList.contains("is-hidden")).toBe(true);
		expect(stopBtn.classList.contains("is-hidden")).toBe(false);
	});

	it("disables Stop with an accessible progress state until streaming ends", () => {
		const streamingState: SessionState = { ...EMPTY_SESSION_STATE, isStreaming: true };
		const { composer, stopBtn } = bindComposer(createHost({ getSessionState: () => streamingState }));

		composer.setStopping(true);
		expect(stopBtn.disabled).toBe(true);
		expect(stopBtn.classList.contains("is-stopping")).toBe(true);
		expect(stopBtn.getAttribute("aria-label")).toBe("Stopping current turn");

		composer.setStreaming(false);
		expect(stopBtn.classList.contains("is-stopping")).toBe(false);
	});

  it("opens slash suggestions for a cursor-local slash token", () => {
    const setSlashMatches = vi.fn();
    const { composer, input } = bindComposer(createHost({
      getSlashCommands: () => [command("reload"), command("new")],
      setSlashMatches,
    }));

    input.value = "before /re after";
    input.setSelectionRange("before /re".length, "before /re".length);
    composer.handleInput();

    expect(setSlashMatches).toHaveBeenCalledWith([expect.objectContaining({ name: "reload" })]);
  });

  it("opens slash suggestions when the draft is exactly slash", () => {
    const setSlashMatches = vi.fn();
    const { composer, input } = bindComposer(createHost({
      getSlashCommands: () => [command("reload"), command("new")],
      setSlashMatches,
    }));

    input.value = "/";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();

    expect(setSlashMatches).toHaveBeenCalledWith([
      expect.objectContaining({ name: "new" }),
      expect.objectContaining({ name: "reload" }),
    ]);
  });

  it("autocompletes the selected slash command and marks it active", () => {
    const reload = command("reload");
    const { composer, input, highlight } = bindComposer(createHost({
      getSlashCommands: () => [reload],
      setSlashMatches: vi.fn(),
      isSlashOpen: () => true,
      currentSlashCommand: () => reload,
      closeSlash: vi.fn(),
    }));

    input.value = "before /re";
    input.setSelectionRange("before /re".length, "before /re".length);
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Tab" }));

    expect(input.value).toBe("before /reload ");
    expect(highlight.querySelector(".chatobby-input-highlight__command")?.textContent).toBe("/reload");
  });

  it("shows a compact activation chip for a selected skill", () => {
    const skill = command("skill:study-notes", { source: "skill", executionKind: "dynamic" });
    const { composer, input, card } = bindComposer(createHost({
      getSlashCommands: () => [skill],
      setSlashMatches: vi.fn(),
      isSlashOpen: () => true,
      currentSlashCommand: () => skill,
      closeSlash: vi.fn(),
    }));

    input.value = "/skill:study";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Tab" }));

    const chip = card.querySelector(".chatobby-activation-chip--skill");
    expect(chip?.querySelector(".chatobby-activation-chip__label")?.textContent).toBe("study-notes");
    expect(chip?.getAttribute("aria-label")).toBe("Skill skill:study-notes");
  });

  it("activates a full command when space is pressed, then submits a slash plan", () => {
    let submitted: SlashSubmitPlan | null = null;
    const submitSlashPlan = vi.fn((plan: SlashSubmitPlan) => {
      submitted = plan;
    });
    const { composer, input } = bindComposer(createHost({
      getSlashCommands: () => [command("reload")],
      submitSlashPlan,
    }));

    input.value = "/reload";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: " " }));
    input.value = "/reload ";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.send();

    expect(submitSlashPlan).toHaveBeenCalledTimes(1);
    expect(submitted?.commands[0]?.spec.name).toBe("reload");
  });

  it("submits an exact hidden alias as a command without requiring autocomplete or a trailing space", () => {
    const send = vi.fn();
    const submitSlashPlan = vi.fn();
    const retired = command("memory-insights", { showInMenu: false, surroundingTextPolicy: "forbid" });
    const { composer, input } = bindComposer(createHost({
      send,
      getSlashCommands: () => [retired],
      submitSlashPlan,
    }));

    input.value = "/memory-insights";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.send();

    expect(submitSlashPlan).toHaveBeenCalledTimes(1);
    expect(submitSlashPlan.mock.calls[0]?.[0].commands[0]?.spec).toBe(retired);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not activate an invalid command when space is pressed", () => {
    const send = vi.fn();
    const submitSlashPlan = vi.fn();
    const { composer, input } = bindComposer(createHost({
      send,
      getSlashCommands: () => [command("reload")],
      submitSlashPlan,
    }));

    input.value = "/rod";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: " " }));
    input.value = "/rod ";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.send();

    expect(submitSlashPlan).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith("/rod", undefined, expect.any(AbortSignal));
  });

  it("escape cancels command recognition until delete-then-type re-enables it", () => {
    const submitSlashPlan = vi.fn();
    const { composer, input } = bindComposer(createHost({
      getSlashCommands: () => [command("reload")],
      submitSlashPlan,
      setSlashMatches: vi.fn(),
      closeSlash: vi.fn(),
    }));

    input.value = "/reload";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }));
    composer.handleKeydown(new KeyboardEvent("keydown", { key: " " }));
    input.value = "/reload ";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.send();
    expect(submitSlashPlan).not.toHaveBeenCalled();

    input.value = "/reloa";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    input.value = "/reload";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: " " }));
    input.value = "/reload ";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.send();

    expect(submitSlashPlan).toHaveBeenCalledTimes(1);
  });

  it("opens argument options on first submit and inserts the selected option before final submit", () => {
    const options: SlashArgumentOption[] = [
      { value: "gpt-5", label: "OpenAI: GPT-5" },
      { value: "claude-sonnet", label: "Anthropic: Claude Sonnet" },
    ];
    const setSlashArgumentOptions = vi.fn();
    let selected = options[0] ?? null;
    const submitSlashPlan = vi.fn();
    const setModel = command("set-model", {
      argParser: fixedWhitespaceArgs(1),
      argumentOptions: (_command: SlashParsedCommand) => options,
    });
    const { composer, input } = bindComposer(createHost({
      getSlashCommands: () => [setModel],
      setSlashArgumentOptions,
      isSlashOpen: () => setSlashArgumentOptions.mock.calls.length > 0,
      currentSlashArgumentOption: () => selected,
      closeSlash: vi.fn(),
      submitSlashPlan,
    }));

    input.value = "/set-model";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();
    composer.handleKeydown(new KeyboardEvent("keydown", { key: " " }));
    input.value = "/set-model ";
    input.setSelectionRange(input.value.length, input.value.length);
    composer.handleInput();

    composer.send();

    expect(setSlashArgumentOptions).toHaveBeenCalledWith(options);
    expect(input.value).toBe("/set-model ");
    expect(submitSlashPlan).not.toHaveBeenCalled();

    selected = options[1] ?? null;
    composer.handleKeydown(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(input.value).toBe("/set-model claude-sonnet");

    composer.send();

    expect(submitSlashPlan).toHaveBeenCalledTimes(1);
    expect(submitSlashPlan.mock.calls[0]?.[0].commands[0]?.args).toEqual(["claude-sonnet"]);
  });
});
