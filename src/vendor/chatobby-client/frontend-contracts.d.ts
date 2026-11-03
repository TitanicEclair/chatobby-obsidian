import { type FrontendChoiceOption } from "./frontend/contracts/choices.js";
import { type FrontendProjectIntentBody } from "./frontend/contracts/projects/intents.js";
import type { FrontendProjectScreenViewModel } from "./frontend/contracts/projects/models.js";
export type { FrontendChoiceOption } from "./frontend/contracts/choices.js";
export type { FrontendProjectAvailabilityFilter, FrontendProjectDetailViewModel, FrontendProjectLifecycleFilter, FrontendProjectMessageSearchHitViewModel, FrontendProjectMessageSearchPageViewModel, FrontendProjectRootViewModel, FrontendProjectScreenViewModel, FrontendProjectSessionDestinationViewModel, FrontendProjectSessionSearchMode, FrontendProjectSessionSort, FrontendProjectSessionViewModel, FrontendProjectSort, FrontendProjectSummaryViewModel, FrontendRunningWorkspaceViewModel, } from "./frontend/contracts/projects/models.js";
import { type PermissionRequestReview } from "./permission-review.js";
import { type FrontendPermissionScreenViewModel } from "./frontend/contracts/permission-screen.js";
import type { FrontendSubagentAgentDefinition, FrontendSubagentArtifactGroupViewModel, FrontendSubagentCapabilitiesViewModel, FrontendSubagentControlAction, FrontendSubagentControlReceiptViewModel, FrontendSubagentMessageViewModel, FrontendSubagentModelViewModel, FrontendSubagentPermissionSnapshotViewModel, FrontendSubagentRunFilter, FrontendSubagentRunSummaryViewModel, FrontendSubagentRunViewModel, FrontendSubagentSettingsViewModel, FrontendSubagentSkillViewModel, FrontendSubagentSyncStatus, FrontendSubagentUserAgentDefinition, FrontendSubagentUserDefinitionScope } from "./frontend/contracts/subagents/models.js";
import { type FrontendPermissionRequestBehavior, type FrontendWorkspacePolicyPayload } from "./frontend/contracts/workspace-permissions.js";
export type { FrontendObsidianVaultAccessViewModel, FrontendPermissionScreenViewModel, } from "./frontend/contracts/permission-screen.js";
export { OBSIDIAN_VAULT_ACCESS_WARNING } from "./frontend/contracts/permission-screen.js";
export type { FrontendPermissionRequestBehavior, FrontendPermissionWorkspaceTarget, FrontendWorkspacePermissionPolicy, FrontendWorkspacePolicyPayload, } from "./frontend/contracts/workspace-permissions.js";
import { type FrontendSandboxRevokePayload, type FrontendSandboxSetupPayload, type FrontendSandboxVerifyPayload } from "./frontend-sandbox-contracts.js";
import type { ThinkingLevel } from "./wire-types.js";
export type { FrontendSubagentAcceptanceRecordViewModel, FrontendSubagentActorViewModel, FrontendSubagentAgentDefinition, FrontendSubagentArtifactGroupViewModel, FrontendSubagentArtifactViewModel, FrontendSubagentBudgets, FrontendSubagentCapabilitiesViewModel, FrontendSubagentContextMode, FrontendSubagentControlAction, FrontendSubagentControlReceiptAction, FrontendSubagentControlReceiptViewModel, FrontendSubagentExecutionMode, FrontendSubagentLaunchResolutionSource, FrontendSubagentLaunchSummaryV1, FrontendSubagentMessageViewModel, FrontendSubagentModelViewModel, FrontendSubagentNodeStatus, FrontendSubagentNodeViewModel, FrontendSubagentPermissionRequestViewModel, FrontendSubagentPermissionSnapshotViewModel, FrontendSubagentResolutionLayer, FrontendSubagentResolvedExecutionMode, FrontendSubagentRunFilter, FrontendSubagentRunStatus, FrontendSubagentRunSummaryViewModel, FrontendSubagentRuntimePolicy, FrontendSubagentRunViewModel, FrontendSubagentSettingsViewModel, FrontendSubagentSkillViewModel, FrontendSubagentSyncStatus, FrontendSubagentUserAgentDefinition, FrontendSubagentUserDefinitionScope, } from "./frontend/contracts/subagents/models.js";
/** Public, data-only protocol consumed by reviewable Chatobby frontends. */
export declare const CHATOBBY_FRONTEND_PROTOCOL_VERSION = 2;
export declare const CHATOBBY_FRONTEND_SCHEMA_VERSION = 1;
export declare const CHATOBBY_FRONTEND_REPLAY_LIMIT = 256;
declare const frontendIdBrand: unique symbol;
/** Opaque wire identity. IDs from different entity families must not be interchanged. */
export type FrontendId<Kind extends string> = string & {
    readonly [frontendIdBrand]: Kind;
};
export type FrontendRuntimeInstanceId = FrontendId<"runtime-instance">;
export type FrontendVaultInstanceId = FrontendId<"vault-instance">;
export type FrontendViewId = FrontendId<"view">;
export type FrontendRequestId = FrontendId<"request">;
export type FrontendIntentId = FrontendId<"intent">;
export type FrontendScreenRequestId = FrontendRequestId;
export type FrontendSessionId = FrontendId<"session">;
export type FrontendProjectId = FrontendId<"project">;
export type FrontendMessageId = FrontendId<"message">;
export type FrontendBlockId = FrontendId<"block">;
export type FrontendTurnId = FrontendId<"turn">;
export type FrontendRunId = FrontendId<"run">;
export type FrontendNodeId = FrontendId<"node">;
export type FrontendActorId = FrontendId<"actor">;
export type FrontendChannelId = FrontendId<"channel">;
export declare function frontendId(value: string, label: "runtimeInstanceId"): FrontendRuntimeInstanceId;
export declare function frontendId(value: string, label: "vaultInstanceId"): FrontendVaultInstanceId;
export declare function frontendId(value: string, label: "viewId" | "scope.viewId"): FrontendViewId;
export declare function frontendId(value: string, label: "requestId"): FrontendRequestId;
export declare function frontendId(value: string, label: "intentId"): FrontendIntentId;
export declare function frontendId<Kind extends string>(value: string, label: string): FrontendId<Kind>;
export type FrontendLifecycleState = "disconnected" | "connecting" | "negotiating" | "bootstrapping" | "replaying" | "live" | "resynchronizing" | "degraded" | "closed";
/** Legal state edges for one connector view. `closed` is terminal. */
export declare const FRONTEND_LIFECYCLE_TRANSITIONS: {
    readonly disconnected: readonly ["connecting", "closed"];
    readonly connecting: readonly ["negotiating", "disconnected", "degraded", "closed"];
    readonly negotiating: readonly ["bootstrapping", "replaying", "degraded", "disconnected", "closed"];
    readonly bootstrapping: readonly ["live", "resynchronizing", "degraded", "disconnected", "closed"];
    readonly replaying: readonly ["live", "resynchronizing", "degraded", "disconnected", "closed"];
    readonly live: readonly ["connecting", "resynchronizing", "degraded", "disconnected", "closed"];
    readonly resynchronizing: readonly ["negotiating", "bootstrapping", "replaying", "degraded", "disconnected", "closed"];
    readonly degraded: readonly ["connecting", "negotiating", "resynchronizing", "disconnected", "closed"];
    readonly closed: readonly [];
};
export declare function isFrontendLifecycleTransition(from: FrontendLifecycleState, to: FrontendLifecycleState): boolean;
export type FrontendCapability = "workspace-pages" | "native-sandbox-setup" | "obsidian-vault-access" | "atomic-bootstrap-cutover" | "bounded-replay" | "typed-protocol-errors" | "revisioned-screen-cache" | "complete-feed-entities" | "session-clear" | "pagination-v2" | "intent-outcomes-v2";
/** Baseline protocol-v2 compatibility; additive features must not become required implicitly. */
export declare const CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES: readonly ["atomic-bootstrap-cutover", "bounded-replay", "typed-protocol-errors", "revisioned-screen-cache", "complete-feed-entities", "session-clear", "pagination-v2", "intent-outcomes-v2"];
/** Request these features, then use only the runtime's current negotiated selection. */
export declare const CHATOBBY_FRONTEND_OPTIONAL_CAPABILITIES: readonly ["workspace-pages", "native-sandbox-setup", "obsidian-vault-access"];
export interface FrontendUnavailableCapability {
    readonly capability: FrontendCapability;
    readonly reason: "not-requested" | "runtime-unavailable" | "connector-unsupported" | "requires-newer-protocol";
    readonly detail?: string;
}
export type FrontendProtocolErrorCode = "malformed-envelope" | "malformed-entity" | "unsupported-protocol-version" | "unsupported-capability" | "sequence-gap" | "replay-too-old" | "future-sequence" | "runtime-replaced" | "revision-conflict" | "stale-screen-response" | "unauthorized-view" | "internal-failure";
export interface FrontendProtocolError {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly code: FrontendProtocolErrorCode;
    readonly message: string;
    readonly diagnosticId?: string;
    readonly retryable: boolean;
    readonly resync: "none" | "retry" | "full-bootstrap" | "close";
    readonly runtimeInstanceId?: FrontendRuntimeInstanceId;
    readonly viewId?: FrontendViewId;
    readonly requestId?: FrontendRequestId;
    readonly sequence?: number;
    readonly revision?: number;
}
export type FrontendScreenId = "projects" | "memory" | "permissions" | "events" | "queries" | "channels" | "subagents" | "mcp";
export type FrontendIconToken = "activity" | "agent" | "alert" | "archive" | "arrow-left-right" | "audio-lines" | "badge-alert" | "blocks" | "book-open" | "book-plus" | "book-up" | "brain" | "bot" | "calendar" | "calendar-clock" | "calendar-plus" | "calendar-x" | "captions" | "channel" | "check" | "clock" | "command" | "external-link" | "file" | "file-plus" | "file-text" | "folder" | "folder-kanban" | "folder-sync" | "git-branch" | "git-graph" | "globe" | "history" | "image" | "info" | "layout-panel-top" | "link" | "list" | "list-checks" | "memory" | "messages-square" | "paperclip" | "pencil" | "play" | "plug" | "search" | "square-terminal" | "send" | "shield" | "shield-check" | "shield-x" | "terminal" | "terminal-square" | "toggle-right" | "tool" | "trash-2" | "triangle-alert" | "unplug" | "users" | "user-round" | "video" | "workflow" | "wrench" | "x";
export interface FrontendCapabilityReport {
    readonly featureFamilies: readonly string[];
    readonly protocolCapabilities: readonly FrontendCapability[];
    readonly integrations: readonly {
        readonly id: string;
        readonly name: string;
        readonly installed: boolean;
        readonly enabled: boolean;
    }[];
}
export interface FrontendNegotiationRequest {
    /** Presentation purpose, valid only with workspace-pages negotiation. */
    readonly surface?: "conversation" | "workspace";
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly requestId: FrontendRequestId;
    readonly connectorVersion: string;
    readonly obsidianVersion: string;
    readonly vaultInstanceId: FrontendVaultInstanceId;
    readonly viewId: FrontendViewId;
    readonly supportedProtocolVersions: readonly number[];
    readonly capabilities: FrontendCapabilityReport;
}
/** @deprecated Protocol v2 negotiates before the atomic subscription cutover. */
export type FrontendBootstrapRequest = FrontendNegotiationRequest;
export interface FrontendNegotiationResult {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly requestId: FrontendRequestId;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly viewId: FrontendViewId;
    readonly selectedCapabilities: readonly FrontendCapability[];
    readonly unavailableCapabilities: readonly FrontendUnavailableCapability[];
    readonly replayLimit: number;
}
export interface FrontendChoiceControl {
    readonly id: "provider" | "model" | "effort" | "permission" | "network";
    readonly label: string;
    /** Empty permission values are retained only for decoding retired clients. */
    readonly value: string;
    readonly options: readonly FrontendChoiceOption[];
}
export interface FrontendComposerViewModel {
    readonly controls: readonly FrontendChoiceControl[];
    readonly canSubmit: boolean;
    readonly disabledReason?: string;
}
/** Runtime-authoritative automatic-compaction settings for the selected model. */
export interface FrontendAutoCompactionViewModel {
    readonly mode?: "queued" | "background";
    readonly enabled: boolean;
    readonly thresholdPercent: number;
    readonly effectiveThresholdPercent: number;
    readonly customInstructions?: string;
}
export interface FrontendSessionViewModel {
    readonly id: string;
    readonly name?: string;
    readonly recoveryPath?: string;
    readonly workingDirectory: string;
    readonly workspace: {
        readonly kind: "vault";
        readonly label: string;
    } | {
        readonly kind: "project";
        readonly projectId: string;
        readonly label: string;
    };
    readonly model: string;
    readonly thinkingLevel: ThinkingLevel;
    readonly streaming: boolean;
    readonly compacting: boolean;
    readonly retrying: boolean;
    /** Optional for additive compatibility with runtimes predating this projection. */
    readonly autoCompaction?: FrontendAutoCompactionViewModel;
    readonly retryStatus?: {
        readonly attempt: number;
        readonly maxAttempts: number;
        readonly message: string;
        readonly terminal: boolean;
    };
    readonly messageCount: number;
    readonly forkOptions: readonly {
        readonly entryId: string;
        readonly label: string;
    }[];
}
export type FrontendTaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export interface FrontendTaskItemViewModel {
    readonly id: string;
    readonly step: number;
    readonly text: string;
    readonly status: FrontendTaskStatus;
    readonly note?: string;
}
export interface FrontendTaskPlanViewModel {
    readonly revision: number;
    readonly completedCount: number;
    readonly remainingCount: number;
    readonly summary: string;
    readonly items: readonly FrontendTaskItemViewModel[];
}
export interface FrontendAgentRailItem {
    readonly actorId: string;
    readonly kind: "main" | "subagent";
    readonly name: string;
    readonly working: boolean;
    readonly updatedAt: number;
    readonly runId?: string;
    readonly nodeId?: string;
}
export interface FrontendAgentRailViewModel {
    readonly items: readonly FrontendAgentRailItem[];
}
export type FrontendToolCategory = "read" | "edit" | "write" | "list" | "search" | "link" | "move" | "trash" | "open" | "graph" | "task" | "workspace" | "command" | "import" | "bash" | "cli" | "subagent" | "metadata" | "git" | "capability" | "memory" | "skill" | "event" | "permission" | "channel" | "media" | "other";
export interface FrontendToolActivityViewModel {
    readonly id: string;
    readonly semanticKind: string;
    readonly category: FrontendToolCategory;
    readonly phase: "queued" | "running" | "succeeded" | "failed" | "cancelled";
    readonly title: string;
    readonly detail?: string;
    readonly resultSummary?: string;
    readonly iconToken?: FrontendIconToken;
    readonly startedAt?: number;
    readonly completedAt?: number;
    readonly expandable: boolean;
}
export interface FrontendFeedAttachment {
    readonly name: string;
    readonly kind: "image" | "text" | "binary";
    readonly mimeType?: string;
    readonly path?: string;
    readonly sizeBytes?: number;
    readonly data?: string;
}
export interface FrontendFeedSkillInvocation {
    readonly name: string;
}
export type FrontendFeedBlock = {
    readonly type: "user" | "system";
    readonly id: string;
    readonly turnId?: string;
    readonly text: string;
    readonly images?: readonly {
        readonly data: string;
        readonly mimeType: string;
    }[];
    readonly attachments?: readonly FrontendFeedAttachment[];
    readonly skillInvocations?: readonly FrontendFeedSkillInvocation[];
    readonly timestamp?: number;
} | {
    readonly type: "text" | "thinking";
    readonly id: string;
    readonly turnId: string;
    readonly text: string;
    readonly phase: "streaming" | "complete" | "compacted";
    readonly startedAt?: number;
    readonly durationMs?: number;
} | {
    readonly type: "tools";
    readonly id: string;
    readonly turnId: string;
    readonly phase: "streaming" | "complete" | "compacted";
    readonly items: readonly FrontendToolActivityViewModel[];
} | {
    readonly type: "summary";
    readonly id: string;
    readonly text: string;
    readonly durationMs?: number;
    readonly toolCounts: Readonly<Record<string, number>>;
    readonly blocks: readonly FrontendFeedBlock[];
} | {
    readonly type: "queued";
    readonly id: string;
    readonly queueKind: "steer" | "followUp";
    readonly text: string;
    readonly phase: "pending" | "queued" | "applied";
} | {
    readonly type: "divider";
    readonly id: string;
    readonly label: string;
    readonly tone: "active" | "done" | "info" | "error";
    readonly animated?: boolean;
    readonly activityStartedAt?: number;
    readonly activityEndedAt?: number;
    readonly activityLabel?: string;
    readonly detail?: string;
    readonly activitySteps?: readonly {
        readonly id: string;
        readonly label: string;
        readonly state: "pending" | "active" | "complete";
    }[];
} | {
    readonly type: "agent-activity";
    readonly id: string;
    readonly actorId: string;
    readonly runId: string;
    readonly nodeId?: string;
    readonly title: string;
    readonly detail?: string;
    readonly phase: "created" | "running" | "waiting" | "completed" | "failed";
    /** Absent means the runtime has no authoritative count. It must never be fabricated. */
    readonly compactionCount?: number;
} | {
    readonly type: "message";
    readonly id: string;
    /** Complete canonical communication entity; adapters must not fill missing semantics. */
    readonly message: FrontendSubagentMessageViewModel;
    readonly navigation?: FrontendNavigationReference;
} | {
    readonly type: "notice";
    readonly id: string;
    readonly permissionRequest?: PermissionRequestReview;
    readonly title: string;
    readonly body: string;
    readonly level: "info" | "warning" | "error";
    readonly actions: readonly FrontendActionViewModel[];
    readonly createdAt: number;
};
export interface FrontendFeedDocumentViewModel {
    readonly revision: number;
    readonly blocks: readonly FrontendFeedBlock[];
}
export interface FrontendNavigationReference {
    readonly mainSessionId: string;
    readonly actorId?: string;
    readonly runId?: string;
    readonly nodeId?: string;
    readonly channelId?: string;
}
export interface FrontendActionViewModel {
    readonly id: string;
    readonly label: string;
    readonly kind: "primary" | "secondary" | "danger";
    readonly iconToken?: FrontendIconToken;
    readonly disabledReason?: string;
}
export interface FrontendScreenDirectoryEntry {
    readonly id: FrontendScreenId;
    readonly label: string;
    readonly available: boolean;
    readonly revision: number;
    readonly unavailableReason?: string;
}
export interface FrontendChannelDirectoryItem {
    readonly id: string;
    readonly label: string;
    readonly subtitle: string;
    readonly iconToken: "users" | "messages-square";
    readonly selected: boolean;
    readonly archived: boolean;
    readonly canArchive: boolean;
    readonly canDelete: boolean;
}
export interface FrontendChannelGroupViewModel {
    readonly id: "current" | "named" | "sessions" | "archived";
    readonly label: string;
    readonly items: readonly FrontendChannelDirectoryItem[];
}
export interface FrontendChannelMessageViewModel {
    readonly id: string;
    readonly order: number;
    readonly senderLabel: string;
    readonly senderInitials: string;
    readonly recipientLabel: string;
    readonly kindLabel: string;
    readonly text: string;
    readonly createdAt: number;
    readonly contextLabel?: string;
    readonly senderNavigation?: FrontendNavigationReference;
    readonly operatorAuthored?: boolean;
    readonly deliveryLabel?: string;
    readonly replyTo?: string;
}
export interface FrontendChannelParticipantViewModel {
    readonly actorId: string;
    readonly label: string;
    readonly kind: "main" | "subagent" | "user";
    readonly state: "invited" | "approval_pending" | "connected" | "disconnected";
    readonly live: boolean;
    readonly navigation?: FrontendNavigationReference;
}
export interface FrontendChannelScreenViewModel {
    readonly screenId: "channels";
    readonly revision: number;
    readonly loading: boolean;
    readonly error?: string;
    readonly groups: readonly FrontendChannelGroupViewModel[];
    readonly selectedChannelId?: string;
    readonly heading: string;
    readonly subheading?: string;
    readonly messages: readonly FrontendChannelMessageViewModel[];
    readonly nextCursor?: string;
    readonly workspaceWide?: boolean;
    readonly canCompose?: boolean;
    readonly participants?: readonly FrontendChannelParticipantViewModel[];
    readonly availableAgents?: readonly FrontendChannelParticipantViewModel[];
}
export type FrontendMemoryCollectionFilter = "all" | "profile" | "knowledge" | "vault" | "project" | "lessons";
export type FrontendMemoryScopeFilter = "available" | "vault" | "current-project";
export type FrontendMemoryStatusFilter = "active" | "archived" | "all";
export type FrontendMemoryCategoryFilter = "all" | "uncategorized" | "failure" | "correction" | "insight" | "preference" | "convention" | "tool-quirk";
export type FrontendMemorySort = "updated-desc" | "last-used-desc" | "created-desc" | "created-asc";
export type FrontendMemoryBoundaryMode = "inherit" | "separate" | "project-only";
export interface FrontendMemoryRecordViewModel {
    readonly id: string;
    readonly revision: number;
    readonly iconToken: FrontendIconToken;
    readonly label: string;
    readonly locationLabel: string;
    readonly scopeRelationLabel: string;
    readonly stateLabel?: string;
    readonly content: string;
    readonly provenanceLabel: string;
    readonly createdAt: string;
    readonly lastReferencedAt: string;
    readonly updatedAt: string;
    readonly sensitivityLabel: string;
    readonly status: "active" | "archived";
    readonly availableActions: readonly ("edit" | "archive" | "restore" | "delete")[];
    readonly technicalLines: readonly string[];
}
export interface FrontendMemoryCandidateViewModel {
    readonly id: string;
    readonly actionLabel: string;
    readonly content: string;
    readonly reason?: string;
}
export interface FrontendMemorySettingChoice {
    readonly id: "backgroundLearning" | "correctionLearning" | "promptRouting";
    readonly title: string;
    readonly description: string;
    readonly value: string;
    readonly options: readonly FrontendChoiceOption[];
}
export interface FrontendMemoryScreenViewModel {
    readonly screenId: "memory";
    readonly revision: number;
    readonly loading: boolean;
    readonly error?: string;
    readonly statusMessage?: string;
    /** Operator browsing target; does not change the conversation's workspace. */
    readonly browseProjectId?: string | null;
    readonly browseOptions?: readonly FrontendChoiceOption[];
    readonly scope: {
        readonly label: string;
        readonly path?: string;
        readonly description: string;
    };
    readonly scopeFilter: FrontendMemoryScopeFilter;
    readonly scopeOptions: readonly FrontendChoiceOption[];
    readonly collection: FrontendMemoryCollectionFilter;
    readonly collectionOptions: readonly FrontendChoiceOption[];
    readonly status: FrontendMemoryStatusFilter;
    readonly statusOptions: readonly FrontendChoiceOption[];
    readonly query: string;
    readonly searchResultCount?: number;
    readonly lessonCategory: FrontendMemoryCategoryFilter;
    readonly lessonCategoryOptions: readonly FrontendChoiceOption[];
    readonly sort: FrontendMemorySort;
    readonly sortOptions: readonly FrontendChoiceOption[];
    readonly records: readonly FrontendMemoryRecordViewModel[];
    readonly candidates: readonly FrontendMemoryCandidateViewModel[];
    readonly createTargets: readonly FrontendChoiceOption[];
    readonly projectBoundary: {
        readonly description: string;
        readonly value: FrontendMemoryBoundaryMode;
        readonly options: readonly FrontendChoiceOption[];
        readonly disabledReason?: string;
    };
    readonly learningSettings: readonly FrontendMemorySettingChoice[];
    readonly storage: {
        readonly description: string;
        readonly technicalLines: readonly string[];
    };
    readonly helpItems: readonly string[];
}
export interface FrontendContextQueryViewModel {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly description: string;
    readonly trigger: "session_start" | "every_turn";
    readonly timingLabel: string;
    readonly enabled: boolean;
    readonly updatedAt: string;
    readonly enableDisabledReason?: string;
    readonly lastTest?: {
        readonly status: "succeeded" | "failed";
        readonly summary: string;
        readonly durationMs: number;
    };
}
export interface FrontendContextQueryScreenViewModel {
    readonly screenId: "queries";
    readonly revision: number;
    readonly loading: boolean;
    readonly error?: string;
    readonly statusMessage?: string;
    readonly projectName: string;
    readonly projectDirectory: string;
    readonly trusted: boolean;
    readonly items: readonly FrontendContextQueryViewModel[];
}
export type FrontendMcpServerState = "disabled" | "configured" | "connecting" | "discovering" | "needs-sign-in" | "ready" | "connected" | "updating" | "unavailable" | "incompatible";
export interface FrontendMcpServerViewModel {
    readonly id: string;
    readonly reportedName?: string;
    readonly reportedVersion?: string;
    readonly state: FrontendMcpServerState;
    readonly enabled: boolean;
    readonly builtIn: boolean;
    readonly sourceLabel: string;
    readonly sourceScope: "global" | "project";
    readonly writable: boolean;
    readonly transport: "local" | "remote";
    readonly lifecycle: "keep-alive" | "lazy" | "eager";
    readonly localExecution?: {
        readonly status: "available";
        readonly mode: "unsandboxed";
    } | {
        readonly status: "unavailable";
        readonly reason: string;
    };
    readonly toolCount: number;
    readonly enabledToolCount: number;
    readonly toolReviewRequired: boolean;
    readonly resourceCount: number;
    readonly tools: readonly {
        readonly name: string;
        readonly title?: string;
        readonly description?: string;
        readonly enabled: boolean;
    }[];
    readonly resources: readonly {
        readonly uri: string;
        readonly name: string;
        readonly description?: string;
        readonly mimeType?: string;
        readonly toolName: string;
        readonly enabled: boolean;
    }[];
    readonly requiresAuthentication: boolean;
    readonly sourcePath: string;
    readonly command?: string;
    readonly arguments: readonly string[];
    readonly workingDirectory?: string;
    readonly url?: string;
    readonly authentication: "oauth" | "bearer" | "none";
    readonly credentialReference?: string;
    readonly environmentNames: readonly string[];
    readonly headerNames: readonly string[];
    readonly registry?: {
        readonly serverName: string;
        readonly version: string;
    };
}
export interface FrontendMcpCatalogItemViewModel {
    readonly name: string;
    readonly title: string;
    readonly description: string;
    readonly version: string;
    readonly repositoryUrl?: string;
    readonly transportLabel: string;
    readonly environmentNames: readonly string[];
    readonly canConfigure: boolean;
    readonly unavailableReason?: string;
}
export interface FrontendMcpScreenViewModel {
    readonly screenId: "mcp";
    readonly revision: number;
    readonly loading: boolean;
    readonly error?: string;
    readonly statusMessage?: string;
    readonly selectedTab: "installed" | "discover";
    readonly query: string;
    readonly configRevision: string;
    readonly inventoryRevision: number;
    readonly servers: readonly FrontendMcpServerViewModel[];
    readonly catalog: readonly FrontendMcpCatalogItemViewModel[];
    readonly nextCatalogCursor?: string;
    readonly pendingAuthentication?: {
        readonly serverId: string;
        readonly authorizationUrl: string;
    };
}
export interface FrontendMcpServerDraft {
    readonly name: string;
    readonly scope: "user" | "project";
    readonly enabled: boolean;
    readonly lifecycle: "keep-alive" | "lazy" | "eager";
    readonly transport: "local" | "remote";
    readonly command?: string;
    readonly arguments?: readonly string[];
    readonly workingDirectory?: string;
    readonly url?: string;
    readonly authentication?: "oauth" | "bearer" | "none";
    readonly bearerCredentialReference?: string;
    readonly bearerTokenEnvironmentVariable?: string;
    readonly environment?: readonly {
        readonly name: string;
        readonly sourceEnvironmentVariable: string;
    }[];
    readonly headers?: readonly {
        readonly name: string;
        readonly sourceEnvironmentVariable: string;
    }[];
    readonly registry?: {
        readonly source: "official";
        readonly serverName: string;
        readonly version: string;
        readonly packageIdentifier?: string;
    };
}
export type FrontendPermissionDecision = "allow" | "ask" | "deny";
export interface FrontendPermissionDecisionControl {
    readonly value: FrontendPermissionDecision | "mixed";
    readonly disabled: boolean;
}
export interface FrontendPermissionTargetViewModel {
    readonly keys: readonly string[];
    readonly label: string;
    readonly description?: string;
    readonly source?: string;
    readonly inherited: boolean;
    readonly decision: FrontendPermissionDecisionControl;
}
export interface FrontendPermissionCapabilityGroupViewModel {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly countLabel: string;
    readonly decision: FrontendPermissionDecisionControl;
    readonly targets: readonly FrontendPermissionTargetViewModel[];
}
export interface FrontendPermissionProfileViewModel {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly builtIn: boolean;
    readonly selected: boolean;
    readonly activeForMain: boolean;
    readonly canActivate: boolean;
    readonly canEdit: boolean;
    readonly canDelete: boolean;
    readonly deleteReplacementRequired: boolean;
    readonly deleteImpactLabel?: string;
    readonly duplicateLabel: string;
}
export type FrontendPermissionAuthority = {
    readonly kind: "main";
    readonly mainSessionId: string;
} | {
    readonly kind: "subagent";
    readonly mainSessionId: string;
    readonly runId: string;
    readonly nodeId: string;
} | {
    readonly kind: "event";
    readonly eventId: string;
    readonly eventSessionId: string;
    readonly mainSessionId?: string;
};
export interface FrontendPermissionLiveAgentViewModel {
    readonly authority: FrontendPermissionAuthority;
    readonly label: string;
    readonly detail: string;
    readonly audience: "main" | "child" | "background";
    readonly profileId: string;
    readonly bindingRevision: number;
}
export interface FrontendPermissionChannelGrantViewModel {
    readonly channelId: string;
    readonly label: string;
    readonly decisions: Readonly<Record<"connect" | "read" | "send", FrontendPermissionDecision>>;
    readonly disabled: boolean;
}
export interface FrontendPermissionSessionApprovalViewModel {
    readonly surface: string;
    readonly surfaceLabel: string;
    readonly pattern: string;
}
export interface FrontendPermissionAdvancedGroupViewModel {
    readonly section: "path" | "external_directory" | "bash" | "skill";
    readonly label: string;
    readonly placeholder: string;
    readonly disabled: boolean;
    readonly rules: readonly {
        readonly pattern: string;
        readonly decision: FrontendPermissionDecision;
    }[];
}
export interface FrontendEventDefinitionViewModel {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly description?: string;
    readonly enabled: boolean;
    readonly running: boolean;
    readonly iconToken: FrontendIconToken;
    readonly statusLabel: string;
    readonly triggerLabel: string;
    readonly projectLabel: string;
    readonly permissionLabel: string;
    readonly agentLabel: string;
    readonly approvalLabel: string;
    readonly budgetLabel: string;
    readonly canRun: boolean;
}
export interface FrontendEventOccurrenceViewModel {
    readonly id: string;
    readonly eventName: string;
    readonly projectPath: string;
    readonly status: string;
    readonly statusLabel: string;
    readonly originLabel: string;
    readonly triggeredAt: string;
    readonly allocationLabel: string;
    readonly summary?: string;
    readonly error?: string;
    readonly canApprove: boolean;
    readonly session?: {
        readonly id: string;
        readonly recoveryPath: string;
    };
}
export interface FrontendEventEditorViewModel {
    readonly definitionId?: string;
    readonly expectedRevision?: number;
    readonly name: string;
    readonly description: string;
    readonly projectPath: string;
    readonly permissionProfileId: string;
    readonly agentId: string;
    readonly enabled: boolean;
    readonly triggerKind: "schedule" | "filesystem" | "command";
    readonly triggerValue: string;
    readonly scheduleStartAt: string;
    readonly scheduleRepeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
    readonly scheduleInterval: number;
    readonly scheduleWeekdays: readonly number[];
    readonly scheduleEnd: "never" | "on" | "after";
    readonly scheduleEndDate: string;
    readonly scheduleEndOccurrences: number;
    readonly triggerRecursive: boolean;
    readonly triggerDebounceMs: number;
    readonly prompt: string;
    readonly requireApproval: boolean;
    readonly allowWhenViewClosed: boolean;
    readonly backgroundConsent: boolean;
    readonly maxRunsPerDay: number;
    readonly maxRuntimeMinutes: number;
    readonly projectChoices: readonly FrontendChoiceOption[];
    readonly permissionChoices: readonly FrontendChoiceOption[];
    readonly agentChoices: readonly FrontendChoiceOption[];
    readonly saveEnabled: boolean;
    readonly allocationError?: string;
}
export interface FrontendEventScreenViewModel {
    readonly screenId: "events";
    readonly revision: number;
    readonly loading: boolean;
    readonly error?: string;
    readonly statusMessage?: string;
    readonly definitions: readonly FrontendEventDefinitionViewModel[];
    readonly occurrences: readonly FrontendEventOccurrenceViewModel[];
    readonly pendingApprovalCount: number;
    readonly editor?: FrontendEventEditorViewModel;
}
export interface FrontendSubagentScreenViewModel {
    readonly screenId: "subagents";
    readonly revision: number;
    readonly loading: boolean;
    readonly error?: string;
    readonly statusMessage?: string;
    readonly syncStatus: FrontendSubagentSyncStatus;
    readonly runtimeId?: string;
    readonly sequence: number;
    readonly capabilities?: FrontendSubagentCapabilitiesViewModel;
    readonly workspaceWide?: boolean;
    readonly roleScopeId?: string;
    readonly roleScopeOptions?: readonly FrontendChoiceOption[];
    readonly parentSessions?: readonly FrontendSubagentParentSessionViewModel[];
    readonly runIds: readonly string[];
    readonly runSummaries: readonly FrontendSubagentRunSummaryViewModel[];
    readonly runQuery: FrontendSubagentRunFilter;
    readonly nextRunCursor?: string;
    readonly runs: readonly FrontendSubagentRunViewModel[];
    readonly definitions: readonly FrontendSubagentAgentDefinition[];
    readonly settings?: FrontendSubagentSettingsViewModel;
    readonly models: readonly FrontendSubagentModelViewModel[];
    readonly skills: readonly FrontendSubagentSkillViewModel[];
    readonly permissionSnapshot?: FrontendSubagentPermissionSnapshotViewModel;
    readonly selectedRunId?: string;
    readonly selectedNodeId?: string;
    readonly nextTranscriptCursor?: string;
    readonly artifacts: readonly FrontendSubagentArtifactGroupViewModel[];
    readonly messages: readonly FrontendSubagentMessageViewModel[];
    readonly controlReceipts: readonly FrontendSubagentControlReceiptViewModel[];
    readonly focusedFeed: FrontendFeedDocumentViewModel;
}
export interface FrontendSubagentParentSessionViewModel {
    readonly sessionId: string;
    readonly label: string;
    readonly workspaceLabel: string;
    readonly active: boolean;
}
export type FrontendScreenViewModel = FrontendProjectScreenViewModel | FrontendChannelScreenViewModel | FrontendMemoryScreenViewModel | FrontendContextQueryScreenViewModel | FrontendPermissionScreenViewModel | FrontendEventScreenViewModel | FrontendSubagentScreenViewModel | FrontendMcpScreenViewModel;
export interface FrontendScreenRequest {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly viewId: FrontendViewId;
    readonly requestId: FrontendScreenRequestId;
    /** Monotonic per screen and view. A lower epoch response is always stale. */
    readonly requestEpoch: number;
    /** Global sequence observed before the query; protects patch-versus-load races. */
    readonly baseSequence: number;
    readonly screenId: FrontendScreenId;
    readonly preferredEntityId?: string;
}
export interface FrontendScreenResponse {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly viewId: FrontendViewId;
    readonly requestId: FrontendScreenRequestId;
    readonly requestEpoch: number;
    readonly baseSequence: number;
    readonly screenRevision: number;
    readonly screen: FrontendScreenViewModel;
}
export interface FrontendLocalCommandViewModel {
    readonly name: string;
    readonly description: string;
    readonly kind: "screen" | "runtime";
    readonly source: "local" | "extension" | "prompt" | "skill";
    readonly action: "open-screen" | "compact" | "create-session" | "set-working-directory" | "resume-session" | "fork-session" | "clone-session" | "reload" | "abort" | "bash" | "set-model" | "set-thinking" | "export-html" | "export-jsonl" | "start-backend" | "stop-backend" | "send-raw-prompt";
    readonly screenId?: FrontendScreenId;
    readonly argument: {
        readonly kind: "none" | "optional-rest" | "required-rest" | "optional-path" | "fixed-whitespace";
        readonly count?: number;
        readonly missingLabel?: string;
    };
    readonly surroundingTextPolicy: "allow" | "forbid";
    readonly concurrencyKey?: "session" | "backend" | "agent-command";
    readonly showInMenu: boolean;
    readonly options?: readonly FrontendChoiceOption[];
    readonly validation?: "vault-directory";
    readonly retiredReplacement?: string;
}
export interface FrontendBootstrap {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly revision: number;
    readonly sequence: number;
    readonly viewId: FrontendViewId;
    readonly session: FrontendSessionViewModel | null;
    readonly taskPlan: FrontendTaskPlanViewModel;
    readonly composer: FrontendComposerViewModel;
    readonly agentRail: FrontendAgentRailViewModel;
    readonly feed: FrontendFeedDocumentViewModel;
    readonly screens: readonly FrontendScreenDirectoryEntry[];
    /** Detailed screens are loaded into the independently ordered screen cache. */
    readonly screenModels: readonly FrontendScreenViewModel[];
    readonly localCommands: readonly FrontendLocalCommandViewModel[];
}
/** V2 implements view-scoped state only. New scope variants require negotiation. */
export type FrontendScope = {
    readonly kind: "view";
    readonly viewId: FrontendViewId;
};
export type FrontendPatchOperation = {
    readonly type: "session.replace";
    readonly session: FrontendSessionViewModel;
} | {
    readonly type: "session.clear";
} | {
    readonly type: "task-plan.replace";
    readonly taskPlan: FrontendTaskPlanViewModel;
} | {
    readonly type: "composer.replace";
    readonly composer: FrontendComposerViewModel;
} | {
    readonly type: "agent-rail.replace";
    readonly agentRail: FrontendAgentRailViewModel;
} | {
    readonly type: "local-commands.replace";
    readonly localCommands: readonly FrontendLocalCommandViewModel[];
} | {
    readonly type: "feed.document.replace";
    readonly feed: FrontendFeedDocumentViewModel;
} | {
    readonly type: "feed.block.upsert";
    readonly index: number;
    readonly block: FrontendFeedBlock;
} | {
    readonly type: "feed.block.remove";
    readonly blockId: string;
} | {
    readonly type: "feed.text.append";
    readonly blockId: string;
    readonly text: string;
} | {
    readonly type: "feed.turn.finalize";
    readonly turnId: string;
    readonly completedAt: number;
} | {
    readonly type: "screen.replace";
    readonly screen: FrontendScreenViewModel;
};
export interface FrontendPatch {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly viewId: FrontendViewId;
    readonly scope: FrontendScope;
    readonly sequence: number;
    readonly baseRevision: number;
    readonly revision: number;
    readonly operations: readonly FrontendPatchOperation[];
}
export interface FrontendSubscriptionRequest {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly requestId: FrontendRequestId;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly viewId: FrontendViewId;
    readonly resume?: {
        readonly afterSequence: number;
        readonly revision: number;
    };
}
interface FrontendSubscriptionBase {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly requestId: FrontendRequestId;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly viewId: FrontendViewId;
    readonly sequence: number;
    readonly revision: number;
    readonly oldestReplayableSequence: number;
}
export type FrontendSubscriptionResult = (FrontendSubscriptionBase & {
    readonly status: "bootstrapped";
    readonly bootstrap: FrontendBootstrap;
    readonly replay: readonly [];
}) | (FrontendSubscriptionBase & {
    readonly status: "replayed";
    readonly baseSequence: number;
    readonly baseRevision: number;
    readonly replay: readonly FrontendPatch[];
}) | (FrontendSubscriptionBase & {
    readonly status: "resync-required";
    readonly error: FrontendProtocolError;
});
/** @deprecated The v2 subscribe result is discriminated and carries bootstrap/replay. */
export type FrontendSubscriptionAck = FrontendSubscriptionResult;
interface FrontendIntentBase {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly intentId: FrontendIntentId;
    readonly viewId: FrontendViewId;
    readonly mainSessionId?: string;
    readonly expectedRevision?: number;
}
interface FrontendPermissionRevisionPayload {
    readonly expectedProfileRevision: number;
}
export type FrontendIntent = (FrontendIntentBase & {
    readonly type: "session.create";
    readonly payload: {
        readonly cwdOverride?: string;
        readonly workspace?: {
            readonly kind: "vault";
        } | {
            readonly kind: "project";
            readonly projectId: string;
        };
        readonly model?: string;
        readonly thinkingLevel?: ThinkingLevel;
        readonly permissionProfileId?: string | null;
        readonly autoNameStrategy?: "truncate" | "model";
    };
}) | (FrontendIntentBase & {
    readonly type: "session.resume";
    readonly payload: {
        readonly sessionPath: string;
        readonly model?: string;
        readonly thinkingLevel?: ThinkingLevel;
        readonly permissionProfileId?: string | null;
    };
}) | (FrontendIntentBase & {
    readonly type: "session.resume-by-id";
    readonly payload: {
        readonly sessionId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "session.change-workspace";
    readonly payload: {
        readonly target: {
            readonly kind: "vault";
        } | {
            readonly kind: "project";
            readonly projectId: string;
            readonly activeRootId?: string;
            readonly sessionAttachedRootIds: readonly string[];
        };
    };
}) | (FrontendIntentBase & {
    readonly type: "session.clone";
    readonly payload: Record<string, never>;
}) | (FrontendIntentBase & {
    readonly type: "session.fork";
    readonly payload: {
        readonly entryId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "session.rename";
    readonly payload: {
        readonly name: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "session.import-jsonl";
    readonly payload: {
        readonly inputPath: string;
        readonly cwdOverride?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "session.update-preferences";
    readonly payload: {
        readonly model?: string;
        readonly thinkingLevel?: ThinkingLevel;
        readonly permissionProfileId?: string | null;
    };
}) | (FrontendIntentBase & {
    readonly type: "operator.set-view-open";
    readonly payload: {
        readonly open: boolean;
    };
}) | (FrontendIntentBase & FrontendProjectIntentBody) | (FrontendIntentBase & {
    readonly type: "channel.select";
    readonly payload: {
        readonly channelId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "channel.create";
    readonly payload: {
        readonly name: string;
        readonly description: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "channel.send";
    readonly payload: {
        readonly channelId: string;
        readonly text: string;
        readonly replyTo?: string;
        readonly recipientActorIds?: readonly string[];
    };
}) | (FrontendIntentBase & {
    readonly type: "channel.set-participant";
    readonly payload: {
        readonly channelId: string;
        readonly actorId: string;
        readonly action: "invite" | "disconnect";
        readonly expectedChannelRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "channel.load-earlier";
    readonly payload: {
        readonly cursor: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "channel.set-archived";
    readonly payload: {
        readonly channelId: string;
        readonly archived: boolean;
        readonly expectedChannelRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "channel.delete";
    readonly payload: {
        readonly channelId: string;
        readonly expectedChannelRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.decide-candidate";
    readonly payload: {
        readonly candidateId: string;
        readonly decision: "approve" | "reject";
    };
}) | (FrontendIntentBase & {
    readonly type: "subagent.decide-permission";
    readonly payload: {
        readonly runId: string;
        readonly nodeId: string;
        readonly permissionRequestId: string;
        readonly expectedPermissionRequestRevision: number;
        readonly approved: boolean;
        readonly value?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.set-view";
    readonly payload: {
        readonly browseProjectId?: string | null;
        readonly scopeFilter: FrontendMemoryScopeFilter;
        readonly collection: FrontendMemoryCollectionFilter;
        readonly status: FrontendMemoryStatusFilter;
        readonly query: string;
        readonly lessonCategory: FrontendMemoryCategoryFilter;
        readonly sort: FrontendMemorySort;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.create";
    readonly payload: {
        readonly target: "user" | "memory" | "project" | "failure";
        readonly content: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.update";
    readonly payload: {
        readonly recordId: string;
        readonly expectedRecordRevision: number;
        readonly content: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.set-status";
    readonly payload: {
        readonly recordId: string;
        readonly expectedRecordRevision: number;
        readonly status: "active" | "archived";
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.delete";
    readonly payload: {
        readonly recordId: string;
        readonly expectedRecordRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.update-policy";
    readonly payload: {
        readonly expectedMemoryRevision: number;
        readonly backgroundLearning?: "off" | "suggest" | "auto";
        readonly correctionLearning?: "off" | "suggest" | "auto";
        readonly promptRouting?: "off" | "profile-project" | "hybrid";
        readonly projectBoundaryMode?: FrontendMemoryBoundaryMode;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.import-markdown" | "memory.export-markdown";
    readonly payload: Record<string, never>;
}) | (FrontendIntentBase & {
    readonly type: "queries.save";
    readonly payload: {
        readonly queryId?: string;
        readonly expectedQueryRevision?: number;
        readonly name: string;
        readonly description: string;
        readonly trigger: "session_start" | "every_turn";
    };
}) | (FrontendIntentBase & {
    readonly type: "queries.set-enabled";
    readonly payload: {
        readonly queryId: string;
        readonly expectedQueryRevision: number;
        readonly enabled: boolean;
        readonly confirmedTrustedCode: boolean;
    };
}) | (FrontendIntentBase & {
    readonly type: "queries.delete" | "queries.test";
    readonly payload: {
        readonly queryId: string;
        readonly expectedQueryRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.set-view";
    readonly payload: {
        readonly tab: "installed" | "discover";
        readonly query: string;
        readonly cursor?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.save";
    readonly payload: {
        readonly expectedConfigRevision: string;
        readonly draft: FrontendMcpServerDraft;
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.preview";
    readonly payload: {
        readonly draft: FrontendMcpServerDraft;
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.configure-verified";
    readonly payload: {
        readonly expectedConfigRevision: string;
        readonly pluginId: string;
        readonly scope: "user" | "project";
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.set-enabled";
    readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly enabled: boolean;
        readonly scope?: "user" | "project";
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.set-credential-reference";
    readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly reference: string;
        readonly scope?: "user" | "project";
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.set-tool-enabled";
    readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly toolName: string;
        readonly enabled: boolean;
        readonly scope?: "user" | "project";
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.discover" | "mcp.connect" | "mcp.disconnect" | "mcp.auth-start" | "mcp.diagnostics";
    readonly payload: {
        readonly serverId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.auth-complete";
    readonly payload: {
        readonly serverId: string;
        readonly input: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "mcp.remove";
    readonly payload: {
        readonly expectedConfigRevision: string;
        readonly serverId: string;
        readonly scope?: "user" | "project";
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-obsidian-vault-access";
    readonly payload: {
        readonly expectedRevision: number;
        readonly expectedSessionId: string;
        readonly expectedBindingRevision: number;
        readonly enabled: boolean;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-workspace-policy";
    readonly payload: FrontendWorkspacePolicyPayload;
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-workspace-vault-access";
    readonly payload: {
        readonly expectedRevision: number;
        readonly projectId: string | null;
        readonly expectedProjectRevision?: number;
        readonly enabled: boolean;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.setup-native-sandbox";
    readonly payload: FrontendSandboxSetupPayload;
}) | (FrontendIntentBase & {
    readonly type: "permissions.verify-native-sandbox";
    readonly payload: FrontendSandboxVerifyPayload;
}) | (FrontendIntentBase & {
    readonly type: "permissions.revoke-native-sandbox";
    readonly payload: FrontendSandboxRevokePayload;
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-access-policy";
    readonly mainSessionId: string;
    readonly payload: {
        readonly expectedRevision: number;
        readonly accessMode: "read-only" | "workspace" | "full";
        readonly agentNetworkAccess: boolean;
        readonly requestBehavior?: FrontendPermissionRequestBehavior;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.select-profile";
    readonly payload: {
        readonly profileId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.activate-profile" | "permissions.duplicate-profile";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.delete-profile";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly replacementProfileId?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-live-agent-profile";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly authority: FrontendPermissionAuthority;
        readonly profileId: string;
        readonly expectedBindingRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.update-profile";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly name: string;
        readonly description: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-capability";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly capabilityId: string;
        readonly decision: FrontendPermissionDecision;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-target";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly keys: readonly string[];
        readonly decision: FrontendPermissionDecision;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-rule";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly section: string;
        readonly pattern: string;
        readonly decision: FrontendPermissionDecision;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.remove-rule";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly section: string;
        readonly pattern: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.add-channel" | "permissions.remove-channel";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly channelId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "permissions.set-channel";
    readonly payload: FrontendPermissionRevisionPayload & {
        readonly profileId: string;
        readonly channelId: string;
        readonly action: "connect" | "read" | "send";
        readonly decision: FrontendPermissionDecision;
    };
}) | (FrontendIntentBase & {
    readonly type: "events.begin-edit";
    readonly payload: {
        readonly definitionId?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "events.cancel-edit";
    readonly payload: Record<string, never>;
}) | (FrontendIntentBase & {
    readonly type: "events.set-editor-project";
    readonly payload: {
        readonly projectPath: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "events.save";
    readonly payload: {
        readonly definitionId?: string;
        readonly expectedDefinitionRevision?: number;
        readonly name: string;
        readonly description: string;
        readonly projectPath: string;
        readonly permissionProfileId: string;
        readonly agentId: string;
        readonly enabled: boolean;
        readonly triggerKind: "schedule" | "filesystem" | "command";
        readonly triggerValue: string;
        readonly scheduleStartAt: string;
        readonly scheduleRepeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
        readonly scheduleInterval: number;
        readonly scheduleWeekdays: readonly number[];
        readonly scheduleEnd: "never" | "on" | "after";
        readonly scheduleEndDate: string;
        readonly scheduleEndOccurrences: number;
        readonly triggerRecursive: boolean;
        readonly triggerDebounceMs: number;
        readonly prompt: string;
        readonly requireApproval: boolean;
        readonly allowWhenViewClosed: boolean;
        readonly backgroundConsent: boolean;
        readonly maxRunsPerDay: number;
        readonly maxRuntimeMinutes: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "events.delete" | "events.set-enabled";
    readonly payload: {
        readonly definitionId: string;
        readonly expectedDefinitionRevision: number;
        readonly enabled?: boolean;
    };
}) | (FrontendIntentBase & {
    readonly type: "events.trigger";
    readonly payload: {
        readonly definitionId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "events.approve";
    readonly payload: {
        readonly occurrenceId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.set-role-scope";
    readonly payload: {
        readonly scopeId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.refresh" | "subagents.load-more" | "subagents.delete-session";
    readonly payload: Record<string, never>;
}) | (FrontendIntentBase & {
    readonly type: "subagents.filter-runs";
    readonly payload: {
        readonly query: FrontendSubagentRunFilter;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.select-run";
    readonly payload: {
        readonly runId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.select-node" | "subagents.load-earlier-transcript";
    readonly payload: {
        readonly runId: string;
        readonly nodeId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.start-run";
    readonly payload: {
        readonly description: string;
        readonly task: string;
        readonly agentId: string;
        readonly executionMode: "auto" | "in-process" | "worker-process";
        readonly contextMode: "fresh" | "fork";
        readonly workspaceMode: "shared" | "worktree";
        readonly permissionProfileId?: string;
        readonly priority: number;
        readonly maxTurns?: number;
        readonly maxTokens?: number;
        readonly maxWallTimeMs?: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.control";
    readonly payload: {
        readonly runId: string;
        readonly nodeId?: string;
        readonly action: FrontendSubagentControlAction;
        readonly message?: string;
        readonly priority?: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.send-message";
    readonly payload: {
        readonly runId: string;
        readonly nodeId?: string;
        readonly text: string;
        readonly kind: "inform" | "steer";
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.acknowledge-message";
    readonly payload: {
        readonly messageId: string;
        readonly text?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.decide-acceptance";
    readonly payload: {
        readonly runId: string;
        readonly nodeId: string;
        readonly approved: boolean;
        readonly note?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.promote-artifact";
    readonly payload: {
        readonly artifactId: string;
        readonly expectedArtifactRevision: number;
        readonly targetVaultPath: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.save-definition";
    readonly payload: {
        readonly definition: FrontendSubagentUserAgentDefinition;
        readonly permissionProfileId: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.delete-definition";
    readonly payload: {
        readonly definitionId: string;
        readonly scope: FrontendSubagentUserDefinitionScope;
        readonly scopeId: string;
        readonly expectedDefinitionRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.update-settings";
    readonly payload: {
        readonly settings: FrontendSubagentSettingsViewModel;
    };
});
interface FrontendIntentOutcomeBase {
    readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
    readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
    readonly runtimeInstanceId: FrontendRuntimeInstanceId;
    readonly viewId: FrontendViewId;
    readonly intentId: FrontendIntentId;
}
export type FrontendIntentResult = (FrontendIntentOutcomeBase & {
    readonly status: "applied";
    readonly revision: number;
    readonly notice?: FrontendNotice;
}) | (FrontendIntentOutcomeBase & {
    readonly status: "accepted";
    readonly acceptedAtSequence: number;
    readonly notice?: FrontendNotice;
}) | (FrontendIntentOutcomeBase & {
    readonly status: "rejected";
    readonly errorCode: string;
    readonly fieldErrors?: Readonly<Record<string, string>>;
    readonly notice: FrontendNotice;
}) | (FrontendIntentOutcomeBase & {
    readonly status: "conflict";
    readonly expectedRevision?: number;
    readonly actualRevision: number;
    readonly notice: FrontendNotice;
}) | (FrontendIntentOutcomeBase & {
    readonly status: "unavailable";
    readonly capability: FrontendCapability;
    readonly notice: FrontendNotice;
});
export interface FrontendNotice {
    readonly level: "info" | "warning" | "error";
    readonly message: string;
}
export declare function parseFrontendNegotiationRequest(value: unknown): FrontendNegotiationRequest;
/** @deprecated Use parseFrontendNegotiationRequest. */
export declare const parseFrontendBootstrapRequest: typeof parseFrontendNegotiationRequest;
export declare function parseFrontendSubscriptionRequest(value: unknown): FrontendSubscriptionRequest;
export declare function parseFrontendIntent(value: unknown): FrontendIntent;
export declare function parseFrontendScreenRequest(value: unknown): FrontendScreenRequest;
export declare function parseFrontendScreenResponse(value: unknown): FrontendScreenResponse;
export declare function parseFrontendScreen(value: unknown): FrontendScreenViewModel;
export declare function parseFrontendBootstrap(value: unknown): FrontendBootstrap;
export declare function parseFrontendPatch(value: unknown): FrontendPatch;
export declare function parseFrontendNegotiationResult(value: unknown): FrontendNegotiationResult;
export declare function parseFrontendSubscriptionResult(value: unknown): FrontendSubscriptionResult;
export declare function parseFrontendProtocolError(value: unknown): FrontendProtocolError;
export declare function parseFrontendIntentResult(value: unknown): FrontendIntentResult;
