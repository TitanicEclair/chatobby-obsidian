import type { FrontendPermissionScreenViewModel } from "../../../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection } from "../../../../ui/shared/page-shell";
import type { LegacyPermissionHost } from "./permission-view-types";
type AccessMode = FrontendPermissionScreenViewModel["accessPolicy"]["accessMode"];
const ACCESS_MODES: readonly {
  readonly id: AccessMode;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    id: "read-only",
    title: "Read-only",
    description:
      "Read files inside the selected working roots without changing them. Obsidian app access is a separate exception below.",
  },
  {
    id: "workspace",
    title: "Workspace",
    description:
      "Read, edit and delete files inside the selected working roots. Obsidian app access is a separate exception below.",
  },
  {
    id: "full",
    title: "Full access",
    description:
      "Run unsandboxed as your user account, access files outside the selected roots, and use the network.",
  },
];

/** Retained display adapter for runtimes predating workspace permissions. */
export class LegacyPolicySections {
  private readonly modeGroupName = `chatobby-access-mode-${crypto.randomUUID()}`;
  constructor(private readonly props: LegacyPermissionHost) {}
  private get saving(): boolean { return this.props.isSaving(); }
  renderScope(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    const scopeName = model.scope.kind === "project" ? "Project" : "Vault";
    const section = createPageSection(body, {
      title: "Working scope",
      description:
        model.scope.kind === "project"
          ? "This chat's Project identity, file roots, and memory scope stay bound to the active Project. Viewing another Project does not change this boundary. Policy and workspace changes govern future actions; they do not remove existing conversation context."
          : "No Project is active, so the runtime is reporting the Vault boundary explicitly. Policy and workspace changes govern future actions; they do not remove existing conversation context.",
      surface: "divided",
      className: "chatobby-permissions__section",
    });
    const summary = section.content.createDiv({
      cls: "chatobby-permissions__scope-summary",
    });
    const copy = summary.createDiv({ cls: "chatobby-permissions__scope-copy" });
    copy.createDiv({
      cls: "chatobby-permissions__scope-label",
      text: model.scope.kind === "project" ? "Active Project" : "Vault",
    });
    copy.createDiv({
      cls: "chatobby-permissions__scope-detail",
      text: `${scopeName} · ${model.scope.selectedRootCount} selected ${model.scope.selectedRootCount === 1 ? "root" : "roots"}`,
    });
    summary.createSpan({
      cls: `chatobby-permissions__status-pill ${model.scope.filesystemBound ? "is-ready" : "is-attention"}`,
      text: model.scope.filesystemBound ? "Bound" : "No file roots",
    });
    if (!model.scope.filesystemBound) {
      const full = model.accessPolicy.accessMode === "full";
      section.content.createDiv({
        cls: "chatobby-permissions__warning",
        text:
          model.scope.kind === "project"
            ? full
              ? "This Project has no selected roots and does not fall back to the whole Vault. Full access can still reach explicit host paths with unsandboxed user-account authority."
              : "This Project has no selected roots. File and local-process access stays unavailable; Chatobby does not fall back to the whole Vault."
            : full
              ? "No Vault roots are registered. Full access can still reach explicit host paths with unsandboxed user-account authority."
              : "No Vault roots are available. File and local-process access stays unavailable.",
        attr: { role: "status" },
      });
    }
  }

  renderModes(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    const policyOwnerIsActive = model.accessPolicySessionId === this.props.getActiveSessionId();
    const section = createPageSection(body, {
      title: "Access mode",
      description:
        "These choices are reported by the older runtime. Update it to use workspace permissions. Obsidian vault access below is an app-authority exception; MCP tool exposure is chosen separately in Plugins.",
      surface: "divided",
      className: "chatobby-permissions__section",
    });
    section.content.createDiv({ cls: "chatobby-permissions__notice", attr: { role: "note" },
      text: "Access mode and agent network belong to this saved chat and are kept when you reopen it. Other independent chats, including chats in the same Project, keep their own settings. Tabs showing this same chat share its settings; delegated agents inherit their parent session's policy. Changing them affects future actions without changing roots or memory scope." });
    if (!policyOwnerIsActive) section.content.createDiv({ cls: "chatobby-permissions__notice", attr: { role: "note" },
      text: this.props.getActiveSessionId() ? "Controlled by parent session. Mode and network are read-only here." : "No active session is available to change this policy." });
    const group = section.content.createDiv({
      cls: "chatobby-permissions__mode-list",
      attr: { role: "radiogroup", "aria-label": "Agent access mode" },
    });
    for (const option of ACCESS_MODES) {
      const label = group.createEl("label", {
        cls: `chatobby-permissions__mode${model.accessPolicy.accessMode === option.id ? " is-selected" : ""}`,
      });
      const radio = label.createEl("input", {
        attr: {
          type: "radio",
          name: this.modeGroupName,
          value: option.id,
          "aria-label": option.title,
          "data-page-focus-key": `permissions:${model.accessPolicySessionId}:mode:${option.id}`,
        },
      });
      radio.checked = model.accessPolicy.accessMode === option.id;
      radio.disabled = this.saving || model.loading || !policyOwnerIsActive;
      const copy = label.createDiv({ cls: "chatobby-permissions__mode-copy" });
      copy.createDiv({
        cls: "chatobby-permissions__mode-title",
        text: option.title,
      });
      copy.createDiv({
        cls: "chatobby-permissions__mode-description",
        text: option.description,
      });
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        void this.props.setPolicy(
          model,
          option.id,
          option.id === "full" ? true : model.accessPolicy.agentNetworkAccess,
        );
      });
    }
    if (model.accessPolicy.accessMode === "full") {
      section.content.createDiv({
        cls: "chatobby-permissions__warning",
        text:
          "Full access is ordinary unsandboxed execution as your user account. It includes files outside the selected roots and network access.",
        attr: { role: "alert" },
      });
    }
  }

  renderNetwork(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    const full = model.accessPolicy.accessMode === "full";
    const policyOwnerIsActive = model.accessPolicySessionId === this.props.getActiveSessionId();
    const section = createPageSection(body, {
      title: "Agent network access",
      description:
        "This network setting applies to this chat. New chats start with network On. It controls network use reported by the older runtime, not delegated Obsidian app operations, a connection test you explicitly start, model requests, or update checks.",
      surface: "divided",
      className: "chatobby-permissions__section",
    });
    const label = section.content.createEl("label", {
      cls: "chatobby-permissions__network-control",
    });
    const copy = label.createDiv({ cls: "chatobby-permissions__network-copy" });
    copy.createDiv({
      cls: "chatobby-permissions__network-title",
      text: model.accessPolicy.agentNetworkAccess ? "On" : "Off",
    });
    copy.createDiv({
      cls: "chatobby-permissions__scope-detail",
      text: !policyOwnerIsActive ? "Controlled by parent session."
        : full
        ? "Full access always includes network access."
        : "MCP servers and their selected tools remain a separate choice.",
    });
    const toggle = label.createEl("input", {
      cls: "chatobby-permissions__network-toggle",
      attr: {
        type: "checkbox",
        role: "switch",
        "aria-label": "Allow agent network access",
        "data-page-focus-key": `permissions:${model.accessPolicySessionId}:network`,
      },
    });
    toggle.checked = model.accessPolicy.agentNetworkAccess;
    toggle.disabled = this.saving || model.loading || full || !policyOwnerIsActive;
    toggle.addEventListener("change", () =>
      void this.props.setPolicy(model, model.accessPolicy.accessMode, toggle.checked),
    );
  }

}
