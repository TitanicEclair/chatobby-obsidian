/** @see docs/api/browser.md — rendered-surface capture and request/target lifetime. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { createBrowserApp, createFakeLeaf, createFakeWebView, disposeBrowserApps, renderWebView } from "./helpers/browser-fixture";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function fixture() {
  const app = createBrowserApp();
  await app.leaf.setViewState({ type: "webviewer", state: { url: "https://example.com" } });
  const webview = renderWebView(app.leaf);
  const controller = new AbortController();
  const capture = (args: Record<string, unknown> = {}) => executeOperation("browser.screenshot", { leafId: app.leaf.id, ...args }, controller.signal, app);
  return { app, webview, controller, capture };
}

function image() {
  return { toPNG: vi.fn(() => new Uint8Array([137, 80, 78, 71])), getSize: () => ({ width: 800, height: 600 }) };
}

afterEach(() => {
  disposeBrowserApps();
  vi.restoreAllMocks();
  document.body.empty();
  delete (globalThis as unknown as Record<string, unknown>).__chatobbyBrowserPageV2_6f5c9f3b;
});

describe("browser screenshot surface and lifetime", () => {
  it.each(["zero-rects", "zero-bounds", "detached", "css-hidden", "host-hidden"])("rejects %s before native capture or metadata without changing focus", async (reason) => {
    const { app, webview, capture } = await fixture();
    const focus = vi.spyOn(app.workspace, "setActiveLeaf");
    if (reason === "zero-rects") webview.getClientRects = () => [] as unknown as DOMRectList;
    if (reason === "zero-bounds") webview.getBoundingClientRect = () => new DOMRect();
    if (reason === "detached") webview.remove();
    if (reason === "css-hidden") webview.style.visibility = "hidden";
    if (reason === "host-hidden") vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await expect(capture()).rejects.toMatchObject({ code: reason === "detached" ? "OBSIDIAN_OPERATION_FAILED" : "UNSUPPORTED_OPERATION", retryable: false });
    expect(webview.capturePage).not.toHaveBeenCalled();
    expect(webview.executeJavaScript).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it("captures a visible unfocused split and preserves PNG bytes", async () => {
    const { app, webview, capture } = await fixture();
    const other = createFakeLeaf("other"); app.leaves.push(other);
    vi.spyOn(app.workspace, "getLeaf").mockReturnValue(other);
    const focus = vi.spyOn(app.workspace, "setActiveLeaf");
    await expect(capture()).resolves.toMatchObject({ captured: true, mimeType: "image/png", data: "iVBORw==", bytes: 4, width: 800, height: 600, isActive: false });
    expect(webview.capturePage).toHaveBeenCalledOnce();
    expect(focus).not.toHaveBeenCalled();
  });

  it("preserves selected-element crop coordinates", async () => {
    const { webview, capture } = await fixture();
    await expect(capture({ cssSelector: "article button" })).resolves.toMatchObject({ captured: true });
    expect(webview.capturePage).toHaveBeenCalledWith({ x: 10, y: 20, width: 100, height: 30 });
  });

  it("does not dispatch any guest work for an already aborted request", async () => {
    const { webview, controller, capture } = await fixture(); controller.abort();
    await expect(capture()).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
    expect(webview.capturePage).not.toHaveBeenCalled(); expect(webview.executeJavaScript).not.toHaveBeenCalled();
  });

  it.each(["abort", "hide", "replace"])("does not capture after deferred bounds then %s", async (change) => {
    const { app, webview, controller, capture } = await fixture();
    const pending = deferred<unknown>(); vi.mocked(webview.executeJavaScript).mockReturnValue(pending.promise);
    const result = capture({ cssSelector: "button" });
    if (change === "abort") controller.abort();
    else if (change === "hide") webview.getClientRects = () => [] as unknown as DOMRectList;
    else webview.replaceWith(createFakeWebView());
    const assertion = expect(result).rejects.toMatchObject({ code: change === "abort" ? "DEADLINE_EXCEEDED" : change === "hide" ? "UNSUPPORTED_OPERATION" : "WEB_VIEWER_NOT_FOUND" });
    if (change === "abort") await assertion;
    pending.resolve({ element: { bounds: { x: 0, y: 0, width: 10, height: 10 } } });
    await assertion; expect(webview.capturePage).not.toHaveBeenCalled(); expect(app.layoutListenerCount()).toBe(0);
  });

  it.each(["resolve", "reject"])("settles abort while native capture remains pending and ignores late %s", async (completion) => {
    const { webview, controller, capture } = await fixture();
    const pending = deferred<ReturnType<typeof image>>(); vi.mocked(webview.capturePage).mockReturnValue(pending.promise);
    const add = vi.spyOn(controller.signal, "addEventListener"), remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = capture(); controller.abort();
    await expect(result).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
    const nativeImage = image();
    if (completion === "resolve") pending.resolve(nativeImage); else pending.reject(new Error("late native failure"));
    await Promise.resolve(); await Promise.resolve();
    expect(nativeImage.toPNG).not.toHaveBeenCalled(); expect(webview.executeJavaScript).not.toHaveBeenCalled();
    for (const [name, listener] of add.mock.calls.filter(([name]) => name === "abort")) {
      expect(remove.mock.calls.some(([removedName, removedListener]) => removedName === name && removedListener === listener)).toBe(true);
    }
  });

  it.each(["close", "retype", "replace-webview", "replace-view", "replace-guest"])("rejects late capture after target %s", async (change) => {
    const { app, webview, capture } = await fixture();
    let guestId = 1; Object.assign(webview, { getWebContentsId: () => guestId });
    const pending = deferred<ReturnType<typeof image>>(); vi.mocked(webview.capturePage).mockReturnValue(pending.promise);
    const result = capture();
    if (change === "close") app.leaf.detach();
    else if (change === "retype") await app.leaf.setViewState({ type: "markdown", state: {} });
    else if (change === "replace-webview") webview.replaceWith(createFakeWebView());
    else if (change === "replace-view") Object.assign(app.leaf, { view: createFakeLeaf("replacement").view });
    else guestId = 2;
    const nativeImage = image(); pending.resolve(nativeImage);
    await expect(result).rejects.toMatchObject({ code: "WEB_VIEWER_NOT_FOUND" });
    expect(nativeImage.toPNG).not.toHaveBeenCalled(); expect(webview.executeJavaScript).not.toHaveBeenCalled();
  });

  it.each(["abort", "replace"])("settles deferred metadata after %s without serializing image bytes", async (change) => {
    const { webview, controller, capture } = await fixture();
    const nativeImage = image(), metadata = deferred<unknown>();
    vi.mocked(webview.capturePage).mockResolvedValue(nativeImage);
    vi.mocked(webview.executeJavaScript).mockReturnValue(metadata.promise);
    const result = capture();
    await vi.waitFor(() => expect(webview.executeJavaScript).toHaveBeenCalled());
    if (change === "abort") controller.abort(); else webview.replaceWith(createFakeWebView());
    const assertion = expect(result).rejects.toMatchObject({ code: change === "abort" ? "DEADLINE_EXCEEDED" : "WEB_VIEWER_NOT_FOUND" });
    if (change === "abort") await assertion;
    metadata.resolve({ page: {} }); await assertion;
    expect(nativeImage.toPNG).not.toHaveBeenCalled();
  });

  it.each(["empty-bytes", "zero-size", "native-reject"])("rejects %s without a successful screenshot", async (failure) => {
    const { webview, controller, capture } = await fixture();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    if (failure === "native-reject") vi.mocked(webview.capturePage).mockRejectedValue(new Error("native surface unavailable"));
    else vi.mocked(webview.capturePage).mockResolvedValue({ toPNG: () => failure === "empty-bytes" ? new Uint8Array() : new Uint8Array([1]), getSize: () => ({ width: failure === "zero-size" ? 0 : 10, height: 10 }) });
    await expect(capture()).rejects.toThrow(failure === "native-reject" ? "native surface unavailable" : "empty image");
    expect(remove).toHaveBeenCalled();
  });
});
