/** Browser-safe display/consent projection. The native journal and permission domains remain authoritative. */
export type FrontendSandboxGrantStatus = "setup-required" | "provisioning" | "configured" | "revoking" | "recovery-required" | "revoked";
export interface FrontendSandboxRoot {
    readonly stableId: string;
    readonly path: string;
}
export interface FrontendSandboxSetupPayload {
    readonly expectedSessionId: string;
    readonly expectedBindingRevision: number;
    readonly expectedPolicyRevision: number;
    readonly expectedGrantRevision: number;
    readonly targetFingerprint: string;
}
export interface FrontendSandboxRevokePayload {
    readonly expectedSessionId: string;
    readonly expectedGrantRevision: number;
    readonly grantId: string;
    readonly targetFingerprint: string;
}
export interface FrontendSandboxVerifyPayload {
    readonly expectedSessionId: string;
    readonly expectedVerificationRevision: number;
    readonly installationFingerprint: string;
    readonly action: "verify" | "recover";
}
export interface FrontendSandboxSetupViewModel {
    readonly sessionId: string;
    readonly verification?: {
        readonly status: "unavailable";
        readonly backendId?: "landstrip";
        readonly reason: string;
    } | {
        readonly status: "available";
        readonly backendId?: "windows-appcontainer" | "linux-bubblewrap" | "macos-seatbelt" | "landstrip";
        readonly revision: number;
        readonly installationFingerprint: string;
        readonly busy: boolean;
        readonly recoveryRequired: boolean;
        readonly historicalCleanupUnproved?: true;
        readonly ready: boolean;
        readonly reason?: string;
    };
    readonly current: {
        readonly status: "unavailable";
        readonly reason: string;
        readonly roots: readonly FrontendSandboxRoot[];
    } | {
        readonly status: "not-required";
        readonly roots: readonly FrontendSandboxRoot[];
    } | {
        readonly status: "available";
        readonly bindingRevision: number;
        readonly policyRevision: number;
        readonly accessMode: "read-only" | "workspace";
        readonly networkAccess: boolean;
        readonly roots: readonly FrontendSandboxRoot[];
        readonly grant: {
            readonly revision: number;
            readonly targetFingerprint: string;
            readonly status: FrontendSandboxGrantStatus;
            readonly reason?: string;
        };
    };
    readonly owned: {
        readonly status: "unavailable";
        readonly reason: string;
    } | {
        readonly status: "available";
        readonly revision: number;
        readonly grants: readonly {
            readonly grantId: string;
            readonly targetFingerprint: string;
            readonly status: Exclude<FrontendSandboxGrantStatus, "setup-required">;
            readonly accessMode: "read-only" | "workspace";
            readonly networkAccess: boolean;
            readonly bindingRevision: number;
            readonly policyRevision: number;
            readonly roots: readonly FrontendSandboxRoot[];
        }[];
    };
}
export declare function parseFrontendSandboxSetupPayload(input: unknown): FrontendSandboxSetupPayload;
export declare function parseFrontendSandboxRevokePayload(input: unknown): FrontendSandboxRevokePayload;
export declare function parseFrontendSandboxVerifyPayload(input: unknown): FrontendSandboxVerifyPayload;
export declare function validateFrontendSandboxSetupView(input: unknown): void;
