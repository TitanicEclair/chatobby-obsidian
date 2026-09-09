import { CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION, CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "./product.generated.js";
export { CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION, CHATOBBY_RUNTIME_PROTOCOL_VERSION };
export declare const CHATOBBY_RUNTIME_VERSION: "0.5.1";
export declare const CHATOBBY_RUNTIME_HELLO_TIMEOUT_MS = 5000;
export declare const CHATOBBY_RUNTIME_STARTUP_ADMISSION_TIMEOUT_MS: number;
export declare const CHATOBBY_RUNTIME_REATTACH_GRACE_MS = 15000;
/** Allows the five-minute engine deadline to settle and report before the transport gives up. */
export declare const CHATOBBY_COMPACTION_REQUEST_TIMEOUT_MS: number;
/** A prompt may wait behind a bounded manual checkpoint before it is accepted. */
export declare const CHATOBBY_PROMPT_REQUEST_TIMEOUT_MS: number;
export declare const RUNTIME_CLOSE_CODES: {
    readonly authenticationFailed: 4401;
    readonly identityMismatch: 4403;
    readonly protocolMismatch: 4406;
    readonly helloTimeout: 4408;
};
export interface RuntimeIdentity {
    instanceId: string;
    vaultId: string;
    pid: number;
    startedAt: number;
    runtimeVersion: string;
    protocolVersion: number;
    runtimePackageFingerprint: string | null;
    /** Exact private-source development build; never substitutes for a verified release package fingerprint. */
    developmentBuildFingerprint: string | null;
}
export interface RuntimeReadyDescriptor extends RuntimeIdentity {
    schemaVersion: typeof CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION;
    host: "127.0.0.1";
    port: number;
    controlTokenFingerprint: string;
    sessionTokenFingerprint: string;
}
export interface RuntimeStatusResponse {
    ready: boolean;
    identity: RuntimeIdentity;
    maintenance: RuntimeMaintenanceSnapshot;
}
export type RuntimeMaintenancePurpose = "runtime-update" | "development-reconcile";
export type RuntimeMaintenanceActiveWorkKind = "maintenance" | "response" | "compaction" | "queued-prompt" | "subagent" | "event";
export interface RuntimeMaintenanceSnapshot {
    acceptingWork: boolean;
    activeWorkKinds: RuntimeMaintenanceActiveWorkKind[];
}
export interface RuntimeMaintenanceCurrentIdentity {
    instanceId: string;
    runtimePackageFingerprint: string | null;
    developmentBuildFingerprint: string | null;
}
export interface RuntimeMaintenanceTargetIdentity {
    runtimeVersion: string;
    runtimePackageFingerprint: string | null;
    developmentBuildFingerprint: string | null;
}
export interface RuntimeMaintenanceAdmitRequest {
    schemaVersion: 1;
    operationId: string;
    purpose: RuntimeMaintenancePurpose;
    current: RuntimeMaintenanceCurrentIdentity;
    target: RuntimeMaintenanceTargetIdentity;
}
export type RuntimeMaintenanceAdmission = {
    schemaVersion: 1;
    status: "admitted";
    operationId: string;
    leaseId: string;
    expiresAt: number;
} | {
    schemaVersion: 1;
    status: "deferred";
    operationId: string;
    retryAfterMs: number;
    activeWorkKinds: RuntimeMaintenanceActiveWorkKind[];
};
export interface RuntimeMaintenanceLeaseRequest {
    schemaVersion: 1;
    operationId: string;
    leaseId: string;
}
export interface RuntimeMaintenanceLeaseResult {
    schemaVersion: 1;
    status: "committed" | "cancelled";
    operationId: string;
    leaseId: string;
}
export interface RuntimeClientHello {
    type: "hello";
    protocolVersion: number;
    pluginVersion: string;
    attachmentId: string;
    instanceId: string;
    vaultId: string;
    sessionToken: string;
}
export interface RuntimeServerHello {
    type: "hello_ack";
    protocolVersion: number;
    runtimeVersion: string;
    instanceId: string;
    vaultId: string;
}
/** Authenticated runtime that is completing a host-controlled startup gate. */
export interface RuntimeServerPending {
    type: "hello_pending";
    protocolVersion: number;
    runtimeVersion: string;
    instanceId: string;
    vaultId: string;
    phase: "migration";
}
/** Request that the connector atomically activate this verified runtime package. */
export interface RuntimeServerActivationRequired {
    type: "runtime_activation_required";
    protocolVersion: number;
    runtimeVersion: string;
    instanceId: string;
    vaultId: string;
    runtimePackageFingerprint: string;
    activationId: string;
    operation: "activate" | "rollback";
}
/** Connector acknowledgement for one exact runtime-package activation. */
export interface RuntimeClientActivationResult {
    type: "runtime_activation_result";
    protocolVersion: number;
    instanceId: string;
    vaultId: string;
    activationId: string;
    operation: "activate" | "rollback";
    status: "applied" | "failed";
}
export declare function parseRuntimeClientHello(value: unknown): RuntimeClientHello | null;
export declare function parseRuntimeServerHello(value: unknown): RuntimeServerHello | null;
export declare function parseRuntimeServerPending(value: unknown): RuntimeServerPending | null;
export declare function parseRuntimeServerActivationRequired(value: unknown): RuntimeServerActivationRequired | null;
export declare function parseRuntimeClientActivationResult(value: unknown): RuntimeClientActivationResult | null;
export declare function parseRuntimeReadyDescriptor(value: unknown): RuntimeReadyDescriptor | null;
export declare function parseRuntimeMaintenanceAdmitRequest(value: unknown): RuntimeMaintenanceAdmitRequest | null;
export declare function parseRuntimeMaintenanceLeaseRequest(value: unknown): RuntimeMaintenanceLeaseRequest | null;
