import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer, type ComposerHost } from "../../../src/ui/composer/composer";
import { ComposerControls } from "../../../src/ui/composer/composer-controls";
import { DEFAULT_COMPOSER_KEYBINDINGS, DEFAULT_SESSION_PREFERENCES, EMPTY_SESSION_STATE } from "../../../src/types";
import { buildComposerShell } from "../../../src/ui/shell/view-shell";

/** @see docs/api/composer.md — Obsidian's scope runs before a panel's local key listener. */
const composers: Composer[] = [];
const controls: ComposerControls[] = [];
afterEach(() => { for (const item of controls.splice(0)) item.destroy(); for (const composer of composers.splice(0)) composer.destroy(); vi.restoreAllMocks(); document.body.empty(); });

function scene(cancelTurn = "Escape", running = false) {
  const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { callbacks.push(callback); return callbacks.length; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const deliver = () => { for (const callback of callbacks.splice(0)) callback(0); };
  let picker: ComposerControls | undefined;
  const host: ComposerHost = {
    send: vi.fn(), steer: vi.fn(), abort: vi.fn(), canAbort: () => true,
    getSessionState: () => ({ ...EMPTY_SESSION_STATE, isStreaming: running }),
    getSessionPreferences: () => DEFAULT_SESSION_PREFERENCES,
    getComposerKeybindings: () => ({ ...DEFAULT_COMPOSER_KEYBINDINGS, cancelTurn }),
    handleScopedControlKey: event => picker?.handleScopedKeydown(event) ?? false,
    searchVaultReferences: query => [{ id: query, kind: "file", label: `${query}.md`, path: `${query}.md`,
      promptPath: `${query}.md`, scope: "vault", vaultRelativePath: `${query}.md` }],
  };
  const composer = new Composer(host); composers.push(composer);
  const container = document.body.createDiv(), shell = buildComposerShell(container, "Scoped keyboard test");
  composer.bind(shell.inputEl, shell.sendBtn, shell.stopBtn, shell.inputHighlightEl);
  const scopeKey = (target: HTMLElement, key: string, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
    // Production ChatobbyView returns false when this same scope API consumes the key.
    const scoped = (incoming: KeyboardEvent) => { if (composer.handleScopedKeydown(incoming, true)) incoming.stopPropagation(); };
    document.addEventListener("keydown", scoped, true);
    try { target.dispatchEvent(event); } finally { document.removeEventListener("keydown", scoped, true); }
    return event;
  };
  const openPanel = () => {
    for (const name of ["One", "Two", "Three"]) {
      shell.inputEl.value = `Review @${name}`;
      shell.inputEl.setSelectionRange(shell.inputEl.value.length, shell.inputEl.value.length);
      composer.handleInput(); composer.handleKeydown(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
    }
    const rail = container.querySelector<HTMLElement>(".chatobby-reference-rail")!;
    // Controlled layout reaches the panel; this test proves scope routing, not native CSS.
    Object.defineProperties(rail, { clientWidth: { value: 100 }, scrollWidth: { value: 900 } });
    deliver();
    const summary = container.querySelector<HTMLButtonElement>(".chatobby-reference-summary")!;
    summary.click(); deliver();
    const panel = container.querySelector<HTMLElement>(".chatobby-reference-panel")!;
    expect(document.activeElement).toBe(panel);
    return { panel, summary };
  };
  const openPicker = () => {
    const applyControl = vi.fn(async () => {});
    picker = new ComposerControls({ isBackendAvailable: () => true, applyControl,
      getViewModel: () => ({ canSubmit: true, controls: [{ id: "effort", label: "Effort", value: "medium",
        options: [{ value: "medium", label: "Medium" }, { value: "high", label: "High" }] }] }) });
    controls.push(picker); picker.render(container);
    const anchor = container.querySelector<HTMLButtonElement>(".chatobby-control--effort")!;
    anchor.click(); deliver();
    const search = document.querySelector<HTMLInputElement>(".chatobby-selection-menu__search")!;
    expect(document.activeElement).toBe(search);
    return { anchor, search, applyControl };
  };
  return { composer, host, container, input: shell.inputEl, stopBtn: shell.stopBtn, scopeKey, openPanel, openPicker, deliver };
}

describe("Composer scoped keyboard ownership", () => {
  it.each([false, true])("closes the focused reference panel before idle/turn cancellation (running=%s)", running => {
    const s = scene("Escape", running), { panel, summary } = s.openPanel();
    const before = s.input.value;
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    const event = s.scopeKey(panel, "Escape");
    expect(event.defaultPrevented).toBe(true);
    expect(s.composer.handleScopedKeydown(event, true)).toBe(true);
    s.composer.handleKeydown(event); // Re-entering with a consumed event must not cancel the draft or turn.
    expect(s.input.value).toBe(before);
    expect(s.composer.text).toBe(before);
    expect(summary.isConnected).toBe(true);
    expect(summary.textContent).toBe("@3 references");
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hasClass("is-hidden")).toBe(true);
    expect(document.activeElement).toBe(summary);
    expect(s.host.abort).not.toHaveBeenCalled();
    expect(s.stopBtn.getAttribute("aria-label")).not.toContain("again");
    summary.click(); s.deliver();
    expect(panel.querySelector(".chatobby-reference-panel__row.is-active")?.getAttribute("data-reference-panel-index")).toBe("1");
    expect([...panel.querySelectorAll(".chatobby-reference-panel__name")].map(row => row.textContent)).toEqual(["One.md", "Two.md", "Three.md"]);
  });

  it("handles a scoped panel Delete once when it is also the configured cancel key", () => {
    const s = scene("Delete"), { panel } = s.openPanel();
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    const before = s.input.value, event = s.scopeKey(panel, "Delete");
    // Even if a host later delivers this same event locally, deletion is already owned.
    panel.dispatchEvent(event); s.deliver();
    expect(s.input.value).toBe(before);
    expect(s.container.querySelector(".chatobby-reference-summary")?.textContent).toBe("@2 references");
    expect([...panel.querySelectorAll(".chatobby-reference-panel__name")].map(row => row.textContent)).toEqual(["One.md", "Three.md"]);
    expect(document.activeElement).toBe(panel);
    expect(s.host.abort).not.toHaveBeenCalled();
  });

  it("keeps default Escape panel dismissal with a custom turn-cancel shortcut", () => {
    const s = scene("Mod+k"), { panel, summary } = s.openPanel(), before = s.input.value;
    s.scopeKey(panel, "Escape");
    expect(panel.hasClass("is-hidden")).toBe(true);
    expect(s.input.value).toBe(before);
    expect(document.activeElement).toBe(summary);
    s.input.focus(); s.scopeKey(s.input, "k", { ctrlKey: true });
    expect(s.input.value).toBe("");
    expect(s.container.querySelector(".chatobby-reference-summary")).toBeNull();
  });

  it("retains ordinary scoped Escape clearing and double-Escape Stop outside a panel", () => {
    const s = scene(); s.composer.setText("Idle draft"); s.input.focus(); s.scopeKey(s.input, "Escape");
    expect(s.input.value).toBe(""); expect(s.host.abort).not.toHaveBeenCalled();
    s.composer.setStreaming(true);
    s.scopeKey(s.input, "Escape"); expect(s.host.abort).not.toHaveBeenCalled();
    s.scopeKey(s.input, "Escape"); expect(s.host.abort).toHaveBeenCalledOnce();
  });

  it("does not let an open but unfocused reference panel steal input cancellation", () => {
    const s = scene(); s.openPanel(); s.input.focus(); s.scopeKey(s.input, "Escape");
    expect(s.input.value).toBe("");
    expect(s.container.querySelector(".chatobby-reference-summary")).toBeNull();
  });

  it.each(["Escape", "Mod+k"])("closes the focused control dropdown without clearing a draft (cancel=%s)", cancel => {
    const s = scene(cancel); s.composer.setText("Keep this draft");
    const { anchor, search, applyControl } = s.openPicker();
    s.scopeKey(search, "Escape");
    expect(document.querySelector(".chatobby-selection-menu")).toBeNull();
    expect(document.activeElement).toBe(anchor);
    expect(s.input.value).toBe("Keep this draft");
    expect(s.host.abort).not.toHaveBeenCalled(); expect(applyControl).not.toHaveBeenCalled();
    s.input.focus(); s.scopeKey(s.input, cancel === "Escape" ? "Escape" : "k", { ctrlKey: cancel !== "Escape" });
    expect(s.input.value).toBe("");
  });

  it("does not let an unfocused dropdown consume the configured cancel shortcut", () => {
    const s = scene("Mod+k"); s.composer.setText("Idle draft"); s.openPicker();
    s.input.focus(); s.scopeKey(s.input, "k", { ctrlKey: true });
    expect(s.input.value).toBe("");
    expect(s.host.abort).not.toHaveBeenCalled();
  });

  it("keeps a newly active blocking interaction ahead of a still-focused dropdown", () => {
    const s = scene(); s.composer.setText("Keep this draft"); const { search } = s.openPicker();
    const handleInteraction = vi.fn((event: KeyboardEvent) => { event.preventDefault(); return true; });
    s.host.isInteractionActive = () => true; s.host.handleInteractionKey = handleInteraction;
    const event = s.scopeKey(search, "Escape");
    expect(handleInteraction).toHaveBeenCalledExactlyOnceWith(event);
    expect(s.input.value).toBe("Keep this draft");
    expect(s.host.abort).not.toHaveBeenCalled();
  });
});
