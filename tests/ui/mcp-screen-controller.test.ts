import { describe, expect, it, vi } from "vitest";
import { McpScreenController } from "../../src/features/mcp/public";
import type { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";

describe("McpScreenController", () => {
  it("loads the runtime-owned screen and reloads it after reconnect", async () => {
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
    const loadScreen = vi.fn().mockResolvedValue(undefined);
    const protocol = { loadScreen, dispatch: vi.fn() } as unknown as FrontendProtocolController;
    const controller = new McpScreenController({
      getHost: () => host,
      getStore: () => store,
      getProtocol: () => protocol,
      prepareOpen: vi.fn(),
      onOpened: vi.fn(),
      onClosed: vi.fn(),
    });

    controller.open();
    await vi.waitFor(() => expect(loadScreen).toHaveBeenCalledOnce());
    expect(loadScreen).toHaveBeenLastCalledWith({
      schemaVersion: 1,
      viewId: "view-1",
      screenId: "mcp",
    });
    controller.synchronize();
    await vi.waitFor(() => expect(loadScreen).toHaveBeenCalledTimes(2));
    controller.destroy();
  });
});
