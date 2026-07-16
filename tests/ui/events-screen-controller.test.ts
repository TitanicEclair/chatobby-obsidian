import { describe, expect, it, vi } from "vitest";
import { EventsScreenController } from "../../src/features/events/public";
import type { FrontendProtocolController } from "../../src/frontend/frontend-protocol-controller";
import { FrontendStore } from "../../src/frontend/frontend-store";

describe("EventsScreenController", () => {
  it("defers a restored route until frontend bootstrap is available", async () => {
    const host = document.body.createDiv();
    const store = new FrontendStore();
    const loadScreen = vi.fn().mockResolvedValue({
      screenId: "events",
      revision: 1,
      loading: false,
      definitions: [],
      occurrences: [],
      pendingApprovalCount: 0,
    });
    const protocol = { loadScreen, dispatch: vi.fn() } as unknown as FrontendProtocolController;
    const controller = new EventsScreenController({
      getHost: () => host,
      getStore: () => store,
      getProtocol: () => protocol,
      prepareOpen: vi.fn(),
      onOpened: vi.fn(),
      onClosed: vi.fn(),
    });

    controller.open();
    await Promise.resolve();
    expect(loadScreen).not.toHaveBeenCalled();

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
    controller.synchronize();

    await vi.waitFor(() => expect(loadScreen).toHaveBeenCalledOnce());
    expect(loadScreen).toHaveBeenCalledWith({
      schemaVersion: 1,
      viewId: "view-1",
      screenId: "events",
    });
    controller.destroy();
  });
});
