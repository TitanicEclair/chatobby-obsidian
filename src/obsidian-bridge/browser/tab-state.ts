import type { App, WorkspaceLeaf } from "obsidian";
import { ensureBrowserConsoleCapture } from "./console-capture";
import {
  asRecord, getCurrentLeaf, getLeafContainer, getLeafId, getLeafViewType,
  getWebViewElement, getWebViewerTitle, getWebViewerUrl, isWebViewReady,
  runPageOperation, safeWebViewValue,
} from "./webview";

export interface BrowserTabInfo {
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

export async function browserTabInfo(app: App, leaf: WorkspaceLeaf): Promise<BrowserTabInfo> {
  const webview = getWebViewElement(leaf);
  if (webview) ensureBrowserConsoleCapture(app, leaf, webview);
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

export async function browserActionState(app: App, leaf: WorkspaceLeaf): Promise<Record<string, unknown>> {
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

export function browserActionReceipt(
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
