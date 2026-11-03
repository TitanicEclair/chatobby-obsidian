// Generated from packages/chatobby/src/frontend/contracts/subagents/validation.ts. Do not edit.
import { parsePermissionRequestReview } from "../../../permission-review.ts";
import {
	optionalFiniteNumber,
	optionalNullableString,
	optionalSafeInteger,
	optionalString,
	optionalTextValue,
	requireArray,
	requireBoolean,
	requireEnumValue,
	requireFiniteNumber,
	requireJsonValue,
	requireNumberRecord,
	requireRecord,
	requireSafeInteger,
	requireString,
	requireStringArray,
	requireTextValue,
	requireThinkingLevel,
	validateArray,
	validateStringRecord,
} from "../validation.ts";
import type {
	FrontendSubagentActorViewModel,
	FrontendSubagentAgentDefinition,
	FrontendSubagentControlAction,
	FrontendSubagentMessageViewModel,
	FrontendSubagentResolutionLayer,
	FrontendSubagentRunFilter,
	FrontendSubagentRunStatus,
	FrontendSubagentSettingsViewModel,
	FrontendSubagentUserAgentDefinition,
	FrontendSubagentUserDefinitionScope,
} from "./models.ts";

export const SUBAGENT_RUN_STATUS_VALUES = [
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

export function validateSubagentDefinition(value: unknown, label: string): void {
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

export function validateSubagentRunSummary(value: unknown, label: string): void {
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

export function validateSubagentMessage(value: unknown, label: string): void {
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
	if (permission.permissionRequest !== undefined) {
		if (permission.kind !== "confirm") throw new Error(`${label}.permissionRequest requires a confirm request`);
		parsePermissionRequestReview(permission.permissionRequest);
	}
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

export function validateSubagentRun(value: unknown, label: string): void {
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

export function validateSubagentArtifact(value: unknown, label: string): void {
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

export function parseFrontendSubagentMessage(value: unknown, label: string): FrontendSubagentMessageViewModel {
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

export function parseSubagentRunQuery(value: unknown): FrontendSubagentRunFilter {
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

export function requireSubagentControlAction(value: unknown): FrontendSubagentControlAction {
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

export function requireUserDefinitionScope(value: unknown): FrontendSubagentUserDefinitionScope {
	if (value === "vault" || value === "directory") return value;
	throw new Error("payload.scope must be vault or directory");
}

export function parseUserAgentDefinition(value: unknown): FrontendSubagentUserAgentDefinition {
	const definition = parseAgentDefinition(value);
	const scope = requireUserDefinitionScope(definition.scope);
	if (definition.builtIn !== undefined) throw new Error("payload.definition.builtIn is not allowed");
	const { builtIn: _builtIn, ...userDefinition } = definition;
	return { ...userDefinition, scope };
}

export function parseResolvedSubagentSettings(value: unknown): FrontendSubagentSettingsViewModel {
	const input = requireRecord(value, "payload.settings");
	requireRecord(input.settings, "payload.settings.settings");
	requireSafeInteger(input.revision, "payload.settings.revision");
	requireRecord(input.sources, "payload.settings.sources");
	return value as FrontendSubagentSettingsViewModel;
}
