import { describe, expect, it, vi } from "vitest";
import { ChatobbyView } from "../../src/ui/view";
import type { FrontendBootstrap } from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("Chatobby view snapshot recovery", () => {
  it("restores the native title and chat path before a deferred session connects", async () => {
    const view = Object.assign(Object.create(ChatobbyView.prototype) as ChatobbyView, {
      nativeTabTitle: "Chatobby – New chat", componentsReady: false, stateHydrated: false,
      sessions: { activeTab: () => undefined, workingDirectoryPath: () => "", restoreWorkingDirectory: vi.fn() },
      viewNavigation: { state: () => ({ mode: "chat" }) },
    });
    await view.setState({ mode: "chat", sessionPath: "C:/synthetic/chat.jsonl", sessionTitle: "Chatobby – Garden review" }, {});
    expect(view.getDisplayText()).toBe("Chatobby – Garden review");
    expect(view.getState()).toMatchObject({ sessionPath: "C:/synthetic/chat.jsonl", sessionTitle: "Chatobby – Garden review" });
  });
  it("settles Stop and the tool feed even when the task widget throws", () => {
    const previous = {
      session: {
        id: "session-1", streaming: true, compacting: false,
        thinkingLevel: "medium", messageCount: 2,
      },
      feed: { revision: 1, blocks: [] },
      taskPlan: { revision: 0, items: [], completedCount: 0, remainingCount: 0, summary: "No tasks" },
    } as unknown as FrontendBootstrap;
    const completed: FrontendBootstrap = {
      ...previous,
      session: { ...previous.session!, streaming: false },
      feed: { revision: 2, blocks: [] },
      taskPlan: { ...previous.taskPlan, revision: 1 },
    };
    const failure = new Error("Task widget failed to render");
    const setStreaming = vi.fn();
    const setActivity = vi.fn();
    const synchronizeFrontendFeed = vi.fn();
    const dispatch = vi.fn();
    const view = Object.assign(Object.create(ChatobbyView.prototype) as ChatobbyView, {
      plugin: { notifySessionDirectoryChanged: vi.fn() },
      sessions: {
        sessionState: { thinkingLevel: "medium" },
        applyRuntimeSession: vi.fn(),
      },
      composer: { setStreaming, observeTurnProgress: vi.fn() },
      turnAbort: { setActivity },
      taskProgress: { setModel: () => { throw failure; } },
      liveStats: { sync: vi.fn() },
      viewMode: "chat",
      getFeedStore: () => ({ dispatch }),
      synchronizeFrontendFeed,
    });

    expect(() => view["applyFrontendSnapshot"](completed, previous)).toThrow(failure);
    expect(setStreaming).toHaveBeenCalledWith(false);
    expect(setActivity).toHaveBeenCalledWith(false);
    expect(dispatch).toHaveBeenCalledWith({ type: "feed.runtime-activity-synchronized", active: false });
    expect(synchronizeFrontendFeed).toHaveBeenCalledWith(completed);
  });
});
