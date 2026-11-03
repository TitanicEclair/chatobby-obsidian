import { afterEach, describe, expect, it, vi } from "vitest";
import ChatobbyPlugin from "../../src/main";
import { FrontendStore } from "../../src/frontend/frontend-store";
import { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { ChatobbyTransport } from "../../src/transport/ws-client";
import { MemoryScreenController } from "../../src/features/memory/public";
import { WorkspacePage } from "../../src/ui/workspace/workspace-pages";
import { frontendId, parseFrontendScreenResponse, type FrontendBootstrap, type FrontendIntentResult, type FrontendMemoryScreenViewModel, type FrontendScreenResponse } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { memoryModel } from "./helpers/memory-model";

const workspace = vi.hoisted(() => ({ boundary: undefined as {
  store: FrontendStore; protocol: FrontendProtocolController; close: () => Promise<void>;
} | undefined }));
// Only the connection boundary is controlled; WorkspacePage, Memory controller,
// public protocol envelope, store, view and DOM controls below are production code.
vi.mock("../../src/ui/workspace/workspace-connection", () => ({
  WorkspaceConnection: class {
    readonly store: FrontendStore;
    readonly protocol: FrontendProtocolController;
    readonly close: () => Promise<void>;
    constructor(_plugin: unknown, private readonly onReady: () => void) {
      const boundary = workspace.boundary;
      if (!boundary) throw Error("Missing controlled workspace connection");
      this.store = boundary.store; this.protocol = boundary.protocol; this.close = boundary.close;
    }
    async open(): Promise<void> { this.onReady(); }
  },
}));

const dispose: (() => void)[] = [];
afterEach(() => { for (const close of dispose.splice(0).reverse()) close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); workspace.boundary = undefined; document.body.empty(); });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function button(host: HTMLElement, label: string): HTMLButtonElement {
  const result = Array.from(host.querySelectorAll("button")).find(candidate => candidate.textContent?.trim() === label);
  if (!result) throw Error(`Missing button: ${label}`); return result;
}
function bootstrap(model: FrontendMemoryScreenViewModel): FrontendBootstrap {
  return { schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: frontendId("memory-runtime", "runtimeInstanceId"), revision: 1, sequence: 1, viewId: frontendId("memory-view", "viewId"), session: null,
    taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] }, composer: { canSubmit: true, controls: [] }, agentRail: { items: [] }, feed: { revision: 0, blocks: [] }, screens: [], screenModels: [model], localCommands: [] };
}
function fixture() {
  const store = new FrontendStore(); store.replace(bootstrap(memoryModel()));
  const transport = new ChatobbyTransport({ endpoint: "ws://synthetic.invalid", ownership: "external", identity: { instanceId: "memory-runtime", vaultId: "fixture", pid: 0, startedAt: 0, runtimeVersion: "fixture", protocolVersion: 2, runtimePackageFingerprint: null, developmentBuildFingerprint: null } });
  vi.spyOn(transport, "isConnected", "get").mockReturnValue(true);
  const read = vi.spyOn(transport, "getFrontendScreen").mockImplementation(async request => {
    const model = store.snapshot?.screenModels.find((screen): screen is FrontendMemoryScreenViewModel => screen.screenId === "memory");
    if (!model) throw Error("Missing synthetic model");
    return parseFrontendScreenResponse(JSON.parse(JSON.stringify({ ...request, screenRevision: model.revision, screen: model })));
  });
  const dispatch = vi.spyOn(transport, "dispatchFrontendIntent").mockImplementation(async intent => ({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: intent.runtimeInstanceId, viewId: intent.viewId, intentId: intent.intentId, status: "applied", revision: 2 }));
  const protocol = new FrontendProtocolController({ store, createNegotiationRequest: () => { throw Error("Unexpected negotiation in controlled transport fixture"); }, onError: vi.fn() });
  protocol.bind(transport); dispose.push(() => protocol.destroy());
  let subscriptions = 0, notifications = 0;
  const subscribe = store.subscribeSelector.bind(store);
  vi.spyOn(store, "subscribeSelector").mockImplementation(<T>(selector: (snapshot: FrontendBootstrap) => T, listener: (selection: T) => void, equals?: (left: T, right: T) => boolean) => {
    subscriptions += 1;
    const unsubscribe = subscribe(selector, value => { notifications += 1; listener(value); }, equals);
    return () => { subscriptions -= 1; unsubscribe(); };
  });
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.push(callback); return frames.length; });
  const host = document.body.createDiv(), order: string[] = [], closed = vi.fn();
  const controller = new MemoryScreenController({ getHost: () => host, getStore: () => store, getProtocol: () => protocol,
    prepareOpen: () => { order.push("prepare"); }, onOpened: () => { order.push("opened"); expect(host.children).toHaveLength(0); }, onClosed: closed });
  dispose.push(() => controller.destroy());
  return { store, protocol, transport, read, dispatch, host, controller, frames, order, closed,
    subscriptions: () => subscriptions, notifications: () => notifications,
    replace: (model: FrontendMemoryScreenViewModel) => store.replace(bootstrap(model)) };
}
async function settled(): Promise<void> { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function selectPolicy(host: HTMLElement, value: string): void {
  button(host, "Settings").click();
  const select = host.querySelector<HTMLSelectElement>('[aria-label="Memory available in this project"]');
  if (!select) throw Error("Missing projected policy control"); select.value = value; select.dispatchEvent(new Event("change"));
}

/** @see src/features/memory/README.md — actual projection/intent boundary and retained #133 limits. */
describe("Memory controller and native page ownership", () => {
  it("loads the public screen envelope and stamps policy with the current model revision", async () => {
    const f = fixture(); f.controller.open(); await settled();
    expect(f.order).toEqual(["prepare", "opened"]); expect(f.subscriptions()).toBe(1);
    expect(f.read).toHaveBeenCalledExactlyOnceWith({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "memory-runtime", viewId: "memory-view", requestId: expect.any(String), requestEpoch: 1, baseSequence: 1, screenId: "memory", preferredEntityId: undefined });
    expect(f.host.textContent).toContain("Prefers concise technical answers");
    f.replace(memoryModel({ revision: 7 })); selectPolicy(f.host, "project-only"); await settled();
    expect(f.dispatch).toHaveBeenCalledExactlyOnceWith({ schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: "memory-runtime", viewId: "memory-view", intentId: expect.any(String), mainSessionId: undefined, type: "memory.update-policy", payload: { projectBoundaryMode: "project-only", expectedMemoryRevision: 7 } });
    expect(f.host.querySelector('[aria-label="Memory available in this project"]')?.hasAttribute("disabled")).toBe(false);
  });

  it.each(["rejected", "conflict"] as const)("preserves the %s outcome notice and releases the local busy state", async status => {
    const f = fixture(), pending = deferred<FrontendIntentResult>();
    f.dispatch.mockReturnValueOnce(pending.promise); f.controller.open(); await settled(); selectPolicy(f.host, "project-only");
    expect(f.host.querySelector('[aria-label="Memory available in this project"]')?.hasAttribute("disabled")).toBe(true);
    const intent = f.dispatch.mock.calls[0]?.[0]; if (!intent) throw Error("No policy intent");
    const base = { schemaVersion: 1 as const, protocolVersion: 2 as const, runtimeInstanceId: intent.runtimeInstanceId, viewId: intent.viewId, intentId: intent.intentId, notice: { level: "error" as const, message: "Synthetic policy refusal" } };
    pending.resolve(status === "rejected" ? { ...base, status, errorCode: "fixture" } : { ...base, status, actualRevision: 8 });
    await settled(); expect(f.host.textContent).toContain("Synthetic policy refusal");
    expect(f.host.querySelector('[aria-label="Memory available in this project"]')?.hasAttribute("disabled")).toBe(false);
  });

  it("unsubscribes each closed view and attaches exactly one replacement subscription", async () => {
    const f = fixture(); f.controller.open(); await settled(); const notifications = f.notifications();
    f.controller.close(false); expect(f.subscriptions()).toBe(0); expect(f.host.children).toHaveLength(0); expect(f.closed).toHaveBeenLastCalledWith(false);
    f.replace(memoryModel({ revision: 2 })); expect(f.notifications()).toBe(notifications);
    f.controller.open(); await settled(); expect(f.subscriptions()).toBe(1);
    f.host.querySelector<HTMLButtonElement>('[aria-label="Close memory"]')?.click();
    expect(f.subscriptions()).toBe(0); expect(f.closed).toHaveBeenLastCalledWith(true);
  });

  it("currently applies an old refresh failure and frame to the reopened view", async () => {
    const f = fixture(), pending = deferred<FrontendScreenResponse>(); f.read.mockReturnValueOnce(pending.promise);
    f.controller.open(); const oldFrame = f.frames.at(-1); f.controller.close(false); f.controller.open(); await settled();
    const replacement = f.host.querySelector<HTMLElement>(".chatobby-memory-view");
    if (!replacement || !oldFrame) throw Error("Missing replacement/frame");
    document.body.focus(); oldFrame(0); expect(document.activeElement).toBe(replacement);
    pending.reject(Error("Old refresh failure")); await settled();
    expect(f.host.textContent).toContain("Old refresh failure"); expect(f.subscriptions()).toBe(1);
  });

  it("composes a real Memory WorkspacePage and closes only its controlled connection", async () => {
    const f = fixture(), close = vi.fn(async () => {}); workspace.boundary = { store: f.store, protocol: f.protocol, close };
    vi.stubGlobal("createDiv", (options?: { cls?: string }) => { const element = document.createElement("div"); element.className = options?.cls ?? ""; return element; });
    // Do not run plugin construction; the Memory branch invokes no plugin services.
    const plugin = Object.create(ChatobbyPlugin.prototype) as ChatobbyPlugin;
    const page = new WorkspacePage(plugin, { mode: "memory" }, "memory-owned-page");
    document.body.append(page.element); const onClose = vi.fn(); page.onClose = onClose;
    await page.start(); await settled();
    expect(page.element.dataset.pageId).toBe("memory-owned-page"); expect(page.element.textContent).toContain("Prefers concise technical answers");
    expect(f.subscriptions()).toBe(1); page.element.querySelector<HTMLButtonElement>('[aria-label="Close memory"]')?.click();
    expect(onClose).toHaveBeenCalledOnce(); expect(f.subscriptions()).toBe(0);
    await page.dispose(); expect(close).toHaveBeenCalledOnce(); expect(page.element.isConnected).toBe(false);
  });
});
