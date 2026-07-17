import type { ThinkingLevel } from "./wire-types.js";
/** Public, data-only protocol consumed by reviewable Chatobby frontends. */
export declare const CHATOBBY_FRONTEND_PROTOCOL_VERSION = 1;
export type FrontendScreenId = "memory" | "permissions" | "events" | "queries" | "channels" | "subagents";
export type FrontendIconToken = "activity" | "agent" | "alert" | "archive" | "arrow-left-right" | "audio-lines" | "badge-alert" | "blocks" | "book-open" | "book-plus" | "book-up" | "brain" | "bot" | "calendar" | "calendar-clock" | "calendar-plus" | "calendar-x" | "captions" | "channel" | "check" | "clock" | "command" | "external-link" | "file" | "file-plus" | "file-text" | "folder" | "folder-kanban" | "folder-sync" | "git-branch" | "git-graph" | "globe" | "history" | "image" | "info" | "layout-panel-top" | "link" | "list" | "list-checks" | "memory" | "messages-square" | "paperclip" | "pencil" | "play" | "plug" | "search" | "square-terminal" | "send" | "shield" | "shield-check" | "shield-x" | "terminal" | "terminal-square" | "toggle-right" | "tool" | "trash-2" | "triangle-alert" | "unplug" | "users" | "user-round" | "video" | "workflow" | "wrench" | "x";
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
export type FrontendFeedBlock = {
    readonly type: "user" | "system";
    readonly id: string;
    readonly turnId?: string;
    readonly text: string;
    readonly images?: readonly {
        readonly data: string;
        readonly mimeType: string;
    }[];
    readonly timestamp?: number;
} | {
    readonly type: "text" | "thinking";
    readonly id: string;
    readonly turnId?: string;
    readonly text: string;
    readonly phase: "streaming" | "complete" | "compacted";
    readonly startedAt?: number;
    readonly durationMs?: number;
} | {
    readonly type: "tools";
    readonly id: string;
    readonly turnId?: string;
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
    readonly type: "compaction";
    readonly id: string;
    readonly phase: "active" | "done";
    readonly startedAt: number;
    readonly detail?: string;
} | {
    readonly type: "agent-activity";
    readonly id: string;
    readonly actorId: string;
    readonly title: string;
    readonly detail?: string;
    readonly phase: "created" | "running" | "waiting" | "completed" | "failed";
} | {
    readonly type: "message";
    readonly id: string;
    readonly senderLabel: string;
    readonly recipientLabel: string;
    readonly text: string;
    readonly timestamp: number;
    readonly navigation?: FrontendNavigationReference;
} | {
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
    readonly rules: readonly {
        readonly pattern: string;
        readonly decision: FrontendPermissionDecision;
    }[];
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
export type FrontendSubagentRunStatus = "created" | "queued" | "running" | "paused" | "waiting" | "completed" | "failed" | "cancelled" | "orphaned";
export type FrontendSubagentNodeStatus = "blocked" | "queued" | "running" | "waiting" | "paused" | "completed" | "failed" | "cancelled" | "skipped" | "orphaned";
export type FrontendSubagentControlAction = "cancel" | "pause" | "resume" | "interrupt" | "steer" | "complete" | "retry" | "reprioritize" | "append-step" | "fork" | "clone" | "adopt" | "reconcile-orphan" | "approve-permission" | "deny-permission" | "approve-acceptance" | "reject-acceptance";
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
    revision: number;
    updatedAt: number;
}
export interface FrontendSubagentAcceptancePolicy {
    level: "none" | "attested" | "checked" | "verified" | "reviewed";
    criteria?: string[];
    evidence?: ("changed-files" | "tests-added" | "commands-run" | "residual-risks" | "no-staged-files" | "structured-result")[];
    verify?: {
        id: string;
        command: string;
        timeoutMs?: number;
    }[];
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
    dynamicFanout?: {
        fromNodeId: string;
        jsonPointer: string;
        itemName: string;
        maxItems: number;
    };
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
    context: {
        mode: FrontendSubagentContextMode;
        messageIds?: string[];
        summary?: string;
    };
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
    parent?: {
        runId: string;
        nodeId: string;
        depth: number;
    };
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
    scope?: {
        kind: FrontendSubagentDefinitionScope;
        id: string;
    };
    revision: number;
    sources: Partial<Record<string, {
        kind: FrontendSubagentDefinitionScope;
        id: string;
    }>>;
}
export interface FrontendSubagentPermissionSnapshotViewModel {
    document: {
        profiles: {
            id: string;
            name: string;
        }[];
        agentAssignments: Record<string, {
            mode: "inherit";
        } | {
            mode: "profile";
            profileId: string;
        }>;
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
export type FrontendScreenViewModel = FrontendChannelScreenViewModel | FrontendMemoryScreenViewModel | FrontendContextQueryScreenViewModel | FrontendPermissionScreenViewModel | FrontendEventScreenViewModel | FrontendSubagentScreenViewModel;
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
export type FrontendScope = {
    readonly kind: "view";
    readonly viewId: string;
} | {
    readonly kind: "session";
    readonly mainSessionId: string;
} | {
    readonly kind: "screen";
    readonly viewId: string;
    readonly screenId: FrontendScreenId;
};
export type FrontendPatchOperation = {
    readonly type: "session.replace";
    readonly session: FrontendSessionViewModel;
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
export type FrontendIntent = (FrontendIntentBase & {
    readonly type: "session.create";
    readonly payload: {
        readonly cwdOverride?: string;
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
}) | (FrontendIntentBase & {
    readonly type: "channel.select";
    readonly payload: {
        readonly channelId: string;
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
        readonly approved: boolean;
        readonly value?: string;
    };
}) | (FrontendIntentBase & {
    readonly type: "memory.set-view";
    readonly payload: {
        readonly filter: FrontendMemoryFilter;
        readonly query: string;
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
        readonly isolateCurrentProject?: boolean;
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
        readonly contextMode: "fresh" | "fork" | "selected" | "summary";
        readonly workspaceMode: "shared" | "worktree";
        readonly priority: number;
        readonly maxTurns?: number;
        readonly maxTokens?: number;
        readonly maxWallTimeMs?: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.start-workflow" | "subagents.save-workflow";
    readonly payload: {
        readonly workflow: FrontendSubagentWorkflowDefinition;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.delete-workflow";
    readonly payload: {
        readonly workflowId: string;
        readonly expectedWorkflowRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.control";
    readonly payload: {
        readonly runId: string;
        readonly nodeId?: string;
        readonly action: FrontendSubagentControlAction;
        readonly message?: string;
        readonly priority?: number;
        readonly step?: FrontendSubagentWorkflowNodeDefinition;
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
        readonly definition: FrontendSubagentAgentDefinition;
        readonly permissionProfileId: string | "inherit";
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.delete-definition";
    readonly payload: {
        readonly definitionId: string;
        readonly scope: FrontendSubagentDefinitionScope;
        readonly scopeId: string;
        readonly expectedDefinitionRevision: number;
    };
}) | (FrontendIntentBase & {
    readonly type: "subagents.update-settings";
    readonly payload: {
        readonly settings: FrontendSubagentSettingsViewModel;
    };
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
export declare function parseFrontendBootstrapRequest(value: unknown): FrontendBootstrapRequest;
export declare function parseFrontendSubscriptionRequest(value: unknown): FrontendSubscriptionRequest;
export declare function parseFrontendIntent(value: unknown): FrontendIntent;
export declare function parseFrontendScreenRequest(value: unknown): FrontendScreenRequest;
export declare function parseFrontendScreen(value: unknown): FrontendScreenViewModel;
export declare function parseFrontendBootstrap(value: unknown): FrontendBootstrap;
export declare function parseFrontendPatch(value: unknown): FrontendPatch;
export {};
