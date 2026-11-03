import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SESSION_PREFERENCES, EMPTY_SESSION_STATE, type ComposerAttachment } from "../../../src/types";
import { Composer, type ComposerHost, type PromptSubmissionOutcome } from "../../../src/ui/composer/composer";
import { noArgs } from "../../../src/ui/composer/slash-parsers";
import { buildComposerShell } from "../../../src/ui/shell/view-shell";

/** @see docs/api/composer.md — draft/submission ownership and the deferred issue-59 teardown limit. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function attachment(id: string): ComposerAttachment {
  return { id, name: `${id}.png`, delivery: "image", previewUrl: `blob:composer-test-${id}`,
    prompt: { type: "file_ref", path: `C:/synthetic/${id}.png`, name: `${id}.png`, mimeType: "image/png", sizeBytes: 1 } };
}
const composers: Composer[] = [];
function scene(overrides: Partial<ComposerHost> = {}) {
  const host: ComposerHost = { send: vi.fn(), steer: vi.fn(), abort: vi.fn(), canAbort: () => true,
    getSessionState: () => ({ ...EMPTY_SESSION_STATE }), getSessionPreferences: () => DEFAULT_SESSION_PREFERENCES,
    ...overrides };
  const composer = new Composer(host); composers.push(composer);
  return { host, composer, ...bind(composer) };
}
function bind(composer: Composer) {
  const container = document.body.createDiv();
  const shell = buildComposerShell(container, "Submission lifecycle fixture");
  composer.bind(shell.inputEl, shell.sendBtn, shell.stopBtn, shell.inputHighlightEl);
  const type = (text: string) => {
    shell.inputEl.value = text; shell.inputEl.setSelectionRange(text.length, text.length); composer.handleInput();
  };
  const pick = (name: string) => {
    const picker = container.querySelector<HTMLInputElement>(".chatobby-attachment-input");
    if (!picker) throw Error("Missing file picker");
    Object.defineProperty(picker, "files", { configurable: true, value: [new File(["x"], `${name}.png`)] });
    picker.dispatchEvent(new Event("change"));
  };
  const names = () => Array.from(container.querySelectorAll(".chatobby-attachment-chip__name"), node => node.textContent);
  return { container, input: shell.inputEl, send: shell.sendBtn, stop: shell.stopBtn, type, pick, names };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
afterEach(() => {
  for (const composer of composers.splice(0)) composer.destroy();
  vi.restoreAllMocks(); document.body.empty();
});

describe("Composer draft and submission ownership", () => {
  it.each(["resolve", "reject"] as const)("preserves a newer draft and files when a pending send %ss", async outcome => {
    const pending = deferred<void>();
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let marker = "before";
    const s = scene({ send: vi.fn(() => pending.promise), getTurnOutputMarker: () => marker,
      storeFiles: async () => [attachment("newer")] });
    s.type("original"); s.composer.send();
    expect(s.input.value).toBe("");
    s.type("newer"); s.pick("newer"); await settle();
    s.composer.send();
    expect(s.host.send).toHaveBeenCalledOnce();
    if (outcome === "resolve") pending.resolve(); else pending.reject(Error("synthetic failure"));
    await settle();
    expect(s.input.value).toBe("newer"); expect(s.names()).toEqual(["newer.png"]);
    expect(error).toHaveBeenCalledTimes(outcome === "reject" ? 1 : 0);
    marker = "completed output"; s.composer.observeTurnProgress();
    expect(revoke).not.toHaveBeenCalled();
    s.composer.setStreaming(false); s.composer.clear();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:composer-test-newer");
  });

  it.each([false, true])("handles an unretractable pending acceptance with newer text=%s", async newer => {
    const pending = deferred<PromptSubmissionOutcome>();
    const send = vi.fn<ComposerHost["send"]>(() => pending.promise);
    const s = scene({ send }); s.type("original"); s.composer.send();
    s.composer.stop();
    expect(send.mock.calls[0]?.[2]?.aborted).toBe(true);
    expect(s.input.value).toBe("original");
    if (newer) s.type("newer");
    pending.resolve({ retracted: false, retractionReason: "output-started" }); await settle();
    expect(s.input.value).toBe(newer ? "newer" : "");
    expect(s.host.abort).not.toHaveBeenCalled();
    s.composer.setStreaming(false); s.input.setSelectionRange(0, 0);
    expect(s.composer.recallPrevious()).toBe(true); expect(s.input.value).toBe("original");
  });

  it("retracts the exact accepted submission and stashes a newer draft without revoking transferred URLs", async () => {
    const pending = deferred<{ retracted: boolean }>();
    const retractPrompt = vi.fn<NonNullable<ComposerHost["retractPrompt"]>>(() => pending.promise);
    const send = vi.fn<ComposerHost["send"]>();
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const s = scene({ send, retractPrompt, storeFiles: async files => files.map(file => attachment(file.name.replace(".png", ""))) });
    s.type("original"); s.pick("original"); await settle(); s.composer.send();
    s.composer.stop();
    const submissionId = send.mock.calls[0]?.[3]; expect(submissionId).toEqual(expect.any(String));
    expect(retractPrompt).toHaveBeenCalledExactlyOnceWith(submissionId, "original");
    s.type("newer"); s.pick("newer"); await settle();
    pending.resolve({ retracted: true }); await settle();
    expect(s.input.value).toBe("original"); expect(s.names()).toEqual(["original.png"]);
    expect(revoke).not.toHaveBeenCalled();
    s.composer.clear();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:composer-test-original");
    s.composer.restoreStash();
    expect(s.input.value).toBe("newer"); expect(s.names()).toEqual(["newer.png"]);
    s.container.querySelector<HTMLButtonElement>('[aria-label="Remove newer.png"]')?.click();
    expect(s.names()).toEqual([]);
    expect(revoke.mock.calls.map(call => call[0])).toEqual(["blob:composer-test-original", "blob:composer-test-newer"]);
    expect(s.host.abort).not.toHaveBeenCalled();
  });

  it.each(["output-started", "not-found", "reject"] as const)("promotes the original on retraction %s without overwriting a newer draft", async result => {
    const pending = deferred<{ retracted: boolean; reason?: "output-started" | "not-found" }>();
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const s = scene({ retractPrompt: () => pending.promise, storeFiles: async () => [attachment("original")] });
    s.type("original"); s.pick("original"); await settle(); s.composer.send(); s.composer.stop();
    s.type("newer");
    if (result === "reject") pending.reject(Error("synthetic retraction failure"));
    else pending.resolve({ retracted: false, reason: result });
    await settle();
    expect(s.input.value).toBe("newer");
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:composer-test-original");
    expect(s.host.abort).toHaveBeenCalledTimes(result === "output-started" ? 0 : 1);
    s.composer.setStreaming(false); s.input.setSelectionRange(0, 0);
    expect(s.composer.recallPrevious()).toBe(true); expect(s.input.value).toBe("original");
  });

  // Preservation characterizations: reference-search retirement is stronger than
  // general Composer callbacks today. These are issue-59 limits, not desired API guarantees.
  it("currently restores a rejected pending send into a replacement binding after destroy", async () => {
    const pending = deferred<void>(); vi.spyOn(console, "error").mockImplementation(() => {});
    const s = scene({ send: () => pending.promise }); s.type("original"); s.composer.send();
    s.composer.destroy(); const replacement = bind(s.composer);
    pending.reject(Error("late failure")); await settle();
    expect(s.input.value).toBe(""); expect(replacement.input.value).toBe("original");
    expect(s.composer.text).toBe("original"); expect(replacement.send.disabled).toBe(false);
  });

  it("currently appends late stored files to the replacement binding and retains the old picker listener", async () => {
    const pending = deferred<ComposerAttachment[]>();
    const storeFiles = vi.fn<NonNullable<ComposerHost["storeFiles"]>>()
      .mockReturnValueOnce(pending.promise).mockResolvedValue([attachment("second")]);
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const s = scene({ storeFiles }); s.pick("late"); s.composer.destroy();
    const replacement = bind(s.composer); replacement.type("newer");
    pending.resolve([attachment("late")]); await settle();
    expect(s.names()).toEqual([]); expect(replacement.names()).toEqual(["late.png"]);
    // The old change listener reads this instance's current picker, not its old element.
    const currentPicker = replacement.container.querySelector<HTMLInputElement>(".chatobby-attachment-input");
    if (!currentPicker) throw Error("Missing replacement picker");
    const second = new File(["x"], "second.png");
    Object.defineProperty(currentPicker, "files", { configurable: true, value: [second] });
    s.pick("ignored-old-picker"); await settle();
    expect(storeFiles).toHaveBeenLastCalledWith([second]);
    expect(replacement.names()).toEqual(["late.png", "second.png"]);
    expect(replacement.input.value).toBe("newer"); expect(revoke).not.toHaveBeenCalled();
    s.composer.clear(); expect(revoke.mock.calls.map(call => call[0])).toEqual(["blob:composer-test-late", "blob:composer-test-second"]);
  });

  it.each([false, true])("acknowledges a deferred slash command once with newer draft=%s", async newer => {
    const pending = deferred<void>(); let accept: (() => void) | undefined;
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const s = scene({ storeFiles: async () => [attachment("slash")],
      getSlashCommands: () => [{ name: "reload", source: "local", argParser: noArgs(), surroundingTextPolicy: "allow", executionKind: "local" }],
      submitSlashPlan: (_plan, onAccepted) => { accept = onAccepted; return pending.promise; } });
    s.type("/reload"); s.pick("slash"); await settle(); s.composer.send();
    expect(s.input.value).toBe("/reload"); expect(s.names()).toEqual(["slash.png"]);
    if (newer) s.type("newer");
    if (!accept) throw Error("Missing acceptance callback"); accept(); accept();
    expect(s.input.value).toBe(newer ? "newer" : "");
    expect(revoke).toHaveBeenCalledTimes(newer ? 0 : 1);
    pending.resolve(); await settle(); expect(s.host.send).not.toHaveBeenCalled();
    if (newer) s.composer.clear();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:composer-test-slash");
  });

  it("releases only a replaced stash and transfers the restored stash back to the current draft", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const s = scene({ storeFiles: async files => files.map(file => attachment(file.name.replace(".png", ""))) });
    s.type("first"); s.pick("first"); await settle(); s.composer.stashDraft();
    expect(revoke).not.toHaveBeenCalled();
    s.type("second"); s.pick("second"); await settle(); s.composer.stashDraft();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:composer-test-first");
    s.composer.restoreStash(); expect(s.input.value).toBe("second"); expect(s.names()).toEqual(["second.png"]);
    s.composer.clear();
    expect(revoke.mock.calls.map(call => call[0])).toEqual(["blob:composer-test-first", "blob:composer-test-second"]);
  });
});
