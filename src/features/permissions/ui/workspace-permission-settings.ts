import { workspaceTargetKey } from "../domain/workspace-target";
import type { FrontendIntent, FrontendPermissionScreenViewModel, FrontendWorkspacePermissionPolicy } from "../../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection } from "../../../ui/shared/page-shell";
import { renderPermissionChoices } from "./workspace-permission-choices";

type SettingsIntent = Pick<Extract<FrontendIntent, { type: "permissions.set-workspace-policy" }>, "type" | "payload">
  | Pick<Extract<FrontendIntent, { type: "permissions.set-workspace-vault-access" }>, "type" | "payload">;

interface WorkspacePermissionSettingsHost {
  getModel(): FrontendPermissionScreenViewModel | null;
  supportsObsidianVaultAccess(): boolean;
  onIntent(intent: SettingsIntent): Promise<void>;
  onChanged(): void;
  onError(message: string | null): void;
  onManageTools?(): void;
}

/** Local selection only; all policy values and revisions remain runtime-owned. */
export class WorkspacePermissionSettings {
  private selectedKey: string | null = null;
  private saving = false;
  private disposed = false;
  private readonly groupName = `workspace-permission-${crypto.randomUUID()}`;

  constructor(private readonly host: WorkspacePermissionSettingsHost) {}

  /** Invalidate in-flight presentation without cancelling a committed backend action. */
  dispose(): void { this.disposed = true; }

  /** Render a named workspace selector and that workspace's current choices. */
  render(parent: HTMLElement, model: FrontendPermissionScreenViewModel): void {
    const choices = model.workspacePolicies ?? [];
    const activeKey = model.activeWorkspaceTarget ? workspaceTargetKey(model.activeWorkspaceTarget) : null;
    const current = choices.find((row) => workspaceTargetKey(row.target) === this.selectedKey)
      ?? choices.find((row) => workspaceTargetKey(row.target) === activeKey) ?? choices[0];
    if (!current) {
      parent.createDiv({ cls: "chatobby-permissions__notice", text: "Workspace permissions are unavailable. Reload to try again.", attr: { role: "status" } });
      return;
    }
    this.selectedKey = workspaceTargetKey(current.target);
    const scope = createPageSection(parent, { title: "Workspace", description: "Saved choices apply to all chats in this workspace, including delegated agents.", surface: "divided", className: "chatobby-permissions__section" });
    const select = scope.content.createEl("select", { cls: "chatobby-permissions__workspace-select", attr: { "aria-label": "Workspace permissions", "data-page-focus-key": "permissions:workspace" } });
    for (const row of choices) select.createEl("option", { value: workspaceTargetKey(row.target), text: row.label });
    select.value = this.selectedKey;
    select.disabled = this.saving || model.loading;
    select.addEventListener("change", () => { this.selectedKey = select.value; this.host.onError(null); this.host.onChanged(); });
    const busy = this.saving || model.loading;
    renderPermissionChoices(parent, current, busy, this.groupName, (patch) => void this.savePolicy(current, patch));
    this.renderTools(parent, model, current, busy);
    const connected = createPageSection(parent, { title: "MCP tools", description: "Enabled MCP servers and tools are available in every mode. Manage which ones are enabled in Plugins.", surface: "divided", className: "chatobby-permissions__section" });
    if (this.host.onManageTools) connected.content.createEl("button", { text: "Manage connected tools", attr: { type: "button" } }).addEventListener("click", () => this.host.onManageTools?.());
  }

  private renderTools(parent: HTMLElement, model: FrontendPermissionScreenViewModel, policy: FrontendWorkspacePermissionPolicy, busy: boolean): void {
    const projectId = policy.target.kind === "project" ? policy.target.projectId : null;
    const grant = model.workspaceVaultAccess?.find((row) => row.projectId === projectId);
    const section = createPageSection(parent, { title: "Chatobby and Obsidian tools", description: "On by default for Vault and Project workspaces. Tools still pass through the selected mode's permission handler.", surface: "divided", className: "chatobby-permissions__section" });
    const label = section.content.createEl("label", { cls: "chatobby-permissions__network-control" });
    label.createSpan({ text: `Allow tools and note context for ${policy.label}` });
    const toggle = label.createEl("input", { cls: "chatobby-permissions__network-toggle", attr: { type: "checkbox", role: "switch", "aria-label": `Chatobby and Obsidian tools for ${policy.label}`, "data-page-focus-key": `permissions:${this.selectedKey}:tools` } });
    toggle.checked = grant?.enabled ?? false;
    toggle.disabled = busy || !grant || !this.host.supportsObsidianVaultAccess();
    toggle.addEventListener("change", () => {
      if (!grant || !this.host.supportsObsidianVaultAccess()) return;
      const current = this.host.getModel();
      const fresh = current?.workspaceVaultAccess?.find((row) => row.projectId === projectId);
      if (!current || current.loading || !fresh || fresh.revision !== grant.revision || fresh.projectRevision !== grant.projectRevision) {
        this.host.onError("This workspace changed. Reload permissions before trying again."); return;
      }
      void this.dispatch({ type: "permissions.set-workspace-vault-access", payload: { projectId, expectedProjectRevision: grant.projectRevision, expectedRevision: grant.revision, enabled: toggle.checked } });
    });
    if (!grant || !this.host.supportsObsidianVaultAccess()) section.content.createDiv({ cls: "chatobby-permissions__notice", text: "Reconnect to change tool access." });
  }

  private async savePolicy(policy: FrontendWorkspacePermissionPolicy, patch: Partial<Pick<FrontendWorkspacePermissionPolicy, "accessMode" | "requestBehavior">>): Promise<void> {
    const model = this.host.getModel();
    const current = model?.workspacePolicies?.find((row) => workspaceTargetKey(row.target) === workspaceTargetKey(policy.target));
    if (this.saving || this.disposed) return;
    if (model?.loading || model?.executionMode !== "permissions" || !current || current.revision !== policy.revision) {
      this.host.onError("This workspace changed. Reload permissions before trying again."); return;
    }
    await this.dispatch({ type: "permissions.set-workspace-policy", payload: { target: policy.target, expectedRevision: policy.revision, accessMode: patch.accessMode ?? policy.accessMode, requestBehavior: patch.requestBehavior ?? policy.requestBehavior } });
  }

  private async dispatch(intent: SettingsIntent): Promise<void> {
    if (this.saving || this.disposed) return;
    this.saving = true;
    const selectedKey = this.selectedKey;
    this.host.onError(null);
    this.host.onChanged();
    try { await this.host.onIntent(intent); }
    catch (error) { if (!this.disposed && this.selectedKey === selectedKey) this.host.onError(error instanceof Error ? error.message : String(error)); }
    finally { this.saving = false; if (!this.disposed) this.host.onChanged(); }
  }
}
