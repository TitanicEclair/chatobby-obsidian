/** Human review of one exact operation; the identifier is opaque and grants no authority by itself. */
export interface PermissionRequestReview {
    readonly requestId: string;
    readonly toolName: string;
    readonly reason: string;
    readonly operationSummary: string;
}
/** Validate review metadata at process/UI boundaries without accepting extra authority-bearing fields. */
export declare function parsePermissionRequestReview(value: unknown): PermissionRequestReview;
