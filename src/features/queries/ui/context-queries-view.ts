import { setIcon } from "obsidian";
import type {
  FrontendContextQueryScreenViewModel,
  FrontendContextQueryViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { createPageHeader, createPageIconButton } from "../../../ui/shared/page-shell";

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

  constructor(private readonly props: ContextQueriesViewProps) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-queries";
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
    const container = this.container;
    if (!container) return;
    container.empty();
    this.renderHeader(container, model);
    const body = container.createDiv({ cls: "chatobby-page__body chatobby-queries__body" });
    const error = this.localError ?? model?.error;
    if (error) renderNotice(body, error, true);
    if (!model) {
      renderEmpty(body, error ? "alert-circle" : "loader-circle", error ? "Project queries are unavailable." : "Loading project queries…");
      return;
    }
    if (model.statusMessage) renderNotice(body, model.statusMessage, false);
    body.createDiv({ cls: "chatobby-queries__project", text: model.projectDirectory });
    if (!model.trusted) renderNotice(body, "Trust this project before enabling or running query scripts.", true);
    if (this.creating) this.renderEditor(body, null);
    const list = body.createDiv({ cls: "chatobby-queries__list" });
    if (model.items.length === 0 && !this.creating) {
      renderEmpty(list, "braces", "No context queries in this project yet.");
      return;
    }
    for (const item of model.items) this.renderItem(list, item);
  }

  private renderHeader(container: HTMLElement, model: FrontendContextQueryScreenViewModel | null): void {
    const { actions } = createPageHeader(container, {
      title: "Queries",
      headerClass: "chatobby-queries__header",
      titleClass: "chatobby-queries__title-main",
      actionsClass: "chatobby-queries__header-actions",
    });
    const add = createPageIconButton(actions, "plus", "Add context query");
    add.disabled = !model || this.busy;
    add.addEventListener("click", () => {
      this.creating = true;
      this.expandedId = null;
      this.renderState(this.props.getModel());
    });
    const refresh = createPageIconButton(actions, "refresh-cw", "Refresh queries");
    refresh.toggleClass("is-loading", model?.loading ?? false);
    refresh.setAttr("aria-busy", String(model?.loading ?? false));
    refresh.addEventListener("click", () => void this.refresh());
    createPageIconButton(actions, "x", "Close queries").addEventListener("click", () => this.props.onBack());
  }

  private renderItem(parent: HTMLElement, item: FrontendContextQueryViewModel): void {
    const expanded = this.expandedId === item.id;
    const row = parent.createDiv({ cls: `chatobby-queries__item${expanded ? " is-expanded" : ""}` });
    const summary = row.createDiv({ cls: "chatobby-queries__summary" });
    const open = summary.createEl("button", { cls: "chatobby-queries__summary-open", attr: { type: "button", "aria-expanded": String(expanded) } });
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
    const form = parent.createDiv({ cls: `chatobby-queries__editor${item ? "" : " is-new"}` });
    const name = field(form, "Name", "input") as HTMLInputElement;
    name.value = item?.name ?? "";
    name.placeholder = "Current project status";
    const description = field(form, "Description", "input") as HTMLInputElement;
    description.value = item?.description ?? "";
    description.placeholder = "What this adds to Chatobby's context";
    const timingLabel = form.createEl("label", { cls: "chatobby-queries__field" });
    timingLabel.createSpan({ text: "When to include it" });
    const timing = timingLabel.createEl("select");
    timing.createEl("option", { value: "session_start", text: "At the start of a new session" });
    timing.createEl("option", { value: "every_turn", text: "Before every turn" });
    timing.value = item?.trigger ?? "session_start";
    form.createDiv({
      cls: "chatobby-queries__script-note",
      text: item
        ? "The script is stored in this project's query scripts folder. Source code is intentionally kept out of this page."
        : "Chatobby will create a project-local script folder with a main file. Source code is intentionally kept out of this page.",
    });
    const actions = form.createDiv({ cls: "chatobby-queries__actions" });
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

function field(parent: HTMLElement, label: string, type: "input"): HTMLInputElement {
  const wrapper = parent.createEl("label", { cls: "chatobby-queries__field" });
  wrapper.createSpan({ text: label });
  return wrapper.createEl(type);
}

function renderNotice(parent: HTMLElement, text: string, error: boolean): void {
  const notice = parent.createDiv({ cls: `chatobby-queries__notice${error ? " is-error" : ""}` });
  setIcon(notice.createSpan(), error ? "triangle-alert" : "check-circle-2");
  notice.createSpan({ text });
}

function renderEmpty(parent: HTMLElement, icon: string, text: string): void {
  const empty = parent.createDiv({ cls: "chatobby-queries__empty" });
  setIcon(empty.createDiv(), icon);
  empty.createDiv({ text });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
