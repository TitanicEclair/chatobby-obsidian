import type { App, WorkspaceLeaf, ViewState } from "obsidian";
import { describe, expect, it } from "vitest";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";

interface FakeWebView extends HTMLElement {
  getURL: () => string;
  getTitle: () => string;
  loadURL: (url: string) => Promise<void>;
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>;
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
    if (code.includes("totalCandidates")) {
      return {
        ok: true,
        url: runtimeUrl,
        title: "Example",
        totalCandidates: 2,
        returnedElements: 2,
        truncated: false,
        elements: [{ index: 0, selector: "button:nth-of-type(1)", tag: "button", text: "Continue", visible: true }],
      };
    }
    if (code.includes("clicked: true")) {
      return { ok: true, clicked: true, url: runtimeUrl, title: "Example", tag: "button", text: "Continue" };
    }
    if (code.includes("typed: true")) {
      return { ok: true, typed: true, url: runtimeUrl, title: "Example", tag: "input", selector: "input[name=q]" };
    }
    if (code.includes("readyMatches()")) {
      return { ok: true, matched: true, readyState: "complete", url: runtimeUrl, title: "Example" };
    }
    if (code.includes("resultType")) {
      return { ok: true, url: runtimeUrl, title: "Example", resultType: "string", text: "ok", totalChars: 2, truncated: false };
    }
    return {
      ok: true,
      url: runtimeUrl,
      title: "Example",
      text: "abcdef",
      html: "<html><body>abcdef</body></html>",
    };
  };
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
  const leaf = createFakeLeaf("leaf-1");
  const workspace = {
    activeLeaf: leaf,
    getLeavesOfType: (type: string) => (type === "webviewer" && leaf.getViewState().type === "webviewer" ? [leaf] : []),
    getLeaf: () => leaf,
    setActiveLeaf: () => {},
  };
  return { workspace, leaf } as unknown as App & { leaf: FakeLeaf };
}

describe("browser operations", () => {
  const signal = new AbortController().signal;

  it("opens a URL in a webviewer leaf", async () => {
    const app = createBrowserApp();
    const result = await executeOperation("browser.open", { url: "https://example.com", target: "new-tab" }, signal, app) as Record<string, unknown>;
    expect(result).toMatchObject({ opened: true, leafId: "leaf-1", type: "webviewer" });
    expect(app.leaf.getViewState()).toMatchObject({
      type: "webviewer",
      state: { url: "https://example.com/", navigate: true },
    });
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
      text: "abc",
      startIndex: 0,
      totalChars: 6,
      truncated: true,
      nextStartIndex: 3,
      htmlTruncated: true,
    });

    const closed = await executeOperation("browser.close", {}, signal, app) as Record<string, unknown>;
    expect(closed).toMatchObject({ closed: true });
    expect(app.leaf.detached).toBe(true);
  });

  it("navigates, snapshots, interacts, waits, and evaluates in a webviewer leaf", async () => {
    const app = createBrowserApp();
    await executeOperation("browser.open", { url: "https://example.com" }, signal, app);

    const navigated = await executeOperation("browser.navigate", { leafId: "leaf-1", url: "https://example.com/next" }, signal, app) as Record<string, unknown>;
    expect(navigated).toMatchObject({ navigated: true, url: "https://example.com/next" });

    const snapshot = await executeOperation("browser.snapshot", { leafId: "leaf-1", maxElements: 10 }, signal, app) as Record<string, unknown>;
    expect(snapshot).toMatchObject({ available: true, returnedElements: 2 });

    const clicked = await executeOperation("browser.click", { leafId: "leaf-1", cssSelector: "button" }, signal, app) as Record<string, unknown>;
    expect(clicked).toMatchObject({ clicked: true, tag: "button" });

    const typed = await executeOperation("browser.type", { leafId: "leaf-1", cssSelector: "input[name=q]", text: "query" }, signal, app) as Record<string, unknown>;
    expect(typed).toMatchObject({ typed: true, tag: "input" });

    const waited = await executeOperation("browser.wait", { leafId: "leaf-1", text: "Example" }, signal, app) as Record<string, unknown>;
    expect(waited).toMatchObject({ matched: true });

    const evaluated = await executeOperation("browser.evaluate", { leafId: "leaf-1", script: "document.title" }, signal, app) as Record<string, unknown>;
    expect(evaluated).toMatchObject({ resultType: "string", text: "ok" });
  });
});
