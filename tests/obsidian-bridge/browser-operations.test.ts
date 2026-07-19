import type { App, WorkspaceLeaf, ViewState } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeBrowserPageOperation } from "../../src/obsidian-bridge/browser/page-runtime";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";

interface FakeWebView extends HTMLElement {
  getURL: () => string;
  getTitle: () => string;
  loadURL: (url: string) => Promise<void>;
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  isLoading: () => boolean;
  isCrashed: () => boolean;
  sendInputEvent: (event: Record<string, unknown>) => Promise<void>;
  capturePage: () => Promise<{ toPNG: () => Uint8Array; getSize: () => { width: number; height: number } }>;
}

interface FakeLeaf extends WorkspaceLeaf {
  id: string;
  detached: boolean;
}

function createFakeWebView(): FakeWebView {
  const element = document.createElement("webview") as FakeWebView;
  let runtimeUrl = "https://example.com/";
  element.getURL = () => runtimeUrl;
  element.getTitle = () => "Example";
  element.loadURL = async (url: string) => {
    runtimeUrl = url;
  };
  element.executeJavaScript = async (code: string) => {
    const prefix = `(${executeBrowserPageOperation.toString()})(`;
    if (!code.startsWith(prefix) || !code.endsWith(")")) throw new Error("Unexpected page runtime script");
    const input = JSON.parse(code.slice(prefix.length, -1)) as Parameters<typeof executeBrowserPageOperation>[0];
    return await executeBrowserPageOperation(input);
  };
  element.canGoBack = () => true;
  element.canGoForward = () => true;
  element.goBack = vi.fn();
  element.goForward = vi.fn();
  element.reload = vi.fn();
  element.isLoading = () => false;
  element.isCrashed = () => false;
  element.sendInputEvent = vi.fn(async () => undefined);
  element.capturePage = vi.fn(async () => ({
    toPNG: () => new Uint8Array([137, 80, 78, 71]),
    getSize: () => ({ width: 800, height: 600 }),
  }));
  return element;
}

function createFakeLeaf(id: string): FakeLeaf {
  const containerEl = document.createElement("div");
  containerEl.appendChild(createFakeWebView());
  let viewState: ViewState = { type: "empty", state: {} };
  const leaf = {
    id,
    detached: false,
    view: {
      containerEl,
      getViewType: () => viewState.type,
      getDisplayText: () => "Example",
    },
    getViewState: () => viewState,
    setViewState: async (next: ViewState) => {
      viewState = next;
    },
    detach: () => {
      leaf.detached = true;
    },
  } as unknown as FakeLeaf;
  return leaf;
}

function createBrowserApp(): App & { leaf: FakeLeaf } {
  const article = document.body.createEl("article");
  article.createEl("h1", { text: "Example article" });
  article.createEl("p", { text: "abcdef" });
  const button = article.createEl("button", { text: "Continue" });
  const input = article.createEl("input", { attr: { name: "q", "aria-label": "Search" } });
  for (const element of [article, ...Array.from(article.querySelectorAll<HTMLElement>("*"))]) makeVisible(element);
  const leaf = createFakeLeaf("leaf-1");
  const workspace = {
    activeLeaf: leaf,
    getLeavesOfType: (type: string) => (type === "webviewer" && leaf.getViewState().type === "webviewer" ? [leaf] : []),
    getLeafById: (id: string) => id === leaf.id ? leaf : null,
    getLeaf: () => leaf,
    setActiveLeaf: () => {},
    iterateAllLeaves: (callback: (candidate: FakeLeaf) => void) => callback(leaf),
  };
  return { workspace, leaf } as unknown as App & { leaf: FakeLeaf };
}

function makeVisible(element: HTMLElement): void {
  element.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    width: 100,
    height: 30,
    top: 20,
    right: 110,
    bottom: 50,
    left: 10,
    toJSON: () => ({}),
  });
  element.scrollIntoView = vi.fn();
}

afterEach(() => {
  document.body.empty();
  delete (globalThis as unknown as Record<string, unknown>).__chatobbyBrowserPageV1_6f5c9f3b;
});

describe("browser operations", () => {
  const signal = new AbortController().signal;

  it("opens a URL in a webviewer leaf", async () => {
    const app = createBrowserApp();
    const result = await executeOperation("browser.open", { url: "https://example.com", leafId: "leaf-1" }, signal, app) as Record<string, unknown>;
    expect(result).toMatchObject({ opened: true, leafId: "leaf-1", type: "webviewer" });
    expect(app.leaf.getViewState()).toMatchObject({
      type: "webviewer",
      state: { url: "https://example.com/", navigate: true },
    });
  });

  it("recovers when Obsidian creates the Web Viewer before its dom-ready event", async () => {
    const app = createBrowserApp();
    const webview = app.leaf.view.containerEl?.querySelector("webview") as FakeWebView;
    const originalSetViewState = app.leaf.setViewState.bind(app.leaf);
    const notReady = new Error("The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.");
    let ready = false;
    let runtimeUrl = "";
    webview.getURL = () => {
      if (!ready) throw notReady;
      return runtimeUrl;
    };
    webview.loadURL = async (url: string) => {
      runtimeUrl = url;
    };
    app.leaf.setViewState = async (state: ViewState) => {
      await originalSetViewState(state);
      window.setTimeout(() => {
        ready = true;
        webview.dispatchEvent(new Event("dom-ready"));
      }, 0);
      throw notReady;
    };

    const result = await executeOperation(
      "browser.open",
      { url: "https://example.com/ready", leafId: "leaf-1" },
      signal,
      app,
    ) as Record<string, unknown>;

    expect(result).toMatchObject({ opened: true, leafId: "leaf-1", url: "https://example.com/ready" });
  });

  it("creates left and upper Web Viewer splits before the active leaf", async () => {
    const app = createBrowserApp();
    const left = createFakeLeaf("leaf-left");
    const upper = createFakeLeaf("leaf-up");
    const createLeafBySplit = vi.fn()
      .mockReturnValueOnce(left)
      .mockReturnValueOnce(upper);
    (app.workspace as unknown as { createLeafBySplit: typeof createLeafBySplit }).createLeafBySplit = createLeafBySplit;

    const leftResult = await executeOperation(
      "browser.open",
      { url: "https://example.com/left", target: "split-left" },
      signal,
      app,
    ) as Record<string, unknown>;
    const upperResult = await executeOperation(
      "browser.open",
      { url: "https://example.com/up", target: "split-up" },
      signal,
      app,
    ) as Record<string, unknown>;

    expect(createLeafBySplit).toHaveBeenNthCalledWith(1, app.leaf, "vertical", true);
    expect(createLeafBySplit).toHaveBeenNthCalledWith(2, app.leaf, "horizontal", true);
    expect(leftResult).toMatchObject({ opened: true, leafId: "leaf-left" });
    expect(upperResult).toMatchObject({ opened: true, leafId: "leaf-up" });
  });

  it("resolves exact Web Viewer leaf IDs through the canonical workspace lookup", async () => {
    const app = createBrowserApp();
    (app.workspace as unknown as { iterateAllLeaves: (callback: (leaf: FakeLeaf) => void) => void }).iterateAllLeaves = () => {};

    await executeOperation("browser.open", { url: "https://example.com", leafId: "leaf-1" }, signal, app);
    const result = await executeOperation(
      "workspace.manage",
      { action: "close", leafId: "leaf-1" },
      signal,
      app,
    ) as Record<string, unknown>;

    expect(result).toMatchObject({ applied: true, leafId: "leaf-1" });
    expect(app.leaf.detached).toBe(true);
  });

  it("lists, reads, and closes webviewer leaves", async () => {
    const app = createBrowserApp();
    await executeOperation("browser.open", { url: "https://example.com" }, signal, app);

    const listed = await executeOperation("browser.list", {}, signal, app) as { tabs: Array<Record<string, unknown>> };
    expect(listed.tabs).toHaveLength(1);
    expect(listed.tabs[0]).toMatchObject({ leafId: "leaf-1", url: "https://example.com/" });

    const read = await executeOperation("browser.read", { maxChars: 3, includeHtml: true }, signal, app) as Record<string, unknown>;
    expect(read).toMatchObject({
      available: true,
      text: "# E",
      truncated: true,
      htmlTruncated: true,
      htmlSanitized: true,
    });
    expect(read).toHaveProperty("nextCursor");

    const legacyRead = await executeOperation(
      "browser.read",
      { startIndex: 2, maxChars: 3 },
      signal,
      app,
    ) as Record<string, unknown>;
    expect(legacyRead).toMatchObject({ text: "Exa", startIndex: 2, nextStartIndex: 5, truncated: true });

    const closed = await executeOperation("browser.close", {}, signal, app) as Record<string, unknown>;
    expect(closed).toMatchObject({ closed: true });
    expect(app.leaf.detached).toBe(true);
  });

  it("navigates, snapshots, interacts, and waits in a webviewer leaf", async () => {
    const app = createBrowserApp();
    await executeOperation("browser.open", { url: "https://example.com" }, signal, app);

    const navigated = await executeOperation("browser.navigate", { leafId: "leaf-1", url: "https://example.com/next" }, signal, app) as Record<string, unknown>;
    expect(navigated).toMatchObject({ navigated: true, url: "https://example.com/next" });

    const snapshot = await executeOperation("browser.snapshot", { leafId: "leaf-1", maxElements: 10 }, signal, app) as Record<string, unknown>;
    expect(snapshot).toMatchObject({ available: true });
    expect(Number(snapshot.returnedElements)).toBeGreaterThanOrEqual(2);

    const clicked = await executeOperation("browser.click", { leafId: "leaf-1", role: "button", name: "Continue", strict: true }, signal, app) as Record<string, unknown>;
    expect(clicked).toMatchObject({ clicked: true, button: "left", clickCount: 1 });

    const rightClicked = await executeOperation(
      "browser.click",
      { leafId: "leaf-1", role: "button", name: "Continue", button: "right", clickCount: 2 },
      signal,
      app,
    ) as Record<string, unknown>;
    expect(rightClicked).toMatchObject({ clicked: true, button: "right", clickCount: 2 });

    const hovered = await executeOperation(
      "browser.pointer",
      { leafId: "leaf-1", action: "hover", role: "button", name: "Continue" },
      signal,
      app,
    ) as Record<string, unknown>;
    expect(hovered).toMatchObject({ hovered: true });

    const scrolled = await executeOperation(
      "browser.pointer",
      { leafId: "leaf-1", action: "scroll", deltaY: 500 },
      signal,
      app,
    ) as Record<string, unknown>;
    expect(scrolled).toMatchObject({ scrolled: true, deltaY: 500 });

    const dragged = await executeOperation(
      "browser.pointer",
      { leafId: "leaf-1", action: "drag", role: "button", name: "Continue", toX: 200, toY: 150, steps: 3 },
      signal,
      app,
    ) as Record<string, unknown>;
    expect(dragged).toMatchObject({ dragged: true, to: { x: 200, y: 150 }, steps: 3 });

    const typed = await executeOperation("browser.type", { leafId: "leaf-1", role: "textbox", name: "Search", text: "query", strict: true }, signal, app) as Record<string, unknown>;
    expect(typed).toMatchObject({ filled: true });
    expect((document.querySelector("input[name=q]") as HTMLInputElement).value).toBe("query");

    const waited = await executeOperation("browser.wait", { leafId: "leaf-1", text: "abcdef" }, signal, app) as Record<string, unknown>;
    expect(waited).toMatchObject({ matched: true });

    const exactUrlWait = await executeOperation(
      "browser.wait",
      { leafId: "leaf-1", url: window.location.href },
      signal,
      app,
    ) as Record<string, unknown>;
    expect(exactUrlWait).toMatchObject({ matched: true });

  });

  it("supports structured DOM inspection, keyboard input, screenshots, and history", async () => {
    const app = createBrowserApp();
    await executeOperation("browser.open", { url: "https://example.com" }, signal, app);

    const dom = await executeOperation("browser.dom", { action: "query", cssSelector: "article button" }, signal, app) as Record<string, unknown>;
    expect(dom).toMatchObject({ available: true, totalMatches: 1 });

    const press = await executeOperation("browser.press", { cssSelector: "input[name=q]", key: "Enter" }, signal, app) as Record<string, unknown>;
    expect(press).toMatchObject({ pressed: true, key: "Enter" });

    const screenshot = await executeOperation("browser.screenshot", {}, signal, app) as Record<string, unknown>;
    expect(screenshot).toMatchObject({ captured: true, mimeType: "image/png", bytes: 4, width: 800, height: 600 });
    expect(typeof screenshot.data).toBe("string");

    await executeOperation("browser.navigate", { action: "back" }, signal, app);
    const webview = app.leaf.view.containerEl?.querySelector("webview") as FakeWebView;
    expect(webview.goBack).toHaveBeenCalledOnce();
  });

  it("redacts password values and sanitizes page HTML", async () => {
    const app = createBrowserApp();
    await executeOperation("browser.open", { url: "https://example.com" }, signal, app);
    const password = document.body.createEl("input", { attr: { type: "password", value: "secret", name: "password" } });
    makeVisible(password);
    document.body.createEl("script", { text: "window.secret = true" });

    const snapshot = await executeOperation("browser.snapshot", { mode: "interactive", includeHidden: true }, signal, app) as { elements: Array<Record<string, unknown>> };
    const passwordNode = snapshot.elements.find((element) => element.inputType === "password");
    expect(passwordNode?.value).toBe("[redacted]");

    const dom = await executeOperation("browser.dom", { action: "html", cssSelector: "body", maxChars: 20_000 }, signal, app) as Record<string, unknown>;
    expect(dom.html).not.toContain("window.secret");
    expect(dom.html).not.toContain('value="secret"');
  });
});
