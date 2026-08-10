import type { App, WorkspaceLeaf } from "obsidian";
import {
  executeBrowserPageOperation,
  type BrowserPageAction,
  type BrowserPageInput,
} from "../browser/page-runtime";
import {
  BrowserArtifactStore,
  type BrowserSemanticArtifact,
} from "../browser/artifact-store";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";

const WEBVIEWER_TYPE = "webviewer";
const DEFAULT_MAX_CHARS = 24_000;
const SOFT_MAX_CHARS = 32_000;
const HARD_MAX_CHARS = 96_000;
const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
const WEBVIEWER_READY_TIMEOUT_MS = 5_000;
const DEFAULT_POST_ACTION_SETTLE_MS = 100;
const PAGE_RUNTIME_KEY = "__chatobbyExecuteBrowserPageV2";
const browserArtifactStore = new BrowserArtifactStore();
const MAX_BROWSER_CONSOLE_ENTRIES = 200;

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
  webviewAttached: boolean;
  ready: boolean;
  visible: boolean;
  focused: boolean;
  throttling: "unknown";
  page?: Record<string, unknown>;
}

interface BrowserConsoleEntry {
  sequence: number;
  capturedAt: string;
  level: "error" | "warning" | "info" | "debug";
  message: string;
  line?: number;
  sourceId?: string;
}

interface BrowserConsoleCapture {
  webview: WebViewElement;
  observationStartedAt: string;
  nextSequence: number;
  dropped: number;
  entries: BrowserConsoleEntry[];
  listener: EventListener;
}

const browserConsoleCaptures = new Map<string, BrowserConsoleCapture>();

interface BrowserCursor {
  documentId: string;
  revision: number;
  blockIndex: number;
  blockOffset: number;
  format: "markdown" | "text" | "structured";
}

interface BrowserListCursor {
  offset: number;
  fingerprint: string;
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

function redactBrowserConsoleText(value: unknown): string {
  return String(value ?? "")
    .replace(/\b(api[_-]?key|access[_-]?token|authorization|password|secret)\s*[:=]\s*\S+/giu, "$1=<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, "Bearer <redacted>")
    .slice(0, 2_000);
}

function browserConsoleLevel(value: unknown): BrowserConsoleEntry["level"] {
  if (value === "error" || value === 3) return "error";
  if (value === "warning" || value === "warn" || value === 2) return "warning";
  if (value === "debug" || value === 0) return "debug";
  return "info";
}

function ensureBrowserConsoleCapture(leaf: WorkspaceLeaf, webview: WebViewElement): BrowserConsoleCapture {
  const leafId = getLeafId(leaf);
  const existing = browserConsoleCaptures.get(leafId);
  if (existing?.webview === webview) return existing;
  if (existing) existing.webview.removeEventListener("console-message", existing.listener);
  const capture: BrowserConsoleCapture = {
    webview,
    observationStartedAt: new Date().toISOString(),
    nextSequence: 1,
    dropped: 0,
    entries: [],
    listener: () => undefined,
  };
  capture.listener = (rawEvent: Event) => {
    const event = rawEvent as Event & {
      level?: unknown;
      message?: unknown;
      line?: unknown;
      sourceId?: unknown;
    };
    const entry: BrowserConsoleEntry = {
      sequence: capture.nextSequence,
      capturedAt: new Date().toISOString(),
      level: browserConsoleLevel(event.level),
      message: redactBrowserConsoleText(event.message),
      ...(typeof event.line === "number" ? { line: event.line } : {}),
      ...(typeof event.sourceId === "string" ? { sourceId: redactBrowserConsoleText(event.sourceId) } : {}),
    };
    capture.nextSequence += 1;
    capture.entries.push(entry);
    if (capture.entries.length > MAX_BROWSER_CONSOLE_ENTRIES) {
      capture.entries.splice(0, capture.entries.length - MAX_BROWSER_CONSOLE_ENTRIES);
      capture.dropped += 1;
    }
  };
  webview.addEventListener("console-message", capture.listener);
  browserConsoleCaptures.set(leafId, capture);
  return capture;
}

function removeBrowserConsoleCapture(leafId: string): void {
  const capture = browserConsoleCaptures.get(leafId);
  if (!capture) return;
  capture.webview.removeEventListener("console-message", capture.listener);
  browserConsoleCaptures.delete(leafId);
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
  if (webview) ensureBrowserConsoleCapture(leaf, webview);
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
  const container = getLeafContainer(leaf);
  const visible = Boolean(container && container.isConnected && container.getClientRects().length > 0);
  const focused = leaf === getCurrentLeaf(app) && Boolean(container?.contains(document.activeElement));
  return {
    leafId: getLeafId(leaf),
    type: getLeafViewType(leaf),
    isActive: leaf === getCurrentLeaf(app),
    webviewAttached: Boolean(webview && (webview.isConnected || container?.contains(webview))),
    ready: Boolean(webview && isWebViewReady(webview)),
    visible,
    focused,
    throttling: "unknown",
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

async function browserSemanticDigest(leaf: WorkspaceLeaf): Promise<Record<string, unknown> | undefined> {
  const webview = getWebViewElement(leaf);
  if (!webview?.executeJavaScript || webview.isLoading?.() === true) return undefined;
  try {
    const snapshot = await runPageOperation(webview, "snapshot", {
      mode: "all",
      maxElements: 12,
      maxTextChars: 1_200,
      includeHidden: false,
    });
    return {
      page: snapshot.page,
      returnedElements: snapshot.returnedElements,
      truncated: snapshot.truncated,
      elements: snapshot.elements,
    };
  } catch {
    return undefined;
  }
}

async function browserActionState(app: App, leaf: WorkspaceLeaf): Promise<Record<string, unknown>> {
  const tab = await browserTabInfo(app, leaf);
  const delta = await browserSemanticDigest(leaf);
  return {
    ...tab,
    ...(delta ? { semanticDelta: delta } : {}),
  };
}

function pageIdentity(value: Record<string, unknown>): { documentId?: string; revision?: number; url?: string } {
  const page = asRecord(value.page);
  return {
    ...(typeof page.documentId === "string" ? { documentId: page.documentId } : {}),
    ...(typeof page.revision === "number" ? { revision: page.revision } : {}),
    ...(typeof page.url === "string" ? { url: page.url } : {}),
  };
}

function browserActionReceipt(
  action: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  settleMs: number,
): Record<string, unknown> {
  const beforeIdentity = pageIdentity(before);
  const afterIdentity = pageIdentity(after);
  const observedPageChange = beforeIdentity.documentId !== afterIdentity.documentId
    || beforeIdentity.revision !== afterIdentity.revision
    || beforeIdentity.url !== afterIdentity.url;
  return {
    action,
    dispatch: "confirmed",
    postActionCapture: "confirmed",
    observedPageChange,
    settleMs,
    interpretation: observedPageChange
      ? "A page identity, URL, or semantic revision changed after dispatch."
      : "No page identity, URL, or semantic revision change was observed; this does not prove the application ignored the action.",
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
      "WEB_VIEWER_NOT_FOUND",
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
  userGesture = false,
): Promise<Record<string, unknown>> {
  if (!webview.executeJavaScript) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page scripting is unavailable");
  const input: BrowserPageInput = { action, ...operationInput };
  try {
    const invocation = `window[${JSON.stringify(PAGE_RUNTIME_KEY)}]?window[${JSON.stringify(PAGE_RUNTIME_KEY)}](${safeScriptJson(input)}):({__chatobbyRuntimeMissing:true})`;
    let result = asRecord(await webview.executeJavaScript(invocation, userGesture));
    if (result.__chatobbyRuntimeMissing === true) {
      const install = `window[${JSON.stringify(PAGE_RUNTIME_KEY)}]=(${executeBrowserPageOperation.toString()});true`;
      await webview.executeJavaScript(install, false);
      result = asRecord(await webview.executeJavaScript(invocation, userGesture));
    }
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
  return `browser-v2:${encodeURIComponent(JSON.stringify(cursor))}`;
}

function decodeCursor(value: unknown): BrowserCursor | null {
  if (typeof value !== "string" || !value.startsWith("browser-v2:")) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice("browser-v2:".length))) as Partial<BrowserCursor>;
    if (
      typeof parsed.documentId !== "string"
      || !Number.isInteger(parsed.revision)
      || !Number.isInteger(parsed.blockIndex)
      || !Number.isInteger(parsed.blockOffset)
      || (parsed.format !== "markdown" && parsed.format !== "text" && parsed.format !== "structured")
    ) return null;
    return parsed as BrowserCursor;
  } catch {
    return null;
  }
}

function browserListFingerprint(tabs: BrowserTabInfo[]): string {
  let hash = 2_166_136_261;
  const source = tabs.map((tab) => `${tab.leafId}\u001f${tab.url ?? ""}`).join("\u001e");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

function encodeListCursor(cursor: BrowserListCursor): string {
  return `browser-list-v1:${encodeURIComponent(JSON.stringify(cursor))}`;
}

function decodeListCursor(value: unknown): BrowserListCursor | null {
  if (typeof value !== "string" || !value.startsWith("browser-list-v1:")) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value.slice("browser-list-v1:".length))) as Partial<BrowserListCursor>;
    if (!Number.isInteger(parsed.offset) || (parsed.offset ?? -1) < 0 || typeof parsed.fingerprint !== "string") return null;
    return parsed as BrowserListCursor;
  } catch {
    return null;
  }
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

function createArtifact(leafId: string, data: Record<string, unknown>): BrowserSemanticArtifact {
  const page = asRecord(data.page);
  const documentId = typeof page.documentId === "string" ? page.documentId : "";
  const revision = typeof page.revision === "number" ? page.revision : -1;
  if (!documentId || !Number.isInteger(revision) || revision < 0) {
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web Viewer returned an invalid semantic document identity");
  }
  return {
    documentId,
    revision,
    leafId,
    capturedAt: new Date().toISOString(),
    page,
    metadata: asRecord(data.metadata),
    root: asRecord(data.root),
    blocks: recordArray(data.blocks),
    outline: recordArray(data.outline),
    links: recordArray(data.links),
    coverage: asRecord(data.coverage),
    captureTruncated: data.captureTruncated === true,
  };
}

function blockText(block: Record<string, unknown>, format: BrowserCursor["format"]): string {
  if (format === "text") return String(block.text ?? "");
  return String(block.markdown ?? block.text ?? "");
}

function tokenEstimate(characters: number): number {
  return Math.ceil(characters / 3.5);
}

function paginateBlocks(
  blocks: Array<Record<string, unknown>>,
  format: BrowserCursor["format"],
  cursor: BrowserCursor,
  maxChars: number,
): {
  text: string;
  blocks: Array<Record<string, unknown>>;
  next?: BrowserCursor;
  returnedBlockCount: number;
  remainingBlockCount: number;
  estimatedRemainingTokens: number;
} {
  const output: string[] = [];
  const selected: Array<Record<string, unknown>> = [];
  let blockIndex = cursor.blockIndex;
  let blockOffset = cursor.blockOffset;
  const startingBlockIndex = blockIndex;
  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex] as Record<string, unknown>;
    const source = blockText(block, format);
    const separator = output.length > 0 ? "\n\n" : "";
    const currentLength = output.reduce((total, part) => total + part.length, 0);
    const remainingTarget = Math.max(0, maxChars - currentLength - separator.length);
    const remainingSource = source.slice(blockOffset);
    const wholeBlockLimit = Math.min(HARD_MAX_CHARS, Math.max(maxChars, SOFT_MAX_CHARS));
    if (
      output.length > 0
      && remainingSource.length > remainingTarget
      && currentLength + separator.length + remainingSource.length > wholeBlockLimit
    ) break;
    const available = output.length === 0
      ? Math.min(HARD_MAX_CHARS, Math.max(remainingTarget, Math.min(remainingSource.length, SOFT_MAX_CHARS)))
      : Math.min(remainingSource.length, Math.max(remainingTarget, wholeBlockLimit - currentLength - separator.length));
    if (available <= 0) break;
    const fragment = remainingSource.slice(0, available);
    output.push(`${separator}${fragment}`);
    selected.push({ ...block, ...(blockOffset > 0 || fragment.length < source.length ? { fragmentOffset: blockOffset } : {}) });
    blockOffset += fragment.length;
    if (blockOffset < source.length) {
      const remainingCharacters = source.length - blockOffset
        + blocks.slice(blockIndex + 1).reduce((total, candidate) => total + blockText(candidate, format).length + 2, 0);
      return {
        text: output.join(""),
        blocks: selected,
        next: { ...cursor, blockIndex, blockOffset },
        returnedBlockCount: blockIndex - startingBlockIndex + 1,
        remainingBlockCount: blocks.length - blockIndex,
        estimatedRemainingTokens: tokenEstimate(remainingCharacters),
      };
    }
    blockIndex += 1;
    blockOffset = 0;
    if (output.reduce((total, part) => total + part.length, 0) >= maxChars) break;
  }
  const remainingCharacters = blocks
    .slice(blockIndex)
    .reduce((total, candidate) => total + blockText(candidate, format).length + 2, 0);
  return {
    text: output.join(""),
    blocks: selected,
    ...(blockIndex < blocks.length ? { next: { ...cursor, blockIndex, blockOffset } } : {}),
    returnedBlockCount: Math.max(0, blockIndex - startingBlockIndex),
    remainingBlockCount: Math.max(0, blocks.length - blockIndex),
    estimatedRemainingTokens: tokenEstimate(remainingCharacters),
  };
}

export const handleBrowserOpen: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const url = normalizeHttpUrl(args.url);
  if (args.reuse === true) {
    const existing = listWebViewerLeaves(app).find((leaf) => getWebViewerUrl(leaf) === url);
    if (existing) {
      if (args.focus !== false) app.workspace.setActiveLeaf(existing, { focus: true });
      return { opened: false, reused: true, ...(await browserActionState(app, existing)) };
    }
  }
  const requestedLeafId = leafIdFrom(args);
  const leaf = requestedLeafId ? findAnyLeaf(app, requestedLeafId) : resolveBrowserTarget(app, args.target);
  if (!leaf) throw new BridgeError("INVALID_INPUT", `Workspace leaf not found: ${requestedLeafId}`);
  await setWebViewerUrl(leaf, url, signal);
  assertNotAborted(signal);
  if (args.focus !== false) app.workspace.setActiveLeaf(leaf, { focus: true });
  return { opened: true, ...(await browserActionState(app, leaf)) };
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
  return { navigated: true, action, ...(requestedUrl ? { requestedUrl } : {}), ...(await browserActionState(app, leaf)) };
};

export const handleBrowserList: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const limit = typeof args.limit === "number" ? args.limit : 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new BridgeError("INVALID_INPUT", "browser.list limit must be an integer from 1 to 50");
  }
  const tabs = await Promise.all(listWebViewerLeaves(app).map((leaf) => browserTabInfo(app, leaf)));
  tabs.sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.leafId.localeCompare(right.leafId));
  const fingerprint = browserListFingerprint(tabs);
  const decoded = decodeListCursor(args.cursor);
  if (args.cursor !== undefined && !decoded) throw new BridgeError("INVALID_INPUT", "browser.list cursor is invalid");
  if (decoded && decoded.fingerprint !== fingerprint) {
    throw new BridgeError("REVISION_CONFLICT", "Web Viewer tabs changed; start a fresh browser list");
  }
  const offset = decoded?.offset ?? 0;
  const page = tabs.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < tabs.length;
  return {
    tabs: page,
    coverage: {
      kind: "exact",
      returned: page.length,
      total: tabs.length,
      hasMore,
      ...(hasMore ? { nextCursor: encodeListCursor({ offset: nextOffset, fingerprint }) } : {}),
    },
  };
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
  if (!Number.isInteger(maxChars) || maxChars <= 0 || maxChars > HARD_MAX_CHARS) {
    throw new BridgeError("INVALID_INPUT", `browser.read maxChars must be an integer from 1 to ${HARD_MAX_CHARS}`);
  }
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
  if (decoded && decoded.format !== format) {
    throw new BridgeError("INVALID_INPUT", `Browser read cursor is bound to ${decoded.format} output`);
  }
  if (decoded && (args.scopeSelector !== undefined || args.ref !== undefined || args.includeHtml === true)) {
    throw new BridgeError("INVALID_INPUT", "A browser read continuation cannot change scope or request HTML");
  }

  let artifact: BrowserSemanticArtifact;
  let tab: BrowserTabInfo | undefined;
  let data: Record<string, unknown> | undefined;
  let webview: WebViewElement | undefined;
  if (decoded) {
    const retained = browserArtifactStore.get(decoded.documentId, decoded.revision);
    if (!retained) {
      throw new BridgeError(
        "RESULT_EXPIRED",
        "The retained browser document expired; start a fresh browser read",
        true,
      );
    }
    artifact = retained;
  } else {
    const leaf = requireBrowserLeaf(app, leafIdFrom(args));
    webview = requireWebView(leaf);
    data = await runPageOperation(webview, "read", {
      scopeSelector: args.scopeSelector,
      ref: args.ref,
      documentId: args.documentId,
      revision: args.revision,
    });
    assertNotAborted(signal);
    artifact = createArtifact(getLeafId(leaf), data);
    browserArtifactStore.put(artifact);
    tab = await browserTabInfo(app, leaf);
  }

  const initial: BrowserCursor = decoded ?? {
    documentId: artifact.documentId,
    revision: artifact.revision,
    blockIndex: 0,
    blockOffset: 0,
    format,
  };
  const blocks = artifact.blocks;
  const legacyText = legacyStartIndex === undefined
    ? undefined
    : blocks
      .map((block) => blockText(block, format))
      .join("\n\n");
  const paged = legacyText === undefined
    ? paginateBlocks(blocks, format, initial, maxChars)
    : {
      text: legacyText.slice(legacyStartIndex ?? 0, (legacyStartIndex ?? 0) + maxChars),
      blocks: [],
      returnedBlockCount: 0,
      remainingBlockCount: 0,
      estimatedRemainingTokens: tokenEstimate(
        Math.max(0, legacyText.length - ((legacyStartIndex ?? 0) + maxChars)),
      ),
    };
  const legacyNextStartIndex = legacyText !== undefined && legacyStartIndex !== undefined
    && legacyStartIndex + paged.text.length < legacyText.length
    ? legacyStartIndex + paged.text.length
    : undefined;
  const includeHtml = args.includeHtml === true;
  let htmlResult: Record<string, unknown> | undefined;
  if (includeHtml && webview) {
    htmlResult = await runPageOperation(webview, "dom", {
      operation: "html",
      cssSelector: args.scopeSelector,
      ref: args.ref,
      documentId: args.documentId,
      revision: args.revision,
      maxChars,
    });
  }
  const hasMore = Boolean(paged.next) || legacyNextStartIndex !== undefined || artifact.captureTruncated;
  return {
    available: true,
    captureOrigin: decoded ? "retained" : "live",
    servedAt: new Date().toISOString(),
    ...(tab ?? { leafId: artifact.leafId }),
    page: artifact.page,
    metadata: artifact.metadata,
    root: artifact.root,
    outline: artifact.outline,
    links: artifact.links,
    capturedAt: artifact.capturedAt,
    blocks: paged.blocks,
    text: paged.text,
    format,
    returnedChars: paged.text.length,
    truncated: hasMore,
    coverage: {
      kind: artifact.captureTruncated ? "partial" : "exact",
      returned: paged.returnedBlockCount,
      total: blocks.length,
      hasMore,
      remaining: paged.remainingBlockCount,
      estimatedRemainingTokens: paged.estimatedRemainingTokens,
      ...(paged.next ? { nextCursor: encodeCursor(paged.next) } : {}),
      ...(artifact.coverage.warnings ? { warnings: artifact.coverage.warnings } : {}),
    },
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
  const before = await runPageOperation(webview, "page", {});
  const button = args.button === "middle" || args.button === "right" ? args.button : "left";
  const clickCount = args.clickCount === 2 ? 2 : 1;
  let result: Record<string, unknown>;
  if (button === "left" && clickCount === 1) {
    const clicked = await runPageOperation(webview, "click", targetArguments(args), true);
    result = { ...clicked, button, clickCount, dispatchMethod: "semantic-user-gesture" };
  } else if (webview.sendInputEvent) {
    const point = await targetCenter(webview, targetArguments(args));
    await webview.sendInputEvent({ type: "mouseMove", ...point });
    await webview.sendInputEvent({ type: "mouseDown", ...point, button, clickCount });
    await webview.sendInputEvent({ type: "mouseUp", ...point, button, clickCount });
    result = { clicked: true, button, clickCount, point, dispatchMethod: "native-pointer" };
  } else {
    throw new BridgeError("UNSUPPORTED_OPERATION", "Native Web Viewer pointer input is unavailable");
  }
  assertNotAborted(signal);
  const settleMs = typeof args.waitAfterMs === "number" ? args.waitAfterMs : DEFAULT_POST_ACTION_SETTLE_MS;
  if (settleMs > 0) await waitLocal(settleMs, signal);
  const after = await browserActionState(app, leaf);
  return { ...result, ...after, actionReceipt: browserActionReceipt("click", before, after, settleMs) };
};

export const handleBrowserPointer: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  const before = await runPageOperation(webview, "page", {});
  if (!webview.sendInputEvent) throw new BridgeError("UNSUPPORTED_OPERATION", "Native Web Viewer pointer input is unavailable");
  const action = typeof args.action === "string" ? args.action : "";
  const start = args.ref || args.cssSelector || args.role || args.text
    ? await targetCenter(webview, targetArguments(args))
    : viewportCenter(webview);
  if (action === "hover") {
    await webview.sendInputEvent({ type: "mouseMove", ...start });
    const after = await browserActionState(app, leaf);
    return { hovered: true, point: start, ...after, actionReceipt: browserActionReceipt("hover", before, after, 0) };
  }
  if (action === "scroll") {
    const deltaX = typeof args.deltaX === "number" ? args.deltaX : 0;
    const deltaY = typeof args.deltaY === "number" ? args.deltaY : 0;
    await webview.sendInputEvent({ type: "mouseWheel", ...start, deltaX, deltaY, canScroll: true });
    await waitLocal(DEFAULT_POST_ACTION_SETTLE_MS, signal);
    const after = await browserActionState(app, leaf);
    return { scrolled: true, point: start, deltaX, deltaY, ...after, actionReceipt: browserActionReceipt("scroll", before, after, DEFAULT_POST_ACTION_SETTLE_MS) };
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
    await waitLocal(DEFAULT_POST_ACTION_SETTLE_MS, signal);
    const after = await browserActionState(app, leaf);
    return { dragged: true, from: start, to: end, button, steps, ...after, actionReceipt: browserActionReceipt("drag", before, after, DEFAULT_POST_ACTION_SETTLE_MS) };
  }
  throw new BridgeError("INVALID_INPUT", `Unknown browser pointer action: ${action}`);
};

export const handleBrowserType: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  const before = await runPageOperation(webview, "page", {});
  const result = await runPageOperation(webview, "fill", {
    ...targetArguments(args),
    value: args.text,
    clear: args.clear,
    submit: args.submit,
  });
  assertNotAborted(signal);
  await waitLocal(DEFAULT_POST_ACTION_SETTLE_MS, signal);
  const after = await browserActionState(app, leaf);
  return { ...result, ...after, actionReceipt: browserActionReceipt("type", before, after, DEFAULT_POST_ACTION_SETTLE_MS) };
};

export const handleBrowserPress: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  const before = await runPageOperation(webview, "page", {});
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
  await waitLocal(DEFAULT_POST_ACTION_SETTLE_MS, signal);
  const after = await browserActionState(app, leaf);
  return { pressed: true, key, modifiers, ...after, actionReceipt: browserActionReceipt("press", before, after, DEFAULT_POST_ACTION_SETTLE_MS) };
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

export const handleBrowserDiagnostics: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  const capture = ensureBrowserConsoleCapture(leaf, webview);
  const level = typeof args.level === "string" ? args.level : "all";
  const sinceSequence = typeof args.sinceSequence === "number" ? args.sinceSequence : 0;
  const limit = typeof args.limit === "number" ? args.limit : 100;
  const matching = capture.entries.filter((entry) => (
    entry.sequence > sinceSequence && (level === "all" || entry.level === level)
  ));
  const entries = matching.slice(-limit);
  const truncated = entries.length < matching.length || capture.dropped > 0;
  const capturedAt = new Date().toISOString();
  return {
    ...(await browserTabInfo(app, leaf)),
    captureOrigin: "live",
    capturedAt,
    observationStartedAt: capture.observationStartedAt,
    entries,
    dropped: capture.dropped,
    lastSequence: capture.nextSequence - 1,
    emptyMeaning: "No matching Web Viewer guest-console messages were captured since observation began; this does not prove the page emitted no earlier errors.",
    coverage: {
      kind: truncated ? "partial" : "sampled",
      returned: entries.length,
      total: matching.length,
      hasMore: entries.length < matching.length,
    },
  };
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
  browserArtifactStore.deleteLeaf(getLeafId(leaf));
  removeBrowserConsoleCapture(getLeafId(leaf));
  leaf.detach();
  return { closed: true, tab };
};
