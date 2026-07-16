import { describe, expect, it, vi } from "vitest";
import type { WorkspaceLeaf } from "obsidian";
import { ViewNavigationController } from "../../src/ui/controller/view-navigation-controller";

describe("ViewNavigationController", () => {
  it("records opened screens but replaces workflow completions without appending history", () => {
    const leaf = { setViewState: vi.fn(async () => {}) } as unknown as WorkspaceLeaf;
    const controller = new ViewNavigationController(leaf, "chatobby-view", {
      openChat: vi.fn(),
      openPermissions: vi.fn(),
      openMemory: vi.fn(),
      openEvents: vi.fn(),
      openSubagents: vi.fn(),
      openChannels: vi.fn(),
      openSessionPicker: vi.fn(async () => {}),
      onError: vi.fn(),
    });

    controller.navigate({ mode: "permissions" });
    expect(controller.shouldRecordHistory({ mode: "permissions" })).toBe(true);

    controller.replace({ mode: "chat" });
    expect(controller.shouldRecordHistory({ mode: "chat" })).toBe(false);

		controller.navigate({ mode: "subagents", runId: "run-a", nodeId: "node-a" });
		controller.reset();
		expect(leaf.setViewState).toHaveBeenLastCalledWith({
			type: "chatobby-view",
			state: { mode: "chat" },
			active: true,
		});
		expect(controller.shouldRecordHistory({ mode: "chat" })).toBe(false);
  });
});
