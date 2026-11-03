import { browserActionReceipt, browserActionState, browserTabInfo } from "../browser/tab-state";
import { ensureBrowserConsoleCapture, removeBrowserConsoleCapture } from "../browser/console-capture";
import { browserListFingerprint, decodeListCursor, encodeListCursor } from "../browser/read-pagination";
import {
  assertNotAborted, destinationArguments, findAnyLeaf, findBrowserLeaf,
  getLeafId, getWebViewerUrl, leafIdFrom, listWebViewerLeaves, normalizeHttpUrl,
  requireBrowserLeaf, requireWebView, resolveBrowserTarget, runPageOperation,
  setWebViewerUrl, targetArguments, targetCenter, viewportCenter,
  waitForWebViewReady, waitLocal,
} from "../browser/webview";
import { removeBrowserReadArtifacts } from "./browser-read";
import { BridgeError, type OperationHandler } from "../types";

export { handleBrowserRead } from "./browser-read";
export { handleBrowserScreenshot } from "../browser/screenshot";

const DEFAULT_WAIT_TIMEOUT_MS = 5_000;
const DEFAULT_POST_ACTION_SETTLE_MS = 100;

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
  const capture = ensureBrowserConsoleCapture(app, leaf, webview);
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

export const handleBrowserClose: OperationHandler = async (args, signal, app) => {
  assertNotAborted(signal);
  const leafId = leafIdFrom(args);
  const leaf = findBrowserLeaf(app, leafId);
  if (!leaf) return { closed: false, alreadyClosed: true, ...(leafId ? { leafId } : {}) };
  const tab = await browserTabInfo(app, leaf);
  removeBrowserReadArtifacts(getLeafId(leaf));
  removeBrowserConsoleCapture(app, getLeafId(leaf));
  leaf.detach();
  return { closed: true, tab };
};
