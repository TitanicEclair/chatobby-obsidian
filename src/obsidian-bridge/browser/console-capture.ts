import type { App, EventRef, WorkspaceLeaf } from "obsidian";
import { BridgeError } from "../types";
import { getLeafId, getWebViewElement, listWebViewerLeaves, type WebViewElement } from "./webview";

const MAX_BROWSER_CONSOLE_ENTRIES = 200;

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

// Observation starts only on an explicit browser operation, never on layout events.
class BrowserConsoleCaptureService {
  private readonly captures = new Map<string, BrowserConsoleCapture>();
  private readonly layoutRef: EventRef;

  constructor(private readonly app: App) {
    this.layoutRef = app.workspace.on("layout-change", () => this.reconcile());
  }

  ensure(leaf: WorkspaceLeaf, webview: WebViewElement): BrowserConsoleCapture {
    const leafId = getLeafId(leaf);
    const existing = this.captures.get(leafId);
    if (!listWebViewerLeaves(this.app).includes(leaf) || getWebViewElement(leaf) !== webview) {
      if (existing?.webview === webview) this.remove(leafId);
      throw new BridgeError("WEB_VIEWER_NOT_FOUND", "Web Viewer changed before console observation started");
    }
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
    this.captures.set(leafId, capture);
    return capture;
  }

  remove(leafId: string): void {
    const capture = this.captures.get(leafId);
    if (!capture) return;
    capture.webview.removeEventListener("console-message", capture.listener);
    this.captures.delete(leafId);
  }

  dispose(): void {
    this.app.workspace.offref(this.layoutRef);
    for (const leafId of this.captures.keys()) this.remove(leafId);
  }

  private reconcile(): void {
    const live = new Map(listWebViewerLeaves(this.app).map((leaf) => [getLeafId(leaf), getWebViewElement(leaf)]));
    for (const [leafId, capture] of this.captures) {
      if (live.get(leafId) !== capture.webview) this.remove(leafId);
    }
  }
}

const services = new WeakMap<App, BrowserConsoleCaptureService>();
const disposedApps = new WeakSet<App>();

export function ensureBrowserConsoleCapture(app: App, leaf: WorkspaceLeaf, webview: WebViewElement): BrowserConsoleCapture {
  if (disposedApps.has(app)) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "Browser observation service is disposed");
  let service = services.get(app);
  if (!service) {
    service = new BrowserConsoleCaptureService(app);
    services.set(app, service);
  }
  return service.ensure(leaf, webview);
}

export function removeBrowserConsoleCapture(app: App, leafId: string): void {
  services.get(app)?.remove(leafId);
}

/** Plugin unload is synchronous; late in-flight operations cannot restart observation. */
export function disposeBrowserConsoleCaptures(app: App): void {
  services.get(app)?.dispose();
  services.delete(app);
  disposedApps.add(app);
}
