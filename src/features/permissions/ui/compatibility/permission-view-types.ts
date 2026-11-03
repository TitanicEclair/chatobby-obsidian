import type { FrontendPermissionScreenViewModel } from "../../../../vendor/chatobby-client/frontend-contracts.js";
/** Narrow rendering adapter for retained older-runtime compatibility. */
export interface LegacyPermissionHost {
 getActiveSessionId(): string | null;
 supportsObsidianVaultAccess(): boolean;
 isSaving(): boolean;
 setPolicy(model: FrontendPermissionScreenViewModel, mode: FrontendPermissionScreenViewModel["accessPolicy"]["accessMode"], network: boolean): Promise<void>;
 setObsidianVaultAccess(model: FrontendPermissionScreenViewModel, enabled: boolean): Promise<void>;
}
