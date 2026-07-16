import { describe, expect, it, vi } from "vitest";
import { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";
import type { ChatobbyTransport } from "../../src/transport/ws-client";
import type { FrontendBootstrap, FrontendPatch } from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("FrontendProtocolController", () => {
  it("bootstraps before subscribing and applies live patches", async () => {
    let patchListener: ((patch: FrontendPatch) => void) | undefined;
    const calls: string[] = [];
    const transport = {
      isConnected: true,
      onFrontendPatch: (listener: (patch: FrontendPatch) => void) => {
        patchListener = listener;
        return () => { patchListener = undefined; };
      },
      getFrontendBootstrap: async () => {
        calls.push("bootstrap");
        return bootstrap();
      },
      subscribeFrontend: async () => {
        calls.push("subscribe");
        return { runtimeInstanceId: "runtime-1", sequence: 0, revision: 0 };
      },
    } as unknown as ChatobbyTransport;
    const store = new FrontendStore();
    const controller = new FrontendProtocolController({
      store,
      createBootstrapRequest: bootstrapRequest,
      onError: vi.fn(),
    });
    controller.bind(transport);

    await controller.synchronize();
    patchListener?.({
      schemaVersion: 1,
      runtimeInstanceId: "runtime-1",
      scope: { kind: "view", viewId: "view-1" },
      sequence: 1,
      baseRevision: 0,
      revision: 1,
      operations: [{ type: "composer.replace", composer: { controls: [], canSubmit: false } }],
    });

    expect(calls).toEqual(["bootstrap", "subscribe"]);
    expect(store.snapshot?.composer.canSubmit).toBe(false);
  });
});

function bootstrapRequest() {
  return {
    schemaVersion: 1 as const,
    connectorVersion: "0.1.0",
    obsidianVersion: "1.13.1",
    vaultInstanceId: "vault-1",
    viewId: "view-1",
    supportedProtocolVersions: [1],
    capabilities: { featureFamilies: [], integrations: [] },
  };
}

function bootstrap(): FrontendBootstrap {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
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
