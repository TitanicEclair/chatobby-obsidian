import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionState, WsSessionStats } from "../../src/types";
import { LiveStatsController } from "../../src/ui/controller/live-stats-controller";

describe("LiveStatsController", () => {
  afterEach(() => vi.useRealTimers());

  it("clears stale usage and commits only the authoritative refresh when compaction ends", async () => {
    vi.useFakeTimers();
    let session: Pick<SessionState, "isStreaming" | "isCompacting"> = {
      isStreaming: false,
      isCompacting: true,
    };
    const pending: Array<(stats: WsSessionStats) => void> = [];
    const getSessionStats = vi.fn(
      () => new Promise<WsSessionStats>((resolve) => pending.push(resolve)),
    );
    const changes: Array<WsSessionStats | null> = [];
    const controller = new LiveStatsController({
      getTransport: () => ({ isConnected: true, getSessionStats }) as never,
      getSessionState: () => session,
      onChange: (stats) => changes.push(stats),
    });

    controller.sync();
    expect(getSessionStats).toHaveBeenCalledTimes(1);
    session = { isStreaming: false, isCompacting: false };
    controller.sync();
    expect(changes).toEqual([null]);

    pending.shift()?.(statsWithContext(900_000));
    await vi.runAllTimersAsync();
    expect(getSessionStats).toHaveBeenCalledTimes(2);
    expect(controller.current()).toBeNull();

    pending.shift()?.(statsWithContext(120_000));
    await vi.runAllTimersAsync();
    expect(controller.current()?.contextUsage?.tokens).toBe(120_000);
    expect(changes.at(-1)?.contextUsage?.tokens).toBe(120_000);
    controller.dispose();
  });

  it("refreshes at the compaction boundary when a queued prompt starts immediately", async () => {
    vi.useFakeTimers();
    let session: Pick<SessionState, "isStreaming" | "isCompacting"> = {
      isStreaming: false,
      isCompacting: true,
    };
    const pending: Array<(stats: WsSessionStats) => void> = [];
    const getSessionStats = vi.fn(
      () => new Promise<WsSessionStats>((resolve) => pending.push(resolve)),
    );
    const changes: Array<WsSessionStats | null> = [];
    const controller = new LiveStatsController({
      getTransport: () => ({ isConnected: true, getSessionStats }) as never,
      getSessionState: () => session,
      onChange: (stats) => changes.push(stats),
    });

    controller.sync();
    session = { isStreaming: true, isCompacting: false };
    controller.sync();
    expect(changes).toEqual([null]);

    pending.shift()?.(statsWithContext(900_000));
    await vi.advanceTimersByTimeAsync(1);
    expect(getSessionStats).toHaveBeenCalledTimes(2);
    expect(controller.current()).toBeNull();

    pending.shift()?.(statsWithContext(96_000));
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.current()?.contextUsage?.tokens).toBe(96_000);
    expect(changes.at(-1)?.contextUsage?.tokens).toBe(96_000);
    controller.dispose();
  });

  it("drops and replaces idle cached stats when the active model changes", async () => {
    const getSessionStats = vi
      .fn<() => Promise<WsSessionStats>>()
      .mockResolvedValueOnce(statsWithWindow(120_000, 400_000))
      .mockResolvedValueOnce(statsWithWindow(200, 8_000));
    const changes: Array<WsSessionStats | null> = [];
    const controller = new LiveStatsController({
      getTransport: () => ({ isConnected: true, getSessionStats }) as never,
      getSessionState: () => ({ isStreaming: false, isCompacting: false }),
      onChange: (stats) => changes.push(stats),
    });

    await controller.refresh();
    expect(controller.current()?.contextUsage?.contextWindow).toBe(400_000);

    controller.refreshAfterModelChange();
    expect(controller.current()).toBeNull();
    expect(changes.at(-1)).toBeNull();
    await vi.waitFor(() => expect(controller.current()?.contextUsage?.contextWindow).toBe(8_000));
    expect(getSessionStats).toHaveBeenCalledTimes(2);
    controller.dispose();
  });
});

function statsWithContext(tokens: number): WsSessionStats {
	return statsWithWindow(tokens, 1_000_000);
}

function statsWithWindow(tokens: number, contextWindow: number): WsSessionStats {
  return {
    sessionFile: "s.jsonl",
    sessionId: "s",
    userMessages: 1,
    assistantMessages: 1,
    toolCalls: 0,
    toolResults: 0,
    totalMessages: 2,
    tokens: {
      input: tokens,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: tokens,
    },
    cost: 0,
    contextUsage: {
      tokens,
		contextWindow,
		percent: (tokens / contextWindow) * 100,
    },
  };
}
