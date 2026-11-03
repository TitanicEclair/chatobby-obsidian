import { describe, expect, it, vi } from "vitest";
import { PermissionsView } from "../../src/features/permissions/ui/permissions-view";
import type { FrontendPermissionScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts";
import { mount } from "./helpers/mount";

/** Historical native state may still arrive from old runtimes; it cannot expose setup actions.
 * Persistence/recovery records are deliberately not deleted by this UI change.
 * @see docs/api/permissions.md
 */
describe("native sandbox UI retirement", () => {
  it.each(["permissions", "full-access", undefined] as const)("never renders native setup for %s projections", (executionMode) => {
    const model: FrontendPermissionScreenViewModel = {
      screenId: "permissions", revision: 1, accessPolicySessionId: "session-a", loading: false, executionMode,
      accessPolicy: { schemaVersion: 1, revision: 2, accessMode: "workspace", agentNetworkAccess: false },
      scope: { bindingRevision: 3, kind: "vault", selectedRootCount: 1, filesystemBound: true },
      nativeSupport: { status: "setup-required", backendId: "windows-appcontainer", userAction: "Review native setup" },
      effective: { fileRead: true, fileWrite: false, localProcess: "unavailable", obsidian: "unavailable", agentNetworkAccess: false },
      nativeSetup: { sessionId: "session-a", current: { status: "available", bindingRevision: 3, policyRevision: 2,
        accessMode: "workspace", networkAccess: false, roots: [{ stableId: "vault:a", path: "C:/Synthetic/current" }],
        grant: { revision: 4, targetFingerprint: "a".repeat(64), status: "setup-required" } },
        owned: { status: "available", revision: 4, grants: [] },
        verification: { status: "available", revision: 2, installationFingerprint: "b".repeat(64), busy: false, ready: false, recoveryRequired: true } },
      activeWorkspaceTarget: { kind: "vault", vaultId: "vault-a" },
      workspacePolicies: [{ target: { kind: "vault", vaultId: "vault-a" }, label: "Vault", revision: 2, accessMode: "workspace", requestBehavior: "ask" }],
      workspaceVaultAccess: [{ projectId: null, label: "Vault", revision: 4, enabled: false, source: "user" }],
    };
    const onIntent = vi.fn();
    const root = mount(new PermissionsView({ getModel: () => model, getActiveSessionId: () => "session-a",
      supportsObsidianVaultAccess: () => true, subscribe: () => () => {}, onIntent, onRefresh: async () => {}, onBack: () => {} }));
    expect(root.textContent).not.toMatch(/Review native setup|Windows AppContainer|Workspace protection|Review verification/);
    expect(Array.from(root.querySelectorAll("button"), (button) => button.textContent).join(" ")).not.toMatch(/setup|set up|verif|recover|revoke/i);
    expect(root.querySelector(".chatobby-permissions__consent")).toBeNull();
    expect(onIntent).not.toHaveBeenCalled();
    if (executionMode === "permissions") {
      expect(root.textContent).toContain("Saved choices apply to all chats in this workspace");
      expect(root.querySelector<HTMLInputElement>("input[aria-label='Chatobby and Obsidian tools for Vault']")?.checked).toBe(false);
    }
  });
});
