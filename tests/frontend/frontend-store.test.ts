import { describe, expect, it, vi } from "vitest";
import { FrontendResyncRequiredError, FrontendStore } from "../../src/frontend/frontend-store";
import type { FrontendBootstrap, FrontendPatch } from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("FrontendStore", () => {
  it("applies ordered patches and ignores exact duplicates", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    const patch = createPatch(1, 0, [{
      type: "session.replace",
      session: { ...bootstrap().session!, name: "Renamed" },
    }]);

    expect(store.apply(patch)).toBe("applied");
    expect(store.snapshot?.session?.name).toBe("Renamed");
    expect(store.apply(patch)).toBe("duplicate");
  });

  it("requires resync for gaps, revision mismatches, and runtime restarts", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());

    expect(() => store.apply(createPatch(2, 0, []))).toThrow(FrontendResyncRequiredError);
    expect(() => store.apply({ ...createPatch(1, 0, []), runtimeInstanceId: "runtime-2" })).toThrow(
      "runtime instance changed",
    );
    expect(() => store.apply(createPatch(1, 9, []))).toThrow("revision mismatch");
  });

  it("preserves connector-only drafts and disclosure state across replacement", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    store.setDraft("composer", "unsent");
    store.setExpanded("tool-1", true);

    store.replace({ ...bootstrap(), runtimeInstanceId: "runtime-2" });

    expect(store.local.drafts.get("composer")).toBe("unsent");
    expect(store.local.expandedBlockIds.has("tool-1")).toBe(true);
  });

  it("applies a contiguous reconnect replay and rejects a wrong-view patch", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    const patch = createPatch(1, 0, [{ type: "composer.replace", composer: { controls: [], canSubmit: false } }]);
    store.applyReplay({
      schemaVersion: 1,
      protocolVersion: 2,
      requestId: "subscribe-1",
      runtimeInstanceId: "runtime-1",
      viewId: "view-1",
      status: "replayed",
      baseSequence: 0,
      baseRevision: 0,
      replay: [patch],
      sequence: 1,
      revision: 1,
      oldestReplayableSequence: 1,
    });
    expect(store.snapshot?.composer.canSubmit).toBe(false);
    expect(() => store.apply({ ...createPatch(2, 1, []), viewId: "view-2" })).toThrow("another view");
  });

  it("orders screen responses by request epoch and rejects patch-versus-load races", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    const screen = { screenId: "events", revision: 1 } as FrontendBootstrap["screenModels"][number];
    store.replaceScreen({
      schemaVersion: 1,
      protocolVersion: 2,
      runtimeInstanceId: "runtime-1",
      viewId: "view-1",
      requestId: "screen-2",
      requestEpoch: 2,
      baseSequence: 0,
      screenRevision: 1,
      screen,
    });
    expect(() => store.replaceScreen({
      schemaVersion: 1,
      protocolVersion: 2,
      runtimeInstanceId: "runtime-1",
      viewId: "view-1",
      requestId: "screen-1",
      requestEpoch: 1,
      baseSequence: 0,
      screenRevision: 1,
      screen,
    })).toThrow("Stale screen response");

    store.apply(createPatch(1, 0, []));
    expect(() => store.replaceScreen({
      schemaVersion: 1,
      protocolVersion: 2,
      runtimeInstanceId: "runtime-1",
      viewId: "view-1",
      requestId: "screen-3",
      requestEpoch: 3,
      baseSequence: 0,
      screenRevision: 2,
      screen: { ...screen, revision: 2 },
    })).toThrow("Stale screen response");
  });

  it("supports explicit session clear and rejects missing feed mutation targets", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    store.apply(createPatch(1, 0, [{ type: "session.clear" }]));
    expect(store.snapshot?.session).toBeNull();

    expect(() => store.apply(createPatch(2, 1, [
      { type: "feed.text.append", blockId: "missing", text: "x" },
    ]))).toThrow("append target is missing");
  });

  it("rolls back feed indexes and screen authority when one patch operation fails", () => {
    const store = new FrontendStore();
    const eventScreen = { screenId: "events", revision: 1 } as FrontendBootstrap["screenModels"][number];
    store.replace({
      ...bootstrap(),
      feed: {
        revision: 1,
        blocks: [{ type: "text", id: "original", text: "before", phase: "streaming" }],
      },
      screenModels: [eventScreen],
    });

    expect(() => store.apply(createPatch(1, 0, [
      { type: "feed.block.remove", blockId: "original" },
      { type: "screen.replace", screen: { ...eventScreen, revision: 2 } },
      { type: "feed.text.append", blockId: "missing", text: "x" },
    ]))).toThrow("append target is missing");

    expect(store.snapshot).toMatchObject({
      sequence: 0,
      revision: 0,
      feed: { blocks: [{ id: "original", text: "before" }] },
      screenModels: [{ screenId: "events", revision: 1 }],
    });
    store.replaceScreen({
      schemaVersion: 1,
      protocolVersion: 2,
      runtimeInstanceId: "runtime-1",
      viewId: "view-1",
      requestId: "screen-after-failure",
      requestEpoch: 0,
      baseSequence: 0,
      screenRevision: 2,
      screen: { ...eventScreen, revision: 2 },
    });
    store.apply(createPatch(1, 0, [
      { type: "feed.text.append", blockId: "original", text: " after" },
    ]));
    expect(store.snapshot?.feed.blocks[0]).toMatchObject({ text: "before after" });
  });

  it("applies runtime-owned task plan replacements", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    const taskPlan = {
      revision: 1,
      completedCount: 0,
      remainingCount: 1,
      summary: "0 done tasks, 1 more task",
      items: [{ id: "verify", step: 1, text: "Verify task UI", status: "in_progress" as const }],
    };

    store.apply(createPatch(1, 0, [{ type: "task-plan.replace", taskPlan }]));

    expect(store.snapshot?.taskPlan).toEqual(taskPlan);
  });

  it("applies live local-command catalogue replacements", () => {
    const store = new FrontendStore();
    store.replace(bootstrap());
    const localCommands = [{
      name: "skill:daily-review",
      description: "Review the current day",
      kind: "runtime" as const,
      source: "skill" as const,
      action: "send-raw-prompt" as const,
      argument: { kind: "optional-rest" as const },
      surroundingTextPolicy: "forbid" as const,
      showInMenu: true,
    }];

    store.apply(createPatch(1, 0, [{ type: "local-commands.replace", localCommands }]));

    expect(store.snapshot?.localCommands).toEqual(localCommands);
  });

  it("replays an existing bootstrap to late subscribers", () => {
    const store = new FrontendStore();
    const snapshot = bootstrap();
    store.replace(snapshot);
    const listener = vi.fn();

    store.subscribe(listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(snapshot);
  });

  it("does not notify a screen selector for 1,000 feed-only appends", () => {
    const store = new FrontendStore();
    const permissionModel = { screenId: "permissions", revision: 1 } as FrontendBootstrap["screenModels"][number];
	const eventModel = { screenId: "events", revision: 1 } as FrontendBootstrap["screenModels"][number];
    store.replace({
      ...bootstrap(),
      feed: {
        revision: 1,
        blocks: [{ type: "text", id: "response", text: "", phase: "streaming" }],
      },
	  screenModels: [permissionModel, eventModel],
    });
    const listener = vi.fn();
	const eventListener = vi.fn();
    store.subscribeSelector(
      (snapshot) => snapshot.screenModels.find((screen) => screen.screenId === "permissions"),
      listener,
    );
	store.subscribeSelector(
		(snapshot) => snapshot.screenModels.find((screen) => screen.screenId === "events"),
		eventListener,
	);

    for (let sequence = 1; sequence <= 1_000; sequence += 1) {
      store.apply(createPatch(sequence, sequence - 1, [
        { type: "feed.text.append", blockId: "response", text: "x" },
      ]));
    }

    expect(listener).not.toHaveBeenCalled();
	expect(eventListener).not.toHaveBeenCalled();
    expect(store.snapshot?.feed.blocks[0]).toMatchObject({ text: "x".repeat(1_000) });
  });
});

function createPatch(sequence: number, baseRevision: number, operations: FrontendPatch["operations"]): FrontendPatch {
  return {
    schemaVersion: 1,
    protocolVersion: 2,
    runtimeInstanceId: "runtime-1",
    viewId: "view-1",
    scope: { kind: "view", viewId: "view-1" },
    sequence,
    baseRevision,
    revision: sequence,
    operations,
  };
}

function bootstrap(): FrontendBootstrap {
  return {
    schemaVersion: 1,
    protocolVersion: 2,
    runtimeInstanceId: "runtime-1",
    revision: 0,
    sequence: 0,
    viewId: "view-1",
    session: {
      id: "session-1",
      workingDirectory: "C:/vault",
      model: "openai/gpt-5",
      thinkingLevel: "medium",
      streaming: false,
      compacting: false,
      messageCount: 0,
    },
    taskPlan: { revision: 0, completedCount: 0, remainingCount: 0, summary: "No tracked tasks", items: [] },
    composer: { controls: [], canSubmit: true },
    agentRail: { items: [] },
    feed: { revision: 0, blocks: [] },
    screens: [],
    screenModels: [],
    localCommands: [],
  };
}
