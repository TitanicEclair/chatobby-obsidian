import type { App, WorkspaceLeaf } from "obsidian";
import { BridgeError, type OperationHandler } from "../types";
import { browserTabInfo } from "./tab-state";
import {
  asRecord, assertNotAborted, findBrowserLeaf, getLeafId, getWebViewElement,
  leafIdFrom, requireBrowserLeaf, requireWebView, runPageOperation, targetArguments,
  type NativeImageLike, type WebViewElement,
} from "./webview";

/** Pixel capture requires a rendered guest, including an unfocused visible split. */
function assertRendered(webview: WebViewElement): void {
  const bounds = webview.getBoundingClientRect();
  const style = webview.ownerDocument.defaultView?.getComputedStyle(webview);
  if (!webview.isConnected || webview.ownerDocument.visibilityState === "hidden"
    || webview.getClientRects().length === 0
    || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)
    || bounds.width <= 0 || bounds.height <= 0
    || style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse") {
    throw new BridgeError(
      "UNSUPPORTED_OPERATION",
      "This Web Viewer has no rendered surface for a screenshot. Show this same tab, then retry. Read, snapshot or DOM inspection can inspect the page without pixel capture.",
    );
  }
}

function screenshotTarget(app: App, leaf: WorkspaceLeaf, webview: WebViewElement): () => void {
  const view = leaf.view;
  const leafId = getLeafId(leaf);
  const guestId = webview.getWebContentsId?.();
  return () => {
    if (findBrowserLeaf(app, leafId) !== leaf || leaf.view !== view
      || getWebViewElement(leaf) !== webview
      || (guestId !== undefined && webview.getWebContentsId?.() !== guestId)) {
      throw new BridgeError("WEB_VIEWER_NOT_FOUND", "The Web Viewer changed during screenshot capture. Select the current tab and retry.");
    }
    assertRendered(webview);
  };
}

/** Release this request's wait on abort; Electron's underlying work is not cancellable. */
async function waitForScreenshot<T>(work: () => Promise<T>, signal: AbortSignal, assertCurrent: () => void): Promise<T> {
  assertNotAborted(signal);
  assertCurrent();
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (complete: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      complete();
    };
    const onAbort = (): void => finish(() => reject(new BridgeError("DEADLINE_EXCEEDED", "Browser operation aborted", true)));
    const fail = (error: unknown): void => finish(() => reject(error instanceof Error ? error : new Error(String(error))));
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      if (signal.aborted) { onAbort(); return; }
      void work().then((value) => {
        if (settled) return;
        try {
          assertNotAborted(signal);
          assertCurrent();
          finish(() => resolve(value));
        } catch (error) { fail(error); }
      }, fail);
    } catch (error) { fail(error); }
  });
}

/** @see docs/api/browser.md — screenshot surface, cancellation and target lifetime. */
export const handleBrowserScreenshot: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leaf = requireBrowserLeaf(app, leafIdFrom(args));
  const webview = requireWebView(leaf);
  if (!webview.capturePage) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page capture is unavailable");
  const capturePage = (): Promise<NativeImageLike> => {
    if (!webview.capturePage) throw new BridgeError("UNSUPPORTED_OPERATION", "Web viewer page capture is unavailable");
    return webview.capturePage(rect);
  };
  const assertCurrent = screenshotTarget(app, leaf, webview);
  assertCurrent();
  let rect: { x: number; y: number; width: number; height: number } | undefined;
  if (args.ref || args.cssSelector || args.role || args.text) {
    const result = await waitForScreenshot(() => runPageOperation(webview, "bounds", targetArguments(args)), signal, assertCurrent);
    const bounds = asRecord(asRecord(result.element).bounds);
    if ([bounds.x, bounds.y, bounds.width, bounds.height].every((value) => typeof value === "number" && Number.isFinite(value))) {
      rect = {
        x: Math.max(0, Math.floor(bounds.x as number)),
        y: Math.max(0, Math.floor(bounds.y as number)),
        width: Math.max(1, Math.floor(bounds.width as number)),
        height: Math.max(1, Math.floor(bounds.height as number)),
      };
    }
  }
  // Recheck after bounds lookup: a hidden/replaced guest must never start native capture.
  const image = await waitForScreenshot(capturePage, signal, assertCurrent);
  const tab = await waitForScreenshot(() => browserTabInfo(app, leaf), signal, assertCurrent);
  assertNotAborted(signal);
  assertCurrent();
  const bytes = image.toPNG();
  const size = image.getSize?.();
  if (bytes.byteLength === 0 || (size && (!Number.isFinite(size.width) || !Number.isFinite(size.height)
    || size.width <= 0 || size.height <= 0))) {
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Web Viewer screenshot returned an empty image. Show this same tab and retry.");
  }
  return {
    captured: true,
    mimeType: "image/png",
    data: Buffer.from(bytes).toString("base64"),
    bytes: bytes.byteLength,
    ...(size ? { width: size.width, height: size.height } : {}),
    ...tab,
  };
};
