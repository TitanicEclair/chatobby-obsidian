import type {
	BindingId,
	DeviceId,
	DirectoryCandidateRef,
	DirectoryId,
	DirectoryObservationId,
	ProjectCommandId,
	ProjectId,
	RootId,
	RootOperationId,
	SessionId,
	VaultId,
} from "./ids.ts";

export const PROJECT_SCHEMA_VERSION = 1 as const;

export interface VaultIdentityV1 {
	readonly schemaVersion: 1;
	readonly vaultId: VaultId;
	readonly createdAt: string;
}

/** Stable installation-local identity. It is not a hardware fingerprint. */
export interface DeviceIdentityV1 {
	readonly schemaVersion: 1;
	readonly deviceId: DeviceId;
	readonly createdAt: string;
}

export interface VaultRelativeLocationV1 {
	readonly kind: "vault-relative";
	readonly relativePath: string;
}

export interface ExternalLocationV1 {
	readonly kind: "external";
}

export type ProjectRootLocationV1 = VaultRelativeLocationV1 | ExternalLocationV1;

export type ProjectGitPolicyV1 = "off" | "detect" | "offer-initialize";

export interface ProjectDefaultsV1 {
	readonly permissionProfileId?: string;
	readonly agentRoleId?: string;
	readonly mcpConnectionSetId?: string;
	readonly eventSetId?: string;
	readonly workflowSetId?: string;
	readonly gitPolicy?: ProjectGitPolicyV1;
}

export interface ProjectRootV1 {
	readonly rootId: RootId;
	readonly directoryId: DirectoryId;
	readonly label: string;
	readonly location: ProjectRootLocationV1;
	readonly markerPolicy: "required" | "optional" | "disabled";
	readonly directoryReuse: "canonical" | "none";
	readonly createdAt: string;
}

export interface ProjectRecordV1 {
	readonly schemaVersion: 1;
	readonly projectId: ProjectId;
	readonly vaultId: VaultId;
	readonly revision: number;
	readonly name: string;
	readonly description?: string;
	readonly lifecycle: "active" | "archived";
	readonly creationKind: "directory-session" | "manual" | "migration";
	/** Present when the Project currently has at least one working folder. */
	readonly primaryRootId?: RootId;
	readonly roots: readonly ProjectRootV1[];
	readonly defaults: ProjectDefaultsV1;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ProjectBriefMetadataV1 {
	readonly schemaVersion: 1;
	readonly projectId: ProjectId;
	readonly vaultId: VaultId;
	readonly revision: number;
	readonly contentSha256: string;
	readonly byteLength: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ProjectBriefV1 extends ProjectBriefMetadataV1 {
	readonly markdown: string;
}

export const DIRECTORY_BINDING_HISTORY_LIMIT = 32 as const;

export interface DirectoryBindingHistoryEntryV1 {
	readonly canonicalAbsolutePath: string;
	readonly recordedAt: string;
	readonly reason: "initial" | "rename" | "move" | "relink" | "recovery" | "replacement";
}

/** One device's current resolution of one stable directory identity. */
export interface DirectoryDeviceBindingV1 {
	readonly schemaVersion: 1;
	readonly revision: number;
	readonly bindingId: BindingId;
	readonly vaultId: VaultId;
	readonly directoryId: DirectoryId;
	readonly deviceId: DeviceId;
	readonly canonicalAbsolutePath: string;
	readonly status: "available" | "missing" | "conflict" | "relink-required";
	readonly recoveryMode: "marker" | "device-binding-only";
	readonly history: readonly DirectoryBindingHistoryEntryV1[];
	readonly lastValidatedAt: string;
}

export interface DirectoryMarkerObservationV1 {
	readonly observationId: DirectoryObservationId;
	readonly directoryId: DirectoryId;
	readonly candidateRef: DirectoryCandidateRef;
	readonly scope: "vault" | "external";
	readonly source: "vault-index" | "bounded-search" | "live-event" | "explicit-relink";
	readonly vaultRelativePath?: string;
	readonly markerSha256: string;
	readonly observedAt: string;
}

export interface DirectoryMarkerIndexCoverageV1 {
	readonly kind: "complete" | "bounded" | "partial";
	readonly scope: "vault" | "external";
	readonly capturedAt: string;
	readonly visitedDirectories: number;
	readonly maximumDirectories: number;
	readonly hasMore: boolean;
	readonly cancelled: boolean;
	readonly timedOut: boolean;
}

export interface DirectoryMarkerIndexV1 {
	readonly schemaVersion: 1;
	readonly revision: number;
	readonly vaultId: VaultId;
	readonly deviceId: DeviceId;
	readonly coverage: readonly DirectoryMarkerIndexCoverageV1[];
	readonly observations: readonly DirectoryMarkerObservationV1[];
}

export type RootRecoveryResultV1 =
	| {
			readonly status: "available";
			readonly projectId: ProjectId;
			readonly rootId: RootId;
			readonly directoryId: DirectoryId;
			readonly bindingId: BindingId;
	  }
	| {
			readonly status: "missing";
			readonly projectId: ProjectId;
			readonly rootId: RootId;
			readonly directoryId: DirectoryId;
	  }
	| {
			readonly status: "conflict";
			readonly projectId: ProjectId;
			readonly rootId: RootId;
			readonly directoryId: DirectoryId;
			readonly candidates: readonly DirectoryCandidateRef[];
	  }
	| {
			readonly status: "relink-required";
			readonly projectId: ProjectId;
			readonly rootId: RootId;
			readonly expectedRootLabel: string;
			readonly recoveryMode: "marker" | "device-binding-only";
	  }
	| {
			readonly status: "cancelled" | "timed-out";
			readonly projectId: ProjectId;
			readonly rootId: RootId;
			readonly previousStatus: DirectoryDeviceBindingV1["status"];
	  };

export type RootMutationKindV1 =
	| "create"
	| "register"
	| "add"
	| "relabel"
	| "set-primary"
	| "remove"
	| "relink"
	| "repair"
	| "assign-new-identity";

export type RootOperationJournalStageV1 = "prepared" | "committing" | "compensating" | "committed" | "failed";

export interface RootOperationArtifactV1 {
	readonly resource:
		| "project-record"
		| "directory"
		| "directory-marker"
		| "device-binding"
		| "marker-index"
		| "recovery-plan";
	readonly identity: string;
	readonly beforeSha256?: string;
	readonly intendedSha256?: string;
}

/** Redacted durable state for complete-or-compensate root mutations. */
export interface RootOperationJournalV1 {
	readonly schemaVersion: 1;
	readonly operationId: RootOperationId;
	readonly commandId: ProjectCommandId;
	readonly commandSha256: string;
	readonly operation: RootMutationKindV1;
	readonly stage: RootOperationJournalStageV1;
	readonly vaultId: VaultId;
	readonly projectId: ProjectId;
	readonly rootIds: readonly RootId[];
	readonly directoryIds: readonly DirectoryId[];
	readonly expectedProjectRevision: number;
	readonly artifacts: readonly RootOperationArtifactV1[];
	readonly preparedAt: string;
	readonly updatedAt: string;
}

export type SessionWorkspaceBindingV1 =
	| {
			readonly schemaVersion: 1;
			readonly revision: number;
			readonly sessionId: SessionId;
			readonly kind: "vault";
			readonly vaultId: VaultId;
	  }
	| {
			readonly schemaVersion: 1;
			readonly revision: number;
			readonly sessionId: SessionId;
			readonly kind: "project";
			readonly vaultId: VaultId;
			readonly projectId: ProjectId;
			/** Omitted for a folderless Project; filesystem work remains unavailable until a root is selected. */
			readonly activeRootId?: RootId;
			readonly sessionAttachedRootIds: readonly RootId[];
	  };

/** Portable, vault-owned authority for every session's current workspace. */
export interface SessionWorkspaceBindingDocumentV1 {
	readonly schemaVersion: 1;
	readonly vaultId: VaultId;
	readonly revision: number;
	readonly updatedAt: string;
	readonly bindings: readonly SessionWorkspaceBindingV1[];
}

export interface DirectoryMarkerV1 {
	readonly schemaVersion: 1;
	readonly directoryId: DirectoryId;
	readonly createdAt: string;
	readonly createdByVaultId?: VaultId;
	/** Present only when a root-operation saga created this marker. */
	readonly createdByOperationId?: RootOperationId;
}
