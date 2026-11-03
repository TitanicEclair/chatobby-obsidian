import type { App } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatobbyView } from "../../src/ui/view";
import type { FrontendBootstrap } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { createSessionControllerHarness, sessionViewModel } from "../support/session/controller";
import { SessionIntentRejectedError } from "../../src/ui/controller/session-controller";
import { createMockApp } from "../obsidian-bridge/helpers/mock-app";
import { disposeObsidianSemanticContextService, getObsidianSemanticContextService } from "../../src/obsidian-context";

const apps = new Set<App>();
afterEach(() => { for (const app of apps) disposeObsidianSemanticContextService(app); apps.clear(); });
function observationApp(): App {
  const app = createMockApp(new Map([["Fixture.md", "Fixture"]]), { activeView: { path: "Fixture.md" } });
  apps.add(app); return app;
}

describe("Chatobby view snapshot recovery", () => {
  it("restores the native title and chat path before a deferred session connects", async () => {
    const { controller } = createSessionControllerHarness();
    const view = Object.assign(Object.create(ChatobbyView.prototype) as ChatobbyView, {
      app: observationApp(),
      nativeTabTitle: "Chatobby – New chat", componentsReady: false, stateHydrated: false,
      sessions: controller,
      viewNavigation: { state: () => ({ mode: "chat" }) },
    });
    await view.setState({ mode: "chat", sessionPath: "C:/synthetic/chat.jsonl", sessionTitle: "Chatobby – Garden review" }, {});
    expect(view.getDisplayText()).toBe("Chatobby – Garden review");
    expect(view.getState()).toMatchObject({ sessionPath: "C:/synthetic/chat.jsonl", sessionTitle: "Chatobby – Garden review" });
  });
  it("refreshes cached semantic titles when the same chat leaf is renamed", () => {
    const { controller, view, app } = recoveryViewHarness({});
    const service = getObsidianSemanticContextService(app);
    const before = service.snapshot();
    expect(before.focus?.title).toBe("Chatobby – Garden review");
    controller.applyRuntimeSession(sessionViewModel("saved", { name: "Updated review", recoveryPath: "C:/synthetic/saved.jsonl" }));
    expect(view.getDisplayText()).toBe("Chatobby – Updated review");
    const after = service.snapshot();
    expect(after.focus?.title).toBe(view.getDisplayText());
    expect(after.workspace.leaves.find((leaf) => leaf.isActive)?.title).toBe(view.getDisplayText());
    expect(after.sequence).toBeGreaterThan(before.sequence);
  });
  // @see docs/architecture/managed-runtime-lifecycle.md#leaf-session-recovery
  it.each(["pending", "disconnected"] as const)("keeps the saved leaf path/title during a %s target's provisional bootstrap", async (source) => {
    const saved = sessionViewModel("saved", { name: "Garden review", messageCount: 8, recoveryPath: "C:/synthetic/saved.jsonl" });
    const { controller, view, setViewState, persistedStates } = recoveryViewHarness({
      dispatch: async (_request, target) => { target.applyRuntimeSession({ ...saved, name: "Updated review" }); return true; },
    });
    controller.applyRuntimeSession(saved);
    if (source === "pending") controller.setPendingSessionPath(saved.recoveryPath!);
    else controller.markTransportDisconnected();
    persistedStates.length = 0; setViewState.mockClear();
    controller.applyRuntimeSession(sessionViewModel("temporary", { name: "New chat", recoveryPath: "C:/synthetic/temporary.jsonl" }));
    expect(view.getState().sessionPath).toBe(saved.recoveryPath);
    expect(view.getDisplayText()).toBe("Chatobby – Garden review");
    expect(setViewState).not.toHaveBeenCalled();
    expect(persistedStates.length).toBeGreaterThan(0);
    expect(persistedStates.every((state) => state.sessionPath === saved.recoveryPath)).toBe(true);
    await controller.reconcileActiveSession();
    expect(controller.recoverySessionPath).toBeNull();
    expect(view.getState().sessionPath).toBe(saved.recoveryPath);
    expect(view.getDisplayText()).toBe("Chatobby – Updated review");
    expect(setViewState).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ sessionPath: saved.recoveryPath, sessionTitle: "Chatobby – Updated review" }) }));
    expect(persistedStates.at(-1)).toMatchObject({ sessionPath: saved.recoveryPath, sessionTitle: "Chatobby – Updated review" });
  });
  it("publishes the available chat path and title after a deleted saved target falls back", async () => {
    const available = sessionViewModel("available", { name: "Available chat", recoveryPath: "C:/synthetic/available.jsonl" });
    const { controller, view, setViewState, persistedStates } = recoveryViewHarness({
      dispatch: async () => { throw new SessionIntentRejectedError("SESSION_NOT_FOUND", "Deleted"); },
      synchronize: async (target) => { target.applyRuntimeSession(available); },
    });
    controller.setPendingSessionPath("C:/synthetic/deleted.jsonl");
    await controller.reconcileActiveSession();
    expect(controller.recoverySessionPath).toBeNull();
    expect(view.getState()).toMatchObject({ sessionPath: available.recoveryPath, sessionTitle: "Chatobby – Available chat" });
    expect(setViewState).toHaveBeenCalledOnce();
    expect(setViewState).toHaveBeenCalledWith(expect.objectContaining({ state: expect.objectContaining({ sessionPath: available.recoveryPath, sessionTitle: "Chatobby – Available chat" }) }));
    expect(persistedStates.at(-1)).toMatchObject({ sessionPath: available.recoveryPath, sessionTitle: "Chatobby – Available chat" });
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
      projectedPermissions: { update: vi.fn() },
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

/** Use the real view persistence/title bridge while the runtime projection changes. */
function recoveryViewHarness(options: Parameters<typeof createSessionControllerHarness>[0]) {
  const persistedStates: ReturnType<ChatobbyView["getState"]>[] = [];
  let view!: ChatobbyView;
  const harness = createSessionControllerHarness({
    ...options,
    refreshTabBar: () => view["refreshTabBar"](),
    renderActiveTab: vi.fn(() => view["refreshTabBar"]()),
    persistLeafState: vi.fn(() => { persistedStates.push(view.getState()); }),
  });
  const setViewState = vi.fn(async () => {});
  const app = observationApp();
  view = Object.assign(Object.create(ChatobbyView.prototype) as ChatobbyView, {
    app,
    nativeTabTitle: "Chatobby – Garden review", componentsReady: true, stateHydrated: true,
    sessions: harness.controller, viewNavigation: { state: () => ({ mode: "chat" }) },
    tabBar: { refresh: vi.fn() }, leaf: { setViewState },
  });
  const activeLeaf = (app.workspace as unknown as { activeLeaf: { view: ChatobbyView } }).activeLeaf;
  activeLeaf.view = view;
  return { ...harness, view, app, setViewState, persistedStates };
}
