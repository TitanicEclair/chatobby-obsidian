import type { FrontendPermissionScreenViewModel } from "../../../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection } from "../../../../ui/shared/page-shell";
import type { LegacyPermissionHost } from "./permission-view-types";
/** Retained display adapter for runtimes predating workspace permissions. */
export class LegacyAccessSections {
  constructor(private readonly props: LegacyPermissionHost) {}
  private get saving(): boolean { return this.props.isSaving(); }
  renderObsidianVaultAccess(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    const grant = model.obsidianVaultAccess;
    const supported = this.props.supportsObsidianVaultAccess();
    const available = supported && grant?.status === "available" && !model.loading;
    const section = createPageSection(body, {
      title: "Obsidian vault access",
      description: "This switch applies only to the current Project or Vault, not the whole installation. It includes Obsidian CLI, vault-level tools, and passive Obsidian context. MCP servers and tools still need their separate switches in Plugins.",
      surface: "divided",
      className: "chatobby-permissions__section",
    });
    const label = section.content.createEl("label", { cls: "chatobby-permissions__network-control" });
    const copy = label.createDiv({ cls: "chatobby-permissions__network-copy" });
    copy.createDiv({
      cls: "chatobby-permissions__network-title",
      text: available ? grant.enabled ? "On" : "Off" : model.loading ? "Loading" : "Unavailable",
    });
    copy.createDiv({
      cls: "chatobby-permissions__scope-detail",
      text: available
        ? `${grant.source === "default" ? "Runtime default" : "Your explicit choice"} for this chat's ${model.scope.kind === "project" ? "Project" : "Vault"}.`
        : !supported ? "This runtime connection has not enabled Obsidian vault-access controls."
          : grant?.status === "unavailable" ? grant.reason : "Waiting for the runtime to confirm this chat's access.",
    });
    const toggle = label.createEl("input", {
      cls: "chatobby-permissions__network-toggle",
      attr: { type: "checkbox", role: "switch", "aria-label": "Allow Obsidian vault access", "data-page-state-key": "permissions:obsidian-vault" },
    });
    toggle.checked = available && grant.enabled;
    toggle.disabled = !available || this.saving;
    toggle.addEventListener("change", () => void this.props.setObsidianVaultAccess(model, toggle.checked));
    section.content.createDiv({
      cls: "chatobby-permissions__warning",
      text: model.executionMode === "full-access"
        ? "Controls Chatobby’s Obsidian tools and note context. File and shell access remain unrestricted."
        : "Uses Obsidian’s app authority beyond ordinary filesystem scope. When On, these operations can read or change the vault in any access mode and use Obsidian’s network access. Project roots, memory scope, and identity do not change.",
      attr: { role: "note" },
    });
  }

  renderEffectiveAccess(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    const section = createPageSection(body, {
      title: "Effective now",
      description: "Runtime-reported behavior for this exact session and scope.",
      surface: "divided",
      className: "chatobby-permissions__section",
    });
    const rows = section.content.createDiv({
      cls: "chatobby-permissions__effective-list",
    });
    effectiveRow(
      rows,
      "Files",
      model.effective.fileWrite
        ? "Read and write"
        : model.effective.fileRead
          ? "Read only"
          : "Unavailable",
    );
    effectiveRow(rows, "Obsidian",
      !model.loading && this.props.supportsObsidianVaultAccess() && model.obsidianVaultAccess?.status === "available"
        ? obsidianAccessLabel(model.effective.obsidian) : "Unavailable");
    effectiveRow(
      rows,
      "Local processes",
      localProcessLabel(model.effective.localProcess),
    );
    effectiveRow(
      rows,
      "Agent network",
      model.effective.agentNetworkAccess ? "On" : "Off",
    );
    if (model.effective.warning) {
      section.content.createDiv({
        cls: "chatobby-permissions__warning",
        text: model.effective.warning,
        attr: { role: "status" },
      });
    }
  }

}

function effectiveRow(parent: HTMLElement, label: string, value: string): void {
  const row = parent.createDiv({ cls: "chatobby-permissions__effective-row" });
  row.createSpan({ cls: "chatobby-permissions__effective-label", text: label });
  row.createSpan({ cls: "chatobby-permissions__effective-value", text: value });
}

function localProcessLabel(
  value: FrontendPermissionScreenViewModel["effective"]["localProcess"],
): string {
  if (value === "native-contained")
    return "Restricted by the older runtime";
  if (value === "unsandboxed") return "Unsandboxed as your user account";
  return "Unavailable";
}

function obsidianAccessLabel(
  value: FrontendPermissionScreenViewModel["effective"]["obsidian"],
): string {
  if (value === "app-authority") return "Obsidian app authority beyond ordinary filesystem scope";
  if (value === "typed-read") return "Read-only operations";
  if (value === "typed-workspace") return "Workspace operations";
  if (value === "unsandboxed") return "Unrestricted";
  return "Unavailable";
}
