import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type ChatobbyPlugin from "../../../src/main";
import { feedSelectors } from "../../../src/features/feed/public";
import { EMPTY_SESSION_STATE } from "../../../src/types";
import type { ChatobbyTransport } from "../../../src/transport/ws-client";
import {
  SessionController,
  SessionIntentRejectedError,
  type SessionMutationRequest,
} from "../../../src/ui/controller/session-controller";
import type { FrontendSessionViewModel } from "../../../src/vendor/chatobby-client/frontend-contracts.js";
import { OperationCoordinator } from "../../../src/features/operations/public";

describe("SessionController", () => {
  it("holds the first submission until an already-started create and its presentation settle", async () => {
    let releaseCreate!: () => void;
    let releasePresentation!: () => void;
    const created = new Promise<void>((resolve) => { releaseCreate = resolve; });
    const presented = new Promise<void>((resolve) => { releasePresentation = resolve; });
    const dispatch = vi.fn(async (_request: SessionMutationRequest, target: SessionController) => {
      await created;
      target.applyRuntimeSession(session("first-target"));
      return true;
    });
    const { controller } = harness({ dispatch, settlePresentation: () => presented });
    const transition = controller.createSession();
    let outcome: string | Error | undefined;
    const submission = controller.ensureActiveSessionTarget().then(
      (target) => { outcome = target.sessionId; },
      (error: Error) => { outcome = error; },
    );
    try {
      await flushMicrotasks();
      expect(outcome).toBeUndefined();
      expect(dispatch).toHaveBeenCalledOnce();
      releaseCreate();
      await flushMicrotasks();
      expect(outcome).toBeUndefined();
      releasePresentation();
      await transition;
      await submission;
      expect(outcome).toBe("first-target");
      expect(dispatch).toHaveBeenCalledOnce();
    } finally {
      releaseCreate();
      releasePresentation();
      await transition;
      await submission;
    }
  });

  it.each(["C:\\Project", null])("waits for the selected Project resume instead of sending to the old Vault (%s)", async (workingDirectory) => {
    let release!: () => void;
    const resumed = new Promise<void>((resolve) => { release = resolve; });
    const dispatch = vi.fn(async (_request: SessionMutationRequest, target: SessionController) => {
      await resumed;
      target.applyRuntimeSession(session("selected-project", {
        workingDirectory,
        workspace: { kind: "project", projectId: "project:synthetic", label: "Synthetic" },
      }));
      return true;
    });
    const { controller } = harness({ dispatch });
    controller.applyRuntimeSession(session("old-vault"));
    const transition = controller.restoreSession("C:/synthetic/selected-project.jsonl");
    let outcome: string | undefined;
    const submission = controller.ensureActiveSessionTarget().then((target) => { outcome = target.sessionId; });
    try {
      await flushMicrotasks();
      expect(outcome).toBeUndefined();
      release();
      await transition;
      await submission;
      expect(outcome).toBe("selected-project");
      expect(dispatch).toHaveBeenCalledOnce();
    } finally {
      release();
      await transition;
      await submission;
    }
  });

  it("does not let a rejected competing transition release the prompt wait and clears a failed owner for retry", async () => {
    let fail!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, reject) => { fail = reject; });
    const dispatch = vi.fn(async (request: SessionMutationRequest, target: SessionController) => {
      if (request.type === "session.resume") await pending;
      target.applyRuntimeSession(session("retry-target"));
      return true;
    });
    const { controller } = harness({ dispatch });
    const failure = new Error("Synthetic selected-session failure");
    const transition = controller.restoreSession("C:/synthetic/selected.jsonl");
    const transitionResult = transition.catch((error: Error) => error);
    let outcome: string | Error | undefined;
    const submission = controller.ensureActiveSessionTarget().then(
      (target) => { outcome = target.sessionId; },
      (error: Error) => { outcome = error; },
    );
    try {
      await controller.createSession();
      await flushMicrotasks();
      expect(outcome).toBeUndefined();
      expect(dispatch).toHaveBeenCalledOnce();
      fail(failure);
      expect(await transitionResult).toBe(failure);
      await submission;
      expect(outcome).toBe(failure);
      const retry = await controller.ensureActiveSessionTarget();
      expect(retry.sessionId).toBe("retry-target");
      expect(dispatch).toHaveBeenCalledTimes(2);
    } finally {
      fail(failure);
      await transitionResult;
      await submission;
    }
  });

  it("keeps exactly one main session in each Obsidian leaf", () => {
    const { controller } = harness();
    controller.applyRuntimeSession(session("session-1"));
    controller.applyRuntimeSession(session("session-2"));
    expect(controller.allTabs()).toHaveLength(1);
    expect(controller.activeTabId()).toBe("session-2");
  });

  it("creates a fresh session through one atomic runtime intent", async () => {
    const intents: SessionMutationRequest[] = [];
    const { controller, renderActiveTab, persistLeafState } = harness({
      dispatch: async (request, target) => {
        intents.push(request);
        target.applyRuntimeSession(session("new-session", {
          recoveryPath: "C:/sessions/new-session.jsonl",
          workingDirectory: "C:\\Vault",
        }));
        return true;
      },
    });

    await controller.createSession();

    expect(intents).toEqual([{
      type: "session.create",
      payload: {
        cwdOverride: "C:\\Vault",
        thinkingLevel: "medium",
        autoNameStrategy: "truncate",
      },
    }]);
    expect(controller.activeTab()).toMatchObject({ sessionId: "new-session", name: "Vault" });
    expect(renderActiveTab).toHaveBeenCalled();
    expect(persistLeafState).toHaveBeenCalled();
  });

  it("adopts the runtime-owned session during frontend synchronization", async () => {
    const renderActiveTab = vi.fn();
    const { controller } = harness({
      renderActiveTab,
      synchronize: async (target) => {
        target.applyRuntimeSession(session("backend-session", {
          name: "Recovered work",
          recoveryPath: "C:/sessions/backend-session.jsonl",
        }));
      },
    });
    await controller.reconcileActiveSession();
    expect(controller.activeTab()).toMatchObject({
      sessionId: "backend-session",
      name: "Recovered work",
      sessionFile: "C:/sessions/backend-session.jsonl",
    });
    expect(renderActiveTab).toHaveBeenCalledOnce();
  });

	it("projects the session title and stable Project identity instead of the cwd", () => {
		const { controller } = harness();
		controller.applyRuntimeSession(session("project-session", {
			name: "Release plan",
			workingDirectory: "C:\\Vault\\Products\\Chatobby",
			workspace: { kind: "project", projectId: "project:chatobby", label: "Chatobby" },
		}));
		expect(controller.sessionTitle()).toBe("Release plan");
		expect(controller.workspaceLabel()).toBe("Chatobby");
	});

	it("falls back to Vault while reconnecting to a runtime without the additive workspace projection", () => {
		const { controller } = harness();
		const legacySession = { ...session("legacy-session") } as FrontendSessionViewModel & {
			workspace?: FrontendSessionViewModel["workspace"];
		};
		delete legacySession.workspace;

		controller.applyRuntimeSession(legacySession);

		expect(controller.workspaceLabel()).toBe("Vault");
	});

  it("uses runtime-authoritative auto-compaction settings when projected", () => {
    const { controller } = harness();
    controller.applyRuntimeSession(session("session-1", {
      autoCompaction: {
        enabled: true,
        thresholdPercent: 25,
        effectiveThresholdPercent: 25,
        customInstructions: "Preserve active decisions.",
      },
    }));

    expect(controller.sessionState.autoCompaction).toEqual({
      enabled: true,
      thresholdPercent: 25,
      effectiveThresholdPercent: 25,
      customInstructions: "Preserve active decisions.",
    });
  });

  it("keeps the connector fallback when an older runtime omits auto-compaction settings", () => {
    const { controller } = harness();
    controller.applyRuntimeSession(session("legacy-session"));

    expect(controller.sessionState.autoCompaction).toEqual(EMPTY_SESSION_STATE.autoCompaction);
  });

  it("switches the visible feed when the first runtime session appears", () => {
    const renderActiveTab = vi.fn();
    const { controller } = harness({ renderActiveTab });
    const emptyFeed = controller.feedStore();

    controller.applyRuntimeSession(session("first-session"));

    expect(controller.feedStore()).not.toBe(emptyFeed);
    expect(renderActiveTab).toHaveBeenCalledOnce();
  });

  it("lets a blank session leaf be reused but preserves a leaf with conversation history", () => {
    const { controller } = harness();
    controller.applyRuntimeSession(session("blank", { messageCount: 0 }));
    expect(controller.canReuseForSessionNavigation()).toBe(true);

    controller.applyRuntimeSession(session("blank", { messageCount: 1 }));
    expect(controller.canReuseForSessionNavigation()).toBe(false);
  });

  it("preserves the leaf-owned feed while refreshing session metadata", async () => {
    const { controller } = harness({
      synchronize: async (target) => {
        target.applyRuntimeSession(session("session-1", { model: "model-2", thinkingLevel: "high" }));
      },
    });
    controller.applyRuntimeSession(session("session-1"));
    const feedStore = controller.feedStore();
    feedStore.dispatch({
      type: "feed.extension-panel-upserted",
      panel: { key: "memory", panelKind: "widget", title: "Memory", body: "Keep me" },
    });
    await controller.refreshActiveSessionState();
    expect(controller.feedStore()).toBe(feedStore);
    expect(controller.feedStore().select(feedSelectors.orderedBlockIds)).toHaveLength(1);
    expect(controller.sessionState).toMatchObject({ sessionId: "session-1", model: "model-2", thinkingLevel: "high" });
  });

  it("reattaches the visible session before a session-scoped mutation", async () => {
    const synchronize = vi.fn(async (target: SessionController) => {
      target.applyRuntimeSession(session("visible-session", { recoveryPath: "C:/sessions/visible.jsonl" }));
    });
    const { controller, claimSessionOwnership } = harness({ synchronize });
    controller.applyRuntimeSession(session("visible-session", { recoveryPath: "C:/sessions/visible.jsonl" }));
    const target = await controller.ensureActiveSessionTarget();
    expect(target.sessionId).toBe("visible-session");
    expect(synchronize).toHaveBeenCalledOnce();
    expect(claimSessionOwnership).toHaveBeenCalled();
  });

  it("replaces a synchronized session whose runtime directory differs from the leaf directory", async () => {
    const intents: SessionMutationRequest[] = [];
    const { controller } = harness({
      synchronize: async (target) => {
        target.applyRuntimeSession(session("wrong-directory", {
          recoveryPath: "C:/sessions/wrong-directory.jsonl",
          workingDirectory: "C:\\Vault\\Projects",
        }));
      },
      dispatch: async (request, target) => {
        intents.push(request);
        target.applyRuntimeSession(session("root-directory", {
          recoveryPath: "C:/sessions/root-directory.jsonl",
          workingDirectory: "C:\\Vault",
        }));
        return true;
      },
    });
    controller.applyRuntimeSession(session("wrong-directory", {
      recoveryPath: "C:/sessions/wrong-directory.jsonl",
      workingDirectory: "C:\\Vault\\Projects",
    }));

    const target = await controller.ensureActiveSessionTarget();

    expect(intents).toEqual([{
      type: "session.create",
      payload: {
        cwdOverride: "C:\\Vault",
        thinkingLevel: "medium",
        autoNameStrategy: "truncate",
      },
    }]);
    expect(target.sessionId).toBe("root-directory");
  });

  it("preserves a runtime-bound Project when the legacy vault directory selector differs", async () => {
    const intents: SessionMutationRequest[] = [];
    const projectSession = session("project-session", {
      recoveryPath: "C:/sessions/project-session.jsonl",
      workingDirectory: "C:\\Vault\\Projects\\Chatobby",
      workspace: { kind: "project", projectId: "project:chatobby", label: "Chatobby" },
    });
    const { controller } = harness({
      synchronize: async (target) => target.applyRuntimeSession(projectSession),
      dispatch: async (request) => {
        intents.push(request);
        return false;
      },
    });
    controller.applyRuntimeSession(projectSession);

    const target = await controller.ensureActiveSessionTarget();

    expect(target.sessionId).toBe("project-session");
    expect(controller.workspaceLabel()).toBe("Chatobby");
    expect(intents).toEqual([]);
  });

  it("clears transient running state when the backend connection is lost", () => {
    const renderActiveTab = vi.fn();
    const { controller } = harness({ renderActiveTab });
    controller.sessionState = {
      ...EMPTY_SESSION_STATE,
      sessionId: "session-1",
      isStreaming: true,
      isCompacting: true,
      isRetrying: true,
      activeTools: ["subagent_message"],
    };
    controller.setActiveInteraction({
      id: "permission-1",
      method: "confirm",
      params: {},
      selectedIndex: 0,
      text: "",
      submitted: false,
    });
    const interruption = controller.markTransportDisconnected();
    expect(controller.sessionState).toMatchObject({
      isStreaming: false,
      isCompacting: false,
      isRetrying: false,
      activeTools: [],
    });
    expect(controller.activeInteraction()).toBeNull();
    expect(interruption).toEqual({ hadActiveWork: true, hadInteraction: true });
    expect(renderActiveTab).toHaveBeenCalled();
  });

	it("reattaches the leaf's durable Project session after the runtime reconnects", async () => {
		const intents: SessionMutationRequest[] = [];
		const projectSession = session("project-session", {
			name: "External Roots Live Test",
			recoveryPath: "C:/sessions/project-session.jsonl",
			workingDirectory: "C:\\Vault\\.obsidian\\plugins\\chatobby",
			workspace: { kind: "project", projectId: "project:external-roots", label: "External Roots Live Test" },
		});
		const { controller } = harness({
			dispatch: async (request, target) => {
				intents.push(request);
				target.applyRuntimeSession(projectSession);
				return true;
			},
		});
		controller.applyRuntimeSession(projectSession);

		controller.markTransportDisconnected();
		await controller.reconcileActiveSession();

		expect(intents).toEqual([{
			type: "session.resume",
			payload: {
				sessionPath: "C:/sessions/project-session.jsonl",
				thinkingLevel: "medium",
			},
		}]);
		expect(controller.activeTabId()).toBe("project-session");
		expect(controller.workspaceLabel()).toBe("External Roots Live Test");
	});

	it("falls back to the runtime's current session when a leaf references a deleted session file", async () => {
		const synchronize = vi.fn(async (target: SessionController) => {
			target.applyRuntimeSession(session("available", { recoveryPath: "C:/sessions/available.jsonl" }));
		});
		const { controller, persistLeafState } = harness({
			dispatch: async () => {
				throw new SessionIntentRejectedError("SESSION_NOT_FOUND", "The selected session no longer exists.");
			},
			synchronize,
		});

		await expect(controller.restoreSession("C:/sessions/deleted.jsonl")).resolves.toBeUndefined();

		expect(synchronize).toHaveBeenCalledOnce();
		expect(controller.activeTabId()).toBe("available");
		expect(persistLeafState).toHaveBeenCalled();
	});

	it("does not hide non-recoverable stored-session failures", async () => {
		const { controller } = harness({
			dispatch: async () => {
				throw new SessionIntentRejectedError("SESSION_CONFLICT", "The selected session changed.");
			},
		});

		await expect(controller.restoreSession("C:/sessions/conflict.jsonl")).rejects.toMatchObject({
			code: "SESSION_CONFLICT",
		});
	});

  it("replaces the last closed session with a new runtime target", async () => {
    const intents: SessionMutationRequest[] = [];
    const { controller } = harness({
      dispatch: async (request, target) => {
        intents.push(request);
        target.applyRuntimeSession(session("replacement", { recoveryPath: "C:/sessions/replacement.jsonl" }));
        return true;
      },
    });
    controller.applyRuntimeSession(session("resumed", { recoveryPath: "C:/sessions/resumed.jsonl" }));
    await controller.closeTab("resumed");
    const target = await controller.ensureActiveSessionTarget();
    expect(target.sessionId).toBe("replacement");
    expect(intents[0]?.type).toBe("session.create");
  });
});

interface HarnessOptions {
  dispatch?: (request: SessionMutationRequest, controller: SessionController) => Promise<boolean>;
  synchronize?: (controller: SessionController) => Promise<void>;
  renderActiveTab?: ReturnType<typeof vi.fn>;
  settlePresentation?: () => Promise<void>;
}

function harness(options: HarnessOptions = {}) {
  const operations = new OperationCoordinator();
  const renderActiveTab = options.renderActiveTab ?? vi.fn();
  const persistLeafState = vi.fn();
  const claimSessionOwnership = vi.fn();
  const transport = {
    isConnected: true,
    getRuntimeInfo: vi.fn(async () => ({ cwd: "C:\\Different", agentDir: "C:\\Different\\.chatobby" })),
  } as unknown as ChatobbyTransport;
  const plugin = {
    transport,
    settings: { autoNameStrategy: "truncate" },
    getActiveVaultDirectory: vi.fn(() => ""),
    getSessionPreferences: vi.fn(() => ({ model: null, thinkingLevel: "medium", permissionMode: "default" })),
  } as unknown as ChatobbyPlugin;
  let controller!: SessionController;
  controller = new SessionController({
    app: {
      vault: {
        adapter: { getBasePath: () => "C:\\Vault" },
        getName: () => "Vault",
        getAbstractFileByPath: () => null,
      },
    } as unknown as App,
    plugin,
    getTransport: () => transport,
    refreshTabBar: vi.fn(),
    renderActiveTab,
    persistLeafState,
    exitSessionBrowser: vi.fn(),
    runOperation: (descriptor, operation) => operations.run(descriptor, operation),
    getActiveOperation: () => operations.current("session-transition"),
    claimSessionOwnership,
    dispatchSessionIntent: (request) => options.dispatch?.(request, controller) ?? Promise.resolve(false),
    synchronizeFrontend: () => options.synchronize?.(controller) ?? Promise.resolve(),
    settlePresentation: options.settlePresentation ?? (() => Promise.resolve()),
  });
  return { controller, renderActiveTab, persistLeafState, claimSessionOwnership };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

function session(id: string, overrides: Partial<FrontendSessionViewModel> = {}): FrontendSessionViewModel {
  return {
    id,
    workingDirectory: "C:\\Vault",
		workspace: { kind: "vault", label: "Vault" },
    model: "model-1",
    thinkingLevel: "medium",
    streaming: false,
    compacting: false,
    retrying: false,
    messageCount: 0,
    forkOptions: [],
    ...overrides,
  };
}
