import { setIcon } from "obsidian";
import type {
  FrontendTaskItemViewModel,
  FrontendTaskPlanViewModel,
  FrontendTaskStatus,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { reconcileKeyed } from "../../../ui/shared/page-shell";

const COMPLETION_LINGER_MS = 1_200;
let taskProgressInstance = 0;

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
  private toggle: HTMLButtonElement | null = null;
  private preview: HTMLElement | null = null;
  private summary: HTMLElement | null = null;
  private chevron: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private hideTimer: number | null = null;
  private visible = false;
  private readonly listId: string;

  constructor(private readonly hostEl: HTMLElement) {
    taskProgressInstance += 1;
    this.listId = `chatobby-session-tasks-${taskProgressInstance}`;
  }

  setModel(model: FrontendTaskPlanViewModel): void {
    this.model = model;
    const hasTasks = model.items.length > 0 && model.remainingCount > 0;
    if (!hasTasks) {
      this.expanded = false;
      if (this.visible && model.items.length > 0 && model.remainingCount === 0) {
        this.renderCompletion(model);
        this.scheduleHide();
      } else {
        this.hide();
      }
      return;
    }
    this.cancelHide();
    this.ensureMounted();
    this.visible = true;
    this.hostEl.removeClass("is-hidden");
    this.renderModel(model);
  }

  destroy(): void {
    this.cancelHide();
    this.hide();
  }

  private ensureMounted(): void {
    if (this.toggle?.isConnected || this.hostEl.contains(this.toggle)) return;
    this.hostEl.empty();
    this.toggle = this.hostEl.createEl("button", {
      cls: "chatobby-task-progress__toggle",
      attr: { type: "button", "aria-controls": this.listId },
    });
    this.preview = this.toggle.createDiv({
      cls: "chatobby-task-progress__preview",
      attr: { "aria-live": "polite", "aria-atomic": "true" },
    });
    this.summary = this.toggle.createSpan({ cls: "chatobby-task-progress__summary" });
    this.chevron = this.toggle.createSpan({
      cls: "chatobby-task-progress__chevron",
      attr: { "aria-hidden": "true" },
    });
    this.toggle.addEventListener("click", () => {
      this.expanded = !this.expanded;
      if (this.model) this.renderModel(this.model);
    });
    this.list = this.hostEl.createDiv({
      cls: "chatobby-task-progress__list",
      attr: { id: this.listId, role: "list", "aria-label": "Session tasks" },
    });
  }

  private renderModel(model: FrontendTaskPlanViewModel): void {
    if (!this.toggle || !this.preview || !this.summary || !this.chevron || !this.list) return;
    this.toggle.disabled = false;
    this.toggle.setAttr("aria-expanded", String(this.expanded));
    this.toggle.setAttr("aria-label", `${this.expanded ? "Collapse" : "Expand"} session tasks. ${model.summary}`);
    this.preview.empty();
    const active = model.items
      .filter((item) => item.status === "in_progress")
      .sort((left, right) => left.step - right.step);
    if (active.length > 0) {
      const primary = active[0];
      if (primary) this.renderPreviewItem(this.preview, primary);
      if (active.length > 1) {
        this.preview.createSpan({
          cls: "chatobby-task-progress__active-count",
          text: `+${active.length - 1} active`,
        });
      }
    } else {
      const blocked = model.items.find((item) => item.status === "blocked");
      const pending = model.items.find((item) => item.status === "pending");
      const next = blocked ?? pending;
      if (next) {
        const idle = this.preview.createDiv({
          cls: `chatobby-task-progress__preview-item is-${next.status}`,
        });
        const icon = idle.createSpan({
          cls: "chatobby-task-progress__status-icon",
          attr: { "aria-hidden": "true" },
        });
        setIcon(icon, next.status === "blocked" ? "triangle-alert" : "circle");
        idle.createSpan({ cls: "chatobby-task-progress__step", text: `Task ${next.step}` });
        idle.createSpan({ cls: "chatobby-task-progress__preview-text", text: next.text });
        idle.createSpan({
          cls: "chatobby-visually-hidden",
          text: next.status === "blocked" ? "Blocked" : "Pending",
        });
      }
    }
    this.summary.textContent = model.summary;
    this.chevron.empty();
    this.chevron.removeClass("is-hidden");
    setIcon(this.chevron, this.expanded ? "chevron-up" : "chevron-down");
    this.list.toggleClass("is-hidden", !this.expanded);
    reconcileKeyed(
      this.list,
      this.expanded ? model.items : [],
      (item) => item.id,
      () => this.list!.createDiv(),
      (row, item) => this.renderTask(row, item),
    );
  }

  private renderPreviewItem(parent: HTMLElement, item: FrontendTaskItemViewModel): void {
    const row = parent.createDiv({ cls: "chatobby-task-progress__preview-item" });
    row.createSpan({ cls: "chatobby-task-progress__spinner", attr: { "aria-hidden": "true" } });
    row.createSpan({ cls: "chatobby-task-progress__step", text: `Task ${item.step}` });
    row.createSpan({ cls: "chatobby-task-progress__preview-text", text: item.text });
    row.createSpan({ cls: "chatobby-visually-hidden", text: "In progress" });
  }

  private renderTask(row: HTMLElement, item: FrontendTaskItemViewModel): void {
    row.empty();
    row.className = `chatobby-task-progress__item is-${item.status}`;
    row.setAttr("role", "listitem");
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

  private renderCompletion(model: FrontendTaskPlanViewModel): void {
    this.cancelHide();
    this.ensureMounted();
    this.visible = true;
    this.hostEl.removeClass("is-hidden");
    this.expanded = false;
    if (!this.preview || !this.summary || !this.chevron || !this.list || !this.toggle) return;
    this.preview.empty();
    const complete = this.preview.createDiv({ cls: "chatobby-task-progress__preview-item is-complete" });
    const icon = complete.createSpan({ cls: "chatobby-task-progress__status-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, "check-check");
    complete.createSpan({ text: "Tasks complete" });
    this.summary.textContent = model.summary;
    this.chevron.empty();
    this.chevron.addClass("is-hidden");
    this.toggle.disabled = true;
    this.toggle.setAttr("aria-expanded", "false");
    this.toggle.setAttr("aria-label", model.summary);
    this.list.empty();
    this.list.addClass("is-hidden");
  }

  private scheduleHide(): void {
    this.hideTimer = window.setTimeout(() => this.hide(), COMPLETION_LINGER_MS);
  }

  private cancelHide(): void {
    if (this.hideTimer === null) return;
    window.clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private hide(): void {
    this.cancelHide();
    this.visible = false;
    this.hostEl.addClass("is-hidden");
    this.hostEl.empty();
    this.toggle = null;
    this.preview = null;
    this.summary = null;
    this.chevron = null;
    this.list = null;
  }
}
