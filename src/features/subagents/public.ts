/** Public data-only subagent contracts consumed by the reviewable connector. */
export type {
  FrontendSubagentAcceptanceRecordViewModel as SubagentAcceptanceRecord,
  FrontendSubagentAgentDefinition as AgentDefinition,
  FrontendSubagentArtifactViewModel as SubagentArtifactSummary,
  FrontendSubagentBudgets as SubagentBudgets,
  FrontendSubagentCapabilitiesViewModel as SubagentCapabilities,
  FrontendSubagentControlAction as SubagentControlAction,
  FrontendSubagentControlReceiptViewModel as SubagentControlReceipt,
  FrontendSubagentDefinitionScope as DefinitionScope,
  FrontendSubagentMessageViewModel as SubagentMessage,
  FrontendSubagentNodeStatus as SubagentNodeStatus,
  FrontendSubagentNodeViewModel as SubagentNodeSnapshot,
  FrontendSubagentPermissionRequestViewModel as SubagentPermissionRequest,
  FrontendSubagentRunFilter as SubagentRunQuery,
  FrontendSubagentRunStatus as SubagentRunStatus,
  FrontendSubagentRunSummaryViewModel as SubagentRunSummary,
  FrontendSubagentRunViewModel as SubagentRunSnapshot,
  FrontendSubagentRuntimePolicy as AgentRuntimePolicy,
  FrontendSubagentSettingsViewModel as ResolvedSubagentSettings,
  FrontendSubagentWorkflowDefinition as WorkflowDefinition,
  FrontendSubagentWorkflowNodeDefinition as WorkflowNodeDefinition,
} from "../../vendor/chatobby-client/frontend-contracts.js";

/** Normalized, feed-independent frontend state and synchronization store. */
export { SubagentStore, type SubagentViewState } from "./state/subagent-store";

/** Controller that owns screen lifecycle, transport synchronization, and user commands. */
export { SubagentScreenController, type SubagentScreenControllerOptions } from "./application/subagent-screen-controller";
/** Session-level runtime-projected rail and native navigation controller. */
export {
  SessionAgentRailController,
  subagentActorId,
  type SessionAgentRailControllerOptions,
} from "./application/session-agent-rail-controller";
/** Chat view composition for the supervisor screen and session-level rail. */
export {
  createChatViewSubagentControllers,
  type ChatViewSubagentControllers,
  type ChatViewSubagentControllersOptions,
} from "./application/chat-view-subagent-controllers";
/** Compact navigation shown beneath the active session tabs. */
export { SessionAgentRail, type SessionAgentRailOptions } from "./ui/session-agent-rail";
/** Host adapter used to mount the shared feed renderer inside a child conversation. */
export type { SubagentFeedHostFactory } from "./ui/agent-conversation-view";
/** Stable tab identifiers accepted by the dedicated management screen. */
export type { SubagentScreenTab } from "./domain/screen-model";
