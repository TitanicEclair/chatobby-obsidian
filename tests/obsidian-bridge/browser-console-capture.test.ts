/** @see docs/api/browser.md — demand observation, disposal and diagnostic bounds. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disposeBrowserConsoleCaptures,
  ensureBrowserConsoleCapture,
} from "../../src/obsidian-bridge/browser/console-capture";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { createBrowserApp, createFakeLeaf, createFakeWebView, disposeBrowserApps, type BrowserTestApp } from "./helpers/browser-fixture";

function webviewOf(app: BrowserTestApp): HTMLElement {
  const webview = app.leaf.view.containerEl.querySelector("webview");
  if (!(webview instanceof HTMLElement)) throw new Error("Expected fixture Web Viewer");
  return webview;
}

function emitConsole(webview: HTMLElement, message: string, level: string | number = "info", sourceId?: string): void {
  const event = Object.assign(new Event("console-message"), { message, level, sourceId });
  webview.dispatchEvent(event);
}

afterEach(() => {
  disposeBrowserApps();
  document.body.empty();
  delete (globalThis as unknown as Record<string, unknown>).__chatobbyBrowserPageV2_6f5c9f3b;
});

describe("browser console capture lifecycle", () => {
  const signal = new AbortController().signal;

  it("starts on demand and reuses one listener across repeated operations", async () => {
    const app = createBrowserApp();
    const webview = webviewOf(app);
    const add = vi.spyOn(webview, "addEventListener");
    app.emitLayoutChange();
    expect(app.layoutListenerCount()).toBe(0);
    await executeOperation("browser.open", { url: "https://example.com" }, signal, app);
    await executeOperation("browser.list", {}, signal, app);
    const capture = ensureBrowserConsoleCapture(app, app.leaf, webview);
    emitConsole(webview, "one observation");
    expect(capture.entries).toHaveLength(1);
    expect(add.mock.calls.filter(([event]) => event === "console-message")).toHaveLength(1);
    expect(app.layoutListenerCount()).toBe(1);
  });

  it.each(["close", "replace-view", "replace-webview"])("releases stale observation after external %s", async (change) => {
    const app = createBrowserApp();
    await app.leaf.setViewState({ type: "webviewer", state: {} });
    const webview = webviewOf(app);
    const capture = ensureBrowserConsoleCapture(app, app.leaf, webview);
    emitConsole(webview, "before change");
    const remove = vi.spyOn(webview, "removeEventListener");
    if (change === "close") app.leaf.detach();
    else if (change === "replace-view") await app.leaf.setViewState({ type: "markdown", state: {} });
    else webview.replaceWith(createFakeWebView());
    app.emitLayoutChange();
    expect(remove).toHaveBeenCalledWith("console-message", capture.listener);
    emitConsole(webview, "stale content");
    expect(capture.entries.map((entry) => entry.message)).toEqual(["before change"]);
    expect(capture.nextSequence).toBe(2);
    expect(() => ensureBrowserConsoleCapture(app, app.leaf, webview)).toThrow("changed before console observation");
    emitConsole(webview, "late operation");
    expect(capture.nextSequence).toBe(2);
  });

  it("replaces a webview on demand before a layout event without retaining its logs", async () => {
    const app = createBrowserApp();
    await app.leaf.setViewState({ type: "webviewer", state: {} });
    const oldWebview = webviewOf(app);
    const oldCapture = ensureBrowserConsoleCapture(app, app.leaf, oldWebview);
    const replacement = createFakeWebView();
    oldWebview.replaceWith(replacement);
    const newCapture = ensureBrowserConsoleCapture(app, app.leaf, replacement);
    expect(() => ensureBrowserConsoleCapture(app, app.leaf, oldWebview)).toThrow("changed before console observation");
    emitConsole(oldWebview, "stale");
    emitConsole(replacement, "current");
    expect(oldCapture.entries).toEqual([]);
    expect(newCapture.entries.map((entry) => entry.message)).toEqual(["current"]);
    expect(newCapture.entries[0]?.sequence).toBe(1);
  });

  it("releases capture on bridge close without waiting for a layout event", async () => {
    const app = createBrowserApp();
    await executeOperation("browser.open", { url: "https://example.com" }, signal, app);
    const webview = webviewOf(app);
    const capture = ensureBrowserConsoleCapture(app, app.leaf, webview);
    await executeOperation("browser.close", {}, signal, app);
    emitConsole(webview, "after close");
    expect(capture.entries).toEqual([]);
  });

  it("isolates identical leaf IDs across Apps and disposes once without restarting late observations", async () => {
    const first = createBrowserApp();
    const second = createBrowserApp();
    await first.leaf.setViewState({ type: "webviewer", state: {} });
    await second.leaf.setViewState({ type: "webviewer", state: {} });
    const firstWebview = webviewOf(first);
    const secondWebview = webviewOf(second);
    const firstCapture = ensureBrowserConsoleCapture(first, first.leaf, firstWebview);
    const secondCapture = ensureBrowserConsoleCapture(second, second.leaf, secondWebview);
    emitConsole(firstWebview, "first");
    emitConsole(secondWebview, "second");
    disposeBrowserConsoleCaptures(first);
    disposeBrowserConsoleCaptures(first);
    expect(first.layoutListenerCount()).toBe(0);
    expect(first.workspace.offref).toHaveBeenCalledOnce();
    emitConsole(firstWebview, "after unload");
    emitConsole(secondWebview, "still active");
    expect(firstCapture.entries.map((entry) => entry.message)).toEqual(["first"]);
    expect(secondCapture.entries.map((entry) => entry.message)).toEqual(["second", "still active"]);
    expect(() => ensureBrowserConsoleCapture(first, first.leaf, firstWebview)).toThrow("disposed");
    expect(second.layoutListenerCount()).toBe(1);
  });

  it("retains the newest 200 redacted messages with monotonic sequences and dropped counts", async () => {
    const app = createBrowserApp();
    await app.leaf.setViewState({ type: "webviewer", state: {} });
    const webview = webviewOf(app);
    const capture = ensureBrowserConsoleCapture(app, app.leaf, webview);
    for (let index = 0; index < 205; index += 1) emitConsole(webview, `message ${index}`);
    emitConsole(webview, "api_key=private Bearer abc.123 password:secret", 3, "authorization=private");
    emitConsole(webview, "x".repeat(2_100), 0);
    expect(capture.entries).toHaveLength(200);
    expect(capture.entries[0]).toMatchObject({ sequence: 8, message: "message 7" });
    expect(capture.entries[198]).toMatchObject({
      sequence: 206, level: "error", message: "api_key=<redacted> Bearer <redacted> password=<redacted>",
      sourceId: "authorization=<redacted>",
    });
    expect(capture.entries[199]?.message).toHaveLength(2_000);
    expect(capture.dropped).toBe(7);
    const diagnostic = await executeOperation("browser.diagnostics", { level: "error", sinceSequence: 205 }, signal, app);
    expect(diagnostic).toMatchObject({ dropped: 7, lastSequence: 207, coverage: { kind: "partial", returned: 1, total: 1 } });
  });

  it("disposes every leaf buffer synchronously", async () => {
    const app = createBrowserApp();
    await app.leaf.setViewState({ type: "webviewer", state: {} });
    const first = webviewOf(app);
    const otherLeaf = createFakeLeaf("other-leaf");
    await otherLeaf.setViewState({ type: "webviewer", state: {} });
    app.leaves.push(otherLeaf);
    const other = createFakeWebView();
    otherLeaf.view.containerEl.replaceChildren(other);
    const captures = [
      ensureBrowserConsoleCapture(app, app.leaf, first),
      ensureBrowserConsoleCapture(app, otherLeaf, other),
    ];
    disposeBrowserConsoleCaptures(app);
    emitConsole(first, "late first");
    emitConsole(other, "late other");
    expect(captures.map((capture) => capture.entries)).toEqual([[], []]);
    expect(app.layoutListenerCount()).toBe(0);
  });
});
