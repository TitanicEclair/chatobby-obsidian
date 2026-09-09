import { describe, expect, it, vi } from "vitest";
import { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";
import type { ChatobbyTransport } from "../../src/transport/ws-client";
import type { FrontendBootstrap, FrontendCapability, FrontendPatch } from "../../src/vendor/chatobby-client/frontend-contracts.js";

const protocolCapabilities = [
  "atomic-bootstrap-cutover",
  "bounded-replay",
  "typed-protocol-errors",
  "revisioned-screen-cache",
  "complete-feed-entities",
  "session-clear",
  "pagination-v2",
  "intent-outcomes-v2",
] as const;

describe("FrontendProtocolController", () => {
  it.each([false, true])("requires current negotiated native setup selection, including after reconnect: %s", async (selected) => {
    const fixture = capabilityFixture(selected, "native-sandbox-setup");
    expect(fixture.controller.supportsCapability("native-sandbox-setup")).toBe(false);
    await fixture.controller.synchronize();
    expect(fixture.controller.supportsCapability("native-sandbox-setup")).toBe(selected);
    fixture.connection.isConnected = false;
    fixture.controller.clearNegotiatedCapabilities();
    fixture.connection.isConnected = true;
    expect(fixture.controller.supportsCapability("native-sandbox-setup")).toBe(false);
    const index = fixture.selected.indexOf("native-sandbox-setup");
    if (index >= 0) fixture.selected.splice(index, 1);
    await fixture.controller.synchronize();
    expect(fixture.controller.lifecycle).toBe("live");
    expect(fixture.controller.supportsCapability("native-sandbox-setup")).toBe(false);
    fixture.controller.destroy();
  });
  it("cannot restore native setup selection from an old pending subscription", async () => {
    const fixture = capabilityFixture(true, "native-sandbox-setup");
    let finish: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { finish = resolve; });
    fixture.subscribe.mockImplementationOnce(async () => { await held; return subscription(); });
    const pending = fixture.controller.synchronize();
    await vi.waitFor(() => expect(fixture.subscribe).toHaveBeenCalledOnce());
    fixture.controller.bind(null);
    finish?.();
    await pending;
    expect(fixture.controller.supportsCapability("native-sandbox-setup")).toBe(false);
    expect(fixture.store.snapshot).toBeNull();
    fixture.controller.destroy();
  });
  it.each([false, true])("admits an optional feature only when a compatible runtime selects it: %s", async (selected) => {
    const fixture = capabilityFixture(selected);
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(false);
    await fixture.controller.synchronize();
    expect(fixture.controller.lifecycle).toBe("live");
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(selected);
    fixture.controller.destroy();
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(false);
  });

  it.each(protocolCapabilities)("still rejects a runtime missing required %s", async (missing) => {
    const fixture = capabilityFixture(true);
    fixture.selected.splice(fixture.selected.indexOf(missing), 1);
    await expect(fixture.controller.synchronize()).rejects.toThrow(`required capability: ${missing}`);
    expect(fixture.subscribe).not.toHaveBeenCalled();
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(false);
    fixture.controller.destroy();
  });

  it("clears the previous connection's selected capability until the reconnect negotiates again", async () => {
    const fixture = capabilityFixture(true);
    await fixture.controller.synchronize();
    fixture.connection.isConnected = false;
    fixture.controller.clearNegotiatedCapabilities();
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(false);
    fixture.connection.isConnected = true;
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(false);
    fixture.selected.splice(fixture.selected.indexOf("obsidian-vault-access"), 1);
    await fixture.controller.synchronize();
    expect(fixture.controller.lifecycle).toBe("live");
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(false);
    fixture.controller.destroy();
  });

  it.each(["reset", "replace"] as const)("cannot restore old selection when a delayed subscription finishes after %s", async (change) => {
    const fixture = capabilityFixture(true);
    let finish: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { finish = resolve; });
    fixture.subscribe.mockImplementationOnce(async () => { await held; return subscription(); });
    const pending = fixture.controller.synchronize();
    await vi.waitFor(() => expect(fixture.subscribe).toHaveBeenCalledOnce());
    if (change === "reset") fixture.controller.clearNegotiatedCapabilities();
    else fixture.controller.bind(null);
    finish?.();
    await pending;
    expect(fixture.store.snapshot).toBeNull();
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(false);
    expect(fixture.connection.activateFrontendLive).not.toHaveBeenCalled();
    fixture.controller.destroy();
  });

  it.each([
    { replace: false, rejectOld: false }, { replace: true, rejectOld: false },
    { replace: false, rejectOld: true }, { replace: true, rejectOld: true },
  ])("negotiates the current connection without waiting on retired work: $replace / $rejectOld", async ({ replace, rejectOld }) => {
    const fixture = capabilityFixture(true);
    let finish: (() => void) | undefined;
    const held = new Promise<void>((resolve) => { finish = resolve; });
    fixture.subscribe.mockImplementationOnce(async () => {
      await held;
      if (rejectOld) throw new Error("retired subscription failed");
      return subscription();
    });
    const old = fixture.controller.synchronize().then(() => "settled", () => "rejected");
    await vi.waitFor(() => expect(fixture.subscribe).toHaveBeenCalledOnce());
    if (replace) fixture.controller.bind({ ...fixture.connection } as unknown as ChatobbyTransport);
    else fixture.controller.clearNegotiatedCapabilities();
    const next = fixture.controller.synchronize();
    try {
      await vi.waitFor(() => expect(fixture.subscribe).toHaveBeenCalledTimes(2));
      await next;
      expect(fixture.controller.lifecycle).toBe("live");
      expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(true);
    } finally {
      finish?.();
      await old;
      await next;
    }
    expect(fixture.controller.lifecycle).toBe("live");
    expect(fixture.controller.supportsCapability("obsidian-vault-access")).toBe(true);
    expect(fixture.connection.activateFrontendLive).toHaveBeenCalledOnce();
    fixture.controller.destroy();
  });

  it("negotiates before the atomic bootstrap cutover and applies buffered live patches", async () => {
    let patchListener: ((patch: FrontendPatch) => void) | undefined;
    const calls: string[] = [];
    const lifecycle: string[] = [];
    const transport = {
      isConnected: true,
      onFrontendPatch: (listener: (patch: FrontendPatch) => void) => {
        patchListener = listener;
        return () => { patchListener = undefined; };
      },
      onFrontendProtocolError: () => () => {},
      negotiateFrontend: async () => {
        calls.push("negotiate");
        return {
          schemaVersion: 1,
          protocolVersion: 2,
          requestId: "negotiate-1",
          runtimeInstanceId: "runtime-1",
          viewId: "view-1",
          selectedCapabilities: protocolCapabilities,
          unavailableCapabilities: [],
          replayLimit: 256,
        };
      },
      subscribeFrontend: async () => {
        calls.push("subscribe");
        return {
          schemaVersion: 1,
          protocolVersion: 2,
          requestId: "subscribe-1",
          runtimeInstanceId: "runtime-1",
          viewId: "view-1",
          status: "bootstrapped",
          sequence: 0,
          revision: 0,
          oldestReplayableSequence: 0,
          bootstrap: bootstrap(),
          replay: [],
        };
      },
      activateFrontendLive: () => calls.push("live"),
    } as unknown as ChatobbyTransport;
    const store = new FrontendStore();
    const controller = new FrontendProtocolController({
      store,
      createNegotiationRequest: bootstrapRequest,
      onError: vi.fn(),
      onLifecycleChange: (state) => lifecycle.push(state),
    });
    controller.bind(transport);

    await controller.synchronize();
    patchListener?.({
      schemaVersion: 1,
      protocolVersion: 2,
      runtimeInstanceId: "runtime-1",
      viewId: "view-1",
      scope: { kind: "view", viewId: "view-1" },
      sequence: 1,
      baseRevision: 0,
      revision: 1,
      operations: [{ type: "composer.replace", composer: { controls: [], canSubmit: false } }],
    });

    expect(calls).toEqual(["negotiate", "subscribe", "live"]);
    expect(lifecycle).toEqual(["connecting", "negotiating", "bootstrapping", "live"]);
    expect(store.snapshot?.composer.canSubmit).toBe(false);
    controller.destroy();
    expect(lifecycle.at(-1)).toBe("closed");
    expect(() => controller.bind(transport)).toThrow("Illegal frontend lifecycle transition");
  });

  it("falls back to an explicit full bootstrap when reconnect replay is unavailable", async () => {
    const requests: Array<{ resume?: { afterSequence: number; revision: number } }> = [];
    const lifecycle: string[] = [];
    const store = new FrontendStore();
    store.replace({ ...bootstrap(), sequence: 4, revision: 4 });
    const transport = {
      isConnected: true,
      onFrontendPatch: () => () => {},
      onFrontendProtocolError: () => () => {},
      negotiateFrontend: async () => ({
        schemaVersion: 1,
        protocolVersion: 2,
        requestId: "negotiate-1",
        runtimeInstanceId: "runtime-1",
        viewId: "view-1",
        selectedCapabilities: protocolCapabilities,
        unavailableCapabilities: [],
        replayLimit: 256,
      }),
      subscribeFrontend: async (request: { resume?: { afterSequence: number; revision: number } }) => {
        requests.push(request);
        if (request.resume) return {
          schemaVersion: 1,
          protocolVersion: 2,
          requestId: "resume-1",
          runtimeInstanceId: "runtime-1",
          viewId: "view-1",
          status: "resync-required",
          sequence: 0,
          revision: 0,
          oldestReplayableSequence: 0,
          error: {
            schemaVersion: 1,
            protocolVersion: 2,
            code: "runtime-replaced",
            message: "Runtime stream was replaced.",
            retryable: true,
            resync: "full-bootstrap",
          },
        };
        return {
          schemaVersion: 1,
          protocolVersion: 2,
          requestId: "bootstrap-2",
          runtimeInstanceId: "runtime-1",
          viewId: "view-1",
          status: "bootstrapped",
          sequence: 0,
          revision: 0,
          oldestReplayableSequence: 0,
          bootstrap: bootstrap(),
          replay: [],
        };
      },
      activateFrontendLive: vi.fn(),
    } as unknown as ChatobbyTransport;
    const controller = new FrontendProtocolController({
      store,
      createNegotiationRequest: bootstrapRequest,
      onError: vi.fn(),
      onLifecycleChange: (state) => lifecycle.push(state),
    });
    controller.bind(transport);

    await controller.synchronize();

    expect(requests).toHaveLength(2);
    expect(requests[0]?.resume).toEqual({ afterSequence: 4, revision: 4 });
    expect(requests[1]?.resume).toBeUndefined();
    expect(controller.lifecycle).toBe("live");
    expect(store.snapshot?.sequence).toBe(0);
    expect(lifecycle).toEqual([
      "connecting",
      "negotiating",
      "replaying",
      "resynchronizing",
      "bootstrapping",
      "live",
    ]);
  });
});

function subscription() {
  return { schemaVersion: 1, protocolVersion: 2, requestId: "subscribe-1", runtimeInstanceId: "runtime-1", viewId: "view-1",
    status: "bootstrapped" as const, sequence: 0, revision: 0, oldestReplayableSequence: 0, bootstrap: bootstrap(), replay: [] };
}

function capabilityFixture(withOptional: boolean, optional: FrontendCapability = "obsidian-vault-access") {
  const selected: FrontendCapability[] = [...protocolCapabilities, ...(withOptional ? [optional] : [])];
  const subscribe = vi.fn(async () => subscription());
  const connection = {
    isConnected: true,
    onFrontendPatch: () => () => {},
    onFrontendProtocolError: () => () => {},
    negotiateFrontend: async () => ({ schemaVersion: 1, protocolVersion: 2, requestId: "negotiate-1", runtimeInstanceId: "runtime-1",
      viewId: "view-1", selectedCapabilities: [...selected], unavailableCapabilities: [], replayLimit: 256 }),
    subscribeFrontend: subscribe,
    activateFrontendLive: vi.fn(),
  };
  const store = new FrontendStore();
  const controller = new FrontendProtocolController({ store, onError: vi.fn(), createNegotiationRequest: () => ({
    ...bootstrapRequest(), capabilities: { featureFamilies: [], protocolCapabilities: [...protocolCapabilities, optional], integrations: [] },
  }) });
  controller.bind(connection as unknown as ChatobbyTransport);
  return { controller, store, selected, connection, subscribe };
}

function bootstrapRequest() {
  return {
    schemaVersion: 1 as const,
    requestId: "negotiate-1",
    connectorVersion: "0.1.0",
    obsidianVersion: "1.13.1",
    vaultInstanceId: "vault-1",
    viewId: "view-1",
    supportedProtocolVersions: [2],
    capabilities: { featureFamilies: [], protocolCapabilities, integrations: [] },
  };
}

function bootstrap(): FrontendBootstrap {
  return {
    schemaVersion: 1,
    protocolVersion: 2,
    runtimeInstanceId: "runtime-1",
    revision: 0,
    sequence: 0,
    viewId: "view-1",
    session: null,
    composer: { controls: [], canSubmit: true },
    agentRail: { items: [] },
    feed: { revision: 0, blocks: [] },
    screens: [],
    screenModels: [],
    localCommands: [],
  };
}
