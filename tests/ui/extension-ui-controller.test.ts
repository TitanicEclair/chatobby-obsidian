import { describe, expect, it, vi } from "vitest";
import { createFeedStore } from "../../src/features/feed/public";
import type { FeedRenderer } from "../../src/ui/feed";
import { ExtensionUiController } from "../../src/ui/controller/extension-ui-controller";
import type { InteractionCard } from "../../src/ui/feed/interaction-card";
import type { InteractionState, WsExtensionUIRequest } from "../../src/types";

describe("ExtensionUiController", () => {
  it("queues parallel blocking requests without hiding an unresolved interaction", async () => {
    let interaction: InteractionState | null = null;
    let mountedCard: InteractionCard | null = null;
    const mountInteraction = vi.fn((card: InteractionCard) => { mountedCard = card; });
    const clearInteraction = vi.fn(() => { mountedCard = null; });
    const renderer = { mountInteraction, clearInteraction } as unknown as FeedRenderer;
    const controller = new ExtensionUiController({
      getFeedStore: () => createFeedStore(),
      getFeedRenderer: () => renderer,
      setComposerText: vi.fn(),
      getActiveInteraction: () => interaction,
      setActiveInteraction: (next) => { interaction = next; },
    });
    const first = controller.handle(confirmRequest("confirm-1", "Explore the vault"));
    const second = controller.handle(confirmRequest("confirm-2", "Search the web"));

    expect(interaction?.id).toBe("confirm-1");
    expect(mountInteraction).toHaveBeenCalledTimes(1);
    expect(mountedCard).not.toBeNull();

    controller.submit();
    expect(interaction?.id).toBe("confirm-1");
    controller.handleKeydown(new KeyboardEvent("keydown", { key: "Enter" }));

    await expect(first).resolves.toBe(true);
    expect(interaction?.id).toBe("confirm-2");
    expect(mountInteraction).toHaveBeenCalledTimes(2);
    expect(clearInteraction).toHaveBeenCalledTimes(1);

    controller.handleKeydown(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(second).resolves.toBe(false);
    expect(interaction).toBeNull();
    expect(clearInteraction).toHaveBeenCalledTimes(2);
  });

	it("cancels the active request and clears its interaction", async () => {
    let interaction: InteractionState | null = null;
    const clearInteraction = vi.fn();
    const renderer = {
      mountInteraction: vi.fn(),
      clearInteraction,
    } as unknown as FeedRenderer;
    const controller = new ExtensionUiController({
      getFeedStore: () => createFeedStore(),
      getFeedRenderer: () => renderer,
      setComposerText: vi.fn(),
      getActiveInteraction: () => interaction,
      setActiveInteraction: (next) => { interaction = next; },
    });
    const pending = controller.handle(confirmRequest("confirm-abort", "Run a command"));

    controller.cancelActive();

    await expect(pending).resolves.toBeUndefined();
    expect(interaction).toBeNull();
		expect(clearInteraction).toHaveBeenCalledTimes(1);
	});

	it("cancels the active and queued requests without mounting the next card", async () => {
		let interaction: InteractionState | null = null;
		const mountInteraction = vi.fn();
		const clearInteraction = vi.fn();
		const renderer = { mountInteraction, clearInteraction } as unknown as FeedRenderer;
		const controller = new ExtensionUiController({
			getFeedStore: () => createFeedStore(),
			getFeedRenderer: () => renderer,
			setComposerText: vi.fn(),
			getActiveInteraction: () => interaction,
			setActiveInteraction: (next) => { interaction = next; },
		});
		const first = controller.handle(confirmRequest("confirm-1", "Read a path"));
		const second = controller.handle(confirmRequest("confirm-2", "Call an MCP tool"));

		controller.cancelAll();

		await expect(first).resolves.toBeUndefined();
		await expect(second).resolves.toBeUndefined();
		expect(interaction).toBeNull();
		expect(mountInteraction).toHaveBeenCalledTimes(1);
		expect(clearInteraction).toHaveBeenCalledTimes(1);
	});
});

function confirmRequest(id: string, message: string): WsExtensionUIRequest {
  return { id, method: "confirm", params: { title: "Allow subagent delegation?", message } };
}
