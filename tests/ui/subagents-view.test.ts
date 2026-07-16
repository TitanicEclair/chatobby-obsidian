import { describe, expect, it, vi } from "vitest";
import { FrontendStore } from "../../src/frontend/frontend-store";
import { SubagentStore } from "../../src/features/subagents/public";
import { SubagentsView } from "../../src/features/subagents/ui/subagents-view";
import type {
  FrontendBootstrap,
  FrontendSubagentRunViewModel,
  FrontendSubagentScreenViewModel,
} from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { mount } from "./helpers/mount";
import { createMockFeedHostForStore } from "./helpers/mock-host";

describe("SubagentsView", () => {
  it("renders runtime health, runs, and dedicated catalog tabs", () => {
    const store = createStore();
    const view = createView(store);
    const element = mount(view);

    expect(element.matches(".chatobby-subagents.chatobby-page")).toBe(true);
    expect(element.querySelector(".chatobby-subagents__header.chatobby-page__header")).not.toBeNull();
    expect(element.querySelector(".chatobby-subagents__tabs.chatobby-page__tabs")).not.toBeNull();
    expect(element.querySelector(".chatobby-subagents__body.chatobby-page__body")).not.toBeNull();
    expect(element.querySelectorAll(".chatobby-subagents__header .chatobby-page__icon-button")).toHaveLength(4);
    expect(element.textContent).toContain("Subagents");
    expect(element.textContent).toContain("Migration research");
    expect(element.textContent).toContain("Roles");
    expect(element.querySelector(".chatobby-subagents__body")).not.toBeNull();
    expect(element.textContent).toContain("Filter runs");
    expect(element.textContent).not.toContain("Total tokens");
    expect(element.textContent).not.toContain("Total cost");
    expect(element.querySelector("[aria-label='Back to chat']")).toBeNull();
  });

  it("opens a start form and validates required inputs before dispatch", () => {
    const store = createStore();
    const callbacks = actions();
    const view = createView(store, callbacks);
    const element = mount(view);
    const start = element.querySelector<HTMLButtonElement>("button[aria-label='New run']");

    start?.click();
    element.querySelector<HTMLFormElement>(".chatobby-subagents__start")?.dispatchEvent(new Event("submit"));

    expect(element.textContent).toContain("Name, task, and role are required.");
    expect(callbacks.startRun).not.toHaveBeenCalled();
  });

  it("provides a dedicated empty operator inbox", () => {
    const store = createStore();
    const view = createView(store);
    const element = mount(view);
    const inbox = Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "Inbox");

    inbox?.click();

    expect(element.textContent).toContain("Inbox");
    expect(element.textContent).toContain("Nothing needs your attention");
  });

  it("uses a single quiet pane when the session has no runs", () => {
    const store = createStore({
      runIds: [],
      runSummaries: [],
      runs: [],
      selectedRunId: null,
      selectedNodeId: null,
    });
    const element = mount(createView(store));

    expect(element.querySelector(".chatobby-subagents__run-layout.is-empty")).not.toBeNull();
    expect(element.querySelector(".chatobby-subagents__detail")).toBeNull();
    expect(element.textContent).toContain("No runs yet");
    expect(element.textContent).not.toContain("Filter runs");
    expect(element.textContent).not.toContain("Select a run");
  });

  it("keeps tab selection accessible to pointer and keyboard users", () => {
    const store = createStore();
    const element = mount(createView(store));
    const tabs = Array.from(element.querySelectorAll<HTMLButtonElement>("[role='tab']"));
    const workflows = tabs.find((button) => button.textContent === "Flows");
    if (!workflows) throw new Error("Flows tab missing");

    workflows.click();
    expect(workflows.getAttribute("aria-selected")).toBe("true");
    expect(tabs.find((button) => button.textContent === "Runs")?.getAttribute("aria-selected")).toBe("false");

    workflows.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const controls = tabs.find((button) => button.textContent === "Settings");
    expect(controls?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(controls);
  });

  it("builds workflows with guided step fields instead of raw JSON", async () => {
    const store = createStore();
    const callbacks = actions();
    const element = mount(createView(store, callbacks));
    Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "Flows")?.click();
    Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "New")?.click();

    expect(element.textContent).toContain("Steps");
    expect(element.textContent).not.toContain("Workflow JSON");
    const name = element.querySelector<HTMLInputElement>("input[placeholder='Research and review']");
    const task = element.querySelector<HTMLTextAreaElement>("textarea[placeholder*='What should this agent produce']");
    if (!name || !task) throw new Error("workflow fields missing");
    name.value = "Research and review";
    task.value = "Collect sources and verify every claim.";
    task.dispatchEvent(new Event("input"));
    element.querySelector<HTMLFormElement>(".chatobby-subagents__workflow-form")?.dispatchEvent(new Event("submit"));
    await Promise.resolve();

    expect(callbacks.saveWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      id: "research-and-review",
      name: "Research and review",
      nodes: [expect.objectContaining({ agentId: "researcher", task: "Collect sources and verify every claim." })],
    }));
  });

  it("keeps workflow step ids unique after removing and adding steps", async () => {
    const store = createStore();
    const callbacks = actions();
    const element = mount(createView(store, callbacks));
    Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "Flows")?.click();
    Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "New")?.click();

    const addStep = (): void => {
      Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "Add step")?.click();
    };
    addStep();
    addStep();
    Array.from(element.querySelectorAll<HTMLButtonElement>(".chatobby-subagents__workflow-step .mod-warning"))[1]?.click();
    addStep();

    const name = element.querySelector<HTMLInputElement>("input[placeholder='Research and review']");
    if (!name) throw new Error("workflow name field missing");
    name.value = "Stable workflow";
    for (const [index, task] of Array.from(element.querySelectorAll<HTMLTextAreaElement>("textarea[placeholder*='What should this agent produce']")).entries()) {
      task.value = `Task ${index + 1}`;
      task.dispatchEvent(new Event("input"));
    }
    element.querySelector<HTMLFormElement>(".chatobby-subagents__workflow-form")?.dispatchEvent(new Event("submit"));
    await Promise.resolve();

    const saved = callbacks.saveWorkflow.mock.calls[0]?.[0];
    expect(saved?.nodes.map((node) => node.id)).toEqual(["step-1", "step-3", "step-4"]);
  });

  it("keeps a workflow editor open and explains a failed save", async () => {
    const store = createStore();
    const callbacks = actions();
    callbacks.saveWorkflow.mockRejectedValueOnce(new Error("Workflow dependencies changed; refresh and retry."));
    const element = mount(createView(store, callbacks));
    Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "Flows")?.click();
    Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "New")?.click();
    const name = element.querySelector<HTMLInputElement>("input[placeholder='Research and review']");
    const task = element.querySelector<HTMLTextAreaElement>("textarea[placeholder*='What should this agent produce']");
    if (!name || !task) throw new Error("workflow fields missing");
    name.value = "Review workflow";
    task.value = "Review the result.";
    task.dispatchEvent(new Event("input"));

    element.querySelector<HTMLFormElement>(".chatobby-subagents__workflow-form")?.dispatchEvent(new Event("submit"));
    await Promise.resolve();
    await Promise.resolve();

    expect(element.querySelector(".chatobby-subagents__workflow-form")).not.toBeNull();
    expect(element.textContent).toContain("Workflow dependencies changed; refresh and retry.");
    expect(Array.from(element.querySelectorAll("button")).find((button) => button.textContent === "Save")?.hasAttribute("disabled")).toBe(false);
  });

  it("opens directly into a focused child feed without management analytics", () => {
    const store = createStore({
      focusedFeed: {
        revision: 2,
        blocks: [
          { type: "user", id: "task", text: "Find the primary migration source", timestamp: 1 },
          { type: "text", id: "result", text: "I found the primary source.", phase: "complete" },
        ],
      },
    });
    const view = new SubagentsView({
      store,
      actions: actions(),
      onBack: vi.fn(),
      initialFeedOnly: true,
      createFeedHost: createMockFeedHostForStore,
    });
    const element = mount(view);

    expect(element.textContent).toContain("Vault researcher");
    expect(element.textContent).toContain("I found the primary source.");
    expect(element.querySelector(".chatobby-feed-renderer")).not.toBeNull();
    expect(element.querySelector(".chatobby-feed__block--user")).not.toBeNull();
    expect(element.querySelector(".chatobby-feed__block--text")).not.toBeNull();
    expect(element.querySelector(".chatobby-composer-card")).not.toBeNull();
    expect(element.textContent).not.toContain("Filter runs");
    expect(element.textContent).not.toContain("Tokens");
    expect(element.textContent).not.toContain("Cost");
  });

  it("shows the actual model and hides transcript promotion and duplicate message controls", () => {
    const run = runSnapshot();
    const node = run.nodes["node-a"];
    if (!node) throw new Error("fixture node missing");
    node.model = "deepseek/deepseek-v4-pro";
    const store = createStore({
      runs: [run],
      artifacts: [{
        runId: run.id,
        items: [{
          id: "transcript-a",
          runId: run.id,
          nodeId: node.id,
          kind: "transcript",
          name: "child.jsonl",
          path: "C:\\private\\child.jsonl",
          revision: 1,
          createdAt: 1,
          updatedAt: 1,
        }],
      }],
    });

    const element = mount(createView(store));

    expect(element.textContent).toContain("deepseek/deepseek-v4-pro");
    expect(element.textContent).toContain("Inherited from the parent or role policy");
    expect(element.textContent).not.toContain("Message this agent");
    expect(element.textContent).not.toContain("child.jsonl");
    expect(element.textContent).not.toContain("Cost budget");
  });
});

function createView(store: SubagentStore, callbacks = actions()): SubagentsView {
  return new SubagentsView({
    store,
    actions: callbacks,
    onBack: vi.fn(),
    createFeedHost: createMockFeedHostForStore,
  });
}

function actions() {
  return {
    openPermissions: vi.fn(),
    refresh: vi.fn(async () => undefined),
    filterRuns: vi.fn(async () => undefined),
    loadMoreRuns: vi.fn(async () => undefined),
    selectRun: vi.fn(async () => undefined),
    selectNode: vi.fn(async () => undefined),
    loadEarlierTranscript: vi.fn(async () => undefined),
    startRun: vi.fn(async () => undefined),
    startWorkflow: vi.fn(async () => undefined),
    deleteSession: vi.fn(async () => undefined),
    control: vi.fn(async () => undefined),
    sendMessage: vi.fn(async () => undefined),
    acknowledgeMessage: vi.fn(async () => undefined),
    decidePermission: vi.fn(async () => undefined),
    decideAcceptance: vi.fn(async () => undefined),
    promoteArtifact: vi.fn(async () => undefined),
    saveDefinition: vi.fn(async () => undefined),
    deleteDefinition: vi.fn(async () => undefined),
    saveWorkflow: vi.fn(async () => undefined),
    deleteWorkflow: vi.fn(async () => undefined),
    updateSettings: vi.fn(async () => undefined),
  };
}

function createStore(overrides: Partial<FrontendSubagentScreenViewModel> = {}): SubagentStore {
  const frontend = new FrontendStore();
  frontend.replace(bootstrap(screen(overrides)));
  return new SubagentStore(frontend);
}

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
      retrying: false,
      messageCount: 0,
      forkOptions: [],
    },
    composer: { controls: [], canSubmit: true },
    agentRail: { items: [] },
    feed: { revision: 0, blocks: [] },
    screens: [],
    screenModels: [model],
    localCommands: [],
  };
}

function screen(overrides: Partial<FrontendSubagentScreenViewModel>): FrontendSubagentScreenViewModel {
  const run = runSnapshot();
  return {
    screenId: "subagents",
    revision: 1,
    loading: false,
    syncStatus: "live",
    runtimeId: "runtime-a",
    sequence: 2,
    capabilities: {
      protocolVersion: 1,
      runtimeId: "runtime-a",
      executionModes: ["in-process"],
      supportsDynamicFanout: true,
      supportsSiblingCommunication: true,
      supportsWorkerRecovery: false,
      workerRecoveryMode: "none",
      supportsWorktrees: false,
      supportsArtifactPromotion: true,
      maxReplayEvents: 10_000,
    },
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
        tokens: 1_200,
        costUsd: 0.01,
        createdAt: 1,
        updatedAt: Date.now(),
    }],
    runQuery: {},
    runs: [run],
    definitions: [{
        id: "researcher",
        name: "Researcher",
        description: "Collects evidence",
        scope: "vault",
        scopeId: "vault-a",
        systemPrompt: "Research carefully.",
        enabled: true,
        policy: { executionMode: "in-process", contextMode: "fresh" },
        revision: 1,
        updatedAt: 1,
    }],
    workflows: [],
    settings: {
      revision: 1,
      sources: {},
      settings: {
        maxConcurrency: 4,
        defaultExecutionMode: "auto",
        defaultMaxDepth: 3,
        automaticDelegation: "suggest",
        retentionDays: 30,
        allowSiblingCommunication: true,
      },
    },
    models: [],
    skills: [],
    selectedRunId: "run-a",
    selectedNodeId: "node-a",
    artifacts: [],
    messages: [],
    controlReceipts: [],
    focusedFeed: {
      revision: 1,
      blocks: [{ type: "user", id: "task", text: "Find the primary migration source", timestamp: 1 }],
    },
    ...overrides,
  };
}

function runSnapshot(): FrontendSubagentRunViewModel {
  return {
    id: "run-a",
    runtimeId: "runtime-a",
    parentSessionId: "session-a",
    triggerSource: "user",
    description: "Migration research",
    status: "running",
    priority: 0,
    createdAt: 1,
    updatedAt: 2,
    startedAt: 1,
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
        task: "Find the primary migration source",
        status: "running",
        dependsOn: [],
        priority: 0,
        requestedExecutionMode: "auto",
        resolvedExecutionMode: "in-process",
        turns: 1,
        tokens: 100,
        costUsd: 0,
        attempts: [],
        artifactIds: [],
      },
    },
    rootNodeIds: ["node-a"],
  };
}
