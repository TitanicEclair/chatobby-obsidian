import { setIcon } from "obsidian";
import type {
  FrontendContextQueryScreenViewModel,
  FrontendContextQueryViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageActionRow,
  createPageIconButton,
  createPageSection,
  createPageState,
  PageShell,
} from "../../../ui/shared/page-shell";

export type ContextQueryViewIntent =
  | { readonly type: "queries.save"; readonly payload: {
      readonly queryId?: string;
      readonly expectedQueryRevision?: number;
      readonly name: string;
      readonly description: string;
      readonly trigger: "session_start" | "every_turn";
    } }
  | { readonly type: "queries.set-enabled"; readonly payload: {
      readonly queryId: string;
      readonly expectedQueryRevision: number;
      readonly enabled: boolean;
      readonly confirmedTrustedCode: boolean;
    } }
  | { readonly type: "queries.delete" | "queries.test"; readonly payload: {
      readonly queryId: string;
      readonly expectedQueryRevision: number;
    } };

interface ContextQueriesViewProps {
  getModel(): FrontendContextQueryScreenViewModel | null;
  subscribe(listener: (model: FrontendContextQueryScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onIntent(intent: ContextQueryViewIntent): Promise<void>;
}

export class ContextQueriesView extends ChatobbyComponent {
  private unsubscribe: (() => void) | null = null;
  private expandedId: string | null = null;
  private creating = false;
  private confirmEnableId: string | null = null;
  private deleteConfirmId: string | null = null;
  private localError: string | null = null;
  private busy = false;
  private shell: PageShell | null = null;
  private addButton: HTMLButtonElement | null = null;
  private refreshButton: HTMLButtonElement | null = null;

  constructor(private readonly props: ContextQueriesViewProps) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-queries";
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    this.shell = new PageShell(container, {
      title: "Queries",
      width: "wide",
      headerClass: "chatobby-queries__header",
      titleClass: "chatobby-queries__title-main",
      actionsClass: "chatobby-queries__header-actions",
      bodyClass: "chatobby-queries__body",
    });
    this.addButton = createPageIconButton(this.shell.actions, "plus", "Add context query");
    this.addButton.addEventListener("click", () => {
      this.creating = true;
      this.expandedId = null;
      this.renderState(this.props.getModel());
    });
    this.refreshButton = createPageIconButton(this.shell.actions, "refresh-cw", "Refresh queries");
    this.refreshButton.addEventListener("click", () => void this.refresh());
    createPageIconButton(this.shell.actions, "x", "Close queries").addEventListener("click", () => this.props.onBack());
    this.unsubscribe = this.props.subscribe((model) => this.renderState(model));
    this.renderState(this.props.getModel());
  }

  override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.destroy();
  }

  focusContainer(): void {
    this.container?.focus();
  }

  setLocalError(error: string | null): void {
    this.localError = error;
    this.renderState(this.props.getModel());
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key !== "Escape" && event.key !== "BrowserBack") return false;
    if (this.deleteConfirmId) this.deleteConfirmId = null;
    else if (this.confirmEnableId) this.confirmEnableId = null;
    else if (this.creating) this.creating = false;
    else if (this.expandedId) this.expandedId = null;
    else return false;
    event.preventDefault();
    this.renderState(this.props.getModel());
    return true;
  }

  private renderState(model: FrontendContextQueryScreenViewModel | null): void {
    const shell = this.shell;
    if (!shell) return;
    const error = this.localError ?? model?.error;
    shell.setTitle("Queries", model?.projectDirectory);
    shell.setBusy(this.busy);
    if (this.addButton) this.addButton.disabled = !model || this.busy;
    this.refreshButton?.toggleClass("is-loading", model?.loading ?? false);
    this.refreshButton?.setAttr("aria-busy", String(model?.loading ?? false));
    shell.setStatus(
      error
        ? { tone: "error", message: error, actionLabel: "Try again", onAction: () => void this.refresh() }
        : model?.statusMessage
          ? { tone: "success", message: model.statusMessage }
          : model && !model.trusted
            ? { tone: "warning", message: "Trust this project before enabling or running query scripts." }
            : null,
    );
    shell.updateBody("queries", (body) => {
      if (!model) {
        createPageState(body, {
          kind: error ? "error" : "loading",
          title: error ? "Project queries are unavailable" : "Loading project queries",
          description: error ? "Check the runtime connection and try again." : "Reading this project's query definitions.",
        });
        return;
      }
      if (this.creating) this.renderEditor(body, null);
      const section = createPageSection(body, {
        title: "Context queries",
        description: "Project-local data that can be added at session start or before each turn.",
        surface: "divided",
      });
      const list = section.content.createDiv({ cls: "chatobby-queries__list" });
      if (model.items.length === 0 && !this.creating) {
        createPageState(list, {
          kind: "empty",
          title: "No context queries yet",
          description: "Create one to add safe, project-specific context when Chatobby works.",
        });
        return;
      }
      for (const item of model.items) this.renderItem(list, item);
    });
  }

  private renderItem(parent: HTMLElement, item: FrontendContextQueryViewModel): void {
    const expanded = this.expandedId === item.id;
    const row = parent.createDiv({ cls: `chatobby-queries__item${expanded ? " is-expanded" : ""}` });
    const summary = row.createDiv({ cls: "chatobby-queries__summary" });
    const open = summary.createEl("button", { cls: "chatobby-queries__summary-open", attr: { type: "button", "aria-expanded": String(expanded) } });
    const disclosure = open.createSpan({ cls: "chatobby-queries__disclosure", attr: { "aria-hidden": "true" } });
    setIcon(disclosure, expanded ? "chevron-down" : "chevron-right");
    const copy = open.createSpan({ cls: "chatobby-queries__summary-copy" });
    copy.createSpan({ cls: "chatobby-queries__item-name", text: item.name });
    copy.createSpan({ cls: "chatobby-queries__item-description", text: item.description || item.timingLabel });
    open.createSpan({ cls: "chatobby-queries__timing", text: item.timingLabel });
    open.addEventListener("click", () => {
      this.expandedId = expanded ? null : item.id;
      this.creating = false;
      this.confirmEnableId = null;
      this.deleteConfirmId = null;
      this.renderState(this.props.getModel());
    });
    const toggle = summary.createEl("button", {
      cls: `chatobby-queries__toggle${item.enabled ? " is-enabled" : ""}`,
      text: item.enabled ? "On" : "Off",
      attr: { type: "button", "aria-pressed": String(item.enabled), title: item.enableDisabledReason ?? "Enable or disable query" },
    });
    toggle.disabled = this.busy || Boolean(item.enableDisabledReason);
    toggle.addEventListener("click", () => {
      if (item.enabled) void this.runIntent({ type: "queries.set-enabled", payload: { queryId: item.id, expectedQueryRevision: item.revision, enabled: false, confirmedTrustedCode: false } });
      else {
        this.confirmEnableId = item.id;
        this.expandedId = item.id;
        this.renderState(this.props.getModel());
      }
    });
    if (expanded) this.renderEditor(row, item);
  }

  private renderEditor(parent: HTMLElement, item: FrontendContextQueryViewModel | null): void {
    const section = item
      ? null
      : createPageSection(parent, {
          title: "New context query",
          description: "Name the information and choose when Chatobby should receive it.",
          surface: "inset",
        });
    const form = (section?.content ?? parent).createDiv({ cls: `chatobby-queries__editor${item ? "" : " is-new"}` });
    const statePrefix = `query:${item?.id ?? "new"}`;
    const name = field(form, "Name", `${statePrefix}:name`);
    name.value = item?.name ?? "";
    name.placeholder = "Current project status";
    const description = field(form, "Description", `${statePrefix}:description`);
    description.value = item?.description ?? "";
    description.placeholder = "What this adds to Chatobby's context";
    const timingLabel = form.createEl("label", { cls: "chatobby-queries__field" });
    timingLabel.createSpan({ text: "When to include it" });
    const timing = timingLabel.createEl("select", { attr: { "data-page-state-key": `${statePrefix}:trigger` } });
    timing.createEl("option", { value: "session_start", text: "At the start of a new session" });
    timing.createEl("option", { value: "every_turn", text: "Before every turn" });
    timing.value = item?.trigger ?? "session_start";
    form.createDiv({
      cls: "chatobby-queries__script-note",
      text: item
        ? "The query's code stays in this project's .chatobby folder and is not shown here."
        : "Chatobby will create the query in this project's .chatobby folder. Its code is not shown here.",
    });
    const actions = createPageActionRow(form, "chatobby-queries__actions");
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => {
      if (item) this.expandedId = null;
      else this.creating = false;
      this.renderState(this.props.getModel());
    });
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save", attr: { type: "button" } });
    save.disabled = this.busy;
    save.addEventListener("click", () => void this.runIntent({
      type: "queries.save",
      payload: {
        queryId: item?.id,
        expectedQueryRevision: item?.revision,
        name: name.value,
        description: description.value,
        trigger: timing.value === "every_turn" ? "every_turn" : "session_start",
      },
    }, () => {
      this.creating = false;
      this.expandedId = null;
    }));
    if (item) this.renderExistingActions(form, item);
  }

  private renderExistingActions(parent: HTMLElement, item: FrontendContextQueryViewModel): void {
    if (this.confirmEnableId === item.id) {
      const confirm = parent.createDiv({ cls: "chatobby-queries__confirm" });
      confirm.createDiv({ text: "Query scripts run as local code and can read files available to your account. Review the main file in the project's query scripts folder first." });
      const row = confirm.createEl("label");
      const checkbox = row.createEl("input", { attr: { type: "checkbox" } });
      row.createSpan({ text: "I reviewed and trust the main script" });
      const enable = confirm.createEl("button", { cls: "mod-cta", text: "Enable", attr: { type: "button" } });
      enable.addEventListener("click", () => {
        if (!checkbox.checked) return this.setLocalError("Review the script and confirm that you trust it before enabling.");
        void this.runIntent({ type: "queries.set-enabled", payload: { queryId: item.id, expectedQueryRevision: item.revision, enabled: true, confirmedTrustedCode: true } }, () => { this.confirmEnableId = null; });
      });
    }
    const secondary = parent.createDiv({ cls: "chatobby-queries__secondary-actions" });
    const test = secondary.createEl("button", { text: "Test", attr: { type: "button" } });
    test.disabled = !item.enabled || this.busy;
    test.title = item.enabled ? "Run this query once" : "Enable the query before testing it";
    test.addEventListener("click", () => void this.runIntent({ type: "queries.test", payload: { queryId: item.id, expectedQueryRevision: item.revision } }));
    secondary.createEl("button", { cls: "chatobby-queries__delete", text: "Delete", attr: { type: "button" } }).addEventListener("click", () => {
      this.deleteConfirmId = item.id;
      this.renderState(this.props.getModel());
    });
    if (item.lastTest) {
      parent.createDiv({
        cls: `chatobby-queries__test-result is-${item.lastTest.status}`,
        text: `${item.lastTest.status === "succeeded" ? "Tested" : "Test failed"} · ${item.lastTest.durationMs} ms · ${item.lastTest.summary}`,
      });
    }
    if (this.deleteConfirmId === item.id) {
      const confirm = parent.createDiv({ cls: "chatobby-queries__confirm is-danger" });
      confirm.createDiv({ text: "Delete this query and its script folder?" });
      confirm.createEl("button", { cls: "mod-warning", text: "Delete query", attr: { type: "button" } }).addEventListener("click", () => void this.runIntent({ type: "queries.delete", payload: { queryId: item.id, expectedQueryRevision: item.revision } }, () => {
        this.deleteConfirmId = null;
        this.expandedId = null;
      }));
    }
  }

  private async refresh(): Promise<void> {
    this.localError = null;
    try {
      await this.props.onRefresh();
    } catch (error) {
      this.setLocalError(errorMessage(error));
    }
  }

  private async runIntent(intent: ContextQueryViewIntent, onSuccess?: () => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.localError = null;
    this.renderState(this.props.getModel());
    try {
      await this.props.onIntent(intent);
      onSuccess?.();
    } catch (error) {
      this.localError = errorMessage(error);
    } finally {
      this.busy = false;
      this.renderState(this.props.getModel());
    }
  }
}

function field(parent: HTMLElement, label: string, key: string): HTMLInputElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-queries__field" });
  wrapper.createSpan({ text: label });
  return wrapper.createEl("input", { attr: { "data-page-state-key": key } });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
