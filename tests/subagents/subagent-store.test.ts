import { describe, expect, it, vi } from "vitest";
import { FrontendStore } from "../../src/frontend/frontend-store";
import { SubagentStore } from "../../src/features/subagents/public";
import type {
  FrontendBootstrap,
  FrontendSubagentScreenViewModel,
} from "../../src/vendor/chatobby-client/frontend-contracts.js";

describe("SubagentStore", () => {
  it("mechanically adapts the runtime-owned screen model into renderer maps", () => {
    const frontend = new FrontendStore();
    frontend.replace(bootstrap(screen()));
    const store = new SubagentStore(frontend);

    expect(store.getSnapshot()).toMatchObject({
      syncStatus: "live",
      runtimeId: "runtime-a",
      selectedRunId: "run-a",
      selectedNodeId: "node-a",
    });
    expect(store.getSnapshot().runSummaries.get("run-a")?.description).toBe("Migration research");
    expect(store.getSnapshot().runs.get("run-a")?.nodes["node-a"]?.agentName).toBe("Vault researcher");
    expect(store.getSnapshot().focusedFeed.blocks).toMatchObject([{ type: "user", text: "Find the source" }]);
  });

  it("updates subscribers only from authoritative frontend screen replacement", () => {
    const frontend = new FrontendStore();
    frontend.replace(bootstrap(screen()));
    const store = new SubagentStore(frontend);
    const listener = vi.fn();
    store.subscribe(listener);

    frontend.replaceScreen(screen({ statusMessage: "Run paused.", nextTranscriptCursor: "older" }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toMatchObject({ statusMessage: "Run paused.", nextTranscriptCursor: "older" });
  });
});

function bootstrap(model: FrontendSubagentScreenViewModel): FrontendBootstrap {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    runtimeInstanceId: "runtime-instance",
    revision: 0,
    sequence: 0,
    viewId: "view-a",
    session: {
      id: "session-a",
      workingDirectory: "C:\\vault",
      model: "provider/model",
      thinkingLevel: "medium",
      streaming: false,
      compacting: false,
      messageCount: 0,
    },
    composer: { controls: [], canSubmit: true },
    agentRail: { items: [] },
    feed: { revision: 0, blocks: [] },
    screens: [],
    screenModels: [model],
    localCommands: [],
  };
}

function screen(overrides: Partial<FrontendSubagentScreenViewModel> = {}): FrontendSubagentScreenViewModel {
  return {
    screenId: "subagents",
    revision: 1,
    loading: false,
    syncStatus: "live",
    runtimeId: "runtime-a",
    sequence: 2,
    runIds: ["run-a"],
    runSummaries: [{
      id: "run-a",
      parentSessionId: "session-a",
      triggerSource: "user",
      description: "Migration research",
      status: "running",
      agentIds: ["researcher"],
      executionModes: ["in-process"],
      workspaceCwd: "C:\\vault",
      activeNodes: 1,
      queuedNodes: 0,
      waitingNodes: 0,
      failedNodes: 0,
      tokens: 100,
      costUsd: 0,
      createdAt: 1,
      updatedAt: 2,
    }],
    runQuery: {},
    runs: [{
      id: "run-a",
      runtimeId: "runtime-a",
      parentSessionId: "session-a",
      triggerSource: "user",
      description: "Migration research",
      status: "running",
      priority: 0,
      createdAt: 1,
      updatedAt: 2,
      lastSequence: 2,
      budgets: {},
      context: { mode: "fresh" },
      workspace: {
        cwd: "C:\\vault",
        mode: "shared",
        resolvedCwd: "C:\\vault",
        provider: "shared",
        workspaceId: "run-a",
        changedFiles: [],
        createdAt: 1,
      },
      failFast: true,
      nodes: {
        "node-a": {
          id: "node-a",
          agentId: "researcher",
          agentName: "Vault researcher",
          label: "Vault researcher",
          task: "Find the source",
          status: "running",
          dependsOn: [],
          priority: 0,
          requestedExecutionMode: "auto",
          turns: 1,
          tokens: 100,
          costUsd: 0,
          attempts: [],
          artifactIds: [],
        },
      },
      rootNodeIds: ["node-a"],
    }],
    definitions: [],
    workflows: [],
    models: [],
    skills: [],
    selectedRunId: "run-a",
    selectedNodeId: "node-a",
    artifacts: [],
    messages: [],
    controlReceipts: [],
    focusedFeed: { revision: 1, blocks: [{ type: "user", id: "task", text: "Find the source", timestamp: 1 }] },
    ...overrides,
  };
}
