import { describe, expect, it } from "vitest";
import { createFeedStore, feedSelectors } from "../../src/features/feed/public";
import { ConnectionStatusController } from "../../src/ui/controller/connection-status-controller";

describe("ConnectionStatusController", () => {
  it("replaces an active-work interruption with a recovery receipt", () => {
    const store = createFeedStore();
    const controller = new ConnectionStatusController(() => store);

    controller.markInterrupted({ hadActiveWork: true, hadInteraction: false });
    const interruptedId = store.select(feedSelectors.orderedBlockIds)[0];
    expect(store.select(feedSelectors.blockById(interruptedId))?.type).toBe("extension-panel");
    expect(store.select(feedSelectors.blockById(interruptedId))).toMatchObject({
      title: "Connection interrupted",
      level: "warning",
    });

    controller.markRestored();

    expect(store.select(feedSelectors.orderedBlockIds)).toEqual([interruptedId]);
    expect(store.select(feedSelectors.blockById(interruptedId))).toMatchObject({
      title: "Connection restored",
      level: "info",
    });
  });

  it("does not add feed noise for an idle disconnect", () => {
    const store = createFeedStore();
    const controller = new ConnectionStatusController(() => store);

    controller.markInterrupted({ hadActiveWork: false, hadInteraction: false });
    controller.markRestored();

    expect(store.select(feedSelectors.orderedBlockIds)).toEqual([]);
  });
});
