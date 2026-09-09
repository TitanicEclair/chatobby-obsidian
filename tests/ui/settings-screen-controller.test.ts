import { describe, expect, it, vi } from "vitest";
import { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";
import type { ChatobbyTransport } from "../../src/transport/ws-client";
import type { FrontendBootstrap, FrontendPatch } from "../../src/vendor/chatobby-client/frontend-contracts.js";

const settingSpies = vi.hoisted(() => ({
  detach: vi.fn(),
  refresh: vi.fn(),
  render: vi.fn(),
}));

vi.mock("../../src/settings", () => ({
  ChatobbySettingTab: class {
    renderChatobbySettings = settingSpies.render;
    refreshProviderCatalogFromRuntime = settingSpies.refresh;
    detachChatobbySettings = settingSpies.detach;
  },
}));

import { SettingsScreenController } from "../../src/features/settings/public";

describe("SettingsScreenController", () => {
	it("refreshes an open provider list for every runtime composer replacement", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    let patchListener: ((patch: FrontendPatch) => void) | null = null;
    const protocol = new FrontendProtocolController({
      store,
      createNegotiationRequest: () => ({
        schemaVersion: 1,
        requestId: "negotiate-1",
        connectorVersion: "0.4.4",
        obsidianVersion: "1.13.1",
        vaultInstanceId: "vault-1",
        viewId: "view-1",
        supportedProtocolVersions: [2],
        capabilities: { featureFamilies: [], protocolCapabilities: [], integrations: [] },
      }),
      onError: vi.fn(),
    });
    protocol.bind({
      isConnected: true,
      onFrontendPatch: (listener: (patch: FrontendPatch) => void) => {
        patchListener = listener;
        return () => { patchListener = null; };
      },
      onFrontendProtocolError: () => () => {},
    } as unknown as ChatobbyTransport);
    const host = document.body.createDiv();
    const controller = new SettingsScreenController({
      app: {} as never,
      plugin: {} as never,
      getHost: () => host,
      getStore: () => store,
      prepareOpen: vi.fn(),
      onOpened: vi.fn(),
      onClosed: vi.fn(),
      downloadGuide: vi.fn(),
    });
    controller.open();

    patchListener?.({ ...patch(1, 0, composer("openai/gpt-5", ["openai/gpt-5"])), operations: [] });
    expect(settingSpies.refresh).not.toHaveBeenCalled();

    patchListener?.(patch(2, 1, composer("openai/gpt-5.1", ["openai/gpt-5", "openai/gpt-5.1"])));
    expect(settingSpies.refresh).toHaveBeenCalledOnce();

		patchListener?.(patch(3, 2, composer("openai/gpt-5.1", ["openai/gpt-5", "openai/gpt-5.1"])));
		expect(settingSpies.refresh).toHaveBeenCalledTimes(2);

		controller.close(false);
		patchListener?.(patch(4, 3, composer("openai/gpt-5", ["openai/gpt-5", "openai/gpt-5.1", "openai/gpt-5.2"])));
		expect(settingSpies.refresh).toHaveBeenCalledTimes(2);
    protocol.destroy();
    host.remove();
  });
});

function composer(value: string, models: readonly string[]): FrontendBootstrap["composer"] {
  return {
    canSubmit: true,
    controls: [
      { id: "provider", label: "Provider", value: "openai", options: [{ value: "openai", label: "OpenAI" }] },
      {
        id: "model",
        label: "Model",
        value,
        options: models.map((model) => ({ value: model, label: model, description: "openai" })),
      },
    ],
  };
}

function patch(
  sequence: number,
  baseRevision: number,
  nextComposer: FrontendBootstrap["composer"],
): FrontendPatch {
  return {
    schemaVersion: 1,
    protocolVersion: 2,
    runtimeInstanceId: "runtime-1",
    viewId: "view-1",
    scope: { kind: "view", viewId: "view-1" },
    sequence,
    baseRevision,
    revision: sequence,
    operations: [{ type: "composer.replace", composer: nextComposer }],
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
    taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] },
    composer: composer("openai/gpt-5", ["openai/gpt-5"]),
    agentRail: { items: [] },
    feed: { revision: 0, blocks: [] },
    screens: [],
    screenModels: [],
    localCommands: [],
  };
}
