import { describe, expect, it, vi } from "vitest";
import { activateChatobbyLeaf } from "../../src/ui/controller/active-chatobby-leaf";

describe("activateChatobbyLeaf", () => {
  it("reloads the feature screen after the session bootstrap and then restores focus", async () => {
    const order: string[] = [];

    await activateChatobbyLeaf({
      activateSessionContext: async () => { order.push("bootstrap"); },
      isCurrent: () => true,
      synchronizeActiveScreen: () => { order.push("screen"); },
      focusComposer: () => { order.push("focus"); },
    });

    expect(order).toEqual(["bootstrap", "screen", "focus"]);
  });

  it("does not reload or focus a leaf superseded while its session reconciles", async () => {
    const synchronizeActiveScreen = vi.fn();
    const focusComposer = vi.fn();

    await activateChatobbyLeaf({
      activateSessionContext: async () => {},
      isCurrent: () => false,
      synchronizeActiveScreen,
      focusComposer,
    });

    expect(synchronizeActiveScreen).not.toHaveBeenCalled();
    expect(focusComposer).not.toHaveBeenCalled();
  });
});
