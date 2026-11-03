import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer, type ComposerHost } from "../../../src/ui/composer/composer";
import type { ComposerVaultReference } from "../../../src/ui/composer/references/search";
import { buildComposerShell } from "../../../src/ui/shell/view-shell";
import { DEFAULT_SESSION_PREFERENCES, EMPTY_SESSION_STATE } from "../../../src/types";

/** @see docs/api/composer.md — reference presentation belongs to one bound surface. */
const reference = (name: string): ComposerVaultReference => ({
  id: `vault:${name}.md`, kind: "file", label: `${name}.md`, path: `${name}.md`,
  promptPath: `${name}.md`, scope: "vault", vaultRelativePath: `${name}.md`,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const composers: Composer[] = [];
function scene(search: ComposerHost["searchVaultReferences"]) {
  const host: ComposerHost = { send: vi.fn(), steer: vi.fn(), abort: vi.fn(), canAbort: () => true,
    getSessionState: () => ({ ...EMPTY_SESSION_STATE }), getSessionPreferences: () => DEFAULT_SESSION_PREFERENCES,
    searchVaultReferences: search };
  const composer = new Composer(host); composers.push(composer);
  return { composer, host, ...bind(composer) };
}
function bind(composer: Composer) {
  const container = document.body.createDiv();
  const shell = buildComposerShell(container, "Reference lifecycle test");
  composer.bind(shell.inputEl, shell.sendBtn, shell.stopBtn, shell.inputHighlightEl);
  const query = (text: string) => { shell.inputEl.value = text; shell.inputEl.setSelectionRange(text.length, text.length); composer.handleInput(); };
  const key = (name: string) => composer.handleKeydown(new KeyboardEvent("keydown", { key: name, cancelable: true }));
  return { container, input: shell.inputEl, query, key };
}
function frames() {
  const callbacks = new Map<number, FrameRequestCallback>(); let next = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callbacks.set(++next, callback); return next; });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const deliver = () => { const pending = [...callbacks.values()]; callbacks.clear(); for (const callback of pending) callback(0); };
  return { deliver, cancel };
}
afterEach(() => { for (const composer of composers.splice(0)) composer.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.empty(); });

describe("Composer reference lifetime", () => {
  it("keeps the optional search capability absent when the host does not provide it", () => {
    const s = scene(undefined);
    s.query("@Notes");
    expect(s.container.querySelector(".chatobby-reference-menu")?.hasClass("is-hidden")).toBe(true);
    expect(s.input.value).toBe("@Notes");
  });

  it("calls reference search with its original host receiver", () => {
    let receiver: ComposerHost | undefined;
    const s = scene(function (this: ComposerHost, query) {
      receiver = this;
      return [reference(query)];
    });
    s.query("@Current");
    expect(receiver).toBe(s.host);
    expect(s.container.querySelector(".chatobby-reference-menu__name")?.textContent).toBe("Current.md");
  });

  it.each(["resolve", "reject"] as const)("ignores a search %s after destruction", async outcome => {
    const pending = deferred<readonly ComposerVaultReference[]>(), s = scene(() => pending.promise);
    s.query("@old"); const menu = s.container.querySelector<HTMLElement>(".chatobby-reference-menu")!;
    s.composer.destroy(); const retired = menu.innerHTML;
    if (outcome === "resolve") pending.resolve([reference("Old")]); else pending.reject(Error("old search"));
    await pending.promise.catch(() => {}); await Promise.resolve();
    expect(menu.innerHTML).toBe(retired);
  });

  it("does not render the prior binding's search into a newly bound input", async () => {
    const pending = deferred<readonly ComposerVaultReference[]>(), s = scene(() => pending.promise);
    s.query("@old"); const replacement = bind(s.composer);
    const menu = replacement.container.querySelector<HTMLElement>(".chatobby-reference-menu")!;
    const initial = menu.innerHTML; pending.resolve([reference("Old")]); await pending.promise; await Promise.resolve();
    expect(menu.innerHTML).toBe(initial);
    expect(replacement.input.value).toBe("");
  });

  it("does not scroll a reference from a cancelled frame after destruction", () => {
    const scheduled = frames(), scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const s = scene(() => [reference("One"), reference("Two")]);
    s.query("@"); s.key("ArrowDown"); s.composer.destroy(); scheduled.deliver();
    expect(scroll).not.toHaveBeenCalled();
  });

  it("does not focus a retired overflow panel after focus moves elsewhere", () => {
    const scheduled = frames(), s = scene(query => [reference(query)]);
    for (const name of ["One", "Two"]) { s.query(`@${name}`); s.key("Enter"); }
    const rail = s.container.querySelector<HTMLElement>(".chatobby-reference-rail")!;
    Object.defineProperties(rail, { clientWidth: { value: 40 }, scrollWidth: { value: 300 } });
    scheduled.deliver();
    s.container.querySelector<HTMLButtonElement>(".chatobby-reference-summary")!.click();
    s.composer.destroy(); const other = document.body.createEl("button"); other.focus(); scheduled.deliver();
    expect(document.activeElement).toBe(other);
  });

  it.each([{ referenceWidth: 300, expandedWidth: 650 }, { referenceWidth: 120, expandedWidth: 350 }])(
    "remeasures $referenceWidth-pixel references after panel deletion without losing deletion focus", ({ referenceWidth, expandedWidth }) => {
      const observers: Observer[] = [];
      class Observer implements ResizeObserver {
        target: Element | null = null;
        observe = (target: Element) => { this.target = target; };
        unobserve = vi.fn(); disconnect = vi.fn();
        constructor(private readonly callback: ResizeObserverCallback) { observers.push(this); }
        deliver(): void { this.callback([], this); }
      }
      vi.stubGlobal("ResizeObserver", Observer);
      const scheduled = frames(), s = scene(query => [reference(query)]);
      for (const name of ["One", "Two", "Three"]) { s.query(`@${name}`); s.key("Enter"); }
      const rail = s.container.querySelector<HTMLElement>(".chatobby-reference-rail")!;
      let availableWidth = 300;
      // Happy DOM has no layout: model current selection width, not the old cached total.
      // Native CSS collapse is qualified separately; see docs/api/composer.md.
      Object.defineProperties(rail, {
        clientWidth: { get: () => availableWidth },
        scrollWidth: { get: () => Math.max(availableWidth, rail.querySelectorAll(".chatobby-reference-chip").length * referenceWidth) },
      });
      scheduled.deliver();
      const observer = observers.find(candidate => candidate.target === rail)!;
      s.container.querySelector<HTMLButtonElement>(".chatobby-reference-summary")!.click();
      scheduled.deliver();
      const panel = s.container.querySelector<HTMLElement>(".chatobby-reference-panel")!;
      expect(document.activeElement).toBe(panel);
      panel.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
      panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }));
      observer.deliver(); // A queued same-width observation must not close the panel.
      scheduled.deliver();
      expect(panel.hasClass("is-hidden")).toBe(false);
      expect(document.activeElement).toBe(panel);
      expect([...panel.querySelectorAll(".chatobby-reference-panel__name")].map(item => item.textContent)).toEqual(["One.md", "Three.md"]);
      availableWidth = expandedWidth; // Two current references fit; the old three-item total does not.
      observer.deliver(); scheduled.deliver();
      expect(rail.querySelectorAll(".chatobby-reference-chip")).toHaveLength(2);
      expect(rail.querySelector(".chatobby-reference-summary")).toBeNull();
      expect(panel.hasClass("is-hidden")).toBe(true);
    });

  it("keeps the newest same-query search when older results arrive last", async () => {
    const first = deferred<readonly ComposerVaultReference[]>(), next = deferred<readonly ComposerVaultReference[]>();
    const search = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    const s = scene(search); s.query("@same"); s.query("Before @same");
    next.resolve([reference("Current")]); await next.promise; await Promise.resolve();
    first.resolve([reference("Old")]); await first.promise; await Promise.resolve();
    expect(s.container.querySelector(".chatobby-reference-menu__name")?.textContent).toBe("Current.md");
    s.key("Enter"); expect(s.input.value).toBe("Before ");
  });

  it("keeps Escape cancellation authoritative when the pending search finishes", async () => {
    const pending = deferred<readonly ComposerVaultReference[]>(), s = scene(() => pending.promise);
    s.query("@cancelled"); s.key("Escape"); pending.resolve([reference("Old")]); await pending.promise;
    expect(s.container.querySelector(".chatobby-reference-menu")?.hasClass("is-hidden")).toBe(true);
    expect(s.container.querySelector(".chatobby-reference-menu__option")).toBeNull();
  });

  it("ignores a detached result button after the query changes", () => {
    const s = scene(query => [reference(query)]); s.query("@Old");
    const old = s.container.querySelector<HTMLButtonElement>(".chatobby-reference-menu__option")!;
    s.query("@Current"); old.click();
    expect(s.input.value).toBe("@Current");
    expect(s.container.querySelector(".chatobby-reference-chip")).toBeNull();
  });

  it("does not let an old scroll frame target the replacement search results", () => {
    const scheduled = frames(), scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    const s = scene(query => [reference(query + "1"), reference(query + "2")]);
    s.query("@Old"); s.key("ArrowDown"); s.query("@Current"); scheduled.deliver();
    expect(scroll).not.toHaveBeenCalled();
  });

  it("disconnects resize observation and ignores a queued callback from the retired binding", () => {
    const observers: Observer[] = [];
    class Observer implements ResizeObserver {
      observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
      constructor(private readonly callback: ResizeObserverCallback) { observers.push(this); }
      deliver(): void { this.callback([], this); }
    }
    vi.stubGlobal("ResizeObserver", Observer);
    const scheduled = frames(), s = scene(query => [reference(query)]);
    for (const name of ["One", "Two"]) { s.query(`@${name}`); s.key("Enter"); }
    const old = observers[0]!; bind(s.composer);
    expect(old.disconnect).toHaveBeenCalledOnce();
    const calls = vi.mocked(window.requestAnimationFrame).mock.calls.length;
    old.deliver(); expect(window.requestAnimationFrame).toHaveBeenCalledTimes(calls);
    scheduled.deliver();
  });

  it("preserves selected references through the existing stash and restore path", () => {
    const s = scene(() => [reference("Selected")]); s.query("Please review @Selected"); s.key("Enter");
    s.composer.stashDraft(); expect(s.container.querySelector(".chatobby-reference-chip")).toBeNull();
    s.composer.restoreStash(); expect(s.input.value).toBe("Please review ");
    expect(s.container.querySelector(".chatobby-reference-chip__label")?.textContent).toBe("Selected.md");
    s.composer.send();
    expect(s.host.send).toHaveBeenCalledWith("Please review @[[Selected.md]]", undefined, expect.any(AbortSignal), expect.any(String));
  });

  it("preserves the reference, permission-interaction and attachment rail order", () => {
    const s = scene(() => []);
    const children = [...s.container.querySelector(".chatobby-composer-card")!.children];
    const selectors = [".chatobby-reference-menu", ".chatobby-reference-panel", ".chatobby-interaction-rail",
      ".chatobby-attachment-rail", ".chatobby-reference-rail", ".chatobby-activation-rail", ".chatobby-input-wrap"];
    const positions = selectors.map(selector => children.findIndex(child => child.matches(selector)));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
