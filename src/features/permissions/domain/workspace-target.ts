import type { FrontendPermissionWorkspaceTarget } from "../../../vendor/chatobby-client/frontend-contracts.js";

/** Stable UI identity preserves selection without interpreting paths or granting authority. */
export function workspaceTargetKey(target: FrontendPermissionWorkspaceTarget): string {
  return JSON.stringify(target.kind === "project" ? [target.kind, target.vaultId, target.projectId] : [target.kind, target.vaultId]);
}
