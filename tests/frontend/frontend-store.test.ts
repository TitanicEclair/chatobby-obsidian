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
    runtimeInstanceId: "runtime-1",
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
    protocolVersion: 1,
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
