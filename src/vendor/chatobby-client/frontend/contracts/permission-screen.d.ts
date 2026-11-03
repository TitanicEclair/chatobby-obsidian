import { type FrontendSandboxSetupViewModel } from "../../frontend-sandbox-contracts.js";
import { type FrontendPermissionRequestBehavior, type FrontendPermissionWorkspaceTarget, type FrontendWorkspacePermissionPolicy } from "./workspace-permissions.js";
export declare const OBSIDIAN_VAULT_ACCESS_WARNING = "Uses Obsidian\u2019s app authority beyond ordinary filesystem scope.";
export type FrontendObsidianVaultAccessViewModel = {
    readonly status: "available";
    readonly revision: number;
    readonly sessionId: string;
    readonly bindingRevision: number;
    readonly enabled: boolean;
    readonly source: "default" | "user";
    readonly warning: typeof OBSIDIAN_VAULT_ACCESS_WARNING;
} | {
    readonly status: "unavailable";
    readonly enabled: false;
    readonly warning: typeof OBSIDIAN_VAULT_ACCESS_WARNING;
    readonly reason: string;
};
export interface FrontendPermissionScreenViewModel {
    readonly screenId: "permissions";
    /** Absent on older runtimes; never infer Full-only operation from the plugin version. */
    readonly executionMode?: "full-access" | "permissions";
    readonly revision: number;
    /** Durable policy owner; delegated sessions display this inherited authority read-only. */
    readonly accessPolicySessionId: string;
    readonly accessPolicy: {
        readonly schemaVersion: 1;
        readonly revision: number;
        readonly accessMode: "read-only" | "workspace" | "full";
        readonly agentNetworkAccess: boolean;
        readonly requestBehavior?: FrontendPermissionRequestBehavior;
    };
    /** Current authenticated workspace; never inferred from a local folder. */
    readonly activeWorkspaceTarget?: FrontendPermissionWorkspaceTarget;
    readonly workspacePolicies?: readonly FrontendWorkspacePermissionPolicy[];
    readonly scope: {
        readonly bindingRevision: number;
        readonly kind: "project" | "vault";
        readonly selectedRootCount: number;
        readonly filesystemBound: boolean;
    };
    readonly nativeSupport: {
        readonly status: "ready" | "setup-required" | "unverified" | "unsupported";
        readonly backendId?: "windows-appcontainer" | "linux-bubblewrap" | "macos-seatbelt" | "landstrip";
        readonly reason?: string;
        readonly userAction?: string;
    };
    /** Absent only for additive compatibility with older runtimes; never infer a grant. */
    readonly obsidianVaultAccess?: FrontendObsidianVaultAccessViewModel;
    /** Explicit operator choices across this Vault; independent of session policy. */
    readonly workspaceVaultAccess?: readonly {
        readonly projectId: string | null;
        readonly projectRevision?: number;
        readonly label: string;
        readonly revision: number;
        readonly enabled: boolean;
        readonly source: "default" | "user";
    }[];
    /** Explicit setup/recovery, never a substitute for nativeSupport proof. Omitted without negotiation. */
    readonly nativeSetup?: FrontendSandboxSetupViewModel;
    readonly effective: {
        readonly fileRead: boolean;
        readonly fileWrite: boolean;
        readonly localProcess: "native-contained" | "unavailable" | "unsandboxed" | "restricted-commands";
        readonly obsidian: "typed-read" | "typed-workspace" | "unavailable" | "unsandboxed" | "app-authority";
        readonly agentNetworkAccess: boolean;
        readonly warning?: string;
    };
    readonly migrationNotice?: string;
    readonly loading: boolean;
    readonly error?: string;
    readonly statusMessage?: string;
}
/** Validate the complete permission projection before exposing controls. */
export declare function validatePermissionScreen(input: Record<string, unknown>): void;
