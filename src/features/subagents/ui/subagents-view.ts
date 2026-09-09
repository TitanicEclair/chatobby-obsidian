import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageIconButton,
  createPageState,
  PageShell,
} from "../../../ui/shared/page-shell";
import type { SubagentScreenActions, SubagentScreenTab, SubagentStartDraft } from "../domain/screen-model";
import type { SubagentStore, SubagentViewState } from "../state/subagent-store";
import { renderAgentsPanel, renderSettingsPanel } from "./catalog-panels";
import { AgentConversationView, type SubagentFeedHostFactory } from "./agent-conversation-view";
import { renderRunWorkspace } from "./run-panels";
import { renderInboxPanel } from "./inbox-panel";
import { renderActiveAgents } from "./active-agents-panel";

export interface SubagentsViewProps {
  workspacePage?: boolean;
  store: SubagentStore;
  actions: SubagentScreenActions;
  onBack: () => void;
  onOpenManagement: () => void;
  initialTab?: SubagentScreenTab;
  initialFeedOnly?: boolean;
  createFeedHost: SubagentFeedHostFactory;
}

export class SubagentsView extends ChatobbyComponent {
  private tab: SubagentScreenTab = "runs";
  private unsubscribe: (() => void) | null = null;
  private startExpanded = false;
  private actionStatus: string | null = null;
  private feedOnly: boolean;
  private conversation: AgentConversationView | null = null;
  private shell: PageShell | null = null;
  private startButton: HTMLButtonElement | null = null;

  constructor(private readonly props: SubagentsViewProps) {
    super();
    this.tab = props.workspacePage && props.initialTab === "settings" ? "agents" : props.initialTab ?? "runs";
    this.feedOnly = props.initialFeedOnly ?? false;
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-subagents";
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    container.toggleClass("is-feed-only", this.feedOnly);
    this.shell = new PageShell(container, {
      title: "Subagents",
      width: "wide",
      headerClass: "chatobby-subagents__header",
      titleClass: "chatobby-subagents__title-main",
      actionsClass: "chatobby-subagents__header-actions",
      tabsClass: "chatobby-subagents__tabs",
      bodyClass: "chatobby-subagents__body",
      containedBody: this.feedOnly,
    });
    this.renderHeaderActions();
    this.renderTabs();
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

  private renderHeaderActions(): void {
    const actions = this.shell?.actions;
    if (!actions) return;
    if (this.feedOnly) {
      const supervisor = createPageIconButton(actions, "arrow-left", "Back to subagents", {
        className: "chatobby-subagents__icon-button",
      });
      supervisor.addEventListener("click", () => {
        this.props.onOpenManagement();
      });
      return;
    }
    if (!this.props.workspacePage) {
    const start = createPageIconButton(actions, "plus", "New run", {
      className: "chatobby-subagents__icon-button",
    });
    this.startButton = start;
    start.setAttr("aria-pressed", String(this.startExpanded));
    start.addEventListener("click", () => {
      this.startExpanded = !this.startExpanded;
      this.startButton?.setAttr("aria-pressed", String(this.startExpanded));
      this.renderBody();
    });
    }
    const refresh = createPageIconButton(actions, "refresh-cw", "Refresh subagents", {
      className: "chatobby-subagents__icon-button",
    });
    refresh.addEventListener("click", () => void this.props.actions.refresh());
    if (!this.props.workspacePage) {
    const clear = createPageIconButton(actions, "trash-2", "Delete this session's subagent data", {
      className: "chatobby-subagents__icon-button is-danger",
    });
    clear.addEventListener("click", () => void this.props.actions.deleteSession());
    }
    createPageIconButton(actions, "x", "Close subagents", {
      className: "chatobby-subagents__icon-button",
    }).addEventListener("click", this.props.onBack);
  }

  private renderTabs(): void {
    const shell = this.shell;
    if (!shell) return;
    if (this.feedOnly) {
      shell.setTabs([]);
      return;
    }
    const labels: ReadonlyArray<readonly [SubagentScreenTab, string]> = [
      ["runs", this.props.workspacePage ? "Activity" : "Runs"],
      ["inbox", this.props.workspacePage ? "Requests" : "Inbox"],
      ["agents", this.props.workspacePage ? "Roles and settings" : "Roles"],
      ...(!this.props.workspacePage ? [["settings", "Settings"] as const] : []),
    ];
    shell.setTabs(labels.map(([tab, label]) => ({
      id: tab,
      label,
      active: this.tab === tab,
      onSelect: () => {
        if (this.tab === tab) return;
        this.tab = tab;
        this.renderTabs();
        this.renderBody();
      },
    })));
  }

  private renderBody(): void {
    const shell = this.shell;
    if (!shell) return;
    const state = this.props.store.getSnapshot();
    this.renderStatus(state);
    this.renderTitle(state);
    if (this.feedOnly) {
      if (!this.conversation) {
        this.conversation = new AgentConversationView({
          actions: this.props.actions,
          createFeedHost: this.props.createFeedHost,
        });
        this.conversation.render(shell.body);
      }
      this.conversation.update(state);
      return;
    }
    this.conversation?.destroy();
    this.conversation = null;
    shell.updateBody(`subagents:${this.tab}:${this.tab === "agents" ? state.roleScopeId ?? "session" : ""}`, (body) => {
      if (this.startExpanded) this.renderStartForm(body, state);
      if (state.syncStatus === "loading" && state.runtimeId === null) {
        createPageState(body, {
          kind: "loading",
          title: "Loading subagents",
          description: "Reading runs, roles, and messages.",
        });
        return;
      }
      if (state.syncStatus === "error" && state.runtimeId === null) {
        createPageState(body, {
          kind: "error",
          title: "Subagents are unavailable",
          description: state.error ?? "The supervisor could not be reached.",
        });
        return;
      }
      if (this.tab === "runs") {
        this.renderOverview(body, state);
        if (this.props.workspacePage) {
          renderActiveAgents(body, state, this.props.actions);
          const history = body.createEl("details", { cls: "chatobby-subagents__history", attr: { "data-page-state-key": "subagents:history" } });
          history.createEl("summary", { text: "Earlier agents and conversations" });
          renderRunWorkspace(history.createDiv(), state, this.props.actions);
        } else renderRunWorkspace(body, state, this.props.actions);
      }
      else if (this.tab === "inbox") renderInboxPanel(body, state, this.props.actions);
      else if (this.tab === "agents") {
        renderAgentsPanel(body, state, this.props.actions);
        if (this.props.workspacePage) renderSettingsPanel(body, state, this.props.actions);
      }
      else renderSettingsPanel(body, state, this.props.actions);
    });
  }

  private renderTitle(state = this.props.store.getSnapshot()): void {
    const run = state.selectedRunId ? state.runs.get(state.selectedRunId) : undefined;
    const node = run && state.selectedNodeId ? run.nodes[state.selectedNodeId] : undefined;
    const agentName = node?.agentName?.trim()
      || node?.agentId.split(/[-_]/u).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
    this.shell?.setTitle(this.feedOnly ? agentName ?? "Agent feed" : "Subagents");
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
      ["Working agents", String(working)],
      ["Idle agents", String(summaries.reduce((total, run) => total + run.waitingNodes, 0))],
      ...(pendingUserMessages.length + pendingDecisions > 0 ? [["Needs you", String(pendingUserMessages.length + pendingDecisions)] as const] : []),
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
    const message = this.actionStatus
	  ?? state.statusMessage
      ?? (state.syncStatus === "gap" ? "Some live updates were missed. Refreshing subagent activity…" : null)
      ?? (state.syncStatus === "error" ? state.error : null);
    this.shell?.setStatus(message
      ? {
          tone: state.syncStatus === "error" ? "error" : "info",
          message,
        }
      : null);
  }

  private renderStartForm(host: HTMLElement, state: SubagentViewState): void {
    const form = host.createEl("form", { cls: "chatobby-subagents__start" });
    const heading = form.createDiv({ cls: "chatobby-subagents__start-heading" });
    heading.createDiv({ cls: "chatobby-subagents__editor-title", text: "New run" });
    const grid = form.createDiv({ cls: "chatobby-subagents__start-grid" });
    const description = addInput(grid, "Name", "Research migration options", "subagent:start:name");
    const task = addTextArea(grid, "Task", "Outcome, constraints, and evidence needed", "subagent:start:task");
    const roleOptions = state.definitions.filter((item) => item.enabled).map((item): readonly [string, string] => [item.id, item.name]);
    if (!roleOptions.some(([id]) => id === "general-purpose")) roleOptions.unshift(["general-purpose", "General purpose"]);
    const role = addSelect(grid, "Role", roleOptions, "subagent:start:role");
    const advanced = form.createEl("details", { cls: "chatobby-subagents__role-advanced" });
    advanced.createEl("summary", { text: "Advanced runtime options" });
    const advancedGrid = advanced.createDiv({ cls: "chatobby-subagents__role-advanced-grid" });
    const executor = addSelect(advancedGrid, "Executor", [["auto", "Automatic"], ["in-process", "In process"], ["worker-process", "Worker process"]], "subagent:start:executor");
    const context = addSelect(advancedGrid, "Starting context", [["fresh", "Fresh"], ["fork", "Parent conversation"]], "subagent:start:context");
    const workspace = addSelect(advancedGrid, "Workspace", [["shared", "Shared working directory"], ["worktree", "Isolated worktree"]], "subagent:start:workspace");
    const priority = addInput(advancedGrid, "Priority", "0", "subagent:start:priority");
    priority.type = "number";
    priority.value = "0";
    const controls = form.createDiv({ cls: "chatobby-subagents__start-actions" });
    const cancel = controls.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => {
      this.startExpanded = false;
      this.startButton?.setAttr("aria-pressed", "false");
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

function addInput(host: HTMLElement, label: string, placeholder: string, stateKey: string): HTMLInputElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__field" });
  field.createSpan({ text: label });
  return field.createEl("input", { attr: { type: "text", placeholder, "data-page-state-key": stateKey } });
}

function addTextArea(host: HTMLElement, label: string, placeholder: string, stateKey: string): HTMLTextAreaElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__field is-wide" });
  field.createSpan({ text: label });
  return field.createEl("textarea", { attr: { placeholder, "data-page-state-key": stateKey } });
}

function addSelect(
  host: HTMLElement,
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  stateKey: string,
): HTMLSelectElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__field" });
  field.createSpan({ text: label });
  const select = field.createEl("select", { attr: { "data-page-state-key": stateKey } });
  for (const [value, text] of options) select.createEl("option", { text, attr: { value } });
  return select;
}
