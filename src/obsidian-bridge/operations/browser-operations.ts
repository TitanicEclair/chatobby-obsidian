// Web viewer operations. This is a bounded browser automation surface over
// Obsidian's Web viewer core plugin: open/navigate/list/snapshot/read plus
// selector/text-targeted click/type/wait/evaluate helpers.

import type { App, WorkspaceLeaf, ViewState } from "obsidian";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";

const WEBVIEWER_TYPE = "webviewer";
const DEFAULT_MAX_CHARS = 12_000;
const DEFAULT_SNAPSHOT_ELEMENTS = 80;
const DEFAULT_SNAPSHOT_TEXT_CHARS = 4_000;
const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
const MAX_EVALUATE_CHARS = 100_000;

interface WebViewerState {
  url?: string;
  navigate?: boolean;
}

interface WebViewElement extends HTMLElement {
  getURL?: () => string;
  getTitle?: () => string;
  loadURL?: (url: string) => Promise<void> | void;
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<unknown>;
}

interface BrowserTabInfo {
  leafId: string;
  type: string;
  isActive: boolean;
  url?: string;
  title?: string;
}

interface TextPage {
  text: string;
  truncated: boolean;
  totalChars: number;
  startIndex: number;
  nextStartIndex?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeScriptJson(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new BridgeError("DEADLINE_EXCEEDED", "Browser operation aborted", true);
  }
}

function getLeafId(leaf: WorkspaceLeaf): string {
  return (leaf as unknown as { id?: string }).id ?? "";
}

function getLeafViewType(leaf: WorkspaceLeaf): string {
  const view = leaf.view as unknown as { getViewType?: () => string };
  return view.getViewType?.() ?? leaf.getViewState().type;
}

function getLeafContainer(leaf: WorkspaceLeaf): HTMLElement | null {
  const view = leaf.view as unknown as { containerEl?: HTMLElement };
  return view.containerEl ?? null;
}

function getWebViewElement(leaf: WorkspaceLeaf): WebViewElement | null {
  return getLeafContainer(leaf)?.querySelector("webview") as WebViewElement | null;
}

function normalizeHttpUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BridgeError("INVALID_INPUT", "Browser operation requires a URL");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BridgeError("INVALID_INPUT", `Invalid URL: ${value}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BridgeError("INVALID_INPUT", "Browser operations only support http and https URLs");
  }
  return parsed.toString();
}

function getWebViewerUrl(leaf: WorkspaceLeaf): string | undefined {
  const webview = getWebViewElement(leaf);
  let runtimeUrl: string | undefined;
  try {
    runtimeUrl = webview?.getURL?.();
  } catch {
    runtimeUrl = undefined;
  }
  if (runtimeUrl) return runtimeUrl;
  const state = asRecord(leaf.getViewState().state) as WebViewerState;
  return typeof state.url === "string" ? state.url : undefined;
}

function getWebViewerTitle(leaf: WorkspaceLeaf): string | undefined {
  let title: string | undefined;
  try {
    title = getWebViewElement(leaf)?.getTitle?.();
  } catch {
    title = undefined;
  }
  if (title) return title;
  const viewTitle = (leaf.view as unknown as { getDisplayText?: () => string }).getDisplayText?.();
  return viewTitle || undefined;
}

function isWebViewerLeaf(leaf: WorkspaceLeaf): boolean {
  return getLeafViewType(leaf) === WEBVIEWER_TYPE;
}

function listWebViewerLeaves(app: App): WorkspaceLeaf[] {
  return app.workspace.getLeavesOfType(WEBVIEWER_TYPE);
}

function findBrowserLeaf(app: App, leafId?: string): WorkspaceLeaf | null {
  const leaves = listWebViewerLeaves(app);
  if (leafId) {
    return leaves.find((leaf) => getLeafId(leaf) === leafId) ?? null;
  }
  const active = app.workspace.activeLeaf;
  if (active && isWebViewerLeaf(active)) return active;
  return leaves[0] ?? null;
}

function browserTabInfo(app: App, leaf: WorkspaceLeaf): BrowserTabInfo {
  const leafId = getLeafId(leaf);
  const url = getWebViewerUrl(leaf);
  const title = getWebViewerTitle(leaf);
  return {
    leafId,
    type: getLeafViewType(leaf),
    isActive: leaf === app.workspace.activeLeaf,
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
  };
}

function resolveBrowserTarget(app: App, target: unknown): WorkspaceLeaf {
  switch (target) {
    case "current":
      return app.workspace.getLeaf(false);
    case "split-right":
      return app.workspace.getLeaf("split", "vertical");
    case "split-down":
      return app.workspace.getLeaf("split", "horizontal");
    case "new-window":
      return app.workspace.getLeaf("window");
    case "new-tab":
    case undefined:
      return app.workspace.getLeaf("tab");
    default:
      throw new BridgeError("INVALID_INPUT", `Unknown browser target: ${String(target)}`);
  }
}

function sliceText(text: string, startIndex: number, maxChars: number): TextPage {
  const safeStart = Math.min(startIndex, text.length);
  const end = Math.min(safeStart + maxChars, text.length);
  return {
    text: text.slice(safeStart, end),
    truncated: end < text.length,
    totalChars: text.length,
    startIndex: safeStart,
    ...(end < text.length ? { nextStartIndex: end } : {}),
  };
}

async function waitLocal(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(timeout);
      reject(new BridgeError("DEADLINE_EXCEEDED", "Browser operation aborted", true));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function requireBrowserLeaf(app: App, leafId: string | undefined): WorkspaceLeaf {
  const leaf = findBrowserLeaf(app, leafId);
  if (!leaf) {
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", leafId ? `No Web viewer tab found for leafId ${leafId}` : "No Web viewer tab is open");
  }
  return leaf;
}

function requireWebView(leaf: WorkspaceLeaf): WebViewElement {
  const webview = getWebViewElement(leaf);
  if (!webview) {
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web viewer tab has no accessible webview element");
  }
  if (!webview.executeJavaScript) {
    throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page scripting is unavailable");
  }
  return webview;
}

async function runPageScript(webview: WebViewElement, source: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!webview.executeJavaScript) {
    throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page scripting is unavailable");
  }
  const script = `(async () => {
    const input = ${safeScriptJson(input)};
    ${source}
  })()`;
  return asRecord(await webview.executeJavaScript(script, false));
}

function ensureScriptOk(result: Record<string, unknown>, operation: string): void {
  if (result.ok === false) {
    const message = typeof result.message === "string" ? result.message : `${operation} failed`;
    throw new BridgeError("INVALID_INPUT", message);
  }
}

const SNAPSHOT_SCRIPT = `
  const maxElements = typeof input.maxElements === "number" ? input.maxElements : ${DEFAULT_SNAPSHOT_ELEMENTS};
  const maxTextChars = typeof input.maxTextChars === "number" ? input.maxTextChars : ${DEFAULT_SNAPSHOT_TEXT_CHARS};
  const includeHidden = input.includeHidden === true;
  const interactiveSelector = [
    "a[href]",
    "button",
    "input",
    "textarea",
    "select",
    "summary",
    "[role]",
    "[contenteditable=true]",
    "[onclick]",
    "area[href]"
  ].join(",");
  function clean(value) {
    return String(value || "").replace(/\\s+/g, " ").trim();
  }
  function visible(el) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }
  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  }
  function cssPath(el) {
    if (el.id) return "#" + cssEscape(el.id);
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE && cur !== document.body) {
      let selector = cur.tagName.toLowerCase();
      const parent = cur.parentElement;
      if (!parent) break;
      const sameTag = Array.from(parent.children).filter((child) => child.tagName === cur.tagName);
      if (sameTag.length > 1) selector += ":nth-of-type(" + (sameTag.indexOf(cur) + 1) + ")";
      parts.unshift(selector);
      cur = parent;
    }
    return parts.length ? parts.join(" > ") : "body";
  }
  const nodes = Array.from(document.querySelectorAll(interactiveSelector));
  const elements = [];
  let textBudget = maxTextChars;
  for (const el of nodes) {
    const isVisible = visible(el);
    if (!includeHidden && !isVisible) continue;
    const text = clean(el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("value") || "");
    const clippedText = text.slice(0, Math.max(0, Math.min(textBudget, 240)));
    textBudget -= clippedText.length;
    elements.push({
      index: elements.length,
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "",
      text: clippedText,
      ariaLabel: el.getAttribute("aria-label") || "",
      href: el.href || el.getAttribute("href") || "",
      value: typeof el.value === "string" ? el.value.slice(0, 120) : "",
      checked: typeof el.checked === "boolean" ? el.checked : undefined,
      disabled: Boolean(el.disabled),
      visible: isVisible
    });
    if (elements.length >= maxElements || textBudget <= 0) break;
  }
  return {
    ok: true,
    url: location.href,
    title: document.title || "",
    totalCandidates: nodes.length,
    returnedElements: elements.length,
    truncated: elements.length < nodes.length,
    elements
  };
`;

const READ_SCRIPT = `
  const includeHtml = input.includeHtml === true;
  return {
    ok: true,
    url: location.href,
    title: document.title || "",
    text: document.body ? document.body.innerText || "" : "",
    html: includeHtml && document.documentElement ? document.documentElement.outerHTML || "" : ""
  };
`;

const CLICK_SCRIPT = `
  function clean(value) {
    return String(value || "").replace(/\\s+/g, " ").trim();
  }
  function candidates() {
    return Array.from(document.querySelectorAll("a[href],button,input,textarea,select,summary,[role],[contenteditable=true],[onclick],area[href]"));
  }
  let matches = [];
  if (typeof input.cssSelector === "string") {
    try {
      matches = Array.from(document.querySelectorAll(input.cssSelector));
    } catch {
      return { ok: false, message: "Invalid CSS selector: " + input.cssSelector };
    }
  } else if (typeof input.text === "string") {
    const needle = clean(input.text);
    matches = candidates().filter((el) => {
      const haystack = clean(el.innerText || el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("value") || "");
      return input.exact === true ? haystack === needle : haystack.toLowerCase().includes(needle.toLowerCase());
    });
  }
  const index = typeof input.index === "number" ? input.index : 0;
  const el = matches[index];
  if (!el) return { ok: false, message: "No matching element found" };
  el.scrollIntoView({ block: "center", inline: "center" });
  if (typeof el.focus === "function") el.focus();
  if (typeof el.click === "function") {
    el.click();
  } else {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }
  return {
    ok: true,
    clicked: true,
    url: location.href,
    title: document.title || "",
    tag: el.tagName.toLowerCase(),
    text: clean(el.innerText || el.textContent || el.getAttribute("aria-label") || "").slice(0, 240),
    href: el.href || el.getAttribute("href") || ""
  };
`;

const TYPE_SCRIPT = `
  const selector = String(input.cssSelector || "");
  let el;
  try {
    el = document.querySelector(selector);
  } catch {
    return { ok: false, message: "Invalid CSS selector: " + selector };
  }
  if (!el) return { ok: false, message: "No matching element found for selector: " + selector };
  const text = String(input.text || "");
  const clear = input.clear !== false;
  el.scrollIntoView({ block: "center", inline: "center" });
  if (typeof el.focus === "function") el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const next = clear ? text : el.value + text;
    el.value = next;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el instanceof HTMLSelectElement) {
    el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    el.textContent = clear ? text : (el.textContent || "") + text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  } else {
    return { ok: false, message: "Element is not typable: " + selector };
  }
  if (input.submit === true) {
    const form = el.closest("form");
    if (form) {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.submit();
    } else {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    }
  }
  return {
    ok: true,
    typed: true,
    url: location.href,
    title: document.title || "",
    tag: el.tagName.toLowerCase(),
    selector
  };
`;

const WAIT_SCRIPT = `
  function clean(value) {
    return String(value || "").replace(/\\s+/g, " ").trim();
  }
  function readyMatches() {
    if (input.state === "interactive") return document.readyState === "interactive" || document.readyState === "complete";
    return document.readyState === "complete";
  }
  function matches() {
    if (!readyMatches()) return false;
    if (typeof input.urlIncludes === "string" && !location.href.includes(input.urlIncludes)) return false;
    if (typeof input.cssSelector === "string") {
      try {
        if (!document.querySelector(input.cssSelector)) return false;
      } catch {
        return false;
      }
    }
    if (typeof input.text === "string") {
      const bodyText = clean(document.body ? document.body.innerText || "" : "");
      if (!bodyText.toLowerCase().includes(clean(input.text).toLowerCase())) return false;
    }
    return true;
  }
  return { ok: true, matched: matches(), readyState: document.readyState, url: location.href, title: document.title || "" };
`;

const EVALUATE_SCRIPT = `
  const maxChars = typeof input.maxChars === "number" ? Math.min(input.maxChars, ${MAX_EVALUATE_CHARS}) : ${DEFAULT_MAX_CHARS};
  async function runUserScript() {
    const source = String(input.script || "");
    try {
      return await (0, eval)(source);
    } catch (firstError) {
      try {
        return await (0, eval)("(async () => {\\n" + source + "\\n})()");
      } catch (secondError) {
        return { __chatobbyEvalError: String(secondError && secondError.message ? secondError.message : secondError) };
      }
    }
  }
  function toText(value) {
    if (typeof value === "string") return value;
    if (value === undefined) return "undefined";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  const value = await runUserScript();
  if (value && value.__chatobbyEvalError) {
    return { ok: false, message: value.__chatobbyEvalError };
  }
  const text = toText(value);
  return {
    ok: true,
    url: location.href,
    title: document.title || "",
    resultType: value === null ? "null" : typeof value,
    text: text.slice(0, maxChars),
    totalChars: text.length,
    truncated: text.length > maxChars
  };
`;

export const handleBrowserOpen: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const url = normalizeHttpUrl(args.url);
  const leaf = resolveBrowserTarget(app, args.target);
  const viewState: ViewState = {
    type: WEBVIEWER_TYPE,
    state: { url, navigate: true },
    active: args.focus !== false,
  };
  await leaf.setViewState(viewState);
  assertNotAborted(signal);
  if (args.focus !== false) {
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }
  return { opened: true, ...browserTabInfo(app, leaf) };
};

export const handleBrowserNavigate: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = requireBrowserLeaf(app, leafId);
  const url = normalizeHttpUrl(args.url);
  const webview = getWebViewElement(leaf);
  if (webview?.loadURL) {
    try {
      await webview.loadURL(url);
    } catch {
      await leaf.setViewState({ type: WEBVIEWER_TYPE, state: { url, navigate: true }, active: true });
    }
  } else {
    await leaf.setViewState({ type: WEBVIEWER_TYPE, state: { url, navigate: true }, active: true });
  }
  assertNotAborted(signal);
  return { navigated: true, ...browserTabInfo(app, leaf), url };
};

export const handleBrowserList: OperationHandler = async (_args, _signal, app) => {
  return {
    tabs: listWebViewerLeaves(app).map((leaf) => browserTabInfo(app, leaf)),
  };
};

export const handleBrowserSnapshot: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = requireBrowserLeaf(app, leafId);
  const webview = requireWebView(leaf);
  const result = await runPageScript(webview, SNAPSHOT_SCRIPT, {
    maxElements: args.maxElements,
    maxTextChars: args.maxTextChars,
    includeHidden: args.includeHidden,
  });
  assertNotAborted(signal);
  ensureScriptOk(result, "browser.snapshot");
  return { available: true, ...browserTabInfo(app, leaf), ...result };
};

export const handleBrowserRead: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const maxChars = typeof args.maxChars === "number" ? args.maxChars : DEFAULT_MAX_CHARS;
  const startIndex = typeof args.startIndex === "number" ? args.startIndex : 0;
  if (!Number.isInteger(maxChars) || maxChars <= 0 || maxChars > 100_000) {
    throw new BridgeError("INVALID_INPUT", "browser.read maxChars must be an integer from 1 to 100000");
  }
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new BridgeError("INVALID_INPUT", "browser.read startIndex must be a non-negative integer");
  }
  const leaf = requireBrowserLeaf(app, leafId);
  const webview = requireWebView(leaf);
  const data = await runPageScript(webview, READ_SCRIPT, { includeHtml: args.includeHtml === true });
  assertNotAborted(signal);
  ensureScriptOk(data, "browser.read");
  const text = typeof data.text === "string" ? data.text : "";
  const page = sliceText(text, startIndex, maxChars);
  const html = args.includeHtml === true && typeof data.html === "string" ? sliceText(data.html, startIndex, maxChars) : undefined;
  return {
    available: true,
    ...browserTabInfo(app, leaf),
    ...(typeof data.url === "string" ? { url: data.url } : {}),
    ...(typeof data.title === "string" ? { title: data.title } : {}),
    ...page,
    ...(html ? { html: html.text, htmlTruncated: html.truncated, htmlTotalChars: html.totalChars, htmlNextStartIndex: html.nextStartIndex } : {}),
  };
};

export const handleBrowserClick: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = requireBrowserLeaf(app, leafId);
  const webview = requireWebView(leaf);
  const result = await runPageScript(webview, CLICK_SCRIPT, {
    cssSelector: args.cssSelector,
    text: args.text,
    index: args.index,
    exact: args.exact,
  });
  assertNotAborted(signal);
  ensureScriptOk(result, "browser.click");
  if (typeof args.waitAfterMs === "number") {
    await waitLocal(args.waitAfterMs, signal);
  }
  return { ...browserTabInfo(app, leaf), ...result };
};

export const handleBrowserType: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = requireBrowserLeaf(app, leafId);
  const webview = requireWebView(leaf);
  const result = await runPageScript(webview, TYPE_SCRIPT, {
    cssSelector: args.cssSelector,
    text: args.text,
    clear: args.clear,
    submit: args.submit,
  });
  assertNotAborted(signal);
  ensureScriptOk(result, "browser.type");
  return { ...browserTabInfo(app, leaf), ...result };
};

export const handleBrowserWait: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = requireBrowserLeaf(app, leafId);
  const webview = requireWebView(leaf);
  const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : DEFAULT_WAIT_TIMEOUT_MS;
  const started = Date.now();

  while (Date.now() - started <= timeoutMs) {
    const result = await runPageScript(webview, WAIT_SCRIPT, {
      cssSelector: args.cssSelector,
      text: args.text,
      urlIncludes: args.urlIncludes,
      state: args.state,
    });
    assertNotAborted(signal);
    ensureScriptOk(result, "browser.wait");
    if (result.matched === true) {
      return { ...browserTabInfo(app, leaf), ...result, elapsedMs: Date.now() - started };
    }
    await waitLocal(100, signal);
  }

  return { ...browserTabInfo(app, leaf), ok: true, matched: false, elapsedMs: Date.now() - started };
};

export const handleBrowserEvaluate: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = requireBrowserLeaf(app, leafId);
  const webview = requireWebView(leaf);
  const result = await runPageScript(webview, EVALUATE_SCRIPT, {
    script: args.script,
    maxChars: args.maxChars,
  });
  assertNotAborted(signal);
  ensureScriptOk(result, "browser.evaluate");
  return { ...browserTabInfo(app, leaf), ...result };
};

export const handleBrowserClose: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = requireBrowserLeaf(app, leafId);
  const tab = browserTabInfo(app, leaf);
  leaf.detach();
  return { closed: true, tab };
};
