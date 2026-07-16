import { afterEach, describe, expect, it, vi } from "vitest";
import { createFeedStore } from "../../src/features/feed/public";
import { INITIAL_CONNECTION_STATE, EMPTY_SESSION_STATE, type WsSessionStats } from "../../src/types";
import { Toolbar, type ToolbarHost } from "../../src/ui/toolbar/toolbar";

describe("Toolbar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows elapsed time only while a run is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);

    const feedStore = createFeedStore({ now: () => 2_000 });
    feedStore.dispatch({
      type: "feed.user-prompt-submitted",
      text: "hello",
      startRun: true,
    });
    const host: ToolbarHost = {
      getConnectionState: () => ({ ...INITIAL_CONNECTION_STATE, status: "connected" }),
      getSessionState: () => ({ ...EMPTY_SESSION_STATE, isStreaming: true }),
      getRuntimeState: readyRuntimeState,
      getStats: () => null,
      getFeedStore: () => feedStore,
      getAutoCompactionSettings: () => ({ enabled: true, thresholdPercent: 85, effectiveThresholdPercent: 85 }),
      toggleAutoCompaction: vi.fn(async () => {}),
      openAutoCompaction: vi.fn(),
    };
    const toolbar = new Toolbar(host);
    const connectionEl = document.body.createDiv();
    const statsEl = document.body.createDiv();

    toolbar.bind(connectionEl, statsEl);
    expect(statsEl.textContent).toContain("3s");

    feedStore.dispatch({ type: "feed.runtime-activity-synchronized", active: false });
    toolbar.renderStatus();

    expect(statsEl.querySelector(".chatobby-toolbar__stats-elapsed")).toBeNull();
    expect(statsEl.textContent).toBe("—");
  });

  it("keeps token stats visible after a run finishes without showing stale elapsed time", () => {
    const stats: WsSessionStats = {
      sessionFile: "s.jsonl",
      sessionId: "s",
      userMessages: 1,
      assistantMessages: 1,
      toolCalls: 0,
      toolResults: 0,
      totalMessages: 2,
      tokens: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, total: 3 },
      cost: 0,
      contextUsage: { tokens: 3, contextWindow: 100, percent: 3 },
    };
    const host: ToolbarHost = {
      getConnectionState: () => ({ ...INITIAL_CONNECTION_STATE, status: "connected" }),
      getSessionState: () => EMPTY_SESSION_STATE,
      getRuntimeState: readyRuntimeState,
      getStats: () => stats,
      getFeedStore: () => createFeedStore(),
      getAutoCompactionSettings: () => ({ enabled: true, thresholdPercent: 85, effectiveThresholdPercent: 80 }),
      toggleAutoCompaction: vi.fn(async () => {}),
      openAutoCompaction: vi.fn(),
    };
    const toolbar = new Toolbar(host);
    const connectionEl = document.body.createDiv();
    const statsEl = document.body.createDiv();

    toolbar.bind(connectionEl, statsEl);

    expect(statsEl.querySelector(".chatobby-toolbar__stats-elapsed")).toBeNull();
    const meterEl = statsEl.querySelector(".chatobby-context-meter");
    expect(meterEl).not.toBeNull();
    expect(meterEl?.getAttribute("title")).toContain("3 / 100 tokens");
    expect(meterEl?.getAttribute("title")).toContain("Context window 3% full");
    (meterEl as HTMLButtonElement | null)?.click();
    expect(statsEl.querySelector(".chatobby-context-menu")?.textContent).toContain("3% used");
    expect(statsEl.querySelector(".chatobby-context-menu")?.textContent).toContain("Starts at 85%");
    expect(statsEl.querySelector(".chatobby-context-menu")?.textContent).toContain("safety-adjusted to 80%");
  });
});

function readyRuntimeState() {
  return {
    status: "ready" as const,
    readyAt: 1,
    runtime: {
      endpoint: "ws://127.0.0.1:43125",
      ownership: "managed" as const,
      identity: {
        instanceId: "runtime-1",
        vaultId: "vault-1",
        pid: 1,
        startedAt: 1,
        runtimeVersion: "0.1.0",
        protocolVersion: 1,
      },
    },
  };
}
