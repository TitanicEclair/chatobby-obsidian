// Generated from packages/chatobby/src/frontend-contracts.ts. Do not edit.
import { type FrontendChoiceOption, parseChoiceOption, validateChoices } from "./frontend/contracts/choices.ts";
import {
	type FrontendProjectIntentBody,
	parseFrontendProjectIntentBody,
} from "./frontend/contracts/projects/intents.ts";
import type { FrontendProjectScreenViewModel } from "./frontend/contracts/projects/models.ts";
import { validateProjectScreen } from "./frontend/contracts/projects/validation.ts";

export type { FrontendChoiceOption } from "./frontend/contracts/choices.ts";
export type {
	FrontendProjectAvailabilityFilter,
	FrontendProjectDetailViewModel,
	FrontendProjectLifecycleFilter,
	FrontendProjectMessageSearchHitViewModel,
	FrontendProjectMessageSearchPageViewModel,
	FrontendProjectRootViewModel,
	FrontendProjectScreenViewModel,
	FrontendProjectSessionDestinationViewModel,
	FrontendProjectSessionSearchMode,
	FrontendProjectSessionSort,
	FrontendProjectSessionViewModel,
	FrontendProjectSort,
	FrontendProjectSummaryViewModel,
	FrontendRunningWorkspaceViewModel,
} from "./frontend/contracts/projects/models.ts";

import {
	type PermissionRequestReview,
	parsePermissionRequestReview,
} from "./permission-review.ts";
import {
	type FrontendPermissionScreenViewModel,
	validatePermissionScreen,
} from "./frontend/contracts/permission-screen.ts";
import type {
	FrontendSubagentAgentDefinition,
	FrontendSubagentArtifactGroupViewModel,
	FrontendSubagentCapabilitiesViewModel,
	FrontendSubagentControlAction,
	FrontendSubagentControlReceiptViewModel,
	FrontendSubagentMessageViewModel,
	FrontendSubagentModelViewModel,
	FrontendSubagentPermissionSnapshotViewModel,
	FrontendSubagentRunFilter,
	FrontendSubagentRunSummaryViewModel,
	FrontendSubagentRunViewModel,
	FrontendSubagentSettingsViewModel,
	FrontendSubagentSkillViewModel,
	FrontendSubagentSyncStatus,
	FrontendSubagentUserAgentDefinition,
	FrontendSubagentUserDefinitionScope,
} from "./frontend/contracts/subagents/models.ts";
import {
	parseFrontendSubagentMessage,
	parseResolvedSubagentSettings,
	parseSubagentRunQuery,
	parseUserAgentDefinition,
	requireSubagentControlAction,
	requireUserDefinitionScope,
	SUBAGENT_RUN_STATUS_VALUES,
	validateSubagentArtifact,
	validateSubagentDefinition,
	validateSubagentMessage,
	validateSubagentRun,
	validateSubagentRunSummary,
} from "./frontend/contracts/subagents/validation.ts";
import {
	optionalFiniteNumber,
	optionalNullableString,
	optionalSafeInteger,
	optionalString,
	requireArray,
	requireBoolean,
	requireEnumValue,
	requireJsonValue,
	requireNumberRecord,
	requireRecord,
	requireSafeInteger,
	requireString,
	requireStringArray,
	requireTextValue,
	requireThinkingLevel,
	validateArray,
} from "./frontend/contracts/validation.ts";
import {
	type FrontendPermissionRequestBehavior,
	type FrontendWorkspacePolicyPayload,
	parseFrontendRequestBehavior,
	parseFrontendWorkspacePolicyPayload,
} from "./frontend/contracts/workspace-permissions.ts";

export type {
	FrontendObsidianVaultAccessViewModel,
	FrontendPermissionScreenViewModel,
} from "./frontend/contracts/permission-screen.ts";
export { OBSIDIAN_VAULT_ACCESS_WARNING } from "./frontend/contracts/permission-screen.ts";
export type {
	FrontendPermissionRequestBehavior,
	FrontendPermissionWorkspaceTarget,
	FrontendWorkspacePermissionPolicy,
	FrontendWorkspacePolicyPayload,
} from "./frontend/contracts/workspace-permissions.ts";

import {
	type FrontendSandboxRevokePayload,
	type FrontendSandboxSetupPayload,
	type FrontendSandboxVerifyPayload,
	parseFrontendSandboxRevokePayload,
	parseFrontendSandboxSetupPayload,
	parseFrontendSandboxVerifyPayload,
} from "./frontend-sandbox-contracts.ts";
import type { ThinkingLevel } from "./wire-types.ts";

export type {
	FrontendSubagentAcceptanceRecordViewModel,
	FrontendSubagentActorViewModel,
	FrontendSubagentAgentDefinition,
	FrontendSubagentArtifactGroupViewModel,
	FrontendSubagentArtifactViewModel,
	FrontendSubagentBudgets,
	FrontendSubagentCapabilitiesViewModel,
	FrontendSubagentContextMode,
	FrontendSubagentControlAction,
	FrontendSubagentControlReceiptAction,
	FrontendSubagentControlReceiptViewModel,
	FrontendSubagentExecutionMode,
	FrontendSubagentLaunchResolutionSource,
	FrontendSubagentLaunchSummaryV1,
	FrontendSubagentMessageViewModel,
	FrontendSubagentModelViewModel,
	FrontendSubagentNodeStatus,
	FrontendSubagentNodeViewModel,
	FrontendSubagentPermissionRequestViewModel,
	FrontendSubagentPermissionSnapshotViewModel,
	FrontendSubagentResolutionLayer,
	FrontendSubagentResolvedExecutionMode,
	FrontendSubagentRunFilter,
	FrontendSubagentRunStatus,
	FrontendSubagentRunSummaryViewModel,
	FrontendSubagentRuntimePolicy,
	FrontendSubagentRunViewModel,
	FrontendSubagentSettingsViewModel,
	FrontendSubagentSkillViewModel,
	FrontendSubagentSyncStatus,
	FrontendSubagentUserAgentDefinition,
	FrontendSubagentUserDefinitionScope,
} from "./frontend/contracts/subagents/models.ts";

/** Public, data-only protocol consumed by reviewable Chatobby frontends. */
export const CHATOBBY_FRONTEND_PROTOCOL_VERSION = 2;
export const CHATOBBY_FRONTEND_SCHEMA_VERSION = 1;
export const CHATOBBY_FRONTEND_REPLAY_LIMIT = 256;

declare const frontendIdBrand: unique symbol;

/** Opaque wire identity. IDs from different entity families must not be interchanged. */
export type FrontendId<Kind extends string> = string & { readonly [frontendIdBrand]: Kind };
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

export function frontendId(value: string, label: "runtimeInstanceId"): FrontendRuntimeInstanceId;
export function frontendId(value: string, label: "vaultInstanceId"): FrontendVaultInstanceId;
export function frontendId(value: string, label: "viewId" | "scope.viewId"): FrontendViewId;
export function frontendId(value: string, label: "requestId"): FrontendRequestId;
export function frontendId(value: string, label: "intentId"): FrontendIntentId;
export function frontendId<Kind extends string>(value: string, label: string): FrontendId<Kind>;
export function frontendId<Kind extends string>(value: string, label: string): FrontendId<Kind> {
	if (value.trim().length === 0) throw new Error(`${label} must be a non-empty string`);
	return value as FrontendId<Kind>;
}

export type FrontendLifecycleState =
	| "disconnected"
	| "connecting"
	| "negotiating"
	| "bootstrapping"
	| "replaying"
	| "live"
	| "resynchronizing"
	| "degraded"
	| "closed";

/** Legal state edges for one connector view. `closed` is terminal. */
export const FRONTEND_LIFECYCLE_TRANSITIONS = {
	disconnected: ["connecting", "closed"],
	connecting: ["negotiating", "disconnected", "degraded", "closed"],
	negotiating: ["bootstrapping", "replaying", "degraded", "disconnected", "closed"],
	bootstrapping: ["live", "resynchronizing", "degraded", "disconnected", "closed"],
	replaying: ["live", "resynchronizing", "degraded", "disconnected", "closed"],
	live: ["connecting", "resynchronizing", "degraded", "disconnected", "closed"],
	resynchronizing: ["negotiating", "bootstrapping", "replaying", "degraded", "disconnected", "closed"],
	degraded: ["connecting", "negotiating", "resynchronizing", "disconnected", "closed"],
	closed: [],
} as const satisfies Readonly<Record<FrontendLifecycleState, readonly FrontendLifecycleState[]>>;

export function isFrontendLifecycleTransition(from: FrontendLifecycleState, to: FrontendLifecycleState): boolean {
	return (FRONTEND_LIFECYCLE_TRANSITIONS[from] as readonly FrontendLifecycleState[]).includes(to);
}

export type FrontendCapability =
	| "workspace-pages"
	| "native-sandbox-setup"
	| "obsidian-vault-access"
	| "atomic-bootstrap-cutover"
	| "bounded-replay"
	| "typed-protocol-errors"
	| "revisioned-screen-cache"
	| "complete-feed-entities"
	| "session-clear"
	| "pagination-v2"
	| "intent-outcomes-v2";

/** Baseline protocol-v2 compatibility; additive features must not become required implicitly. */
export const CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES = [
	"atomic-bootstrap-cutover",
	"bounded-replay",
	"typed-protocol-errors",
	"revisioned-screen-cache",
	"complete-feed-entities",
	"session-clear",
	"pagination-v2",
	"intent-outcomes-v2",
] as const satisfies readonly FrontendCapability[];

/** Request these features, then use only the runtime's current negotiated selection. */
export const CHATOBBY_FRONTEND_OPTIONAL_CAPABILITIES = [
	"workspace-pages",
	"native-sandbox-setup",
	"obsidian-vault-access",
] as const satisfies readonly FrontendCapability[];

export interface FrontendUnavailableCapability {
	readonly capability: FrontendCapability;
	readonly reason: "not-requested" | "runtime-unavailable" | "connector-unsupported" | "requires-newer-protocol";
	readonly detail?: string;
}

export type FrontendProtocolErrorCode =
	| "malformed-envelope"
	| "malformed-entity"
	| "unsupported-protocol-version"
	| "unsupported-capability"
	| "sequence-gap"
	| "replay-too-old"
	| "future-sequence"
	| "runtime-replaced"
	| "revision-conflict"
	| "stale-screen-response"
	| "unauthorized-view"
	| "internal-failure";

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

export type FrontendScreenId =
	| "projects"
	| "memory"
	| "permissions"
	| "events"
	| "queries"
	| "channels"
	| "subagents"
	| "mcp";
export type FrontendIconToken =
	| "activity"
	| "agent"
	| "alert"
	| "archive"
	| "arrow-left-right"
	| "audio-lines"
	| "badge-alert"
	| "blocks"
	| "book-open"
	| "book-plus"
	| "book-up"
	| "brain"
	| "bot"
	| "calendar"
	| "calendar-clock"
	| "calendar-plus"
	| "calendar-x"
	| "captions"
	| "channel"
	| "check"
	| "clock"
	| "command"
	| "external-link"
	| "file"
	| "file-plus"
	| "file-text"
	| "folder"
	| "folder-kanban"
	| "folder-sync"
	| "git-branch"
	| "git-graph"
	| "globe"
	| "history"
	| "image"
	| "info"
	| "layout-panel-top"
	| "link"
	| "list"
	| "list-checks"
	| "memory"
	| "messages-square"
	| "paperclip"
	| "pencil"
	| "play"
	| "plug"
	| "search"
	| "square-terminal"
	| "send"
	| "shield"
	| "shield-check"
	| "shield-x"
	| "terminal"
	| "terminal-square"
	| "toggle-right"
	| "tool"
	| "trash-2"
	| "triangle-alert"
	| "unplug"
	| "users"
	| "user-round"
	| "video"
	| "workflow"
	| "wrench"
	| "x";

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
	readonly workspace:
		| { readonly kind: "vault"; readonly label: string }
		| { readonly kind: "project"; readonly projectId: string; readonly label: string };
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
	readonly forkOptions: readonly { readonly entryId: string; readonly label: string }[];
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

export type FrontendToolCategory =
	| "read"
	| "edit"
	| "write"
	| "list"
	| "search"
	| "link"
	| "move"
	| "trash"
	| "open"
	| "graph"
	| "task"
	| "workspace"
	| "command"
	| "import"
	| "bash"
	| "cli"
	| "subagent"
	| "metadata"
	| "git"
	| "capability"
	| "memory"
	| "skill"
	| "event"
	| "permission"
	| "channel"
	| "media"
	| "other";

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

export type FrontendFeedBlock =
	| {
			readonly type: "user" | "system";
			readonly id: string;
			readonly turnId?: string;
			readonly text: string;
			readonly images?: readonly { readonly data: string; readonly mimeType: string }[];
			readonly attachments?: readonly FrontendFeedAttachment[];
			readonly skillInvocations?: readonly FrontendFeedSkillInvocation[];
			readonly timestamp?: number;
	  }
	| {
			readonly type: "text" | "thinking";
			readonly id: string;
			readonly turnId: string;
			readonly text: string;
			readonly phase: "streaming" | "complete" | "compacted";
			readonly startedAt?: number;
			readonly durationMs?: number;
	  }
	| {
			readonly type: "tools";
			readonly id: string;
			readonly turnId: string;
			readonly phase: "streaming" | "complete" | "compacted";
			readonly items: readonly FrontendToolActivityViewModel[];
	  }
	| {
			readonly type: "summary";
			readonly id: string;
			readonly text: string;
			readonly durationMs?: number;
			readonly toolCounts: Readonly<Record<string, number>>;
			readonly blocks: readonly FrontendFeedBlock[];
	  }
	| {
			readonly type: "queued";
			readonly id: string;
			readonly queueKind: "steer" | "followUp";
			readonly text: string;
			readonly phase: "pending" | "queued" | "applied";
	  }
	| {
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
	  }
	| {
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
	  }
	| {
			readonly type: "message";
			readonly id: string;
			/** Complete canonical communication entity; adapters must not fill missing semantics. */
			readonly message: FrontendSubagentMessageViewModel;
			readonly navigation?: FrontendNavigationReference;
	  }
	| {
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
export type FrontendMemoryCategoryFilter =
	| "all"
	| "uncategorized"
	| "failure"
	| "correction"
	| "insight"
	| "preference"
	| "convention"
	| "tool-quirk";
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

export type FrontendMcpServerState =
	| "disabled"
	| "configured"
	| "connecting"
	| "discovering"
	| "needs-sign-in"
	| "ready"
	| "connected"
	| "updating"
	| "unavailable"
	| "incompatible";

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
	readonly localExecution?:
		| { readonly status: "available"; readonly mode: "unsandboxed" }
		| { readonly status: "unavailable"; readonly reason: string };
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

export type FrontendPermissionAuthority =
	| { readonly kind: "main"; readonly mainSessionId: string }
	| {
			readonly kind: "subagent";
			readonly mainSessionId: string;
			readonly runId: string;
			readonly nodeId: string;
	  }
	| {
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
	readonly rules: readonly { readonly pattern: string; readonly decision: FrontendPermissionDecision }[];
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

export type FrontendScreenViewModel =
	| FrontendProjectScreenViewModel
	| FrontendChannelScreenViewModel
	| FrontendMemoryScreenViewModel
	| FrontendContextQueryScreenViewModel
	| FrontendPermissionScreenViewModel
	| FrontendEventScreenViewModel
	| FrontendSubagentScreenViewModel
	| FrontendMcpScreenViewModel;

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
	readonly action:
		| "open-screen"
		| "compact"
		| "create-session"
		| "set-working-directory"
		| "resume-session"
		| "fork-session"
		| "clone-session"
		| "reload"
		| "abort"
		| "bash"
		| "set-model"
		| "set-thinking"
		| "export-html"
		| "export-jsonl"
		| "start-backend"
		| "stop-backend"
		| "send-raw-prompt";
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
export type FrontendScope = { readonly kind: "view"; readonly viewId: FrontendViewId };

export type FrontendPatchOperation =
	| { readonly type: "session.replace"; readonly session: FrontendSessionViewModel }
	| { readonly type: "session.clear" }
	| { readonly type: "task-plan.replace"; readonly taskPlan: FrontendTaskPlanViewModel }
	| { readonly type: "composer.replace"; readonly composer: FrontendComposerViewModel }
	| { readonly type: "agent-rail.replace"; readonly agentRail: FrontendAgentRailViewModel }
	| { readonly type: "local-commands.replace"; readonly localCommands: readonly FrontendLocalCommandViewModel[] }
	| { readonly type: "feed.document.replace"; readonly feed: FrontendFeedDocumentViewModel }
	| { readonly type: "feed.block.upsert"; readonly index: number; readonly block: FrontendFeedBlock }
	| { readonly type: "feed.block.remove"; readonly blockId: string }
	| { readonly type: "feed.text.append"; readonly blockId: string; readonly text: string }
	| { readonly type: "feed.turn.finalize"; readonly turnId: string; readonly completedAt: number }
	| { readonly type: "screen.replace"; readonly screen: FrontendScreenViewModel };

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

export type FrontendSubscriptionResult =
	| (FrontendSubscriptionBase & {
			readonly status: "bootstrapped";
			readonly bootstrap: FrontendBootstrap;
			readonly replay: readonly [];
	  })
	| (FrontendSubscriptionBase & {
			readonly status: "replayed";
			readonly baseSequence: number;
			readonly baseRevision: number;
			readonly replay: readonly FrontendPatch[];
	  })
	| (FrontendSubscriptionBase & {
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

export type FrontendIntent =
	| (FrontendIntentBase & {
			readonly type: "session.create";
			readonly payload: {
				readonly cwdOverride?: string;
				readonly workspace?: { readonly kind: "vault" } | { readonly kind: "project"; readonly projectId: string };
				readonly model?: string;
				readonly thinkingLevel?: ThinkingLevel;
				readonly permissionProfileId?: string | null;
				readonly autoNameStrategy?: "truncate" | "model";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "session.resume";
			readonly payload: {
				readonly sessionPath: string;
				readonly model?: string;
				readonly thinkingLevel?: ThinkingLevel;
				readonly permissionProfileId?: string | null;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "session.resume-by-id";
			readonly payload: { readonly sessionId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "session.change-workspace";
			readonly payload: {
				readonly target:
					| { readonly kind: "vault" }
					| {
							readonly kind: "project";
							readonly projectId: string;
							readonly activeRootId?: string;
							readonly sessionAttachedRootIds: readonly string[];
					  };
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "session.clone";
			readonly payload: Record<string, never>;
	  })
	| (FrontendIntentBase & {
			readonly type: "session.fork";
			readonly payload: { readonly entryId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "session.rename";
			readonly payload: { readonly name: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "session.import-jsonl";
			readonly payload: { readonly inputPath: string; readonly cwdOverride?: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "session.update-preferences";
			readonly payload: {
				readonly model?: string;
				readonly thinkingLevel?: ThinkingLevel;
				readonly permissionProfileId?: string | null;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "operator.set-view-open";
			readonly payload: { readonly open: boolean };
	  })
	| (FrontendIntentBase & FrontendProjectIntentBody)
	| (FrontendIntentBase & {
			readonly type: "channel.select";
			readonly payload: { readonly channelId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "channel.create";
			readonly payload: { readonly name: string; readonly description: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "channel.send";
			readonly payload: {
				readonly channelId: string;
				readonly text: string;
				readonly replyTo?: string;
				readonly recipientActorIds?: readonly string[];
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "channel.set-participant";
			readonly payload: {
				readonly channelId: string;
				readonly actorId: string;
				readonly action: "invite" | "disconnect";
				readonly expectedChannelRevision: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "channel.load-earlier";
			readonly payload: { readonly cursor: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "channel.set-archived";
			readonly payload: {
				readonly channelId: string;
				readonly archived: boolean;
				readonly expectedChannelRevision: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "channel.delete";
			readonly payload: {
				readonly channelId: string;
				readonly expectedChannelRevision: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.decide-candidate";
			readonly payload: { readonly candidateId: string; readonly decision: "approve" | "reject" };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagent.decide-permission";
			readonly payload: {
				readonly runId: string;
				readonly nodeId: string;
				readonly permissionRequestId: string;
				readonly expectedPermissionRequestRevision: number;
				readonly approved: boolean;
				readonly value?: string;
			};
	  })
	| (FrontendIntentBase & {
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
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.create";
			readonly payload: { readonly target: "user" | "memory" | "project" | "failure"; readonly content: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.update";
			readonly payload: {
				readonly recordId: string;
				readonly expectedRecordRevision: number;
				readonly content: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.set-status";
			readonly payload: {
				readonly recordId: string;
				readonly expectedRecordRevision: number;
				readonly status: "active" | "archived";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.delete";
			readonly payload: { readonly recordId: string; readonly expectedRecordRevision: number };
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.update-policy";
			readonly payload: {
				readonly expectedMemoryRevision: number;
				readonly backgroundLearning?: "off" | "suggest" | "auto";
				readonly correctionLearning?: "off" | "suggest" | "auto";
				readonly promptRouting?: "off" | "profile-project" | "hybrid";
				readonly projectBoundaryMode?: FrontendMemoryBoundaryMode;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.import-markdown" | "memory.export-markdown";
			readonly payload: Record<string, never>;
	  })
	| (FrontendIntentBase & {
			readonly type: "queries.save";
			readonly payload: {
				readonly queryId?: string;
				readonly expectedQueryRevision?: number;
				readonly name: string;
				readonly description: string;
				readonly trigger: "session_start" | "every_turn";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "queries.set-enabled";
			readonly payload: {
				readonly queryId: string;
				readonly expectedQueryRevision: number;
				readonly enabled: boolean;
				readonly confirmedTrustedCode: boolean;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "queries.delete" | "queries.test";
			readonly payload: { readonly queryId: string; readonly expectedQueryRevision: number };
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.set-view";
			readonly payload: {
				readonly tab: "installed" | "discover";
				readonly query: string;
				readonly cursor?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.save";
			readonly payload: {
				readonly expectedConfigRevision: string;
				readonly draft: FrontendMcpServerDraft;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.preview";
			readonly payload: { readonly draft: FrontendMcpServerDraft };
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.configure-verified";
			readonly payload: {
				readonly expectedConfigRevision: string;
				readonly pluginId: string;
				readonly scope: "user" | "project";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.set-enabled";
			readonly payload: {
				readonly expectedConfigRevision: string;
				readonly serverId: string;
				readonly enabled: boolean;
				readonly scope?: "user" | "project";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.set-credential-reference";
			readonly payload: {
				readonly expectedConfigRevision: string;
				readonly serverId: string;
				readonly reference: string;
				readonly scope?: "user" | "project";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.set-tool-enabled";
			readonly payload: {
				readonly expectedConfigRevision: string;
				readonly serverId: string;
				readonly toolName: string;
				readonly enabled: boolean;
				readonly scope?: "user" | "project";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.discover" | "mcp.connect" | "mcp.disconnect" | "mcp.auth-start" | "mcp.diagnostics";
			readonly payload: { readonly serverId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.auth-complete";
			readonly payload: { readonly serverId: string; readonly input: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "mcp.remove";
			readonly payload: {
				readonly expectedConfigRevision: string;
				readonly serverId: string;
				readonly scope?: "user" | "project";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-obsidian-vault-access";
			readonly payload: {
				readonly expectedRevision: number;
				readonly expectedSessionId: string;
				readonly expectedBindingRevision: number;
				readonly enabled: boolean;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-workspace-policy";
			readonly payload: FrontendWorkspacePolicyPayload;
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-workspace-vault-access";
			readonly payload: {
				readonly expectedRevision: number;
				readonly projectId: string | null;
				readonly expectedProjectRevision?: number;
				readonly enabled: boolean;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.setup-native-sandbox";
			readonly payload: FrontendSandboxSetupPayload;
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.verify-native-sandbox";
			readonly payload: FrontendSandboxVerifyPayload;
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.revoke-native-sandbox";
			readonly payload: FrontendSandboxRevokePayload;
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-access-policy";
			readonly mainSessionId: string;
			readonly payload: {
				readonly expectedRevision: number;
				readonly accessMode: "read-only" | "workspace" | "full";
				readonly agentNetworkAccess: boolean;
				readonly requestBehavior?: FrontendPermissionRequestBehavior;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.select-profile";
			readonly payload: { readonly profileId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.activate-profile" | "permissions.duplicate-profile";
			readonly payload: FrontendPermissionRevisionPayload & { readonly profileId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.delete-profile";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly replacementProfileId?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-live-agent-profile";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly authority: FrontendPermissionAuthority;
				readonly profileId: string;
				readonly expectedBindingRevision: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.update-profile";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly name: string;
				readonly description: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-capability";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly capabilityId: string;
				readonly decision: FrontendPermissionDecision;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-target";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly keys: readonly string[];
				readonly decision: FrontendPermissionDecision;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-rule";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly section: string;
				readonly pattern: string;
				readonly decision: FrontendPermissionDecision;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.remove-rule";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly section: string;
				readonly pattern: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.add-channel" | "permissions.remove-channel";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly channelId: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "permissions.set-channel";
			readonly payload: FrontendPermissionRevisionPayload & {
				readonly profileId: string;
				readonly channelId: string;
				readonly action: "connect" | "read" | "send";
				readonly decision: FrontendPermissionDecision;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "events.begin-edit";
			readonly payload: { readonly definitionId?: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "events.cancel-edit";
			readonly payload: Record<string, never>;
	  })
	| (FrontendIntentBase & {
			readonly type: "events.set-editor-project";
			readonly payload: { readonly projectPath: string };
	  })
	| (FrontendIntentBase & {
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
	  })
	| (FrontendIntentBase & {
			readonly type: "events.delete" | "events.set-enabled";
			readonly payload: {
				readonly definitionId: string;
				readonly expectedDefinitionRevision: number;
				readonly enabled?: boolean;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "events.trigger";
			readonly payload: { readonly definitionId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "events.approve";
			readonly payload: { readonly occurrenceId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.set-role-scope";
			readonly payload: { readonly scopeId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.refresh" | "subagents.load-more" | "subagents.delete-session";
			readonly payload: Record<string, never>;
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.filter-runs";
			readonly payload: { readonly query: FrontendSubagentRunFilter };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.select-run";
			readonly payload: { readonly runId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.select-node" | "subagents.load-earlier-transcript";
			readonly payload: { readonly runId: string; readonly nodeId: string };
	  })
	| (FrontendIntentBase & {
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
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.control";
			readonly payload: {
				readonly runId: string;
				readonly nodeId?: string;
				readonly action: FrontendSubagentControlAction;
				readonly message?: string;
				readonly priority?: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.send-message";
			readonly payload: {
				readonly runId: string;
				readonly nodeId?: string;
				readonly text: string;
				readonly kind: "inform" | "steer";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.acknowledge-message";
			readonly payload: { readonly messageId: string; readonly text?: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.decide-acceptance";
			readonly payload: {
				readonly runId: string;
				readonly nodeId: string;
				readonly approved: boolean;
				readonly note?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.promote-artifact";
			readonly payload: {
				readonly artifactId: string;
				readonly expectedArtifactRevision: number;
				readonly targetVaultPath: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.save-definition";
			readonly payload: {
				readonly definition: FrontendSubagentUserAgentDefinition;
				readonly permissionProfileId: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.delete-definition";
			readonly payload: {
				readonly definitionId: string;
				readonly scope: FrontendSubagentUserDefinitionScope;
				readonly scopeId: string;
				readonly expectedDefinitionRevision: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.update-settings";
			readonly payload: { readonly settings: FrontendSubagentSettingsViewModel };
	  });

interface FrontendIntentOutcomeBase {
	readonly schemaVersion: typeof CHATOBBY_FRONTEND_SCHEMA_VERSION;
	readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
	readonly runtimeInstanceId: FrontendRuntimeInstanceId;
	readonly viewId: FrontendViewId;
	readonly intentId: FrontendIntentId;
}

export type FrontendIntentResult =
	| (FrontendIntentOutcomeBase & {
			readonly status: "applied";
			readonly revision: number;
			readonly notice?: FrontendNotice;
	  })
	| (FrontendIntentOutcomeBase & {
			readonly status: "accepted";
			readonly acceptedAtSequence: number;
			readonly notice?: FrontendNotice;
	  })
	| (FrontendIntentOutcomeBase & {
			readonly status: "rejected";
			readonly errorCode: string;
			readonly fieldErrors?: Readonly<Record<string, string>>;
			readonly notice: FrontendNotice;
	  })
	| (FrontendIntentOutcomeBase & {
			readonly status: "conflict";
			readonly expectedRevision?: number;
			readonly actualRevision: number;
			readonly notice: FrontendNotice;
	  })
	| (FrontendIntentOutcomeBase & {
			readonly status: "unavailable";
			readonly capability: FrontendCapability;
			readonly notice: FrontendNotice;
	  });

export interface FrontendNotice {
	readonly level: "info" | "warning" | "error";
	readonly message: string;
}

export function parseFrontendNegotiationRequest(value: unknown): FrontendNegotiationRequest {
	const input = requireRecord(value, "frontend negotiation request");
	requireSchemaVersion(input);
	const supportedProtocolVersions = requireNumberArray(input.supportedProtocolVersions, "supportedProtocolVersions");
	if (!supportedProtocolVersions.includes(CHATOBBY_FRONTEND_PROTOCOL_VERSION)) {
		throw new Error(`Frontend protocol ${CHATOBBY_FRONTEND_PROTOCOL_VERSION} is not supported by this connector`);
	}
	const capabilities = requireRecord(input.capabilities, "capabilities");
	return {
		schemaVersion: 1,
		surface:
			input.surface === undefined
				? undefined
				: requireEnumValue(input.surface, "surface", ["conversation", "workspace"]),
		requestId: frontendId(requireString(input.requestId, "requestId"), "requestId"),
		connectorVersion: requireString(input.connectorVersion, "connectorVersion"),
		obsidianVersion: requireString(input.obsidianVersion, "obsidianVersion"),
		vaultInstanceId: frontendId(requireString(input.vaultInstanceId, "vaultInstanceId"), "vaultInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		supportedProtocolVersions,
		capabilities: {
			featureFamilies: requireStringArray(capabilities.featureFamilies, "capabilities.featureFamilies"),
			protocolCapabilities: requireArray(capabilities.protocolCapabilities, "capabilities.protocolCapabilities").map(
				(entry, index) => requireFrontendCapability(entry, `capabilities.protocolCapabilities[${index}]`),
			),
			integrations: requireArray(capabilities.integrations, "capabilities.integrations").map((entry, index) => {
				const integration = requireRecord(entry, `capabilities.integrations[${index}]`);
				return {
					id: requireString(integration.id, `capabilities.integrations[${index}].id`),
					name: requireString(integration.name, `capabilities.integrations[${index}].name`),
					installed: requireBoolean(integration.installed, `capabilities.integrations[${index}].installed`),
					enabled: requireBoolean(integration.enabled, `capabilities.integrations[${index}].enabled`),
				};
			}),
		},
	};
}

/** @deprecated Use parseFrontendNegotiationRequest. */
export const parseFrontendBootstrapRequest = parseFrontendNegotiationRequest;

export function parseFrontendSubscriptionRequest(value: unknown): FrontendSubscriptionRequest {
	const input = requireRecord(value, "frontend subscription request");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const resume = input.resume === undefined ? undefined : requireRecord(input.resume, "resume");
	return {
		schemaVersion: 1,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		requestId: frontendId(requireString(input.requestId, "requestId"), "requestId"),
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		resume:
			resume === undefined
				? undefined
				: {
						afterSequence: requireSafeInteger(resume.afterSequence, "resume.afterSequence"),
						revision: requireSafeInteger(resume.revision, "resume.revision"),
					},
	};
}

export function parseFrontendIntent(value: unknown): FrontendIntent {
	const input = requireRecord(value, "frontend intent");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const expectedRevision = optionalSafeInteger(input.expectedRevision, "expectedRevision");
	const base = {
		schemaVersion: 1 as const,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		intentId: frontendId(requireString(input.intentId, "intentId"), "intentId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		mainSessionId: optionalString(input.mainSessionId, "mainSessionId"),
		expectedRevision,
	} as const;
	const payload = requireRecord(input.payload, "payload");
	if (input.type === "channel.create")
		return {
			...base,
			type: input.type,
			payload: {
				name: requireString(payload.name, "payload.name"),
				description: requireTextValue(payload.description, "payload.description"),
			},
		};
	if (input.type === "channel.send")
		return {
			...base,
			type: input.type,
			payload: {
				channelId: requireString(payload.channelId, "payload.channelId"),
				text: requireString(payload.text, "payload.text"),
				replyTo: optionalString(payload.replyTo, "payload.replyTo"),
				recipientActorIds:
					payload.recipientActorIds === undefined
						? undefined
						: requireStringArray(payload.recipientActorIds, "payload.recipientActorIds"),
			},
		};
	if (input.type === "channel.set-participant")
		return {
			...base,
			type: input.type,
			payload: {
				channelId: requireString(payload.channelId, "payload.channelId"),
				actorId: requireString(payload.actorId, "payload.actorId"),
				action: requireEnumValue(payload.action, "payload.action", ["invite", "disconnect"]),
				expectedChannelRevision: requireSafeInteger(
					payload.expectedChannelRevision,
					"payload.expectedChannelRevision",
				),
			},
		};
	if (input.type === "channel.select") {
		return {
			...base,
			type: input.type,
			payload: { channelId: requireString(payload.channelId, "payload.channelId") },
		};
	}
	if (input.type === "channel.load-earlier") {
		return { ...base, type: input.type, payload: { cursor: requireString(payload.cursor, "payload.cursor") } };
	}
	if (input.type === "channel.set-archived") {
		return {
			...base,
			type: input.type,
			payload: {
				channelId: requireString(payload.channelId, "payload.channelId"),
				archived: requireBoolean(payload.archived, "payload.archived"),
				expectedChannelRevision: requireSafeInteger(
					payload.expectedChannelRevision,
					"payload.expectedChannelRevision",
				),
			},
		};
	}
	if (input.type === "channel.delete") {
		return {
			...base,
			type: input.type,
			payload: {
				channelId: requireString(payload.channelId, "payload.channelId"),
				expectedChannelRevision: requireSafeInteger(
					payload.expectedChannelRevision,
					"payload.expectedChannelRevision",
				),
			},
		};
	}
	if (input.type === "memory.decide-candidate") {
		if (payload.decision !== "approve" && payload.decision !== "reject")
			throw new Error("payload.decision is invalid");
		return {
			...base,
			type: input.type,
			payload: {
				candidateId: requireString(payload.candidateId, "payload.candidateId"),
				decision: payload.decision,
			},
		};
	}
	if (input.type === "subagent.decide-permission") {
		return {
			...base,
			type: input.type,
			payload: {
				runId: requireString(payload.runId, "payload.runId"),
				nodeId: requireString(payload.nodeId, "payload.nodeId"),
				permissionRequestId: requireString(payload.permissionRequestId, "payload.permissionRequestId"),
				expectedPermissionRequestRevision: requireSafeInteger(
					payload.expectedPermissionRequestRevision,
					"payload.expectedPermissionRequestRevision",
				),
				approved: requireBoolean(payload.approved, "payload.approved"),
				value: optionalString(payload.value, "payload.value"),
			},
		};
	}
	if (input.type === "memory.set-view") {
		return {
			...base,
			type: input.type,
			payload: {
				browseProjectId:
					payload.browseProjectId === null
						? null
						: optionalString(payload.browseProjectId, "payload.browseProjectId"),
				scopeFilter: requireMemoryScopeFilter(payload.scopeFilter),
				collection: requireMemoryCollectionFilter(payload.collection),
				status: requireMemoryStatusFilter(payload.status),
				query: typeof payload.query === "string" ? payload.query : "",
				lessonCategory: requireMemoryCategoryFilter(payload.lessonCategory),
				sort: requireMemorySort(payload.sort),
			},
		};
	}
	if (input.type === "memory.create") {
		const target = requireString(payload.target, "payload.target");
		if (target !== "user" && target !== "memory" && target !== "project" && target !== "failure") {
			throw new Error("payload.target is invalid");
		}
		return {
			...base,
			type: input.type,
			payload: { target, content: requireString(payload.content, "payload.content") },
		};
	}
	if (input.type === "memory.update") {
		return {
			...base,
			type: input.type,
			payload: {
				recordId: requireString(payload.recordId, "payload.recordId"),
				expectedRecordRevision: requireSafeInteger(
					payload.expectedRecordRevision,
					"payload.expectedRecordRevision",
				),
				content: requireString(payload.content, "payload.content"),
			},
		};
	}
	if (input.type === "memory.set-status") {
		if (payload.status !== "active" && payload.status !== "archived") throw new Error("payload.status is invalid");
		return {
			...base,
			type: input.type,
			payload: {
				recordId: requireString(payload.recordId, "payload.recordId"),
				expectedRecordRevision: requireSafeInteger(
					payload.expectedRecordRevision,
					"payload.expectedRecordRevision",
				),
				status: payload.status,
			},
		};
	}
	if (input.type === "memory.delete") {
		return {
			...base,
			type: input.type,
			payload: {
				recordId: requireString(payload.recordId, "payload.recordId"),
				expectedRecordRevision: requireSafeInteger(
					payload.expectedRecordRevision,
					"payload.expectedRecordRevision",
				),
			},
		};
	}
	if (input.type === "memory.update-policy") {
		return { ...base, type: input.type, payload: parseMemoryPolicyPatch(payload) };
	}
	if (input.type === "memory.import-markdown" || input.type === "memory.export-markdown") {
		return { ...base, type: input.type, payload: {} };
	}
	if (input.type === "queries.save") {
		const trigger = requireString(payload.trigger, "payload.trigger");
		if (trigger !== "session_start" && trigger !== "every_turn") throw new Error("payload.trigger is invalid");
		return {
			...base,
			type: input.type,
			payload: {
				queryId: optionalString(payload.queryId, "payload.queryId"),
				expectedQueryRevision: optionalSafeInteger(payload.expectedQueryRevision, "payload.expectedQueryRevision"),
				name: requireString(payload.name, "payload.name"),
				description: optionalText(payload.description, "payload.description"),
				trigger,
			},
		};
	}
	if (input.type === "queries.set-enabled") {
		return {
			...base,
			type: input.type,
			payload: {
				queryId: requireString(payload.queryId, "payload.queryId"),
				expectedQueryRevision: requireSafeInteger(payload.expectedQueryRevision, "payload.expectedQueryRevision"),
				enabled: requireBoolean(payload.enabled, "payload.enabled"),
				confirmedTrustedCode: requireBoolean(payload.confirmedTrustedCode, "payload.confirmedTrustedCode"),
			},
		};
	}
	if (input.type === "queries.delete" || input.type === "queries.test") {
		return {
			...base,
			type: input.type,
			payload: {
				queryId: requireString(payload.queryId, "payload.queryId"),
				expectedQueryRevision: requireSafeInteger(payload.expectedQueryRevision, "payload.expectedQueryRevision"),
			},
		};
	}
	if (input.type === "mcp.set-view") {
		const tab = requireString(payload.tab, "payload.tab");
		if (tab !== "installed" && tab !== "discover") throw new Error("payload.tab is invalid");
		return {
			...base,
			type: input.type,
			payload: {
				tab,
				query: optionalText(payload.query, "payload.query"),
				cursor: optionalString(payload.cursor, "payload.cursor"),
			},
		};
	}
	if (input.type === "mcp.save") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedConfigRevision: requireString(payload.expectedConfigRevision, "payload.expectedConfigRevision"),
				draft: parseMcpServerDraft(payload.draft),
			},
		};
	}
	if (input.type === "mcp.preview") {
		return {
			...base,
			type: input.type,
			payload: { draft: parseMcpServerDraft(payload.draft) },
		};
	}
	if (input.type === "mcp.configure-verified") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedConfigRevision: requireString(payload.expectedConfigRevision, "payload.expectedConfigRevision"),
				pluginId: requireString(payload.pluginId, "payload.pluginId"),
				scope: requireMcpScope(payload.scope),
			},
		};
	}
	if (input.type === "mcp.set-enabled") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedConfigRevision: requireString(payload.expectedConfigRevision, "payload.expectedConfigRevision"),
				serverId: requireString(payload.serverId, "payload.serverId"),
				enabled: requireBoolean(payload.enabled, "payload.enabled"),
				scope: payload.scope === undefined ? undefined : requireMcpScope(payload.scope),
			},
		};
	}
	if (input.type === "mcp.set-credential-reference") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedConfigRevision: requireString(payload.expectedConfigRevision, "payload.expectedConfigRevision"),
				serverId: requireString(payload.serverId, "payload.serverId"),
				reference: requireString(payload.reference, "payload.reference"),
				scope: payload.scope === undefined ? undefined : requireMcpScope(payload.scope),
			},
		};
	}
	if (input.type === "mcp.set-tool-enabled") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedConfigRevision: requireString(payload.expectedConfigRevision, "payload.expectedConfigRevision"),
				serverId: requireString(payload.serverId, "payload.serverId"),
				toolName: requireString(payload.toolName, "payload.toolName"),
				enabled: requireBoolean(payload.enabled, "payload.enabled"),
				scope: payload.scope === undefined ? undefined : requireMcpScope(payload.scope),
			},
		};
	}
	if (
		input.type === "mcp.discover" ||
		input.type === "mcp.connect" ||
		input.type === "mcp.disconnect" ||
		input.type === "mcp.auth-start" ||
		input.type === "mcp.diagnostics"
	) {
		return {
			...base,
			type: input.type,
			payload: { serverId: requireString(payload.serverId, "payload.serverId") },
		};
	}
	if (input.type === "mcp.auth-complete") {
		return {
			...base,
			type: input.type,
			payload: {
				serverId: requireString(payload.serverId, "payload.serverId"),
				input: requireString(payload.input, "payload.input"),
			},
		};
	}
	if (input.type === "mcp.remove") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedConfigRevision: requireString(payload.expectedConfigRevision, "payload.expectedConfigRevision"),
				serverId: requireString(payload.serverId, "payload.serverId"),
				scope: payload.scope === undefined ? undefined : requireMcpScope(payload.scope),
			},
		};
	}
	if (input.type === "permissions.set-obsidian-vault-access") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedRevision: requireSafeInteger(payload.expectedRevision, "payload.expectedRevision"),
				expectedSessionId: requireString(payload.expectedSessionId, "payload.expectedSessionId"),
				expectedBindingRevision: requireSafeInteger(
					payload.expectedBindingRevision,
					"payload.expectedBindingRevision",
				),
				enabled: requireBoolean(payload.enabled, "payload.enabled"),
			},
		};
	}
	if (input.type === "permissions.set-workspace-policy")
		return { ...base, type: input.type, payload: parseFrontendWorkspacePolicyPayload(payload) };
	if (input.type === "permissions.set-workspace-vault-access") {
		return {
			...base,
			type: input.type,
			payload: {
				expectedRevision: requireSafeInteger(payload.expectedRevision, "payload.expectedRevision"),
				projectId: payload.projectId === null ? null : requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision:
					payload.projectId === null
						? undefined
						: requireSafeInteger(payload.expectedProjectRevision, "payload.expectedProjectRevision"),
				enabled: requireBoolean(payload.enabled, "payload.enabled"),
			},
		};
	}
	if (input.type === "permissions.setup-native-sandbox")
		return { ...base, type: input.type, payload: parseFrontendSandboxSetupPayload(payload) };
	if (input.type === "permissions.verify-native-sandbox")
		return { ...base, type: input.type, payload: parseFrontendSandboxVerifyPayload(payload) };
	if (input.type === "permissions.revoke-native-sandbox")
		return { ...base, type: input.type, payload: parseFrontendSandboxRevokePayload(payload) };
	if (input.type === "permissions.set-access-policy") {
		const accessMode = requireEnumValue(payload.accessMode, "payload.accessMode", ["read-only", "workspace", "full"]);
		const agentNetworkAccess = requireBoolean(payload.agentNetworkAccess, "payload.agentNetworkAccess");
		if (accessMode === "full" && !agentNetworkAccess) {
			throw new Error("Full access includes agent network access.");
		}
		return {
			...base,
			type: input.type,
			mainSessionId: requireString(input.mainSessionId, "mainSessionId"),
			payload: {
				expectedRevision: requireSafeInteger(payload.expectedRevision, "payload.expectedRevision"),
				accessMode,
				agentNetworkAccess,
				...(payload.requestBehavior !== undefined
					? { requestBehavior: parseFrontendRequestBehavior(payload.requestBehavior) }
					: {}),
			},
		};
	}
	if (input.type === "permissions.select-profile") {
		return {
			...base,
			type: input.type,
			payload: { profileId: requireString(payload.profileId, "payload.profileId") },
		};
	}
	if (input.type === "permissions.activate-profile" || input.type === "permissions.duplicate-profile") {
		return {
			...base,
			type: input.type,
			payload: {
				profileId: requireString(payload.profileId, "payload.profileId"),
				expectedProfileRevision: permissionProfileRevision(payload),
			},
		};
	}
	if (input.type === "permissions.delete-profile") {
		return {
			...base,
			type: input.type,
			payload: {
				profileId: requireString(payload.profileId, "payload.profileId"),
				replacementProfileId: optionalString(payload.replacementProfileId, "payload.replacementProfileId"),
				expectedProfileRevision: permissionProfileRevision(payload),
			},
		};
	}
	if (input.type === "permissions.set-live-agent-profile") {
		return {
			...base,
			type: input.type,
			payload: {
				authority: requirePermissionAuthority(payload.authority),
				profileId: requireString(payload.profileId, "payload.profileId"),
				expectedBindingRevision: requireSafeInteger(
					payload.expectedBindingRevision,
					"payload.expectedBindingRevision",
				),
				expectedProfileRevision: permissionProfileRevision(payload),
			},
		};
	}
	if (input.type === "permissions.update-profile") {
		return {
			...base,
			type: input.type,
			payload: {
				profileId: requireString(payload.profileId, "payload.profileId"),
				expectedProfileRevision: permissionProfileRevision(payload),
				name: requireString(payload.name, "payload.name"),
				description: typeof payload.description === "string" ? payload.description : "",
			},
		};
	}
	if (input.type === "permissions.set-capability") {
		return {
			...base,
			type: input.type,
			payload: {
				profileId: requireString(payload.profileId, "payload.profileId"),
				expectedProfileRevision: permissionProfileRevision(payload),
				capabilityId: requireString(payload.capabilityId, "payload.capabilityId"),
				decision: requirePermissionDecision(payload.decision),
			},
		};
	}
	if (input.type === "permissions.set-target") {
		return {
			...base,
			type: input.type,
			payload: {
				profileId: requireString(payload.profileId, "payload.profileId"),
				expectedProfileRevision: permissionProfileRevision(payload),
				keys: requireStringArray(payload.keys, "payload.keys"),
				decision: requirePermissionDecision(payload.decision),
			},
		};
	}
	if (input.type === "permissions.set-rule" || input.type === "permissions.remove-rule") {
		const common = {
			profileId: requireString(payload.profileId, "payload.profileId"),
			expectedProfileRevision: permissionProfileRevision(payload),
			section: requirePermissionRuleSection(payload.section),
			pattern: requireString(payload.pattern, "payload.pattern"),
		};
		return input.type === "permissions.set-rule"
			? { ...base, type: input.type, payload: { ...common, decision: requirePermissionDecision(payload.decision) } }
			: { ...base, type: input.type, payload: common };
	}
	if (input.type === "permissions.add-channel" || input.type === "permissions.remove-channel") {
		return {
			...base,
			type: input.type,
			payload: {
				profileId: requireString(payload.profileId, "payload.profileId"),
				expectedProfileRevision: permissionProfileRevision(payload),
				channelId: requireString(payload.channelId, "payload.channelId"),
			},
		};
	}
	if (input.type === "permissions.set-channel") {
		const action = requireString(payload.action, "payload.action");
		if (action !== "connect" && action !== "read" && action !== "send") throw new Error("payload.action is invalid");
		return {
			...base,
			type: input.type,
			payload: {
				profileId: requireString(payload.profileId, "payload.profileId"),
				expectedProfileRevision: permissionProfileRevision(payload),
				channelId: requireString(payload.channelId, "payload.channelId"),
				action,
				decision: requirePermissionDecision(payload.decision),
			},
		};
	}
	if (input.type === "events.begin-edit") {
		return {
			...base,
			type: input.type,
			payload: { definitionId: optionalString(payload.definitionId, "payload.definitionId") },
		};
	}
	if (input.type === "events.cancel-edit") return { ...base, type: input.type, payload: {} };
	if (input.type === "events.set-editor-project") {
		return {
			...base,
			type: input.type,
			payload: { projectPath: optionalText(payload.projectPath, "payload.projectPath") },
		};
	}
	if (input.type === "events.save") {
		const triggerKind = requireString(payload.triggerKind, "payload.triggerKind");
		if (triggerKind !== "schedule" && triggerKind !== "filesystem" && triggerKind !== "command") {
			throw new Error("payload.triggerKind is invalid");
		}
		const scheduleRepeat = requireString(payload.scheduleRepeat, "payload.scheduleRepeat");
		if (
			scheduleRepeat !== "none" &&
			scheduleRepeat !== "daily" &&
			scheduleRepeat !== "weekly" &&
			scheduleRepeat !== "monthly" &&
			scheduleRepeat !== "yearly"
		) {
			throw new Error("payload.scheduleRepeat is invalid");
		}
		const scheduleEnd = requireString(payload.scheduleEnd, "payload.scheduleEnd");
		if (scheduleEnd !== "never" && scheduleEnd !== "on" && scheduleEnd !== "after") {
			throw new Error("payload.scheduleEnd is invalid");
		}
		return {
			...base,
			type: input.type,
			payload: {
				definitionId: optionalString(payload.definitionId, "payload.definitionId"),
				expectedDefinitionRevision: optionalSafeInteger(
					payload.expectedDefinitionRevision,
					"payload.expectedDefinitionRevision",
				),
				name: requireString(payload.name, "payload.name"),
				description: optionalText(payload.description, "payload.description"),
				projectPath: optionalText(payload.projectPath, "payload.projectPath"),
				permissionProfileId: requireString(payload.permissionProfileId, "payload.permissionProfileId"),
				agentId: requireString(payload.agentId, "payload.agentId"),
				enabled: requireBoolean(payload.enabled, "payload.enabled"),
				triggerKind,
				triggerValue: requireString(payload.triggerValue, "payload.triggerValue"),
				scheduleStartAt: requireString(payload.scheduleStartAt, "payload.scheduleStartAt"),
				scheduleRepeat,
				scheduleInterval: requireSafeInteger(payload.scheduleInterval, "payload.scheduleInterval"),
				scheduleWeekdays: requireNumberArray(payload.scheduleWeekdays, "payload.scheduleWeekdays"),
				scheduleEnd,
				scheduleEndDate: requireString(payload.scheduleEndDate, "payload.scheduleEndDate"),
				scheduleEndOccurrences: requireSafeInteger(
					payload.scheduleEndOccurrences,
					"payload.scheduleEndOccurrences",
				),
				triggerRecursive: requireBoolean(payload.triggerRecursive, "payload.triggerRecursive"),
				triggerDebounceMs: requireSafeInteger(payload.triggerDebounceMs, "payload.triggerDebounceMs"),
				prompt: requireString(payload.prompt, "payload.prompt"),
				requireApproval: requireBoolean(payload.requireApproval, "payload.requireApproval"),
				allowWhenViewClosed: requireBoolean(payload.allowWhenViewClosed, "payload.allowWhenViewClosed"),
				backgroundConsent: requireBoolean(payload.backgroundConsent, "payload.backgroundConsent"),
				maxRunsPerDay: requireSafeInteger(payload.maxRunsPerDay, "payload.maxRunsPerDay"),
				maxRuntimeMinutes: requireSafeInteger(payload.maxRuntimeMinutes, "payload.maxRuntimeMinutes"),
			},
		};
	}
	if (input.type === "events.delete" || input.type === "events.set-enabled") {
		const common = {
			definitionId: requireString(payload.definitionId, "payload.definitionId"),
			expectedDefinitionRevision: requireSafeInteger(
				payload.expectedDefinitionRevision,
				"payload.expectedDefinitionRevision",
			),
		};
		return input.type === "events.set-enabled"
			? {
					...base,
					type: input.type,
					payload: { ...common, enabled: requireBoolean(payload.enabled, "payload.enabled") },
				}
			: { ...base, type: input.type, payload: common };
	}
	if (input.type === "events.trigger") {
		return {
			...base,
			type: input.type,
			payload: { definitionId: requireString(payload.definitionId, "payload.definitionId") },
		};
	}
	if (input.type === "events.approve") {
		return {
			...base,
			type: input.type,
			payload: { occurrenceId: requireString(payload.occurrenceId, "payload.occurrenceId") },
		};
	}
	if (input.type === "subagents.set-role-scope")
		return { ...base, type: input.type, payload: { scopeId: requireString(payload.scopeId, "payload.scopeId") } };
	if (
		input.type === "subagents.refresh" ||
		input.type === "subagents.load-more" ||
		input.type === "subagents.delete-session"
	) {
		return { ...base, type: input.type, payload: {} };
	}
	if (input.type === "subagents.filter-runs") {
		return { ...base, type: input.type, payload: { query: parseSubagentRunQuery(payload.query) } };
	}
	if (input.type === "subagents.select-run") {
		return { ...base, type: input.type, payload: { runId: requireString(payload.runId, "payload.runId") } };
	}
	if (input.type === "subagents.select-node" || input.type === "subagents.load-earlier-transcript") {
		return {
			...base,
			type: input.type,
			payload: {
				runId: requireString(payload.runId, "payload.runId"),
				nodeId: requireString(payload.nodeId, "payload.nodeId"),
			},
		};
	}
	if (input.type === "subagents.start-run") {
		const executionMode = requireString(payload.executionMode, "payload.executionMode");
		if (executionMode !== "auto" && executionMode !== "in-process" && executionMode !== "worker-process") {
			throw new Error("payload.executionMode is invalid");
		}
		const contextMode = requireString(payload.contextMode, "payload.contextMode");
		if (contextMode !== "fresh" && contextMode !== "fork") {
			throw new Error("payload.contextMode is invalid");
		}
		const workspaceMode = requireString(payload.workspaceMode, "payload.workspaceMode");
		if (workspaceMode !== "shared" && workspaceMode !== "worktree")
			throw new Error("payload.workspaceMode is invalid");
		return {
			...base,
			type: input.type,
			payload: {
				description: requireString(payload.description, "payload.description"),
				task: requireString(payload.task, "payload.task"),
				agentId: requireString(payload.agentId, "payload.agentId"),
				executionMode,
				contextMode,
				workspaceMode,
				permissionProfileId: optionalString(payload.permissionProfileId, "payload.permissionProfileId"),
				priority: requireSafeInteger(payload.priority, "payload.priority"),
				maxTurns: optionalSafeInteger(payload.maxTurns, "payload.maxTurns"),
				maxTokens: optionalSafeInteger(payload.maxTokens, "payload.maxTokens"),
				maxWallTimeMs: optionalSafeInteger(payload.maxWallTimeMs, "payload.maxWallTimeMs"),
			},
		};
	}
	if (input.type === "subagents.control") {
		return {
			...base,
			type: input.type,
			payload: {
				runId: requireString(payload.runId, "payload.runId"),
				nodeId: optionalString(payload.nodeId, "payload.nodeId"),
				action: requireSubagentControlAction(payload.action),
				message: optionalString(payload.message, "payload.message"),
				priority: optionalSafeInteger(payload.priority, "payload.priority"),
			},
		};
	}
	if (input.type === "subagents.send-message") {
		const kind = requireString(payload.kind, "payload.kind");
		if (kind !== "inform" && kind !== "steer") throw new Error("payload.kind is invalid");
		return {
			...base,
			type: input.type,
			payload: {
				runId: requireString(payload.runId, "payload.runId"),
				nodeId: optionalString(payload.nodeId, "payload.nodeId"),
				text: requireString(payload.text, "payload.text"),
				kind,
			},
		};
	}
	if (input.type === "subagents.acknowledge-message") {
		return {
			...base,
			type: input.type,
			payload: {
				messageId: requireString(payload.messageId, "payload.messageId"),
				text: optionalString(payload.text, "payload.text"),
			},
		};
	}
	if (input.type === "subagents.decide-acceptance") {
		return {
			...base,
			type: input.type,
			payload: {
				runId: requireString(payload.runId, "payload.runId"),
				nodeId: requireString(payload.nodeId, "payload.nodeId"),
				approved: requireBoolean(payload.approved, "payload.approved"),
				note: optionalString(payload.note, "payload.note"),
			},
		};
	}
	if (input.type === "subagents.promote-artifact") {
		return {
			...base,
			type: input.type,
			payload: {
				artifactId: requireString(payload.artifactId, "payload.artifactId"),
				expectedArtifactRevision: requireSafeInteger(
					payload.expectedArtifactRevision,
					"payload.expectedArtifactRevision",
				),
				targetVaultPath: requireString(payload.targetVaultPath, "payload.targetVaultPath"),
			},
		};
	}
	if (input.type === "subagents.save-definition") {
		const permissionProfileId = requireString(payload.permissionProfileId, "payload.permissionProfileId");
		const definition = parseUserAgentDefinition(payload.definition);
		return {
			...base,
			type: input.type,
			payload: { definition, permissionProfileId },
		};
	}
	if (input.type === "subagents.delete-definition") {
		return {
			...base,
			type: input.type,
			payload: {
				definitionId: requireString(payload.definitionId, "payload.definitionId"),
				scope: requireUserDefinitionScope(payload.scope),
				scopeId: requireString(payload.scopeId, "payload.scopeId"),
				expectedDefinitionRevision: requireSafeInteger(
					payload.expectedDefinitionRevision,
					"payload.expectedDefinitionRevision",
				),
			},
		};
	}
	if (input.type === "subagents.update-settings") {
		return { ...base, type: input.type, payload: { settings: parseResolvedSubagentSettings(payload.settings) } };
	}
	const projectIntent = parseFrontendProjectIntentBody(input, payload);
	if (projectIntent !== undefined) return { ...base, ...projectIntent };
	if (input.type === "operator.set-view-open") {
		return { ...base, type: input.type, payload: { open: requireBoolean(payload.open, "payload.open") } };
	}
	if (input.type === "session.create") {
		const workspaceRecord =
			payload.workspace === undefined ? undefined : requireRecord(payload.workspace, "payload.workspace");
		const workspace =
			workspaceRecord === undefined
				? undefined
				: workspaceRecord.kind === "vault"
					? ({ kind: "vault" } as const)
					: workspaceRecord.kind === "project"
						? {
								kind: "project" as const,
								projectId: requireString(workspaceRecord.projectId, "payload.workspace.projectId"),
							}
						: (() => {
								throw new Error("payload.workspace.kind is invalid");
							})();
		return {
			...base,
			type: input.type,
			payload: {
				cwdOverride: optionalString(payload.cwdOverride, "payload.cwdOverride"),
				workspace,
				model: optionalString(payload.model, "payload.model"),
				thinkingLevel: optionalThinkingLevel(payload.thinkingLevel),
				permissionProfileId: optionalNullableString(payload.permissionProfileId, "payload.permissionProfileId"),
				autoNameStrategy: optionalAutoNameStrategy(payload.autoNameStrategy),
			},
		};
	}
	if (input.type === "session.resume") {
		return {
			...base,
			type: input.type,
			payload: {
				sessionPath: requireString(payload.sessionPath, "payload.sessionPath"),
				model: optionalString(payload.model, "payload.model"),
				thinkingLevel: optionalThinkingLevel(payload.thinkingLevel),
				permissionProfileId: optionalNullableString(payload.permissionProfileId, "payload.permissionProfileId"),
			},
		};
	}
	if (input.type === "session.resume-by-id") {
		return {
			...base,
			type: input.type,
			payload: { sessionId: requireString(payload.sessionId, "payload.sessionId") },
		};
	}
	if (input.type === "session.change-workspace") {
		const target = requireRecord(payload.target, "payload.target");
		if (target.kind === "vault") {
			return { ...base, type: input.type, payload: { target: { kind: "vault" } } };
		}
		if (target.kind !== "project") throw new Error("payload.target.kind is invalid");
		const attachedRootIds = requireStringArray(
			target.sessionAttachedRootIds,
			"payload.target.sessionAttachedRootIds",
		);
		return {
			...base,
			type: input.type,
			payload: {
				target: {
					kind: "project",
					projectId: requireString(target.projectId, "payload.target.projectId"),
					activeRootId: optionalString(target.activeRootId, "payload.target.activeRootId"),
					sessionAttachedRootIds: Object.freeze([...attachedRootIds]),
				},
			},
		};
	}
	if (input.type === "session.clone") return { ...base, type: input.type, payload: {} };
	if (input.type === "session.fork") {
		return { ...base, type: input.type, payload: { entryId: requireString(payload.entryId, "payload.entryId") } };
	}
	if (input.type === "session.rename") {
		return { ...base, type: input.type, payload: { name: requireString(payload.name, "payload.name") } };
	}
	if (input.type === "session.import-jsonl") {
		return {
			...base,
			type: input.type,
			payload: {
				inputPath: requireString(payload.inputPath, "payload.inputPath"),
				cwdOverride: optionalString(payload.cwdOverride, "payload.cwdOverride"),
			},
		};
	}
	if (input.type === "session.update-preferences") {
		const model = optionalString(payload.model, "payload.model");
		const permissionProfileId = optionalNullableString(payload.permissionProfileId, "payload.permissionProfileId");
		const thinkingLevel = optionalThinkingLevel(payload.thinkingLevel);
		if (model === undefined && permissionProfileId === undefined && thinkingLevel === undefined) {
			throw new Error("session.update-preferences requires at least one preference");
		}
		return {
			...base,
			type: input.type,
			payload: { model, thinkingLevel, permissionProfileId },
		};
	}
	throw new Error(`Unknown frontend intent type: ${String(input.type)}`);
}

export function parseFrontendScreenRequest(value: unknown): FrontendScreenRequest {
	const input = requireRecord(value, "frontend screen request");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const screenId = requireString(input.screenId, "screenId");
	if (
		screenId !== "projects" &&
		screenId !== "memory" &&
		screenId !== "permissions" &&
		screenId !== "events" &&
		screenId !== "queries" &&
		screenId !== "channels" &&
		screenId !== "subagents" &&
		screenId !== "mcp"
	) {
		throw new Error(`Unknown frontend screen: ${screenId}`);
	}
	return {
		schemaVersion: 1,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		requestId: frontendId(requireString(input.requestId, "requestId"), "requestId"),
		requestEpoch: requireSafeInteger(input.requestEpoch, "requestEpoch"),
		baseSequence: requireSafeInteger(input.baseSequence, "baseSequence"),
		screenId,
		preferredEntityId: optionalString(input.preferredEntityId, "preferredEntityId"),
	};
}

export function parseFrontendScreenResponse(value: unknown): FrontendScreenResponse {
	const input = requireRecord(value, "frontend screen response");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const screen = parseFrontendScreen(input.screen);
	const screenRevision = requireSafeInteger(input.screenRevision, "screenRevision");
	if (screen.revision !== screenRevision) throw new Error("screenRevision must match screen.revision");
	return {
		schemaVersion: 1,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		requestId: frontendId(requireString(input.requestId, "requestId"), "requestId"),
		requestEpoch: requireSafeInteger(input.requestEpoch, "requestEpoch"),
		baseSequence: requireSafeInteger(input.baseSequence, "baseSequence"),
		screenRevision,
		screen,
	};
}

export function parseFrontendScreen(value: unknown): FrontendScreenViewModel {
	const input = requireRecord(value, "frontend screen");
	requireJsonValue(input, "frontend screen");
	if (
		input.screenId !== "projects" &&
		input.screenId !== "channels" &&
		input.screenId !== "memory" &&
		input.screenId !== "permissions" &&
		input.screenId !== "events" &&
		input.screenId !== "queries" &&
		input.screenId !== "subagents" &&
		input.screenId !== "mcp"
	) {
		throw new Error(`Unknown frontend screen: ${String(input.screenId)}`);
	}
	requireSafeInteger(input.revision, "revision");
	requireBoolean(input.loading, "loading");
	if (input.screenId === "projects") {
		validateProjectScreen(input);
		return value as FrontendProjectScreenViewModel;
	}
	if (input.screenId === "channels") {
		validateChannelScreen(input);
		return value as FrontendChannelScreenViewModel;
	}
	if (input.screenId === "memory") {
		validateMemoryScreen(input);
		return value as FrontendMemoryScreenViewModel;
	}
	if (input.screenId === "queries") {
		validateQueryScreen(input);
		return value as FrontendContextQueryScreenViewModel;
	}
	if (input.screenId === "permissions") {
		validatePermissionScreen(input);
		return value as FrontendPermissionScreenViewModel;
	}
	if (input.screenId === "mcp") {
		validateMcpScreen(input);
		return value as FrontendMcpScreenViewModel;
	}
	if (input.screenId === "subagents") {
		validateSubagentScreen(input);
		return value as FrontendSubagentScreenViewModel;
	}
	validateEventScreen(input);
	return value as FrontendEventScreenViewModel;
}

function validateChannelScreen(input: Record<string, unknown>): void {
	if (input.workspaceWide !== undefined) requireBoolean(input.workspaceWide, "workspaceWide");
	if (input.canCompose !== undefined) requireBoolean(input.canCompose, "canCompose");
	for (const field of ["participants", "availableAgents"] as const)
		if (input[field] !== undefined)
			validateArray(input[field], field, (value, label) => {
				const participant = requireRecord(value, label);
				requireString(participant.actorId, `${label}.actorId`);
				requireString(participant.label, `${label}.label`);
				requireEnumValue(participant.kind, `${label}.kind`, ["main", "subagent", "user"]);
				requireEnumValue(participant.state, `${label}.state`, [
					"invited",
					"approval_pending",
					"connected",
					"disconnected",
				]);
				requireBoolean(participant.live, `${label}.live`);
				if (participant.navigation !== undefined) {
					const navigation = requireRecord(participant.navigation, `${label}.navigation`);
					requireString(navigation.mainSessionId, `${label}.navigation.mainSessionId`);
					for (const key of ["actorId", "runId", "nodeId", "channelId"] as const)
						optionalString(navigation[key], `${label}.navigation.${key}`);
				}
			});
	validateArray(input.groups, "groups", (value, label) => {
		const group = requireRecord(value, label);
		requireEnumValue(group.id, `${label}.id`, ["current", "named", "sessions", "archived"]);
		requireString(group.label, `${label}.label`);
		validateArray(group.items, `${label}.items`, (itemValue, itemLabel) => {
			const item = requireRecord(itemValue, itemLabel);
			for (const field of ["id", "label", "subtitle"] as const) requireString(item[field], `${itemLabel}.${field}`);
			requireEnumValue(item.iconToken, `${itemLabel}.iconToken`, ["users", "messages-square"]);
			for (const field of ["selected", "archived", "canArchive", "canDelete"] as const)
				requireBoolean(item[field], `${itemLabel}.${field}`);
		});
	});
	requireString(input.heading, "heading");
	optionalString(input.subheading, "subheading");
	optionalString(input.selectedChannelId, "selectedChannelId");
	optionalString(input.nextCursor, "nextCursor");
	optionalString(input.error, "error");
	validateArray(input.messages, "messages", (value, label) => {
		const message = requireRecord(value, label);
		for (const field of ["id", "senderLabel", "senderInitials", "recipientLabel", "kindLabel"] as const)
			requireString(message[field], `${label}.${field}`);
		requireTextValue(message.text, `${label}.text`);
		requireSafeInteger(message.order, `${label}.order`);
		requireSafeInteger(message.createdAt, `${label}.createdAt`);
		optionalString(message.contextLabel, `${label}.contextLabel`);
		if (message.operatorAuthored !== undefined) requireBoolean(message.operatorAuthored, `${label}.operatorAuthored`);
		optionalString(message.deliveryLabel, `${label}.deliveryLabel`);
		optionalString(message.replyTo, `${label}.replyTo`);
		if (message.operatorAuthored === true && message.senderNavigation === undefined) return;
		const navigation = requireRecord(message.senderNavigation, `${label}.senderNavigation`);
		requireString(navigation.mainSessionId, `${label}.senderNavigation.mainSessionId`);
		for (const field of ["actorId", "runId", "nodeId", "channelId"] as const)
			optionalString(navigation[field], `${label}.senderNavigation.${field}`);
	});
}

function validateMemoryScreen(input: Record<string, unknown>): void {
	if (input.browseProjectId !== null) optionalString(input.browseProjectId, "browseProjectId");
	if (input.browseOptions !== undefined)
		validateArray(input.browseOptions, "browseOptions", (value, label) => {
			parseChoiceOption(value, label, true);
		});
	const scope = requireRecord(input.scope, "scope");
	requireString(scope.label, "scope.label");
	requireString(scope.description, "scope.description");
	optionalString(scope.path, "scope.path");
	requireMemoryScopeFilter(input.scopeFilter);
	requireMemoryCollectionFilter(input.collection);
	requireMemoryStatusFilter(input.status);
	requireTextValue(input.query, "query");
	optionalSafeInteger(input.searchResultCount, "searchResultCount");
	requireMemoryCategoryFilter(input.lessonCategory);
	requireMemorySort(input.sort);
	for (const field of [
		"scopeOptions",
		"collectionOptions",
		"statusOptions",
		"lessonCategoryOptions",
		"sortOptions",
		"createTargets",
	] as const)
		validateChoices(input[field], field);
	validateArray(input.records, "records", (value, label) => {
		const record = requireRecord(value, label);
		for (const field of [
			"id",
			"label",
			"locationLabel",
			"scopeRelationLabel",
			"content",
			"provenanceLabel",
			"createdAt",
			"lastReferencedAt",
			"updatedAt",
			"sensitivityLabel",
		] as const)
			requireString(record[field], `${label}.${field}`);
		requireSafeInteger(record.revision, `${label}.revision`);
		requireIconToken(record.iconToken, `${label}.iconToken`);
		optionalString(record.stateLabel, `${label}.stateLabel`);
		requireEnumValue(record.status, `${label}.status`, ["active", "archived"]);
		validateArray(record.availableActions, `${label}.availableActions`, (entry, entryLabel) =>
			requireEnumValue(entry, entryLabel, ["edit", "archive", "restore", "delete"]),
		);
		requireStringArray(record.technicalLines, `${label}.technicalLines`);
	});
	validateArray(input.candidates, "candidates", (value, label) => {
		const candidate = requireRecord(value, label);
		requireString(candidate.id, `${label}.id`);
		requireString(candidate.actionLabel, `${label}.actionLabel`);
		requireString(candidate.content, `${label}.content`);
		optionalString(candidate.reason, `${label}.reason`);
	});
	const boundary = requireRecord(input.projectBoundary, "projectBoundary");
	requireString(boundary.description, "projectBoundary.description");
	requireEnumValue(boundary.value, "projectBoundary.value", ["inherit", "separate", "project-only"]);
	validateChoices(boundary.options, "projectBoundary.options");
	optionalString(boundary.disabledReason, "projectBoundary.disabledReason");
	validateArray(input.learningSettings, "learningSettings", (value, label) => {
		const setting = requireRecord(value, label);
		requireEnumValue(setting.id, `${label}.id`, ["backgroundLearning", "correctionLearning", "promptRouting"]);
		for (const field of ["title", "description", "value"] as const)
			requireString(setting[field], `${label}.${field}`);
		validateChoices(setting.options, `${label}.options`);
	});
	const storage = requireRecord(input.storage, "storage");
	requireString(storage.description, "storage.description");
	requireStringArray(storage.technicalLines, "storage.technicalLines");
	requireStringArray(input.helpItems, "helpItems");
	optionalString(input.error, "error");
	optionalString(input.statusMessage, "statusMessage");
}

function validateQueryScreen(input: Record<string, unknown>): void {
	requireString(input.projectName, "projectName");
	requireString(input.projectDirectory, "projectDirectory");
	requireBoolean(input.trusted, "trusted");
	validateArray(input.items, "items", (value, label) => {
		const query = requireRecord(value, label);
		for (const field of ["id", "name", "description", "timingLabel", "updatedAt"] as const)
			requireString(query[field], `${label}.${field}`);
		requireSafeInteger(query.revision, `${label}.revision`);
		requireEnumValue(query.trigger, `${label}.trigger`, ["session_start", "every_turn"]);
		requireBoolean(query.enabled, `${label}.enabled`);
		optionalString(query.enableDisabledReason, `${label}.enableDisabledReason`);
		if (query.lastTest !== undefined) {
			const last = requireRecord(query.lastTest, `${label}.lastTest`);
			requireEnumValue(last.status, `${label}.lastTest.status`, ["succeeded", "failed"]);
			requireString(last.summary, `${label}.lastTest.summary`);
			requireSafeInteger(last.durationMs, `${label}.lastTest.durationMs`);
		}
	});
	optionalString(input.error, "error");
	optionalString(input.statusMessage, "statusMessage");
}

function validateMcpScreen(input: Record<string, unknown>): void {
	requireEnumValue(input.selectedTab, "selectedTab", ["installed", "discover"]);
	requireTextValue(input.query, "query");
	requireString(input.configRevision, "configRevision");
	requireSafeInteger(input.inventoryRevision, "inventoryRevision");
	validateArray(input.servers, "servers", (value, label) => {
		const server = requireRecord(value, label);
		for (const field of ["id", "sourceLabel", "sourcePath"] as const)
			requireString(server[field], `${label}.${field}`);
		for (const field of [
			"reportedName",
			"reportedVersion",
			"command",
			"workingDirectory",
			"url",
			"credentialReference",
		] as const)
			optionalString(server[field], `${label}.${field}`);
		requireEnumValue(server.state, `${label}.state`, [
			"disabled",
			"configured",
			"connecting",
			"discovering",
			"needs-sign-in",
			"ready",
			"connected",
			"updating",
			"unavailable",
			"incompatible",
		]);
		for (const field of ["enabled", "builtIn", "writable", "requiresAuthentication", "toolReviewRequired"] as const)
			requireBoolean(server[field], `${label}.${field}`);
		requireEnumValue(server.sourceScope, `${label}.sourceScope`, ["global", "project"]);
		requireEnumValue(server.transport, `${label}.transport`, ["local", "remote"]);
		requireEnumValue(server.lifecycle, `${label}.lifecycle`, ["keep-alive", "lazy", "eager"]);
		if (server.localExecution !== undefined) {
			const localExecution = requireRecord(server.localExecution, `${label}.localExecution`);
			const status = requireEnumValue(localExecution.status, `${label}.localExecution.status`, [
				"available",
				"unavailable",
			]);
			if (status === "available") {
				requireEnumValue(localExecution.mode, `${label}.localExecution.mode`, ["unsandboxed"]);
			} else {
				requireString(localExecution.reason, `${label}.localExecution.reason`);
			}
		}
		for (const field of ["toolCount", "enabledToolCount", "resourceCount"] as const)
			requireSafeInteger(server[field], `${label}.${field}`);
		validateArray(server.tools, `${label}.tools`, (toolValue, toolLabel) => {
			const tool = requireRecord(toolValue, toolLabel);
			requireString(tool.name, `${toolLabel}.name`);
			optionalString(tool.title, `${toolLabel}.title`);
			optionalString(tool.description, `${toolLabel}.description`);
			requireBoolean(tool.enabled, `${toolLabel}.enabled`);
		});
		validateArray(server.resources, `${label}.resources`, (resourceValue, resourceLabel) => {
			const resource = requireRecord(resourceValue, resourceLabel);
			requireString(resource.uri, `${resourceLabel}.uri`);
			requireString(resource.name, `${resourceLabel}.name`);
			optionalString(resource.description, `${resourceLabel}.description`);
			optionalString(resource.mimeType, `${resourceLabel}.mimeType`);
			requireString(resource.toolName, `${resourceLabel}.toolName`);
			requireBoolean(resource.enabled, `${resourceLabel}.enabled`);
		});
		requireStringArray(server.arguments, `${label}.arguments`);
		requireEnumValue(server.authentication, `${label}.authentication`, ["oauth", "bearer", "none"]);
		requireStringArray(server.environmentNames, `${label}.environmentNames`);
		requireStringArray(server.headerNames, `${label}.headerNames`);
		if (server.registry !== undefined) {
			const registry = requireRecord(server.registry, `${label}.registry`);
			requireString(registry.serverName, `${label}.registry.serverName`);
			requireString(registry.version, `${label}.registry.version`);
		}
	});
	validateArray(input.catalog, "catalog", (value, label) => {
		const item = requireRecord(value, label);
		for (const field of ["name", "title", "description", "version", "transportLabel"] as const)
			requireString(item[field], `${label}.${field}`);
		optionalString(item.repositoryUrl, `${label}.repositoryUrl`);
		requireStringArray(item.environmentNames, `${label}.environmentNames`);
		requireBoolean(item.canConfigure, `${label}.canConfigure`);
		optionalString(item.unavailableReason, `${label}.unavailableReason`);
	});
	optionalString(input.nextCatalogCursor, "nextCatalogCursor");
	if (input.pendingAuthentication !== undefined) {
		const pending = requireRecord(input.pendingAuthentication, "pendingAuthentication");
		requireString(pending.serverId, "pendingAuthentication.serverId");
		requireString(pending.authorizationUrl, "pendingAuthentication.authorizationUrl");
	}
	optionalString(input.error, "error");
	optionalString(input.statusMessage, "statusMessage");
}

function validateEventScreen(input: Record<string, unknown>): void {
	validateArray(input.definitions, "definitions", (value, label) => {
		const definition = requireRecord(value, label);
		for (const field of [
			"id",
			"name",
			"statusLabel",
			"triggerLabel",
			"projectLabel",
			"permissionLabel",
			"agentLabel",
			"approvalLabel",
			"budgetLabel",
		] as const)
			requireString(definition[field], `${label}.${field}`);
		requireSafeInteger(definition.revision, `${label}.revision`);
		optionalString(definition.description, `${label}.description`);
		for (const field of ["enabled", "running", "canRun"] as const)
			requireBoolean(definition[field], `${label}.${field}`);
		requireIconToken(definition.iconToken, `${label}.iconToken`);
	});
	validateArray(input.occurrences, "occurrences", (value, label) => {
		const occurrence = requireRecord(value, label);
		// Empty selects Vault root, matching the persisted Events and editor contracts.
		requireTextValue(occurrence.projectPath, `${label}.projectPath`);
		for (const field of [
			"id",
			"eventName",
			"status",
			"statusLabel",
			"originLabel",
			"triggeredAt",
			"allocationLabel",
		] as const)
			requireString(occurrence[field], `${label}.${field}`);
		optionalString(occurrence.summary, `${label}.summary`);
		optionalString(occurrence.error, `${label}.error`);
		requireBoolean(occurrence.canApprove, `${label}.canApprove`);
		if (occurrence.session !== undefined) {
			const session = requireRecord(occurrence.session, `${label}.session`);
			requireString(session.id, `${label}.session.id`);
			requireString(session.recoveryPath, `${label}.session.recoveryPath`);
		}
	});
	requireSafeInteger(input.pendingApprovalCount, "pendingApprovalCount");
	if (input.editor !== undefined) validateEventEditor(input.editor, "editor");
	optionalString(input.error, "error");
	optionalString(input.statusMessage, "statusMessage");
}

function validateEventEditor(value: unknown, label: string): void {
	const editor = requireRecord(value, label);
	optionalString(editor.definitionId, `${label}.definitionId`);
	optionalSafeInteger(editor.expectedRevision, `${label}.expectedRevision`);
	for (const field of [
		"name",
		"description",
		"projectPath",
		"permissionProfileId",
		"agentId",
		"triggerValue",
		"scheduleStartAt",
		"scheduleEndDate",
		"prompt",
	] as const)
		requireTextValue(editor[field], `${label}.${field}`);
	requireBoolean(editor.enabled, `${label}.enabled`);
	requireEnumValue(editor.triggerKind, `${label}.triggerKind`, ["schedule", "filesystem", "command"]);
	requireEnumValue(editor.scheduleRepeat, `${label}.scheduleRepeat`, ["none", "daily", "weekly", "monthly", "yearly"]);
	requireSafeInteger(editor.scheduleInterval, `${label}.scheduleInterval`);
	requireNumberArray(editor.scheduleWeekdays, `${label}.scheduleWeekdays`);
	requireEnumValue(editor.scheduleEnd, `${label}.scheduleEnd`, ["never", "on", "after"]);
	for (const field of ["scheduleEndOccurrences", "triggerDebounceMs", "maxRunsPerDay", "maxRuntimeMinutes"] as const)
		requireSafeInteger(editor[field], `${label}.${field}`);
	for (const field of [
		"triggerRecursive",
		"requireApproval",
		"allowWhenViewClosed",
		"backgroundConsent",
		"saveEnabled",
	] as const)
		requireBoolean(editor[field], `${label}.${field}`);
	// Events persist the Vault root as an empty relative path. Other choice IDs
	// still require non-empty strings; do not weaken the shared ID validator.
	validateArray(editor.projectChoices, `${label}.projectChoices`, (choice, choiceLabel) => {
		parseChoiceOption(choice, choiceLabel, true);
	});
	for (const field of ["permissionChoices", "agentChoices"] as const)
		validateChoices(editor[field], `${label}.${field}`);
	optionalString(editor.allocationError, `${label}.allocationError`);
}

function validateSubagentScreen(input: Record<string, unknown>): void {
	optionalString(input.roleScopeId, "roleScopeId");
	if (input.roleScopeOptions !== undefined) validateChoices(input.roleScopeOptions, "roleScopeOptions");
	if (input.workspaceWide !== undefined) requireBoolean(input.workspaceWide, "workspaceWide");
	if (input.parentSessions !== undefined)
		validateArray(input.parentSessions, "parentSessions", (value, label) => {
			const parent = requireRecord(value, label);
			for (const field of ["sessionId", "label", "workspaceLabel"] as const)
				requireString(parent[field], `${label}.${field}`);
			requireBoolean(parent.active, `${label}.active`);
		});
	requireEnumValue(input.syncStatus, "syncStatus", ["idle", "loading", "live", "gap", "error"]);
	optionalString(input.runtimeId, "runtimeId");
	requireSafeInteger(input.sequence, "sequence");
	if (input.capabilities !== undefined) {
		const capabilities = requireRecord(input.capabilities, "capabilities");
		if (capabilities.protocolVersion !== 1) throw new Error("capabilities.protocolVersion is invalid");
		requireString(capabilities.runtimeId, "capabilities.runtimeId");
		validateArray(capabilities.executionModes, "capabilities.executionModes", (entry, label) =>
			requireEnumValue(entry, label, ["in-process", "worker-process"]),
		);
		for (const field of [
			"supportsSiblingCommunication",
			"supportsWorkerRecovery",
			"supportsWorktrees",
			"supportsArtifactPromotion",
		] as const)
			requireBoolean(capabilities[field], `capabilities.${field}`);
		requireEnumValue(capabilities.workerRecoveryMode, "capabilities.workerRecoveryMode", [
			"none",
			"reconcile",
			"adopt",
		]);
		requireSafeInteger(capabilities.maxReplayEvents, "capabilities.maxReplayEvents");
	}
	requireStringArray(input.runIds, "runIds");
	validateArray(input.runSummaries, "runSummaries", validateSubagentRunSummary);
	const query = requireRecord(input.runQuery, "runQuery");
	optionalString(query.parentSessionId, "runQuery.parentSessionId");
	if (query.status !== undefined)
		validateArray(query.status, "runQuery.status", (entry, label) =>
			requireEnumValue(entry, label, SUBAGENT_RUN_STATUS_VALUES),
		);
	optionalString(query.agentId, "runQuery.agentId");
	if (query.executionMode !== undefined)
		requireEnumValue(query.executionMode, "runQuery.executionMode", ["in-process", "worker-process"]);
	for (const field of ["workspaceCwd", "search"] as const) optionalString(query[field], `runQuery.${field}`);
	for (const field of ["createdAfter", "createdBefore"] as const)
		optionalSafeInteger(query[field], `runQuery.${field}`);
	optionalString(input.nextRunCursor, "nextRunCursor");
	validateArray(input.runs, "runs", validateSubagentRun);
	validateArray(input.definitions, "definitions", validateSubagentDefinition);
	if (input.settings !== undefined) {
		const settingsView = requireRecord(input.settings, "settings");
		const settings = requireRecord(settingsView.settings, "settings.settings");
		for (const field of ["unlimitedConcurrency", "unlimitedDepth"] as const)
			if (settings[field] !== undefined) requireBoolean(settings[field], `settings.settings.${field}`);
		for (const field of ["maxConcurrency", "defaultMaxDepth"] as const)
			optionalSafeInteger(settings[field], `settings.settings.${field}`);
		requireSafeInteger(settings.retentionDays, "settings.settings.retentionDays");
		if (settings.schemaVersion !== undefined && settings.schemaVersion !== 2)
			throw new Error("settings.settings.schemaVersion must be 2 when present");
		requireEnumValue(settings.defaultExecutionMode, "settings.settings.defaultExecutionMode", [
			"auto",
			"in-process",
			"worker-process",
		]);
		for (const field of ["defaultMaxTurnsPerNode", "defaultMaxTokens", "defaultMaxWallTimeMs"] as const)
			optionalSafeInteger(settings[field], `settings.settings.${field}`);
		optionalFiniteNumber(settings.defaultMaxCostUsd, "settings.settings.defaultMaxCostUsd");
		requireEnumValue(settings.automaticDelegation, "settings.settings.automaticDelegation", [
			"off",
			"suggest",
			"allowed",
		]);
		requireBoolean(settings.allowSiblingCommunication, "settings.settings.allowSiblingCommunication");
		if (settingsView.scope !== undefined) {
			const scope = requireRecord(settingsView.scope, "settings.scope");
			requireEnumValue(scope.kind, "settings.scope.kind", ["global", "vault", "directory", "session"]);
			requireString(scope.id, "settings.scope.id");
		}
		requireSafeInteger(settingsView.revision, "settings.revision");
		const sources = requireRecord(settingsView.sources, "settings.sources");
		for (const [key, source] of Object.entries(sources)) {
			const item = requireRecord(source, `settings.sources.${key}`);
			requireEnumValue(item.kind, `settings.sources.${key}.kind`, ["global", "vault", "directory", "session"]);
			requireString(item.id, `settings.sources.${key}.id`);
		}
	}
	validateArray(input.models, "models", (value, label) => {
		const model = requireRecord(value, label);
		for (const field of ["id", "name", "provider"] as const) requireString(model[field], `${label}.${field}`);
	});
	validateArray(input.skills, "skills", (value, label) => {
		const skill = requireRecord(value, label);
		requireString(skill.name, `${label}.name`);
		optionalString(skill.description, `${label}.description`);
	});
	if (input.permissionSnapshot !== undefined) {
		const snapshot = requireRecord(input.permissionSnapshot, "permissionSnapshot");
		const document = requireRecord(snapshot.document, "permissionSnapshot.document");
		validateArray(document.profiles, "permissionSnapshot.document.profiles", (value, label) => {
			const profile = requireRecord(value, label);
			requireString(profile.id, `${label}.id`);
			requireString(profile.name, `${label}.name`);
		});
		const assignments = requireRecord(document.agentAssignments, "permissionSnapshot.document.agentAssignments");
		for (const [key, assignmentValue] of Object.entries(assignments)) {
			const assignment = requireRecord(assignmentValue, `permissionSnapshot.document.agentAssignments.${key}`);
			const mode = requireEnumValue(assignment.mode, `permissionSnapshot.document.agentAssignments.${key}.mode`, [
				"inherit",
				"profile",
			]);
			if (mode === "profile")
				requireString(assignment.profileId, `permissionSnapshot.document.agentAssignments.${key}.profileId`);
		}
	}
	optionalString(input.selectedRunId, "selectedRunId");
	optionalString(input.selectedNodeId, "selectedNodeId");
	optionalString(input.nextTranscriptCursor, "nextTranscriptCursor");
	validateArray(input.artifacts, "artifacts", (value, label) => {
		const group = requireRecord(value, label);
		requireString(group.runId, `${label}.runId`);
		validateArray(group.items, `${label}.items`, validateSubagentArtifact);
	});
	validateArray(input.messages, "messages", validateSubagentMessage);
	validateArray(input.controlReceipts, "controlReceipts", (value, label) => {
		const receipt = requireRecord(value, label);
		for (const field of ["commandId", "runId"] as const) requireString(receipt[field], `${label}.${field}`);
		optionalString(receipt.nodeId, `${label}.nodeId`);
		requireEnumValue(receipt.action, `${label}.action`, [
			"cancel",
			"pause",
			"resume",
			"interrupt",
			"steer",
			"complete",
			"retry",
			"reprioritize",
			"fork",
			"clone",
			"decide-child-input",
			"decide-tool-permission",
			"adopt",
			"reconcile-orphan",
			"approve-permission",
			"deny-permission",
			"approve-acceptance",
			"reject-acceptance",
			"extend-budget",
			"set-permission-profile",
		]);
		requireEnumValue(receipt.state, `${label}.state`, [
			"requested",
			"acknowledged",
			"effective",
			"failed",
			"timed-out",
		]);
		optionalString(receipt.message, `${label}.message`);
		requireSafeInteger(receipt.timestamp, `${label}.timestamp`);
	});
	parseFrontendFeedDocument(input.focusedFeed);
	optionalString(input.error, "error");
	optionalString(input.statusMessage, "statusMessage");
}

export function parseFrontendBootstrap(value: unknown): FrontendBootstrap {
	const input = requireRecord(value, "frontend bootstrap");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const screenModels = requireArray(input.screenModels, "screenModels");
	if (screenModels.length !== 0) throw new Error("screenModels must be empty in protocol v2");
	return {
		schemaVersion: 1,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		revision: requireSafeInteger(input.revision, "revision"),
		sequence: requireSafeInteger(input.sequence, "sequence"),
		session: input.session === null ? null : parseFrontendSession(input.session),
		taskPlan: parseFrontendTaskPlan(input.taskPlan),
		composer: parseFrontendComposer(input.composer),
		agentRail: parseFrontendAgentRail(input.agentRail),
		feed: parseFrontendFeedDocument(input.feed),
		screens: requireArray(input.screens, "screens").map((entry, index) =>
			parseFrontendScreenDirectoryEntry(entry, `screens[${index}]`),
		),
		screenModels: [],
		localCommands: requireArray(input.localCommands, "localCommands").map((entry, index) =>
			parseFrontendLocalCommand(entry, `localCommands[${index}]`),
		),
	};
}

export function parseFrontendPatch(value: unknown): FrontendPatch {
	const input = requireRecord(value, "frontend patch");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const viewId = frontendId(requireString(input.viewId, "viewId"), "viewId");
	const scope = requireRecord(input.scope, "scope");
	if (scope.kind !== "view") throw new Error("Only view scope is legal in frontend protocol v2");
	const scopeViewId = frontendId(requireString(scope.viewId, "scope.viewId"), "scope.viewId");
	if (scopeViewId !== viewId) throw new Error("scope.viewId must match viewId");
	const baseRevision = requireSafeInteger(input.baseRevision, "baseRevision");
	const revision = requireSafeInteger(input.revision, "revision");
	if (revision !== baseRevision + 1) throw new Error("patch revision must advance exactly once");
	return {
		schemaVersion: 1,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId,
		scope: { kind: "view", viewId: scopeViewId },
		sequence: requireSafeInteger(input.sequence, "sequence"),
		baseRevision,
		revision,
		operations: requireArray(input.operations, "operations").map((entry, index) =>
			parseFrontendPatchOperation(entry, `operations[${index}]`),
		),
	};
}

export function parseFrontendNegotiationResult(value: unknown): FrontendNegotiationResult {
	const input = requireRecord(value, "frontend negotiation result");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	return {
		schemaVersion: 1,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		requestId: frontendId(requireString(input.requestId, "requestId"), "requestId"),
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		selectedCapabilities: requireArray(input.selectedCapabilities, "selectedCapabilities").map((entry, index) =>
			requireFrontendCapability(entry, `selectedCapabilities[${index}]`),
		),
		unavailableCapabilities: requireArray(input.unavailableCapabilities, "unavailableCapabilities").map(
			(entry, index) => parseUnavailableCapability(entry, `unavailableCapabilities[${index}]`),
		),
		replayLimit: requireSafeInteger(input.replayLimit, "replayLimit"),
	};
}

export function parseFrontendSubscriptionResult(value: unknown): FrontendSubscriptionResult {
	const input = requireRecord(value, "frontend subscription result");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const status = requireString(input.status, "status");
	const base = {
		schemaVersion: 1 as const,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		requestId: frontendId(requireString(input.requestId, "requestId"), "requestId"),
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		sequence: requireSafeInteger(input.sequence, "sequence"),
		revision: requireSafeInteger(input.revision, "revision"),
		oldestReplayableSequence: requireSafeInteger(input.oldestReplayableSequence, "oldestReplayableSequence"),
	} as const;
	if (status === "bootstrapped") {
		const replay = requireArray(input.replay, "replay");
		if (replay.length !== 0) throw new Error("bootstrapped subscription replay must be empty");
		const bootstrap = parseFrontendBootstrap(input.bootstrap);
		if (bootstrap.sequence !== base.sequence || bootstrap.revision !== base.revision) {
			throw new Error("bootstrap cutover does not match subscription sequence/revision");
		}
		return { ...base, status, bootstrap, replay: [] };
	}
	if (status === "replayed") {
		const baseSequence = requireSafeInteger(input.baseSequence, "baseSequence");
		const baseRevision = requireSafeInteger(input.baseRevision, "baseRevision");
		const replay = requireArray(input.replay, "replay").map((entry) => parseFrontendPatch(entry));
		validateReplay(replay, baseSequence, baseRevision, base.sequence, base.revision);
		return { ...base, status, baseSequence, baseRevision, replay };
	}
	if (status === "resync-required") return { ...base, status, error: parseFrontendProtocolError(input.error) };
	throw new Error(`Unknown frontend subscription status: ${status}`);
}

export function parseFrontendProtocolError(value: unknown): FrontendProtocolError {
	const input = requireRecord(value, "frontend protocol error");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const code = requireProtocolErrorCode(input.code);
	const resync = requireString(input.resync, "resync");
	if (resync !== "none" && resync !== "retry" && resync !== "full-bootstrap" && resync !== "close") {
		throw new Error("resync is invalid");
	}
	return {
		schemaVersion: 1,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		code,
		message: requireString(input.message, "message"),
		diagnosticId: optionalString(input.diagnosticId, "diagnosticId"),
		retryable: requireBoolean(input.retryable, "retryable"),
		resync,
		runtimeInstanceId:
			input.runtimeInstanceId === undefined
				? undefined
				: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: input.viewId === undefined ? undefined : frontendId(requireString(input.viewId, "viewId"), "viewId"),
		requestId:
			input.requestId === undefined
				? undefined
				: frontendId(requireString(input.requestId, "requestId"), "requestId"),
		sequence: optionalSafeInteger(input.sequence, "sequence"),
		revision: optionalSafeInteger(input.revision, "revision"),
	};
}

export function parseFrontendIntentResult(value: unknown): FrontendIntentResult {
	const input = requireRecord(value, "frontend intent outcome");
	requireSchemaVersion(input);
	requireProtocolVersion(input);
	const status = requireString(input.status, "status");
	const base = {
		schemaVersion: 1 as const,
		protocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
		runtimeInstanceId: frontendId(requireString(input.runtimeInstanceId, "runtimeInstanceId"), "runtimeInstanceId"),
		viewId: frontendId(requireString(input.viewId, "viewId"), "viewId"),
		intentId: frontendId(requireString(input.intentId, "intentId"), "intentId"),
	} as const;
	if (status === "applied") {
		return {
			...base,
			status,
			revision: requireSafeInteger(input.revision, "revision"),
			notice: optionalNotice(input.notice),
		};
	}
	if (status === "accepted") {
		return {
			...base,
			status,
			acceptedAtSequence: requireSafeInteger(input.acceptedAtSequence, "acceptedAtSequence"),
			notice: optionalNotice(input.notice),
		};
	}
	if (status === "rejected") {
		return {
			...base,
			status,
			errorCode: requireString(input.errorCode, "errorCode"),
			fieldErrors: optionalStringRecord(input.fieldErrors, "fieldErrors"),
			notice: requireNotice(input.notice),
		};
	}
	if (status === "conflict") {
		return {
			...base,
			status,
			expectedRevision: optionalSafeInteger(input.expectedRevision, "expectedRevision"),
			actualRevision: requireSafeInteger(input.actualRevision, "actualRevision"),
			notice: requireNotice(input.notice),
		};
	}
	if (status === "unavailable") {
		return {
			...base,
			status,
			capability: requireFrontendCapability(input.capability, "capability"),
			notice: requireNotice(input.notice),
		};
	}
	throw new Error(`Unknown frontend intent outcome: ${status}`);
}

function parseFrontendSession(value: unknown): FrontendSessionViewModel {
	const input = requireRecord(value, "session");
	const workspace = requireRecord(input.workspace, "session.workspace");
	const parsedWorkspace =
		workspace.kind === "vault"
			? { kind: "vault" as const, label: requireString(workspace.label, "session.workspace.label") }
			: workspace.kind === "project"
				? {
						kind: "project" as const,
						projectId: requireString(workspace.projectId, "session.workspace.projectId"),
						label: requireString(workspace.label, "session.workspace.label"),
					}
				: (() => {
						throw new Error("session.workspace.kind is invalid");
					})();
	const retryStatus =
		input.retryStatus === undefined
			? undefined
			: (() => {
					const retry = requireRecord(input.retryStatus, "session.retryStatus");
					return {
						attempt: requireSafeInteger(retry.attempt, "session.retryStatus.attempt"),
						maxAttempts: requireSafeInteger(retry.maxAttempts, "session.retryStatus.maxAttempts"),
						message: requireString(retry.message, "session.retryStatus.message"),
						terminal: requireBoolean(retry.terminal, "session.retryStatus.terminal"),
					};
				})();
	const autoCompaction =
		input.autoCompaction === undefined
			? undefined
			: (() => {
					const settings = requireRecord(input.autoCompaction, "session.autoCompaction");
					return {
						...(settings.mode === undefined
							? {}
							: {
									mode: requireEnumValue(settings.mode, "session.autoCompaction.mode", [
										"queued",
										"background",
									]),
								}),
						enabled: requireBoolean(settings.enabled, "session.autoCompaction.enabled"),
						thresholdPercent: requireSafeInteger(
							settings.thresholdPercent,
							"session.autoCompaction.thresholdPercent",
						),
						effectiveThresholdPercent: requireSafeInteger(
							settings.effectiveThresholdPercent,
							"session.autoCompaction.effectiveThresholdPercent",
						),
						customInstructions: optionalString(
							settings.customInstructions,
							"session.autoCompaction.customInstructions",
						),
					};
				})();
	return {
		id: requireString(input.id, "session.id"),
		name: optionalString(input.name, "session.name"),
		recoveryPath: optionalString(input.recoveryPath, "session.recoveryPath"),
		workingDirectory: requireString(input.workingDirectory, "session.workingDirectory"),
		workspace: parsedWorkspace,
		model: requireString(input.model, "session.model"),
		thinkingLevel: requireThinkingLevel(input.thinkingLevel, "session.thinkingLevel"),
		streaming: requireBoolean(input.streaming, "session.streaming"),
		compacting: requireBoolean(input.compacting, "session.compacting"),
		retrying: requireBoolean(input.retrying, "session.retrying"),
		autoCompaction,
		retryStatus,
		messageCount: requireSafeInteger(input.messageCount, "session.messageCount"),
		forkOptions: requireArray(input.forkOptions, "session.forkOptions").map((entry, index) => {
			const option = requireRecord(entry, `session.forkOptions[${index}]`);
			return {
				entryId: requireString(option.entryId, `session.forkOptions[${index}].entryId`),
				label: requireString(option.label, `session.forkOptions[${index}].label`),
			};
		}),
	};
}

function parseFrontendTaskPlan(value: unknown): FrontendTaskPlanViewModel {
	const input = requireRecord(value, "taskPlan");
	return {
		revision: requireSafeInteger(input.revision, "taskPlan.revision"),
		completedCount: requireSafeInteger(input.completedCount, "taskPlan.completedCount"),
		remainingCount: requireSafeInteger(input.remainingCount, "taskPlan.remainingCount"),
		summary: requireString(input.summary, "taskPlan.summary"),
		items: requireArray(input.items, "taskPlan.items").map((entry, index) => {
			const item = requireRecord(entry, `taskPlan.items[${index}]`);
			const status = requireString(item.status, `taskPlan.items[${index}].status`);
			if (status !== "pending" && status !== "in_progress" && status !== "completed" && status !== "blocked") {
				throw new Error(`taskPlan.items[${index}].status is invalid`);
			}
			return {
				id: requireString(item.id, `taskPlan.items[${index}].id`),
				step: requireSafeInteger(item.step, `taskPlan.items[${index}].step`),
				text: requireString(item.text, `taskPlan.items[${index}].text`),
				status,
				note: optionalString(item.note, `taskPlan.items[${index}].note`),
			};
		}),
	};
}

function parseFrontendComposer(value: unknown): FrontendComposerViewModel {
	const input = requireRecord(value, "composer");
	return {
		controls: requireArray(input.controls, "composer.controls").map((entry, index) => {
			const control = requireRecord(entry, `composer.controls[${index}]`);
			const id = requireString(control.id, `composer.controls[${index}].id`);
			if (id !== "provider" && id !== "model" && id !== "effort" && id !== "permission" && id !== "network") {
				throw new Error(`composer.controls[${index}].id is invalid`);
			}
			return {
				id,
				label: requireString(control.label, `composer.controls[${index}].label`),
				value:
					id === "permission"
						? requireTextValue(control.value, `composer.controls[${index}].value`)
						: requireString(control.value, `composer.controls[${index}].value`),
				options: requireArray(control.options, `composer.controls[${index}].options`).map((option, optionIndex) =>
					parseChoiceOption(option, `composer.controls[${index}].options[${optionIndex}]`, id === "permission"),
				),
			};
		}),
		canSubmit: requireBoolean(input.canSubmit, "composer.canSubmit"),
		disabledReason: optionalString(input.disabledReason, "composer.disabledReason"),
	};
}

function parseFrontendAgentRail(value: unknown): FrontendAgentRailViewModel {
	const input = requireRecord(value, "agentRail");
	return {
		items: requireArray(input.items, "agentRail.items").map((entry, index) => {
			const item = requireRecord(entry, `agentRail.items[${index}]`);
			const kind = requireString(item.kind, `agentRail.items[${index}].kind`);
			if (kind !== "main" && kind !== "subagent") throw new Error(`agentRail.items[${index}].kind is invalid`);
			return {
				actorId: requireString(item.actorId, `agentRail.items[${index}].actorId`),
				kind,
				name: requireString(item.name, `agentRail.items[${index}].name`),
				working: requireBoolean(item.working, `agentRail.items[${index}].working`),
				updatedAt: requireSafeInteger(item.updatedAt, `agentRail.items[${index}].updatedAt`),
				runId: optionalString(item.runId, `agentRail.items[${index}].runId`),
				nodeId: optionalString(item.nodeId, `agentRail.items[${index}].nodeId`),
			};
		}),
	};
}

function parseFrontendFeedDocument(value: unknown): FrontendFeedDocumentViewModel {
	const input = requireRecord(value, "feed");
	return {
		revision: requireSafeInteger(input.revision, "feed.revision"),
		blocks: requireArray(input.blocks, "feed.blocks").map((entry, index) =>
			parseFrontendFeedBlock(entry, `feed.blocks[${index}]`),
		),
	};
}

function parseFrontendFeedBlock(value: unknown, label: string): FrontendFeedBlock {
	const input = requireRecord(value, label);
	const type = requireString(input.type, `${label}.type`);
	const id = requireString(input.id, `${label}.id`);
	if (type === "user" || type === "system") {
		return {
			type,
			id,
			turnId: optionalString(input.turnId, `${label}.turnId`),
			text: requireTextValue(input.text, `${label}.text`),
			images:
				input.images === undefined
					? undefined
					: requireArray(input.images, `${label}.images`).map((entry, index) => {
							const image = requireRecord(entry, `${label}.images[${index}]`);
							return {
								data: requireString(image.data, `${label}.images[${index}].data`),
								mimeType: requireString(image.mimeType, `${label}.images[${index}].mimeType`),
							};
						}),
			attachments:
				input.attachments === undefined
					? undefined
					: requireArray(input.attachments, `${label}.attachments`).map((entry, index) =>
							parseFrontendAttachment(entry, `${label}.attachments[${index}]`),
						),
			skillInvocations:
				input.skillInvocations === undefined
					? undefined
					: requireArray(input.skillInvocations, `${label}.skillInvocations`).map((entry, index) => {
							const skill = requireRecord(entry, `${label}.skillInvocations[${index}]`);
							return { name: requireString(skill.name, `${label}.skillInvocations[${index}].name`) };
						}),
			timestamp: optionalSafeInteger(input.timestamp, `${label}.timestamp`),
		};
	}
	if (type === "text" || type === "thinking") {
		const phase = requireString(input.phase, `${label}.phase`);
		if (phase !== "streaming" && phase !== "complete" && phase !== "compacted") {
			throw new Error(`${label}.phase is invalid`);
		}
		return {
			type,
			id,
			turnId: requireString(input.turnId, `${label}.turnId`),
			text:
				typeof input.text === "string"
					? input.text
					: (() => {
							throw new Error(`${label}.text must be a string`);
						})(),
			phase,
			startedAt: optionalSafeInteger(input.startedAt, `${label}.startedAt`),
			durationMs: optionalSafeInteger(input.durationMs, `${label}.durationMs`),
		};
	}
	if (type === "tools") {
		const phase = requireString(input.phase, `${label}.phase`);
		if (phase !== "streaming" && phase !== "complete" && phase !== "compacted") {
			throw new Error(`${label}.phase is invalid`);
		}
		return {
			type,
			id,
			turnId: requireString(input.turnId, `${label}.turnId`),
			phase,
			items: requireArray(input.items, `${label}.items`).map((entry, index) =>
				parseFrontendToolActivity(entry, `${label}.items[${index}]`),
			),
		};
	}
	if (type === "summary") {
		return {
			type,
			id,
			text:
				typeof input.text === "string"
					? input.text
					: (() => {
							throw new Error(`${label}.text must be a string`);
						})(),
			durationMs: optionalSafeInteger(input.durationMs, `${label}.durationMs`),
			toolCounts: requireNumberRecord(input.toolCounts, `${label}.toolCounts`),
			blocks: requireArray(input.blocks, `${label}.blocks`).map((entry, index) =>
				parseFrontendFeedBlock(entry, `${label}.blocks[${index}]`),
			),
		};
	}
	if (type === "queued") {
		return {
			type,
			id,
			queueKind: requireEnumValue(input.queueKind, `${label}.queueKind`, ["steer", "followUp"]),
			text: requireTextValue(input.text, `${label}.text`),
			phase: requireEnumValue(input.phase, `${label}.phase`, ["pending", "queued", "applied"]),
		};
	}
	if (type === "divider") {
		return {
			type,
			id,
			label: requireString(input.label, `${label}.label`),
			tone: requireEnumValue(input.tone, `${label}.tone`, ["active", "done", "info", "error"]),
			animated: input.animated === undefined ? undefined : requireBoolean(input.animated, `${label}.animated`),
			activityStartedAt: optionalSafeInteger(input.activityStartedAt, `${label}.activityStartedAt`),
			activityEndedAt: optionalSafeInteger(input.activityEndedAt, `${label}.activityEndedAt`),
			activityLabel: optionalString(input.activityLabel, `${label}.activityLabel`),
			detail: optionalString(input.detail, `${label}.detail`),
			activitySteps:
				input.activitySteps === undefined
					? undefined
					: requireArray(input.activitySteps, `${label}.activitySteps`).map((entry, index) => {
							const step = requireRecord(entry, `${label}.activitySteps[${index}]`);
							return {
								id: requireString(step.id, `${label}.activitySteps[${index}].id`),
								label: requireString(step.label, `${label}.activitySteps[${index}].label`),
								state: requireEnumValue(step.state, `${label}.activitySteps[${index}].state`, [
									"pending",
									"active",
									"complete",
								]),
							};
						}),
		};
	}
	if (type === "agent-activity") {
		const phase = requireString(input.phase, `${label}.phase`);
		if (
			phase !== "created" &&
			phase !== "running" &&
			phase !== "waiting" &&
			phase !== "completed" &&
			phase !== "failed"
		) {
			throw new Error(`${label}.phase is invalid`);
		}
		return {
			type,
			id,
			actorId: requireString(input.actorId, `${label}.actorId`),
			runId: requireString(input.runId, `${label}.runId`),
			nodeId: optionalString(input.nodeId, `${label}.nodeId`),
			title: requireString(input.title, `${label}.title`),
			detail: optionalString(input.detail, `${label}.detail`),
			phase,
			compactionCount: optionalSafeInteger(input.compactionCount, `${label}.compactionCount`),
		};
	}
	if (type === "message") {
		return {
			type,
			id,
			message: parseFrontendSubagentMessage(input.message, `${label}.message`),
			navigation:
				input.navigation === undefined ? undefined : parseNavigation(input.navigation, `${label}.navigation`),
		};
	}
	if (type === "notice") {
		return {
			type,
			id,
			...(input.permissionRequest === undefined
				? {}
				: { permissionRequest: parsePermissionRequestReview(input.permissionRequest) }),
			title: requireString(input.title, `${label}.title`),
			body: requireTextValue(input.body, `${label}.body`),
			level: requireEnumValue(input.level, `${label}.level`, ["info", "warning", "error"]),
			actions: requireArray(input.actions, `${label}.actions`).map((entry, index) =>
				parseFrontendAction(entry, `${label}.actions[${index}]`),
			),
			createdAt: requireSafeInteger(input.createdAt, `${label}.createdAt`),
		};
	}
	throw new Error(`${label}.type is an unknown feed block variant`);
}

function parseFrontendToolActivity(value: unknown, label: string): FrontendToolActivityViewModel {
	const input = requireRecord(value, label);
	return {
		id: requireString(input.id, `${label}.id`),
		semanticKind: requireString(input.semanticKind, `${label}.semanticKind`),
		category: requireEnumValue(input.category, `${label}.category`, [
			"read",
			"edit",
			"write",
			"list",
			"search",
			"link",
			"move",
			"trash",
			"open",
			"graph",
			"task",
			"workspace",
			"command",
			"import",
			"bash",
			"cli",
			"subagent",
			"metadata",
			"git",
			"capability",
			"memory",
			"skill",
			"event",
			"permission",
			"channel",
			"media",
			"other",
		]),
		phase: requireEnumValue(input.phase, `${label}.phase`, ["queued", "running", "succeeded", "failed", "cancelled"]),
		title: requireString(input.title, `${label}.title`),
		detail: optionalString(input.detail, `${label}.detail`),
		resultSummary: optionalString(input.resultSummary, `${label}.resultSummary`),
		iconToken: input.iconToken === undefined ? undefined : requireIconToken(input.iconToken, `${label}.iconToken`),
		startedAt: optionalSafeInteger(input.startedAt, `${label}.startedAt`),
		completedAt: optionalSafeInteger(input.completedAt, `${label}.completedAt`),
		expandable: requireBoolean(input.expandable, `${label}.expandable`),
	};
}

function parseFrontendAttachment(value: unknown, label: string): FrontendFeedAttachment {
	const input = requireRecord(value, label);
	return {
		name: requireString(input.name, `${label}.name`),
		kind: requireEnumValue(input.kind, `${label}.kind`, ["image", "text", "binary"]),
		mimeType: optionalString(input.mimeType, `${label}.mimeType`),
		path: optionalString(input.path, `${label}.path`),
		sizeBytes: optionalSafeInteger(input.sizeBytes, `${label}.sizeBytes`),
		data: optionalString(input.data, `${label}.data`),
	};
}

function parseFrontendAction(value: unknown, label: string): FrontendActionViewModel {
	const input = requireRecord(value, label);
	return {
		id: requireString(input.id, `${label}.id`),
		label: requireString(input.label, `${label}.label`),
		kind: requireEnumValue(input.kind, `${label}.kind`, ["primary", "secondary", "danger"]),
		iconToken: input.iconToken === undefined ? undefined : requireIconToken(input.iconToken, `${label}.iconToken`),
		disabledReason: optionalString(input.disabledReason, `${label}.disabledReason`),
	};
}

function parseNavigation(value: unknown, label: string): FrontendNavigationReference {
	const input = requireRecord(value, label);
	return {
		mainSessionId: requireString(input.mainSessionId, `${label}.mainSessionId`),
		actorId: optionalString(input.actorId, `${label}.actorId`),
		runId: optionalString(input.runId, `${label}.runId`),
		nodeId: optionalString(input.nodeId, `${label}.nodeId`),
		channelId: optionalString(input.channelId, `${label}.channelId`),
	};
}

function parseFrontendScreenDirectoryEntry(value: unknown, label: string): FrontendScreenDirectoryEntry {
	const input = requireRecord(value, label);
	return {
		id: requireScreenId(input.id, `${label}.id`),
		label: requireString(input.label, `${label}.label`),
		available: requireBoolean(input.available, `${label}.available`),
		revision: requireSafeInteger(input.revision, `${label}.revision`),
		unavailableReason: optionalString(input.unavailableReason, `${label}.unavailableReason`),
	};
}

function parseFrontendLocalCommand(value: unknown, label: string): FrontendLocalCommandViewModel {
	const input = requireRecord(value, label);
	requireJsonValue(input, label);
	return input as unknown as FrontendLocalCommandViewModel;
}

function parseFrontendPatchOperation(value: unknown, label: string): FrontendPatchOperation {
	const input = requireRecord(value, label);
	const type = requireString(input.type, `${label}.type`);
	if (type === "session.clear") return { type };
	if (type === "session.replace") return { type, session: parseFrontendSession(input.session) };
	if (type === "task-plan.replace") return { type, taskPlan: parseFrontendTaskPlan(input.taskPlan) };
	if (type === "composer.replace") return { type, composer: parseFrontendComposer(input.composer) };
	if (type === "agent-rail.replace") return { type, agentRail: parseFrontendAgentRail(input.agentRail) };
	if (type === "local-commands.replace") {
		return {
			type,
			localCommands: requireArray(input.localCommands, `${label}.localCommands`).map((entry, index) =>
				parseFrontendLocalCommand(entry, `${label}.localCommands[${index}]`),
			),
		};
	}
	if (type === "feed.document.replace") return { type, feed: parseFrontendFeedDocument(input.feed) };
	if (type === "feed.block.upsert") {
		return {
			type,
			index: requireSafeInteger(input.index, `${label}.index`),
			block: parseFrontendFeedBlock(input.block, `${label}.block`),
		};
	}
	if (type === "feed.block.remove") return { type, blockId: requireString(input.blockId, `${label}.blockId`) };
	if (type === "feed.text.append") {
		return {
			type,
			blockId: requireString(input.blockId, `${label}.blockId`),
			text:
				typeof input.text === "string"
					? input.text
					: (() => {
							throw new Error(`${label}.text must be a string`);
						})(),
		};
	}
	if (type === "feed.turn.finalize") {
		return {
			type,
			turnId: requireString(input.turnId, `${label}.turnId`),
			completedAt: requireSafeInteger(input.completedAt, `${label}.completedAt`),
		};
	}
	if (type === "screen.replace") return { type, screen: parseFrontendScreen(input.screen) };
	throw new Error(`${label}.type is an unknown patch operation`);
}

function parseUnavailableCapability(value: unknown, label: string): FrontendUnavailableCapability {
	const input = requireRecord(value, label);
	const reason = requireString(input.reason, `${label}.reason`);
	if (
		reason !== "not-requested" &&
		reason !== "runtime-unavailable" &&
		reason !== "connector-unsupported" &&
		reason !== "requires-newer-protocol"
	) {
		throw new Error(`${label}.reason is invalid`);
	}
	return {
		capability: requireFrontendCapability(input.capability, `${label}.capability`),
		reason,
		detail: optionalString(input.detail, `${label}.detail`),
	};
}

function validateReplay(
	replay: readonly FrontendPatch[],
	baseSequence: number,
	baseRevision: number,
	sequence: number,
	revision: number,
): void {
	let expectedSequence = baseSequence;
	let expectedRevision = baseRevision;
	for (const patch of replay) {
		expectedSequence += 1;
		if (patch.sequence !== expectedSequence || patch.baseRevision !== expectedRevision) {
			throw new Error("frontend replay is not contiguous");
		}
		expectedRevision = patch.revision;
	}
	if (expectedSequence !== sequence || expectedRevision !== revision) {
		throw new Error("frontend replay does not reach the declared cutover");
	}
}

function requireProtocolErrorCode(value: unknown): FrontendProtocolErrorCode {
	const code = requireString(value, "code");
	const codes: ReadonlySet<string> = new Set<FrontendProtocolErrorCode>([
		"malformed-envelope",
		"malformed-entity",
		"unsupported-protocol-version",
		"unsupported-capability",
		"sequence-gap",
		"replay-too-old",
		"future-sequence",
		"runtime-replaced",
		"revision-conflict",
		"stale-screen-response",
		"unauthorized-view",
		"internal-failure",
	]);
	if (!codes.has(code)) throw new Error("code is not a known frontend protocol error");
	return code as FrontendProtocolErrorCode;
}

function requireNotice(value: unknown): FrontendNotice {
	const input = requireRecord(value, "notice");
	const level = requireString(input.level, "notice.level");
	if (level !== "info" && level !== "warning" && level !== "error") throw new Error("notice.level is invalid");
	return { level, message: requireString(input.message, "notice.message") };
}

function optionalNotice(value: unknown): FrontendNotice | undefined {
	return value === undefined ? undefined : requireNotice(value);
}

function optionalStringRecord(value: unknown, label: string): Readonly<Record<string, string>> | undefined {
	if (value === undefined) return undefined;
	const input = requireRecord(value, label);
	return Object.fromEntries(
		Object.entries(input).map(([key, entry]) => [key, requireString(entry, `${label}.${key}`)]),
	);
}

function requireScreenId(value: unknown, label: string): FrontendScreenId {
	const id = requireString(value, label);
	if (
		id === "projects" ||
		id === "memory" ||
		id === "permissions" ||
		id === "events" ||
		id === "queries" ||
		id === "channels" ||
		id === "subagents" ||
		id === "mcp"
	)
		return id;
	throw new Error(`${label} is invalid`);
}

function requireSchemaVersion(input: Record<string, unknown>): void {
	if (input.schemaVersion !== 1)
		throw new Error(`Unsupported frontend schema version: ${String(input.schemaVersion)}`);
}

function requireProtocolVersion(input: Record<string, unknown>): void {
	if (input.protocolVersion !== CHATOBBY_FRONTEND_PROTOCOL_VERSION) {
		throw new Error(`Unsupported frontend protocol version: ${String(input.protocolVersion)}`);
	}
}

const FRONTEND_CAPABILITIES: ReadonlySet<string> = new Set<FrontendCapability>([
	"workspace-pages",
	"native-sandbox-setup",
	"obsidian-vault-access",
	"atomic-bootstrap-cutover",
	"bounded-replay",
	"typed-protocol-errors",
	"revisioned-screen-cache",
	"complete-feed-entities",
	"session-clear",
	"pagination-v2",
	"intent-outcomes-v2",
]);

function requireFrontendCapability(value: unknown, label: string): FrontendCapability {
	const capability = requireString(value, label);
	if (!FRONTEND_CAPABILITIES.has(capability)) throw new Error(`${label} is not a known frontend capability`);
	return capability as FrontendCapability;
}

function requireIconToken(value: unknown, label: string): FrontendIconToken {
	return requireString(value, label) as FrontendIconToken;
}

function optionalText(value: unknown, label: string): string {
	if (value === undefined) return "";
	if (typeof value !== "string") throw new Error(`${label} must be a string`);
	return value;
}

function permissionProfileRevision(payload: Record<string, unknown>): number {
	return requireSafeInteger(payload.expectedProfileRevision, "payload.expectedProfileRevision");
}

function requireNumberArray(value: unknown, label: string): number[] {
	return requireArray(value, label).map((entry, index) => requireSafeInteger(entry, `${label}[${index}]`));
}

function optionalThinkingLevel(value: unknown): ThinkingLevel | undefined {
	if (value === undefined) return undefined;
	if (
		value === "off" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	throw new Error(`payload.thinkingLevel is invalid: ${String(value)}`);
}

function optionalAutoNameStrategy(value: unknown): "truncate" | "model" | undefined {
	if (value === undefined) return undefined;
	if (value !== "truncate" && value !== "model") throw new Error("payload.autoNameStrategy must be truncate or model");
	return value;
}

function requireMemoryCollectionFilter(value: unknown): FrontendMemoryCollectionFilter {
	if (
		value === "all" ||
		value === "profile" ||
		value === "knowledge" ||
		value === "vault" ||
		value === "project" ||
		value === "lessons"
	) {
		return value;
	}
	throw new Error(`payload.collection is invalid: ${String(value)}`);
}

function requireMemoryScopeFilter(value: unknown): FrontendMemoryScopeFilter {
	if (value === "available" || value === "vault" || value === "current-project") return value;
	throw new Error(`payload.scopeFilter is invalid: ${String(value)}`);
}

function requireMemoryStatusFilter(value: unknown): FrontendMemoryStatusFilter {
	if (value === "active" || value === "archived" || value === "all") return value;
	throw new Error(`payload.status is invalid: ${String(value)}`);
}

function requireMemoryCategoryFilter(value: unknown): FrontendMemoryCategoryFilter {
	if (
		value === "all" ||
		value === "uncategorized" ||
		value === "failure" ||
		value === "correction" ||
		value === "insight" ||
		value === "preference" ||
		value === "convention" ||
		value === "tool-quirk"
	) {
		return value;
	}
	throw new Error(`payload.category is invalid: ${String(value)}`);
}

function requireMemorySort(value: unknown): FrontendMemorySort {
	if (value === "updated-desc" || value === "last-used-desc" || value === "created-desc" || value === "created-asc") {
		return value;
	}
	throw new Error(`payload.sort is invalid: ${String(value)}`);
}

function optionalMemoryBoundaryMode(value: unknown): FrontendMemoryBoundaryMode | undefined {
	if (value === undefined || value === "inherit" || value === "separate" || value === "project-only") return value;
	throw new Error(`payload.projectBoundaryMode is invalid: ${String(value)}`);
}

function requireMcpScope(value: unknown): "user" | "project" {
	if (value === "user" || value === "project") return value;
	throw new Error("MCP scope must be user or project");
}

function parseMcpServerDraft(value: unknown): FrontendMcpServerDraft {
	const input = requireRecord(value, "payload.draft");
	const transport = requireString(input.transport, "payload.draft.transport");
	if (transport !== "local" && transport !== "remote") {
		throw new Error("payload.draft.transport is invalid");
	}
	const lifecycle = requireString(input.lifecycle, "payload.draft.lifecycle");
	if (lifecycle !== "keep-alive" && lifecycle !== "lazy" && lifecycle !== "eager") {
		throw new Error("payload.draft.lifecycle is invalid");
	}
	const authentication = optionalString(input.authentication, "payload.draft.authentication");
	if (
		authentication !== undefined &&
		authentication !== "oauth" &&
		authentication !== "bearer" &&
		authentication !== "none"
	) {
		throw new Error("payload.draft.authentication is invalid");
	}
	const parseReferences = (references: unknown, label: string): FrontendMcpServerDraft["environment"] =>
		references === undefined
			? undefined
			: requireArray(references, label).map((entry, index) => {
					const reference = requireRecord(entry, `${label}[${index}]`);
					return {
						name: requireString(reference.name, `${label}[${index}].name`),
						sourceEnvironmentVariable: requireString(
							reference.sourceEnvironmentVariable,
							`${label}[${index}].sourceEnvironmentVariable`,
						),
					};
				});
	const registry =
		input.registry === undefined
			? undefined
			: (() => {
					const record = requireRecord(input.registry, "payload.draft.registry");
					if (record.source !== "official") throw new Error("payload.draft.registry.source is invalid");
					return {
						source: "official" as const,
						serverName: requireString(record.serverName, "payload.draft.registry.serverName"),
						version: requireString(record.version, "payload.draft.registry.version"),
						packageIdentifier: optionalString(
							record.packageIdentifier,
							"payload.draft.registry.packageIdentifier",
						),
					};
				})();
	return {
		name: requireString(input.name, "payload.draft.name"),
		scope: requireMcpScope(input.scope),
		enabled: requireBoolean(input.enabled, "payload.draft.enabled"),
		lifecycle,
		transport,
		command: optionalString(input.command, "payload.draft.command"),
		arguments:
			input.arguments === undefined ? undefined : requireStringArray(input.arguments, "payload.draft.arguments"),
		workingDirectory: optionalString(input.workingDirectory, "payload.draft.workingDirectory"),
		url: optionalString(input.url, "payload.draft.url"),
		authentication,
		bearerCredentialReference: optionalString(
			input.bearerCredentialReference,
			"payload.draft.bearerCredentialReference",
		),
		bearerTokenEnvironmentVariable: optionalString(
			input.bearerTokenEnvironmentVariable,
			"payload.draft.bearerTokenEnvironmentVariable",
		),
		environment: parseReferences(input.environment, "payload.draft.environment"),
		headers: parseReferences(input.headers, "payload.draft.headers"),
		registry,
	};
}

function parseMemoryPolicyPatch(
	payload: Record<string, unknown>,
): Extract<FrontendIntent, { type: "memory.update-policy" }>["payload"] {
	const expectedMemoryRevision = requireSafeInteger(payload.expectedMemoryRevision, "payload.expectedMemoryRevision");
	const backgroundLearning = optionalLearningMode(payload.backgroundLearning, "payload.backgroundLearning");
	const correctionLearning = optionalLearningMode(payload.correctionLearning, "payload.correctionLearning");
	const promptRouting = optionalPromptRouting(payload.promptRouting);
	const projectBoundaryMode = optionalMemoryBoundaryMode(payload.projectBoundaryMode);
	if (
		backgroundLearning === undefined &&
		correctionLearning === undefined &&
		promptRouting === undefined &&
		projectBoundaryMode === undefined
	) {
		throw new Error("memory.update-policy requires at least one change");
	}
	return { expectedMemoryRevision, backgroundLearning, correctionLearning, promptRouting, projectBoundaryMode };
}

function optionalLearningMode(value: unknown, label: string): "off" | "suggest" | "auto" | undefined {
	if (value === undefined || value === "off" || value === "suggest" || value === "auto") return value;
	throw new Error(`${label} is invalid`);
}

function optionalPromptRouting(value: unknown): "off" | "profile-project" | "hybrid" | undefined {
	if (value === undefined || value === "off" || value === "profile-project" || value === "hybrid") return value;
	throw new Error("payload.promptRouting is invalid");
}

function requirePermissionDecision(value: unknown): FrontendPermissionDecision {
	if (value === "allow" || value === "ask" || value === "deny") return value;
	throw new Error("payload.decision is invalid");
}

function requirePermissionAuthority(value: unknown): FrontendPermissionAuthority {
	const authority = requireRecord(value, "payload.authority");
	if (authority.kind === "main") {
		return {
			kind: "main",
			mainSessionId: requireString(authority.mainSessionId, "payload.authority.mainSessionId"),
		};
	}
	if (authority.kind === "subagent") {
		return {
			kind: "subagent",
			mainSessionId: requireString(authority.mainSessionId, "payload.authority.mainSessionId"),
			runId: requireString(authority.runId, "payload.authority.runId"),
			nodeId: requireString(authority.nodeId, "payload.authority.nodeId"),
		};
	}
	if (authority.kind === "event") {
		const mainSessionId = optionalString(authority.mainSessionId, "payload.authority.mainSessionId");
		return {
			kind: "event",
			eventId: requireString(authority.eventId, "payload.authority.eventId"),
			eventSessionId: requireString(authority.eventSessionId, "payload.authority.eventSessionId"),
			...(mainSessionId ? { mainSessionId } : {}),
		};
	}
	throw new Error("payload.authority.kind is invalid");
}

function requirePermissionRuleSection(value: unknown): "path" | "external_directory" | "bash" | "skill" {
	if (value === "path" || value === "external_directory" || value === "bash" || value === "skill") return value;
	throw new Error("payload.section is invalid");
}
