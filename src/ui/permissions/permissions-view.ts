import { setIcon } from "obsidian";
import type {
  FrontendPermissionDecision,
  FrontendPermissionScreenViewModel,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../shared/component";
import { createPageHeader, createPageIconButton } from "../shared/page-shell";

const DECISIONS: readonly FrontendPermissionDecision[] = ["allow", "ask", "deny"];

export type PermissionViewIntent =
  | { readonly type: "permissions.select-profile"; readonly payload: { readonly profileId: string } }
  | { readonly type: "permissions.activate-profile" | "permissions.duplicate-profile"; readonly payload: { readonly profileId: string } }
  | { readonly type: "permissions.delete-profile"; readonly payload: { readonly profileId: string; readonly replacementProfileId?: string } }
  | { readonly type: "permissions.update-profile"; readonly payload: { readonly profileId: string; readonly name: string; readonly description: string } }
  | { readonly type: "permissions.set-capability"; readonly payload: { readonly profileId: string; readonly capabilityId: string; readonly decision: FrontendPermissionDecision } }
  | { readonly type: "permissions.set-target"; readonly payload: { readonly profileId: string; readonly keys: readonly string[]; readonly decision: FrontendPermissionDecision } }
  | { readonly type: "permissions.set-rule"; readonly payload: { readonly profileId: string; readonly section: string; readonly pattern: string; readonly decision: FrontendPermissionDecision } }
  | { readonly type: "permissions.remove-rule"; readonly payload: { readonly profileId: string; readonly section: string; readonly pattern: string } }
  | { readonly type: "permissions.add-channel" | "permissions.remove-channel"; readonly payload: { readonly profileId: string; readonly channelId: string } }
  | { readonly type: "permissions.set-channel"; readonly payload: { readonly profileId: string; readonly channelId: string; readonly action: "connect" | "read" | "send"; readonly decision: FrontendPermissionDecision } };

export interface PermissionsViewProps {
  getModel(): FrontendPermissionScreenViewModel | null;
  subscribe(listener: (model: FrontendPermissionScreenViewModel | null) => void): () => void;
  onRefresh(): Promise<void>;
  onIntent(intent: PermissionViewIntent): Promise<void>;
  onBack(): void;
}

/** Native renderer for the runtime-owned permission policy screen. */
export class PermissionsView extends ChatobbyComponent {
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;
  private saving = false;
  private editingProfileId: string | null = null;
  private deletingProfileId: string | null = null;
  private readonly openDisclosures = new Set<string>();

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
    this.unsubscribe = this.props.subscribe((model) => this.renderState(model));
    this.renderState(this.props.getModel());
  }

  override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.destroy();
  }

  private renderState(model: FrontendPermissionScreenViewModel | null): void {
    const container = this.container;
    if (!container) return;
    const scrollTop = container.querySelector<HTMLElement>(".chatobby-permissions__body")?.scrollTop ?? 0;
    container.empty();
    const { actions } = createPageHeader(container, {
      title: "Permissions",
      headerClass: "chatobby-permissions__header",
      titleClass: "chatobby-permissions__title",
      actionsClass: "chatobby-permissions__header-actions",
    });
    const reload = iconButton(actions, "refresh-cw", "Reload permissions");
    reload.toggleClass("is-loading", model?.loading ?? false);
    reload.addEventListener("click", () => void this.refresh());
    iconButton(actions, "x", "Close permissions").addEventListener("click", () => this.props.onBack());
    const body = container.createDiv({ cls: "chatobby-page__body chatobby-permissions__body" });
    body.toggleClass("is-saving", this.saving);
    body.setAttr("aria-busy", String(this.saving));
    const error = this.localError ?? model?.error;
    if (error) body.createDiv({ cls: "chatobby-permissions__state is-error", text: error });
    if (!model) {
      body.createDiv({ cls: "chatobby-permissions__state", text: error ? "Permission profiles are unavailable." : "Loading permission profiles…" });
      body.scrollTop = scrollTop;
      return;
    }
    if (model.statusMessage) body.createDiv({ cls: "chatobby-permissions__notice", text: model.statusMessage });
    this.renderProfiles(body, model);
    this.renderCapabilities(body, model);
    this.renderChannels(body, model);
    this.renderAdvanced(body, model);
    const storage = body.createEl("details", { cls: "chatobby-permissions__storage" });
    this.restoreDisclosure(storage, "policy-storage");
    storage.createEl("summary", { text: "Policy storage" });
    for (const line of model.storageLines) storage.createDiv({ text: line });
    body.scrollTop = scrollTop;
  }

  private renderProfiles(body: HTMLElement, model: FrontendPermissionScreenViewModel): void {
    const section = this.section(body, "Permission policy", "Choose a reusable policy for the main agent. Assign subagent policies from each role's editor.");
    const toolbar = section.createDiv({ cls: "chatobby-permissions__profile-toolbar" });
    const picker = toolbar.createDiv({ cls: "chatobby-permissions__profile-picker" });
    const select = picker.createEl("select", { cls: "chatobby-permissions__profile-select", attr: { "aria-label": "Selected permission profile" } });
	for (const profile of model.profiles) {
		select.createEl("option", { text: profile.name, attr: { value: profile.id } }).selected = profile.selected;
	}
    setIcon(picker.createSpan({ cls: "chatobby-permissions__profile-chevron" }), "chevron-down");
    select.addEventListener("change", () => {
      this.editingProfileId = null;
      this.deletingProfileId = null;
      void this.runIntent({ type: "permissions.select-profile", payload: { profileId: select.value } });
    });
    const profile = model.selectedProfile;
    if (profile.activeForMain) toolbar.createSpan({ cls: "chatobby-permissions__active-label", text: "Active for Main" });
    else if (profile.canActivate) {
      toolbar.createEl("button", { cls: "chatobby-permissions__secondary-btn", text: "Use for Main", attr: { type: "button" } })
        .addEventListener("click", () => void this.runIntent({ type: "permissions.activate-profile", payload: { profileId: profile.id } }));
    }
    toolbar.createEl("button", { cls: "chatobby-permissions__secondary-btn", text: profile.duplicateLabel, attr: { type: "button" } })
      .addEventListener("click", () => void this.runIntent({ type: "permissions.duplicate-profile", payload: { profileId: profile.id } }));
    if (profile.canDelete) {
      const remove = iconButton(toolbar, "trash-2", "Delete profile");
      remove.addEventListener("click", () => {
        this.editingProfileId = null;
        this.deletingProfileId = profile.id;
        this.renderState(this.props.getModel());
      });
    }
    const card = section.createDiv({ cls: "chatobby-permissions__profile-card" });
    const summary = card.createDiv({ cls: "chatobby-permissions__profile-summary" });
    const copy = summary.createDiv({ cls: "chatobby-permissions__profile-copy" });
    copy.createDiv({ cls: "chatobby-permissions__profile-name", text: profile.name });
    copy.createDiv({ cls: "chatobby-permissions__profile-description", text: profile.description });
    if (profile.canEdit && this.editingProfileId !== profile.id) {
      summary.createEl("button", { cls: "chatobby-permissions__secondary-btn", text: "Edit", attr: { type: "button" } })
        .addEventListener("click", () => {
          this.editingProfileId = profile.id;
          this.renderState(this.props.getModel());
        });
    }
    if (profile.builtIn) {
      card.createDiv({ cls: "chatobby-permissions__profile-note", text: "Built-in profile. Choose Customize to make an editable copy." });
      return;
    }
    if (this.deletingProfileId === profile.id) {
      this.renderDeleteConfirmation(card, model);
      return;
    }
    if (this.editingProfileId !== profile.id) return;
    const editor = card.createDiv({ cls: "chatobby-permissions__profile-editor" });
    const nameLabel = editor.createEl("label", { cls: "chatobby-permissions__profile-field" });
    nameLabel.createSpan({ text: "Policy name" });
    const name = nameLabel.createEl("input", { cls: "chatobby-permissions__profile-name-input", value: profile.name, attr: { "aria-label": "Profile name" } });
    const descriptionLabel = editor.createEl("label", { cls: "chatobby-permissions__profile-field" });
    descriptionLabel.createSpan({ text: "Description" });
    const description = descriptionLabel.createEl("textarea", { cls: "chatobby-permissions__profile-description-input", attr: { "aria-label": "Profile description", placeholder: "When should this profile be used?" } });
    description.value = profile.description;
    const editorActions = editor.createDiv({ cls: "chatobby-permissions__profile-editor-actions" });
    editorActions.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => {
      this.editingProfileId = null;
      this.renderState(this.props.getModel());
    });
    editorActions.createEl("button", { cls: "mod-cta", text: "Save", attr: { type: "button" } }).addEventListener("click", () => {
      if (!name.value.trim()) return this.setLocalError("Policy name cannot be empty.");
      void this.runIntent({
        type: "permissions.update-profile",
        payload: { profileId: profile.id, name: name.value.trim(), description: description.value.trim() },
      }, () => { this.editingProfileId = null; });
    });
  }

  private renderDeleteConfirmation(card: HTMLElement, model: FrontendPermissionScreenViewModel): void {
    const profile = model.selectedProfile;
    const confirmation = card.createDiv({ cls: "chatobby-permissions__delete-confirmation" });
    confirmation.createDiv({
      cls: "chatobby-permissions__delete-title",
      text: `Delete “${profile.name}”?`,
    });
    confirmation.createDiv({
      cls: "chatobby-permissions__delete-description",
      text: profile.deleteImpactLabel ?? "This custom policy will be permanently removed.",
    });
    let replacement: HTMLSelectElement | null = null;
    if (profile.deleteReplacementRequired) {
      const field = confirmation.createEl("label", { cls: "chatobby-permissions__profile-field" });
      field.createSpan({ text: "Replacement policy" });
      replacement = field.createEl("select", { attr: { "aria-label": "Replacement permission policy" } });
	  replacement.createEl("option", { text: "Choose a replacement…", attr: { value: "" } });
      for (const candidate of model.profiles) {
        if (candidate.id === profile.id) continue;
		replacement.createEl("option", { text: candidate.name, attr: { value: candidate.id } });
      }
    }
    const actions = confirmation.createDiv({ cls: "chatobby-permissions__profile-editor-actions" });
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => {
      this.deletingProfileId = null;
      this.renderState(this.props.getModel());
    });
    const remove = actions.createEl("button", {
      cls: "mod-warning",
      text: "Delete policy",
      attr: { type: "button" },
    });
    if (replacement) remove.disabled = true;
    replacement?.addEventListener("change", () => {
      remove.disabled = !replacement?.value;
    });
    remove.addEventListener("click", () => {
      if (profile.deleteReplacementRequired && !replacement?.value) return;
      void this.runIntent(
        {
          type: "permissions.delete-profile",
          payload: {
            profileId: profile.id,
            replacementProfileId: replacement?.value || undefined,
          },
        },
        () => { this.deletingProfileId = null; },
      );
    });
  }

  private renderCapabilities(body: HTMLElement, model: FrontendPermissionScreenViewModel): void {
    const section = this.section(body, "Capabilities", model.capabilityDescription);
    section.createDiv({ cls: "chatobby-permissions__connection-note", text: "Chatobby's tool discovery and its Obsidian connection stay available. These controls govern the actions those tools may perform." });
    if (model.inventoryWarning) section.createDiv({ cls: "chatobby-permissions__inventory-warning", text: model.inventoryWarning });
    const groups = section.createDiv({ cls: "chatobby-permissions__capabilities" });
    for (const group of model.capabilities) {
      const details = groups.createEl("details", { cls: "chatobby-permissions__capability" });
      this.restoreDisclosure(details, `capability:${group.id}`);
      const summary = details.createEl("summary", { cls: "chatobby-permissions__capability-summary" });
      const copy = summary.createDiv({ cls: "chatobby-permissions__capability-copy" });
      copy.createDiv({ cls: "chatobby-permissions__capability-name", text: group.label });
      copy.createDiv({ cls: "chatobby-permissions__capability-description", text: group.description });
      copy.createDiv({ cls: "chatobby-permissions__capability-count", text: group.countLabel });
      this.renderDecisionControls(summary, group.label, group.decision.value, group.decision.disabled, (decision) => void this.runIntent({
        type: "permissions.set-capability",
        payload: { profileId: model.selectedProfileId, capabilityId: group.id, decision },
      }));
      const targets = details.createDiv({ cls: "chatobby-permissions__rules" });
      for (const target of group.targets) {
        this.renderDecisionRow(targets, target.label, target.description, target.source, target.inherited, target.decision.value, target.decision.disabled, (decision) => void this.runIntent({
          type: "permissions.set-target",
          payload: { profileId: model.selectedProfileId, keys: target.keys, decision },
        }));
      }
    }
  }

  private renderChannels(body: HTMLElement, model: FrontendPermissionScreenViewModel): void {
    const section = this.section(body, "Channel access", model.channelDescription);
    const list = section.createDiv({ cls: "chatobby-permissions__channel-list" });
    if (model.channels.length === 0) list.createDiv({ cls: "chatobby-permissions__channel-empty", text: "No channels are available to this policy." });
    for (const channel of model.channels) {
      const row = list.createDiv({ cls: "chatobby-permissions__channel" });
      const copy = row.createDiv({ cls: "chatobby-permissions__channel-copy" });
      copy.createDiv({ cls: "chatobby-permissions__channel-name", text: channel.label });
      copy.createDiv({ cls: "chatobby-permissions__channel-id", text: channel.channelId });
      const actions = row.createDiv({ cls: "chatobby-permissions__channel-actions" });
      for (const action of ["connect", "read", "send"] as const) {
        const control = actions.createDiv({ cls: "chatobby-permissions__channel-action" });
        control.createSpan({ text: titleCase(action) });
        this.renderDecisionControls(control, `${channel.label} ${action}`, channel.decisions[action], channel.disabled, (decision) => void this.runIntent({
          type: "permissions.set-channel",
          payload: { profileId: model.selectedProfileId, channelId: channel.channelId, action, decision },
        }));
      }
      if (!channel.disabled) {
        iconButton(row, "x", `Remove ${channel.label}`).addEventListener("click", () => void this.runIntent({
          type: "permissions.remove-channel",
          payload: { profileId: model.selectedProfileId, channelId: channel.channelId },
        }));
      }
    }
    if (model.selectedProfile.builtIn) {
      const addRow = list.createDiv({ cls: "chatobby-permissions__add-channel" });
      addRow.createEl("button", {
        cls: "chatobby-permissions__secondary-btn",
        text: "Customize to choose channels",
        attr: { type: "button" },
      }).addEventListener("click", () => void this.runIntent({
        type: "permissions.duplicate-profile",
        payload: { profileId: model.selectedProfileId },
      }));
    } else if (model.availableChannels.length > 0) {
      const addRow = list.createDiv({ cls: "chatobby-permissions__add-channel" });
      const select = addRow.createEl("select", { attr: { "aria-label": "Channel to add" } });
      for (const option of model.availableChannels) {
        select.createEl("option", { text: option.label, attr: { value: option.value } });
      }
      addRow.createEl("button", { cls: "chatobby-permissions__add-btn", text: "Add channel", attr: { type: "button" } }).addEventListener("click", () => {
        if (select.value) void this.runIntent({ type: "permissions.add-channel", payload: { profileId: model.selectedProfileId, channelId: select.value } });
      });
    }
  }

  private renderAdvanced(body: HTMLElement, model: FrontendPermissionScreenViewModel): void {
    const details = body.createEl("details", { cls: "chatobby-permissions__advanced" });
    this.restoreDisclosure(details, "advanced-rules");
    details.createEl("summary", { text: "Advanced path, shell, and skill rules" });
    details.createDiv({ cls: "chatobby-permissions__section-description", text: model.advancedDescription });
    for (const group of model.advancedGroups) {
      const section = details.createDiv({ cls: "chatobby-permissions__advanced-section" });
      section.createDiv({ cls: "chatobby-permissions__advanced-title", text: group.label });
      const list = section.createDiv({ cls: "chatobby-permissions__rules" });
      for (const rule of group.rules) {
        const row = list.createDiv({ cls: "chatobby-permissions__rule" });
        row.createDiv({ cls: "chatobby-permissions__rule-copy" }).createDiv({ cls: "chatobby-permissions__rule-label", text: rule.pattern });
        this.renderDecisionControls(row, rule.pattern, rule.decision, group.disabled, (decision) => void this.runIntent({
          type: "permissions.set-rule",
          payload: { profileId: model.selectedProfileId, section: group.section, pattern: rule.pattern, decision },
        }));
        if (!group.disabled) iconButton(row, "x", `Remove ${rule.pattern}`).addEventListener("click", () => void this.runIntent({
          type: "permissions.remove-rule",
          payload: { profileId: model.selectedProfileId, section: group.section, pattern: rule.pattern },
        }));
      }
      if (!group.disabled) this.renderAddRule(list, model.selectedProfileId, group.section, group.placeholder);
    }
  }

  private renderAddRule(parent: HTMLElement, profileId: string, section: string, placeholder: string): void {
    const row = parent.createDiv({ cls: "chatobby-permissions__add-rule" });
    const input = row.createEl("input", { attr: { type: "text", placeholder, "aria-label": `New ${section} rule` } });
    const decision = row.createEl("select", { attr: { "aria-label": "New rule decision" } });
	for (const value of DECISIONS) decision.createEl("option", { text: titleCase(value), attr: { value } });
    decision.value = "ask";
    const save = (): void => {
      if (!input.value.trim() || !isDecision(decision.value)) return;
      void this.runIntent({ type: "permissions.set-rule", payload: { profileId, section, pattern: input.value.trim(), decision: decision.value } });
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); save(); }
    });
    row.createEl("button", { cls: "chatobby-permissions__add-btn", text: "Add", attr: { type: "button" } }).addEventListener("click", save);
  }

  private renderDecisionRow(
    parent: HTMLElement,
    labelText: string,
    description: string | undefined,
    source: string | undefined,
    inherited: boolean,
    current: FrontendPermissionDecision | "mixed",
    disabled: boolean,
    onDecision: (decision: FrontendPermissionDecision) => void,
  ): void {
    const row = parent.createDiv({ cls: "chatobby-permissions__rule" });
    const copy = row.createDiv({ cls: "chatobby-permissions__rule-copy" });
    const label = copy.createDiv({ cls: "chatobby-permissions__rule-label", text: labelText });
    if (source) label.createSpan({ cls: "chatobby-permissions__source", text: source });
    if (inherited) label.createSpan({ cls: "chatobby-permissions__inherited", text: " inherited" });
    if (description) copy.createDiv({ cls: "chatobby-permissions__rule-description", text: description });
    this.renderDecisionControls(row, labelText, current, disabled, onDecision);
  }

  private renderDecisionControls(
    parent: HTMLElement,
    label: string,
    current: FrontendPermissionDecision | "mixed",
    disabled: boolean,
    onDecision: (decision: FrontendPermissionDecision) => void,
  ): void {
    const decisions = parent.createDiv({ cls: "chatobby-permissions__decisions" });
    if (current === "mixed") decisions.createSpan({ cls: "chatobby-permissions__mixed", text: "Mixed" });
    for (const decision of DECISIONS) {
      const button = decisions.createEl("button", {
        cls: `chatobby-permissions__decision${decision === current ? " is-active" : ""}`,
        text: titleCase(decision),
        attr: { type: "button", "data-decision": decision, "aria-pressed": String(decision === current), "aria-label": `${label}: ${decision}` },
      });
      button.disabled = disabled || this.saving;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onDecision(decision);
      });
    }
  }

  private section(body: HTMLElement, title: string, description: string): HTMLElement {
    const section = body.createDiv({ cls: "chatobby-permissions__section" });
    section.createDiv({ cls: "chatobby-permissions__section-title", text: title });
    section.createDiv({ cls: "chatobby-permissions__section-description", text: description });
    return section;
  }

  private restoreDisclosure(details: HTMLDetailsElement, key: string): void {
    details.open = this.openDisclosures.has(key);
    details.addEventListener("toggle", () => {
      if (details.open) this.openDisclosures.add(key);
      else this.openDisclosures.delete(key);
    });
  }

  private async refresh(): Promise<void> {
    this.localError = null;
    try {
      await this.props.onRefresh();
    } catch (error) {
      this.setLocalError(errorMessage(error));
    }
  }

  private async runIntent(intent: PermissionViewIntent, onSuccess?: () => void): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.localError = null;
    this.renderState(this.props.getModel());
    try {
      await this.props.onIntent(intent);
      onSuccess?.();
    } catch (error) {
      this.localError = errorMessage(error);
    } finally {
      this.saving = false;
      this.renderState(this.props.getModel());
    }
  }
}

function iconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
  return createPageIconButton(parent, icon, label, { className: "chatobby-permissions__icon-btn" });
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function isDecision(value: string): value is FrontendPermissionDecision {
  return value === "allow" || value === "ask" || value === "deny";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
