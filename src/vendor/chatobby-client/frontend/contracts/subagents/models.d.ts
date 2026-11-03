import type { PermissionRequestReview } from "../../../permission-review.js";
import type { ThinkingLevel } from "../../../wire-types.js";
/** Public subagent contracts intentionally decoupled from the private supervisor package. */
export type FrontendSubagentExecutionMode = "auto" | "in-process" | "worker-process";
export type FrontendSubagentResolvedExecutionMode = Exclude<FrontendSubagentExecutionMode, "auto">;
export type FrontendSubagentContextMode = "fresh" | "fork";
/** Internal resolution layers reported to the frontend for provenance and effective settings. */
export type FrontendSubagentResolutionLayer = "global" | "vault" | "directory" | "session";
/** Availability choices accepted when a user creates or edits an agent role. */
export type FrontendSubagentUserDefinitionScope = "vault" | "directory";
export type FrontendSubagentRunStatus = "created" | "queued" | "running" | "paused" | "waiting" | "completed" | "failed" | "cancelled" | "orphaned";
export type FrontendSubagentNodeStatus = "blocked" | "queued" | "running" | "waiting" | "paused" | "completed" | "failed" | "cancelled" | "skipped" | "orphaned";
export type FrontendSubagentControlAction = "cancel" | "pause" | "resume" | "interrupt" | "steer" | "complete" | "retry" | "reprioritize" | "fork" | "clone" | "decide-child-input" | "decide-tool-permission" | "adopt" | "reconcile-orphan" | "approve-permission" | "deny-permission" | "approve-acceptance" | "reject-acceptance" | "extend-budget";
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
export type FrontendSubagentLaunchResolutionSource = "node" | "run" | "role" | "parent" | "project" | "settings" | "fallback" | "auto";
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
    permissionRequest?: PermissionRequestReview;
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
    context: {
        mode: FrontendSubagentContextMode;
    };
    permissionProfileId?: string;
    workspace: {
        cwd: string;
        mode: "shared" | "worktree" | "sandbox";
        artifactDirectory?: string;
        resolvedCwd: string;
        provider: string;
        workspaceId: string;
        baseRevision?: string;
        /** @deprecated Legacy v2 input only. New runtime projections omit this domain recovery map. */
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
    scope?: {
        kind: FrontendSubagentResolutionLayer;
        id: string;
    };
    revision: number;
    sources: Partial<Record<string, {
        kind: FrontendSubagentResolutionLayer;
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
