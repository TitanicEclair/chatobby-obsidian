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
      getSessionState: () => ({ ...EMPTY_SESSION_STATE, sessionId: "s" }),
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

  it("never substitutes cumulative lifetime tokens for unavailable current context usage", () => {
    const stats: WsSessionStats = {
      sessionFile: "s.jsonl",
      sessionId: "s",
      userMessages: 20,
      assistantMessages: 20,
      toolCalls: 10,
      toolResults: 10,
      totalMessages: 60,
      tokens: { input: 2_100_000, output: 10, cacheRead: 0, cacheWrite: 0, total: 2_100_010 },
      cost: 0,
      contextUsage: { contextWindow: 1_000_000 },
    };
    const host: ToolbarHost = {
      getConnectionState: () => ({ ...INITIAL_CONNECTION_STATE, status: "connected" }),
      getSessionState: () => ({ ...EMPTY_SESSION_STATE, sessionId: "s" }),
      getRuntimeState: readyRuntimeState,
      getStats: () => stats,
      getFeedStore: () => createFeedStore(),
      getAutoCompactionSettings: () => ({ enabled: true, thresholdPercent: 27, effectiveThresholdPercent: 27 }),
      toggleAutoCompaction: vi.fn(async () => {}),
      openAutoCompaction: vi.fn(),
    };
    const toolbar = new Toolbar(host);
    const connectionEl = document.body.createDiv();
    const statsEl = document.body.createDiv();

    toolbar.bind(connectionEl, statsEl);
    (statsEl.querySelector(".chatobby-context-meter") as HTMLButtonElement | null)?.click();

    const menuText = statsEl.querySelector(".chatobby-context-menu")?.textContent ?? "";
    expect(menuText).toContain("Usage is loading");
    expect(menuText).toContain("Calculating current usage for a 1.0M token window");
    expect(menuText).not.toContain("2.1M");
  });

  it("refreshes an open compaction popover when the active model settings arrive", () => {
    let thresholdPercent = 85;
    const host: ToolbarHost = {
      getConnectionState: () => ({ ...INITIAL_CONNECTION_STATE, status: "connected" }),
      getSessionState: () => ({ ...EMPTY_SESSION_STATE, sessionId: "s" }),
      getRuntimeState: readyRuntimeState,
      getStats: () => ({
        sessionFile: "s.jsonl",
        sessionId: "s",
        userMessages: 0,
        assistantMessages: 0,
        toolCalls: 0,
        toolResults: 0,
        totalMessages: 0,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        cost: 0,
        contextUsage: { tokens: 0, contextWindow: 1_000_000, percent: 0 },
      }),
      getFeedStore: () => createFeedStore(),
      getAutoCompactionSettings: () => ({
        enabled: true,
        thresholdPercent,
        effectiveThresholdPercent: thresholdPercent,
      }),
      toggleAutoCompaction: vi.fn(async () => {}),
      openAutoCompaction: vi.fn(),
    };
    const toolbar = new Toolbar(host);
    const connectionEl = document.body.createDiv();
    const statsEl = document.body.createDiv();

    toolbar.bind(connectionEl, statsEl);
    (statsEl.querySelector(".chatobby-context-meter") as HTMLButtonElement | null)?.click();
    expect(statsEl.querySelector(".chatobby-context-menu")?.textContent).toContain("Starts at 85%");

    thresholdPercent = 25;
    toolbar.renderFlags();

    expect(statsEl.querySelector(".chatobby-context-menu")?.textContent).toContain("Starts at 25%");
    expect(statsEl.querySelector(".chatobby-context-menu")?.textContent).not.toContain("Starts at 85%");
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
