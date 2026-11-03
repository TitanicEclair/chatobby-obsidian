// Generated from packages/chatobby/src/frontend/contracts/projects/models.ts. Do not edit.
import type { FrontendChoiceOption } from "../choices.ts";

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
