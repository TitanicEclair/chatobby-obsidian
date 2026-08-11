import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionState, WsSessionStats } from "../../src/types";
import { LiveStatsController } from "../../src/ui/controller/live-stats-controller";

describe("LiveStatsController", () => {
  afterEach(() => vi.useRealTimers());

  it("clears stale usage and commits only the authoritative refresh when compaction ends", async () => {
    vi.useFakeTimers();
    let session: Pick<SessionState, "isStreaming" | "isCompacting"> = { isStreaming: false, isCompacting: true };
    const pending: Array<(stats: WsSessionStats) => void> = [];
    const getSessionStats = vi.fn(() => new Promise<WsSessionStats>((resolve) => pending.push(resolve)));
    const changes: Array<WsSessionStats | null> = [];
    const controller = new LiveStatsController({
      getTransport: () => ({ isConnected: true, getSessionStats } as never),
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
});

function statsWithContext(tokens: number): WsSessionStats {
  return {
    sessionFile: "s.jsonl",
    sessionId: "s",
    userMessages: 1,
    assistantMessages: 1,
    toolCalls: 0,
    toolResults: 0,
    totalMessages: 2,
    tokens: { input: tokens, output: 0, cacheRead: 0, cacheWrite: 0, total: tokens },
    cost: 0,
    contextUsage: { tokens, contextWindow: 1_000_000, percent: (tokens / 1_000_000) * 100 },
  };
}
