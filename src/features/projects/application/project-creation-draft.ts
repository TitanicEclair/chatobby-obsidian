export type ProjectDraftMarkerPolicy = "required" | "disabled";

export interface ProjectCreationDraftRoot {
	readonly directoryCandidateRef: string;
	readonly label: string;
	/** Ephemeral local presentation only. Never persist, log, or export this value. */
	readonly localPath: string;
}

export interface ProjectCreationDraftSnapshot {
	readonly revision: number;
	readonly intentId: string;
	readonly name: string;
	readonly description: string;
	readonly markerPolicy: ProjectDraftMarkerPolicy;
	readonly roots: readonly ProjectCreationDraftRoot[];
	readonly primaryDirectoryCandidateRef?: string;
}

/**
 * Leaf-local, ephemeral Project creation state. It deliberately lives outside
 * the rendered DOM so a runtime screen patch cannot discard folder choices.
 */
export class ProjectCreationDraftStore {
	private state: ProjectCreationDraftSnapshot = freshDraft();

	snapshot(): ProjectCreationDraftSnapshot {
		return this.state;
	}

	reset(): ProjectCreationDraftSnapshot {
		this.state = freshDraft();
		return this.state;
	}

	updateDetails(patch: { readonly name?: string; readonly description?: string }): ProjectCreationDraftSnapshot {
		this.state = freezeDraft({
			...this.state,
			revision: this.state.revision + 1,
			...(patch.name === undefined ? {} : { name: patch.name }),
			...(patch.description === undefined ? {} : { description: patch.description }),
		});
		return this.state;
	}

	setMarkerPolicy(markerPolicy: ProjectDraftMarkerPolicy): ProjectCreationDraftSnapshot {
		if (this.state.markerPolicy === markerPolicy) return this.state;
		this.state = freezeDraft({ ...this.state, revision: this.state.revision + 1, markerPolicy });
		return this.state;
	}

	addRegisteredRoots(roots: readonly ProjectCreationDraftRoot[]): ProjectCreationDraftSnapshot {
		const existingPaths = new Set(this.state.roots.map((root) => normalizeLocalPath(root.localPath)));
		const additions = roots.filter((root) => {
			const path = normalizeLocalPath(root.localPath);
			if (existingPaths.has(path)) return false;
			existingPaths.add(path);
			return true;
		});
		if (additions.length === 0) return this.state;
		const merged = Object.freeze([...this.state.roots, ...additions.map((root) => Object.freeze({ ...root }))]);
		this.state = freezeDraft({
			...this.state,
			revision: this.state.revision + 1,
			roots: merged,
			primaryDirectoryCandidateRef:
				this.state.primaryDirectoryCandidateRef ?? merged[0]?.directoryCandidateRef,
		});
		return this.state;
	}

	replaceRegisteredRoots(input: {
		readonly intentId: string;
		readonly roots: readonly ProjectCreationDraftRoot[];
		readonly primaryLocalPath?: string;
	}): ProjectCreationDraftSnapshot {
		const roots = Object.freeze(input.roots.map((root) => Object.freeze({ ...root })));
		const primaryDirectoryCandidateRef = input.primaryLocalPath === undefined
			? roots[0]?.directoryCandidateRef
			: roots.find((root) => normalizeLocalPath(root.localPath) === normalizeLocalPath(input.primaryLocalPath ?? ""))
				?.directoryCandidateRef ?? roots[0]?.directoryCandidateRef;
		this.state = freezeDraft({
			...this.state,
			intentId: input.intentId,
			revision: this.state.revision + 1,
			roots,
			primaryDirectoryCandidateRef,
		});
		return this.state;
	}

	removeRoot(directoryCandidateRef: string): ProjectCreationDraftSnapshot {
		const roots = this.state.roots.filter((root) => root.directoryCandidateRef !== directoryCandidateRef);
		if (roots.length === this.state.roots.length) return this.state;
		this.state = freezeDraft({
			...this.state,
			revision: this.state.revision + 1,
			roots,
			primaryDirectoryCandidateRef:
				this.state.primaryDirectoryCandidateRef === directoryCandidateRef
					? roots[0]?.directoryCandidateRef
					: this.state.primaryDirectoryCandidateRef,
		});
		return this.state;
	}

	makePrimary(directoryCandidateRef: string): ProjectCreationDraftSnapshot {
		if (!this.state.roots.some((root) => root.directoryCandidateRef === directoryCandidateRef)) {
			throw new Error("The selected primary folder is no longer in this Project draft.");
		}
		if (this.state.primaryDirectoryCandidateRef === directoryCandidateRef) return this.state;
		this.state = freezeDraft({
			...this.state,
			revision: this.state.revision + 1,
			primaryDirectoryCandidateRef: directoryCandidateRef,
		});
		return this.state;
	}
}

function freshDraft(): ProjectCreationDraftSnapshot {
	return freezeDraft({
		revision: 1,
		intentId: crypto.randomUUID(),
		name: "",
		description: "",
		markerPolicy: "required",
		roots: Object.freeze([]),
	});
}

function freezeDraft(draft: ProjectCreationDraftSnapshot): ProjectCreationDraftSnapshot {
	return Object.freeze({ ...draft, roots: Object.freeze([...draft.roots]) });
}

function normalizeLocalPath(path: string): string {
	return path.trim().replace(/[\\/]+$/u, "").toLocaleLowerCase();
}
