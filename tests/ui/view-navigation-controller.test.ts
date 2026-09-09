import { describe, expect, it, vi } from "vitest";
import type { WorkspaceLeaf } from "obsidian";
import {
  closeInactiveViewSurfaces,
  clearWorkspaceLeafNavigationHistory,
  parseNavigationState,
  ribbonModeForNavigation,
  shouldActivateLeafSession,
  type ChatobbyNavigationState,
  ViewNavigationController,
} from "../../src/ui/controller/view-navigation-controller";

describe("ViewNavigationController", () => {
  it("closes every inactive full-view surface during page transitions", () => {
    const closers = {
      overlays: vi.fn(),
      subagents: vi.fn(),
      channels: vi.fn(),
    };

    closeInactiveViewSurfaces("overlays", closers);
    expect(closers.overlays).not.toHaveBeenCalled();
    expect(closers.subagents).toHaveBeenCalledOnce();
    expect(closers.channels).toHaveBeenCalledOnce();

    for (const close of Object.values(closers)) close.mockClear();
    closeInactiveViewSurfaces("chat", closers);
    for (const close of Object.values(closers)) expect(close).toHaveBeenCalledOnce();
  });

  it("records opened screens but replaces workflow completions without appending history", () => {
    const leaf = {
      setViewState: vi.fn(async () => {}),
      history: { backHistory: [{ state: "permissions" }], forwardHistory: [{ state: "memory" }] },
      trigger: vi.fn(),
    } as unknown as WorkspaceLeaf;
    const controller = new ViewNavigationController(leaf, "chatobby-view", {
      openChat: vi.fn(),
      openPermissions: vi.fn(),
      openMemory: vi.fn(),
      openEvents: vi.fn(),
      openMcp: vi.fn(),
      openProjects: vi.fn(),
      openSettings: vi.fn(),
      openSubagents: vi.fn(),
      openChannels: vi.fn(),
      getLeafSessionState: () => ({ vaultDirectoryPath: "project", sessionPath: "session.jsonl" }),
      onError: vi.fn(),
    });

    controller.navigate({ mode: "permissions" });
    expect(controller.shouldRecordHistory({ mode: "permissions" })).toBe(true);

    controller.replace({ mode: "chat" });
    expect(controller.shouldRecordHistory({ mode: "chat" })).toBe(false);

		controller.navigate({ mode: "subagents", runId: "run-a", nodeId: "node-a" });
		controller.reset();
		expect((leaf as unknown as { history: { backHistory: unknown[]; forwardHistory: unknown[] } }).history).toEqual({
			backHistory: [],
			forwardHistory: [],
		});
		expect((leaf as unknown as { trigger: ReturnType<typeof vi.fn> }).trigger).toHaveBeenCalledWith("history-change");
		expect(leaf.setViewState).toHaveBeenLastCalledWith({
			type: "chatobby-view",
			state: { mode: "chat", vaultDirectoryPath: "project", sessionPath: "session.jsonl" },
			active: true,
		});
		expect(controller.shouldRecordHistory({ mode: "chat" })).toBe(false);
  });

  it("clears native history safely when an Obsidian version does not expose the expected bridge", () => {
    const leaf = {} as WorkspaceLeaf;

    expect(() => clearWorkspaceLeafNavigationHistory(leaf)).not.toThrow();
  });

  it("keeps display-only navigation separate from runtime session activation", () => {
    const current = { vaultDirectoryPath: "project", sessionPath: "session.jsonl" };

    expect(shouldActivateLeafSession(true, current, {})).toBe(false);
    expect(shouldActivateLeafSession(true, current, current)).toBe(false);
    expect(shouldActivateLeafSession(true, current, { sessionPath: "other.jsonl" })).toBe(true);
    expect(shouldActivateLeafSession(false, current, {})).toBe(true);
  });

  it("falls back to chat when restoring a retired Context Queries route", () => {
    expect(parseNavigationState({ mode: "queries" })).toEqual({
      mode: "chat",
      runId: undefined,
      nodeId: undefined,
      subagentTab: undefined,
      feedOnly: undefined,
      channelId: undefined,
      messageId: undefined,
      pluginId: undefined,
      projectId: undefined,
    });
  });

  it("does not mark the Subagents management page active for a child conversation feed", () => {
    expect(ribbonModeForNavigation("subagents", {
      mode: "subagents",
      runId: "run-a",
      nodeId: "node-a",
      feedOnly: true,
    })).toBe("chat");
    expect(ribbonModeForNavigation("subagents", { mode: "subagents" })).toBe("subagents");
    expect(ribbonModeForNavigation("memory", { mode: "memory" })).toBe("memory");
  });

  it("does not write Obsidian history for the current or already-pending route", async () => {
    const leaf = { setViewState: vi.fn(async () => {}) } as unknown as WorkspaceLeaf;
    const controller = createController(leaf);

    controller.navigate({ mode: "chat" });
    expect(leaf.setViewState).not.toHaveBeenCalled();

    controller.navigate({ mode: "permissions" });
    controller.navigate({ mode: "permissions" });
    controller.navigate({ mode: "permissions" });
    expect(leaf.setViewState).toHaveBeenCalledOnce();
    expect(controller.shouldRecordHistory({ mode: "permissions" })).toBe(true);
    await controller.apply({ mode: "permissions" });

    leaf.setViewState.mockClear();
    controller.navigate({ mode: "permissions" });
    expect(leaf.setViewState).not.toHaveBeenCalled();
    expect(controller.shouldRecordHistory({ mode: "permissions" })).toBe(false);
  });

  it("handles every directed top-level route transition exactly once", async () => {
    const routes: ChatobbyNavigationState[] = [
      { mode: "chat" },
      { mode: "projects" },
      { mode: "subagents" },
      { mode: "channels" },
      { mode: "permissions" },
      { mode: "memory" },
      { mode: "events" },
      { mode: "mcp" },
      { mode: "settings" },
    ];

    for (const from of routes) {
      for (const to of routes) {
        const leaf = { setViewState: vi.fn(async () => {}) } as unknown as WorkspaceLeaf;
        const controller = createController(leaf);
        await controller.apply(from);

        controller.navigate(to);

        expect(leaf.setViewState, `${from.mode} -> ${to.mode}`).toHaveBeenCalledTimes(from.mode === to.mode ? 0 : 1);
      }
    }
  });

  it("treats each plugin detail as an Obsidian history route", async () => {
    const leaf = { setViewState: vi.fn(async () => {}) } as unknown as WorkspaceLeaf;
    const openMcp = vi.fn();
    const controller = createController(leaf, openMcp);

    controller.navigate({ mode: "mcp", pluginId: "mcp:installed:demo" });
    expect(leaf.setViewState).toHaveBeenCalledWith({
      type: "chatobby-view",
      state: {
        mode: "mcp",
        pluginId: "mcp:installed:demo",
        vaultDirectoryPath: "project",
        sessionPath: "session.jsonl",
      },
      active: true,
    });

    const restored = parseNavigationState({ mode: "mcp", pluginId: "mcp:installed:demo" });
    await controller.apply(restored);
    expect(openMcp).toHaveBeenCalledWith(restored);
  });

  it("persists a Project selection as one Obsidian history route", async () => {
    const leaf = { setViewState: vi.fn(async () => {}) } as unknown as WorkspaceLeaf;
    const openProjects = vi.fn();
    const controller = createController(leaf, vi.fn(), openProjects);

    controller.navigate({ mode: "projects", projectId: "project:alpha" });
    expect(leaf.setViewState).toHaveBeenCalledWith({
      type: "chatobby-view",
      state: {
        mode: "projects",
        projectId: "project:alpha",
        vaultDirectoryPath: "project",
        sessionPath: "session.jsonl",
      },
      active: true,
    });

    const restored = parseNavigationState({
      mode: "projects",
      projectId: "project:alpha",
    });
    await controller.apply(restored);
    expect(openProjects).toHaveBeenCalledWith(restored);
  });
});

function createController(
  leaf: WorkspaceLeaf,
  openMcp: (state: ChatobbyNavigationState) => void = vi.fn(),
  openProjects: (state: ChatobbyNavigationState) => void = vi.fn(),
): ViewNavigationController {
  return new ViewNavigationController(leaf, "chatobby-view", {
    openChat: vi.fn(),
    openPermissions: vi.fn(),
    openMemory: vi.fn(),
    openEvents: vi.fn(),
    openMcp,
    openProjects,
    openSettings: vi.fn(),
    openSubagents: vi.fn(),
    openChannels: vi.fn(),
    getLeafSessionState: () => ({ vaultDirectoryPath: "project", sessionPath: "session.jsonl" }),
    onError: vi.fn(),
  });
}
