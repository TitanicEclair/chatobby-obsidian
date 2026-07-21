import { afterEach, describe, expect, it, vi } from "vitest";
import { FrontendSnapshotBatcher, sessionDirectoryProjectionChanged } from "../../src/frontend/frontend-snapshot-batcher";
import type { FrontendBootstrap } from "../../src/vendor/chatobby-client/frontend-contracts.js";

function snapshot(streaming: boolean, messageCount: number): FrontendBootstrap {
  return {
    session: {
      id: "session-1",
      streaming,
      messageCount,
      recoveryPath: "sessions/session-1.jsonl",
      name: "Session",
    },
  } as unknown as FrontendBootstrap;
}

describe("FrontendSnapshotBatcher", () => {
  afterEach(() => vi.useRealTimers());

  it("coalesces active streaming patches but flushes completion immediately", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const batcher = new FrontendSnapshotBatcher(30, apply);
    const first = snapshot(true, 1);
    const second = snapshot(true, 2);
    const completed = snapshot(false, 3);

    batcher.schedule(first);
    batcher.schedule(second);
    expect(apply).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenLastCalledWith(second, null);

    batcher.schedule(completed);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith(completed, second);
  });

  it("detects only persisted session-directory metadata changes", () => {
    const previous = snapshot(false, 3).session;
    expect(sessionDirectoryProjectionChanged(previous, snapshot(false, 3).session)).toBe(false);
    expect(sessionDirectoryProjectionChanged(previous, snapshot(false, 4).session)).toBe(true);
  });
});
