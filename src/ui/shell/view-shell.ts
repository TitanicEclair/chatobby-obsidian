// ViewShell — pure DOM construction, zero state.
// Builds the static layout once on view open. Returns element references.
// All event wiring goes through ShellHandlers callbacks.
//
// Architecture (see docs/ui-state-guide.md):
//   - SessionTabBar is a sibling of ViewShell (tabs above the shell)
//   - Toolbar holds connection status + session info only (model/thinking live in the composer)
//   - ComposerCard wraps ComposerInput + ComposerControls + ComposerActions
//   - ComposerControls (provider/model/thinking/permission) is mounted into composerControlsEl
//   - ResizeObserver sets data-layout based on container width

import { setIcon } from "obsidian";

const COMPACT_LAYOUT_MAX_WIDTH = 700;

/** Callbacks wired to user interactions. The view implements these. */
export interface ShellHandlers {
  submit: () => void;
  interrupt: () => void;
  input: () => void;
  inputKeydown: (e: KeyboardEvent) => void;
}

/** Element references returned to the view for dynamic updates. */
export interface ViewShell {
  root: HTMLElement;
  // Sessions
  tabBarHostEl: HTMLElement;
  subagentRailHostEl: HTMLElement;
  runtimeStatusHostEl: HTMLElement;
  // Toolbar
  toolbarEl: HTMLElement;
  connectionEl: HTMLElement;
  widgetEl: HTMLElement;
  statsEl: HTMLElement;
  sessionPickerHostEl: HTMLElement;
  // Feed
  feedWrapEl: HTMLElement;
  feedEl: HTMLElement;
  taskProgressHostEl: HTMLElement;
  // Composer
  composerEl: HTMLElement;
  inputEl: HTMLTextAreaElement;
  inputHighlightEl: HTMLElement;
  composerControlsEl: HTMLElement;
  sendBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
  slashMenuEl: HTMLElement;
  dispose(): void;
}

/** Shared production composer frame used by main and subagent feeds. */
export interface ComposerShell {
  composerEl: HTMLElement;
  cardEl: HTMLElement;
  slashMenuEl: HTMLElement;
  inputEl: HTMLTextAreaElement;
  inputHighlightEl: HTMLElement;
  barEl: HTMLElement;
  controlsEl: HTMLElement;
  actionsEl: HTMLElement;
  sendBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
}

export function buildComposerShell(
  container: HTMLElement,
  inputLabel: string,
  additionalClass?: string,
): ComposerShell {
  const composerEl = container.createDiv({ cls: `chatobby-composer${additionalClass ? ` ${additionalClass}` : ""}` });
  const cardEl = composerEl.createDiv({ cls: "chatobby-composer-card" });
  const slashMenuEl = cardEl.createDiv({ cls: "chatobby-slash-menu-host is-hidden" });
  const inputWrap = cardEl.createDiv({ cls: "chatobby-input-wrap" });
  const inputHighlightEl = inputWrap.createDiv({
    cls: "chatobby-input-highlight",
    attr: { "aria-hidden": "true" },
  });
  const inputEl = inputWrap.createEl("textarea", {
    cls: "chatobby-input",
    attr: { rows: "2", "aria-label": inputLabel },
  });
  const barEl = cardEl.createDiv({ cls: "chatobby-composer-bar" });
  const controlsEl = barEl.createDiv({ cls: "chatobby-composer-controls-host" });
  const actionsEl = barEl.createDiv({ cls: "chatobby-composer-actions" });
  actionsEl.createDiv({ cls: "chatobby-spacer" });
  const sendBtn = actionsEl.createEl("button", {
    cls: "chatobby-send-btn",
    attr: { type: "button", "aria-label": "Send message", title: "Send (Enter)" },
  });
  setIcon(sendBtn, "arrow-up");
  const stopBtn = actionsEl.createEl("button", {
    cls: "chatobby-stop-btn is-hidden",
    attr: { type: "button", "aria-label": "Stop current turn", title: "Stop current turn" },
  });
  setIcon(stopBtn, "square");
  return {
    composerEl,
    cardEl,
    slashMenuEl,
    inputEl,
    inputHighlightEl,
    barEl,
    controlsEl,
    actionsEl,
    sendBtn,
    stopBtn,
  };
}

/**
 * Build the entire view shell. Called once in onOpen().
 * Returns element references and wires event handlers.
 */
export function buildViewShell(container: HTMLElement, handlers: ShellHandlers): ViewShell {
  container.empty();
  container.addClass("chatobby-view");
  container.setAttr("data-layout", "wide");

  const tabBarHostEl = container.createDiv({ cls: "chatobby-session-bar" });
  const subagentRailHostEl = container.createDiv({ cls: "chatobby-session-agent-rail-host" });

  const sessionPickerHostEl = container.createDiv({ cls: "chatobby-session-picker-host is-hidden" });

  // ── Feed ─────────────────────────────────────────────────────────

  const feedWrap = container.createDiv({ cls: "chatobby-feed-wrap" });
  const runtimeStatusHostEl = feedWrap.createDiv({ cls: "chatobby-runtime-status is-hidden" });
  const feedEl = feedWrap.createDiv({ cls: "chatobby-feed" });

  // ── Composer ─────────────────────────────────────────────────────

  const taskProgressHostEl = container.createDiv({ cls: "chatobby-task-progress-host is-hidden" });
  const composer = buildComposerShell(container, "Message input");

  // Bottom bar: inline session controls (left) + status + send/stop actions (right).
  const toolbar = composer.barEl.createDiv({ cls: "chatobby-toolbar chatobby-composer-status" });
  composer.barEl.insertBefore(toolbar, composer.actionsEl);
  const toolbarLeft = toolbar.createDiv({ cls: "chatobby-toolbar-left" });
  const connectionEl = toolbarLeft.createEl("button", {
    cls: "chatobby-connection is-disconnected",
    attr: {
      type: "button",
      role: "status",
      "aria-live": "polite",
      "aria-label": "Chatobby runtime status and actions",
      "aria-haspopup": "menu",
      title: "Chatobby runtime status and actions",
    },
  });
  const toolbarRight = toolbar.createDiv({ cls: "chatobby-toolbar-right" });
  const widgetEl = toolbarRight.createDiv({ cls: "chatobby-widget-host is-empty" });
  const statsEl = toolbarRight.createDiv({ cls: "chatobby-toolbar__stats" });
  // ── Event wiring ─────────────────────────────────────────────────

  composer.sendBtn.addEventListener("click", () => {
    handlers.submit();
  });

  composer.stopBtn.addEventListener("click", () => {
    handlers.interrupt();
  });

  composer.inputEl.addEventListener("input", () => {
    resizeComposerInput(composer.inputEl);
    handlers.input();
  });

  composer.inputEl.addEventListener("keydown", (e) => {
    handlers.inputKeydown(e);
  });

  const resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    container.setAttr("data-layout", width < COMPACT_LAYOUT_MAX_WIDTH ? "compact" : "wide");
    container.setAttr("data-height", height < 360 ? "shallow" : "standard");
  });
  resizeObserver.observe(container);

  return {
    root: container,
    tabBarHostEl,
    subagentRailHostEl,
    runtimeStatusHostEl,
    toolbarEl: toolbar,
    connectionEl,
    widgetEl,
    statsEl,
    sessionPickerHostEl,
    feedWrapEl: feedWrap,
    feedEl,
    taskProgressHostEl,
    composerEl: composer.composerEl,
    inputEl: composer.inputEl,
    inputHighlightEl: composer.inputHighlightEl,
    composerControlsEl: composer.controlsEl,
    sendBtn: composer.sendBtn,
    stopBtn: composer.stopBtn,
    slashMenuEl: composer.slashMenuEl,
    dispose: () => resizeObserver.disconnect(),
  };
}

/** Auto-size the composer textarea to fit content, up to a dynamic max. */
export function resizeComposerInput(el: HTMLTextAreaElement): void {
  const viewHeight = el.closest<HTMLElement>(".chatobby-view")?.clientHeight ?? window.innerHeight;
  const maxHeight = Math.min(240, Math.max(120, Math.floor(viewHeight * 0.35)));
  el.setCssStyles({ height: "auto" });
  const overflowing = el.scrollHeight > maxHeight;
  el.setCssStyles({ height: `${Math.min(el.scrollHeight, maxHeight)}px` });
  el.toggleClass("is-overflowing", overflowing);
}

/** Update the connection status indicator. */
export function setConnectionIndicator(el: HTMLElement, status: string): void {
  el.removeClass("is-connected", "is-connecting", "is-disconnected", "is-error");
  el.addClass(`is-${status}`);
}
