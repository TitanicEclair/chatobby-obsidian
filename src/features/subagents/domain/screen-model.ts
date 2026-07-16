import type {
  FrontendSubagentAgentDefinition as AgentDefinition,
  FrontendSubagentControlAction as SubagentControlAction,
  FrontendSubagentMessageViewModel as SubagentMessage,
  FrontendSubagentRunFilter,
  FrontendSubagentSettingsViewModel as ResolvedSubagentSettings,
  FrontendSubagentWorkflowDefinition as WorkflowDefinition,
  FrontendSubagentWorkflowNodeDefinition,
} from "../../../vendor/chatobby-client/frontend-contracts.js";

export type SubagentScreenTab = "runs" | "inbox" | "agents" | "workflows" | "settings";

export interface SubagentStartDraft {
  description: string;
  task: string;
  agentId: string;
  executionMode: "auto" | "in-process" | "worker-process";
  contextMode: "fresh" | "fork" | "selected" | "summary";
  workspaceMode: "shared" | "worktree";
  priority: number;
  maxTurns?: number;
  maxTokens?: number;
  maxWallTimeMs?: number;
}

export interface SubagentScreenActions {
  openPermissions: () => void;
  refresh: () => Promise<void>;
  filterRuns: (query: FrontendSubagentRunFilter) => Promise<void>;
  loadMoreRuns: () => Promise<void>;
  selectRun: (runId: string) => Promise<void>;
  selectNode: (runId: string, nodeId: string) => Promise<void>;
  loadEarlierTranscript: (runId: string, nodeId: string) => Promise<void>;
  startRun: (draft: SubagentStartDraft) => Promise<void>;
  startWorkflow: (workflow: WorkflowDefinition) => Promise<void>;
  deleteSession: () => Promise<void>;
  control: (
    runId: string,
    nodeId: string | undefined,
    action: SubagentControlAction,
    details?: { message?: string; priority?: number; step?: FrontendSubagentWorkflowNodeDefinition },
  ) => Promise<void>;
  sendMessage: (
    runId: string,
    nodeId: string | undefined,
    text: string,
    kind: "inform" | "steer",
  ) => Promise<void>;
  acknowledgeMessage: (message: SubagentMessage, text?: string) => Promise<void>;
  decidePermission: (runId: string, nodeId: string, requestId: string, approved: boolean, value?: string) => Promise<void>;
  decideAcceptance: (runId: string, nodeId: string, approved: boolean, note?: string) => Promise<void>;
  promoteArtifact: (artifactId: string, expectedRevision: number, targetVaultPath: string) => Promise<void>;
  saveDefinition: (definition: AgentDefinition, permissionProfileId: string | "inherit") => Promise<void>;
  deleteDefinition: (definition: AgentDefinition) => Promise<void>;
  saveWorkflow: (workflow: WorkflowDefinition) => Promise<void>;
  deleteWorkflow: (workflow: WorkflowDefinition) => Promise<void>;
  updateSettings: (settings: ResolvedSubagentSettings) => Promise<void>;
}
