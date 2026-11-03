import type { FrontendProjectAvailabilityFilter, FrontendProjectLifecycleFilter, FrontendProjectSessionSearchMode, FrontendProjectSessionSort, FrontendProjectSort } from "./models.js";
export interface FrontendProjectFolderSelection {
    readonly directoryCandidateRef: string;
    readonly label: string;
    readonly markerPolicy: "required" | "optional" | "disabled";
    readonly directoryReuse: "canonical" | "none";
}
export declare function requireProjectLifecycleFilter(value: unknown): FrontendProjectLifecycleFilter;
export declare function requireProjectDirectoryReuse(value: unknown): "canonical" | "none";
export declare function requireProjectMarkerPolicy(value: unknown): "required" | "optional" | "disabled";
export declare function requireProjectFolderSelections(value: unknown, field: string): readonly FrontendProjectFolderSelection[];
export declare function requireProjectAvailabilityFilter(value: unknown): FrontendProjectAvailabilityFilter;
export declare function requireProjectSort(value: unknown): FrontendProjectSort;
export declare function requireProjectSessionSort(value: unknown): FrontendProjectSessionSort;
export declare function requireProjectSessionSearchMode(value: unknown): FrontendProjectSessionSearchMode;
