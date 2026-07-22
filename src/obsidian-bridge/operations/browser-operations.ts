import type { App, WorkspaceLeaf } from "obsidian";
import {
  executeBrowserPageOperation,
  type BrowserPageAction,
  type BrowserPageInput,
} from "../browser/page-runtime";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";

const WEBVIEWER_TYPE = "webviewer";
const DEFAULT_MAX_CHARS = 12_000;
const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
const WEBVIEWER_READY_TIMEOUT_MS = 5_000;

interface WebViewerState {
  url?: string;
  navigate?: boolean;
}

interface NativeImageLike {
  toPNG(): Uint8Array;
  getSize?(): { width: number; height: number };
}

interface WebViewElement extends HTMLElement {
  getURL?: () => string;
  getTitle?: () => string;
  loadURL?: (url: string) => Promise<void> | void;
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<unknown>;
  canGoBack?: () => boolean;
  canGoForward?: () => boolean;
  goBack?: () => void;
  goForward?: () => void;
  reload?: () => void;
  isLoading?: () => boolean;
  isCrashed?: () => boolean;
  isCurrentlyAudible?: () => boolean;
  sendInputEvent?: (event: Record<string, unknown>) => Promise<void> | void;
  capturePage?: (rect?: { x: number; y: number; width: number; height: number }) => Promise<NativeImageLike>;
}

interface BrowserTabInfo {
  leafId: string;
  type: string;
  isActive: boolean;
  url?: string;
  title?: string;
  loading?: boolean;
  crashed?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  audible?: boolean;
  page?: Record<string, unknown>;
}

interface BrowserCursor {
  documentId: string;
  revision: number;
  blockIndex: number;
  blockOffset: number;
}

interface WorkspaceWithRecentLeaf {
  getMostRecentLeaf?: () => WorkspaceLeaf | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeScriptJson(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new BridgeError("DEADLINE_EXCEEDED", "Browser operation aborted", true);
}

function getLeafId(leaf: WorkspaceLeaf): string {
  return (leaf as unknown as { id?: string }).id ?? "";
}

function getCurrentLeaf(app: App): WorkspaceLeaf {
  const workspace = app.workspace as WorkspaceWithRecentLeaf;
  return workspace.getMostRecentLeaf?.() ?? app.workspace.getLeaf(false);
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

function safeWebViewValue<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function isWebViewReady(webview: WebViewElement): boolean {
  if (!webview.getURL) return Boolean(webview.executeJavaScript);
  try {
    webview.getURL();
    return true;
  } catch {
    return false;
  }
}

function isDomReadyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("dom-ready") || message.includes("attached to the dom");
}

async function waitForWebViewReady(
  leaf: WorkspaceLeaf,
  signal: AbortSignal,
  timeoutMs = WEBVIEWER_READY_TIMEOUT_MS,
): Promise<WebViewElement> {
  assertNotAborted(signal);
  const container = getLeafContainer(leaf);
  if (!container) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web viewer tab has no accessible container");
  const initial = getWebViewElement(leaf);
  if (initial && isWebViewReady(initial)) return initial;

  return await new Promise<WebViewElement>((resolve, reject) => {
    let current: WebViewElement | null = null;
    let settled = false;
    const finish = (webview?: WebViewElement, error?: BridgeError): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      current?.removeEventListener("dom-ready", onReady);
      if (error) reject(error);
      else if (webview) resolve(webview);
    };
    const onReady = (): void => {
      const webview = current ?? getWebViewElement(leaf);
      if (webview) finish(webview);
    };
    const watchCurrent = (): void => {
      const candidate = getWebViewElement(leaf);
      if (!candidate) return;
      if (candidate !== current) {
        current?.removeEventListener("dom-ready", onReady);
        current = candidate;
        current.addEventListener("dom-ready", onReady);
      }
      if (isWebViewReady(candidate)) finish(candidate);
    };
    const observer = new MutationObserver(watchCurrent);
    const onAbort = (): void => finish(undefined, new BridgeError("DEADLINE_EXCEEDED", "Browser operation aborted", true));
    const timeout = window.setTimeout(
      () => finish(
        undefined,
        new BridgeError(
          "DEADLINE_EXCEEDED",
          `Web viewer leaf ${getLeafId(leaf)} did not become ready within ${timeoutMs}ms`,
          true,
        ),
      ),
      timeoutMs,
    );
    signal.addEventListener("abort", onAbort, { once: true });
    observer.observe(container, { childList: true, subtree: true });
    watchCurrent();
  });
}

async function setWebViewerUrl(leaf: WorkspaceLeaf, url: string, signal: AbortSignal): Promise<WebViewElement> {
  let retryNavigation = false;
  try {
    await leaf.setViewState({ type: WEBVIEWER_TYPE, state: { url, navigate: true }, active: true });
  } catch (error) {
    if (!isDomReadyError(error)) throw error;
    retryNavigation = true;
  }
  const webview = await waitForWebViewReady(leaf, signal);
  if (retryNavigation) {
    if (!webview.loadURL) {
      throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web viewer became ready but navigation is unavailable");
    }
    await webview.loadURL(url);
  }
  return webview;
}

function normalizeHttpUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new BridgeError("INVALID_INPUT", "Browser operation requires a URL");
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
  const runtimeUrl = webview?.getURL ? safeWebViewValue(() => webview.getURL?.()) : undefined;
  if (runtimeUrl) return runtimeUrl;
  const state = asRecord(leaf.getViewState().state) as WebViewerState;
  return typeof state.url === "string" ? state.url : undefined;
}

function getWebViewerTitle(leaf: WorkspaceLeaf): string | undefined {
  const webview = getWebViewElement(leaf);
  const title = webview?.getTitle ? safeWebViewValue(() => webview.getTitle?.()) : undefined;
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

function findAnyLeaf(app: App, leafId: string): WorkspaceLeaf | null {
  const direct = app.workspace.getLeafById(leafId);
  if (direct) return direct;
  let found: WorkspaceLeaf | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (getLeafId(leaf) === leafId) found = leaf;
  });
  return found;
}

function findBrowserLeaf(app: App, leafId?: string): WorkspaceLeaf | null {
  const leaves = listWebViewerLeaves(app);
  if (leafId) return leaves.find((leaf) => getLeafId(leaf) === leafId) ?? null;
  const active = getCurrentLeaf(app);
  if (active && isWebViewerLeaf(active)) return active;
  return leaves[0] ?? null;
}

async function browserTabInfo(app: App, leaf: WorkspaceLeaf): Promise<BrowserTabInfo> {
  const webview = getWebViewElement(leaf);
  const loading = webview?.isLoading ? safeWebViewValue(() => webview.isLoading?.()) : undefined;
  let page: Record<string, unknown> | undefined;
  if (webview?.executeJavaScript && loading === false) {
    try {
      const result = await runPageOperation(webview, "page", {});
      page = asRecord(result.page);
    } catch {
      page = undefined;
    }
  }
  const url = getWebViewerUrl(leaf);
  const title = getWebViewerTitle(leaf);
  const crashed = webview?.isCrashed ? safeWebViewValue(() => webview.isCrashed?.()) : undefined;
  const canGoBack = webview?.canGoBack ? safeWebViewValue(() => webview.canGoBack?.()) : undefined;
  const canGoForward = webview?.canGoForward ? safeWebViewValue(() => webview.canGoForward?.()) : undefined;
  const audible = webview?.isCurrentlyAudible ? safeWebViewValue(() => webview.isCurrentlyAudible?.()) : undefined;
  return {
    leafId: getLeafId(leaf),
    type: getLeafViewType(leaf),
    isActive: leaf === getCurrentLeaf(app),
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(loading !== undefined ? { loading } : {}),
    ...(crashed !== undefined ? { crashed } : {}),
    ...(canGoBack !== undefined ? { canGoBack } : {}),
    ...(canGoForward !== undefined ? { canGoForward } : {}),
    ...(audible !== undefined ? { audible } : {}),
    ...(page ? { page } : {}),
  };
}

function resolveBrowserTarget(app: App, target: unknown): WorkspaceLeaf {
  switch (target) {
    case "current": return app.workspace.getLeaf(false);
    case "split-left": {
      const source = getCurrentLeaf(app);
      return app.workspace.createLeafBySplit(source, "vertical", true);
    }
    case "split-right": return app.workspace.getLeaf("split", "vertical");
    case "split-up": {
      const source = getCurrentLeaf(app);
      return app.workspace.createLeafBySplit(source, "horizontal", true);
    }
    case "split-down": return app.workspace.getLeaf("split", "horizontal");
    case "new-window": return app.workspace.getLeaf("window");
    case "new-tab":
    case undefined: return app.workspace.getLeaf("tab");
    default: throw new BridgeError("INVALID_INPUT", `Unknown browser target: ${String(target)}`);
  }
}

function requireBrowserLeaf(app: App, leafId: string | undefined): WorkspaceLeaf {
  const leaf = findBrowserLeaf(app, leafId);
  if (!leaf) {
    throw new BridgeError(
      "OBSIDIAN_OPERATION_FAILED",
      leafId ? `No Web viewer tab found for leafId ${leafId}` : "No Web viewer tab is open",
    );
  }
  return leaf;
}

function requireWebView(leaf: WorkspaceLeaf): WebViewElement {
  const webview = getWebViewElement(leaf);
  if (!webview) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web viewer tab has no accessible webview element");
  if (!webview.executeJavaScript) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page scripting is unavailable");
  return webview;
}

async function runPageOperation(
  webview: WebViewElement,
  action: BrowserPageAction,
  operationInput: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!webview.executeJavaScript) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page scripting is unavailable");
  const input: BrowserPageInput = { action, ...operationInput };
  const script = `(${executeBrowserPageOperation.toString()})(${safeScriptJson(input)})`;
  try {
    const result = asRecord(await webview.executeJavaScript(script, false));
    if (result.ok === false) throw new BridgeError("INVALID_INPUT", String(result.message || `browser.${action} failed`));
    return result;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("Stale page ")) throw new BridgeError("REVISION_CONFLICT", message);
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", message);
  }
}

async function waitLocal(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: BridgeError): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const timeout = window.setTimeout(() => finish(), ms);
    const onAbort = () => finish(new BridgeError("DEADLINE_EXCEEDED", "Browser operation aborted", true));
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function leafIdFrom(args: Record<string, unknown>): string | undefined {
  return typeof args.leafId === "string" ? args.leafId : undefined;
}

function targetArguments(args: Record<string, unknown>): Record<string, unknown> {
  return {
    ref: args.ref,
    cssSelector: args.cssSelector,
    role: args.role,
    name: args.name,
    text: args.text,
    exact: args.exact,
    index: args.index,
    strict: args.strict,
    documentId: args.documentId,
    revision: args.revision,
  };
}

function destinationArguments(args: Record<string, unknown>): Record<string, unknown> {
  return {
    ref: args.toRef,
    cssSelector: args.toCssSelector,
    role: args.toRole,
    name: args.toName,
    text: args.toText,
    index: args.toIndex,
    exact: args.exact,
    strict: args.strict,
    documentId: args.documentId,
    revision: args.revision,
  };
}

interface BrowserPoint {
  x: number;
  y: number;
}

async function targetCenter(webview: WebViewElement, target: Record<string, unknown>): Promise<BrowserPoint> {
  const boundsResult = await runPageOperation(webview, "bounds", target);
  const element = asRecord(boundsResult.element);
  const bounds = asRecord(element.bounds);
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every((value) => typeof value === "number")) {
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Browser target did not provide usable bounds");
  }
  return {
    x: Math.max(0, Math.round((bounds.x as number) + (bounds.width as number) / 2)),
    y: Math.max(0, Math.round((bounds.y as number) + (bounds.height as number) / 2)),
  };
}

function viewportCenter(webview: WebViewElement): BrowserPoint {
  return { x: Math.max(0, Math.round(webview.clientWidth / 2)), y: Math.max(0, Math.round(webview.clientHeight / 2)) };
}

function encodeCursor(cursor: BrowserCursor): string {
  return `browser-v1:${encodeURIComponent(JSON.stringify(cursor))}`;
}

function decodeCursor(value: unknown): BrowserCursor | null {
  if (typeof value !== "string" || !value.startsWith("browser-v1:")) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice("browser-v1:".length))) as Partial<BrowserCursor>;
    if (
      typeof parsed.documentId !== "string"
      || !Number.isInteger(parsed.revision)
      || !Number.isInteger(parsed.blockIndex)
      || !Number.isInteger(parsed.blockOffset)
    ) return null;
    return parsed as BrowserCursor;
  } catch {
    return null;
  }
}

function pageBlocks(data: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(data.blocks)
    ? data.blocks.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function paginateBlocks(
  blocks: Array<Record<string, unknown>>,
  format: "markdown" | "text" | "structured",
  cursor: BrowserCursor,
  maxChars: number,
): { text: string; blocks: Array<Record<string, unknown>>; next?: BrowserCursor } {
  const output: string[] = [];
  const selected: Array<Record<string, unknown>> = [];
  let remaining = maxChars;
  let blockIndex = cursor.blockIndex;
  let blockOffset = cursor.blockOffset;
  while (blockIndex < blocks.length && remaining > 0) {
    const block = blocks[blockIndex] as Record<string, unknown>;
    const source = format === "text" ? String(block.text ?? "") : String(block.markdown ?? block.text ?? "");
    const separator = output.length > 0 ? "\n\n" : "";
    const available = Math.max(0, remaining - separator.length);
    if (available === 0) break;
    const fragment = source.slice(blockOffset, blockOffset + available);
    output.push(`${separator}${fragment}`);
    selected.push({ ...block, ...(blockOffset > 0 || fragment.length < source.length ? { fragmentOffset: blockOffset } : {}) });
    remaining -= separator.length + fragment.length;
    blockOffset += fragment.length;
    if (blockOffset < source.length) {
      return { text: output.join(""), blocks: selected, next: { ...cursor, blockIndex, blockOffset } };
    }
    blockIndex += 1;
    blockOffset = 0;
  }
  return {
    text: output.join(""),
    blocks: selected,
    ...(blockIndex < blocks.length ? { next: { ...cursor, blockIndex, blockOffset } } : {}),
  };
}

export const handleBrowserOpen: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const url = normalizeHttpUrl(args.url);
  if (args.reuse === true) {
    const existing = listWebViewerLeaves(app).find((leaf) => getWebViewerUrl(leaf) === url);
    if (existing) {
      if (args.focus !== false) app.workspace.setActiveLeaf(existing, { focus: true });
      return { opened: false, reused: true, ...(await browserTabInfo(app, existing)) };
    }
  }
  const requestedLeafId = leafIdFrom(args);
  const leaf = requestedLeafId ? findAnyLeaf(app, requestedLeafId) : resolveBrowserTarget(app, args.target);
  if (!leaf) throw new BridgeError("INVALID_INPUT", `Workspace leaf not found: ${requestedLeafId}`);
  await setWebViewerUrl(leaf, url, signal);
  assertNotAborted(signal);
  if (args.focus !== false) app.workspace.setActiveLeaf(leaf, { focus: true });
  return { opened: true, ...(await browserTabInfo(app, leaf)) };
};

export const handleBrowserNavigate: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = await waitForWebViewReady(leaf, signal);
  const action = typeof args.action === "string" ? args.action : "url";
  let requestedUrl: string | undefined;
  if (action === "url") {
    requestedUrl = normalizeHttpUrl(args.url);
    if (webview?.loadURL) {
      try {
        await webview.loadURL(requestedUrl);
      } catch {
        await setWebViewerUrl(leaf, requestedUrl, signal);
      }
    } else {
      await setWebViewerUrl(leaf, requestedUrl, signal);
    }
  } else if (action === "back") {
    if (!webview?.goBack || webview.canGoBack?.() === false) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web viewer cannot go back");
    webview.goBack();
  } else if (action === "forward") {
    if (!webview?.goForward || webview.canGoForward?.() === false) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web viewer cannot go forward");
    webview.goForward();
  } else if (action === "reload") {
    if (!webview?.reload) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer reload is unavailable");
    webview.reload();
  } else {
    throw new BridgeError("INVALID_INPUT", `Unknown browser navigation action: ${action}`);
  }
  if (typeof args.waitAfterMs === "number") await waitLocal(args.waitAfterMs, signal);
  assertNotAborted(signal);
  return { navigated: true, action, ...(requestedUrl ? { requestedUrl } : {}), ...(await browserTabInfo(app, leaf)) };
};

export const handleBrowserList: OperationHandler = async (_args, signal, app) => {
  assertNotAborted(signal);
  return { tabs: await Promise.all(listWebViewerLeaves(app).map((leaf) => browserTabInfo(app, leaf))) };
};

export const handleBrowserSnapshot: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const result = await runPageOperation(requireWebView(leaf), "snapshot", {
    mode: args.mode,
    scopeSelector: args.scopeSelector,
    ref: args.ref,
    documentId: args.documentId,
    revision: args.revision,
    maxElements: args.maxElements,
    maxTextChars: args.maxTextChars,
    includeHidden: args.includeHidden,
  });
  assertNotAborted(signal);
  return { available: true, ...(await browserTabInfo(app, leaf)), ...result };
};

export const handleBrowserRead: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const maxChars = typeof args.maxChars === "number" ? args.maxChars : DEFAULT_MAX_CHARS;
  if (!Number.isInteger(maxChars) || maxChars <= 0 || maxChars > 100_000) {
    throw new BridgeError("INVALID_INPUT", "browser.read maxChars must be an integer from 1 to 100000");
  }
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  const data = await runPageOperation(webview, "read", {
    scopeSelector: args.scopeSelector,
    ref: args.ref,
    documentId: args.documentId,
    revision: args.revision,
  });
  assertNotAborted(signal);
  const page = asRecord(data.page);
  const documentId = typeof page.documentId === "string" ? page.documentId : "unknown";
  const revision = typeof page.revision === "number" ? page.revision : 0;
  const format = args.format === "text" || args.format === "structured" ? args.format : "markdown";
  const legacyStartIndex = typeof args.startIndex === "number" ? args.startIndex : undefined;
  if (legacyStartIndex !== undefined && (!Number.isInteger(legacyStartIndex) || legacyStartIndex < 0)) {
    throw new BridgeError("INVALID_INPUT", "browser.read startIndex must be a non-negative integer");
  }
  if (legacyStartIndex !== undefined && args.cursor !== undefined) {
    throw new BridgeError("INVALID_INPUT", "browser.read accepts cursor or startIndex, not both");
  }
  const decoded = decodeCursor(args.cursor);
  if (args.cursor !== undefined && !decoded) throw new BridgeError("INVALID_INPUT", "browser.read cursor is invalid");
  if (decoded && (decoded.documentId !== documentId || decoded.revision !== revision)) {
    throw new BridgeError("REVISION_CONFLICT", "Browser page changed; obtain a fresh read cursor");
  }
  const initial: BrowserCursor = decoded ?? { documentId, revision, blockIndex: 0, blockOffset: 0 };
  const blocks = pageBlocks(data);
  const legacyText = legacyStartIndex === undefined
    ? undefined
    : blocks
      .map((block) => format === "text" ? String(block.text ?? "") : String(block.markdown ?? block.text ?? ""))
      .join("\n\n");
  const paged = legacyText === undefined
    ? paginateBlocks(blocks, format, initial, maxChars)
    : {
      text: legacyText.slice(legacyStartIndex ?? 0, (legacyStartIndex ?? 0) + maxChars),
      blocks: [],
    };
  const legacyNextStartIndex = legacyText !== undefined && legacyStartIndex !== undefined
    && legacyStartIndex + paged.text.length < legacyText.length
    ? legacyStartIndex + paged.text.length
    : undefined;
  const includeHtml = args.includeHtml === true;
  let htmlResult: Record<string, unknown> | undefined;
  if (includeHtml) {
    htmlResult = await runPageOperation(webview, "dom", {
      operation: "html",
      cssSelector: args.scopeSelector,
      ref: args.ref,
      documentId: args.documentId,
      revision: args.revision,
      maxChars,
    });
  }
  return {
    available: true,
    ...(await browserTabInfo(app, leaf)),
    ...data,
    blocks: paged.blocks,
    text: paged.text,
    format,
    returnedChars: paged.text.length,
    truncated: Boolean(paged.next) || legacyNextStartIndex !== undefined || data.captureTruncated === true,
    ...(paged.next ? { nextCursor: encodeCursor(paged.next) } : {}),
    ...(legacyStartIndex !== undefined ? { startIndex: legacyStartIndex } : {}),
    ...(legacyNextStartIndex !== undefined ? { nextStartIndex: legacyNextStartIndex } : {}),
    ...(htmlResult ? {
      html: htmlResult.html,
      htmlTruncated: htmlResult.truncated,
      htmlTotalChars: htmlResult.totalChars,
      htmlSanitized: true,
    } : {}),
  };
};

export const handleBrowserDom: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const result = await runPageOperation(requireWebView(leaf), "dom", {
    operation: args.action,
    cssSelector: args.cssSelector,
    ref: args.ref,
    documentId: args.documentId,
    revision: args.revision,
    limit: args.limit,
    maxChars: args.maxChars,
  });
  assertNotAborted(signal);
  return { available: true, ...(await browserTabInfo(app, leaf)), ...result };
};

export const handleBrowserClick: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  const button = args.button === "middle" || args.button === "right" ? args.button : "left";
  const clickCount = args.clickCount === 2 ? 2 : 1;
  let result: Record<string, unknown>;
  if (webview.sendInputEvent) {
    const point = await targetCenter(webview, targetArguments(args));
    await webview.sendInputEvent({ type: "mouseMove", ...point });
    await webview.sendInputEvent({ type: "mouseDown", ...point, button, clickCount });
    await webview.sendInputEvent({ type: "mouseUp", ...point, button, clickCount });
    result = { clicked: true, button, clickCount, point };
  } else if (button === "left" && clickCount === 1) {
    result = await runPageOperation(webview, "click", targetArguments(args));
  } else {
    throw new BridgeError("UNSUPPORTED_OPERATION", "Native Web Viewer pointer input is unavailable");
  }
  assertNotAborted(signal);
  if (typeof args.waitAfterMs === "number") await waitLocal(args.waitAfterMs, signal);
  return { ...(await browserTabInfo(app, leaf)), ...result };
};

export const handleBrowserPointer: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  if (!webview.sendInputEvent) throw new BridgeError("UNSUPPORTED_OPERATION", "Native Web Viewer pointer input is unavailable");
  const action = typeof args.action === "string" ? args.action : "";
  const start = args.ref || args.cssSelector || args.role || args.text
    ? await targetCenter(webview, targetArguments(args))
    : viewportCenter(webview);
  if (action === "hover") {
    await webview.sendInputEvent({ type: "mouseMove", ...start });
    return { hovered: true, point: start, ...(await browserTabInfo(app, leaf)) };
  }
  if (action === "scroll") {
    const deltaX = typeof args.deltaX === "number" ? args.deltaX : 0;
    const deltaY = typeof args.deltaY === "number" ? args.deltaY : 0;
    await webview.sendInputEvent({ type: "mouseWheel", ...start, deltaX, deltaY, canScroll: true });
    return { scrolled: true, point: start, deltaX, deltaY, ...(await browserTabInfo(app, leaf)) };
  }
  if (action === "drag") {
    const end = typeof args.toX === "number" && typeof args.toY === "number"
      ? { x: Math.round(args.toX), y: Math.round(args.toY) }
      : await targetCenter(webview, destinationArguments(args));
    const button = args.button === "middle" || args.button === "right" ? args.button : "left";
    const steps = typeof args.steps === "number" ? args.steps : 8;
    await webview.sendInputEvent({ type: "mouseMove", ...start });
    await webview.sendInputEvent({ type: "mouseDown", ...start, button, clickCount: 1 });
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      await webview.sendInputEvent({
        type: "mouseMove",
        x: Math.round(start.x + (end.x - start.x) * progress),
        y: Math.round(start.y + (end.y - start.y) * progress),
        button,
      });
    }
    await webview.sendInputEvent({ type: "mouseUp", ...end, button, clickCount: 1 });
    return { dragged: true, from: start, to: end, button, steps, ...(await browserTabInfo(app, leaf)) };
  }
  throw new BridgeError("INVALID_INPUT", `Unknown browser pointer action: ${action}`);
};

export const handleBrowserType: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const result = await runPageOperation(requireWebView(leaf), "fill", {
    ...targetArguments(args),
    value: args.text,
    clear: args.clear,
    submit: args.submit,
  });
  assertNotAborted(signal);
  return { ...(await browserTabInfo(app, leaf)), ...result };
};

export const handleBrowserPress: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  if (args.ref || args.cssSelector || args.role || args.text) {
    await runPageOperation(webview, "focus", targetArguments(args));
  }
  if (!webview.sendInputEvent) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer keyboard input is unavailable");
  const key = typeof args.key === "string" ? args.key : "";
  if (!key) throw new BridgeError("INVALID_INPUT", "browser.press requires key");
  const modifiers = Array.isArray(args.modifiers) ? args.modifiers : [];
  await webview.sendInputEvent({ type: "keyDown", keyCode: key, modifiers });
  await webview.sendInputEvent({ type: "keyUp", keyCode: key, modifiers });
  assertNotAborted(signal);
  const page = await runPageOperation(webview, "page", {});
  return { pressed: true, key, modifiers, ...(await browserTabInfo(app, leaf)), ...page };
};

export const handleBrowserWait: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const result = await runPageOperation(requireWebView(leaf), "wait", {
    cssSelector: args.cssSelector,
    text: args.text,
    url: args.url,
    urlIncludes: args.urlIncludes,
    state: args.state,
    visible: args.visible,
    hidden: args.hidden,
    stableMs: args.stableMs,
    timeoutMs: typeof args.timeoutMs === "number" ? args.timeoutMs : DEFAULT_WAIT_TIMEOUT_MS,
  });
  assertNotAborted(signal);
  return { ...(await browserTabInfo(app, leaf)), ...result };
};

export const handleBrowserScreenshot: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  if (!webview.capturePage) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page capture is unavailable");
  let rect: { x: number; y: number; width: number; height: number } | undefined;
  if (args.ref || args.cssSelector || args.role || args.text) {
    const boundsResult = await runPageOperation(webview, "bounds", targetArguments(args));
    const element = asRecord(boundsResult.element);
    const bounds = asRecord(element.bounds);
    if ([bounds.x, bounds.y, bounds.width, bounds.height].every((value) => typeof value === "number")) {
      rect = {
        x: Math.max(0, Math.floor(bounds.x as number)),
        y: Math.max(0, Math.floor(bounds.y as number)),
        width: Math.max(1, Math.floor(bounds.width as number)),
        height: Math.max(1, Math.floor(bounds.height as number)),
      };
    }
  }
  const image = await webview.capturePage(rect);
  assertNotAborted(signal);
  const bytes = image.toPNG();
  const size = image.getSize?.();
  return {
    captured: true,
    mimeType: "image/png",
    data: Buffer.from(bytes).toString("base64"),
    bytes: bytes.byteLength,
    ...(size ? { width: size.width, height: size.height } : {}),
    ...(await browserTabInfo(app, leaf)),
  };
};

export const handleBrowserClose: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = leafIdFrom(args);
  const leaf = findBrowserLeaf(app, leafId);
  if (!leaf) return { closed: false, alreadyClosed: true, ...(leafId ? { leafId } : {}) };
  const tab = await browserTabInfo(app, leaf);
  leaf.detach();
  return { closed: true, tab };
};
