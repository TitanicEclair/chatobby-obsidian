export declare const PROJECT_DIRECTORY_PROTOCOL_SCHEMA_VERSION: 1;
export type ProjectDirectoryObservationStatus = "applied" | "no-op" | "recovery-required" | "conflict" | "rejected";
export type ProjectDirectoryRescanReason = "startup" | "queue-overflow" | "disconnect-timeout" | "retry-exhausted";
export interface ProjectDirectoryObserved {
    type: "project_directory_observed";
    schemaVersion: 1;
    requestId: string;
    observationId: string;
    observedAt: string;
    changeKind: "rename-or-move";
    entryKind: "folder";
    oldVaultRelativePath: string;
    newVaultRelativePath: string;
}
export interface ProjectDirectoryObservationResult {
    type: "project_directory_observation_result";
    schemaVersion: 1;
    requestId: string;
    observationId: string;
    status: ProjectDirectoryObservationStatus;
    resultingSequence?: number;
    errorCode?: string;
    retryable: boolean;
}
export interface ProjectDirectoryRescanRequested {
    type: "project_directory_rescan_requested";
    schemaVersion: 1;
    requestId: string;
    rescanId: string;
    requestedAt: string;
    reason: ProjectDirectoryRescanReason;
}
export interface ProjectDirectoryRescanResult {
    type: "project_directory_rescan_result";
    schemaVersion: 1;
    requestId: string;
    rescanId: string;
    status: ProjectDirectoryObservationStatus;
    resultingSequence?: number;
    errorCode?: string;
    retryable: boolean;
}
export declare function parseProjectDirectoryObserved(input: unknown): ProjectDirectoryObserved;
export declare function parseProjectDirectoryObservationResult(input: unknown): ProjectDirectoryObservationResult;
export declare function parseProjectDirectoryRescanRequested(input: unknown): ProjectDirectoryRescanRequested;
export declare function parseProjectDirectoryRescanResult(input: unknown): ProjectDirectoryRescanResult;
