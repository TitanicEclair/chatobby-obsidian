import { describe, expect, it, vi } from "vitest";
import type { FrontendPermissionScreenViewModel } from "../../src/vendor/chatobby-client/frontend-contracts.js";
import { PermissionsView, type PermissionViewIntent } from "../../src/features/permissions/ui/permissions-view";
import { mount } from "./helpers/mount";

function model(): FrontendPermissionScreenViewModel {
  return {
    screenId: "permissions", executionMode: "permissions", revision: 1, loading: false, accessPolicySessionId: "session-one",
    accessPolicy: { schemaVersion: 1, revision: 3, accessMode: "workspace", agentNetworkAccess: true, requestBehavior: "ask" },
    activeWorkspaceTarget: { kind: "vault", vaultId: "vault-one" },
    workspacePolicies: [
      { target: { kind: "vault", vaultId: "vault-one" }, label: "Vault", revision: 3, accessMode: "workspace", requestBehavior: "ask" },
      { target: { kind: "project", vaultId: "vault-one", projectId: "research" }, label: "Research", revision: 8, accessMode: "read-only", requestBehavior: "reject" },
    ],
    workspaceVaultAccess: [
      { projectId: null, label: "Vault", enabled: true, source: "default", revision: 9 },
      { projectId: "research", projectRevision: 2, label: "Research", enabled: false, source: "user", revision: 9 },
    ],
    scope: { kind: "vault", bindingRevision: 1, selectedRootCount: 1, filesystemBound: true },
    nativeSupport: { status: "unsupported" },
    effective: { fileRead: true, fileWrite: true, localProcess: "restricted-commands", obsidian: "app-authority", agentNetworkAccess: true },
  };
}

function fixture() {
  let current = model();
  let notify: (value: FrontendPermissionScreenViewModel | null) => void = () => {};
  const onIntent = vi.fn(async (_intent: PermissionViewIntent) => {});
  const view = new PermissionsView({ workspacePage: true, getModel: () => current, getActiveSessionId: () => "session-one", supportsObsidianVaultAccess: () => true,
    subscribe: (listener) => { notify = listener; return () => {}; }, onIntent, onRefresh: async () => {}, onBack: () => {} });
  return { root: mount(view), view, onIntent, get model() { return current; }, update(value: FrontendPermissionScreenViewModel) { current = value; notify(value); } };
}

function chooseProject(root: HTMLElement): void {
  const selector = root.querySelector<HTMLSelectElement>("select[aria-label='Workspace permissions']")!;
  selector.selectedIndex = 1;
  selector.dispatchEvent(new Event("change"));
}

describe("workspace permission settings", () => {
  it("shows all three modes with the saved workspace policy and no sandbox or network controls", () => {
    const f = fixture();
    expect(f.root.querySelectorAll("input[type=radio]")).toHaveLength(3);
    expect(f.root.querySelector<HTMLInputElement>("input[aria-label=Workspace]")?.checked).toBe(true);
    expect(f.root.querySelector<HTMLInputElement>("input[aria-label='Chatobby and Obsidian tools for Vault']")?.checked).toBe(true);
    expect(f.root.querySelector("input[aria-label='Allow agent network access']")).toBeNull();
    expect(f.root.textContent).not.toContain("Native setup");
    expect(f.root.textContent).toContain("MCP servers and tools are available in every mode");
    expect(f.onIntent).not.toHaveBeenCalled();
  });

  it("selects an existing Project without mutating its policy or changing the active session", () => {
    const f = fixture(); chooseProject(f.root);
    expect(f.root.querySelector<HTMLInputElement>("input[aria-label='Read-only']")?.checked).toBe(true);
    expect(f.root.querySelector<HTMLSelectElement>("select[aria-label='Permission requests']")?.value).toBe("reject");
    expect(f.root.querySelector<HTMLInputElement>("input[aria-label='Chatobby and Obsidian tools for Research']")?.checked).toBe(false);
    expect(f.onIntent).not.toHaveBeenCalled();
  });

  it("writes only the selected workspace with its own revision and preserves request behavior", async () => {
    const f = fixture(); chooseProject(f.root);
    const radio = f.root.querySelector<HTMLInputElement>("input[aria-label=Workspace]")!;
    radio.checked = true; radio.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledExactlyOnceWith({ type: "permissions.set-workspace-policy", payload: { target: { kind: "project", vaultId: "vault-one", projectId: "research" }, expectedRevision: 8, accessMode: "workspace", requestBehavior: "reject" } }));
  });

  it("saves request behavior independently while preserving the selected mode", async () => {
    const f = fixture(); const select = f.root.querySelector<HTMLSelectElement>("select[aria-label='Permission requests']")!;
    select.value = "reject"; select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledWith({ type: "permissions.set-workspace-policy", payload: { target: { kind: "vault", vaultId: "vault-one" }, expectedRevision: 3, accessMode: "workspace", requestBehavior: "reject" } }));
  });

  it("uses the independent tool-grant revision, retaining an explicit Off", async () => {
    const f = fixture(); chooseProject(f.root);
    const toggle = f.root.querySelector<HTMLInputElement>("input[aria-label='Chatobby and Obsidian tools for Research']")!;
    toggle.checked = true; toggle.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(f.onIntent).toHaveBeenCalledWith({ type: "permissions.set-workspace-vault-access", payload: { projectId: "research", expectedProjectRevision: 2, expectedRevision: 9, enabled: true } }));
  });

  it("rejects a stale detached control and preserves Project selection across projections", () => {
    const f = fixture(); chooseProject(f.root);
    const stale = f.root.querySelector<HTMLInputElement>("input[aria-label=Workspace]")!;
    f.update({ ...f.model, workspacePolicies: f.model.workspacePolicies?.map((row) => ({ ...row, revision: row.revision + 1 })) });
    stale.checked = true; stale.dispatchEvent(new Event("change"));
    expect(f.onIntent).not.toHaveBeenCalled();
    expect(f.root.textContent).toContain("This workspace changed");
    expect(f.root.querySelector<HTMLInputElement>("input[aria-label='Read-only']")?.checked).toBe(true);
  });

  it("disables requests in Full access while retaining the saved restricted-mode choice", () => {
    const f = fixture(); f.update({ ...f.model, workspacePolicies: f.model.workspacePolicies?.map((row) => ({ ...row, accessMode: "full" })) });
    const select = f.root.querySelector<HTMLSelectElement>("select[aria-label='Permission requests']")!;
    expect(select.disabled).toBe(true); expect(select.value).toBe("ask");
  });
});
