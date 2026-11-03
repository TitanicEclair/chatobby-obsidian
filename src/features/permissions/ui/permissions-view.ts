import { LegacyPolicySections } from "./compatibility/legacy-policy-sections";
import { LegacyAccessSections } from "./compatibility/legacy-access-sections";
import { WorkspacePermissionSettings } from "./workspace-permission-settings";
import type { FrontendIntent, FrontendPermissionScreenViewModel } from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { renderWorkspaceAccess, type WorkspaceAccessChoice } from "./compatibility/workspace-access-view";
import {
  createPageIconButton,
  createPageSection,
  createPageState,
  PageShell,
} from "../../../ui/shared/page-shell";

type AccessMode = FrontendPermissionScreenViewModel["accessPolicy"]["accessMode"];

export type PermissionViewIntent =
  | Pick<Extract<FrontendIntent, { type: "permissions.set-workspace-policy" }>, "type" | "payload">
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
  subscribe(
    listener: (model: FrontendPermissionScreenViewModel | null) => void,
  ): () => void;
  onRefresh(): Promise<void>;
  onIntent(intent: PermissionViewIntent): Promise<void>;
  onBack(): void;
}

/** Simple renderer for the runtime-owned access policy. */
export class PermissionsView extends ChatobbyComponent {
  private readonly legacyPolicy: LegacyPolicySections;
  private readonly legacyAccess: LegacyAccessSections;
  private readonly workspaceSettings: WorkspacePermissionSettings;
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;
  private saving = false;
  private shell: PageShell | null = null;
  private reloadButton: HTMLButtonElement | null = null;

  constructor(private readonly props: PermissionsViewProps) {
    super();
    const host = { getActiveSessionId: () => props.getActiveSessionId(), supportsObsidianVaultAccess: () => props.supportsObsidianVaultAccess(),
      isSaving: () => this.saving, setPolicy: (model: FrontendPermissionScreenViewModel, mode: AccessMode, network: boolean) => this.setPolicy(model, mode, network),
      setObsidianVaultAccess: (model: FrontendPermissionScreenViewModel, enabled: boolean) => this.setObsidianVaultAccess(model, enabled) };
    this.legacyPolicy = new LegacyPolicySections(host);
    this.legacyAccess = new LegacyAccessSections(host);
    this.workspaceSettings = new WorkspacePermissionSettings({ getModel: () => props.getModel(), onIntent: (intent) => props.onIntent(intent),
      supportsObsidianVaultAccess: () => props.supportsObsidianVaultAccess(), onManageTools: () => props.onManageTools?.(),
      onChanged: () => this.renderState(props.getModel()), onError: (error) => this.setLocalError(error) });
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
    this.workspaceSettings.dispose();
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
      if (model.executionMode === "permissions") {
        this.workspaceSettings.render(body, model);
        return;
      }
      if (model.executionMode === "full-access") {
        const access = createPageSection(body, {
          title: "Full access",
          description: "This older runtime reports Full access. Update it in Settings to use workspace permissions.",
          surface: "divided", className: "chatobby-permissions__section",
        });
        access.content.createEl("p", { text: "Agents can read, change and delete files, run commands, and use the network with your OS user account’s access, including outside this vault." });
        access.content.createEl("p", { text: "Project memory and session searches stay scoped to the current workspace. This does not restrict access through file or shell tools." });
        if (this.props.workspacePage) {
          renderWorkspaceAccess(body, model, this.saving, this.props.supportsObsidianVaultAccess(),
            (choice, enabled) => void this.setWorkspaceAccess(choice, enabled), () => this.props.onManageTools?.());
        } else {
          this.legacyAccess.renderObsidianVaultAccess(body, model);
        }
        return;
      }
      body.createDiv({ cls: "chatobby-permissions__notice", attr: { role: "status" },
        text: "This older runtime uses session-based permissions. Update it in Settings to use workspace permissions; its reported access is shown below." });
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
        this.legacyPolicy.renderScope(body, model);
        this.legacyPolicy.renderModes(body, model);
        this.legacyPolicy.renderNetwork(body, model);
        this.legacyAccess.renderObsidianVaultAccess(body, model);
      }
      if (!this.props.workspacePage) this.legacyAccess.renderEffectiveAccess(body, model);
    });
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
