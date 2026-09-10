import type { FrontendIntent, FrontendPermissionScreenViewModel } from "../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../shared/component";
import { nativeSetupIntentIsCurrent, type NativeSetupIntent, renderNativeSetup } from "./native-setup-view";
import { renderWorkspaceAccess, type WorkspaceAccessChoice } from "./workspace-access-view";
import {
  createPageIconButton,
  createPageSection,
  createPageState,
  PageShell,
} from "../shared/page-shell";

type AccessMode = FrontendPermissionScreenViewModel["accessPolicy"]["accessMode"];

export type PermissionViewIntent =
  | NativeSetupIntent
  | Pick<Extract<FrontendIntent, { type: "permissions.set-workspace-vault-access" }>, "type" | "payload">
  | (Pick<Extract<FrontendIntent, { type: "permissions.set-access-policy" }>, "type" | "payload">
    & { readonly mainSessionId: string })
  | Pick<Extract<FrontendIntent, { type: "permissions.set-obsidian-vault-access" }>, "type" | "payload">;

export interface PermissionsViewProps {
  workspacePage?: boolean;
  onManageTools?(): void;
  getModel(): FrontendPermissionScreenViewModel | null;
  getActiveSessionId(): string | null;
  supportsObsidianVaultAccess(): boolean;
  supportsNativeSetup?(): boolean;
  subscribe(
    listener: (model: FrontendPermissionScreenViewModel | null) => void,
  ): () => void;
  onRefresh(): Promise<void>;
  onIntent(intent: PermissionViewIntent): Promise<void>;
  onBack(): void;
}

const ACCESS_MODES: readonly {
  readonly id: AccessMode;
  readonly title: string;
  readonly description: string;
}[] = [
  {
    id: "read-only",
    title: "Read-only",
    description:
      "Read files inside the selected working roots without changing them. Local processes require a ready native backend and keep selected roots read-only. Obsidian app access is a separate exception below.",
  },
  {
    id: "workspace",
    title: "Workspace",
    description:
      "Read, edit and delete files inside the selected working roots. Local processes require a ready native backend. Obsidian app access is a separate exception below.",
  },
  {
    id: "full",
    title: "Full access",
    description:
      "Run unsandboxed as your user account, access files outside the selected roots, and use the network.",
  },
];

/** Simple renderer for the runtime-owned access policy. */
export class PermissionsView extends ChatobbyComponent {
  private readonly modeGroupName = `chatobby-access-mode-${crypto.randomUUID()}`;
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;
  private saving = false;
  private shell: PageShell | null = null;
  private reloadButton: HTMLButtonElement | null = null;

  constructor(private readonly props: PermissionsViewProps) {
    super();
  }

  focusContainer(): void {
    this.container?.focus();
  }

  handleKeydown(_event: KeyboardEvent): boolean {
    return false;
  }

  setLocalError(error: string | null): void {
    this.localError = error;
    this.renderState(this.props.getModel());
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-permissions-view";
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    this.shell = new PageShell(container, {
      title: "Permissions",
      subtitle: "Runtime access and connected tools.",
      width: "form",
      headerClass: "chatobby-permissions__header",
      titleClass: "chatobby-permissions__title",
      actionsClass: "chatobby-permissions__header-actions",
      bodyClass: "chatobby-permissions__body",
    });
    this.reloadButton = createPageIconButton(
      this.shell.actions,
      "refresh-cw",
      "Reload permissions",
      { className: "chatobby-permissions__icon-btn" },
    );
    this.reloadButton.addEventListener("click", () => void this.refresh());
    createPageIconButton(
      this.shell.actions,
      "x",
      "Close permissions",
      { className: "chatobby-permissions__icon-btn" },
    ).addEventListener("click", () => this.props.onBack());
    this.unsubscribe = this.props.subscribe((model) => this.renderState(model));
    this.renderState(this.props.getModel());
  }

  override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.destroy();
  }

  private renderState(model: FrontendPermissionScreenViewModel | null): void {
    const shell = this.shell;
    if (!shell) return;
    const error = this.localError ?? model?.error;
    shell.setBusy(this.saving);
    this.reloadButton?.toggleClass("is-loading", model?.loading ?? false);
    this.reloadButton?.setAttr("aria-busy", String(model?.loading ?? false));
    shell.setStatus(
      error
        ? {
            tone: "error",
            message: error,
            actionLabel: "Try again",
            onAction: () => void this.refresh(),
          }
        : model?.statusMessage
          ? { tone: "success", message: model.statusMessage }
          : null,
    );
    shell.updateBody(`permissions:${model?.accessPolicySessionId ?? "loading"}`, (body) => {
      if (!model) {
        createPageState(body, {
          kind: error ? "error" : "loading",
          title: error ? "Permissions are unavailable" : "Loading permissions",
          description: error
            ? "Check the runtime connection and try again."
            : "Reading the current access boundary.",
        });
        return;
      }
      if (model.executionMode === "full-access") {
        const access = createPageSection(body, {
          title: "Full access",
          description: "Sandboxing is temporarily unavailable in Chatobby 0.5.3.",
          surface: "divided", className: "chatobby-permissions__section",
        });
        access.content.createEl("p", { text: "Agents can read, change and delete files, run commands, and use the network with your OS user account’s access, including outside this vault." });
        access.content.createEl("p", { text: "Project memory and session searches stay scoped to the current workspace. This does not restrict access through file or shell tools." });
        if (this.props.workspacePage) {
          renderWorkspaceAccess(body, model, this.saving, this.props.supportsObsidianVaultAccess(),
            (choice, enabled) => void this.setWorkspaceAccess(choice, enabled), () => this.props.onManageTools?.());
        } else {
          this.renderObsidianVaultAccess(body, model);
        }
        return;
      }
      body.createDiv({ cls: "chatobby-permissions__notice", attr: { role: "status" },
        text: "This runtime has not reported the Full-access-only mode of 0.5.3. Update the runtime in Settings; its current policy is shown below." });
      if (model.migrationNotice) {
        body.createDiv({
          cls: "chatobby-permissions__notice",
          text: model.migrationNotice,
          attr: { role: "status" },
        });
      }
      if (this.props.workspacePage) {
        renderWorkspaceAccess(body, model, this.saving, this.props.supportsObsidianVaultAccess(),
          (choice, enabled) => void this.setWorkspaceAccess(choice, enabled), () => this.props.onManageTools?.());
      } else {
        this.renderScope(body, model);
        this.renderModes(body, model);
        this.renderNetwork(body, model);
        this.renderObsidianVaultAccess(body, model);
      }
      this.renderNativeSupport(body, model);
      renderNativeSetup(body, model, this.props.supportsNativeSetup?.() === true, this.saving,
        (intent) => void this.setNativeSetup(intent));
      if (!this.props.workspacePage) this.renderEffectiveAccess(body, model);
    });
  }

  private renderScope(
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

  private renderModes(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    const policyOwnerIsActive = model.accessPolicySessionId === this.props.getActiveSessionId();
    const section = createPageSection(body, {
      title: "Access mode",
      description:
        "Workspace restrictions help limit accidental changes; not intended to contain untrusted code. Obsidian vault access below is an app-authority exception; MCP tool exposure is chosen separately in Plugins.",
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
        void this.setPolicy(
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

  private renderNetwork(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    const full = model.accessPolicy.accessMode === "full";
    const policyOwnerIsActive = model.accessPolicySessionId === this.props.getActiveSessionId();
    const section = createPageSection(body, {
      title: "Agent network access",
      description:
        "This network setting applies to this chat. New chats start with network On. It controls network use by sandboxed agent operations, not delegated Obsidian app operations, a connection test you explicitly start, model requests, or update checks.",
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
      void this.setPolicy(model, model.accessPolicy.accessMode, toggle.checked),
    );
  }

  private renderObsidianVaultAccess(
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
    toggle.addEventListener("change", () => void this.setObsidianVaultAccess(model, toggle.checked));
    section.content.createDiv({
      cls: "chatobby-permissions__warning",
      text: model.executionMode === "full-access"
        ? "Controls Chatobby’s Obsidian tools and note context. File and shell access remain unrestricted."
        : "Uses Obsidian’s app authority outside the sandbox. When On, these operations can read or change the vault in any access mode and use Obsidian’s network access. Project roots, memory scope, and identity do not change.",
      attr: { role: "note" },
    });
  }

  private renderNativeSupport(
    body: HTMLElement,
    model: FrontendPermissionScreenViewModel,
  ): void {
    if (model.nativeSupport.backendId === "landstrip") return;
    const section = createPageSection(body, {
      title: "Workspace protection",
      description:
        "Current protection for Read-only and Workspace access.",
      surface: "divided",
      className: "chatobby-permissions__section",
    });
    const row = section.content.createDiv({
      cls: "chatobby-permissions__support-summary",
    });
    const copy = row.createDiv({ cls: "chatobby-permissions__scope-copy" });
    copy.createDiv({
      cls: "chatobby-permissions__scope-label",
      text: nativeSupportLabel(model.nativeSupport.status),
    });
    if (model.nativeSupport.backendId) {
      copy.createDiv({
        cls: "chatobby-permissions__scope-detail",
        text: nativeBackendLabel(model.nativeSupport.backendId),
      });
    }
    row.createSpan({
      cls: `chatobby-permissions__status-pill ${model.nativeSupport.status === "ready" ? "is-ready" : "is-attention"}`,
      text: model.nativeSupport.status === "ready" ? "Ready" : "Not ready",
    });
    if (model.nativeSupport.reason) {
      section.content.createDiv({
        cls: "chatobby-permissions__support-detail",
        text: model.nativeSupport.reason,
      });
    }
    if (model.nativeSupport.userAction) {
      section.content.createDiv({
        cls: "chatobby-permissions__support-action",
        text: model.nativeSupport.userAction,
      });
    }
  }

  private renderEffectiveAccess(
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

  private async setPolicy(
    model: FrontendPermissionScreenViewModel,
    accessMode: AccessMode,
    agentNetworkAccess: boolean,
  ): Promise<void> {
    if (this.saving || model.loading) return;
    if (model.accessPolicySessionId !== this.props.getActiveSessionId()) {
      this.renderState(this.props.getModel());
      return;
    }
    const current = this.props.getModel();
    if (current?.loading || current?.accessPolicySessionId !== model.accessPolicySessionId
      || current.accessPolicy.revision !== model.accessPolicy.revision) {
      this.renderState(current);
      return;
    }
    this.saving = true;
    this.localError = null;
    this.renderState(model);
    try {
      await this.props.onIntent({
        type: "permissions.set-access-policy",
        mainSessionId: model.accessPolicySessionId,
        payload: {
          expectedRevision: model.accessPolicy.revision,
          accessMode,
          agentNetworkAccess: accessMode === "full" ? true : agentNetworkAccess,
        },
      });
    } catch (error) {
      if (this.props.getModel()?.accessPolicySessionId === model.accessPolicySessionId
        && this.props.getActiveSessionId() === model.accessPolicySessionId)
        this.localError = error instanceof Error ? error.message : String(error);
    } finally {
      this.saving = false;
      this.renderState(this.props.getModel());
    }
  }

  private async setObsidianVaultAccess(model: FrontendPermissionScreenViewModel, enabled: boolean): Promise<void> {
    if (this.saving || !this.props.supportsObsidianVaultAccess() || model.loading || model.obsidianVaultAccess?.status !== "available") return;
    const grant = model.obsidianVaultAccess;
    const current = this.props.getModel();
    if (current?.loading || current?.obsidianVaultAccess?.status !== "available"
      || current.obsidianVaultAccess.sessionId !== grant.sessionId
      || current.obsidianVaultAccess.bindingRevision !== grant.bindingRevision
      || current.obsidianVaultAccess.revision !== grant.revision) {
      this.localError = "The active chat or its permissions changed. Review the current access before trying again.";
      this.renderState(current);
      return;
    }
    this.saving = true;
    this.localError = null;
    this.renderState(model);
    try {
      await this.props.onIntent({
        type: "permissions.set-obsidian-vault-access",
        payload: {
          expectedRevision: grant.revision,
          expectedSessionId: grant.sessionId,
          expectedBindingRevision: grant.bindingRevision,
          enabled,
        },
      });
    } catch (error) {
      this.localError = error instanceof Error ? error.message : String(error);
    } finally {
      this.saving = false;
      this.renderState(this.props.getModel());
    }
  }

  private async setWorkspaceAccess(choice: WorkspaceAccessChoice, enabled: boolean): Promise<void> {
    if (this.saving || !this.props.supportsObsidianVaultAccess()) return;
    const current = this.props.getModel();
    if (current?.loading || !current?.workspaceVaultAccess?.some((entry) => entry.projectId === choice.projectId && entry.projectRevision === choice.projectRevision && entry.revision === choice.revision)) {
      this.setLocalError("This area's access changed. Reload Permissions and review it again."); return;
    }
    this.saving = true;
    this.localError = null;
    this.renderState(current);
    try {
      await this.props.onIntent({ type: "permissions.set-workspace-vault-access", payload: {
        projectId: choice.projectId, expectedProjectRevision: choice.projectRevision, expectedRevision: choice.revision, enabled,
      } });
    } catch (error) { this.localError = error instanceof Error ? error.message : String(error); }
    finally { this.saving = false; this.renderState(this.props.getModel()); }
  }

  private async setNativeSetup(intent: NativeSetupIntent): Promise<void> {
    if (!this.isMounted || this.saving) return;
    if (!this.props.supportsNativeSetup?.() || !nativeSetupIntentIsCurrent(this.props.getModel(), intent)) {
      this.setLocalError("The native setup target or connection changed. Reload and review the grants or installed verification again.");
      return;
    }
    this.saving = true;
    this.localError = null;
    this.renderState(this.props.getModel());
    try {
      await this.props.onIntent(intent);
    } catch (error) {
      this.localError = error instanceof Error ? error.message : String(error);
    } finally {
      this.saving = false;
      if (this.isMounted) this.renderState(this.props.getModel());
    }
  }

  private async refresh(): Promise<void> {
    const sessionId = this.props.getActiveSessionId();
    const model = this.props.getModel();
    const previousError = this.localError;
    const isCurrent = () => this.isMounted && this.props.getActiveSessionId() === sessionId
      && this.props.getModel() === model;
    try {
      await this.props.onRefresh();
      // The controller owns the current load's success/error display. A resolved
      // callback may already have shown an error, including the same error again.
    } catch (error) {
      if (isCurrent() && this.localError === previousError)
        this.localError = error instanceof Error ? error.message : String(error);
    }
    if (isCurrent()) this.renderState(this.props.getModel());
  }
}

function effectiveRow(parent: HTMLElement, label: string, value: string): void {
  const row = parent.createDiv({ cls: "chatobby-permissions__effective-row" });
  row.createSpan({ cls: "chatobby-permissions__effective-label", text: label });
  row.createSpan({ cls: "chatobby-permissions__effective-value", text: value });
}

function nativeSupportLabel(
  status: FrontendPermissionScreenViewModel["nativeSupport"]["status"],
): string {
  if (status === "ready") return "Workspace protection is ready";
  if (status === "setup-required") return "Setup required";
  if (status === "unsupported") return "Not supported on this device";
  return "Not yet verified";
}

function nativeBackendLabel(
  backend: NonNullable<
    FrontendPermissionScreenViewModel["nativeSupport"]["backendId"]
  >,
): string {
  if (backend === "windows-appcontainer") return "Windows AppContainer";
  if (backend === "linux-bubblewrap") return "Linux bubblewrap";
  if (backend === "macos-seatbelt") return "macOS Seatbelt";
  if (backend === "landstrip") return "Landstrip";
  return "Native backend";
}

function localProcessLabel(
  value: FrontendPermissionScreenViewModel["effective"]["localProcess"],
): string {
  if (value === "native-contained")
    return "Workspace-restricted by the ready native backend";
  if (value === "unsandboxed") return "Unsandboxed as your user account";
  return "Unavailable";
}

function obsidianAccessLabel(
  value: FrontendPermissionScreenViewModel["effective"]["obsidian"],
): string {
  if (value === "app-authority") return "Obsidian app authority outside the sandbox";
  if (value === "typed-read") return "Read-only operations";
  if (value === "typed-workspace") return "Workspace operations";
  if (value === "unsandboxed") return "Unrestricted";
  return "Unavailable";
}
