import { describe, expect, it, vi } from "vitest";
import type { FeedSnapshotV2 } from "../../../src/features/feed/public";
import {
  assistantCallId,
  blockId,
  createFeedStore,
  createEmptyFeedSnapshot,
  FeedHydrationError,
  feedSelectors,
  hydrateFeedStore,
} from "../../../src/features/feed/public";

describe("normalized FeedStore", () => {
  it.each([100, 1_000, 10_000])("keeps a targeted %i-block update bounded to one dirty entity", (count) => {
    const store = createFeedStore({ snapshot: thinkingFeedSnapshot(count) });
    const firstId = blockId("block-0");
    const targetId = blockId(`block-${count - 1}`);
    const firstBefore = store.select(feedSelectors.blockById(firstId));

    const commit = store.dispatch({ type: "feed.ui.thinking-display-set", blockId: targetId, mode: "expanded" });

    expect(commit.changes.updatedBlockIds).toEqual([targetId]);
    expect(commit.changes.addedBlockIds).toEqual([]);
    expect(commit.changes.removedBlockIds).toEqual([]);
    expect(store.select(feedSelectors.blockById(firstId))).toBe(firstBefore);
  });

  it("changes one view model without cloning unrelated entities in a large feed", () => {
    const snapshot = thinkingFeedSnapshot(1_000);
    const store = createFeedStore({ snapshot });
    const firstId = blockId("block-0");
    const targetId = blockId("block-999");
    const firstBefore = store.select(feedSelectors.blockById(firstId));
    const targetBefore = store.select(feedSelectors.blockById(targetId));

    const commit = store.dispatch({
      type: "feed.ui.thinking-display-set",
      blockId: targetId,
      mode: "expanded",
    });

    expect(commit.changes.updatedBlockIds).toEqual([targetId]);
    expect(commit.documentRevision).toBe(0);
    expect(commit.viewRevision).toBe(1);
    expect(store.select(feedSelectors.blockById(firstId))).toBe(firstBefore);
    expect(store.select(feedSelectors.blockById(targetId))).not.toBe(targetBefore);
    expect(store.select(feedSelectors.blockById(targetId))).toMatchObject({ displayMode: "expanded" });
  });

  it("keeps block selector observations quiet for scroll-only commits", () => {
    const store = createFeedStore({ snapshot: thinkingFeedSnapshot(2) });
    const listener = vi.fn();
    const subscription = store.observe(feedSelectors.blockById(blockId("block-0")), listener);

    store.dispatch({
      type: "feed.ui.scroll-changed",
      scroll: { isAtBottom: false, scrollTop: 250 },
    });

    expect(listener).not.toHaveBeenCalled();
    subscription.dispose();
  });

  it("round-trips normalized snapshots and rebuilds private indexes", () => {
    const snapshot = thinkingFeedSnapshot(3);
    const first = hydrateFeedStore(snapshot);
    const roundTrip = first.exportSnapshot();
    const second = hydrateFeedStore(roundTrip);

    expect(second.exportSnapshot()).toEqual(roundTrip);
    expect(second.select(feedSelectors.orderedBlockIds)).toEqual(snapshot.blockOrder);
  });

  it("rejects dangling normalized references during hydration", () => {
    const snapshot = createEmptyFeedSnapshot();
    const malformed: FeedSnapshotV2 = {
      ...snapshot,
      blockOrder: [blockId("missing")],
    };

    expect(() => hydrateFeedStore(malformed)).toThrow(FeedHydrationError);
  });

  it("rejects malformed entity and runtime payloads before index rebuilding", () => {
    const malformedBlock = { ...createEmptyFeedSnapshot(), blocks: [{ id: "block-1", type: "not-a-block" }] };
    const malformedRuntime = {
      ...createEmptyFeedSnapshot(),
      runtime: { ...createEmptyFeedSnapshot().runtime, nextSequence: -1 },
    };

    expect(() => hydrateFeedStore(malformedBlock)).toThrow(FeedHydrationError);
    expect(() => hydrateFeedStore(malformedRuntime)).toThrow(FeedHydrationError);
  });

  it("commits listener-triggered view updates as a separate revision", () => {
    const store = createFeedStore();
    let observedScroll: ReturnType<typeof feedSelectors.scroll> | undefined;
    let followUpCommit: ReturnType<typeof store.dispatch> | undefined;
    store.subscribe((commit) => {
      if (commit.revision !== 1) return;
      observedScroll = store.select(feedSelectors.scroll);
      followUpCommit = store.dispatch({
        type: "feed.ui.scroll-changed",
        scroll: { isAtBottom: true, scrollTop: 0 },
      });
    });

    const initialCommit = store.dispatch({
      type: "feed.ui.scroll-changed",
      scroll: { isAtBottom: false, scrollTop: 10 },
    });

    expect(initialCommit.revision).toBe(1);
    expect(observedScroll).toEqual({ isAtBottom: false, scrollTop: 10 });
    expect(followUpCommit?.revision).toBe(2);
    expect(store.select(feedSelectors.scroll)).toEqual({ isAtBottom: true, scrollTop: 0 });
  });
});

function thinkingFeedSnapshot(count: number): FeedSnapshotV2 {
  const base = createEmptyFeedSnapshot();
  const turnId = assistantCallId("call-1");
  const blocks = Array.from({ length: count }, (_, index) => ({
    type: "thinking" as const,
    id: blockId(`block-${index}`),
    turnId,
    text: `thought ${index}`,
    startIndex: index,
    endIndex: index,
    status: "complete" as const,
  }));
  return {
    ...base,
    blockOrder: blocks.map((block) => block.id),
    blocks,
    runtime: { ...base.runtime, nextSequence: count + 1 },
  };
}
