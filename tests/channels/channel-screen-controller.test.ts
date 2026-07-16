import { describe, expect, it, vi } from "vitest";
import { ChannelScreenController } from "../../src/features/channels/public";
import type { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";

describe("ChannelScreenController", () => {
  it("reloads the runtime-owned screen after reconnect", async () => {
    const host = document.body.createDiv();
    const store = new FrontendStore();
    store.replace({
      schemaVersion: 1,
      protocolVersion: 1,
      runtimeInstanceId: "runtime-1",
      revision: 0,
      viewId: "view-1",
      session: null,
      composer: { controls: [], canSubmit: true },
      agentRail: { items: [] },
      feed: { revision: 0, blocks: [] },
      screens: [],
      screenModels: [],
      localCommands: [],
    });
    const loadScreen = vi.fn().mockResolvedValue({
      screenId: "channels",
      revision: 1,
      loading: false,
      groups: [],
      heading: "Channels",
      messages: [],
    });
    const protocol = { loadScreen, dispatch: vi.fn() } as unknown as FrontendProtocolController;
    const controller = new ChannelScreenController({
      getHost: () => host,
      getStore: () => store,
      getProtocol: () => protocol,
      prepareOpen: vi.fn(),
      onOpened: vi.fn(),
      onClosed: vi.fn(),
      openAgentFeed: vi.fn(async () => {}),
    });

    controller.open("channel-1");
    await vi.waitFor(() => expect(loadScreen).toHaveBeenCalledOnce());
    expect(loadScreen).toHaveBeenLastCalledWith(expect.objectContaining({
      viewId: "view-1",
      screenId: "channels",
      preferredEntityId: "channel-1",
    }));
    controller.synchronize();

    await vi.waitFor(() => expect(loadScreen).toHaveBeenCalledTimes(2));
    controller.destroy();
  });
});
