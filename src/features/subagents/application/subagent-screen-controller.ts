import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendIntent,
  FrontendSubagentAgentDefinition as AgentDefinition,
  FrontendSubagentControlAction as SubagentControlAction,
  FrontendSubagentMessageViewModel as SubagentMessage,
  FrontendSubagentRunFilter,
  FrontendSubagentSettingsViewModel as ResolvedSubagentSettings,
  FrontendSubagentWorkflowDefinition as WorkflowDefinition,
  FrontendSubagentWorkflowNodeDefinition,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type {
  SubagentAgentEditorDraft,
  SubagentScreenActions,
  SubagentScreenTab,
  SubagentStartDraft,
  SubagentWorkflowEditorDraft,
} from "../domain/screen-model";
import { SubagentStore } from "../state/subagent-store";
import type { SubagentFeedHostFactory } from "../ui/agent-conversation-view";
import { SubagentsView } from "../ui/subagents-view";

export interface SubagentScreenControllerOptions {
  store: SubagentStore;
  getFrontendStore: () => FrontendStore;
  getFrontendProtocol: () => FrontendProtocolController;
  getHost: () => HTMLElement;
  prepareOpen: () => void;
  onOpened: () => void;
  onClosed: (renderChat: boolean) => void;
  onOpenManagement: () => void;
  openPermissions: () => void;
  createFeedHost: SubagentFeedHostFactory;
}

/** Binds the runtime-owned subagent screen and intents to native Obsidian rendering. */
export class SubagentScreenController {
  private readonly store: SubagentStore;
  private view: SubagentsView | null = null;
  private pendingRunId: string | undefined;
  private pendingNodeId: string | undefined;
  private readonly agentEditorDrafts = new Map<string, SubagentAgentEditorDraft>();
  private readonly workflowEditorDrafts = new Map<string, SubagentWorkflowEditorDraft>();

  constructor(private readonly options: SubagentScreenControllerOptions) {
    this.store = options.store;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    return this.view?.handleKeydown(event) ?? false;
  }

  focusComposer(): void {
    this.view?.focusComposer();
  }

  open(runId?: string, initialTab: SubagentScreenTab = "runs", nodeId?: string, feedOnly = false): void {
    this.pendingRunId = runId;
    this.pendingNodeId = nodeId;
    this.options.prepareOpen();
    this.view?.destroy();
    this.view = new SubagentsView({
      store: this.store,
      actions: this.actions(),
      onBack: () => this.close(),
      onOpenManagement: this.options.onOpenManagement,
      initialTab,
      initialFeedOnly: feedOnly,
      createFeedHost: this.options.createFeedHost,
    });
    this.options.onOpened();
    this.view.render(this.options.getHost());
    requestAnimationFrame(() => this.view?.focusContainer());
    void this.refresh();
  }

  close(renderChat = true): void {
    this.view?.destroy();
    this.view = null;
    this.options.onClosed(renderChat);
  }

  destroy(): void {
    this.view?.destroy();
    this.view = null;
    this.store.destroy();
  }

  synchronize(): void {
    if (this.view) void this.refresh();
  }

  async refresh(): Promise<void> {
    const snapshot = this.options.getFrontendStore().snapshot;
    if (!snapshot) return;
    this.view?.setActionStatus("Loading subagents…");
    try {
      await this.options.getFrontendProtocol().loadScreen({
        schemaVersion: 1,
        viewId: snapshot.viewId,
        screenId: "subagents",
        preferredEntityId: this.pendingRunId,
      });
      const runId = this.pendingRunId;
      const nodeId = this.pendingNodeId;
      this.pendingRunId = undefined;
      this.pendingNodeId = undefined;
      if (runId && nodeId) await this.dispatch({ type: "subagents.select-node", payload: { runId, nodeId } });
      this.view?.setActionStatus(null);
    } catch (error) {
      this.view?.setActionStatus(errorMessage(error));
    }
  }

  private actions(): SubagentScreenActions {
    return {
      openPermissions: () => this.options.openPermissions(),
      getAgentEditorDraft: (itemId) => cloneDraft(this.agentEditorDrafts.get(this.editorDraftKey("agent", itemId))),
      setAgentEditorDraft: (itemId, draft) => {
        this.agentEditorDrafts.set(this.editorDraftKey("agent", itemId), structuredClone(draft));
      },
      clearAgentEditorDraft: (itemId) => {
        this.agentEditorDrafts.delete(this.editorDraftKey("agent", itemId));
      },
      getWorkflowEditorDraft: (itemId) => cloneDraft(
        this.workflowEditorDrafts.get(this.editorDraftKey("workflow", itemId)),
      ),
      setWorkflowEditorDraft: (itemId, draft) => {
        this.workflowEditorDrafts.set(this.editorDraftKey("workflow", itemId), structuredClone(draft));
      },
      clearWorkflowEditorDraft: (itemId) => {
        this.workflowEditorDrafts.delete(this.editorDraftKey("workflow", itemId));
      },
      refresh: () => this.dispatch({ type: "subagents.refresh", payload: {} }),
      filterRuns: (query) => this.filterRuns(query),
      loadMoreRuns: () => this.dispatch({ type: "subagents.load-more", payload: {} }),
      selectRun: (runId) => this.dispatch({ type: "subagents.select-run", payload: { runId } }),
      selectNode: (runId, nodeId) => this.dispatch({ type: "subagents.select-node", payload: { runId, nodeId } }),
      loadEarlierTranscript: (runId, nodeId) =>
        this.dispatch({ type: "subagents.load-earlier-transcript", payload: { runId, nodeId } }),
      startRun: (draft) => this.startRun(draft),
      startWorkflow: (workflow) => this.dispatch({ type: "subagents.start-workflow", payload: { workflow } }),
      deleteSession: () => this.deleteSession(),
      control: (runId, nodeId, action, details) => this.control(runId, nodeId, action, details),
      sendMessage: (runId, nodeId, text, kind) =>
        this.dispatch({ type: "subagents.send-message", payload: { runId, nodeId, text, kind } }),
      acknowledgeMessage: (message, text) => this.acknowledgeMessage(message, text),
      decidePermission: (runId, nodeId, requestId, approved, value) =>
        this.decidePermission(runId, nodeId, requestId, approved, value),
      decideAcceptance: (runId, nodeId, approved, note) =>
        this.dispatch({ type: "subagents.decide-acceptance", payload: { runId, nodeId, approved, note } }),
      promoteArtifact: (artifactId, expectedRevision, targetVaultPath) =>
        this.dispatch({
          type: "subagents.promote-artifact",
          payload: { artifactId, expectedArtifactRevision: expectedRevision, targetVaultPath },
        }),
      saveDefinition: (definition, permissionProfileId) =>
        this.dispatch({ type: "subagents.save-definition", payload: { definition, permissionProfileId } }),
      deleteDefinition: (definition) => this.deleteDefinition(definition),
      saveWorkflow: (workflow) => this.dispatch({ type: "subagents.save-workflow", payload: { workflow } }),
      deleteWorkflow: (workflow) => this.deleteWorkflow(workflow),
      updateSettings: (settings) => this.updateSettings(settings),
    };
  }

  private filterRuns(query: FrontendSubagentRunFilter): Promise<void> {
    return this.dispatch({ type: "subagents.filter-runs", payload: { query } });
  }

  private startRun(draft: SubagentStartDraft): Promise<void> {
    return this.dispatch({ type: "subagents.start-run", payload: draft });
  }

  private control(
    runId: string,
    nodeId: string | undefined,
    action: SubagentControlAction,
    details?: { message?: string; priority?: number; step?: FrontendSubagentWorkflowNodeDefinition },
  ): Promise<void> {
    return this.dispatch({
      type: "subagents.control",
      payload: { runId, nodeId, action, message: details?.message, priority: details?.priority, step: details?.step },
    });
  }

  private async deleteSession(): Promise<void> {
    if (!window.confirm("Delete all subagent runs, messages, transcripts, and artifacts for this Chatobby session?")) return;
    await this.dispatch({ type: "subagents.delete-session", payload: {} });
  }

  private acknowledgeMessage(message: SubagentMessage, text?: string): Promise<void> {
    return this.dispatch({ type: "subagents.acknowledge-message", payload: { messageId: message.id, text } });
  }

  private decidePermission(
    runId: string,
    nodeId: string,
    permissionRequestId: string,
    approved: boolean,
    value?: string,
  ): Promise<void> {
    return this.dispatch({
      type: "subagent.decide-permission",
      payload: { runId, nodeId, permissionRequestId, approved, value },
    });
  }

  private async deleteDefinition(definition: AgentDefinition): Promise<void> {
    if (!window.confirm(`Delete agent role “${definition.name}”?`)) return;
    await this.dispatch({
      type: "subagents.delete-definition",
      payload: {
        definitionId: definition.id,
        scope: definition.scope,
        scopeId: definition.scopeId,
        expectedDefinitionRevision: definition.revision,
      },
    });
  }

  private async deleteWorkflow(workflow: WorkflowDefinition): Promise<void> {
    if (!window.confirm(`Delete workflow “${workflow.name}”?`)) return;
    await this.dispatch({
      type: "subagents.delete-workflow",
      payload: { workflowId: workflow.id, expectedWorkflowRevision: workflow.revision },
    });
  }

  private updateSettings(settings: ResolvedSubagentSettings): Promise<void> {
    return this.dispatch({ type: "subagents.update-settings", payload: { settings } });
  }

  private async dispatch(input: Pick<FrontendIntent, "type" | "payload">): Promise<void> {
    const snapshot = this.requireSnapshot();
    const intent = {
      schemaVersion: 1 as const,
      intentId: crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
      ...input,
    } as FrontendIntent;
    this.view?.setActionStatus(actionStatus(input.type));
    const outcome = await this.options.getFrontendProtocol().dispatch(intent);
    if (outcome.status === "rejected" || outcome.status === "conflict") {
      const message = outcome.notice?.message ?? "The subagent action could not be applied.";
      this.view?.setActionStatus(message);
      throw new Error(message);
    }
    this.view?.setActionStatus(null);
  }

  private requireSnapshot() {
    const snapshot = this.options.getFrontendStore().snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized");
    return snapshot;
  }

  private editorDraftKey(kind: "agent" | "workflow", itemId: string): string {
    const snapshot = this.requireSnapshot();
    return `${snapshot.session?.id ?? snapshot.viewId}:${kind}:${itemId}`;
  }
}

function cloneDraft<T>(draft: T | undefined): T | undefined {
  return draft === undefined ? undefined : structuredClone(draft);
}

function actionStatus(type: FrontendIntent["type"]): string {
  if (type === "subagents.send-message") return "Sending message…";
  if (type === "subagent.decide-permission") return "Updating permission…";
  if (type === "subagents.start-run" || type === "subagents.start-workflow") return "Starting subagent work…";
  if (type === "subagents.refresh") return "Refreshing subagents…";
  return "Updating subagent state…";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
