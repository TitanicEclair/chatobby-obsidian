import type { App, WorkspaceLeaf } from "obsidian";
import { executeBrowserPageOperation, type BrowserPageAction, type BrowserPageInput } from "./page-runtime";
import { BridgeError } from "../types";

const WEBVIEWER_TYPE = "webviewer";
const WEBVIEWER_READY_TIMEOUT_MS = 5_000;
const PAGE_RUNTIME_KEY = "__chatobbyExecuteBrowserPageV2";

interface WebViewerState {
  url?: string;
  navigate?: boolean;
}

export interface NativeImageLike {
  toPNG(): Uint8Array;
  getSize?(): { width: number; height: number };
}

export interface WebViewElement extends HTMLElement {
  getWebContentsId?: () => number;
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

interface WorkspaceWithRecentLeaf {
  getMostRecentLeaf?: () => WorkspaceLeaf | null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeScriptJson(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new BridgeError("DEADLINE_EXCEEDED", "Browser operation aborted", true);
}

export function getLeafId(leaf: WorkspaceLeaf): string {
  return (leaf as unknown as { id?: string }).id ?? "";
}

export function getCurrentLeaf(app: App): WorkspaceLeaf {
  const workspace = app.workspace as WorkspaceWithRecentLeaf;
  return workspace.getMostRecentLeaf?.() ?? app.workspace.getLeaf(false);
}

export function getLeafViewType(leaf: WorkspaceLeaf): string {
  const view = leaf.view as unknown as { getViewType?: () => string };
  return view.getViewType?.() ?? leaf.getViewState().type;
}

export function getLeafContainer(leaf: WorkspaceLeaf): HTMLElement | null {
  const view = leaf.view as unknown as { containerEl?: HTMLElement };
  return view.containerEl ?? null;
}

export function getWebViewElement(leaf: WorkspaceLeaf): WebViewElement | null {
  return getLeafContainer(leaf)?.querySelector("webview") as WebViewElement | null;
}

export function safeWebViewValue<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

export function isWebViewReady(webview: WebViewElement): boolean {
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

export async function waitForWebViewReady(
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

export async function setWebViewerUrl(leaf: WorkspaceLeaf, url: string, signal: AbortSignal): Promise<WebViewElement> {
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

export function normalizeHttpUrl(value: unknown): string {
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

export function getWebViewerUrl(leaf: WorkspaceLeaf): string | undefined {
  const webview = getWebViewElement(leaf);
  const runtimeUrl = webview?.getURL ? safeWebViewValue(() => webview.getURL?.()) : undefined;
  if (runtimeUrl) return runtimeUrl;
  const state = asRecord(leaf.getViewState().state) as WebViewerState;
  return typeof state.url === "string" ? state.url : undefined;
}

export function getWebViewerTitle(leaf: WorkspaceLeaf): string | undefined {
  const webview = getWebViewElement(leaf);
  const title = webview?.getTitle ? safeWebViewValue(() => webview.getTitle?.()) : undefined;
  if (title) return title;
  const viewTitle = (leaf.view as unknown as { getDisplayText?: () => string }).getDisplayText?.();
  return viewTitle || undefined;
}

function isWebViewerLeaf(leaf: WorkspaceLeaf): boolean {
  return getLeafViewType(leaf) === WEBVIEWER_TYPE;
}

export function listWebViewerLeaves(app: App): WorkspaceLeaf[] {
  return app.workspace.getLeavesOfType(WEBVIEWER_TYPE);
}

export function findAnyLeaf(app: App, leafId: string): WorkspaceLeaf | null {
  const direct = app.workspace.getLeafById(leafId);
  if (direct) return direct;
  let found: WorkspaceLeaf | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (getLeafId(leaf) === leafId) found = leaf;
  });
  return found;
}

export function findBrowserLeaf(app: App, leafId?: string): WorkspaceLeaf | null {
  const leaves = listWebViewerLeaves(app);
  if (leafId) return leaves.find((leaf) => getLeafId(leaf) === leafId) ?? null;
  const active = getCurrentLeaf(app);
  if (active && isWebViewerLeaf(active)) return active;
  return leaves[0] ?? null;
}

export function resolveBrowserTarget(app: App, target: unknown): WorkspaceLeaf {
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

export function requireBrowserLeaf(app: App, leafId: string | undefined): WorkspaceLeaf {
  const leaf = findBrowserLeaf(app, leafId);
  if (!leaf) {
    throw new BridgeError(
      "WEB_VIEWER_NOT_FOUND",
      leafId ? `No Web viewer tab found for leafId ${leafId}` : "No Web viewer tab is open",
    );
  }
  return leaf;
}

export function requireWebView(leaf: WorkspaceLeaf): WebViewElement {
  const webview = getWebViewElement(leaf);
  if (!webview) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web viewer tab has no accessible webview element");
  if (!webview.executeJavaScript) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page scripting is unavailable");
  return webview;
}

export async function runPageOperation(
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

export async function waitLocal(ms: number, signal: AbortSignal): Promise<void> {
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

export function leafIdFrom(args: Record<string, unknown>): string | undefined {
  return typeof args.leafId === "string" ? args.leafId : undefined;
}

export function targetArguments(args: Record<string, unknown>): Record<string, unknown> {
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

export function destinationArguments(args: Record<string, unknown>): Record<string, unknown> {
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

export async function targetCenter(webview: WebViewElement, target: Record<string, unknown>): Promise<BrowserPoint> {
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

export function viewportCenter(webview: WebViewElement): BrowserPoint {
  return { x: Math.max(0, Math.round(webview.clientWidth / 2)), y: Math.max(0, Math.round(webview.clientHeight / 2)) };
}
