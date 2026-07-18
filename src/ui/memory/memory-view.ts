import { setIcon } from "obsidian";
import type {
  FrontendMemoryFilter,
  FrontendMemoryRecordViewModel,
  FrontendMemoryScreenViewModel,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../shared/component";
import {
  createPageHeader,
  createPageIconButton,
  createPageTab,
  createPageTabs,
} from "../shared/page-shell";

/** Compatibility action emitted by older extension panels. */
export type MemoryActionId = "memory:insights";
export type MemoryTab = "memories" | "suggestions" | "settings";

export type MemoryViewIntent =
  | { readonly type: "memory.set-view"; readonly payload: { readonly filter: FrontendMemoryFilter; readonly query: string } }
  | { readonly type: "memory.create"; readonly payload: { readonly target: "user" | "memory" | "project" | "failure"; readonly content: string } }
  | { readonly type: "memory.update"; readonly payload: { readonly recordId: string; readonly expectedRecordRevision: number; readonly content: string } }
  | { readonly type: "memory.set-status"; readonly payload: { readonly recordId: string; readonly expectedRecordRevision: number; readonly status: "active" | "archived" } }
  | { readonly type: "memory.delete"; readonly payload: { readonly recordId: string; readonly expectedRecordRevision: number } }
  | { readonly type: "memory.decide-candidate"; readonly payload: { readonly candidateId: string; readonly decision: "approve" | "reject" } }
  | { readonly type: "memory.update-policy"; readonly payload: {
      readonly backgroundLearning?: "off" | "suggest" | "auto";
      readonly correctionLearning?: "off" | "suggest" | "auto";
      readonly promptRouting?: "off" | "profile-project" | "hybrid";
      readonly isolateCurrentProject?: boolean;
    } }
  | { readonly type: "memory.import-markdown" | "memory.export-markdown"; readonly payload: Record<string, never> };

export interface MemoryViewProps {
  getModel(): FrontendMemoryScreenViewModel | null;
  subscribe(listener: (model: FrontendMemoryScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onIntent(intent: MemoryViewIntent): Promise<void>;
}

export function isMemoryActionId(value: string): value is MemoryActionId {
  return value === "memory:insights";
}

/** Native Obsidian renderer for the runtime-owned memory read model. */
export class MemoryView extends ChatobbyComponent {
  private unsubscribe: (() => void) | null = null;
  private tab: MemoryTab = "memories";
  private selectedRecordId: string | null = null;
  private selectedIndex = 0;
  private creating = false;
  private editing = false;
  private deleteConfirmId: string | null = null;
  private localError: string | null = null;
  private busy = false;

  constructor(private readonly props: MemoryViewProps) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-memory-view";
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

  async refresh(): Promise<void> {
    this.localError = null;
    this.renderState(this.props.getModel());
    try {
      await this.props.onRefresh();
    } catch (error) {
      this.setLocalError(errorMessage(error));
    }
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key === "Escape" || event.key === "BrowserBack") {
      if (this.deleteConfirmId) this.deleteConfirmId = null;
      else if (this.editing) this.editing = false;
      else if (this.selectedRecordId) this.selectedRecordId = null;
      else return false;
      event.preventDefault();
      this.renderState(this.props.getModel());
      return true;
    }
    if (this.tab !== "memories" || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return false;
    const records = this.props.getModel()?.records ?? [];
    if (records.length === 0) return false;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    this.selectedIndex = (this.selectedIndex + delta + records.length) % records.length;
    this.selectedRecordId = records[this.selectedIndex]?.id ?? null;
    this.renderState(this.props.getModel());
    this.container?.querySelector<HTMLElement>(".chatobby-memory__record.is-active .chatobby-memory__record-summary")?.focus();
    return true;
  }

  runActionById(actionId: MemoryActionId): void {
    if (isMemoryActionId(actionId)) void this.refresh();
  }

  private renderState(model: FrontendMemoryScreenViewModel | null): void {
    const container = this.container;
    if (!container) return;
    const previousBody = container.querySelector<HTMLElement>(".chatobby-memory__body");
    const previousScrollTop = previousBody?.dataset.memoryTab === this.tab ? previousBody.scrollTop : null;
    container.empty();
    this.renderHeader(container, model);
    this.renderTabs(container, model);
    const body = container.createDiv({ cls: "chatobby-page__body chatobby-memory__body" });
    body.dataset.memoryTab = this.tab;
    const error = this.localError ?? model?.error;
    if (error) renderNotice(body, error, true);
    if (!model) {
      renderState(body, this.localError ? "alert-circle" : "loader-circle", this.localError ? "Memory is unavailable." : "Loading memory…", Boolean(this.localError));
      if (previousScrollTop !== null) body.scrollTop = previousScrollTop;
      return;
    }
    if (model.statusMessage) renderNotice(body, model.statusMessage, false);
    this.ensureSelection(model.records);
    if (this.tab === "memories") this.renderMemories(body, model);
    else if (this.tab === "suggestions") this.renderSuggestions(body, model);
    else this.renderSettings(body, model);
    if (previousScrollTop !== null) body.scrollTop = previousScrollTop;
  }

  private renderHeader(container: HTMLElement, model: FrontendMemoryScreenViewModel | null): void {
    const { actions } = createPageHeader(container, {
      title: "Memory",
      headerClass: "chatobby-memory__header",
      titleClass: "chatobby-memory__title-main",
      actionsClass: "chatobby-memory__header-actions",
    });
    const refresh = createPageIconButton(actions, "refresh-cw", "Refresh memory");
    refresh.toggleClass("is-loading", model?.loading ?? false);
    refresh.setAttr("aria-busy", String(model?.loading ?? false));
    refresh.addEventListener("click", () => void this.refresh());
    createPageIconButton(actions, "x", "Close memory").addEventListener("click", () => this.props.onBack());
  }

  private renderTabs(parent: HTMLElement, model: FrontendMemoryScreenViewModel | null): void {
    const tabs = createPageTabs(parent, "chatobby-memory__tabs");
    const options: readonly { id: MemoryTab; label: string; count?: number }[] = [
      { id: "memories", label: "Memories" },
      { id: "suggestions", label: "Suggestions", count: model?.candidates.length },
      { id: "settings", label: "Settings" },
    ];
    for (const option of options) {
      const button = createPageTab(tabs, {
        label: option.label,
        active: this.tab === option.id,
        count: option.count,
        countClass: "chatobby-memory__tab-count",
      });
      button.addEventListener("click", () => {
        this.tab = option.id;
        this.renderState(this.props.getModel());
      });
    }
  }

  private renderMemories(parent: HTMLElement, model: FrontendMemoryScreenViewModel): void {
    const toolbar = parent.createDiv({ cls: "chatobby-memory__toolbar" });
    const search = toolbar.createDiv({ cls: "chatobby-memory__search" });
    setIcon(search.createSpan(), "search");
    const input = search.createEl("input", {
      cls: "chatobby-memory__search-input",
      attr: { type: "search", placeholder: "Search memory", "aria-label": "Search memory" },
    });
    input.value = model.query;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") void this.runIntent({ type: "memory.set-view", payload: { filter: model.filter, query: input.value } });
    });
    input.addEventListener("input", () => {
      if (!input.value && model.query) void this.runIntent({ type: "memory.set-view", payload: { filter: model.filter, query: "" } });
    });
    const add = toolbar.createEl("button", { cls: "mod-cta", attr: { type: "button" } });
    setIcon(add.createSpan(), "plus");
    add.createSpan({ text: "Add" });
    add.addEventListener("click", () => {
      this.creating = !this.creating;
      this.renderState(this.props.getModel());
    });
    if (this.creating) this.renderCreate(parent, model);

    const filters = parent.createDiv({ cls: "chatobby-memory__filters" });
    for (const option of model.filters) {
      const button = filters.createEl("button", {
        cls: option.selected ? "is-active" : undefined,
        text: option.label,
        attr: { type: "button", "aria-pressed": String(option.selected) },
      });
      button.addEventListener("click", () => {
        this.selectedRecordId = null;
        void this.runIntent({ type: "memory.set-view", payload: { filter: option.id, query: model.query } });
      });
    }
    if (model.searchResultCount !== undefined) {
      parent.createDiv({ cls: "chatobby-memory__result-summary", text: `Search results · ${model.searchResultCount}` });
    }
    this.renderRecords(parent, model);
  }

  private renderCreate(parent: HTMLElement, model: FrontendMemoryScreenViewModel): void {
    const form = parent.createDiv({ cls: "chatobby-memory__create" });
    form.createDiv({ cls: "chatobby-memory__form-title", text: "Add something worth remembering" });
    const target = form.createEl("select", { attr: { "aria-label": "Memory location" } });
    for (const option of model.createTargets) {
      const element = target.createEl("option", { value: option.value, text: option.label });
      element.disabled = Boolean(option.disabledReason);
      if (option.disabledReason) element.title = option.disabledReason;
    }
    const content = form.createEl("textarea", {
      attr: { placeholder: "A durable preference, fact, convention, or lesson…", "aria-label": "Memory content" },
    });
    const actions = form.createDiv({ cls: "chatobby-memory__form-actions" });
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => {
      this.creating = false;
      this.renderState(this.props.getModel());
    });
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save memory", attr: { type: "button" } });
    save.disabled = this.busy;
    save.addEventListener("click", () => {
      const value = target.value;
      if (!isMemoryTarget(value)) return;
      if (!content.value.trim()) return this.setLocalError("Memory content cannot be empty.");
      void this.runIntent({ type: "memory.create", payload: { target: value, content: content.value } }, () => { this.creating = false; });
    });
  }

  private renderRecords(parent: HTMLElement, model: FrontendMemoryScreenViewModel): void {
    const list = parent.createDiv({ cls: "chatobby-memory__records", attr: { role: "list" } });
    if (model.records.length === 0) {
      list.createDiv({ cls: "chatobby-memory__empty", text: model.filter === "archived" ? "No archived memories in this boundary." : "No matching memories yet." });
      return;
    }
    model.records.forEach((record, index) => {
      const expanded = record.id === this.selectedRecordId;
      const item = list.createDiv({ cls: `chatobby-memory__record${expanded ? " is-active" : ""}`, attr: { role: "listitem" } });
      const button = item.createEl("button", {
        cls: "chatobby-memory__record-summary",
        attr: { type: "button", "aria-expanded": String(expanded), "data-record-id": record.id },
      });
      setIcon(button.createSpan({ cls: "chatobby-memory__record-icon" }), record.iconToken);
      const category = button.createSpan({ cls: "chatobby-memory__record-category" });
      category.createSpan({ cls: "chatobby-memory__record-label", text: record.label });
      if (record.stateLabel) category.createSpan({ cls: "chatobby-memory__record-state", text: record.stateLabel });
      button.createSpan({ cls: "chatobby-memory__record-divider", attr: { "aria-hidden": "true" } });
      button.createSpan({ cls: "chatobby-memory__record-content", text: record.content });
      button.addEventListener("click", () => {
        this.selectedIndex = index;
        this.selectedRecordId = expanded ? null : record.id;
        this.editing = false;
        this.deleteConfirmId = null;
        this.renderState(this.props.getModel());
        const buttons = this.container?.querySelectorAll<HTMLButtonElement>(".chatobby-memory__record-summary");
        const nextButton = buttons
          ? Array.from(buttons).find((candidate) => candidate.dataset.recordId === record.id)
          : undefined;
        nextButton?.focus({ preventScroll: true });
      });
      if (expanded) this.renderDetail(item, record);
    });
  }

  private renderDetail(parent: HTMLElement, record: FrontendMemoryRecordViewModel): void {
    const detail = parent.createDiv({ cls: "chatobby-memory__detail" });
    const title = detail.createDiv({ cls: "chatobby-memory__detail-header" }).createDiv();
    title.createDiv({ cls: "chatobby-memory__detail-label", text: record.label });
    title.createDiv({ cls: "chatobby-memory__detail-source", text: record.provenanceLabel });
    if (this.editing) this.renderEditor(detail, record);
    else detail.createDiv({ cls: "chatobby-memory__detail-content", text: record.content });
    const facts = detail.createDiv({ cls: "chatobby-memory__detail-facts" });
    facts.createSpan({ text: `Updated ${new Date(record.updatedAt).toLocaleDateString()}` });
    facts.createSpan({ text: record.sensitivityLabel });

    if (this.deleteConfirmId === record.id) this.renderDeleteConfirmation(detail, record);
    else this.renderRecordActions(detail, record);
    const advanced = detail.createEl("details", { cls: "chatobby-memory__advanced" });
    advanced.createEl("summary", { text: "History and technical details" });
    for (const line of record.technicalLines) advanced.createDiv({ text: line });
  }

  private renderEditor(parent: HTMLElement, record: FrontendMemoryRecordViewModel): void {
    const editor = parent.createEl("textarea", { cls: "chatobby-memory__editor", attr: { "aria-label": "Edit memory" } });
    editor.value = record.content;
    const save = parent.createEl("button", { cls: "mod-cta", text: "Save changes", attr: { type: "button" } });
    save.disabled = this.busy;
    save.addEventListener("click", () => void this.runIntent({
      type: "memory.update",
      payload: { recordId: record.id, expectedRecordRevision: record.revision, content: editor.value },
    }, () => { this.editing = false; }));
  }

  private renderRecordActions(parent: HTMLElement, record: FrontendMemoryRecordViewModel): void {
    const actions = parent.createDiv({ cls: "chatobby-memory__detail-actions" });
    if (record.availableActions.includes("edit")) {
      actions.createEl("button", { text: "Edit", attr: { type: "button" } }).addEventListener("click", () => {
        this.editing = true;
        this.renderState(this.props.getModel());
      });
    }
    if (record.availableActions.includes("archive")) {
      const archive = actions.createEl("button", { text: "Archive", attr: { type: "button" } });
      archive.disabled = this.busy;
      archive.addEventListener("click", () => void this.runIntent({
        type: "memory.set-status",
        payload: { recordId: record.id, expectedRecordRevision: record.revision, status: "archived" },
      }));
    }
    if (record.availableActions.includes("restore")) {
      const restore = actions.createEl("button", { text: "Restore", attr: { type: "button" } });
      restore.disabled = this.busy;
      restore.addEventListener("click", () => void this.runIntent({
        type: "memory.set-status",
        payload: { recordId: record.id, expectedRecordRevision: record.revision, status: "active" },
      }));
    }
    if (record.availableActions.includes("delete")) {
      actions.createEl("button", { cls: "chatobby-memory__danger-link", text: "Delete permanently", attr: { type: "button" } }).addEventListener("click", () => {
        this.deleteConfirmId = record.id;
        this.renderState(this.props.getModel());
      });
    }
  }

  private renderDeleteConfirmation(parent: HTMLElement, record: FrontendMemoryRecordViewModel): void {
    const confirmation = parent.createDiv({ cls: "chatobby-memory__delete-confirm" });
    confirmation.createDiv({ cls: "chatobby-memory__delete-title", text: "Delete this memory permanently?" });
    confirmation.createDiv({ text: "This erases memory-owned copies and cannot be undone. Original chat transcripts are not changed." });
    const actions = confirmation.createDiv({ cls: "chatobby-memory__form-actions" });
    actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => {
      this.deleteConfirmId = null;
      this.renderState(this.props.getModel());
    });
    const remove = actions.createEl("button", { cls: "mod-warning", text: "Delete permanently", attr: { type: "button" } });
    remove.disabled = this.busy;
    remove.addEventListener("click", () => void this.runIntent({
      type: "memory.delete",
      payload: { recordId: record.id, expectedRecordRevision: record.revision },
    }, () => {
      this.deleteConfirmId = null;
      this.selectedRecordId = null;
    }));
  }

  private renderSuggestions(parent: HTMLElement, model: FrontendMemoryScreenViewModel): void {
    const intro = parent.createDiv({ cls: "chatobby-memory__section-intro" });
    intro.createDiv({ cls: "chatobby-memory__section-title", text: "Review before Chatobby remembers" });
    intro.createDiv({ text: "Suggestions are inferred from conversations and remain inactive until approved." });
    if (model.candidates.length === 0) {
      parent.createDiv({ cls: "chatobby-memory__empty-card", text: "No memory suggestions are waiting for review." });
      return;
    }
    const list = parent.createDiv({ cls: "chatobby-memory__suggestions" });
    for (const candidate of model.candidates) {
      const card = list.createDiv({ cls: "chatobby-memory__suggestion" });
      card.createDiv({ cls: "chatobby-memory__suggestion-label", text: candidate.actionLabel });
      card.createDiv({ cls: "chatobby-memory__suggestion-content", text: candidate.content });
      if (candidate.reason) card.createDiv({ cls: "chatobby-memory__suggestion-reason", text: candidate.reason });
      const actions = card.createDiv({ cls: "chatobby-memory__form-actions" });
      actions.createEl("button", { text: "Dismiss", attr: { type: "button" } }).addEventListener("click", () => void this.runIntent({
        type: "memory.decide-candidate",
        payload: { candidateId: candidate.id, decision: "reject" },
      }));
      actions.createEl("button", { cls: "mod-cta", text: "Approve", attr: { type: "button" } }).addEventListener("click", () => void this.runIntent({
        type: "memory.decide-candidate",
        payload: { candidateId: candidate.id, decision: "approve" },
      }));
    }
  }

  private renderSettings(parent: HTMLElement, model: FrontendMemoryScreenViewModel): void {
    const boundary = parent.createDiv({ cls: "chatobby-memory__settings-card" });
    boundary.createDiv({ cls: "chatobby-memory__settings-title", text: "Project boundary" });
    boundary.createDiv({ cls: "chatobby-memory__settings-copy", text: model.projectBoundary.description });
    const boundaryRow = boundary.createDiv({ cls: "chatobby-memory__setting-row" });
    const boundaryCopy = boundaryRow.createDiv({ cls: "chatobby-memory__setting-copy" });
    boundaryCopy.createDiv({ cls: "chatobby-memory__setting-label", text: "Isolate this project" });
    boundaryCopy.createDiv({ cls: "chatobby-memory__setting-description", text: "Vault profile and vault memory remain available." });
    const toggle = boundaryRow.createEl("input", { attr: { type: "checkbox", "aria-label": "Isolate this project" } });
    toggle.checked = model.projectBoundary.checked;
    toggle.disabled = Boolean(model.projectBoundary.disabledReason) || this.busy;
    if (model.projectBoundary.disabledReason) toggle.title = model.projectBoundary.disabledReason;
    toggle.addEventListener("change", () => void this.runIntent({
      type: "memory.update-policy",
      payload: { isolateCurrentProject: toggle.checked },
    }));

    const learning = parent.createDiv({ cls: "chatobby-memory__settings-card" });
    learning.createDiv({ cls: "chatobby-memory__settings-title", text: "Learning" });
    learning.createDiv({ cls: "chatobby-memory__settings-copy", text: "Choose when Chatobby may learn from conversations. Suggestions remain reviewable before they become active memory." });
    for (const setting of model.learningSettings) {
      const row = learning.createDiv({ cls: "chatobby-memory__setting-row" });
      const copy = row.createDiv({ cls: "chatobby-memory__setting-copy" });
      copy.createDiv({ cls: "chatobby-memory__setting-label", text: setting.title });
      copy.createDiv({ cls: "chatobby-memory__setting-description", text: setting.description });
      const select = row.createEl("select", { attr: { "aria-label": setting.title } });
      for (const option of setting.options) {
        const element = select.createEl("option", { value: option.value, text: option.label });
        element.disabled = Boolean(option.disabledReason);
      }
      select.value = setting.value;
      select.disabled = this.busy;
      select.addEventListener("change", () => void this.updateLearningSetting(setting.id, select.value));
    }

    const storage = parent.createDiv({ cls: "chatobby-memory__settings-card" });
    storage.createDiv({ cls: "chatobby-memory__settings-title", text: "Storage and Markdown" });
    storage.createDiv({ cls: "chatobby-memory__settings-copy", text: model.storage.description });
    const storageActions = storage.createDiv({ cls: "chatobby-memory__storage-actions" });
    storageActions.createEl("button", { text: "Import Markdown changes", attr: { type: "button" } }).addEventListener("click", () => void this.runIntent({ type: "memory.import-markdown", payload: {} }));
    storageActions.createEl("button", { text: "Refresh Markdown copy", attr: { type: "button" } }).addEventListener("click", () => void this.runIntent({ type: "memory.export-markdown", payload: {} }));
    const paths = storage.createEl("details", { cls: "chatobby-memory__advanced" });
    paths.createEl("summary", { text: "Where memory is stored" });
    for (const line of model.storage.technicalLines) paths.createDiv({ text: line });

    const help = parent.createDiv({ cls: "chatobby-memory__settings-card" });
    help.createDiv({ cls: "chatobby-memory__settings-title", text: "How memory behaves" });
    const list = help.createEl("ul", { cls: "chatobby-memory__help-list" });
    for (const item of model.helpItems) list.createEl("li", { text: item });
  }

  private async updateLearningSetting(
    id: FrontendMemoryScreenViewModel["learningSettings"][number]["id"],
    value: string,
  ): Promise<void> {
    if (id === "promptRouting") {
      if (value !== "off" && value !== "profile-project" && value !== "hybrid") return;
      return this.runIntent({ type: "memory.update-policy", payload: { promptRouting: value } });
    }
    if (value !== "off" && value !== "suggest" && value !== "auto") return;
    return this.runIntent({
      type: "memory.update-policy",
      payload: id === "backgroundLearning" ? { backgroundLearning: value } : { correctionLearning: value },
    });
  }

  private async runIntent(intent: MemoryViewIntent, onSuccess?: () => void): Promise<void> {
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

  private ensureSelection(records: readonly FrontendMemoryRecordViewModel[]): void {
    if (!this.selectedRecordId) {
      this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, records.length - 1));
      return;
    }
    const existing = records.findIndex((record) => record.id === this.selectedRecordId);
    if (existing >= 0) this.selectedIndex = existing;
    else this.selectedRecordId = null;
  }
}

function renderState(parent: HTMLElement, iconName: string, text: string, error = false): void {
  const state = parent.createDiv({ cls: `chatobby-memory__state${error ? " is-error" : ""}` });
  setIcon(state.createDiv(), iconName);
  state.createDiv({ text });
}

function renderNotice(parent: HTMLElement, text: string, error: boolean): void {
  const notice = parent.createDiv({ cls: `chatobby-memory__notice${error ? " is-error" : ""}` });
  setIcon(notice.createSpan(), error ? "triangle-alert" : "check-circle-2");
  notice.createSpan({ text });
}

function isMemoryTarget(value: string): value is "user" | "memory" | "project" | "failure" {
  return value === "user" || value === "memory" || value === "project" || value === "failure";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
