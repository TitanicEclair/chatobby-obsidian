import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageHeader,
  createPageIconButton,
  createPageTab,
  createPageTabs,
} from "../../../ui/shared/page-shell";
import type { SubagentScreenActions, SubagentScreenTab, SubagentStartDraft } from "../domain/screen-model";
import type { SubagentStore, SubagentViewState } from "../state/subagent-store";
import { renderAgentsPanel, renderSettingsPanel, renderWorkflowsPanel } from "./catalog-panels";
import { AgentConversationView, type SubagentFeedHostFactory } from "./agent-conversation-view";
import { renderRunWorkspace } from "./run-panels";
import { renderInboxPanel } from "./inbox-panel";

const MILLISECONDS_PER_MINUTE = 60_000;

export interface SubagentsViewProps {
  store: SubagentStore;
  actions: SubagentScreenActions;
  onBack: () => void;
  onOpenManagement: () => void;
  initialTab?: SubagentScreenTab;
  initialFeedOnly?: boolean;
  createFeedHost: SubagentFeedHostFactory;
}

export class SubagentsView extends ChatobbyComponent {
  private body: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private tab: SubagentScreenTab = "runs";
  private unsubscribe: (() => void) | null = null;
  private startExpanded = false;
  private actionStatus: string | null = null;
  private feedOnly: boolean;
  private titleMain: HTMLElement | null = null;
  private conversation: AgentConversationView | null = null;

  constructor(private readonly props: SubagentsViewProps) {
    super();
    this.tab = props.initialTab ?? "runs";
    this.feedOnly = props.initialFeedOnly ?? false;
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-subagents";
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    container.toggleClass("is-feed-only", this.feedOnly);
    this.renderHeader(container);
    this.renderTabs(container);
    this.status = container.createDiv({ cls: "chatobby-subagents__notice is-hidden", attr: { role: "status", "aria-live": "polite" } });
    this.body = container.createDiv({ cls: "chatobby-page__body chatobby-subagents__body" });
    this.unsubscribe = this.props.store.subscribe(() => this.renderBody());
    this.renderBody();
  }

  focusContainer(): void {
    this.container?.focus();
  }

  focusComposer(): void {
    this.conversation?.focusComposer();
  }

  handleKeydown(event: KeyboardEvent): boolean {
    return this.feedOnly ? this.conversation?.handleViewKeydown(event) ?? false : false;
  }

  setActionStatus(message: string | null): void {
    this.actionStatus = message;
    this.renderStatus(this.props.store.getSnapshot());
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.conversation?.destroy();
    this.conversation = null;
    super.destroy();
  }

  private renderHeader(container: HTMLElement): void {
    const { title, actions } = createPageHeader(container, {
      title: "Subagents",
      headerClass: "chatobby-subagents__header",
      titleClass: "chatobby-subagents__title-main",
      actionsClass: "chatobby-subagents__header-actions",
    });
    this.titleMain = title;
    this.renderTitle();
    if (this.feedOnly) {
      const supervisor = createPageIconButton(actions, "arrow-left", "Back to subagents", {
        className: "chatobby-subagents__icon-button",
      });
      supervisor.addEventListener("click", () => {
        this.props.onOpenManagement();
      });
      return;
    }
    const start = createPageIconButton(actions, "plus", "New run", {
      className: "chatobby-subagents__icon-button",
    });
    start.setAttr("aria-pressed", String(this.startExpanded));
    start.addEventListener("click", () => {
      this.startExpanded = !this.startExpanded;
      this.renderBody();
    });
    const refresh = createPageIconButton(actions, "refresh-cw", "Refresh subagents", {
      className: "chatobby-subagents__icon-button",
    });
    refresh.addEventListener("click", () => void this.props.actions.refresh());
    const clear = createPageIconButton(actions, "trash-2", "Delete this session's subagent data", {
      className: "chatobby-subagents__icon-button is-danger",
    });
    clear.addEventListener("click", () => void this.props.actions.deleteSession());
    createPageIconButton(actions, "x", "Close subagents", {
      className: "chatobby-subagents__icon-button",
    }).addEventListener("click", this.props.onBack);
  }

  private renderTabs(container: HTMLElement): void {
    const tabs = createPageTabs(
      container,
      `chatobby-subagents__tabs${this.feedOnly ? " is-hidden" : ""}`,
    );
    const labels: ReadonlyArray<[SubagentScreenTab, string]> = [
      ["runs", "Runs"],
      ["inbox", "Inbox"],
      ["agents", "Roles"],
      ["workflows", "Flows"],
      ["settings", "Settings"],
    ];
    const buttons: HTMLButtonElement[] = [];
    const activate = (tab: SubagentScreenTab, button: HTMLButtonElement, focus: boolean): void => {
      this.tab = tab;
      for (const item of buttons) {
        const selected = item === button;
        item.toggleClass("is-active", selected);
        item.setAttr("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      }
      if (focus) button.focus();
      this.renderBody();
    };
    for (const [tab, label] of labels) {
      const button = createPageTab(tabs, {
        label,
        active: this.tab === tab,
        className: "chatobby-subagents__tab",
      });
      button.tabIndex = this.tab === tab ? 0 : -1;
      buttons.push(button);
      button.addEventListener("click", () => activate(tab, button, false));
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const currentIndex = buttons.indexOf(button);
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
        const next = buttons[nextIndex];
        const nextTab = labels[nextIndex]?.[0];
        if (next && nextTab) activate(nextTab, next, true);
      });
    }
  }

  private renderBody(): void {
    if (!this.body) return;
    const state = this.props.store.getSnapshot();
    this.renderStatus(state);
    this.renderTitle(state);
    if (this.feedOnly) {
      if (!this.conversation) {
        this.body.empty();
        this.conversation = new AgentConversationView({
          actions: this.props.actions,
          createFeedHost: this.props.createFeedHost,
        });
        this.conversation.render(this.body);
      }
      this.conversation.update(state);
      return;
    }
    this.conversation?.destroy();
    this.conversation = null;
    this.body.empty();
    if (this.startExpanded) this.renderStartForm(this.body, state);
    if (state.syncStatus === "loading" && state.runtimeId === null) {
      this.body.createDiv({ cls: "chatobby-subagents__loading", text: "Loading supervisor snapshot…" });
      return;
    }
    if (state.syncStatus === "error" && state.runtimeId === null) {
      this.body.createDiv({ cls: "chatobby-subagents__empty", text: state.error ?? "Subagent supervisor unavailable." });
      return;
    }
    if (this.tab === "runs") {
      this.renderOverview(this.body, state);
      renderRunWorkspace(this.body, state, this.props.actions);
    }
    else if (this.tab === "inbox") renderInboxPanel(this.body, state, this.props.actions);
    else if (this.tab === "agents") renderAgentsPanel(this.body, state, this.props.actions);
    else if (this.tab === "workflows") renderWorkflowsPanel(this.body, state, this.props.actions);
    else renderSettingsPanel(this.body, state, this.props.actions);
  }

  private renderTitle(state = this.props.store.getSnapshot()): void {
    const run = state.selectedRunId ? state.runs.get(state.selectedRunId) : undefined;
    const node = run && state.selectedNodeId ? run.nodes[state.selectedNodeId] : undefined;
    const agentName = node?.agentName?.trim()
      || node?.agentId.split(/[-_]/u).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
    if (this.titleMain) this.titleMain.textContent = this.feedOnly ? agentName ?? "Agent feed" : "Subagents";
  }

  private renderOverview(host: HTMLElement, state: SubagentViewState): void {
    const summaries = state.runIds.map((id) => state.runSummaries.get(id)).filter((run) => run !== undefined);
    const overview = host.createDiv({ cls: "chatobby-subagents__overview" });
    const pendingUserMessages = state.messages.filter((message) =>
      message.blocking && message.status !== "acknowledged" && message.to.some((recipient) => recipient.kind === "user"));
    const pendingDecisions = [...state.runs.values()].reduce((total, run) => total + Object.values(run.nodes)
      .filter((node) => node.pendingPermission?.status === "pending" || node.acceptanceStatus === "waiting-review").length, 0);
    const working = summaries.reduce((total, run) => total + run.activeNodes + run.queuedNodes, 0);
    const problems = summaries.reduce((total, run) => total + run.failedNodes, 0);
    const facts: ReadonlyArray<readonly [string, string]> = [
      ["Active", String(working)],
      ["Waiting", String(pendingUserMessages.length + pendingDecisions)],
      ["Done", String(summaries.filter((run) => run.status === "completed").length)],
      ...(problems > 0 ? [["Issues", String(problems)] as const] : []),
    ];
    for (const [label, value] of facts) {
      const fact = overview.createDiv({ cls: "chatobby-subagents__overview-fact" });
      fact.createSpan({ cls: "chatobby-subagents__fact-value", text: value });
      fact.createSpan({ cls: "chatobby-subagents__fact-label", text: label });
    }
  }

  private renderStatus(state: SubagentViewState): void {
    if (!this.status) return;
    const message = this.actionStatus
	  ?? state.statusMessage
      ?? (state.syncStatus === "gap" ? "Live event gap detected. Refreshing the authoritative snapshot…" : null)
      ?? (state.syncStatus === "error" ? state.error : null);
    this.status.textContent = message ?? "";
    this.status.toggleClass("is-hidden", !message);
    this.status.toggleClass("is-error", state.syncStatus === "error");
  }

  private renderStartForm(host: HTMLElement, state: SubagentViewState): void {
    const form = host.createEl("form", { cls: "chatobby-subagents__start" });
    const heading = form.createDiv({ cls: "chatobby-subagents__start-heading" });
    heading.createDiv({ cls: "chatobby-subagents__editor-title", text: "New run" });
    const grid = form.createDiv({ cls: "chatobby-subagents__start-grid" });
    const description = addInput(grid, "Name", "Research migration options");
    const task = addTextArea(grid, "Task", "Outcome, constraints, and evidence needed");
    const roleOptions = state.definitions.filter((item) => item.enabled).map((item): readonly [string, string] => [item.id, item.name]);
    if (!roleOptions.some(([id]) => id === "general-purpose")) roleOptions.unshift(["general-purpose", "General purpose"]);
    const role = addSelect(grid, "Role", roleOptions);
    const advanced = form.createEl("details", { cls: "chatobby-subagents__role-advanced" });
    advanced.createEl("summary", { text: "Advanced runtime options" });
    const advancedGrid = advanced.createDiv({ cls: "chatobby-subagents__role-advanced-grid" });
    const executor = addSelect(advancedGrid, "Executor", [["auto", "Automatic"], ["in-process", "In process"], ["worker-process", "Worker process"]]);
    const context = addSelect(advancedGrid, "Starting context", [["fresh", "Fresh"], ["fork", "Full parent context"], ["summary", "Parent summary"]]);
    const workspace = addSelect(advancedGrid, "Workspace", [["shared", "Shared working directory"], ["worktree", "Isolated worktree"]]);
    const priority = addInput(advancedGrid, "Priority", "0");
    priority.type = "number";
    priority.value = "0";
    const maxTurns = numberInput(advancedGrid, "Turn limit", "Inherited");
    const maxTokens = numberInput(advancedGrid, "Total token budget", "Inherited");
    const maxWallTime = numberInput(advancedGrid, "Time budget (minutes)", "Inherited");
    const controls = form.createDiv({ cls: "chatobby-subagents__start-actions" });
    const cancel = controls.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => {
      this.startExpanded = false;
      this.renderBody();
    });
    controls.createEl("button", { cls: "mod-cta", text: "Start", attr: { type: "submit" } });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const draft: SubagentStartDraft = {
        description: description.value.trim(),
        task: task.value.trim(),
        agentId: role.value,
        executionMode: executor.value as SubagentStartDraft["executionMode"],
        contextMode: context.value as SubagentStartDraft["contextMode"],
        workspaceMode: workspace.value as SubagentStartDraft["workspaceMode"],
        priority: Number(priority.value) || 0,
        maxTurns: positiveNumber(maxTurns.value),
        maxTokens: positiveNumber(maxTokens.value),
        maxWallTimeMs: minutesToMilliseconds(maxWallTime.value),
      };
      if (!draft.description || !draft.task || !draft.agentId) {
        this.setActionStatus("Name, task, and role are required.");
        return;
      }
      this.startExpanded = false;
      void this.props.actions.startRun(draft);
    });
  }
}

function numberInput(host: HTMLElement, label: string, placeholder: string): HTMLInputElement {
  const input = addInput(host, label, placeholder);
  input.type = "number";
  input.min = "0";
  return input;
}

function positiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function minutesToMilliseconds(value: string): number | undefined {
  const minutes = positiveNumber(value);
  return minutes === undefined ? undefined : minutes * MILLISECONDS_PER_MINUTE;
}

function addInput(host: HTMLElement, label: string, placeholder: string): HTMLInputElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__field" });
  field.createSpan({ text: label });
  return field.createEl("input", { attr: { type: "text", placeholder } });
}

function addTextArea(host: HTMLElement, label: string, placeholder: string): HTMLTextAreaElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__field is-wide" });
  field.createSpan({ text: label });
  return field.createEl("textarea", { attr: { placeholder } });
}

function addSelect(host: HTMLElement, label: string, options: ReadonlyArray<readonly [string, string]>): HTMLSelectElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__field" });
  field.createSpan({ text: label });
  const select = field.createEl("select");
  for (const [value, text] of options) select.createEl("option", { text, attr: { value } });
  return select;
}
