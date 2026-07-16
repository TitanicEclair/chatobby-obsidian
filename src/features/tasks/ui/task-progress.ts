import { setIcon } from "obsidian";
import type {
  FrontendTaskItemViewModel,
  FrontendTaskPlanViewModel,
  FrontendTaskStatus,
} from "../../../vendor/chatobby-client/frontend-contracts.js";

const STATUS_LABELS: Readonly<Record<FrontendTaskStatus, string>> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  blocked: "Blocked",
};

const STATUS_ICONS: Readonly<Record<FrontendTaskStatus, string>> = {
  pending: "circle",
  in_progress: "loader-circle",
  completed: "check",
  blocked: "triangle-alert",
};

/** Read-only session task projection. The only action is expanding or collapsing the list. */
export class TaskProgress {
  private model: FrontendTaskPlanViewModel | null = null;
  private expanded = false;

  constructor(private readonly hostEl: HTMLElement) {}

  setModel(model: FrontendTaskPlanViewModel): void {
    this.model = model;
    if (model.items.length === 0 || model.remainingCount === 0) this.expanded = false;
    this.render();
  }

  private render(): void {
    this.hostEl.empty();
    const model = this.model;
    const hasTasks = Boolean(model?.items.length && model.remainingCount > 0);
    this.hostEl.toggleClass("is-hidden", !hasTasks);
    if (!model || !hasTasks) return;

    const toggle = this.hostEl.createEl("button", {
      cls: "chatobby-task-progress__toggle",
      attr: {
        type: "button",
        "aria-expanded": String(this.expanded),
        "aria-label": `${this.expanded ? "Collapse" : "Expand"} session tasks. ${model.summary}`,
      },
    });
    const preview = toggle.createDiv({ cls: "chatobby-task-progress__preview" });
    const active = model.items.filter((item) => item.status === "in_progress");
    if (active.length > 0) {
      for (const item of active) this.renderPreviewItem(preview, item);
    } else {
      const idle = preview.createDiv({ cls: "chatobby-task-progress__preview-item" });
      const icon = idle.createSpan({ cls: "chatobby-task-progress__status-icon", attr: { "aria-hidden": "true" } });
      setIcon(icon, model.remainingCount === 0 ? "check-check" : "list-checks");
      idle.createSpan({ text: model.remainingCount === 0 ? "Tasks complete" : "Tasks paused" });
    }
    toggle.createSpan({ cls: "chatobby-task-progress__summary", text: model.summary });
    const chevron = toggle.createSpan({ cls: "chatobby-task-progress__chevron", attr: { "aria-hidden": "true" } });
    setIcon(chevron, this.expanded ? "chevron-down" : "chevron-up");
    toggle.addEventListener("click", () => {
      this.expanded = !this.expanded;
      this.render();
    });

    if (!this.expanded) return;
    const list = this.hostEl.createDiv({
      cls: "chatobby-task-progress__list",
      attr: { role: "list", "aria-label": "Session tasks" },
    });
    for (const item of model.items) this.renderTask(list, item);
  }

  private renderPreviewItem(parent: HTMLElement, item: FrontendTaskItemViewModel): void {
    const row = parent.createDiv({ cls: "chatobby-task-progress__preview-item" });
    row.createSpan({ cls: "chatobby-task-progress__spinner", attr: { "aria-hidden": "true" } });
    row.createSpan({ cls: "chatobby-task-progress__step", text: `Task ${item.step}` });
    row.createSpan({ cls: "chatobby-task-progress__preview-text", text: item.text });
    row.createSpan({ cls: "chatobby-visually-hidden", text: "In progress" });
  }

  private renderTask(parent: HTMLElement, item: FrontendTaskItemViewModel): void {
    const row = parent.createDiv({ cls: `chatobby-task-progress__item is-${item.status}`, attr: { role: "listitem" } });
    const icon = row.createSpan({
      cls: `chatobby-task-progress__status-icon${item.status === "in_progress" ? " is-spinning" : ""}`,
      attr: { "aria-hidden": "true" },
    });
    setIcon(icon, STATUS_ICONS[item.status]);
    const body = row.createDiv({ cls: "chatobby-task-progress__item-body" });
    const line = body.createDiv({ cls: "chatobby-task-progress__item-line" });
    line.createSpan({ cls: "chatobby-task-progress__step", text: `Task ${item.step}` });
    line.createSpan({ cls: "chatobby-task-progress__item-text", text: item.text });
    line.createSpan({ cls: "chatobby-task-progress__state", text: STATUS_LABELS[item.status] });
    if (item.note) body.createDiv({ cls: "chatobby-task-progress__note", text: item.note });
  }
}
