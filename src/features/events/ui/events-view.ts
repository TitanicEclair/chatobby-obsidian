import { setIcon } from "obsidian";
import type {
  FrontendEventDefinitionViewModel,
  FrontendEventEditorViewModel,
  FrontendEventOccurrenceViewModel,
  FrontendEventScreenViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageHeader,
  createPageIconButton,
  createPageTab,
  createPageTabs,
} from "../../../ui/shared/page-shell";

type EventsTab = "automations" | "history";

export type EventViewIntent =
  | { readonly type: "events.begin-edit"; readonly payload: { readonly definitionId?: string } }
  | { readonly type: "events.cancel-edit"; readonly payload: Record<string, never> }
  | { readonly type: "events.set-editor-project"; readonly payload: { readonly projectPath: string } }
  | { readonly type: "events.save"; readonly payload: {
      readonly definitionId?: string;
      readonly expectedDefinitionRevision?: number;
      readonly name: string;
      readonly description: string;
      readonly projectPath: string;
      readonly permissionProfileId: string;
      readonly agentId: string;
      readonly enabled: boolean;
      readonly triggerKind: "schedule" | "filesystem" | "command";
      readonly triggerValue: string;
      readonly scheduleStartAt: string;
      readonly scheduleRepeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
      readonly scheduleInterval: number;
      readonly scheduleWeekdays: readonly number[];
      readonly scheduleEnd: "never" | "on" | "after";
      readonly scheduleEndDate: string;
      readonly scheduleEndOccurrences: number;
      readonly triggerRecursive: boolean;
      readonly triggerDebounceMs: number;
      readonly prompt: string;
      readonly requireApproval: boolean;
      readonly allowWhenViewClosed: boolean;
      readonly backgroundConsent: boolean;
      readonly maxRunsPerDay: number;
      readonly maxRuntimeMinutes: number;
    } }
  | { readonly type: "events.delete"; readonly payload: { readonly definitionId: string; readonly expectedDefinitionRevision: number } }
  | { readonly type: "events.set-enabled"; readonly payload: { readonly definitionId: string; readonly expectedDefinitionRevision: number; readonly enabled: boolean } }
  | { readonly type: "events.trigger"; readonly payload: { readonly definitionId: string } }
  | { readonly type: "events.approve"; readonly payload: { readonly occurrenceId: string } };

export interface EventsViewProps {
  getModel(): FrontendEventScreenViewModel | null;
  subscribe(listener: (model: FrontendEventScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onIntent(intent: EventViewIntent): Promise<void>;
}

interface EditorDraft {
  definitionId?: string;
  expectedRevision?: number;
  name: string;
  description: string;
  projectPath: string;
  permissionProfileId: string;
  agentId: string;
  enabled: boolean;
  triggerKind: "schedule" | "filesystem" | "command";
  triggerValue: string;
  scheduleStartAt: string;
  scheduleRepeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
  scheduleInterval: number;
  scheduleWeekdays: number[];
  scheduleEnd: "never" | "on" | "after";
  scheduleEndDate: string;
  scheduleEndOccurrences: number;
  triggerRecursive: boolean;
  triggerDebounceMs: number;
  prompt: string;
  requireApproval: boolean;
  allowWhenViewClosed: boolean;
  backgroundConsent: boolean;
  maxRunsPerDay: number;
  maxRuntimeMinutes: number;
}

/** Native renderer for runtime-owned event definitions, allocation options, and live history. */
export class EventsView extends ChatobbyComponent {
  private unsubscribe: (() => void) | null = null;
  private tab: EventsTab = "automations";
  private deleteConfirmId: string | null = null;
  private localError: string | null = null;
  private busy = false;
  private editorKey: string | null = null;
  private draft: EditorDraft | null = null;

  constructor(private readonly props: EventsViewProps) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-events";
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
    if (this.props.getModel()?.editor) {
      event.preventDefault();
      void this.runIntent({ type: "events.cancel-edit", payload: {} }, () => this.clearDraft());
      return true;
    }
    if (this.deleteConfirmId) {
      event.preventDefault();
      this.deleteConfirmId = null;
      this.renderState(this.props.getModel());
      return true;
    }
    return false;
  }

  private renderState(model: FrontendEventScreenViewModel | null): void {
    const container = this.container;
    if (!container) return;
    container.empty();
    const { actions } = createPageHeader(container, {
      title: "Events",
      headerClass: "chatobby-events__header",
      titleClass: "chatobby-events__title",
      actionsClass: "chatobby-events__header-actions",
    });
    const refresh = createPageIconButton(actions, "refresh-cw", "Refresh events");
    refresh.toggleClass("is-loading", model?.loading ?? false);
    refresh.addEventListener("click", () => void this.refresh());
    createPageIconButton(actions, "x", "Close events").addEventListener("click", () => this.props.onBack());

    const tabs = createPageTabs(container, "chatobby-events__tabs");
    this.renderTab(tabs, "automations", "Automations");
    this.renderTab(tabs, "history", "History", model?.pendingApprovalCount ?? 0);
    const error = this.localError ?? model?.error;
    if (error) container.createDiv({ cls: "chatobby-events__notice is-error", text: error });
    else if (model?.statusMessage) container.createDiv({ cls: "chatobby-events__notice", text: model.statusMessage });
    const body = container.createDiv({ cls: "chatobby-page__body chatobby-events__body" });
    if (!model) {
      body.createDiv({ cls: "chatobby-events__empty", text: error ? "Events are unavailable." : "Loading events…" });
      return;
    }
    if (model.editor) this.renderEditor(body, model.editor);
    else if (this.tab === "automations") this.renderDefinitions(body, model);
    else this.renderHistory(body, model);
  }

  private renderTab(parent: HTMLElement, id: EventsTab, label: string, count = 0): void {
    const active = this.tab === id;
    const button = createPageTab(parent, {
      label,
      active,
      className: "chatobby-events__tab",
      count,
      countClass: "chatobby-events__count",
    });
    button.addEventListener("click", () => {
      this.tab = id;
      this.renderState(this.props.getModel());
    });
  }

  private renderDefinitions(body: HTMLElement, model: FrontendEventScreenViewModel): void {
    const intro = body.createDiv({ cls: "chatobby-events__intro" });
    const copy = intro.createDiv();
    copy.createEl("strong", { text: "Automation that remains understandable" });
    copy.createDiv({ text: "Each event has a project, agent, permission policy, trigger, execution budget, and inspectable history." });
    intro.createEl("button", { cls: "mod-cta", text: "New event", attr: { type: "button" } }).addEventListener("click", () => {
      void this.runIntent({ type: "events.begin-edit", payload: {} });
    });
    if (model.definitions.length === 0) {
      const empty = body.createDiv({ cls: "chatobby-events__empty" });
      setIcon(empty.createSpan(), "calendar-clock");
      empty.createEl("strong", { text: "No events yet" });
      empty.createDiv({ text: "Create a schedule, watch a vault path, or expose a named command trigger." });
      return;
    }
    const list = body.createDiv({ cls: "chatobby-events__list" });
    for (const definition of model.definitions) this.renderDefinition(list, definition);
  }

  private renderDefinition(parent: HTMLElement, definition: FrontendEventDefinitionViewModel): void {
    const card = parent.createDiv({ cls: `chatobby-events__card${definition.enabled ? "" : " is-disabled"}` });
    setIcon(card.createDiv({ cls: "chatobby-events__card-icon" }), definition.iconToken);
    const copy = card.createDiv({ cls: "chatobby-events__card-copy" });
    const title = copy.createDiv({ cls: "chatobby-events__card-title" });
    title.createEl("strong", { text: definition.name });
    title.createSpan({ cls: `chatobby-events__badge${definition.running ? " is-running" : ""}`, text: definition.statusLabel });
    copy.createDiv({ cls: "chatobby-events__trigger", text: definition.triggerLabel });
    if (definition.description) copy.createDiv({ cls: "chatobby-events__description", text: definition.description });
    const policy = copy.createDiv({ cls: "chatobby-events__policy" });
    for (const label of [definition.projectLabel, definition.permissionLabel, definition.agentLabel, definition.approvalLabel, definition.budgetLabel]) {
      policy.createSpan({ text: label });
    }
    const actions = card.createDiv({ cls: "chatobby-events__card-actions" });
    const toggle = iconButton(actions, definition.enabled ? "pause" : "play", definition.enabled ? "Pause event" : "Enable event");
    toggle.disabled = this.busy;
    toggle.addEventListener("click", () => void this.runIntent({
      type: "events.set-enabled",
      payload: { definitionId: definition.id, expectedDefinitionRevision: definition.revision, enabled: !definition.enabled },
    }));
    const run = iconButton(actions, "play-circle", "Run now");
    run.disabled = !definition.canRun || this.busy;
    run.addEventListener("click", () => void this.runIntent({ type: "events.trigger", payload: { definitionId: definition.id } }, () => { this.tab = "history"; }));
    iconButton(actions, "pencil", "Edit event").addEventListener("click", () => void this.runIntent({ type: "events.begin-edit", payload: { definitionId: definition.id } }));
  }

  private renderHistory(body: HTMLElement, model: FrontendEventScreenViewModel): void {
    if (model.occurrences.length === 0) {
      const empty = body.createDiv({ cls: "chatobby-events__empty" });
      setIcon(empty.createSpan(), "history");
      empty.createEl("strong", { text: "No event activity yet" });
      empty.createDiv({ text: "Scheduled, file-triggered, and manual occurrences will appear here." });
      return;
    }
    const list = body.createDiv({ cls: "chatobby-events__history" });
    for (const occurrence of model.occurrences) this.renderOccurrence(list, occurrence);
  }

  private renderOccurrence(parent: HTMLElement, occurrence: FrontendEventOccurrenceViewModel): void {
    const row = parent.createDiv({ cls: "chatobby-events__history-row" });
    row.createSpan({ cls: `chatobby-events__status is-${occurrence.status}`, attr: { "aria-label": occurrence.statusLabel } });
    const copy = row.createDiv({ cls: "chatobby-events__history-copy" });
    const title = copy.createDiv({ cls: "chatobby-events__history-title" });
    title.createEl("strong", { text: occurrence.eventName });
    title.createSpan({ text: occurrence.statusLabel });
    copy.createDiv({ cls: "chatobby-events__history-origin", text: `${occurrence.originLabel} · ${formatDate(occurrence.triggeredAt)}` });
    copy.createDiv({ cls: "chatobby-events__history-origin", text: occurrence.allocationLabel });
    if (occurrence.summary) copy.createDiv({ cls: "chatobby-events__history-summary", text: occurrence.summary });
    if (occurrence.error) copy.createDiv({ cls: "chatobby-events__history-error", text: occurrence.error });
    if (occurrence.canApprove) {
      const approve = row.createEl("button", { cls: "mod-cta", text: "Approve", attr: { type: "button" } });
      approve.disabled = this.busy;
      approve.addEventListener("click", () => void this.runIntent({ type: "events.approve", payload: { occurrenceId: occurrence.id } }));
    }
  }

  private renderEditor(body: HTMLElement, editor: FrontendEventEditorViewModel): void {
    this.ensureDraft(editor);
    const draft = this.draft;
    if (!draft) return;
    const header = body.createDiv({ cls: "chatobby-events__editor-header" });
    iconButton(header, "arrow-left", "Back to events").addEventListener("click", () => void this.runIntent({ type: "events.cancel-edit", payload: {} }, () => this.clearDraft()));
    header.createEl("h4", { text: draft.definitionId ? "Edit event" : "Create event" });
    const form = body.createEl("form", { cls: "chatobby-events__editor" });
    if (editor.allocationError) form.createDiv({ cls: "chatobby-events__form-error", text: editor.allocationError });
    const name = fieldInput(form, "Name", "Daily review", draft.name, true);
    bindText(name, (value) => { draft.name = value; });
    const description = fieldInput(form, "Description", "What this automation is for", draft.description);
    bindText(description, (value) => { draft.description = value; });
    const project = fieldSelect(form, "Project", editor.projectChoices.map((choice) => [choice.value, choice.label]), draft.projectPath);
    project.addEventListener("change", () => {
      draft.projectPath = project.value;
      void this.runIntent({ type: "events.set-editor-project", payload: { projectPath: project.value } });
    });
    const permission = fieldSelect(form, "Permission policy", editor.permissionChoices.map((choice) => [choice.value, choice.label]), draft.permissionProfileId);
    permission.disabled = editor.permissionChoices.length === 0;
    permission.addEventListener("change", () => { draft.permissionProfileId = permission.value; });
    const agent = fieldSelect(form, "Agent", editor.agentChoices.map((choice) => [choice.value, choice.label]), draft.agentId);
    agent.disabled = editor.agentChoices.length === 0;
    agent.addEventListener("change", () => { draft.agentId = agent.value; });
    const triggerKind = fieldSelect(form, "Trigger", [["schedule", "Schedule"], ["filesystem", "File or folder changes"], ["command", "Named command"]], draft.triggerKind);
    triggerKind.addEventListener("change", () => {
      if (!isTriggerKind(triggerKind.value)) return;
      draft.triggerKind = triggerKind.value;
      draft.triggerValue = triggerKind.value === "schedule" ? "0 9 * * *" : "";
      this.renderState(this.props.getModel());
    });
    if (draft.triggerKind === "schedule") this.renderSchedule(form, draft);
    else {
      const triggerLabel = draft.triggerKind === "filesystem" ? "Vault path" : "Command name";
      const triggerPlaceholder = draft.triggerKind === "filesystem" ? "Projects/Current" : "weekly-review";
      const triggerValue = fieldInput(form, triggerLabel, triggerPlaceholder, draft.triggerValue, true);
      bindText(triggerValue, (value) => { draft.triggerValue = value; });
    }
    const prompt = fieldTextarea(form, "Instructions", "Describe the outcome Chatobby should produce…", draft.prompt, true);
    bindText(prompt, (value) => { draft.prompt = value; });
    const requireApproval = fieldCheckbox(form, "Ask before every run", "Recommended while refining a new automation.", draft.requireApproval);
    requireApproval.input.addEventListener("change", () => { draft.requireApproval = requireApproval.input.checked; });
    const background = fieldCheckbox(form, "Allow when no Chatobby view is open", "The backend may begin this work while Obsidian remains open in the background.", draft.allowWhenViewClosed);
    background.input.addEventListener("change", () => {
      draft.allowWhenViewClosed = background.input.checked;
      this.renderState(this.props.getModel());
    });
    if (draft.allowWhenViewClosed) {
      const consent = fieldCheckbox(form, "I understand this event can run without an open Chatobby view", "Required before background execution is enabled.", draft.backgroundConsent);
      consent.input.addEventListener("change", () => { draft.backgroundConsent = consent.input.checked; });
    }
    const maxRuns = fieldNumber(form, "Daily run limit", draft.maxRunsPerDay, 1, 1_000);
    maxRuns.addEventListener("input", () => { draft.maxRunsPerDay = maxRuns.valueAsNumber; });
    const maxMinutes = fieldNumber(form, "Maximum runtime (minutes)", draft.maxRuntimeMinutes, 1, 1_440);
    maxMinutes.addEventListener("input", () => { draft.maxRuntimeMinutes = maxMinutes.valueAsNumber; });
    const actions = form.createDiv({ cls: "chatobby-events__editor-actions" });
    if (draft.definitionId && draft.expectedRevision !== undefined) {
      const remove = actions.createEl("button", { cls: "mod-warning", text: this.deleteConfirmId === draft.definitionId ? "Confirm delete" : "Delete", attr: { type: "button" } });
      remove.addEventListener("click", () => {
        if (this.deleteConfirmId !== draft.definitionId) {
          this.deleteConfirmId = draft.definitionId ?? null;
          this.renderState(this.props.getModel());
        } else if (draft.definitionId && draft.expectedRevision !== undefined) {
          void this.runIntent({ type: "events.delete", payload: { definitionId: draft.definitionId, expectedDefinitionRevision: draft.expectedRevision } }, () => this.clearDraft());
        }
      });
    }
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save event", attr: { type: "submit" } });
    save.disabled = !editor.saveEnabled || this.busy;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!editor.saveEnabled) return this.showFormError(form, "Wait for the project's permission policies and agents to load before saving.");
      if (draft.allowWhenViewClosed && !draft.backgroundConsent) return this.showFormError(form, "Confirm background execution before saving this event.");
      void this.runIntent({
        type: "events.save",
        payload: {
          definitionId: draft.definitionId,
          expectedDefinitionRevision: draft.expectedRevision,
          name: draft.name,
          description: draft.description,
          projectPath: draft.projectPath,
          permissionProfileId: draft.permissionProfileId,
          agentId: draft.agentId,
          enabled: draft.enabled,
          triggerKind: draft.triggerKind,
          triggerValue: draft.triggerValue,
          scheduleStartAt: draft.scheduleStartAt,
          scheduleRepeat: draft.scheduleRepeat,
          scheduleInterval: draft.scheduleInterval,
          scheduleWeekdays: draft.scheduleWeekdays,
          scheduleEnd: draft.scheduleEnd,
          scheduleEndDate: draft.scheduleEndDate,
          scheduleEndOccurrences: draft.scheduleEndOccurrences,
          triggerRecursive: draft.triggerRecursive,
          triggerDebounceMs: draft.triggerDebounceMs,
          prompt: draft.prompt,
          requireApproval: draft.requireApproval,
          allowWhenViewClosed: draft.allowWhenViewClosed,
          backgroundConsent: draft.backgroundConsent,
          maxRunsPerDay: draft.maxRunsPerDay,
          maxRuntimeMinutes: draft.maxRuntimeMinutes,
        },
      }, () => this.clearDraft());
    });
  }

  private renderSchedule(form: HTMLFormElement, draft: EditorDraft): void {
    const schedule = form.createDiv({ cls: "chatobby-events__schedule" });
    schedule.createDiv({ cls: "chatobby-events__schedule-title", text: "Schedule" });
    const start = schedule.createDiv({ cls: "chatobby-events__schedule-start" });
    const [startDate = "", startTime = ""] = draft.scheduleStartAt.split("T");
    const date = fieldNativeInput(start, "Date", "date", startDate, true);
    const time = fieldNativeInput(start, "Time", "time", startTime, true);
    const updateStart = (): void => {
      if (!date.value || !time.value) return;
      draft.scheduleStartAt = `${date.value}T${time.value}`;
      if (draft.scheduleRepeat === "weekly" && draft.scheduleWeekdays.length === 0) {
        draft.scheduleWeekdays = [localDateFromInput(draft.scheduleStartAt).getDay()];
      }
      draft.triggerValue = cronForSchedule(draft);
      summary.textContent = formatScheduleSummary(draft);
    };
    date.addEventListener("change", updateStart);
    time.addEventListener("change", updateStart);
    const summary = schedule.createDiv({ cls: "chatobby-events__schedule-summary", text: formatScheduleSummary(draft) });

    const repeatValue =
      draft.scheduleRepeat === "weekly" && sameNumbers(draft.scheduleWeekdays, [1, 2, 3, 4, 5])
        ? "weekdays"
        : draft.scheduleRepeat;
    const repeat = fieldSelect(schedule, "Repeat", [
      ["none", "Does not repeat"],
      ["daily", "Daily"],
      ["weekdays", "Every weekday (Mon–Fri)"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["yearly", "Yearly"],
    ], repeatValue);
    repeat.addEventListener("change", () => {
      if (repeat.value === "weekdays") {
        draft.scheduleRepeat = "weekly";
        draft.scheduleWeekdays = [1, 2, 3, 4, 5];
      } else if (isRepeat(repeat.value)) {
        draft.scheduleRepeat = repeat.value;
        if (repeat.value === "weekly" && draft.scheduleWeekdays.length === 0) {
          draft.scheduleWeekdays = [localDateFromInput(draft.scheduleStartAt).getDay()];
        }
      }
      draft.triggerValue = cronForSchedule(draft);
      this.renderState(this.props.getModel());
    });
    if (draft.scheduleRepeat === "none") return;

    const every = schedule.createDiv({ cls: "chatobby-events__schedule-every" });
    const interval = fieldNumber(every, "Repeat every", draft.scheduleInterval, 1, 999);
    every.createSpan({ cls: "chatobby-events__schedule-unit", text: recurrenceUnit(draft.scheduleRepeat, draft.scheduleInterval) });
    interval.addEventListener("input", () => {
      draft.scheduleInterval = Math.max(1, interval.valueAsNumber || 1);
      draft.triggerValue = cronForSchedule(draft);
    });

    if (draft.scheduleRepeat === "weekly") {
      const weekdays = schedule.createDiv({ cls: "chatobby-events__weekdays", attr: { "aria-label": "Repeat on" } });
      for (const weekday of weekdayLabels()) {
        const selected = draft.scheduleWeekdays.includes(weekday.value);
        const button = weekdays.createEl("button", {
          cls: `chatobby-events__weekday${selected ? " is-selected" : ""}`,
          text: weekday.label,
          attr: { type: "button", "aria-pressed": String(selected), "aria-label": weekday.longLabel },
        });
        button.addEventListener("click", () => {
          const next = selected
            ? draft.scheduleWeekdays.filter((value) => value !== weekday.value)
            : [...draft.scheduleWeekdays, weekday.value].sort((left, right) => left - right);
          if (next.length === 0) return;
          draft.scheduleWeekdays = next;
          draft.triggerValue = cronForSchedule(draft);
          this.renderState(this.props.getModel());
        });
      }
    }

    const ends = fieldSelect(schedule, "Ends", [["never", "Never"], ["on", "On date"], ["after", "After occurrences"]], draft.scheduleEnd);
    ends.addEventListener("change", () => {
      if (!isScheduleEnd(ends.value)) return;
      draft.scheduleEnd = ends.value;
      this.renderState(this.props.getModel());
    });
    if (draft.scheduleEnd === "on") {
      const endDate = fieldNativeInput(schedule, "End date", "date", draft.scheduleEndDate, true);
      endDate.min = startDate;
      endDate.addEventListener("change", () => { draft.scheduleEndDate = endDate.value; });
    } else if (draft.scheduleEnd === "after") {
      const occurrences = fieldNumber(schedule, "Occurrences", draft.scheduleEndOccurrences, 1, 10_000);
      occurrences.addEventListener("input", () => {
        draft.scheduleEndOccurrences = Math.max(1, occurrences.valueAsNumber || 1);
      });
    }
  }

  private ensureDraft(editor: FrontendEventEditorViewModel): void {
    const key = editor.definitionId ?? "new";
    if (this.editorKey !== key || !this.draft) {
      this.editorKey = key;
      this.draft = draftFromEditor(editor);
      return;
    }
    this.draft.projectPath = editor.projectPath;
    if (!editor.permissionChoices.some((choice) => choice.value === this.draft?.permissionProfileId)) this.draft.permissionProfileId = editor.permissionProfileId;
    if (!editor.agentChoices.some((choice) => choice.value === this.draft?.agentId && !choice.disabledReason)) this.draft.agentId = editor.agentId;
  }

  private clearDraft(): void {
    this.editorKey = null;
    this.draft = null;
    this.deleteConfirmId = null;
  }

  private showFormError(form: HTMLFormElement, message: string): void {
    const error = form.querySelector<HTMLElement>(".chatobby-events__form-error") ?? form.createDiv({ cls: "chatobby-events__form-error" });
    error.textContent = message;
  }

  private async refresh(): Promise<void> {
    this.localError = null;
    try {
      await this.props.onRefresh();
    } catch (error) {
      this.setLocalError(errorMessage(error));
    }
  }

  private async runIntent(intent: EventViewIntent, onSuccess?: () => void): Promise<void> {
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

function draftFromEditor(editor: FrontendEventEditorViewModel): EditorDraft {
  const scheduleStartAt = editor.scheduleStartAt || defaultScheduleStart();
  const scheduleWeekdays = editor.scheduleWeekdays?.length
    ? [...editor.scheduleWeekdays]
    : [localDateFromInput(scheduleStartAt).getDay()];
  return {
    definitionId: editor.definitionId,
    expectedRevision: editor.expectedRevision,
    name: editor.name,
    description: editor.description,
    projectPath: editor.projectPath,
    permissionProfileId: editor.permissionProfileId,
    agentId: editor.agentId,
    enabled: editor.enabled,
    triggerKind: editor.triggerKind,
    triggerValue: editor.triggerValue,
    scheduleStartAt,
    scheduleRepeat: isRepeat(editor.scheduleRepeat) ? editor.scheduleRepeat : "none",
    scheduleInterval: Number.isFinite(editor.scheduleInterval) ? Math.max(1, editor.scheduleInterval) : 1,
    scheduleWeekdays,
    scheduleEnd: isScheduleEnd(editor.scheduleEnd) ? editor.scheduleEnd : "never",
    scheduleEndDate: editor.scheduleEndDate || defaultScheduleEnd(scheduleStartAt),
    scheduleEndOccurrences: Number.isFinite(editor.scheduleEndOccurrences)
      ? Math.max(1, editor.scheduleEndOccurrences)
      : 10,
    triggerRecursive: editor.triggerRecursive,
    triggerDebounceMs: editor.triggerDebounceMs,
    prompt: editor.prompt,
    requireApproval: editor.requireApproval,
    allowWhenViewClosed: editor.allowWhenViewClosed,
    backgroundConsent: editor.backgroundConsent,
    maxRunsPerDay: editor.maxRunsPerDay,
    maxRuntimeMinutes: editor.maxRuntimeMinutes,
  };
}

function iconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
  return createPageIconButton(parent, icon, label);
}

function fieldInput(parent: HTMLElement, label: string, placeholder: string, value: string, required = false): HTMLInputElement {
  const field = parent.createEl("label", { cls: "chatobby-events__field" });
  field.createSpan({ text: label });
  const input = field.createEl("input", { attr: { type: "text", placeholder, value } });
  input.required = required;
  return input;
}

function fieldTextarea(parent: HTMLElement, label: string, placeholder: string, value: string, required = false): HTMLTextAreaElement {
  const field = parent.createEl("label", { cls: "chatobby-events__field" });
  field.createSpan({ text: label });
  const input = field.createEl("textarea", { attr: { rows: "5", placeholder } });
  input.value = value;
  input.required = required;
  return input;
}

function fieldSelect(parent: HTMLElement, label: string, options: readonly (readonly [string, string])[], value: string): HTMLSelectElement {
  const field = parent.createEl("label", { cls: "chatobby-events__field" });
  field.createSpan({ text: label });
  const select = field.createEl("select");
  for (const [optionValue, optionLabel] of options) select.createEl("option", { text: optionLabel, attr: { value: optionValue } }).selected = optionValue === value;
  return select;
}

function fieldNumber(parent: HTMLElement, label: string, value: number, min: number, max: number): HTMLInputElement {
  const field = parent.createEl("label", { cls: "chatobby-events__field" });
  field.createSpan({ text: label });
  return field.createEl("input", { attr: { type: "number", value: String(value), min: String(min), max: String(max) } });
}

function fieldNativeInput(
  parent: HTMLElement,
  label: string,
  type: "date" | "time",
  value: string,
  required = false,
): HTMLInputElement {
  const field = parent.createEl("label", { cls: "chatobby-events__field" });
  field.createSpan({ text: label });
  const input = field.createEl("input", { attr: { type, value } });
  input.required = required;
  return input;
}

function fieldCheckbox(parent: HTMLElement, label: string, detail: string, checked: boolean): { wrapper: HTMLElement; input: HTMLInputElement } {
  const wrapper = parent.createEl("label", { cls: "chatobby-events__check" });
  const input = wrapper.createEl("input", { attr: { type: "checkbox" } });
  input.checked = checked;
  const copy = wrapper.createDiv();
  copy.createSpan({ text: label });
  copy.createEl("small", { text: detail });
  return { wrapper, input };
}

function bindText(input: HTMLInputElement | HTMLTextAreaElement, update: (value: string) => void): void {
  input.addEventListener("input", () => update(input.value));
}

function isTriggerKind(value: string): value is EditorDraft["triggerKind"] {
  return value === "schedule" || value === "filesystem" || value === "command";
}

function isRepeat(value: string): value is EditorDraft["scheduleRepeat"] {
  return value === "none" || value === "daily" || value === "weekly" || value === "monthly" || value === "yearly";
}

function isScheduleEnd(value: string): value is EditorDraft["scheduleEnd"] {
  return value === "never" || value === "on" || value === "after";
}

function localDateFromInput(value: string): Date {
  const [datePart = "", timePart = ""] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
}

function defaultScheduleStart(): string {
  const value = new Date();
  value.setSeconds(0, 0);
  value.setMinutes(0);
  value.setHours(value.getHours() + 1);
  return `${localDateValue(value)}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function defaultScheduleEnd(startAt: string): string {
  const value = localDateFromInput(startAt);
  value.setDate(value.getDate() + 30);
  return localDateValue(value);
}

function localDateValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function cronForSchedule(draft: EditorDraft): string {
  const starts = localDateFromInput(draft.scheduleStartAt);
  const minute = starts.getMinutes();
  const hour = starts.getHours();
  if (draft.scheduleRepeat === "daily") return `${minute} ${hour} */${draft.scheduleInterval} * *`;
  if (draft.scheduleRepeat === "weekly") return `${minute} ${hour} * * ${draft.scheduleWeekdays.join(",")}`;
  if (draft.scheduleRepeat === "monthly") return `${minute} ${hour} ${starts.getDate()} */${draft.scheduleInterval} *`;
  if (draft.scheduleRepeat === "yearly") return `${minute} ${hour} ${starts.getDate()} ${starts.getMonth() + 1} *`;
  return `${minute} ${hour} ${starts.getDate()} ${starts.getMonth() + 1} *`;
}

function formatScheduleSummary(draft: EditorDraft): string {
  const starts = localDateFromInput(draft.scheduleStartAt);
  if (Number.isNaN(starts.getTime())) return "Choose a date and time";
  const date = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(starts);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(starts);
  return `${date} at ${time}`;
}

function recurrenceUnit(repeat: Exclude<EditorDraft["scheduleRepeat"], "none">, interval: number): string {
  const singular = repeat === "daily" ? "day" : repeat === "weekly" ? "week" : repeat === "monthly" ? "month" : "year";
  return interval === 1 ? singular : `${singular}s`;
}

function weekdayLabels(): Array<{ value: number; label: string; longLabel: string }> {
  const reference = new Date(2026, 6, 12);
  return Array.from({ length: 7 }, (_value, index) => {
    const date = new Date(reference);
    date.setDate(reference.getDate() + index);
    return {
      value: index,
      label: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(date),
      longLabel: new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date),
    };
  });
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
