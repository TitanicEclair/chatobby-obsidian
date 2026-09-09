import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FrontendSnapshotBatcher,
  sessionDirectoryProjectionChanged,
  sessionModelProjectionChanged,
} from "../../src/frontend/frontend-snapshot-batcher";
import type { FrontendBootstrap } from "../../src/vendor/chatobby-client/frontend-contracts.js";

function snapshot(streaming: boolean, messageCount: number, compacting = false): FrontendBootstrap {
  return {
    session: {
      id: "session-1",
      streaming,
      compacting,
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

  it("flushes compaction completion immediately", () => {
    vi.useFakeTimers();
    const apply = vi.fn();
    const batcher = new FrontendSnapshotBatcher(30, apply);
    const compacting = snapshot(false, 3, true);
    const completed = snapshot(false, 3, false);

    batcher.schedule(compacting);
    vi.advanceTimersByTime(30);
    expect(apply).toHaveBeenLastCalledWith(compacting, null);

    batcher.schedule(completed);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith(completed, compacting);
  });

  it("detects metadata and activity transitions even before the message count changes", () => {
    const previous = snapshot(false, 3).session;
    expect(sessionDirectoryProjectionChanged(previous, snapshot(false, 3).session)).toBe(false);
    expect(sessionDirectoryProjectionChanged(previous, snapshot(false, 4).session)).toBe(true);
    expect(sessionDirectoryProjectionChanged(previous, snapshot(true, 3).session)).toBe(true);
    expect(sessionDirectoryProjectionChanged(snapshot(true, 3).session, previous)).toBe(true);
    expect(sessionDirectoryProjectionChanged(previous, snapshot(false, 3, true).session)).toBe(true);
    expect(sessionDirectoryProjectionChanged(snapshot(false, 3, true).session, previous)).toBe(true);
  });

  it("retries from the last successful render after a terminal snapshot throws", () => {
    vi.useFakeTimers();
    const running = snapshot(true, 1);
    const completed = snapshot(false, 2);
    const later = { ...completed };
    const failure = new Error("Task widget failed to render");
    const apply = vi.fn((next: FrontendBootstrap) => {
      if (next === completed) throw failure;
    });
    const batcher = new FrontendSnapshotBatcher(30, apply);
    batcher.schedule(running);
    vi.advanceTimersByTime(30);

    expect(() => batcher.schedule(completed)).toThrow(failure);
    expect(batcher.current()).toBe(running);

    // The next patch may reuse the same session and task-plan objects. It must
    // compare them with the last successful render, not the failed snapshot.
    batcher.schedule(later);
    expect(apply).toHaveBeenLastCalledWith(later, running);
    expect(batcher.current()).toBe(later);
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it("detects model changes only within the same active session", () => {
    const previous = { ...snapshot(false, 3).session!, model: "openai/gpt-5" };
    expect(sessionModelProjectionChanged(previous, { ...previous, model: "local/fixture" })).toBe(true);
    expect(sessionModelProjectionChanged(previous, { ...previous })).toBe(false);
    expect(sessionModelProjectionChanged(previous, { ...previous, id: "session-2", model: "local/fixture" })).toBe(false);
  });
});
