// Generated from packages/chatobby/src/frontend-contracts.ts. Do not edit.
import type { ThinkingLevel } from "./wire-types.ts";

/** Public, data-only protocol consumed by reviewable Chatobby frontends. */
export const CHATOBBY_FRONTEND_PROTOCOL_VERSION = 1;

export type FrontendScreenId = "memory" | "permissions" | "events" | "queries" | "channels" | "subagents";
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
	readonly integrations: readonly {
		readonly id: string;
		readonly name: string;
		readonly installed: boolean;
		readonly enabled: boolean;
	}[];
}

export interface FrontendBootstrapRequest {
	readonly schemaVersion: 1;
	readonly connectorVersion: string;
	readonly obsidianVersion: string;
	readonly vaultInstanceId: string;
	readonly viewId: string;
	readonly supportedProtocolVersions: readonly number[];
	readonly capabilities: FrontendCapabilityReport;
}

export interface FrontendChoiceOption {
	readonly value: string;
	readonly label: string;
	readonly description?: string;
	readonly disabledReason?: string;
}

export interface FrontendChoiceControl {
	readonly id: "provider" | "model" | "effort" | "permission";
	readonly label: string;
	readonly value: string;
	readonly options: readonly FrontendChoiceOption[];
}

export interface FrontendComposerViewModel {
	readonly controls: readonly FrontendChoiceControl[];
	readonly canSubmit: boolean;
	readonly disabledReason?: string;
}

export interface FrontendSessionViewModel {
	readonly id: string;
	readonly name?: string;
	readonly recoveryPath?: string;
	readonly workingDirectory: string;
	readonly model: string;
	readonly thinkingLevel: ThinkingLevel;
	readonly streaming: boolean;
	readonly compacting: boolean;
	readonly retrying: boolean;
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

export type FrontendFeedBlock =
	| {
			readonly type: "user" | "system";
			readonly id: string;
			readonly turnId?: string;
			readonly text: string;
			readonly images?: readonly { readonly data: string; readonly mimeType: string }[];
			readonly timestamp?: number;
	  }
	| {
			readonly type: "text" | "thinking";
			readonly id: string;
			readonly turnId?: string;
			readonly text: string;
			readonly phase: "streaming" | "complete" | "compacted";
			readonly startedAt?: number;
			readonly durationMs?: number;
	  }
	| {
			readonly type: "tools";
			readonly id: string;
			readonly turnId?: string;
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
	  }
	| {
			readonly type: "agent-activity";
			readonly id: string;
			readonly actorId: string;
			readonly title: string;
			readonly detail?: string;
			readonly phase: "created" | "running" | "waiting" | "completed" | "failed";
	  }
	| {
			readonly type: "message";
			readonly id: string;
			readonly senderLabel: string;
			readonly recipientLabel: string;
			readonly text: string;
			readonly timestamp: number;
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
	readonly senderNavigation: FrontendNavigationReference;
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
}

export type FrontendMemoryFilter = "all" | "profile" | "vault" | "project" | "lessons" | "archived";

export interface FrontendMemoryRecordViewModel {
	readonly id: string;
	readonly revision: number;
	readonly iconToken: FrontendIconToken;
	readonly label: string;
	readonly stateLabel?: string;
	readonly content: string;
	readonly provenanceLabel: string;
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
	readonly filter: FrontendMemoryFilter;
	readonly filters: readonly {
		readonly id: FrontendMemoryFilter;
		readonly label: string;
		readonly selected: boolean;
	}[];
	readonly query: string;
	readonly searchResultCount?: number;
	readonly records: readonly FrontendMemoryRecordViewModel[];
	readonly candidates: readonly FrontendMemoryCandidateViewModel[];
	readonly createTargets: readonly FrontendChoiceOption[];
	readonly projectBoundary: {
		readonly description: string;
		readonly checked: boolean;
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

export interface FrontendPermissionChannelGrantViewModel {
	readonly channelId: string;
	readonly label: string;
	readonly decisions: Readonly<Record<"connect" | "read" | "send", FrontendPermissionDecision>>;
	readonly disabled: boolean;
}

export interface FrontendPermissionAdvancedGroupViewModel {
	readonly section: "path" | "external_directory" | "bash" | "skill";
	readonly label: string;
	readonly placeholder: string;
	readonly disabled: boolean;
	readonly rules: readonly { readonly pattern: string; readonly decision: FrontendPermissionDecision }[];
}

export interface FrontendPermissionScreenViewModel {
	readonly screenId: "permissions";
	readonly revision: number;
	readonly profileRevision: number;
	readonly loading: boolean;
	readonly error?: string;
	readonly statusMessage?: string;
	readonly selectedProfileId: string;
	readonly profiles: readonly FrontendPermissionProfileViewModel[];
	readonly selectedProfile: FrontendPermissionProfileViewModel;
	readonly capabilityDescription: string;
	readonly inventoryWarning?: string;
	readonly capabilities: readonly FrontendPermissionCapabilityGroupViewModel[];
	readonly channelDescription: string;
	readonly channels: readonly FrontendPermissionChannelGrantViewModel[];
	readonly availableChannels: readonly FrontendChoiceOption[];
	readonly advancedDescription: string;
	readonly advancedGroups: readonly FrontendPermissionAdvancedGroupViewModel[];
	readonly storageLines: readonly string[];
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
	readonly status: string;
	readonly statusLabel: string;
	readonly originLabel: string;
	readonly triggeredAt: string;
	readonly allocationLabel: string;
	readonly summary?: string;
	readonly error?: string;
	readonly canApprove: boolean;
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
export type FrontendSubagentContextMode = "fresh" | "fork" | "selected" | "summary";
export type FrontendSubagentDefinitionScope = "global" | "vault" | "directory" | "session";
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
	| "append-step"
	| "fork"
	| "clone"
	| "adopt"
	| "reconcile-orphan"
	| "approve-permission"
	| "deny-permission"
	| "approve-acceptance"
	| "reject-acceptance"
	| "extend-budget";

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
	scope: FrontendSubagentDefinitionScope;
	scopeId: string;
	systemPrompt: string;
	enabled: boolean;
	policy: FrontendSubagentRuntimePolicy;
	builtIn?: true;
	revision: number;
	updatedAt: number;
}

export interface FrontendSubagentAcceptancePolicy {
	level: "none" | "attested" | "checked" | "verified" | "reviewed";
	criteria?: string[];
	evidence?: (
		| "changed-files"
		| "tests-added"
		| "commands-run"
		| "residual-risks"
		| "no-staged-files"
		| "structured-result"
	)[];
	verify?: { id: string; command: string; timeoutMs?: number }[];
	reviewerAgentId?: string;
}

export interface FrontendSubagentWorkflowNodeDefinition {
	id: string;
	agentId: string;
	label: string;
	task: string;
	dependsOn: string[];
	priority?: number;
	concurrencyGroup?: string;
	executionMode?: FrontendSubagentExecutionMode;
	contextMode?: FrontendSubagentContextMode;
	model?: string;
	thinking?: ThinkingLevel;
	outputSchema?: Record<string, unknown>;
	dynamicFanout?: { fromNodeId: string; jsonPointer: string; itemName: string; maxItems: number };
	acceptance?: FrontendSubagentAcceptancePolicy;
}

export interface FrontendSubagentWorkflowDefinition {
	id: string;
	name: string;
	description: string;
	nodes: FrontendSubagentWorkflowNodeDefinition[];
	maxConcurrency?: number;
	failFast?: boolean;
	revision: number;
	updatedAt: number;
}

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

export interface FrontendSubagentPermissionRequestViewModel {
	id: string;
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
	context: { mode: FrontendSubagentContextMode; messageIds?: string[]; summary?: string };
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
	action: FrontendSubagentControlAction;
	state: "requested" | "acknowledged" | "effective" | "failed" | "timed-out";
	message?: string;
	timestamp: number;
}

export interface FrontendSubagentCapabilitiesViewModel {
	protocolVersion: 1;
	runtimeId: string;
	executionModes: FrontendSubagentResolvedExecutionMode[];
	supportsDynamicFanout: boolean;
	supportsSiblingCommunication: boolean;
	supportsWorkerRecovery: boolean;
	workerRecoveryMode: "none" | "reconcile" | "adopt";
	supportsWorktrees: boolean;
	supportsArtifactPromotion: boolean;
	maxReplayEvents: number;
}

export interface FrontendSubagentSettingsViewModel {
	settings: {
		maxConcurrency: number;
		defaultExecutionMode: FrontendSubagentExecutionMode;
		defaultMaxDepth: number;
		defaultMaxTurnsPerNode?: number;
		defaultMaxTokens?: number;
		defaultMaxCostUsd?: number;
		defaultMaxWallTimeMs?: number;
		automaticDelegation: "off" | "suggest" | "allowed";
		retentionDays: number;
		allowSiblingCommunication: boolean;
	};
	scope?: { kind: FrontendSubagentDefinitionScope; id: string };
	revision: number;
	sources: Partial<Record<string, { kind: FrontendSubagentDefinitionScope; id: string }>>;
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
	readonly runIds: readonly string[];
	readonly runSummaries: readonly FrontendSubagentRunSummaryViewModel[];
	readonly runQuery: FrontendSubagentRunFilter;
	readonly nextRunCursor?: string;
	readonly runs: readonly FrontendSubagentRunViewModel[];
	readonly definitions: readonly FrontendSubagentAgentDefinition[];
	readonly workflows: readonly FrontendSubagentWorkflowDefinition[];
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

export type FrontendScreenViewModel =
	| FrontendChannelScreenViewModel
	| FrontendMemoryScreenViewModel
	| FrontendContextQueryScreenViewModel
	| FrontendPermissionScreenViewModel
	| FrontendEventScreenViewModel
	| FrontendSubagentScreenViewModel;

export interface FrontendScreenRequest {
	readonly schemaVersion: 1;
	readonly viewId: string;
	readonly screenId: FrontendScreenId;
	readonly preferredEntityId?: string;
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
	readonly schemaVersion: 1;
	readonly protocolVersion: typeof CHATOBBY_FRONTEND_PROTOCOL_VERSION;
	readonly runtimeInstanceId: string;
	readonly revision: number;
	readonly sequence: number;
	readonly viewId: string;
	readonly session: FrontendSessionViewModel | null;
	readonly taskPlan: FrontendTaskPlanViewModel;
	readonly composer: FrontendComposerViewModel;
	readonly agentRail: FrontendAgentRailViewModel;
	readonly feed: FrontendFeedDocumentViewModel;
	readonly screens: readonly FrontendScreenDirectoryEntry[];
	readonly screenModels: readonly FrontendScreenViewModel[];
	readonly localCommands: readonly FrontendLocalCommandViewModel[];
}

export type FrontendScope =
	| { readonly kind: "view"; readonly viewId: string }
	| { readonly kind: "session"; readonly mainSessionId: string }
	| { readonly kind: "screen"; readonly viewId: string; readonly screenId: FrontendScreenId };

export type FrontendPatchOperation =
	| { readonly type: "session.replace"; readonly session: FrontendSessionViewModel }
	| { readonly type: "task-plan.replace"; readonly taskPlan: FrontendTaskPlanViewModel }
	| { readonly type: "composer.replace"; readonly composer: FrontendComposerViewModel }
	| { readonly type: "agent-rail.replace"; readonly agentRail: FrontendAgentRailViewModel }
	| { readonly type: "feed.document.replace"; readonly feed: FrontendFeedDocumentViewModel }
	| { readonly type: "feed.block.upsert"; readonly index: number; readonly block: FrontendFeedBlock }
	| { readonly type: "feed.block.remove"; readonly blockId: string }
	| { readonly type: "feed.text.append"; readonly blockId: string; readonly text: string }
	| { readonly type: "feed.turn.finalize"; readonly turnId: string; readonly completedAt: number }
	| { readonly type: "screen.replace"; readonly screen: FrontendScreenViewModel };

export interface FrontendPatch {
	readonly schemaVersion: 1;
	readonly runtimeInstanceId: string;
	readonly scope: FrontendScope;
	readonly sequence: number;
	readonly baseRevision: number;
	readonly revision: number;
	readonly operations: readonly FrontendPatchOperation[];
}

export interface FrontendSubscriptionRequest {
	readonly schemaVersion: 1;
	readonly viewId: string;
	readonly afterSequence?: number;
	/** Capable clients request authoritative frontend patches without duplicate legacy session frames. */
	readonly deliveryMode?: "patch-only";
}

export interface FrontendSubscriptionAck {
	readonly runtimeInstanceId: string;
	readonly sequence: number;
	readonly revision: number;
	readonly deliveryMode: "patch-and-legacy" | "patch-only";
}

interface FrontendIntentBase {
	readonly schemaVersion: 1;
	readonly intentId: string;
	readonly viewId: string;
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
			readonly type: "channel.select";
			readonly payload: { readonly channelId: string };
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
				readonly approved: boolean;
				readonly value?: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "memory.set-view";
			readonly payload: { readonly filter: FrontendMemoryFilter; readonly query: string };
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
				readonly isolateCurrentProject?: boolean;
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
				readonly contextMode: "fresh" | "fork" | "selected" | "summary";
				readonly workspaceMode: "shared" | "worktree";
				readonly permissionProfileId?: string;
				readonly priority: number;
				readonly maxTurns?: number;
				readonly maxTokens?: number;
				readonly maxWallTimeMs?: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.start-workflow" | "subagents.save-workflow";
			readonly payload: { readonly workflow: FrontendSubagentWorkflowDefinition };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.delete-workflow";
			readonly payload: { readonly workflowId: string; readonly expectedWorkflowRevision: number };
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.control";
			readonly payload: {
				readonly runId: string;
				readonly nodeId?: string;
				readonly action: FrontendSubagentControlAction;
				readonly message?: string;
				readonly priority?: number;
				readonly step?: FrontendSubagentWorkflowNodeDefinition;
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
				readonly definition: FrontendSubagentAgentDefinition;
				readonly permissionProfileId: string;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.delete-definition";
			readonly payload: {
				readonly definitionId: string;
				readonly scope: FrontendSubagentDefinitionScope;
				readonly scopeId: string;
				readonly expectedDefinitionRevision: number;
			};
	  })
	| (FrontendIntentBase & {
			readonly type: "subagents.update-settings";
			readonly payload: { readonly settings: FrontendSubagentSettingsViewModel };
	  });

export interface FrontendIntentResult {
	readonly intentId: string;
	readonly status: "accepted" | "completed" | "rejected" | "conflict";
	readonly revision?: number;
	readonly fieldErrors?: Readonly<Record<string, string>>;
	readonly notice?: {
		readonly level: "info" | "warning" | "error";
		readonly message: string;
	};
}

export function parseFrontendBootstrapRequest(value: unknown): FrontendBootstrapRequest {
	const input = requireRecord(value, "frontend bootstrap request");
	requireSchemaVersion(input);
	const supportedProtocolVersions = requireNumberArray(input.supportedProtocolVersions, "supportedProtocolVersions");
	if (!supportedProtocolVersions.includes(CHATOBBY_FRONTEND_PROTOCOL_VERSION)) {
		throw new Error(`Frontend protocol ${CHATOBBY_FRONTEND_PROTOCOL_VERSION} is not supported by this connector`);
	}
	const capabilities = requireRecord(input.capabilities, "capabilities");
	return {
		schemaVersion: 1,
		connectorVersion: requireString(input.connectorVersion, "connectorVersion"),
		obsidianVersion: requireString(input.obsidianVersion, "obsidianVersion"),
		vaultInstanceId: requireString(input.vaultInstanceId, "vaultInstanceId"),
		viewId: requireString(input.viewId, "viewId"),
		supportedProtocolVersions,
		capabilities: {
			featureFamilies: requireStringArray(capabilities.featureFamilies, "capabilities.featureFamilies"),
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

export function parseFrontendSubscriptionRequest(value: unknown): FrontendSubscriptionRequest {
	const input = requireRecord(value, "frontend subscription request");
	requireSchemaVersion(input);
	const afterSequence = optionalSafeInteger(input.afterSequence, "afterSequence");
	if (input.deliveryMode !== undefined && input.deliveryMode !== "patch-only") {
		throw new Error("deliveryMode must be patch-only when provided");
	}
	return {
		schemaVersion: 1,
		viewId: requireString(input.viewId, "viewId"),
		afterSequence,
		deliveryMode: input.deliveryMode,
	};
}

export function parseFrontendIntent(value: unknown): FrontendIntent {
	const input = requireRecord(value, "frontend intent");
	requireSchemaVersion(input);
	const expectedRevision = optionalSafeInteger(input.expectedRevision, "expectedRevision");
	const base = {
		schemaVersion: 1 as const,
		intentId: requireString(input.intentId, "intentId"),
		viewId: requireString(input.viewId, "viewId"),
		mainSessionId: optionalString(input.mainSessionId, "mainSessionId"),
		expectedRevision,
	};
	const payload = requireRecord(input.payload, "payload");
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
				filter: requireMemoryFilter(payload.filter),
				query: typeof payload.query === "string" ? payload.query : "",
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
		if (
			contextMode !== "fresh" &&
			contextMode !== "fork" &&
			contextMode !== "selected" &&
			contextMode !== "summary"
		) {
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
	if (input.type === "subagents.start-workflow" || input.type === "subagents.save-workflow") {
		return { ...base, type: input.type, payload: { workflow: parseWorkflowDefinition(payload.workflow) } };
	}
	if (input.type === "subagents.delete-workflow") {
		return {
			...base,
			type: input.type,
			payload: {
				workflowId: requireString(payload.workflowId, "payload.workflowId"),
				expectedWorkflowRevision: requireSafeInteger(
					payload.expectedWorkflowRevision,
					"payload.expectedWorkflowRevision",
				),
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
				step: payload.step === undefined ? undefined : parseWorkflowNode(payload.step),
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
		return {
			...base,
			type: input.type,
			payload: { definition: parseAgentDefinition(payload.definition), permissionProfileId },
		};
	}
	if (input.type === "subagents.delete-definition") {
		return {
			...base,
			type: input.type,
			payload: {
				definitionId: requireString(payload.definitionId, "payload.definitionId"),
				scope: requireDefinitionScope(payload.scope),
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
	if (input.type === "operator.set-view-open") {
		return { ...base, type: input.type, payload: { open: requireBoolean(payload.open, "payload.open") } };
	}
	if (input.type === "session.create") {
		return {
			...base,
			type: input.type,
			payload: {
				cwdOverride: optionalString(payload.cwdOverride, "payload.cwdOverride"),
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
	const screenId = requireString(input.screenId, "screenId");
	if (
		screenId !== "memory" &&
		screenId !== "permissions" &&
		screenId !== "events" &&
		screenId !== "queries" &&
		screenId !== "channels" &&
		screenId !== "subagents"
	) {
		throw new Error(`Unknown frontend screen: ${screenId}`);
	}
	return {
		schemaVersion: 1,
		viewId: requireString(input.viewId, "viewId"),
		screenId,
		preferredEntityId: optionalString(input.preferredEntityId, "preferredEntityId"),
	};
}

export function parseFrontendScreen(value: unknown): FrontendScreenViewModel {
	const input = requireRecord(value, "frontend screen");
	if (
		input.screenId !== "channels" &&
		input.screenId !== "memory" &&
		input.screenId !== "permissions" &&
		input.screenId !== "events" &&
		input.screenId !== "queries" &&
		input.screenId !== "subagents"
	) {
		throw new Error(`Unknown frontend screen: ${String(input.screenId)}`);
	}
	requireSafeInteger(input.revision, "revision");
	requireBoolean(input.loading, "loading");
	if (input.screenId === "channels") {
		requireArray(input.groups, "groups");
		requireString(input.heading, "heading");
		requireArray(input.messages, "messages");
		return value as FrontendChannelScreenViewModel;
	}
	if (input.screenId === "memory") {
		requireArray(input.filters, "filters");
		requireArray(input.records, "records");
		requireArray(input.candidates, "candidates");
		requireArray(input.learningSettings, "learningSettings");
		return value as FrontendMemoryScreenViewModel;
	}
	if (input.screenId === "queries") {
		requireString(input.projectName, "projectName");
		requireString(input.projectDirectory, "projectDirectory");
		requireBoolean(input.trusted, "trusted");
		requireArray(input.items, "items");
		return value as FrontendContextQueryScreenViewModel;
	}
	if (input.screenId === "permissions") {
		requireString(input.selectedProfileId, "selectedProfileId");
		requireArray(input.profiles, "profiles");
		requireRecord(input.selectedProfile, "selectedProfile");
		requireArray(input.capabilities, "capabilities");
		requireArray(input.channels, "channels");
		requireArray(input.advancedGroups, "advancedGroups");
		return value as FrontendPermissionScreenViewModel;
	}
	if (input.screenId === "subagents") {
		requireSafeInteger(input.sequence, "sequence");
		requireArray(input.runIds, "runIds");
		requireArray(input.runSummaries, "runSummaries");
		requireArray(input.runs, "runs");
		requireArray(input.definitions, "definitions");
		requireArray(input.workflows, "workflows");
		requireArray(input.messages, "messages");
		requireRecord(input.focusedFeed, "focusedFeed");
		return value as FrontendSubagentScreenViewModel;
	}
	requireArray(input.definitions, "definitions");
	requireArray(input.occurrences, "occurrences");
	requireSafeInteger(input.pendingApprovalCount, "pendingApprovalCount");
	return value as FrontendEventScreenViewModel;
}

export function parseFrontendBootstrap(value: unknown): FrontendBootstrap {
	const input = requireRecord(value, "frontend bootstrap");
	requireSchemaVersion(input);
	if (input.protocolVersion !== CHATOBBY_FRONTEND_PROTOCOL_VERSION) {
		throw new Error(`Unsupported frontend protocol version: ${String(input.protocolVersion)}`);
	}
	requireString(input.runtimeInstanceId, "runtimeInstanceId");
	requireString(input.viewId, "viewId");
	requireSafeInteger(input.revision, "revision");
	requireRecord(input.taskPlan, "taskPlan");
	requireRecord(input.composer, "composer");
	requireRecord(input.agentRail, "agentRail");
	requireRecord(input.feed, "feed");
	requireArray(input.screens, "screens");
	requireArray(input.screenModels, "screenModels");
	requireArray(input.localCommands, "localCommands");
	return value as FrontendBootstrap;
}

export function parseFrontendPatch(value: unknown): FrontendPatch {
	const input = requireRecord(value, "frontend patch");
	requireSchemaVersion(input);
	requireString(input.runtimeInstanceId, "runtimeInstanceId");
	requireSafeInteger(input.sequence, "sequence");
	requireSafeInteger(input.baseRevision, "baseRevision");
	requireSafeInteger(input.revision, "revision");
	requireRecord(input.scope, "scope");
	requireArray(input.operations, "operations");
	return value as FrontendPatch;
}

function requireSchemaVersion(input: Record<string, unknown>): void {
	if (input.schemaVersion !== 1)
		throw new Error(`Unsupported frontend schema version: ${String(input.schemaVersion)}`);
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

function requireMemoryFilter(value: unknown): FrontendMemoryFilter {
	if (
		value === "all" ||
		value === "profile" ||
		value === "vault" ||
		value === "project" ||
		value === "lessons" ||
		value === "archived"
	) {
		return value;
	}
	throw new Error(`payload.filter is invalid: ${String(value)}`);
}

function parseMemoryPolicyPatch(
	payload: Record<string, unknown>,
): Extract<FrontendIntent, { type: "memory.update-policy" }>["payload"] {
	const expectedMemoryRevision = requireSafeInteger(payload.expectedMemoryRevision, "payload.expectedMemoryRevision");
	const backgroundLearning = optionalLearningMode(payload.backgroundLearning, "payload.backgroundLearning");
	const correctionLearning = optionalLearningMode(payload.correctionLearning, "payload.correctionLearning");
	const promptRouting = optionalPromptRouting(payload.promptRouting);
	const isolateCurrentProject =
		payload.isolateCurrentProject === undefined
			? undefined
			: requireBoolean(payload.isolateCurrentProject, "payload.isolateCurrentProject");
	if (
		backgroundLearning === undefined &&
		correctionLearning === undefined &&
		promptRouting === undefined &&
		isolateCurrentProject === undefined
	) {
		throw new Error("memory.update-policy requires at least one change");
	}
	return { expectedMemoryRevision, backgroundLearning, correctionLearning, promptRouting, isolateCurrentProject };
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
	"append-step",
	"fork",
	"clone",
	"adopt",
	"reconcile-orphan",
	"approve-permission",
	"deny-permission",
	"approve-acceptance",
	"reject-acceptance",
	"extend-budget",
]);

function parseWorkflowNode(value: unknown): FrontendSubagentWorkflowNodeDefinition {
	const input = requireRecord(value, "payload.step");
	requireString(input.id, "payload.step.id");
	requireString(input.agentId, "payload.step.agentId");
	requireString(input.label, "payload.step.label");
	requireString(input.task, "payload.step.task");
	requireStringArray(input.dependsOn, "payload.step.dependsOn");
	return value as FrontendSubagentWorkflowNodeDefinition;
}

function parseWorkflowDefinition(value: unknown): FrontendSubagentWorkflowDefinition {
	const input = requireRecord(value, "payload.workflow");
	requireString(input.id, "payload.workflow.id");
	requireString(input.name, "payload.workflow.name");
	if (typeof input.description !== "string") throw new Error("payload.workflow.description must be a string");
	requireArray(input.nodes, "payload.workflow.nodes").forEach((node) => {
		parseWorkflowNode(node);
	});
	requireSafeInteger(input.revision, "payload.workflow.revision");
	requireSafeInteger(input.updatedAt, "payload.workflow.updatedAt");
	return value as FrontendSubagentWorkflowDefinition;
}

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

function requireDefinitionScope(value: unknown): FrontendSubagentDefinitionScope {
	if (value === "global" || value === "vault" || value === "directory" || value === "session") return value;
	throw new Error("payload.scope is invalid");
}

function parseResolvedSubagentSettings(value: unknown): FrontendSubagentSettingsViewModel {
	const input = requireRecord(value, "payload.settings");
	requireRecord(input.settings, "payload.settings.settings");
	requireSafeInteger(input.revision, "payload.settings.revision");
	requireRecord(input.sources, "payload.settings.sources");
	return value as FrontendSubagentSettingsViewModel;
}
