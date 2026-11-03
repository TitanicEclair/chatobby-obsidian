// Generated from packages/chatobby/src/frontend/contracts/projects/intents.ts. Do not edit.
import { optionalString, requireBoolean, requireRecord, requireSafeInteger, requireString } from "../validation.ts";
import {
	type FrontendProjectFolderSelection,
	requireProjectAvailabilityFilter,
	requireProjectDirectoryReuse,
	requireProjectFolderSelections,
	requireProjectLifecycleFilter,
	requireProjectMarkerPolicy,
	requireProjectSessionSearchMode,
	requireProjectSessionSort,
	requireProjectSort,
} from "./fields.ts";
import type {
	FrontendProjectAvailabilityFilter,
	FrontendProjectLifecycleFilter,
	FrontendProjectSessionSearchMode,
	FrontendProjectSessionSort,
	FrontendProjectSort,
} from "./models.ts";

/** Project intent bodies; the public facade alone validates and attaches the envelope. */
export type FrontendProjectIntentBody =
	| {
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
	  }
	| {
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
	  }
	| {
			readonly type: "projects.replace-details";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly name: string;
				readonly description?: string;
			};
	  }
	| {
			readonly type: "projects.archive" | "projects.restore";
			readonly payload: { readonly projectId: string; readonly expectedProjectRevision: number };
	  }
	| {
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
	  }
	| {
			readonly type: "projects.roots-add-batch";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly roots: readonly FrontendProjectFolderSelection[];
			};
	  }
	| {
			readonly type: "projects.root-relabel";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly rootId: string;
				readonly label: string;
			};
	  }
	| {
			readonly type: "projects.root-set-primary" | "projects.root-remove";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly rootId: string;
				readonly replacementRootId?: string;
			};
	  }
	| {
			readonly type: "projects.root-recover";
			readonly payload: { readonly projectId: string; readonly rootId: string };
	  }
	| {
			readonly type: "projects.root-relink";
			readonly payload: {
				readonly projectId: string;
				readonly expectedProjectRevision: number;
				readonly rootId: string;
				readonly vaultRelativePath?: string;
				readonly directoryCandidateRef?: string;
			};
	  }
	| {
			readonly type: "projects.session-move";
			readonly payload: {
				readonly sessionId: string;
				readonly expectedWorkspaceBindingRevision: number;
				readonly target: { readonly kind: "vault" } | { readonly kind: "project"; readonly projectId: string };
			};
	  };

export function parseFrontendProjectIntentBody(
	input: Record<string, unknown>,
	payload: Record<string, unknown>,
): FrontendProjectIntentBody | undefined {
	if (input.type === "projects.set-view") {
		return {
			type: input.type,
			payload: {
				query: typeof payload.query === "string" ? payload.query : "",
				lifecycleFilter: requireProjectLifecycleFilter(payload.lifecycleFilter),
				availabilityFilter: requireProjectAvailabilityFilter(payload.availabilityFilter),
				sort: requireProjectSort(payload.sort),
				sessionQuery: typeof payload.sessionQuery === "string" ? payload.sessionQuery : "",
				sessionSearchMode: requireProjectSessionSearchMode(payload.sessionSearchMode),
				sessionSort: requireProjectSessionSort(payload.sessionSort),
				sessionSearchPage: requireSafeInteger(payload.sessionSearchPage ?? 0, "payload.sessionSearchPage"),
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
	return undefined;
}
