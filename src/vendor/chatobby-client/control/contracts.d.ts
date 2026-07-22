export declare const CHATOBBY_RUNTIME_DESCRIPTOR_SCHEMA_VERSION: 2;
export declare const CHATOBBY_RUNTIME_PROTOCOL_VERSION: 3;
export declare const CHATOBBY_RUNTIME_VERSION = "0.1.15";
export declare const CHATOBBY_RUNTIME_HELLO_TIMEOUT_MS = 5000;
export declare const CHATOBBY_RUNTIME_REATTACH_GRACE_MS = 15000;
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
export declare function parseRuntimeClientHello(value: unknown): RuntimeClientHello | null;
export declare function parseRuntimeServerHello(value: unknown): RuntimeServerHello | null;
export declare function parseRuntimeReadyDescriptor(value: unknown): RuntimeReadyDescriptor | null;
