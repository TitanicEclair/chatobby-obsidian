import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import type { SessionTab } from "../../../src/features/session/public";
import { ActiveSessionActions } from "../../../src/ui/session/active-session-actions";

const { pickItemMock } = vi.hoisted(() => ({ pickItemMock: vi.fn() }));

vi.mock("../../../src/ui/modals/modals", () => ({
  pickItem: pickItemMock,
  promptText: vi.fn(),
}));

describe("ActiveSessionActions", () => {
  it("forks the persisted path and opens the result without switching the source runtime", async () => {
    pickItemMock.mockResolvedValue({ entryId: "user-1", label: "Fork here" });
    const dispatchSessionIntent = vi.fn(async () => true);
    const forkStoredSession = vi.fn(async () => ({
      sessionId: "fork-session",
      sessionPath: "C:/sessions/fork-session.jsonl",
    }));
    const openForkedSession = vi.fn(async () => {});
    const runTransition = vi.fn(async (_label: string, operation: () => Promise<void>) => operation());
    const actions = new ActiveSessionActions({
      app: {} as App,
      getTransport: () => null,
      getActiveTab: () => ({
        sessionId: "source-session",
        sessionFile: "C:/sessions/source-session.jsonl",
      }) as SessionTab,
      getWorkingDirectory: () => "Projects/Research",
      getForkOptions: () => [{ entryId: "user-1", label: "Fork here" }],
      forkStoredSession,
      openForkedSession,
      dispatchSessionIntent,
      runOperation: async (_descriptor, operation) => operation(),
      runTransition,
      setTab: vi.fn(),
      refreshTabs: vi.fn(),
      sessionsChanged: vi.fn(),
    });

    await actions.fork();

    expect(forkStoredSession).toHaveBeenCalledWith("C:/sessions/source-session.jsonl", "user-1");
    expect(openForkedSession).toHaveBeenCalledWith("Projects/Research", "C:/sessions/fork-session.jsonl");
    expect(dispatchSessionIntent).not.toHaveBeenCalled();
    expect(runTransition).toHaveBeenCalledWith("Forking session", expect.any(Function));
  });
});
