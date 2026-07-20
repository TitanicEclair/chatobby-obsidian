import { describe, expect, it } from "vitest";
import type { FeedBlock } from "../../../src/types";
import { createFeedStore, feedSelectors, type FeedDocumentProjection } from "../../../src/features/feed/public";

describe("normalized feed projection", () => {
  it("appends a submitted prompt and records the server echo token", () => {
    const store = createFeedStore({ now: () => 1_000 });
    const commit = store.dispatch({ type: "feed.user-prompt-submitted", text: "hello", startRun: true });
    expect(commit.changes.addedBlockIds).toHaveLength(1);
    expect(blocks(store)[0]).toMatchObject({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "hello" }] },
    });
    expect(store.select(feedSelectors.runTiming)).toMatchObject({ runStartedAt: 1_000 });
    expect(store.exportSnapshot().runtime.pendingPromptEchoes).toEqual(["hello"]);
  });

  it("removes only the locally correlated prompt when the runtime confirms retraction", () => {
    const store = createFeedStore({ now: () => 1_000 });
    store.dispatch({
      type: "feed.user-prompt-submitted",
      text: "same text",
      startRun: true,
      submissionId: "submission-1",
    });
    store.dispatch({
      type: "feed.user-prompt-submitted",
      text: "same text",
      startRun: true,
      submissionId: "submission-2",
    });

    store.dispatch({ type: "feed.user-prompt-retracted", submissionId: "submission-2", text: "same text" });

    expect(blocks(store)).toEqual([expect.objectContaining({ submissionId: "submission-1" })]);
    expect(store.exportSnapshot().runtime.pendingPromptEchoes).toEqual(["same text"]);
    expect(store.select(feedSelectors.runTiming).runStartedAt).toBeNull();
  });

  it("removes the local queued marker when an idle backend promotes it to a prompt", () => {
    const store = createFeedStore();
    store.dispatch({ type: "feed.queued-message-appended", kind: "steer", text: "continue normally" });
    expect(blocks(store)).toEqual([
      expect.objectContaining({ type: "queued", kind: "steer", text: "continue normally" }),
    ]);

    store.dispatch({ type: "feed.queued-message-promoted", kind: "steer", text: "continue normally" });

    expect(blocks(store)).toEqual([]);
  });

  it("keeps an optimistic prompt visible while a runtime projection has not confirmed it", () => {
    const store = createFeedStore();
    store.dispatch({
      type: "feed.user-prompt-submitted",
      text: "do not flash",
      startRun: true,
      submissionId: "submission-flash",
    });

    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [] },
    });

    expect(blocks(store)).toEqual([
      expect.objectContaining({ type: "user", submissionId: "submission-flash" }),
    ]);
  });

  it("atomically replaces an optimistic prompt with its authoritative runtime block", () => {
    const store = createFeedStore();
    store.dispatch({
      type: "feed.user-prompt-submitted",
      text: "one stable bubble",
      startRun: true,
      submissionId: "submission-stable",
    });
    const observedUserCounts: number[] = [];
    store.subscribe(() => {
      observedUserCounts.push(blocks(store).filter((block) => block.type === "user").length);
    });

    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [projectedUser("runtime-prompt", "one stable bubble")] },
    });

    expect(observedUserCounts).toEqual([1]);
    expect(blocks(store)).toEqual([
      expect.objectContaining({ type: "user", id: "runtime-prompt" }),
    ]);
    expect(store.exportSnapshot().runtime.pendingPromptEchoes).toEqual([]);
  });

  it("does not mistake an older identical prompt for the current optimistic submission", () => {
    const store = createFeedStore();
    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [projectedUser("historical", "repeat this")] },
    });
    store.dispatch({
      type: "feed.user-prompt-submitted",
      text: "repeat this",
      startRun: true,
      submissionId: "submission-repeat",
    });

    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: { blocks: [projectedUser("historical", "repeat this")] },
    });
    expect(blocks(store)).toHaveLength(2);
    expect(blocks(store)[1]).toMatchObject({ submissionId: "submission-repeat" });

    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: {
        blocks: [
          projectedUser("historical", "repeat this"),
          projectedUser("current", "repeat this"),
        ],
      },
    });
    expect(blocks(store).map((block) => block.id)).toEqual(["historical", "current"]);
    expect(store.exportSnapshot().runtime.pendingPromptEchoes).toEqual([]);
  });

  it("upserts and removes a keyed extension panel without changing its position", () => {
    let now = 10;
    const store = createFeedStore({ now: () => now });
    store.dispatch({
      type: "feed.extension-panel-upserted",
      panel: { key: "memory", panelKind: "widget", title: "Memory", body: "one" },
    });
    const [id] = store.select(feedSelectors.orderedBlockIds);
    now = 20;
    const update = store.dispatch({
      type: "feed.extension-panel-upserted",
      panel: { key: "memory", panelKind: "widget", title: "Memory", body: "two" },
    });
    expect(update.changes.addedBlockIds).toEqual([]);
    expect(update.changes.updatedBlockIds).toEqual([id]);
    expect(blocks(store)[0]).toMatchObject({ body: "two", createdAt: 20 });
    store.dispatch({ type: "feed.extension-panel-removed", key: "memory" });
    expect(blocks(store)).toEqual([]);
  });

  it("incrementally synchronizes runtime-projected documents without replacing view state", () => {
    const store = createFeedStore();
    const first = store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedConversation("First response"),
    });
    store.dispatch({ type: "feed.ui.scroll-changed", scroll: { isAtBottom: false, scrollTop: 42 } });
    const unchanged = store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedConversation("First response"),
    });
    const updated = store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedConversation("Updated response"),
    });
    expect(first.changes.addedBlockIds).toHaveLength(2);
    expect(unchanged.changes.documentChanged).toBe(false);
    expect(updated.changes.updatedBlockIds).toEqual(["response"]);
    expect(store.select(feedSelectors.scroll)).toEqual({ isAtBottom: false, scrollTop: 42 });
    expect(blocks(store)[1]).toMatchObject({ type: "text", text: "Updated response" });
  });

  it("preserves runtime-projected tool semantics and updates by durable id", () => {
    const store = createFeedStore();
    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedTool("running", undefined),
    });
    const update = store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedTool("succeeded", "done"),
    });
    expect(update.changes.updatedToolIds).toEqual(["tool-1"]);
    expect(blocks(store)[0]).toMatchObject({
      type: "tools",
      items: [{
        id: "tool-1",
        semanticKind: "vault.note.read",
        displayTitle: "read note",
        status: "succeeded",
        result: "done",
      }],
    });
  });

  it("does not dirty unchanged tool ownership during streamed projection batches", () => {
    const store = createFeedStore();
    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedTool("running", undefined),
    });

    const unchanged = store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedTool("running", undefined),
    });

    expect(unchanged.changes.documentChanged).toBe(false);
    expect(unchanged.changes.updatedBlockIds).toEqual([]);
    expect(unchanged.changes.updatedToolIds).toEqual([]);
  });

  it("freezes unresolved projected lifetimes when transport is interrupted", () => {
    const store = createFeedStore({ now: () => 500 });
    store.dispatch({
      type: "feed.document-projection-synchronized",
      projection: projectedTool("running", undefined),
    });
    store.dispatch({ type: "feed.transport-interrupted" });
    expect(blocks(store)[0]).toMatchObject({
      type: "tools",
      status: "complete",
      items: [{ id: "tool-1", status: "interrupted", endTime: 500 }],
    });
  });
});

type Store = ReturnType<typeof createFeedStore>;

function blocks(store: Store): FeedBlock[] {
  return store.select(feedSelectors.orderedBlockIds)
    .map((id) => store.select(feedSelectors.blockById(id)))
    .filter((block): block is FeedBlock => block !== undefined);
}

function projectedConversation(text: string): FeedDocumentProjection {
  return {
    blocks: [
      {
        type: "user",
        id: "prompt",
        messageId: "prompt",
        message: { role: "user", content: "Do the work", timestamp: 1 },
      },
      {
        type: "text",
        id: "response",
        turnId: "response-turn",
        text,
        startIndex: 0,
        endIndex: 0,
        status: "complete",
      },
    ],
  };
}

function projectedUser(id: string, text: string): Extract<FeedBlock, { type: "user" }> {
  return {
    type: "user",
    id,
    messageId: id,
    message: { role: "user", content: text, timestamp: 1 },
  };
}

function projectedTool(status: "running" | "succeeded", result: string | undefined): FeedDocumentProjection {
  return {
    blocks: [{
      type: "tools",
      id: "tools",
      turnId: "turn",
      startIndex: 0,
      endIndex: 0,
      status: status === "running" ? "streaming" : "complete",
      isExpanded: false,
      items: [{
        id: "tool-1",
        name: "opaque_runtime_operation",
        category: "read",
        arguments: "{}",
        semanticKind: "vault.note.read",
        displayTitle: "read note",
        status,
        result,
        isExpanded: false,
      }],
    }],
  };
}
