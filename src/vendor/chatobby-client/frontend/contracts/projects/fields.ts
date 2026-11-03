// Generated from packages/chatobby/src/frontend/contracts/projects/fields.ts. Do not edit.
import { requireRecord, requireString } from "../validation.ts";
import type {
	FrontendProjectAvailabilityFilter,
	FrontendProjectLifecycleFilter,
	FrontendProjectSessionSearchMode,
	FrontendProjectSessionSort,
	FrontendProjectSort,
} from "./models.ts";

export interface FrontendProjectFolderSelection {
	readonly directoryCandidateRef: string;
	readonly label: string;
	readonly markerPolicy: "required" | "optional" | "disabled";
	readonly directoryReuse: "canonical" | "none";
}

export function requireProjectLifecycleFilter(value: unknown): FrontendProjectLifecycleFilter {
	if (value === "active" || value === "archived" || value === "all") return value;
	throw new Error("payload.lifecycleFilter is invalid");
}

export function requireProjectDirectoryReuse(value: unknown): "canonical" | "none" {
	if (value === "canonical" || value === "none") return value;
	throw new Error("payload.directoryReuse is invalid");
}

export function requireProjectMarkerPolicy(value: unknown): "required" | "optional" | "disabled" {
	if (value === "required" || value === "optional" || value === "disabled") return value;
	throw new Error("payload.markerPolicy is invalid");
}

export function requireProjectFolderSelections(
	value: unknown,
	field: string,
): readonly FrontendProjectFolderSelection[] {
	if (!Array.isArray(value) || value.length > 64) throw new Error(`${field} must contain no more than 64 folders`);
	const seen = new Set<string>();
	return Object.freeze(
		value.map((entry, index) => {
			const record = requireRecord(entry, `${field}[${index}]`);
			const directoryCandidateRef = requireString(
				record.directoryCandidateRef,
				`${field}[${index}].directoryCandidateRef`,
			);
			if (seen.has(directoryCandidateRef)) throw new Error(`${field} contains a duplicate folder selection`);
			seen.add(directoryCandidateRef);
			return Object.freeze({
				directoryCandidateRef,
				label: requireString(record.label, `${field}[${index}].label`),
				markerPolicy: requireProjectMarkerPolicy(record.markerPolicy),
				directoryReuse: requireProjectDirectoryReuse(record.directoryReuse),
			});
		}),
	);
}

export function requireProjectAvailabilityFilter(value: unknown): FrontendProjectAvailabilityFilter {
	if (
		value === "all" ||
		value === "available" ||
		value === "attention" ||
		value === "missing" ||
		value === "conflict" ||
		value === "relink-required"
	) {
		return value;
	}
	throw new Error("payload.availabilityFilter is invalid");
}

export function requireProjectSort(value: unknown): FrontendProjectSort {
	if (
		value === "activity-desc" ||
		value === "created-desc" ||
		value === "created-asc" ||
		value === "name-asc" ||
		value === "name-desc" ||
		value === "relevance"
	)
		return value;
	throw new Error("payload.sort is invalid");
}

export function requireProjectSessionSort(value: unknown): FrontendProjectSessionSort {
	if (
		value === "updated-desc" ||
		value === "created-desc" ||
		value === "created-asc" ||
		value === "name-asc" ||
		value === "name-desc" ||
		value === "message-count-desc" ||
		value === "relevance"
	)
		return value;
	throw new Error("payload.sessionSort is invalid");
}

export function requireProjectSessionSearchMode(value: unknown): FrontendProjectSessionSearchMode {
	if (value === "titles" || value === "messages") return value;
	throw new Error("payload.sessionSearchMode is invalid");
}
