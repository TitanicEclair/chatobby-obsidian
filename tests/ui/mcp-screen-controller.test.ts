import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { McpScreenController } from "../../src/features/mcp/public";
import { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";
import type { ChatobbyTransport } from "../../src/transport/ws-client";
import { frontendId, type FrontendBootstrap, type FrontendIntent, type FrontendIntentResult, type FrontendScreenRequest, type FrontendScreenResponse } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { detail, model, server } from "../support/mcp/screen";

// Real screen composition exercises the only credential-value boundary.
// @see ../../docs/api/mcp.md
const controllers: McpScreenController[] = [];
const protocols: FrontendProtocolController[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
  for (const protocol of protocols.splice(0)) protocol.destroy();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture(realProtocol = false) {
  const host = document.body.createDiv();
  const selected = { ...detail(), server: server({ authentication: "bearer" }) };
  const screen = model({ selectedPlugin: selected, selectedPluginId: selected.id });
  const store = new FrontendStore();
  let currentStore = store;
  const runtimeInstanceId = frontendId("runtime-1", "runtimeInstanceId");
  const viewId = frontendId("view-1", "viewId");
  const snapshot: FrontendBootstrap = {
    schemaVersion: 1, protocolVersion: 2, runtimeInstanceId, viewId,
    revision: 0, sequence: 0, session: null,
    composer: { controls: [], canSubmit: true }, agentRail: { items: [] },
    feed: { revision: 0, blocks: [] },
    taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tasks", items: [] },
    screens: [], screenModels: [screen], localCommands: [],
  };
  store.replace(snapshot);
  const loadScreen = vi.fn(async () => screen);
  const dispatch = vi.fn<(intent: FrontendIntent) => Promise<FrontendIntentResult>>(async (intent) => ({
    schemaVersion: 1, protocolVersion: 2, runtimeInstanceId, viewId,
    intentId: intent.intentId, status: "applied", revision: 1,
  }));
  const synchronizeMcpCredential = vi.fn(async (_reference: string, _secret: string | null) => {});
  const getSecret = vi.fn<() => string | null>(() => "synthetic-private-value");
  const requests: { request: FrontendScreenRequest; result: ReturnType<typeof deferred<FrontendScreenResponse>> }[] = [];
  const real = new FrontendProtocolController({
    store,
    createNegotiationRequest: () => { throw new Error("This screen fixture does not negotiate"); },
    onError: (error) => { throw error; },
  });
  real.bind({
    isConnected: true,
    onFrontendPatch: () => () => {},
    onFrontendProtocolError: () => () => {},
    getFrontendScreen: (request: FrontendScreenRequest) => {
      const result = deferred<FrontendScreenResponse>();
      requests.push({ request, result });
      return result.promise;
    },
    dispatchFrontendIntent: dispatch,
    synchronizeMcpCredential,
  } as unknown as ChatobbyTransport);
  protocols.push(real);
  const protocol = realProtocol ? real : { loadScreen, dispatch, synchronizeMcpCredential } as unknown as FrontendProtocolController;
  const controller = new McpScreenController({
    app: { secretStorage: { getSecret, listSecrets: () => ["synthetic-token"] } } as unknown as App,
    getHost: () => host, getStore: () => currentStore, getProtocol: () => protocol,
    prepareOpen: vi.fn(), onOpened: vi.fn(), onClosed: vi.fn(), onNavigatePlugin: vi.fn(),
  });
  controllers.push(controller);
  const click = (text: string) => {
    const button = [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((candidate) => candidate.textContent === text);
    if (!button) throw new Error(`Missing synthetic controller action: ${text}`);
    button.click();
  };
  const set = (key: string, value: string) => {
    const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-page-state-key="${key}"]`);
    if (!input) throw new Error(`Missing synthetic controller field: ${key}`);
    input.value = value;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const resolveScreen = (index: number) => {
    const { request, result } = requests[index]!;
    const selectedPlugin = request.preferredEntityId ? { ...selected, id: request.preferredEntityId } : undefined;
    const responseScreen = model({ selectedPlugin, selectedPluginId: selectedPlugin?.id });
    result.resolve({
      schemaVersion: 1, protocolVersion: 2, runtimeInstanceId, viewId,
      requestId: request.requestId, requestEpoch: request.requestEpoch,
      baseSequence: request.baseSequence, screenRevision: responseScreen.revision,
      screen: responseScreen,
    });
  };
  const useStore = (next: FrontendStore) => { currentStore = next; };
  return { controller, host, selected, loadScreen, dispatch, synchronizeMcpCredential, getSecret, click, set, store, useStore, requests, resolveScreen };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

// Drain the actual protocol/store/controller Promise chain, without a polling assertion.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function frames() {
  const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => callbacks.push(callback));
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  return { callbacks, cancel };
}

describe("McpScreenController", () => {
  // The real store must still reject stale responses; only their presentation is retired.
  // @see ../../docs/api/mcp.md
  it("does not paint the store's stale-response rejection over a newer route", async () => {
    const f = fixture(true);
    f.controller.open("plugin-a");
    f.controller.open("plugin-b");
    f.resolveScreen(1);
    await settle();
    f.resolveScreen(0);
    await settle();
    expect(f.store.snapshot?.screenModels[0]).toMatchObject({ selectedPluginId: "plugin-b" });
    expect(f.host.textContent).not.toContain("Stale screen response");
  });

  it("retires the previous load when the supplied store has no bootstrap", async () => {
    const f = fixture(true);
    f.controller.open("plugin-a");
    // Current compositions retain their store; exercise the nullable getStore contract
    // with another real store, not a nonexistent clear/reset or private-field mutation.
    f.useStore(new FrontendStore());
    f.controller.open("plugin-b");
    expect(f.requests).toHaveLength(1);
    f.requests[0]!.result.reject(new Error("Previous bootstrap failed"));
    await settle();
    expect(f.host.textContent).not.toContain("Previous bootstrap failed");
  });

  it.each(["success", "failure"] as const)("ignores an old route's %s after a newer refresh fails", async (outcome) => {
    const f = fixture(true);
    f.controller.open("plugin-a");
    f.controller.open("plugin-b");
    f.requests[1]!.result.reject(new Error("Current route unavailable"));
    await settle();
    if (outcome === "success") f.resolveScreen(0);
    else f.requests[0]!.result.reject(new Error("Retired route unavailable"));
    await settle();
    expect(f.host.textContent).toContain("Current route unavailable");
    expect(f.host.textContent).not.toContain("Retired route unavailable");
  });

  it.each(["success", "failure"] as const)("ignores a closed page's pending %s after reopen", async (outcome) => {
    const f = fixture(true);
    f.controller.open();
    f.controller.close();
    f.controller.open();
    f.requests[1]!.result.reject(new Error("Reopened page unavailable"));
    await settle();
    if (outcome === "success") f.resolveScreen(0);
    else f.requests[0]!.result.reject(new Error("Closed page unavailable"));
    await settle();
    expect(f.host.textContent).toContain("Reopened page unavailable");
    expect(f.host.textContent).not.toContain("Closed page unavailable");
  });

  it("shows the current refresh failure and clears it after a successful explicit retry", async () => {
    const f = fixture(true);
    f.controller.open();
    f.requests[0]!.result.reject(new Error("Current refresh unavailable"));
    await settle();
    expect(f.host.textContent).toContain("Current refresh unavailable");
    f.host.querySelector<HTMLButtonElement>('[aria-label="Refresh plugins"]')!.click();
    f.resolveScreen(1);
    await settle();
    expect(f.host.textContent).not.toContain("Current refresh unavailable");
  });

  it("finishes an old mutation once without clearing the reopened page's error", async () => {
    const f = fixture();
    const pending = deferred<FrontendIntentResult>();
    f.dispatch.mockReturnValueOnce(pending.promise);
    f.controller.open(f.selected.id);
    await settle();
    f.set("mcp:demo:credential", "synthetic-token");
    f.click("Link selected token");
    await settle();
    expect(f.dispatch).toHaveBeenCalledOnce();
    f.controller.close();
    f.loadScreen.mockRejectedValueOnce(new Error("New page unavailable"));
    f.controller.open();
    await settle();
    pending.resolve({
      schemaVersion: 1, protocolVersion: 2, runtimeInstanceId: frontendId("runtime-1", "runtimeInstanceId"),
      viewId: frontendId("view-1", "viewId"), intentId: f.dispatch.mock.calls[0]![0].intentId,
      status: "applied", revision: 1,
    });
    await settle();
    expect(f.host.textContent).toContain("New page unavailable");
    expect(f.dispatch).toHaveBeenCalledOnce();
  });

  it("focuses the initially opened page if focus has not moved", () => {
    const frame = frames();
    const f = fixture();
    f.controller.open();
    frame.callbacks[0]!(0);
    expect(document.activeElement).toBe(f.host.querySelector(".chatobby-mcp"));
  });

  it.each(["route", "close", "reopen"] as const)("retires initial focus on %s even if its cancelled callback runs", (action) => {
    const frame = frames();
    const f = fixture();
    f.controller.open();
    if (action === "route") f.controller.open(f.selected.id);
    else {
      f.controller.close();
      if (action === "reopen") f.controller.open();
    }
    frame.callbacks[0]!(0);
    expect(frame.cancel).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(document.body);
  });

  it.each(["page control", "outside overlay"] as const)("does not steal focus from a newly selected %s", (target) => {
    const frame = frames();
    const f = fixture();
    f.controller.open();
    const input = target === "page control"
      ? f.host.querySelector<HTMLInputElement>("input")!
      : document.body.createEl("input");
    input.focus();
    frame.callbacks[0]!(0);
    expect(document.activeElement).toBe(input);
  });

  it("loads the runtime-owned screen and reloads it after reconnect", async () => {
    const f = fixture();
    f.controller.open();
    await vi.waitFor(() => expect(f.loadScreen).toHaveBeenCalledOnce());
    expect(f.loadScreen).toHaveBeenLastCalledWith({ schemaVersion: 1, viewId: "view-1", screenId: "mcp" });
    f.controller.synchronize();
    await vi.waitFor(() => expect(f.loadScreen).toHaveBeenCalledTimes(2));
    expect(f.getSecret).not.toHaveBeenCalled();
  });

  it("synchronizes the selected secret before dispatching a reference-only link", async () => {
    const f = fixture();
    let synchronized!: () => void;
    f.synchronizeMcpCredential.mockImplementationOnce(() => new Promise<void>((resolve) => { synchronized = resolve; }));
    f.controller.open(f.selected.id);
    await vi.waitFor(() => expect(f.loadScreen).toHaveBeenCalledOnce());
    f.set("mcp:demo:credential", "synthetic-token");
    f.click("Link selected token");
    expect(f.synchronizeMcpCredential).toHaveBeenCalledWith("synthetic-token", "synthetic-private-value");
    expect(f.dispatch).not.toHaveBeenCalled();
    synchronized();
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledOnce());
    expect(f.synchronizeMcpCredential.mock.invocationCallOrder[0]).toBeLessThan(f.dispatch.mock.invocationCallOrder[0]!);
    expect(f.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "mcp.set-credential-reference", payload: {
      expectedConfigRevision: "config-1", serverId: "demo", reference: "synthetic-token", scope: "user",
    } }));
    expect(JSON.stringify(f.dispatch.mock.calls)).not.toContain("synthetic-private-value");
    expect(f.host.textContent).not.toContain("synthetic-private-value");
  });

  it("synchronizes a new bearer connection's secret before saving the disabled reference-only draft", async () => {
    const f = fixture();
    f.controller.open();
    await vi.waitFor(() => expect(f.loadScreen).toHaveBeenCalledOnce());
    f.host.querySelector<HTMLButtonElement>('[aria-label="Add MCP connection"]')!.click();
    f.set("mcp:new:name", "Synthetic remote");
    f.set("mcp:new:url", "https://example.invalid/mcp");
    f.set("mcp:new:auth", "bearer");
    f.set("mcp:new:credential", "synthetic-token");
    f.click("Save connection");
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledOnce());
    expect(f.synchronizeMcpCredential).toHaveBeenCalledWith("synthetic-token", "synthetic-private-value");
    expect(f.synchronizeMcpCredential.mock.invocationCallOrder[0]).toBeLessThan(f.dispatch.mock.invocationCallOrder[0]!);
    expect(f.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "mcp.save", payload: {
      expectedConfigRevision: "config-1", draft: expect.objectContaining({
        scope: "user", enabled: false, bearerCredentialReference: "synthetic-token",
      }),
    } }));
    expect(JSON.stringify(f.dispatch.mock.calls)).not.toContain("synthetic-private-value");
  });

  it("rejects a missing saved secret before either synchronization or mutation", async () => {
    const f = fixture();
    f.getSecret.mockReturnValue(null);
    f.controller.open(f.selected.id);
    await vi.waitFor(() => expect(f.loadScreen).toHaveBeenCalledOnce());
    f.set("mcp:demo:credential", "synthetic-token");
    f.click("Link selected token");
    await vi.waitFor(() => expect(f.host.textContent).toContain("has no saved value"));
    expect(f.synchronizeMcpCredential).not.toHaveBeenCalled();
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch a reference mutation when credential synchronization rejects", async () => {
    const f = fixture();
    f.synchronizeMcpCredential.mockRejectedValueOnce(new Error("Synthetic credential synchronization failed"));
    f.controller.open(f.selected.id);
    await vi.waitFor(() => expect(f.loadScreen).toHaveBeenCalledOnce());
    f.set("mcp:demo:credential", "synthetic-token");
    f.click("Link selected token");
    await vi.waitFor(() => expect(f.host.textContent).toContain("Synthetic credential synchronization failed"));
    expect(f.dispatch).not.toHaveBeenCalled();
    expect(f.host.textContent).not.toContain("synthetic-private-value");
  });
});
