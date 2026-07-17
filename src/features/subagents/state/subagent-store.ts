import type { FrontendStore } from "../../../frontend/frontend-store";
import type {
  FrontendFeedDocumentViewModel,
  FrontendSubagentAgentDefinition as AgentDefinition,
  FrontendSubagentArtifactViewModel as SubagentArtifactSummary,
  FrontendSubagentCapabilitiesViewModel as SubagentCapabilities,
  FrontendSubagentControlReceiptViewModel as SubagentControlReceipt,
  FrontendSubagentMessageViewModel as SubagentMessage,
  FrontendSubagentModelViewModel,
  FrontendSubagentPermissionSnapshotViewModel as PermissionProfileSnapshot,
  FrontendSubagentRunFilter as SubagentRunFilter,
  FrontendSubagentRunSummaryViewModel as SubagentRunSummary,
  FrontendSubagentRunViewModel as SubagentRunSnapshot,
  FrontendSubagentScreenViewModel,
  FrontendSubagentSettingsViewModel as ResolvedSubagentSettings,
  FrontendSubagentSkillViewModel,
  FrontendSubagentSyncStatus,
  FrontendSubagentWorkflowDefinition as WorkflowDefinition,
} from "../../../vendor/chatobby-client/frontend-contracts.js";

/** Read-only rendering adapter over the private runtime's subagent screen model. */
export interface SubagentViewState {
  readonly syncStatus: FrontendSubagentSyncStatus;
  readonly error: string | null;
  readonly statusMessage: string | null;
  readonly runtimeId: string | null;
  readonly sequence: number;
  readonly capabilities: SubagentCapabilities | null;
  readonly runIds: readonly string[];
  readonly runSummaries: ReadonlyMap<string, SubagentRunSummary>;
  readonly runQuery: SubagentRunFilter;
  readonly nextRunCursor: string | null;
  readonly runs: ReadonlyMap<string, SubagentRunSnapshot>;
  readonly definitions: readonly AgentDefinition[];
  readonly workflows: readonly WorkflowDefinition[];
  readonly settings: ResolvedSubagentSettings | null;
  readonly models: readonly FrontendSubagentModelViewModel[];
  readonly skills: readonly FrontendSubagentSkillViewModel[];
  readonly permissionSnapshot: PermissionProfileSnapshot | null;
  readonly selectedRunId: string | null;
  readonly selectedNodeId: string | null;
  readonly nextTranscriptCursor: string | null;
  readonly artifacts: ReadonlyMap<string, readonly SubagentArtifactSummary[]>;
  readonly messages: readonly SubagentMessage[];
  readonly controlReceipts: ReadonlyMap<string, SubagentControlReceipt>;
  readonly focusedFeed: FrontendFeedDocumentViewModel;
}

export class SubagentStore {
  private state: SubagentViewState = initialState();
  private readonly listeners = new Set<(state: SubagentViewState) => void>();
  private readonly unsubscribeFrontend: () => void;

  constructor(frontendStore: FrontendStore) {
    this.unsubscribeFrontend = frontendStore.subscribeSelector(
      (snapshot) => snapshot.screenModels.find(
        (screen): screen is FrontendSubagentScreenViewModel => screen.screenId === "subagents",
      ),
      (model) => this.synchronize(model),
    );
    this.synchronize(frontendStore.snapshot?.screenModels.find(
      (screen): screen is FrontendSubagentScreenViewModel => screen.screenId === "subagents",
    ));
  }

  getSnapshot(): SubagentViewState {
    return this.state;
  }

  subscribe(listener: (state: SubagentViewState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.unsubscribeFrontend();
    this.listeners.clear();
  }

  private synchronize(model: FrontendSubagentScreenViewModel | undefined): void {
    if (!model) return;
    this.state = toViewState(model);
    for (const listener of this.listeners) listener(this.state);
  }
}

function toViewState(model: FrontendSubagentScreenViewModel): SubagentViewState {
  const summaries = new Map(model.runSummaries.map((run) => [run.id, run]));
  const runs = new Map(model.runs.map((run) => [run.id, run]));
  const artifacts = new Map(model.artifacts.map((group) => [group.runId, group.items]));
  const receipts = new Map(model.controlReceipts.map((receipt) => [
    `${receipt.runId}:${receipt.nodeId ?? "run"}:${receipt.commandId}`,
    receipt,
  ]));
  return {
    syncStatus: model.syncStatus,
    error: model.error ?? null,
    statusMessage: model.statusMessage ?? null,
    runtimeId: model.runtimeId ?? null,
    sequence: model.sequence,
    capabilities: model.capabilities ?? null,
    runIds: model.runIds,
    runSummaries: summaries,
    runQuery: model.runQuery,
    nextRunCursor: model.nextRunCursor ?? null,
    runs,
    definitions: model.definitions,
    workflows: model.workflows,
    settings: model.settings ?? null,
    models: model.models,
    skills: model.skills,
    permissionSnapshot: model.permissionSnapshot ?? null,
    selectedRunId: model.selectedRunId ?? null,
    selectedNodeId: model.selectedNodeId ?? null,
    nextTranscriptCursor: model.nextTranscriptCursor ?? null,
    artifacts,
    messages: model.messages,
    controlReceipts: receipts,
    focusedFeed: model.focusedFeed,
  };
}

function initialState(): SubagentViewState {
  return {
    syncStatus: "idle",
    error: null,
    statusMessage: null,
    runtimeId: null,
    sequence: 0,
    capabilities: null,
    runIds: [],
    runSummaries: new Map(),
    runQuery: {},
    nextRunCursor: null,
    runs: new Map(),
    definitions: [],
    workflows: [],
    settings: null,
    models: [],
    skills: [],
    permissionSnapshot: null,
    selectedRunId: null,
    selectedNodeId: null,
    nextTranscriptCursor: null,
    artifacts: new Map(),
    messages: [],
    controlReceipts: new Map(),
    focusedFeed: { revision: 0, blocks: [] },
  };
}
