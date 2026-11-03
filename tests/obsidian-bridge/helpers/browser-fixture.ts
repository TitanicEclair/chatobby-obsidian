import type { App, EventRef, WorkspaceLeaf, ViewState } from "obsidian";
import { vi } from "vitest";
import { executeBrowserPageOperation } from "../../../src/obsidian-bridge/browser/page-runtime";
import { disposeBrowserConsoleCaptures } from "../../../src/obsidian-bridge/browser/console-capture";

const apps = new Set<App>();

export interface FakeWebView extends HTMLElement {
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

export interface FakeLeaf extends WorkspaceLeaf {
  id: string;
  detached: boolean;
}

export function createFakeWebView(): FakeWebView {
  const element = document.createElement("webview") as FakeWebView;
  let runtimeUrl = "https://example.com/";
  let runtimeInstalled = false;
  element.getURL = () => runtimeUrl;
  element.getTitle = () => "Example";
  element.loadURL = async (url: string) => {
    runtimeUrl = url;
  };
  element.executeJavaScript = vi.fn(async (code: string) => {
    if (code.startsWith('window["__chatobbyExecuteBrowserPageV2"]=(')) {
      runtimeInstalled = true;
      return true;
    }
    const prefix = 'window["__chatobbyExecuteBrowserPageV2"]?window["__chatobbyExecuteBrowserPageV2"](';
    const suffix = "):({__chatobbyRuntimeMissing:true})";
    if (!code.startsWith(prefix) || !code.endsWith(suffix)) throw new Error("Unexpected page runtime script");
    if (!runtimeInstalled) return { __chatobbyRuntimeMissing: true };
    const input = JSON.parse(code.slice(prefix.length, -suffix.length)) as Parameters<typeof executeBrowserPageOperation>[0];
    return await executeBrowserPageOperation(input);
  });
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

export function createFakeLeaf(id: string): FakeLeaf {
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

export interface BrowserTestApp extends App {
  leaf: FakeLeaf;
  leaves: FakeLeaf[];
  emitLayoutChange(): void;
  layoutListenerCount(): number;
}

export function createBrowserApp(): BrowserTestApp {
  const article = document.body.createEl("article");
  article.createEl("h1", { text: "Example article" });
  article.createEl("p", { text: "abcdef" });
  article.createEl("button", { text: "Continue" });
  article.createEl("input", { attr: { name: "q", "aria-label": "Search" } });
  for (const element of [article, ...Array.from(article.querySelectorAll<HTMLElement>("*"))]) makeVisible(element);
  const leaf = createFakeLeaf("leaf-1");
  const leaves = [leaf];
  const listeners = new Map<EventRef, () => void>();
  const workspace = {
    on: vi.fn((_name: string, callback: () => void): EventRef => {
      const ref: EventRef = {};
      listeners.set(ref, callback);
      return ref;
    }),
    offref: vi.fn((ref: EventRef) => { listeners.delete(ref); }),
    activeLeaf: leaf,
    getLeavesOfType: (type: string) => leaves.filter((candidate) => !candidate.detached && candidate.getViewState().type === type),
    getLeafById: (id: string) => leaves.find((candidate) => !candidate.detached && candidate.id === id) ?? null,
    getLeaf: () => leaf,
    setActiveLeaf: () => {},
    iterateAllLeaves: (callback: (candidate: FakeLeaf) => void) => leaves.filter((candidate) => !candidate.detached).forEach(callback),
  };
  const app = {
    workspace, leaf, leaves,
    emitLayoutChange: () => { for (const callback of listeners.values()) callback(); },
    layoutListenerCount: () => listeners.size,
  } as unknown as BrowserTestApp;
  apps.add(app);
  return app;
}

export function makeVisible(element: HTMLElement): void {
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

/** Electron capture needs a laid-out guest; happy-dom does not perform layout. */
export function renderWebView(leaf: WorkspaceLeaf): FakeWebView {
  document.body.appendChild(leaf.view.containerEl);
  const webview = leaf.view.containerEl.querySelector("webview") as FakeWebView;
  makeVisible(webview);
  webview.getClientRects = () => [webview.getBoundingClientRect()] as unknown as DOMRectList;
  return webview;
}

export function disposeBrowserApps(): void {
  for (const app of apps) disposeBrowserConsoleCaptures(app);
  apps.clear();
}
