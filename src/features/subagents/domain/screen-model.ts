import type {
  FrontendSubagentUserAgentDefinition as UserAgentDefinition,
  FrontendSubagentControlAction as SubagentControlAction,
  FrontendSubagentMessageViewModel as SubagentMessage,
  FrontendSubagentRunFilter,
  FrontendSubagentSettingsViewModel as ResolvedSubagentSettings,
} from "../../../vendor/chatobby-client/frontend-contracts.js";

export type SubagentScreenTab = "runs" | "inbox" | "agents" | "settings";

export interface SubagentStartDraft {
  description: string;
  task: string;
  agentId: string;
  executionMode: "auto" | "in-process" | "worker-process";
  contextMode: "fresh" | "fork";
  workspaceMode: "shared" | "worktree";
  priority: number;
  maxTurns?: number;
  maxTokens?: number;
  maxWallTimeMs?: number;
}

export interface SubagentAgentEditorDraft {
  definition: UserAgentDefinition;
}

export interface SubagentScreenActions {
  openParentSession?: (sessionId: string) => void;
  stopParentSession?: (sessionId: string) => void;
  openAgentFeed?: (runId: string, nodeId: string) => void;
  openPermissions: () => void;
  getAgentEditorDraft: (itemId: string) => SubagentAgentEditorDraft | undefined;
  setAgentEditorDraft: (itemId: string, draft: SubagentAgentEditorDraft) => void;
  clearAgentEditorDraft: (itemId: string) => void;
  refresh: () => Promise<void>;
  selectRoleScope?: (scopeId: string) => Promise<void>;
  filterRuns: (query: FrontendSubagentRunFilter) => Promise<void>;
  loadMoreRuns: () => Promise<void>;
  selectRun: (runId: string) => Promise<void>;
  selectNode: (runId: string, nodeId: string) => Promise<void>;
  loadEarlierTranscript: (runId: string, nodeId: string) => Promise<void>;
  startRun: (draft: SubagentStartDraft) => Promise<void>;
  deleteSession: () => Promise<void>;
  control: (
    runId: string,
    nodeId: string | undefined,
    action: SubagentControlAction,
    details?: { message?: string; priority?: number },
  ) => Promise<void>;
  sendMessage: (
    runId: string,
    nodeId: string | undefined,
    text: string,
    kind: "inform" | "steer",
  ) => Promise<void>;
  acknowledgeMessage: (message: SubagentMessage, text?: string) => Promise<void>;
  decidePermission: (
    runId: string,
    nodeId: string,
    requestId: string,
    expectedRequestRevision: number,
    approved: boolean,
    value?: string,
  ) => Promise<void>;
  decideAcceptance: (runId: string, nodeId: string, approved: boolean, note?: string) => Promise<void>;
  promoteArtifact: (artifactId: string, expectedRevision: number, targetVaultPath: string) => Promise<void>;
  saveDefinition: (definition: UserAgentDefinition) => Promise<void>;
  deleteDefinition: (definition: UserAgentDefinition) => Promise<void>;
  updateSettings: (settings: ResolvedSubagentSettings) => Promise<void>;
}
