import type { ProjectErrorV1 } from "./errors.ts";
import type {
	BindingId,
	DirectoryCandidateRef,
	DirectoryId,
	ProjectCommandId,
	ProjectEventId,
	ProjectId,
	ProjectReceiptId,
	RootId,
	RootOperationId,
	SessionId,
	SessionPreflightReceiptId,
	VaultId,
} from "./ids.ts";
import type {
	DirectoryDeviceBindingV1,
	DirectoryMarkerIndexV1,
	ProjectBriefMetadataV1,
	ProjectDefaultsV1,
	ProjectRecordV1,
	ProjectRootLocationV1,
	RootMutationKindV1,
	RootRecoveryResultV1,
	SessionWorkspaceBindingV1,
} from "./models.ts";

interface ProjectCommandEnvelopeV1 {
	readonly schemaVersion: 1;
	readonly commandId: ProjectCommandId;
	readonly issuedAt: string;
}

interface ProjectRootCommandEnvelopeV1 extends ProjectCommandEnvelopeV1 {
	readonly projectId: ProjectId;
	readonly expectedRevision: number;
}

export type ProjectCreationRootIntentV1 =
	| {
			readonly kind: "selected-root";
			readonly directoryCandidateRef: DirectoryCandidateRef;
			readonly label: string;
			readonly markerPolicy: "required" | "optional" | "disabled";
			readonly directoryReuse: "canonical" | "none";
	  }
	| {
			readonly kind: "vault-folder";
			readonly label: string;
			readonly directoryReuse: "canonical" | "none";
	  };

export type ProjectCommandV1 =
	| (ProjectCommandEnvelopeV1 & {
			/** Product path for atomic Project + primary-root creation. */
			readonly type: "project.create.atomic";
			readonly name: string;
			readonly description?: string;
			readonly creationKind: "directory-session" | "manual" | "migration";
			readonly defaults: ProjectDefaultsV1;
			readonly root: ProjectCreationRootIntentV1;
	  })
	| (ProjectCommandEnvelopeV1 & {
			readonly type: "project.replace";
			readonly expectedRevision: number;
			readonly record: ProjectRecordV1;
	  })
	| (ProjectCommandEnvelopeV1 & {
			readonly type: "project.archive" | "project.restore";
			readonly projectId: ProjectId;
			readonly expectedRevision: number;
	  })
	| (ProjectCommandEnvelopeV1 & {
			readonly type: "project.brief.replace";
			readonly projectId: ProjectId;
			readonly expectedRevision: number;
			readonly markdown: string;
	  })
	| (ProjectCommandEnvelopeV1 & {
			readonly type: "project.brief.remove";
			readonly projectId: ProjectId;
			readonly expectedRevision: number;
	  })
	| (ProjectCommandEnvelopeV1 & {
			readonly type: "session-workspace.replace";
			readonly expectedRevision: number;
			readonly binding: SessionWorkspaceBindingV1;
	  })
	| (ProjectCommandEnvelopeV1 & {
			/** Compensating removal for a staged session transition that did not publish. */
			readonly type: "session-workspace.remove";
			readonly sessionId: SessionId;
			readonly expectedRevision: number;
	  })
	| (ProjectRootCommandEnvelopeV1 & {
			readonly type: "project.root.register";
			readonly rootId: RootId;
			readonly directoryCandidateRef: DirectoryCandidateRef;
	  })
	| (ProjectRootCommandEnvelopeV1 & {
			readonly type: "project.root.add";
			readonly label: string;
			readonly location: ProjectRootLocationV1;
			readonly markerPolicy: "required" | "optional" | "disabled";
			readonly directoryReuse: "canonical" | "none";
			readonly directoryCandidateRef: DirectoryCandidateRef;
	  })
	| (ProjectRootCommandEnvelopeV1 & {
			readonly type: "project.root.relabel";
			readonly rootId: RootId;
			readonly label: string;
	  })
	| (ProjectRootCommandEnvelopeV1 & {
			readonly type: "project.root.set-primary";
			readonly rootId: RootId;
			readonly sessionPreflightReceiptId: SessionPreflightReceiptId;
	  })
	| (ProjectRootCommandEnvelopeV1 & {
			readonly type: "project.root.remove";
			readonly rootId: RootId;
			readonly replacementRootId?: RootId;
			readonly sessionPreflightReceiptId: SessionPreflightReceiptId;
	  })
	| (ProjectRootCommandEnvelopeV1 & {
			readonly type: "project.root.relink" | "project.root.repair";
			readonly rootId: RootId;
			readonly directoryCandidateRef: DirectoryCandidateRef;
	  })
	| (ProjectRootCommandEnvelopeV1 & {
			readonly type: "project.root.assign-new-identity";
			readonly rootIds: readonly RootId[];
			readonly directoryCandidateRef: DirectoryCandidateRef;
	  });

interface ProjectEventEnvelopeV1 {
	readonly schemaVersion: 1;
	readonly eventId: ProjectEventId;
	readonly sequence: number;
	readonly occurredAt: string;
}

export type ProjectEventV1 =
	| (ProjectEventEnvelopeV1 & {
			readonly type: "project.recorded";
			readonly record: ProjectRecordV1;
	  })
	| (ProjectEventEnvelopeV1 & {
			readonly type: "project.brief.recorded";
			readonly brief: ProjectBriefMetadataV1;
	  })
	| (ProjectEventEnvelopeV1 & {
			readonly type: "project.brief.removed";
			readonly projectId: ProjectId;
			readonly previousRevision: number;
	  })
	| (ProjectEventEnvelopeV1 & {
			readonly type: "session-workspace.recorded";
			readonly binding: SessionWorkspaceBindingV1;
	  })
	| (ProjectEventEnvelopeV1 & {
			readonly type: "session-workspace.removed";
			readonly sessionId: SessionId;
			readonly previousRevision: number;
	  })
	| (ProjectEventEnvelopeV1 & {
			readonly type: "directory-marker-index.recorded";
			readonly index: DirectoryMarkerIndexV1;
	  })
	| (ProjectEventEnvelopeV1 & {
			readonly type: "project.root.recorded";
			readonly operation: RootMutationKindV1;
			readonly record: ProjectRecordV1;
			readonly affectedRootIds: readonly RootId[];
			readonly directoryIds: readonly DirectoryId[];
	  })
	| (ProjectEventEnvelopeV1 & {
			readonly type: "project.root.recovery-recorded";
			readonly result: RootRecoveryResultV1;
	  });

export interface ProjectSummaryProjectionV1 {
	readonly schemaVersion: 1;
	readonly projectId: ProjectId;
	readonly vaultId: VaultId;
	readonly revision: number;
	readonly name: string;
	readonly description?: string;
	readonly lifecycle: ProjectRecordV1["lifecycle"];
	readonly creationKind: ProjectRecordV1["creationKind"];
	readonly primaryRootId?: RootId;
	readonly primaryRootLabel?: string;
	readonly rootCount: number;
	readonly briefRevision?: number;
	readonly briefUpdatedAt?: string;
	readonly updatedAt: string;
}

export interface ProjectDetailProjectionV1 {
	readonly schemaVersion: 1;
	readonly project: ProjectRecordV1;
	readonly bindings: readonly DirectoryBindingProjectionV1[];
	readonly activeSessionIds: readonly SessionId[];
	readonly brief?: ProjectBriefMetadataV1;
}

/** Browser-safe view of device-local resolution state. Paths and device identity never cross this boundary. */
export interface DirectoryBindingProjectionV1 {
	readonly schemaVersion: 1;
	readonly revision: number;
	readonly bindingId: BindingId;
	readonly directoryId: DirectoryId;
	readonly status: DirectoryDeviceBindingV1["status"];
	readonly recoveryMode: DirectoryDeviceBindingV1["recoveryMode"];
	readonly historyCount: number;
	readonly lastValidatedAt: string;
}

export interface ProjectStructuralRootProjectionV1 {
	readonly rootId: RootId;
	readonly label: string;
	readonly primary: boolean;
	readonly locationKind: ProjectRecordV1["roots"][number]["location"]["kind"];
}

export interface ProjectStructuralProjectionV1 {
	readonly schemaVersion: 1;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly lifecycle: ProjectRecordV1["lifecycle"];
	readonly primaryRootId?: RootId;
	readonly roots: readonly ProjectStructuralRootProjectionV1[];
	readonly rootCount: number;
	readonly hasMoreRoots: boolean;
	readonly hasBrief: boolean;
}

export interface ProjectSnapshotV1 {
	readonly schemaVersion: 1;
	readonly sequence: number;
	readonly capturedAt: string;
	readonly vaultId: VaultId;
	readonly projects: readonly ProjectRecordV1[];
	readonly briefs: readonly ProjectBriefMetadataV1[];
	readonly directoryBindings: readonly DirectoryBindingProjectionV1[];
	readonly sessionWorkspaceBindings: readonly SessionWorkspaceBindingV1[];
}

export interface ProjectMutationReceiptV1 {
	readonly schemaVersion: 1;
	readonly receiptId: ProjectReceiptId;
	readonly commandId: ProjectCommandId;
	/** Distinguishes product commands from the package-internal migration admission path. */
	readonly admissionKind: "project-command" | "migration-bootstrap";
	/** Canonical identity of every field admitted under commandId. */
	readonly commandSha256: string;
	readonly outcome: "applied" | "no-op" | "rejected";
	readonly occurredAt: string;
	readonly projectId?: ProjectId;
	readonly resultingRevision?: number;
	readonly resultingSequence?: number;
	readonly eventIds: readonly ProjectEventId[];
	readonly error?: ProjectErrorV1;
}

export interface ProjectMigrationReceiptV1 {
	readonly schemaVersion: 1;
	readonly receiptId: ProjectReceiptId;
	readonly migrationId: string;
	readonly outcome: "migrated" | "archived" | "rolled-back" | "failed";
	readonly sourceVersion: string;
	readonly targetVersion: string;
	readonly startedAt: string;
	readonly completedAt: string;
	readonly archiveReference?: string;
	readonly migratedProjectIds: readonly ProjectId[];
	readonly warnings: readonly string[];
	readonly error?: ProjectErrorV1;
	readonly containsSecretValues: false;
}

export interface RootOperationReceiptV1 {
	readonly schemaVersion: 1;
	readonly receiptType: "root-operation";
	readonly receiptId: ProjectReceiptId;
	readonly operationId: RootOperationId;
	readonly commandId: ProjectCommandId;
	readonly commandSha256: string;
	readonly operation: RootMutationKindV1;
	readonly outcome: "applied" | "no-op" | "rejected" | "cancelled" | "timed-out";
	readonly occurredAt: string;
	readonly projectId: ProjectId;
	readonly affectedRootIds: readonly RootId[];
	readonly directoryIds: readonly DirectoryId[];
	readonly resultingRevision?: number;
	readonly resultingSequence?: number;
	readonly eventIds: readonly ProjectEventId[];
	readonly error?: ProjectErrorV1;
}

export type ProjectCommandReceiptV1 = ProjectMutationReceiptV1 | RootOperationReceiptV1;

export type ProjectReceiptV1 = ProjectCommandReceiptV1 | ProjectMigrationReceiptV1;

export function projectProjectSummary(
	record: ProjectRecordV1,
	brief?: ProjectBriefMetadataV1,
): ProjectSummaryProjectionV1 {
	const primaryRoot = record.roots.find((root) => root.rootId === record.primaryRootId);
	return Object.freeze({
		schemaVersion: 1,
		projectId: record.projectId,
		vaultId: record.vaultId,
		revision: record.revision,
		name: record.name,
		...(record.description === undefined ? {} : { description: record.description }),
		lifecycle: record.lifecycle,
		creationKind: record.creationKind,
		...(record.primaryRootId === undefined ? {} : { primaryRootId: record.primaryRootId }),
		...(primaryRoot === undefined ? {} : { primaryRootLabel: primaryRoot.label }),
		rootCount: record.roots.length,
		...(brief === undefined ? {} : { briefRevision: brief.revision, briefUpdatedAt: brief.updatedAt }),
		updatedAt: record.updatedAt,
	});
}

export function projectProjectDetail(
	project: ProjectRecordV1,
	bindings: readonly DirectoryDeviceBindingV1[],
	sessionBindings: readonly SessionWorkspaceBindingV1[],
	brief?: ProjectBriefMetadataV1,
): ProjectDetailProjectionV1 {
	return Object.freeze({
		schemaVersion: 1,
		project,
		bindings: Object.freeze(
			[...bindings]
				.filter((binding) => project.roots.some((root) => root.directoryId === binding.directoryId))
				.sort((left, right) => left.bindingId.localeCompare(right.bindingId))
				.map(projectDirectoryBinding),
		),
		activeSessionIds: Object.freeze(
			[...sessionBindings]
				.filter((binding) => binding.kind === "project" && binding.projectId === project.projectId)
				.map((binding) => binding.sessionId)
				.sort((left, right) => left.localeCompare(right)),
		),
		...(brief === undefined ? {} : { brief }),
	});
}

export function projectDirectoryBinding(binding: DirectoryDeviceBindingV1): DirectoryBindingProjectionV1 {
	return Object.freeze({
		schemaVersion: 1,
		revision: binding.revision,
		bindingId: binding.bindingId,
		directoryId: binding.directoryId,
		status: binding.status,
		recoveryMode: binding.recoveryMode,
		historyCount: binding.history.length,
		lastValidatedAt: binding.lastValidatedAt,
	});
}

export function projectProjectStructure(
	project: ProjectRecordV1,
	options: { readonly maximumRoots?: number; readonly brief?: ProjectBriefMetadataV1 } = {},
): ProjectStructuralProjectionV1 {
	const maximumRoots = Math.max(1, Math.min(32, Math.trunc(options.maximumRoots ?? 8)));
	const roots = [...project.roots]
		.sort((left, right) =>
			left.rootId === project.primaryRootId
				? -1
				: right.rootId === project.primaryRootId
					? 1
					: left.rootId.localeCompare(right.rootId),
		)
		.slice(0, maximumRoots)
		.map((root) =>
			Object.freeze({
				rootId: root.rootId,
				label: root.label,
				primary: root.rootId === project.primaryRootId,
				locationKind: root.location.kind,
			}),
		);
	return Object.freeze({
		schemaVersion: 1,
		projectId: project.projectId,
		name: project.name,
		lifecycle: project.lifecycle,
		...(project.primaryRootId === undefined ? {} : { primaryRootId: project.primaryRootId }),
		roots: Object.freeze(roots),
		rootCount: project.roots.length,
		hasMoreRoots: project.roots.length > roots.length,
		hasBrief: options.brief !== undefined,
	});
}
