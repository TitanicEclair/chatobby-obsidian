// Generated from packages/chatobby/src/frontend-contracts.ts. Do not edit.
import {
	type FrontendSandboxRevokePayload,
	type FrontendSandboxSetupPayload,
	type FrontendSandboxSetupViewModel,
	type FrontendSandboxVerifyPayload,
	parseFrontendSandboxRevokePayload,
	parseFrontendSandboxSetupPayload,
	parseFrontendSandboxVerifyPayload,
	validateFrontendSandboxSetupView,
} from "./frontend-sandbox-contracts.ts";
import type { ThinkingLevel } from "./wire-types.ts";

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

export interface FrontendChoiceOption {
	readonly value: string;
	readonly label: string;
	readonly description?: string;
	readonly disabledReason?: string;
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

export type FrontendProjectLifecycleFilter = "active" | "archived" | "all";
export type FrontendProjectAvailabilityFilter =
	| "all"
	| "available"
	| "attention"
	| "missing"
	| "conflict"
	| "relink-required";
export type FrontendProjectSort =
	| "activity-desc"
	| "created-desc"
	| "created-asc"
	| "name-asc"
	| "name-desc"
	| "relevance";
export type FrontendProjectSessionSort =
	| "updated-desc"
	| "created-desc"
	| "created-asc"
	| "name-asc"
	| "name-desc"
	| "message-count-desc"
	| "relevance";
export type FrontendProjectSessionSearchMode = "titles" | "messages";

export interface FrontendProjectRootViewModel {
	readonly rootId: string;
	readonly directoryId: string;
	readonly label: string;
	readonly primary: boolean;
	readonly locationKind: "vault-relative" | "external";
	readonly vaultRelativePath?: string;
	/** Device-local UI projection. Never persist, log, export, or place in portable Project records. */
	readonly localPath?: string;
	readonly directoryReuse: "canonical" | "none";
	readonly markerPolicy: "required" | "optional" | "disabled";
	readonly recoveryMode: "marker" | "device-binding-only";
	readonly availability: "available" | "missing" | "conflict" | "relink-required" | "unregistered";
	readonly availabilityLabel: string;
	readonly recoveryAction?: "relink" | "resolve-conflict" | "repair-marker";
}

export interface FrontendProjectSessionViewModel {
	readonly sessionId: string;
	readonly workspaceBindingRevision: number;
	readonly workspace: { readonly kind: "vault" } | { readonly kind: "project"; readonly projectId: string };
	readonly name: string;
	/** Absent while a live first turn has not materialized its transcript. */
	readonly createdAt?: string;
	readonly updatedAt?: string;
	readonly messageCount: number;
	readonly running: boolean;
	/** Actual live turn activity, independent of which conversation a page is viewing. */
	readonly active?: boolean;
	readonly activeRootId?: string;
	/** Bounded excerpt emitted only when message-content search matched this chat. */
	readonly matchSnippet?: string;
}

export interface FrontendProjectMessageSearchHitViewModel {
	readonly hitId: string;
	readonly sessionId: string;
	readonly sessionName: string;
	readonly messageId: string;
	readonly targetBlockId: string;
	readonly role: "user" | "assistant";
	readonly timestamp: string;
	readonly excerpt: string;
	readonly matchRanges: readonly { readonly start: number; readonly end: number }[];
}

export interface FrontendProjectMessageSearchPageViewModel {
	readonly items: readonly FrontendProjectMessageSearchHitViewModel[];
	readonly page: number;
	readonly pageSize: number;
	readonly totalCount: number;
	readonly hasPrevious: boolean;
	readonly hasNext: boolean;
}

export interface FrontendProjectSessionDestinationViewModel {
	readonly projectId: string;
	readonly name: string;
	readonly available: boolean;
	readonly availabilityLabel: string;
}

export interface FrontendProjectSummaryViewModel {
	readonly projectId: string;
	readonly revision: number;
	readonly name: string;
	readonly description?: string;
	readonly lifecycle: "active" | "archived";
	readonly creationKind: "directory-session" | "manual" | "migration";
	readonly primaryRootId?: string;
	readonly primaryRootLabel?: string;
	readonly canonicalVaultRelativePath?: string;
	readonly rootCount: number;
	readonly sessionCount: number;
	readonly availability: "available" | "attention" | "missing" | "conflict" | "relink-required";
	readonly availabilityLabel: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	/** Latest Project metadata or child-chat activity, whichever is newer. */
	readonly activityAt: string;
}

export interface FrontendProjectDetailViewModel {
	readonly projectId: string;
	readonly revision: number;
	readonly name: string;
	readonly description?: string;
	readonly lifecycle: "active" | "archived";
	readonly creationKind: "directory-session" | "manual" | "migration";
	readonly primaryRootId?: string;
	readonly roots: readonly FrontendProjectRootViewModel[];
	readonly sessionCount: number;
	readonly sessions: readonly FrontendProjectSessionViewModel[];
}

export interface FrontendRunningWorkspaceViewModel {
	readonly kind: "vault" | "project" | "unresolved";
	readonly label: string;
	readonly projectId?: string;
	readonly activeRootId?: string;
	readonly attachedRootIds: readonly string[];
}

export interface FrontendProjectScreenViewModel {
	readonly screenId: "projects";
	readonly revision: number;
	readonly snapshotSequence: number;
	readonly loading: boolean;
	readonly error?: string;
	readonly statusMessage?: string;
	readonly query: string;
	readonly lifecycleFilter: FrontendProjectLifecycleFilter;
	readonly availabilityFilter: FrontendProjectAvailabilityFilter;
	readonly sort: FrontendProjectSort;
	readonly sessionQuery: string;
	readonly sessionSearchMode: FrontendProjectSessionSearchMode;
	readonly sessionSort: FrontendProjectSessionSort;
	readonly sessionSearchPage: number;
	readonly selectedProjectId?: string;
	readonly runningIn: FrontendRunningWorkspaceViewModel;
	readonly projects: readonly FrontendProjectSummaryViewModel[];
	/** Unfiltered active Projects available to the Move chat picker. */
	readonly sessionMoveProjects: readonly FrontendProjectSessionDestinationViewModel[];
	readonly vaultSessionCount: number;
	readonly vaultSessions: readonly FrontendProjectSessionViewModel[];
	/** Workspace navigation across all Projects; browsing does not select a session. */
	readonly navigatorSessions?: readonly FrontendProjectSessionViewModel[];
	readonly detail?: FrontendProjectDetailViewModel;
	/** Available roots for the chat that is actually running, independent of the Project being viewed. */
	readonly runningRoots: readonly FrontendProjectRootViewModel[];
	/** Bounded exact message matches for the selected Project or Vault scope. */
	readonly messageSearchPage?: FrontendProjectMessageSearchPageViewModel;
	readonly lifecycleOptions: readonly FrontendChoiceOption[];
	readonly availabilityOptions: readonly FrontendChoiceOption[];
	readonly sortOptions: readonly FrontendChoiceOption[];
	readonly sessionSearchModeOptions: readonly FrontendChoiceOption[];
	readonly sessionSortOptions: readonly FrontendChoiceOption[];
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

export const OBSIDIAN_VAULT_ACCESS_WARNING = "Uses Obsidian’s app authority outside the sandbox.";

export type FrontendObsidianVaultAccessViewModel =
	| {
			readonly status: "available";
			readonly revision: number;
			readonly sessionId: string;
			readonly bindingRevision: number;
			readonly enabled: boolean;
			readonly source: "default" | "user";
			readonly warning: typeof OBSIDIAN_VAULT_ACCESS_WARNING;
	  }
	| {
			readonly status: "unavailable";
			readonly enabled: false;
			readonly warning: typeof OBSIDIAN_VAULT_ACCESS_WARNING;
			readonly reason: string;
	  };

export interface FrontendPermissionScreenViewModel {
	readonly screenId: "permissions";
	readonly revision: number;
	/** Durable policy owner; delegated sessions display this inherited authority read-only. */
	readonly accessPolicySessionId: string;
	readonly accessPolicy: {
		readonly schemaVersion: 1;
		readonly revision: number;
		readonly accessMode: "read-only" | "workspace" | "full";
		readonly agentNetworkAccess: boolean;
	};
	readonly scope: {
		readonly bindingRevision: number;
		readonly kind: "project" | "vault";
		readonly selectedRootCount: number;
		readonly filesystemBound: boolean;
	};
	readonly nativeSupport: {
		readonly status: "ready" | "setup-required" | "unverified" | "unsupported";
		readonly backendId?: "windows-appcontainer" | "linux-bubblewrap" | "macos-seatbelt" | "landstrip";
		readonly reason?: string;
		readonly userAction?: string;
	};
	/** Absent only for additive compatibility with older runtimes; never infer a grant. */
	readonly obsidianVaultAccess?: FrontendObsidianVaultAccessViewModel;
	/** Explicit operator choices across this Vault; independent of session policy. */
	readonly workspaceVaultAccess?: readonly {
		readonly projectId: string | null;
		readonly projectRevision?: number;
		readonly label: string;
		readonly revision: number;
		readonly enabled: boolean;
		readonly source: "default" | "user";
	}[];
	/** Explicit setup/recovery, never a substitute for nativeSupport proof. Omitted without negotiation. */
	readonly nativeSetup?: FrontendSandboxSetupViewModel;
	readonly effective: {
		readonly fileRead: boolean;
		readonly fileWrite: boolean;
		readonly localProcess: "native-contained" | "unavailable" | "unsandboxed";
		readonly obsidian: "typed-read" | "typed-workspace" | "unavailable" | "unsandboxed" | "app-authority";
		readonly agentNetworkAccess: boolean;
		readonly warning?: string;
	};
	readonly migrationNotice?: string;
	readonly loading: boolean;
	readonly error?: string;
	readonly statusMessage?: string;
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

/** Public subagent contracts intentionally decoupled from the private supervisor package. */
export type FrontendSubagentExecutionMode = "auto" | "in-process" | "worker-process";
export type FrontendSubagentResolvedExecutionMode = Exclude<FrontendSubagentExecutionMode, "auto">;
export type FrontendSubagentContextMode = "fresh" | "fork";
/** Internal resolution layers reported to the frontend for provenance and effective settings. */
export type FrontendSubagentResolutionLayer = "global" | "vault" | "directory" | "session";
/** Availability choices accepted when a user creates or edits an agent role. */
export type FrontendSubagentUserDefinitionScope = "vault" | "directory";
export type FrontendSubagentRunStatus =
	| "created"
	| "queued"
	| "running"
	| "paused"
	| "waiting"
	| "completed"
	| "failed"
	| "cancelled"
	| "orphaned";
export type FrontendSubagentNodeStatus =
	| "blocked"
	| "queued"
	| "running"
	| "waiting"
	| "paused"
	| "completed"
	| "failed"
	| "cancelled"
	| "skipped"
	| "orphaned";
export type FrontendSubagentControlAction =
	| "cancel"
	| "pause"
	| "resume"
	| "interrupt"
	| "steer"
	| "complete"
	| "retry"
	| "reprioritize"
	| "fork"
	| "clone"
	| "decide-child-input"
	| "decide-tool-permission"
	| "adopt"
	| "reconcile-orphan"
	| "approve-permission"
	| "deny-permission"
	| "approve-acceptance"
	| "reject-acceptance"
	| "extend-budget";
export type FrontendSubagentControlReceiptAction = FrontendSubagentControlAction | "set-permission-profile";

export interface FrontendSubagentRuntimePolicy {
	executionMode?: FrontendSubagentExecutionMode;
	model?: string;
	fallbackModels?: string[];
	thinking?: ThinkingLevel;
	tools?: string[];
	mcpTools?: string[];
	extensions?: string[];
	skills?: string[];
	contextMode?: FrontendSubagentContextMode;
	maxDepth?: number;
	maxTurnsPerNode?: number;
	maxTokens?: number;
	maxWallTimeMs?: number;
	maxToolCallsPerNode?: number;
	toolCallLimits?: Record<string, number>;
	permissionProfileId?: string;
}

export interface FrontendSubagentAgentDefinition {
	id: string;
	name: string;
	description: string;
	scope: FrontendSubagentResolutionLayer;
	scopeId: string;
	systemPrompt: string;
	enabled: boolean;
	policy: FrontendSubagentRuntimePolicy;
	/** Retained role policy is inert until saved without its legacy permission-profile override. */
	permissionReviewRequired?: true;
	builtIn?: true;
	revision: number;
	updatedAt: number;
}

export type FrontendSubagentUserAgentDefinition = Omit<FrontendSubagentAgentDefinition, "scope" | "builtIn"> & {
	scope: FrontendSubagentUserDefinitionScope;
	builtIn?: never;
};

export interface FrontendSubagentRunFilter {
	parentSessionId?: string;
	status?: FrontendSubagentRunStatus[];
	agentId?: string;
	executionMode?: FrontendSubagentResolvedExecutionMode;
	workspaceCwd?: string;
	search?: string;
	createdAfter?: number;
	createdBefore?: number;
}

export interface FrontendSubagentBudgets {
	maxConcurrency?: number;
	maxDepth?: number;
	maxTurnsPerNode?: number;
	maxTokens?: number;
	maxCostUsd?: number;
	maxWallTimeMs?: number;
	maxToolCallsPerNode?: number;
}

export type FrontendSubagentLaunchResolutionSource =
	| "node"
	| "run"
	| "role"
	| "parent"
	| "project"
	| "settings"
	| "fallback"
	| "auto";

/**
 * Browser-safe projection of an accepted launch contract. Private role
 * instructions and the materialized context packet never cross this boundary.
 */
export interface FrontendSubagentLaunchSummaryV1 {
	readonly schemaVersion: 1;
	readonly contractId: string;
	readonly resolutionFingerprint: string;
	readonly runId: string;
	readonly nodeId: string;
	readonly role: {
		readonly id: string;
		readonly name: string;
		readonly revision: number;
		readonly promptHash: string;
	};
	readonly model: {
		readonly selected: string;
		readonly thinking: ThinkingLevel;
		readonly fallbacks: readonly string[];
	};
	readonly executor: {
		readonly requested: FrontendSubagentExecutionMode;
		readonly selected: FrontendSubagentResolvedExecutionMode;
		readonly source: "node" | "run" | "role" | "auto";
		readonly reason: string;
		readonly runtimeFingerprintRequirement: string | null;
	};
	readonly context: {
		readonly mode: FrontendSubagentContextMode;
		readonly source: "node" | "run" | "role" | "fallback";
		readonly explicit: boolean;
		readonly packetFingerprint: string | null;
		readonly estimatedTokens: number;
		readonly messageCount: number;
	};
	readonly permission: {
		readonly profileId: string;
		readonly profileRevision: number;
		readonly profileFingerprint: string;
		readonly source: "run" | "node" | "role" | "project" | "fallback";
	};
	readonly budgets: {
		readonly limits: {
			readonly maxConcurrency: number | null;
			readonly maxDepth: number | null;
			readonly maxTurnsPerNode: number | null;
			readonly maxTokens: number | null;
			readonly maxCostUsd: number | null;
			readonly maxWallTimeMs: number | null;
			readonly maxToolCallsPerNode: number | null;
			readonly toolCallLimits: Readonly<Record<string, number>>;
		};
		readonly sources: {
			readonly maxConcurrency: FrontendSubagentLaunchResolutionSource;
			readonly maxDepth: FrontendSubagentLaunchResolutionSource;
			readonly maxTurnsPerNode: FrontendSubagentLaunchResolutionSource;
			readonly maxTokens: FrontendSubagentLaunchResolutionSource;
			readonly maxCostUsd: FrontendSubagentLaunchResolutionSource;
			readonly maxWallTimeMs: FrontendSubagentLaunchResolutionSource;
			readonly maxToolCallsPerNode: FrontendSubagentLaunchResolutionSource;
			readonly toolCallLimits: FrontendSubagentLaunchResolutionSource;
		};
		readonly preflight: {
			readonly estimatedInitialTokens: number;
			readonly responseReserveTokens: number;
			readonly recommendedMinimumTokens: number;
			readonly toolCount: number;
			readonly method: "conservative-chars-per-token";
			readonly sourceFingerprint: string;
		};
	};
	readonly tools: {
		readonly capabilityPreset: string | null;
		readonly eligibleNames: readonly string[];
		readonly eligibleActions: Readonly<Record<string, readonly string[]>>;
		readonly mcpNames: readonly string[];
		readonly skills: readonly string[];
		readonly productExtensions: readonly string[];
		readonly registryFingerprint: string;
		readonly eligibleFingerprint: string;
		readonly source: "role" | "fallback";
	};
	readonly workspace: {
		readonly request: {
			readonly mode: "shared" | "worktree" | "sandbox";
			readonly cwd: string;
			readonly artifactDirectory: string | null;
			readonly providerRequirement: string | null;
			readonly source: "run";
		};
		readonly materialized: {
			readonly resolvedCwd: string;
			readonly provider: string;
			readonly workspaceId: string;
			readonly baseRevision: string | null;
		};
	};
	readonly definitionChangedSinceLaunch: boolean;
}

export interface FrontendSubagentPermissionRequestViewModel {
	id: string;
	revision: number;
	runId: string;
	nodeId: string;
	kind: "confirm" | "select" | "input";
	title: string;
	message?: string;
	options?: string[];
	placeholder?: string;
	status: "pending" | "approved" | "denied";
	createdAt: number;
	decidedAt?: number;
	value?: string;
}

export interface FrontendSubagentAcceptanceRecordViewModel {
	runId: string;
	nodeId: string;
	level: "none" | "attested" | "checked" | "verified" | "reviewed";
	status: "accepted" | "rejected" | "waiting-review";
	criteria: string[];
	checks: {
		id: string;
		command: string;
		exitCode: number | null;
		stdout: string;
		stderr: string;
		timedOut: boolean;
		durationMs: number;
	}[];
	reviewerAgentId?: string;
	decidedAt?: number;
	decisionNote?: string;
}

export interface FrontendSubagentNodeViewModel {
	id: string;
	parentNodeId?: string;
	fanoutIndex?: number;
	fanoutItem?: unknown;
	agentId: string;
	agentName?: string;
	label: string;
	task: string;
	status: FrontendSubagentNodeStatus;
	dependsOn: string[];
	priority: number;
	requestedExecutionMode: FrontendSubagentExecutionMode;
	/** Compact accepted launch facts; private role instructions and context packet are omitted. */
	launchSummary?: FrontendSubagentLaunchSummaryV1;
	runtimePolicy?: FrontendSubagentRuntimePolicy;
	resolvedExecutionMode?: FrontendSubagentResolvedExecutionMode;
	model?: string;
	queuePosition?: number;
	currentTool?: string;
	contextPercent?: number;
	turns: number;
	tokens: number;
	costUsd: number;
	startedAt?: number;
	completedAt?: number;
	attempts: {
		id: string;
		number: number;
		mode: FrontendSubagentResolvedExecutionMode;
		status: FrontendSubagentNodeStatus;
		startedAt?: number;
		completedAt?: number;
		runtimeFingerprint?: string;
		error?: string;
	}[];
	artifactIds: string[];
	result?: string;
	structuredOutput?: unknown;
	acceptanceStatus?: "not-required" | "accepted" | "rejected" | "waiting-review";
	acceptanceRecord?: FrontendSubagentAcceptanceRecordViewModel;
	pendingPermission?: FrontendSubagentPermissionRequestViewModel;
	latestMessageId?: string;
	error?: string;
}

export interface FrontendSubagentRunViewModel {
	id: string;
	runtimeId: string;
	parentSessionId: string;
	triggerSource: "parent-agent" | "user" | "scheduler" | "automation" | "api";
	description: string;
	status: FrontendSubagentRunStatus;
	priority: number;
	createdAt: number;
	updatedAt: number;
	startedAt?: number;
	completedAt?: number;
	lastSequence: number;
	budgets: FrontendSubagentBudgets;
	context: { mode: FrontendSubagentContextMode };
	permissionProfileId?: string;
	workspace: {
		cwd: string;
		mode: "shared" | "worktree" | "sandbox";
		artifactDirectory?: string;
		resolvedCwd: string;
		provider: string;
		workspaceId: string;
		baseRevision?: string;
		baselineFileStates?: Record<string, string>;
		changedFiles: string[];
		createdAt: number;
	};
	parent?: { runId: string; nodeId: string; depth: number };
	failFast: boolean;
	nodes: Record<string, FrontendSubagentNodeViewModel>;
	rootNodeIds: string[];
	error?: string;
}

export interface FrontendSubagentRunSummaryViewModel {
	id: string;
	parentSessionId: string;
	triggerSource: "parent-agent" | "user" | "scheduler" | "automation" | "api";
	description: string;
	status: FrontendSubagentRunStatus;
	agentIds: string[];
	executionModes: FrontendSubagentResolvedExecutionMode[];
	workspaceCwd: string;
	activeNodes: number;
	queuedNodes: number;
	waitingNodes: number;
	failedNodes: number;
	tokens: number;
	costUsd: number;
	createdAt: number;
	updatedAt: number;
}

export interface FrontendSubagentArtifactViewModel {
	id: string;
	runId: string;
	nodeId: string;
	kind: "file" | "report" | "patch" | "structured-output" | "transcript" | "log";
	name: string;
	path: string;
	mimeType?: string;
	bytes?: number;
	revision: number;
	createdAt: number;
	updatedAt: number;
	promotedVaultPath?: string;
}

export interface FrontendSubagentActorViewModel {
	kind: "user" | "parent" | "agent" | "system";
	id: string;
	label?: string;
}

export interface FrontendSubagentMessageViewModel {
	id: string;
	runId: string;
	nodeId?: string;
	threadId: string;
	from: FrontendSubagentActorViewModel;
	to: FrontendSubagentActorViewModel[];
	kind: "inform" | "request" | "decision" | "steer" | "result";
	text: string;
	data?: Record<string, unknown>;
	correlationId?: string;
	replyTo?: string;
	blocking: boolean;
	deadline?: number;
	status: "queued" | "delivered" | "acknowledged" | "expired" | "rejected";
	createdAt: number;
	acknowledgedAt?: number;
	response?: {
		actor: FrontendSubagentActorViewModel;
		text?: string;
		data?: Record<string, unknown>;
		createdAt: number;
	};
}

export interface FrontendSubagentControlReceiptViewModel {
	commandId: string;
	runId: string;
	nodeId?: string;
	action: FrontendSubagentControlReceiptAction;
	state: "requested" | "acknowledged" | "effective" | "failed" | "timed-out";
	message?: string;
	timestamp: number;
}

export interface FrontendSubagentCapabilitiesViewModel {
	protocolVersion: 1;
	runtimeId: string;
	executionModes: FrontendSubagentResolvedExecutionMode[];
	supportsSiblingCommunication: boolean;
	supportsWorkerRecovery: boolean;
	workerRecoveryMode: "none" | "reconcile" | "adopt";
	supportsWorktrees: boolean;
	supportsArtifactPromotion: boolean;
	maxReplayEvents: number;
}

export interface FrontendSubagentSettingsViewModel {
	settings: {
		schemaVersion?: 2;
		maxConcurrency?: number;
		unlimitedConcurrency?: boolean;
		defaultExecutionMode: FrontendSubagentExecutionMode;
		defaultMaxDepth?: number;
		unlimitedDepth?: boolean;
		defaultMaxTurnsPerNode?: number;
		defaultMaxTokens?: number;
		defaultMaxCostUsd?: number;
		defaultMaxWallTimeMs?: number;
		automaticDelegation: "off" | "suggest" | "allowed";
		retentionDays: number;
		allowSiblingCommunication: boolean;
	};
	scope?: { kind: FrontendSubagentResolutionLayer; id: string };
	revision: number;
	sources: Partial<Record<string, { kind: FrontendSubagentResolutionLayer; id: string }>>;
}

export interface FrontendSubagentPermissionSnapshotViewModel {
	document: {
		profiles: { id: string; name: string }[];
		agentAssignments: Record<string, { mode: "inherit" } | { mode: "profile"; profileId: string }>;
	};
}

export type FrontendSubagentSyncStatus = "idle" | "loading" | "live" | "gap" | "error";

export interface FrontendSubagentModelViewModel {
	readonly id: string;
	readonly name: string;
	readonly provider: string;
}

export interface FrontendSubagentSkillViewModel {
	readonly name: string;
	readonly description?: string;
}

export interface FrontendSubagentArtifactGroupViewModel {
	readonly runId: string;
	readonly items: readonly FrontendSubagentArtifactViewModel[];
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
	| (FrontendIntentBase & {
			readonly type: "projects.set-view";
			readonly payload: {
				readonly query: string;
				readonly lifecycleFilter: FrontendProjectLifecycleFilter;
				readonly availabilityFilter: FrontendProjectAvailabilityFilter;
				readonly sort: FrontendProjectSort;
				readonly sessionQuery: string;
				readonly sessionSearchMode: FrontendProjectSessionSearchMode;
				readonly sessionSort: FrontendProjectSessionSort;
				readonly sessionSearchPage: number;
				readonly selectedProjectId?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.create";
			readonly payload: {
				readonly name: string;
				readonly description?: string;
				readonly rootMode?: "create-vault-folder" | "use-existing-folders";
				readonly roots?: readonly {
					readonly directoryCandidateRef: string;
					readonly label: string;
					readonly markerPolicy: "required" | "optional" | "disabled";
					readonly directoryReuse: "canonical" | "none";
				}[];
				readonly primaryDirectoryCandidateRef?: string;
				/** Legacy one-root compatibility; new connectors use rootMode and roots. */
				readonly vaultRelativePath?: string;
				readonly directoryCandidateRef?: string;
				readonly directoryReuse: "canonical" | "none";
				readonly markerPolicy: "required" | "optional" | "disabled";
				readonly useForCurrentSession?: boolean;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.replace-details";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly name: string;
				readonly description?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.archive" | "projects.restore";
			readonly payload: { readonly projectId: string; readonly expectedProjectRevision: number };
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.root-add";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly label: string;
				readonly vaultRelativePath?: string;
				readonly directoryCandidateRef?: string;
				readonly directoryReuse: "canonical" | "none";
				readonly markerPolicy: "required" | "optional" | "disabled";
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.roots-add-batch";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly roots: readonly {
					readonly directoryCandidateRef: string;
					readonly label: string;
					readonly markerPolicy: "required" | "optional" | "disabled";
					readonly directoryReuse: "canonical" | "none";
				}[];
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.root-relabel";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly rootId: string;
				readonly label: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.root-set-primary" | "projects.root-remove";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly rootId: string;
				readonly replacementRootId?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.root-recover";
			readonly payload: { readonly projectId: string; readonly rootId: string };
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.root-relink";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly rootId: string;
				readonly vaultRelativePath?: string;
				readonly directoryCandidateRef?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "projects.session-move";
			readonly payload: {
				readonly sessionId: string;
				readonly expectedWorkspaceBindingRevision: number;
				readonly target: { readonly kind: "vault" } | { readonly kind: "project"; readonly projectId: string };
			};
	  })
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
	if (input.type === "projects.set-view") {
		return {
			...base,
			type: input.type,
			payload: {
				query: typeof payload.query === "string" ? payload.query : "",
				lifecycleFilter: requireProjectLifecycleFilter(payload.lifecycleFilter),
				availabilityFilter: requireProjectAvailabilityFilter(payload.availabilityFilter),
				sort: requireProjectSort(payload.sort),
				sessionQuery: typeof payload.sessionQuery === "string" ? payload.sessionQuery : "",
				sessionSearchMode: requireProjectSessionSearchMode(payload.sessionSearchMode),
				sessionSort: requireProjectSessionSort(payload.sessionSort),
				sessionSearchPage: requireNonNegativeSafeInteger(
					payload.sessionSearchPage ?? 0,
					"payload.sessionSearchPage",
				),
				selectedProjectId: optionalString(payload.selectedProjectId, "payload.selectedProjectId"),
			},
		};
	}
	if (input.type === "projects.create") {
		const directoryReuse = requireString(payload.directoryReuse, "payload.directoryReuse");
		if (directoryReuse !== "canonical" && directoryReuse !== "none") {
			throw new Error("payload.directoryReuse is invalid");
		}
		const markerPolicy = requireString(payload.markerPolicy, "payload.markerPolicy");
		if (markerPolicy !== "required" && markerPolicy !== "optional" && markerPolicy !== "disabled") {
			throw new Error("payload.markerPolicy is invalid");
		}
		const vaultRelativePath = optionalString(payload.vaultRelativePath, "payload.vaultRelativePath");
		const directoryCandidateRef = optionalString(payload.directoryCandidateRef, "payload.directoryCandidateRef");
		const rootMode = optionalString(payload.rootMode, "payload.rootMode");
		if (rootMode !== undefined && rootMode !== "create-vault-folder" && rootMode !== "use-existing-folders") {
			throw new Error("payload.rootMode is invalid");
		}
		const roots =
			payload.roots === undefined ? undefined : requireProjectFolderSelections(payload.roots, "payload.roots");
		const primaryDirectoryCandidateRef = optionalString(
			payload.primaryDirectoryCandidateRef,
			"payload.primaryDirectoryCandidateRef",
		);
		if (rootMode === "use-existing-folders") {
			if (roots === undefined || roots.length === 0 || primaryDirectoryCandidateRef === undefined) {
				throw new Error("Existing-folder Project creation requires selected folders and one primary folder.");
			}
			if (!roots.some((root) => root.directoryCandidateRef === primaryDirectoryCandidateRef)) {
				throw new Error("The primary Project folder must be one of the selected folders.");
			}
		}
		if (rootMode === "create-vault-folder" && (roots !== undefined || primaryDirectoryCandidateRef !== undefined)) {
			throw new Error("Vault-folder Project creation cannot carry existing-folder selections.");
		}
		if (vaultRelativePath !== undefined && directoryCandidateRef !== undefined) {
			throw new Error("Choose either a vault folder or an operating-system directory candidate, not both.");
		}
		return {
			...base,
			type: input.type,
			payload: {
				name: requireString(payload.name, "payload.name"),
				description: optionalString(payload.description, "payload.description"),
				vaultRelativePath,
				directoryCandidateRef,
				...(rootMode === undefined ? {} : { rootMode }),
				...(roots === undefined ? {} : { roots }),
				...(primaryDirectoryCandidateRef === undefined ? {} : { primaryDirectoryCandidateRef }),
				directoryReuse,
				markerPolicy,
				useForCurrentSession:
					payload.useForCurrentSession === undefined
						? undefined
						: requireBoolean(payload.useForCurrentSession, "payload.useForCurrentSession"),
			},
		};
	}
	if (input.type === "projects.replace-details") {
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision: requireSafeInteger(
					payload.expectedProjectRevision,
					"payload.expectedProjectRevision",
				),
				name: requireString(payload.name, "payload.name"),
				description: optionalString(payload.description, "payload.description"),
			},
		};
	}
	if (input.type === "projects.archive" || input.type === "projects.restore") {
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision: requireSafeInteger(
					payload.expectedProjectRevision,
					"payload.expectedProjectRevision",
				),
			},
		};
	}
	if (input.type === "projects.root-add") {
		const directoryReuse = requireProjectDirectoryReuse(payload.directoryReuse);
		const markerPolicy = requireProjectMarkerPolicy(payload.markerPolicy);
		const vaultRelativePath = optionalString(payload.vaultRelativePath, "payload.vaultRelativePath");
		const directoryCandidateRef = optionalString(payload.directoryCandidateRef, "payload.directoryCandidateRef");
		if ((vaultRelativePath === undefined) === (directoryCandidateRef === undefined)) {
			throw new Error("Choose exactly one Project folder source.");
		}
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision: requireSafeInteger(
					payload.expectedProjectRevision,
					"payload.expectedProjectRevision",
				),
				label: requireString(payload.label, "payload.label"),
				vaultRelativePath,
				directoryCandidateRef,
				directoryReuse,
				markerPolicy,
			},
		};
	}
	if (input.type === "projects.roots-add-batch") {
		const roots = requireProjectFolderSelections(payload.roots, "payload.roots");
		if (roots.length === 0) throw new Error("Choose at least one Project folder.");
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision: requireSafeInteger(
					payload.expectedProjectRevision,
					"payload.expectedProjectRevision",
				),
				roots,
			},
		};
	}
	if (input.type === "projects.root-relabel") {
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision: requireSafeInteger(
					payload.expectedProjectRevision,
					"payload.expectedProjectRevision",
				),
				rootId: requireString(payload.rootId, "payload.rootId"),
				label: requireString(payload.label, "payload.label"),
			},
		};
	}
	if (input.type === "projects.root-set-primary" || input.type === "projects.root-remove") {
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision: requireSafeInteger(
					payload.expectedProjectRevision,
					"payload.expectedProjectRevision",
				),
				rootId: requireString(payload.rootId, "payload.rootId"),
				replacementRootId: optionalString(payload.replacementRootId, "payload.replacementRootId"),
			},
		};
	}
	if (input.type === "projects.root-recover") {
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				rootId: requireString(payload.rootId, "payload.rootId"),
			},
		};
	}
	if (input.type === "projects.root-relink") {
		const vaultRelativePath = optionalString(payload.vaultRelativePath, "payload.vaultRelativePath");
		const directoryCandidateRef = optionalString(payload.directoryCandidateRef, "payload.directoryCandidateRef");
		if ((vaultRelativePath === undefined) === (directoryCandidateRef === undefined)) {
			throw new Error("Choose exactly one replacement folder source.");
		}
		return {
			...base,
			type: input.type,
			payload: {
				projectId: requireString(payload.projectId, "payload.projectId"),
				expectedProjectRevision: requireSafeInteger(
					payload.expectedProjectRevision,
					"payload.expectedProjectRevision",
				),
				rootId: requireString(payload.rootId, "payload.rootId"),
				vaultRelativePath,
				directoryCandidateRef,
			},
		};
	}
	if (input.type === "projects.session-move") {
		const target = requireRecord(payload.target, "payload.target");
		const parsedTarget =
			target.kind === "vault"
				? ({ kind: "vault" } as const)
				: target.kind === "project"
					? {
							kind: "project" as const,
							projectId: requireString(target.projectId, "payload.target.projectId"),
						}
					: (() => {
							throw new Error("payload.target.kind is invalid");
						})();
		return {
			...base,
			type: input.type,
			payload: {
				sessionId: requireString(payload.sessionId, "payload.sessionId"),
				expectedWorkspaceBindingRevision: requireSafeInteger(
					payload.expectedWorkspaceBindingRevision,
					"payload.expectedWorkspaceBindingRevision",
				),
				target: parsedTarget,
			},
		};
	}
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

function validateChoice(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	requireString(input.value, `${label}.value`);
	requireString(input.label, `${label}.label`);
	optionalString(input.description, `${label}.description`);
	optionalString(input.disabledReason, `${label}.disabledReason`);
}

function validateChoices(value: unknown, label: string): void {
	validateArray(value, label, validateChoice);
}

function validateProjectRoot(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	for (const field of ["rootId", "directoryId", "label", "availabilityLabel"] as const) {
		requireString(input[field], `${label}.${field}`);
	}
	requireBoolean(input.primary, `${label}.primary`);
	requireEnumValue(input.locationKind, `${label}.locationKind`, ["vault-relative", "external"]);
	optionalString(input.vaultRelativePath, `${label}.vaultRelativePath`);
	optionalString(input.localPath, `${label}.localPath`);
	requireEnumValue(input.directoryReuse, `${label}.directoryReuse`, ["canonical", "none"]);
	requireEnumValue(input.markerPolicy, `${label}.markerPolicy`, ["required", "optional", "disabled"]);
	requireEnumValue(input.recoveryMode, `${label}.recoveryMode`, ["marker", "device-binding-only"]);
	requireEnumValue(input.availability, `${label}.availability`, [
		"available",
		"missing",
		"conflict",
		"relink-required",
		"unregistered",
	]);
	if (input.recoveryAction !== undefined) {
		requireEnumValue(input.recoveryAction, `${label}.recoveryAction`, [
			"relink",
			"resolve-conflict",
			"repair-marker",
		]);
	}
}

function validateProjectSession(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	for (const field of ["sessionId", "name"] as const) requireString(input[field], `${label}.${field}`);
	optionalString(input.createdAt, `${label}.createdAt`);
	optionalString(input.updatedAt, `${label}.updatedAt`);
	if (input.active !== undefined) requireBoolean(input.active, `${label}.active`);
	requireSafeInteger(input.workspaceBindingRevision, `${label}.workspaceBindingRevision`);
	const workspace = requireRecord(input.workspace, `${label}.workspace`);
	const kind = requireEnumValue(workspace.kind, `${label}.workspace.kind`, ["vault", "project"]);
	if (kind === "project") requireString(workspace.projectId, `${label}.workspace.projectId`);
	requireSafeInteger(input.messageCount, `${label}.messageCount`);
	requireBoolean(input.running, `${label}.running`);
	optionalString(input.activeRootId, `${label}.activeRootId`);
	optionalString(input.matchSnippet, `${label}.matchSnippet`);
}

function validateProjectSummary(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	for (const field of ["projectId", "name", "availabilityLabel", "createdAt", "updatedAt", "activityAt"] as const) {
		requireString(input[field], `${label}.${field}`);
	}
	requireSafeInteger(input.revision, `${label}.revision`);
	optionalString(input.description, `${label}.description`);
	requireEnumValue(input.lifecycle, `${label}.lifecycle`, ["active", "archived"]);
	requireEnumValue(input.creationKind, `${label}.creationKind`, ["directory-session", "manual", "migration"]);
	for (const field of ["primaryRootId", "primaryRootLabel", "canonicalVaultRelativePath"] as const)
		optionalString(input[field], `${label}.${field}`);
	for (const field of ["rootCount", "sessionCount"] as const) requireSafeInteger(input[field], `${label}.${field}`);
	requireEnumValue(input.availability, `${label}.availability`, [
		"available",
		"attention",
		"missing",
		"conflict",
		"relink-required",
	]);
}

function validateProjectDetail(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	for (const field of ["projectId", "name"] as const) requireString(input[field], `${label}.${field}`);
	requireSafeInteger(input.revision, `${label}.revision`);
	optionalString(input.description, `${label}.description`);
	requireEnumValue(input.lifecycle, `${label}.lifecycle`, ["active", "archived"]);
	requireEnumValue(input.creationKind, `${label}.creationKind`, ["directory-session", "manual", "migration"]);
	optionalString(input.primaryRootId, `${label}.primaryRootId`);
	validateArray(input.roots, `${label}.roots`, validateProjectRoot);
	requireSafeInteger(input.sessionCount, `${label}.sessionCount`);
	validateArray(input.sessions, `${label}.sessions`, validateProjectSession);
}

function validateProjectSearchPage(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	validateArray(input.items, `${label}.items`, (entry, entryLabel) => {
		const hit = requireRecord(entry, entryLabel);
		for (const field of [
			"hitId",
			"sessionId",
			"sessionName",
			"messageId",
			"targetBlockId",
			"timestamp",
			"excerpt",
		] as const)
			requireString(hit[field], `${entryLabel}.${field}`);
		requireEnumValue(hit.role, `${entryLabel}.role`, ["user", "assistant"]);
		validateArray(hit.matchRanges, `${entryLabel}.matchRanges`, (rangeValue, rangeLabel) => {
			const range = requireRecord(rangeValue, rangeLabel);
			requireSafeInteger(range.start, `${rangeLabel}.start`);
			requireSafeInteger(range.end, `${rangeLabel}.end`);
		});
	});
	for (const field of ["page", "pageSize", "totalCount"] as const)
		requireSafeInteger(input[field], `${label}.${field}`);
	requireBoolean(input.hasPrevious, `${label}.hasPrevious`);
	requireBoolean(input.hasNext, `${label}.hasNext`);
}

function validateProjectScreen(input: Record<string, unknown>): void {
	requireSafeInteger(input.snapshotSequence, "snapshotSequence");
	requireTextValue(input.query, "query");
	requireProjectLifecycleFilter(input.lifecycleFilter);
	requireProjectAvailabilityFilter(input.availabilityFilter);
	requireProjectSort(input.sort);
	requireTextValue(input.sessionQuery, "sessionQuery");
	requireProjectSessionSearchMode(input.sessionSearchMode);
	requireProjectSessionSort(input.sessionSort);
	requireSafeInteger(input.sessionSearchPage, "sessionSearchPage");
	optionalString(input.selectedProjectId, "selectedProjectId");
	const running = requireRecord(input.runningIn, "runningIn");
	requireEnumValue(running.kind, "runningIn.kind", ["vault", "project", "unresolved"]);
	requireString(running.label, "runningIn.label");
	optionalString(running.projectId, "runningIn.projectId");
	optionalString(running.activeRootId, "runningIn.activeRootId");
	requireStringArray(running.attachedRootIds, "runningIn.attachedRootIds");
	validateArray(input.projects, "projects", validateProjectSummary);
	validateArray(input.sessionMoveProjects, "sessionMoveProjects", (value, label) => {
		const destination = requireRecord(value, label);
		requireString(destination.projectId, `${label}.projectId`);
		requireString(destination.name, `${label}.name`);
		requireBoolean(destination.available, `${label}.available`);
		requireString(destination.availabilityLabel, `${label}.availabilityLabel`);
	});
	requireSafeInteger(input.vaultSessionCount, "vaultSessionCount");
	validateArray(input.vaultSessions, "vaultSessions", validateProjectSession);
	if (input.detail !== undefined) validateProjectDetail(input.detail, "detail");
	validateArray(input.runningRoots, "runningRoots", validateProjectRoot);
	if (input.messageSearchPage !== undefined) validateProjectSearchPage(input.messageSearchPage, "messageSearchPage");
	for (const field of [
		"lifecycleOptions",
		"availabilityOptions",
		"sortOptions",
		"sessionSearchModeOptions",
		"sessionSortOptions",
	] as const)
		validateChoices(input[field], field);
	optionalString(input.error, "error");
	optionalString(input.statusMessage, "statusMessage");
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

function validatePermissionScreen(input: Record<string, unknown>): void {
	if (input.nativeSetup !== undefined) validateFrontendSandboxSetupView(input.nativeSetup);
	requireString(input.accessPolicySessionId, "accessPolicySessionId");
	const accessPolicy = requireRecord(input.accessPolicy, "accessPolicy");
	if (accessPolicy.schemaVersion !== 1) throw new Error("accessPolicy.schemaVersion must be 1");
	requireSafeInteger(accessPolicy.revision, "accessPolicy.revision");
	requireEnumValue(accessPolicy.accessMode, "accessPolicy.accessMode", ["read-only", "workspace", "full"]);
	requireBoolean(accessPolicy.agentNetworkAccess, "accessPolicy.agentNetworkAccess");
	if (accessPolicy.accessMode === "full" && accessPolicy.agentNetworkAccess !== true) {
		throw new Error("Full access includes agent network access.");
	}
	const scope = requireRecord(input.scope, "scope");
	requireSafeInteger(scope.bindingRevision, "scope.bindingRevision");
	requireEnumValue(scope.kind, "scope.kind", ["project", "vault"]);
	requireSafeInteger(scope.selectedRootCount, "scope.selectedRootCount");
	requireBoolean(scope.filesystemBound, "scope.filesystemBound");
	if ((scope.selectedRootCount === 0) !== (scope.filesystemBound === false)) {
		throw new Error("Permission scope filesystemBound must match selectedRootCount.");
	}
	const nativeSupport = requireRecord(input.nativeSupport, "nativeSupport");
	requireEnumValue(nativeSupport.status, "nativeSupport.status", [
		"ready",
		"setup-required",
		"unverified",
		"unsupported",
	]);
	if (nativeSupport.backendId !== undefined) {
		requireEnumValue(nativeSupport.backendId, "nativeSupport.backendId", [
			"windows-appcontainer",
			"linux-bubblewrap",
			"macos-seatbelt",
			"landstrip",
		]);
	}
	optionalString(nativeSupport.reason, "nativeSupport.reason");
	optionalString(nativeSupport.userAction, "nativeSupport.userAction");
	if (input.obsidianVaultAccess !== undefined) {
		const grant = requireRecord(input.obsidianVaultAccess, "obsidianVaultAccess");
		const status = requireEnumValue(grant.status, "obsidianVaultAccess.status", ["available", "unavailable"]);
		const enabled = requireBoolean(grant.enabled, "obsidianVaultAccess.enabled");
		if (grant.warning !== OBSIDIAN_VAULT_ACCESS_WARNING) throw new Error("obsidianVaultAccess.warning is invalid");
		if (status === "available") {
			requireSafeInteger(grant.revision, "obsidianVaultAccess.revision");
			requireString(grant.sessionId, "obsidianVaultAccess.sessionId");
			requireSafeInteger(grant.bindingRevision, "obsidianVaultAccess.bindingRevision");
			requireEnumValue(grant.source, "obsidianVaultAccess.source", ["default", "user"]);
		} else {
			if (enabled) throw new Error("Unavailable Obsidian vault access must be Off");
			requireString(grant.reason, "obsidianVaultAccess.reason");
		}
	}
	if (input.workspaceVaultAccess !== undefined)
		validateArray(input.workspaceVaultAccess, "workspaceVaultAccess", (value, label) => {
			const grant = requireRecord(value, label);
			if (grant.projectId !== null) {
				requireString(grant.projectId, `${label}.projectId`);
				requireSafeInteger(grant.projectRevision, `${label}.projectRevision`);
			}
			requireString(grant.label, `${label}.label`);
			requireSafeInteger(grant.revision, `${label}.revision`);
			requireBoolean(grant.enabled, `${label}.enabled`);
			requireEnumValue(grant.source, `${label}.source`, ["default", "user"]);
		});
	const effective = requireRecord(input.effective, "effective");
	requireBoolean(effective.fileRead, "effective.fileRead");
	requireBoolean(effective.fileWrite, "effective.fileWrite");
	requireEnumValue(effective.localProcess, "effective.localProcess", [
		"native-contained",
		"unavailable",
		"unsandboxed",
	]);
	requireEnumValue(effective.obsidian, "effective.obsidian", [
		"app-authority",
		"typed-read",
		"typed-workspace",
		"unavailable",
		"unsandboxed",
	]);
	requireBoolean(effective.agentNetworkAccess, "effective.agentNetworkAccess");
	optionalString(effective.warning, "effective.warning");
	optionalString(input.migrationNotice, "migrationNotice");
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
		for (const field of [
			"id",
			"eventName",
			"projectPath",
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

const SUBAGENT_RUN_STATUS_VALUES = [
	"created",
	"queued",
	"running",
	"paused",
	"waiting",
	"completed",
	"failed",
	"cancelled",
	"orphaned",
] as const;
const SUBAGENT_NODE_STATUS_VALUES = [
	"blocked",
	"queued",
	"running",
	"waiting",
	"paused",
	"completed",
	"failed",
	"cancelled",
	"skipped",
	"orphaned",
] as const;

function validateSubagentPolicy(value: unknown, label: string): void {
	const policy = requireRecord(value, label);
	if (policy.executionMode !== undefined)
		requireEnumValue(policy.executionMode, `${label}.executionMode`, ["auto", "in-process", "worker-process"]);
	optionalString(policy.model, `${label}.model`);
	for (const field of ["fallbackModels", "tools", "mcpTools", "extensions", "skills"] as const) {
		if (policy[field] !== undefined) requireStringArray(policy[field], `${label}.${field}`);
	}
	if (policy.thinking !== undefined) requireThinkingLevel(policy.thinking, `${label}.thinking`);
	if (policy.contextMode !== undefined)
		requireEnumValue(policy.contextMode, `${label}.contextMode`, ["fresh", "fork"]);
	for (const field of ["maxDepth", "maxTurnsPerNode", "maxTokens", "maxWallTimeMs", "maxToolCallsPerNode"] as const)
		optionalSafeInteger(policy[field], `${label}.${field}`);
	if (policy.toolCallLimits !== undefined) requireNumberRecord(policy.toolCallLimits, `${label}.toolCallLimits`);
	optionalString(policy.permissionProfileId, `${label}.permissionProfileId`);
}

function validateSubagentDefinition(value: unknown, label: string): void {
	const definition = requireRecord(value, label);
	for (const field of ["id", "name", "description", "scopeId", "systemPrompt"] as const)
		requireString(definition[field], `${label}.${field}`);
	requireEnumValue(definition.scope, `${label}.scope`, ["global", "vault", "directory", "session"]);
	requireBoolean(definition.enabled, `${label}.enabled`);
	validateSubagentPolicy(definition.policy, `${label}.policy`);
	if (definition.permissionReviewRequired !== undefined && definition.permissionReviewRequired !== true)
		throw new Error(`${label}.permissionReviewRequired must be true when present`);
	if (definition.builtIn !== undefined && definition.builtIn !== true)
		throw new Error(`${label}.builtIn must be true when present`);
	requireSafeInteger(definition.revision, `${label}.revision`);
	requireSafeInteger(definition.updatedAt, `${label}.updatedAt`);
}

function validateSubagentBudgets(value: unknown, label: string): void {
	const budgets = requireRecord(value, label);
	for (const field of [
		"maxConcurrency",
		"maxDepth",
		"maxTurnsPerNode",
		"maxTokens",
		"maxWallTimeMs",
		"maxToolCallsPerNode",
	] as const)
		optionalSafeInteger(budgets[field], `${label}.${field}`);
	optionalFiniteNumber(budgets.maxCostUsd, `${label}.maxCostUsd`);
}

function validateSubagentRunSummary(value: unknown, label: string): void {
	const summary = requireRecord(value, label);
	for (const field of ["id", "parentSessionId", "description", "workspaceCwd"] as const)
		requireString(summary[field], `${label}.${field}`);
	requireEnumValue(summary.triggerSource, `${label}.triggerSource`, [
		"parent-agent",
		"user",
		"scheduler",
		"automation",
		"api",
	]);
	requireEnumValue(summary.status, `${label}.status`, SUBAGENT_RUN_STATUS_VALUES);
	requireStringArray(summary.agentIds, `${label}.agentIds`);
	validateArray(summary.executionModes, `${label}.executionModes`, (entry, entryLabel) =>
		requireEnumValue(entry, entryLabel, ["in-process", "worker-process"]),
	);
	for (const field of [
		"activeNodes",
		"queuedNodes",
		"waitingNodes",
		"failedNodes",
		"tokens",
		"createdAt",
		"updatedAt",
	] as const)
		requireSafeInteger(summary[field], `${label}.${field}`);
	requireFiniteNumber(summary.costUsd, `${label}.costUsd`);
}

function validateSubagentActor(value: unknown, label: string): void {
	const actor = requireRecord(value, label);
	requireEnumValue(actor.kind, `${label}.kind`, ["user", "parent", "agent", "system"]);
	requireString(actor.id, `${label}.id`);
	optionalString(actor.label, `${label}.label`);
}

function validateSubagentMessage(value: unknown, label: string): void {
	const message = requireRecord(value, label);
	for (const field of ["id", "runId", "threadId"] as const) requireString(message[field], `${label}.${field}`);
	optionalString(message.nodeId, `${label}.nodeId`);
	validateSubagentActor(message.from, `${label}.from`);
	validateArray(message.to, `${label}.to`, validateSubagentActor);
	requireEnumValue(message.kind, `${label}.kind`, ["inform", "request", "decision", "steer", "result"]);
	requireTextValue(message.text, `${label}.text`);
	if (message.data !== undefined) requireRecord(message.data, `${label}.data`);
	optionalString(message.correlationId, `${label}.correlationId`);
	optionalString(message.replyTo, `${label}.replyTo`);
	requireBoolean(message.blocking, `${label}.blocking`);
	optionalSafeInteger(message.deadline, `${label}.deadline`);
	requireEnumValue(message.status, `${label}.status`, ["queued", "delivered", "acknowledged", "expired", "rejected"]);
	requireSafeInteger(message.createdAt, `${label}.createdAt`);
	optionalSafeInteger(message.acknowledgedAt, `${label}.acknowledgedAt`);
	if (message.response !== undefined) {
		const response = requireRecord(message.response, `${label}.response`);
		validateSubagentActor(response.actor, `${label}.response.actor`);
		optionalTextValue(response.text, `${label}.response.text`);
		if (response.data !== undefined) requireRecord(response.data, `${label}.response.data`);
		requireSafeInteger(response.createdAt, `${label}.response.createdAt`);
	}
}

function validateSubagentAcceptance(value: unknown, label: string): void {
	const acceptance = requireRecord(value, label);
	requireString(acceptance.runId, `${label}.runId`);
	requireString(acceptance.nodeId, `${label}.nodeId`);
	requireEnumValue(acceptance.level, `${label}.level`, ["none", "attested", "checked", "verified", "reviewed"]);
	requireEnumValue(acceptance.status, `${label}.status`, ["accepted", "rejected", "waiting-review"]);
	requireStringArray(acceptance.criteria, `${label}.criteria`);
	validateArray(acceptance.checks, `${label}.checks`, (value, checkLabel) => {
		const check = requireRecord(value, checkLabel);
		requireString(check.id, `${checkLabel}.id`);
		requireString(check.command, `${checkLabel}.command`);
		if (check.exitCode !== null) requireSafeInteger(check.exitCode, `${checkLabel}.exitCode`);
		requireTextValue(check.stdout, `${checkLabel}.stdout`);
		requireTextValue(check.stderr, `${checkLabel}.stderr`);
		requireBoolean(check.timedOut, `${checkLabel}.timedOut`);
		requireSafeInteger(check.durationMs, `${checkLabel}.durationMs`);
	});
	optionalString(acceptance.reviewerAgentId, `${label}.reviewerAgentId`);
	optionalSafeInteger(acceptance.decidedAt, `${label}.decidedAt`);
	optionalString(acceptance.decisionNote, `${label}.decisionNote`);
}

function validateSubagentPermission(value: unknown, label: string): void {
	const permission = requireRecord(value, label);
	for (const field of ["id", "runId", "nodeId", "title"] as const)
		requireString(permission[field], `${label}.${field}`);
	requireSafeInteger(permission.revision, `${label}.revision`);
	requireEnumValue(permission.kind, `${label}.kind`, ["confirm", "select", "input"]);
	optionalTextValue(permission.message, `${label}.message`);
	if (permission.options !== undefined) requireStringArray(permission.options, `${label}.options`);
	optionalTextValue(permission.placeholder, `${label}.placeholder`);
	requireEnumValue(permission.status, `${label}.status`, ["pending", "approved", "denied"]);
	requireSafeInteger(permission.createdAt, `${label}.createdAt`);
	optionalSafeInteger(permission.decidedAt, `${label}.decidedAt`);
	optionalTextValue(permission.value, `${label}.value`);
}

function validateSubagentLaunchSummary(value: unknown, label: string): void {
	const launch = requireRecord(value, label);
	if (launch.schemaVersion !== 1) throw new Error(`${label}.schemaVersion is invalid`);
	for (const field of ["contractId", "resolutionFingerprint", "runId", "nodeId"] as const)
		requireString(launch[field], `${label}.${field}`);
	const role = requireRecord(launch.role, `${label}.role`);
	for (const field of ["id", "name", "promptHash"] as const) requireString(role[field], `${label}.role.${field}`);
	requireSafeInteger(role.revision, `${label}.role.revision`);
	const model = requireRecord(launch.model, `${label}.model`);
	requireString(model.selected, `${label}.model.selected`);
	requireThinkingLevel(model.thinking, `${label}.model.thinking`);
	requireStringArray(model.fallbacks, `${label}.model.fallbacks`);
	const executor = requireRecord(launch.executor, `${label}.executor`);
	requireEnumValue(executor.requested, `${label}.executor.requested`, ["auto", "in-process", "worker-process"]);
	requireEnumValue(executor.selected, `${label}.executor.selected`, ["in-process", "worker-process"]);
	requireEnumValue(executor.source, `${label}.executor.source`, ["node", "run", "role", "auto"]);
	requireString(executor.reason, `${label}.executor.reason`);
	optionalNullableString(executor.runtimeFingerprintRequirement, `${label}.executor.runtimeFingerprintRequirement`);
	const context = requireRecord(launch.context, `${label}.context`);
	requireEnumValue(context.mode, `${label}.context.mode`, ["fresh", "fork"]);
	requireEnumValue(context.source, `${label}.context.source`, ["node", "run", "role", "fallback"]);
	requireBoolean(context.explicit, `${label}.context.explicit`);
	optionalNullableString(context.packetFingerprint, `${label}.context.packetFingerprint`);
	requireSafeInteger(context.estimatedTokens, `${label}.context.estimatedTokens`);
	requireSafeInteger(context.messageCount, `${label}.context.messageCount`);
	const permission = requireRecord(launch.permission, `${label}.permission`);
	for (const field of ["profileId", "profileFingerprint"] as const)
		requireString(permission[field], `${label}.permission.${field}`);
	requireSafeInteger(permission.profileRevision, `${label}.permission.profileRevision`);
	requireEnumValue(permission.source, `${label}.permission.source`, ["run", "node", "role", "project", "fallback"]);
	for (const field of ["budgets", "tools", "workspace"] as const) requireRecord(launch[field], `${label}.${field}`);
	requireBoolean(launch.definitionChangedSinceLaunch, `${label}.definitionChangedSinceLaunch`);
}

function validateSubagentNode(value: unknown, label: string): void {
	const node = requireRecord(value, label);
	for (const field of ["id", "agentId", "label", "task"] as const) requireString(node[field], `${label}.${field}`);
	for (const field of [
		"parentNodeId",
		"agentName",
		"model",
		"currentTool",
		"result",
		"latestMessageId",
		"error",
	] as const)
		optionalString(node[field], `${label}.${field}`);
	optionalSafeInteger(node.fanoutIndex, `${label}.fanoutIndex`);
	if (node.fanoutItem !== undefined) requireJsonValue(node.fanoutItem, `${label}.fanoutItem`);
	requireEnumValue(node.status, `${label}.status`, SUBAGENT_NODE_STATUS_VALUES);
	requireStringArray(node.dependsOn, `${label}.dependsOn`);
	requireSafeInteger(node.priority, `${label}.priority`);
	requireEnumValue(node.requestedExecutionMode, `${label}.requestedExecutionMode`, [
		"auto",
		"in-process",
		"worker-process",
	]);
	if (node.launchSummary !== undefined) validateSubagentLaunchSummary(node.launchSummary, `${label}.launchSummary`);
	if (node.runtimePolicy !== undefined) validateSubagentPolicy(node.runtimePolicy, `${label}.runtimePolicy`);
	if (node.resolvedExecutionMode !== undefined)
		requireEnumValue(node.resolvedExecutionMode, `${label}.resolvedExecutionMode`, ["in-process", "worker-process"]);
	for (const field of ["turns", "tokens"] as const) requireSafeInteger(node[field], `${label}.${field}`);
	for (const field of ["queuePosition", "startedAt", "completedAt"] as const)
		optionalSafeInteger(node[field], `${label}.${field}`);
	optionalFiniteNumber(node.contextPercent, `${label}.contextPercent`);
	requireFiniteNumber(node.costUsd, `${label}.costUsd`);
	validateArray(node.attempts, `${label}.attempts`, (value, attemptLabel) => {
		const attempt = requireRecord(value, attemptLabel);
		requireString(attempt.id, `${attemptLabel}.id`);
		requireSafeInteger(attempt.number, `${attemptLabel}.number`);
		requireEnumValue(attempt.mode, `${attemptLabel}.mode`, ["in-process", "worker-process"]);
		requireEnumValue(attempt.status, `${attemptLabel}.status`, SUBAGENT_NODE_STATUS_VALUES);
		optionalSafeInteger(attempt.startedAt, `${attemptLabel}.startedAt`);
		optionalSafeInteger(attempt.completedAt, `${attemptLabel}.completedAt`);
		optionalString(attempt.runtimeFingerprint, `${attemptLabel}.runtimeFingerprint`);
		optionalString(attempt.error, `${attemptLabel}.error`);
	});
	requireStringArray(node.artifactIds, `${label}.artifactIds`);
	if (node.structuredOutput !== undefined) requireJsonValue(node.structuredOutput, `${label}.structuredOutput`);
	if (node.acceptanceStatus !== undefined)
		requireEnumValue(node.acceptanceStatus, `${label}.acceptanceStatus`, [
			"not-required",
			"accepted",
			"rejected",
			"waiting-review",
		]);
	if (node.acceptanceRecord !== undefined)
		validateSubagentAcceptance(node.acceptanceRecord, `${label}.acceptanceRecord`);
	if (node.pendingPermission !== undefined)
		validateSubagentPermission(node.pendingPermission, `${label}.pendingPermission`);
}

function validateSubagentRun(value: unknown, label: string): void {
	const run = requireRecord(value, label);
	for (const field of ["id", "runtimeId", "parentSessionId", "description"] as const)
		requireString(run[field], `${label}.${field}`);
	requireEnumValue(run.triggerSource, `${label}.triggerSource`, [
		"parent-agent",
		"user",
		"scheduler",
		"automation",
		"api",
	]);
	requireEnumValue(run.status, `${label}.status`, SUBAGENT_RUN_STATUS_VALUES);
	for (const field of ["priority", "createdAt", "updatedAt", "lastSequence"] as const)
		requireSafeInteger(run[field], `${label}.${field}`);
	optionalSafeInteger(run.startedAt, `${label}.startedAt`);
	optionalSafeInteger(run.completedAt, `${label}.completedAt`);
	validateSubagentBudgets(run.budgets, `${label}.budgets`);
	const context = requireRecord(run.context, `${label}.context`);
	requireEnumValue(context.mode, `${label}.context.mode`, ["fresh", "fork"]);
	optionalString(run.permissionProfileId, `${label}.permissionProfileId`);
	const workspace = requireRecord(run.workspace, `${label}.workspace`);
	for (const field of ["cwd", "resolvedCwd", "provider", "workspaceId"] as const)
		requireString(workspace[field], `${label}.workspace.${field}`);
	requireEnumValue(workspace.mode, `${label}.workspace.mode`, ["shared", "worktree", "sandbox"]);
	optionalString(workspace.artifactDirectory, `${label}.workspace.artifactDirectory`);
	optionalString(workspace.baseRevision, `${label}.workspace.baseRevision`);
	if (workspace.baselineFileStates !== undefined)
		validateStringRecord(workspace.baselineFileStates, `${label}.workspace.baselineFileStates`);
	requireStringArray(workspace.changedFiles, `${label}.workspace.changedFiles`);
	requireSafeInteger(workspace.createdAt, `${label}.workspace.createdAt`);
	if (run.parent !== undefined) {
		const parent = requireRecord(run.parent, `${label}.parent`);
		requireString(parent.runId, `${label}.parent.runId`);
		requireString(parent.nodeId, `${label}.parent.nodeId`);
		requireSafeInteger(parent.depth, `${label}.parent.depth`);
	}
	requireBoolean(run.failFast, `${label}.failFast`);
	const nodes = requireRecord(run.nodes, `${label}.nodes`);
	for (const [nodeId, node] of Object.entries(nodes)) {
		validateSubagentNode(node, `${label}.nodes.${nodeId}`);
		if (requireRecord(node, `${label}.nodes.${nodeId}`).id !== nodeId)
			throw new Error(`${label}.nodes.${nodeId}.id must match its key`);
	}
	requireStringArray(run.rootNodeIds, `${label}.rootNodeIds`);
	optionalString(run.error, `${label}.error`);
}

function validateSubagentArtifact(value: unknown, label: string): void {
	const artifact = requireRecord(value, label);
	for (const field of ["id", "runId", "nodeId", "name", "path"] as const)
		requireString(artifact[field], `${label}.${field}`);
	requireEnumValue(artifact.kind, `${label}.kind`, [
		"file",
		"report",
		"patch",
		"structured-output",
		"transcript",
		"log",
	]);
	optionalString(artifact.mimeType, `${label}.mimeType`);
	optionalSafeInteger(artifact.bytes, `${label}.bytes`);
	for (const field of ["revision", "createdAt", "updatedAt"] as const)
		requireSafeInteger(artifact[field], `${label}.${field}`);
	optionalString(artifact.promotedVaultPath, `${label}.promotedVaultPath`);
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

function parseFrontendSubagentMessage(value: unknown, label: string): FrontendSubagentMessageViewModel {
	const input = requireRecord(value, label);
	const kind = requireString(input.kind, `${label}.kind`);
	if (kind !== "inform" && kind !== "request" && kind !== "decision" && kind !== "steer" && kind !== "result") {
		throw new Error(`${label}.kind is invalid`);
	}
	const status = requireString(input.status, `${label}.status`);
	if (
		status !== "queued" &&
		status !== "delivered" &&
		status !== "acknowledged" &&
		status !== "expired" &&
		status !== "rejected"
	) {
		throw new Error(`${label}.status is invalid`);
	}
	const data = input.data === undefined ? undefined : requireRecord(input.data, `${label}.data`);
	if (data) requireJsonValue(data, `${label}.data`);
	const response = input.response === undefined ? undefined : requireRecord(input.response, `${label}.response`);
	if (response?.data !== undefined) requireJsonValue(response.data, `${label}.response.data`);
	return {
		id: requireString(input.id, `${label}.id`),
		runId: requireString(input.runId, `${label}.runId`),
		nodeId: optionalString(input.nodeId, `${label}.nodeId`),
		threadId: requireString(input.threadId, `${label}.threadId`),
		from: parseSubagentActor(input.from, `${label}.from`),
		to: requireArray(input.to, `${label}.to`).map((entry, index) =>
			parseSubagentActor(entry, `${label}.to[${index}]`),
		),
		kind,
		text:
			typeof input.text === "string"
				? input.text
				: (() => {
						throw new Error(`${label}.text must be a string`);
					})(),
		data,
		correlationId: optionalString(input.correlationId, `${label}.correlationId`),
		replyTo: optionalString(input.replyTo, `${label}.replyTo`),
		blocking: requireBoolean(input.blocking, `${label}.blocking`),
		deadline: optionalSafeInteger(input.deadline, `${label}.deadline`),
		status,
		createdAt: requireSafeInteger(input.createdAt, `${label}.createdAt`),
		acknowledgedAt: optionalSafeInteger(input.acknowledgedAt, `${label}.acknowledgedAt`),
		response:
			response === undefined
				? undefined
				: {
						actor: parseSubagentActor(response.actor, `${label}.response.actor`),
						text: optionalString(response.text, `${label}.response.text`),
						data:
							response.data === undefined ? undefined : requireRecord(response.data, `${label}.response.data`),
						createdAt: requireSafeInteger(response.createdAt, `${label}.response.createdAt`),
					},
	};
}

function parseSubagentActor(value: unknown, label: string): FrontendSubagentActorViewModel {
	const input = requireRecord(value, label);
	const kind = requireString(input.kind, `${label}.kind`);
	if (kind !== "user" && kind !== "parent" && kind !== "agent" && kind !== "system") {
		throw new Error(`${label}.kind is invalid`);
	}
	return { kind, id: requireString(input.id, `${label}.id`), label: optionalString(input.label, `${label}.label`) };
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

function parseChoiceOption(value: unknown, label: string, allowEmptyValue = false): FrontendChoiceOption {
	const input = requireRecord(value, label);
	return {
		value: allowEmptyValue
			? requireTextValue(input.value, `${label}.value`)
			: requireString(input.value, `${label}.value`),
		label: requireString(input.label, `${label}.label`),
		description: optionalString(input.description, `${label}.description`),
		disabledReason: optionalString(input.disabledReason, `${label}.disabledReason`),
	};
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

function requireNumberRecord(value: unknown, label: string): Readonly<Record<string, number>> {
	const input = requireRecord(value, label);
	return Object.fromEntries(
		Object.entries(input).map(([key, entry]) => [key, requireSafeInteger(entry, `${label}.${key}`)]),
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

function requireThinkingLevel(value: unknown, label: string): ThinkingLevel {
	if (
		value === "off" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	)
		return value;
	throw new Error(`${label} is invalid`);
}

function requireJsonValue(value: unknown, label: string, seen = new Set<object>()): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") return;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number`);
		return;
	}
	if (typeof value !== "object") throw new Error(`${label} contains a non-JSON value`);
	if (seen.has(value)) throw new Error(`${label} contains a cycle`);
	seen.add(value);
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			requireJsonValue(entry, `${label}[${index}]`, seen);
		});
	} else {
		for (const [key, entry] of Object.entries(value)) {
			if (key === "__proto__" || key === "prototype" || key === "constructor") {
				throw new Error(`${label} contains a forbidden key`);
			}
			requireJsonValue(entry, `${label}.${key}`, seen);
		}
	}
	seen.delete(value);
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

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
	return value;
}

function requireString(value: unknown, label: string): string {
	if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
	return value;
}

function requireTextValue(value: unknown, label: string): string {
	if (typeof value !== "string") throw new Error(`${label} must be a string`);
	return value;
}

function optionalTextValue(value: unknown, label: string): string | undefined {
	return value === undefined ? undefined : requireTextValue(value, label);
}

function requireFiniteNumber(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		throw new Error(`${label} must be a non-negative finite number`);
	}
	return value;
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
	return value === undefined ? undefined : requireFiniteNumber(value, label);
}

function requireEnumValue<const Value extends string>(value: unknown, label: string, values: readonly Value[]): Value {
	if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
		throw new Error(`${label} is invalid`);
	}
	return value as Value;
}

function requireIconToken(value: unknown, label: string): FrontendIconToken {
	return requireString(value, label) as FrontendIconToken;
}

function validateArray(value: unknown, label: string, validate: (entry: unknown, label: string) => void): void {
	requireArray(value, label).forEach((entry, index) => {
		validate(entry, `${label}[${index}]`);
	});
}

function validateStringRecord(value: unknown, label: string): void {
	const input = requireRecord(value, label);
	for (const [key, entry] of Object.entries(input)) requireString(entry, `${label}.${key}`);
}

function optionalString(value: unknown, label: string): string | undefined {
	if (value === undefined) return undefined;
	return requireString(value, label);
}

function optionalText(value: unknown, label: string): string {
	if (value === undefined) return "";
	if (typeof value !== "string") throw new Error(`${label} must be a string`);
	return value;
}

function optionalNullableString(value: unknown, label: string): string | null | undefined {
	if (value === undefined || value === null) return value;
	return requireString(value, label);
}

function requireBoolean(value: unknown, label: string): boolean {
	if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
	return value;
}

function requireSafeInteger(value: unknown, label: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0)
		throw new Error(`${label} must be a non-negative safe integer`);
	return value as number;
}

function requireNonNegativeSafeInteger(value: unknown, label: string): number {
	const parsed = requireSafeInteger(value, label);
	if (parsed < 0) throw new Error(`${label} must be non-negative`);
	return parsed;
}

function permissionProfileRevision(payload: Record<string, unknown>): number {
	return requireSafeInteger(payload.expectedProfileRevision, "payload.expectedProfileRevision");
}

function optionalSafeInteger(value: unknown, label: string): number | undefined {
	return value === undefined ? undefined : requireSafeInteger(value, label);
}

function requireStringArray(value: unknown, label: string): string[] {
	return requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));
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

function requireProjectLifecycleFilter(value: unknown): FrontendProjectLifecycleFilter {
	if (value === "active" || value === "archived" || value === "all") return value;
	throw new Error("payload.lifecycleFilter is invalid");
}

function requireProjectDirectoryReuse(value: unknown): "canonical" | "none" {
	if (value === "canonical" || value === "none") return value;
	throw new Error("payload.directoryReuse is invalid");
}

function requireProjectMarkerPolicy(value: unknown): "required" | "optional" | "disabled" {
	if (value === "required" || value === "optional" || value === "disabled") return value;
	throw new Error("payload.markerPolicy is invalid");
}

function requireProjectFolderSelections(
	value: unknown,
	field: string,
): readonly {
	readonly directoryCandidateRef: string;
	readonly label: string;
	readonly markerPolicy: "required" | "optional" | "disabled";
	readonly directoryReuse: "canonical" | "none";
}[] {
	if (!Array.isArray(value) || value.length > 64) throw new Error(`${field} must contain no more than 64 folders`);
	const seen = new Set<string>();
	return Object.freeze(
		value.map((entry, index) => {
			const record = requireRecord(entry, `${field}[${index}]`);
			const directoryCandidateRef = requireString(
				record.directoryCandidateRef,
				`${field}[${index}].directoryCandidateRef`,
			);
			if (seen.has(directoryCandidateRef)) throw new Error(`${field} contains a duplicate folder selection`);
			seen.add(directoryCandidateRef);
			return Object.freeze({
				directoryCandidateRef,
				label: requireString(record.label, `${field}[${index}].label`),
				markerPolicy: requireProjectMarkerPolicy(record.markerPolicy),
				directoryReuse: requireProjectDirectoryReuse(record.directoryReuse),
			});
		}),
	);
}

function requireProjectAvailabilityFilter(value: unknown): FrontendProjectAvailabilityFilter {
	if (
		value === "all" ||
		value === "available" ||
		value === "attention" ||
		value === "missing" ||
		value === "conflict" ||
		value === "relink-required"
	) {
		return value;
	}
	throw new Error("payload.availabilityFilter is invalid");
}

function requireProjectSort(value: unknown): FrontendProjectSort {
	if (
		value === "activity-desc" ||
		value === "created-desc" ||
		value === "created-asc" ||
		value === "name-asc" ||
		value === "name-desc" ||
		value === "relevance"
	)
		return value;
	throw new Error("payload.sort is invalid");
}

function requireProjectSessionSort(value: unknown): FrontendProjectSessionSort {
	if (
		value === "updated-desc" ||
		value === "created-desc" ||
		value === "created-asc" ||
		value === "name-asc" ||
		value === "name-desc" ||
		value === "message-count-desc" ||
		value === "relevance"
	)
		return value;
	throw new Error("payload.sessionSort is invalid");
}

function requireProjectSessionSearchMode(value: unknown): FrontendProjectSessionSearchMode {
	if (value === "titles" || value === "messages") return value;
	throw new Error("payload.sessionSearchMode is invalid");
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

function parseSubagentRunQuery(value: unknown): FrontendSubagentRunFilter {
	const input = requireRecord(value, "payload.query");
	const status =
		input.status === undefined
			? undefined
			: requireArray(input.status, "payload.query.status").map((entry) => {
					const candidate = requireString(entry, "payload.query.status[]");
					if (!SUBAGENT_RUN_STATUSES.has(candidate)) throw new Error(`Invalid subagent run status: ${candidate}`);
					return candidate as FrontendSubagentRunStatus;
				});
	const executionMode = optionalString(input.executionMode, "payload.query.executionMode");
	if (executionMode !== undefined && executionMode !== "in-process" && executionMode !== "worker-process") {
		throw new Error("payload.query.executionMode is invalid");
	}
	return {
		parentSessionId: optionalString(input.parentSessionId, "payload.query.parentSessionId"),
		status,
		agentId: optionalString(input.agentId, "payload.query.agentId"),
		executionMode,
		workspaceCwd: optionalString(input.workspaceCwd, "payload.query.workspaceCwd"),
		search: optionalString(input.search, "payload.query.search"),
		createdAfter: optionalSafeInteger(input.createdAfter, "payload.query.createdAfter"),
		createdBefore: optionalSafeInteger(input.createdBefore, "payload.query.createdBefore"),
	};
}

const SUBAGENT_RUN_STATUSES = new Set([
	"created",
	"queued",
	"running",
	"paused",
	"waiting",
	"completed",
	"failed",
	"cancelled",
	"orphaned",
]);

function requireSubagentControlAction(value: unknown): FrontendSubagentControlAction {
	const action = requireString(value, "payload.action");
	if (!SUBAGENT_CONTROL_ACTIONS.has(action)) throw new Error(`Invalid subagent control action: ${action}`);
	return action as FrontendSubagentControlAction;
}

const SUBAGENT_CONTROL_ACTIONS = new Set([
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
]);

function parseAgentDefinition(value: unknown): FrontendSubagentAgentDefinition {
	const input = requireRecord(value, "payload.definition");
	requireString(input.id, "payload.definition.id");
	requireString(input.name, "payload.definition.name");
	if (typeof input.description !== "string") throw new Error("payload.definition.description must be a string");
	requireDefinitionScope(input.scope);
	requireString(input.scopeId, "payload.definition.scopeId");
	if (typeof input.systemPrompt !== "string") throw new Error("payload.definition.systemPrompt must be a string");
	requireBoolean(input.enabled, "payload.definition.enabled");
	requireRecord(input.policy, "payload.definition.policy");
	requireSafeInteger(input.revision, "payload.definition.revision");
	requireSafeInteger(input.updatedAt, "payload.definition.updatedAt");
	return value as FrontendSubagentAgentDefinition;
}

function requireDefinitionScope(value: unknown): FrontendSubagentResolutionLayer {
	if (value === "global" || value === "vault" || value === "directory" || value === "session") return value;
	throw new Error("payload.scope is invalid");
}

function requireUserDefinitionScope(value: unknown): FrontendSubagentUserDefinitionScope {
	if (value === "vault" || value === "directory") return value;
	throw new Error("payload.scope must be vault or directory");
}

function parseUserAgentDefinition(value: unknown): FrontendSubagentUserAgentDefinition {
	const definition = parseAgentDefinition(value);
	const scope = requireUserDefinitionScope(definition.scope);
	if (definition.builtIn !== undefined) throw new Error("payload.definition.builtIn is not allowed");
	const { builtIn: _builtIn, ...userDefinition } = definition;
	return { ...userDefinition, scope };
}

function parseResolvedSubagentSettings(value: unknown): FrontendSubagentSettingsViewModel {
	const input = requireRecord(value, "payload.settings");
	requireRecord(input.settings, "payload.settings.settings");
	requireSafeInteger(input.revision, "payload.settings.revision");
	requireRecord(input.sources, "payload.settings.sources");
	return value as FrontendSubagentSettingsViewModel;
}
