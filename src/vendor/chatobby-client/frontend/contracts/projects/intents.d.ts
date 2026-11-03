import { type FrontendProjectFolderSelection } from "./fields.js";
import type { FrontendProjectAvailabilityFilter, FrontendProjectLifecycleFilter, FrontendProjectSessionSearchMode, FrontendProjectSessionSort, FrontendProjectSort } from "./models.js";
/** Project intent bodies; the public facade alone validates and attaches the envelope. */
export type FrontendProjectIntentBody = {
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
} | {
    readonly type: "projects.create";
    readonly payload: {
        readonly name: string;
        readonly description?: string;
        readonly rootMode?: "create-vault-folder" | "use-existing-folders";
        readonly roots?: readonly FrontendProjectFolderSelection[];
        readonly primaryDirectoryCandidateRef?: string;
        /** Legacy one-root compatibility; new connectors use rootMode and roots. */
        readonly vaultRelativePath?: string;
        readonly directoryCandidateRef?: string;
        readonly directoryReuse: "canonical" | "none";
        readonly markerPolicy: "required" | "optional" | "disabled";
        readonly useForCurrentSession?: boolean;
    };
} | {
    readonly type: "projects.replace-details";
    readonly payload: {
        readonly projectId: string;
        readonly expectedProjectRevision: number;
        readonly name: string;
        readonly description?: string;
    };
} | {
    readonly type: "projects.archive" | "projects.restore";
    readonly payload: {
        readonly projectId: string;
        readonly expectedProjectRevision: number;
    };
} | {
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
} | {
    readonly type: "projects.roots-add-batch";
    readonly payload: {
        readonly projectId: string;
        readonly expectedProjectRevision: number;
        readonly roots: readonly FrontendProjectFolderSelection[];
    };
} | {
    readonly type: "projects.root-relabel";
    readonly payload: {
        readonly projectId: string;
        readonly expectedProjectRevision: number;
        readonly rootId: string;
        readonly label: string;
    };
} | {
    readonly type: "projects.root-set-primary" | "projects.root-remove";
    readonly payload: {
        readonly projectId: string;
        readonly expectedProjectRevision: number;
        readonly rootId: string;
        readonly replacementRootId?: string;
    };
} | {
    readonly type: "projects.root-recover";
    readonly payload: {
        readonly projectId: string;
        readonly rootId: string;
    };
} | {
    readonly type: "projects.root-relink";
    readonly payload: {
        readonly projectId: string;
        readonly expectedProjectRevision: number;
        readonly rootId: string;
        readonly vaultRelativePath?: string;
        readonly directoryCandidateRef?: string;
    };
} | {
    readonly type: "projects.session-move";
    readonly payload: {
        readonly sessionId: string;
        readonly expectedWorkspaceBindingRevision: number;
        readonly target: {
            readonly kind: "vault";
        } | {
            readonly kind: "project";
            readonly projectId: string;
        };
    };
};
export declare function parseFrontendProjectIntentBody(input: Record<string, unknown>, payload: Record<string, unknown>): FrontendProjectIntentBody | undefined;
