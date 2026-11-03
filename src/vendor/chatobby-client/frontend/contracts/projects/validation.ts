// Generated from packages/chatobby/src/frontend/contracts/projects/validation.ts. Do not edit.
import { validateChoices } from "../choices.ts";
import {
	optionalString,
	requireBoolean,
	requireEnumValue,
	requireRecord,
	requireSafeInteger,
	requireString,
	requireStringArray,
	requireTextValue,
	validateArray,
} from "../validation.ts";
import {
	requireProjectAvailabilityFilter,
	requireProjectLifecycleFilter,
	requireProjectSessionSearchMode,
	requireProjectSessionSort,
	requireProjectSort,
} from "./fields.ts";

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

export function validateProjectScreen(input: Record<string, unknown>): void {
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
