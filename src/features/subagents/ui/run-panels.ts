import { setIcon } from "obsidian";
import type {
  FrontendSubagentNodeViewModel as SubagentNodeSnapshot,
  FrontendSubagentResolvedExecutionMode as ResolvedSubagentExecutionMode,
  FrontendSubagentRunFilter as SubagentRunQuery,
  FrontendSubagentRunStatus as SubagentRunStatus,
  FrontendSubagentRunSummaryViewModel as SubagentRunSummary,
  FrontendSubagentRunViewModel as SubagentRunSnapshot,
  FrontendSubagentWorkflowNodeDefinition as WorkflowNodeDefinition,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SubagentViewState } from "../state/subagent-store";
import type { SubagentScreenActions } from "../domain/screen-model";
import { renderArtifacts, renderPendingDecision } from "./agent-resources";

export function renderRunWorkspace(
  host: HTMLElement,
  state: SubagentViewState,
  actions: SubagentScreenActions,
): void {
  const hasRuns = state.runIds.length > 0;
  const layout = host.createDiv({
    cls: `chatobby-subagents__run-layout${hasRuns ? "" : " is-empty"}`,
  });
  renderRunList(layout, state, actions);
  if (!hasRuns) return;
  renderRunDetail(layout, state, actions);
}

function renderRunList(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const panel = host.createDiv({ cls: "chatobby-subagents__panel chatobby-subagents__run-list" });
  const heading = panel.createDiv({ cls: "chatobby-subagents__panel-heading" });
  heading.createSpan({ cls: "chatobby-subagents__panel-title", text: "Runs" });
  heading.createSpan({ cls: "chatobby-subagents__count", text: `${state.runIds.length}${state.nextRunCursor ? "+" : ""}` });
  const hasActiveFilters = Object.values(state.runQuery).some((value) => value !== undefined);
  if (state.runIds.length > 0 || hasActiveFilters) renderRunFilters(panel, state, actions);
  if (state.runIds.length === 0) {
    panel.createDiv({
      cls: "chatobby-subagents__empty",
      text: hasActiveFilters ? "No matching runs." : "No runs yet.",
    });
    return;
  }
  const list = panel.createDiv({ cls: "chatobby-subagents__run-items", attr: { role: "list" } });
  for (const runId of state.runIds) {
    const run = state.runSummaries.get(runId);
    if (!run) continue;
    const button = list.createEl("button", {
      cls: `chatobby-subagents__run${state.selectedRunId === run.id ? " is-active" : ""}`,
      attr: { type: "button", role: "listitem", "aria-pressed": String(state.selectedRunId === run.id) },
    });
    button.addEventListener("click", () => void actions.selectRun(run.id));
    const top = button.createDiv({ cls: "chatobby-subagents__run-top" });
    top.createSpan({ cls: "chatobby-subagents__run-name", text: run.description });
    renderStatusIcon(top, run.status);
    renderRunMeta(button, run);
  }
  if (state.nextRunCursor) {
    const more = panel.createEl("button", {
      cls: "chatobby-subagents__load-more",
      text: "Load older runs",
      attr: { type: "button" },
    });
    more.addEventListener("click", () => void actions.loadMoreRuns());
  }
}

function renderRunFilters(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const disclosure = host.createEl("details", { cls: "chatobby-subagents__run-filter-disclosure" });
  const activeCount = Object.values(state.runQuery).filter((value) => value !== undefined).length;
  disclosure.open = activeCount > 0;
  disclosure.createEl("summary", { text: activeCount > 0 ? `Filter runs · ${activeCount} active` : "Filter runs" });
  const form = disclosure.createEl("form", { cls: "chatobby-subagents__run-filters" });
  const search = addRunFilter(form, "Search", state.runQuery.search ?? "", "Run name");
  const project = addRunFilter(form, "Project", state.runQuery.workspaceCwd ?? "", "Exact working directory");
  const agent = addRunFilter(form, "Agent", state.runQuery.agentId ?? "", "Role ID");
  const status = addRunFilterSelect(form, "Status", [
    ["", "All statuses"],
    ...(["created", "queued", "running", "paused", "waiting", "completed", "failed", "cancelled", "orphaned"] as const)
      .map((value): readonly [string, string] => [value, value]),
  ], state.runQuery.status?.[0] ?? "");
  const executor = addRunFilterSelect(form, "Executor", [
    ["", "All executors"],
    ["in-process", "In process"],
    ["worker-process", "Worker process"],
  ], state.runQuery.executionMode ?? "");
  const age = addRunFilterSelect(form, "Created", [
    ["", "Any time"],
    ["1", "Last 24 hours"],
    ["7", "Last 7 days"],
    ["30", "Last 30 days"],
  ], ageFromCreatedAfter(state.runQuery.createdAfter));
  const controls = form.createDiv({ cls: "chatobby-subagents__run-filter-actions" });
  const clear = controls.createEl("button", { text: "Clear", attr: { type: "button" } });
  clear.addEventListener("click", () => void actions.filterRuns({}));
  controls.createEl("button", { cls: "mod-cta", text: "Apply", attr: { type: "submit" } });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const statusValue = status.value as SubagentRunStatus | "";
    const executionMode = executor.value as ResolvedSubagentExecutionMode | "";
    const days = Number(age.value);
    const query: Omit<SubagentRunQuery, "cursor" | "limit"> = {
      search: search.value.trim() || undefined,
      workspaceCwd: project.value.trim() || undefined,
      agentId: agent.value.trim() || undefined,
      status: statusValue ? [statusValue] : undefined,
      executionMode: executionMode || undefined,
      createdAfter: Number.isFinite(days) && days > 0 ? Date.now() - days * 86_400_000 : undefined,
    };
    void actions.filterRuns(query);
  });
}

function addRunFilter(host: HTMLElement, label: string, value: string, placeholder: string): HTMLInputElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__management-field" });
  field.createSpan({ text: label });
  const input = field.createEl("input", { attr: { type: "text", placeholder } });
  input.value = value;
  return input;
}

function addRunFilterSelect(
  host: HTMLElement,
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  value: string,
): HTMLSelectElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__management-field" });
  field.createSpan({ text: label });
  const select = field.createEl("select");
  for (const [optionValue, text] of options) select.createEl("option", { text, attr: { value: optionValue } });
  select.value = value;
  return select;
}

function ageFromCreatedAfter(createdAfter: number | undefined): string {
  if (createdAfter === undefined) return "";
  const days = Math.max(1, Math.round((Date.now() - createdAfter) / 86_400_000));
  if (days <= 1) return "1";
  if (days <= 7) return "7";
  return "30";
}

function renderRunMeta(host: HTMLElement, run: SubagentRunSummary): void {
  const meta = host.createDiv({ cls: "chatobby-subagents__run-meta" });
  meta.createSpan({ text: `${run.agentIds.length} agent${run.agentIds.length === 1 ? "" : "s"}` });
  if (run.failedNodes > 0) meta.createSpan({ cls: "is-danger", text: `${run.failedNodes} failed` });
  meta.createSpan({ text: relativeTime(run.updatedAt) });
}

function renderRunDetail(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const panel = host.createDiv({ cls: "chatobby-subagents__panel chatobby-subagents__detail" });
  const selectedId = state.selectedRunId;
  if (!selectedId) {
    panel.createDiv({ cls: "chatobby-subagents__empty", text: "Select a run." });
    return;
  }
  const run = state.runs.get(selectedId);
  if (!run) {
    panel.createDiv({ cls: "chatobby-subagents__loading", text: "Loading complete run state…" });
    return;
  }
  renderDetailHeader(panel, run, state.selectedNodeId, actions);
  renderLatestControlReceipt(panel, run, state);
  renderNodeGraph(panel, run, state.selectedNodeId, actions);
  renderRunManagement(panel, run, state.selectedNodeId, actions);
  const selectedNode = state.selectedNodeId ? run.nodes[state.selectedNodeId] : undefined;
  if (selectedNode) renderNodeInspector(panel, run, selectedNode, state, actions);
}

function renderRunManagement(
  host: HTMLElement,
  run: SubagentRunSnapshot,
  selectedNodeId: string | null,
  actions: SubagentScreenActions,
): void {
  const details = host.createEl("details", { cls: "chatobby-subagents__advanced" });
  details.createEl("summary", { text: "Advanced run controls" });
  const body = details.createDiv({ cls: "chatobby-subagents__advanced-body" });

  const priorityForm = body.createEl("form", { cls: "chatobby-subagents__management-row" });
  const priority = addManagementField(priorityForm, "Priority", String(selectedNodeId ? run.nodes[selectedNodeId]?.priority ?? run.priority : run.priority), "number");
  priorityForm.createSpan({
    cls: "chatobby-subagents__management-hint",
    text: selectedNodeId ? `Applies to ${selectedNodeId}` : "Applies to the run",
  });
  priorityForm.createEl("button", { text: "Apply priority", attr: { type: "submit" } });
  priorityForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = Number(priority.value);
    if (Number.isFinite(value)) {
      void actions.control(run.id, selectedNodeId ?? undefined, "reprioritize", { priority: value });
    }
  });

  const stepForm = body.createEl("form", { cls: "chatobby-subagents__append-form" });
  stepForm.createDiv({ cls: "chatobby-subagents__section-label", text: "Append workflow step" });
  const fields = stepForm.createDiv({ cls: "chatobby-subagents__append-grid" });
  const id = addManagementField(fields, "Node ID", "", "text", "verify-output");
  const agent = addManagementField(fields, "Agent role", "general-purpose", "text");
  const label = addManagementField(fields, "Label", "", "text", "Verify output");
  const dependencies = addManagementField(fields, "Dependencies", selectedNodeId ?? "", "text", "Comma-separated node IDs");
  const task = addManagementField(fields, "Task", "", "text", "Complete task for the appended agent");
  for (const input of [id, agent, label, task]) input.required = true;
  stepForm.createEl("button", { cls: "mod-cta", text: "Append step", attr: { type: "submit" } });
  stepForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const step: WorkflowNodeDefinition = {
      id: id.value.trim(),
      agentId: agent.value.trim(),
      label: label.value.trim(),
      task: task.value.trim(),
      dependsOn: dependencies.value.split(",").map((item) => item.trim()).filter(Boolean),
    };
    void actions.control(run.id, undefined, "append-step", { step });
  });
}

function addManagementField(
  host: HTMLElement,
  label: string,
  value: string,
  type: "number" | "text",
  placeholder = "",
): HTMLInputElement {
  const field = host.createEl("label", { cls: "chatobby-subagents__management-field" });
  field.createSpan({ text: label });
  const input = field.createEl("input", { attr: { type, placeholder } });
  input.value = value;
  return input;
}

function renderDetailHeader(
  host: HTMLElement,
  run: SubagentRunSnapshot,
  nodeId: string | null,
  actions: SubagentScreenActions,
): void {
  const header = host.createDiv({ cls: "chatobby-subagents__detail-header" });
  const title = header.createDiv();
  title.createDiv({ cls: "chatobby-subagents__detail-title", text: run.description });
  title.createDiv({
    cls: "chatobby-subagents__detail-subtitle",
    text: `${titleCase(run.status)} · ${formatTimestamp(run.updatedAt)}`,
  });
  const controls = header.createDiv({ cls: "chatobby-subagents__controls" });
  if (run.status === "running") addControl(controls, "pause", "Pause", () => actions.control(run.id, undefined, "pause"));
  if (run.status === "paused") {
    addControl(controls, "play", "Resume", () => actions.control(run.id, undefined, "resume"));
  }
  if (run.status === "running") {
    addControl(controls, "square", "Interrupt", () => actions.control(run.id, nodeId ?? undefined, "interrupt"));
  }
  if (["running", "queued", "paused", "waiting"].includes(run.status)) {
    addControl(controls, "x", "Cancel", () => actions.control(run.id, undefined, "cancel"), true);
  }
  if (["failed", "cancelled", "orphaned"].includes(run.status)) {
    addControl(controls, "rotate-ccw", "Retry", () => actions.control(run.id, nodeId ?? undefined, "retry"));
  }
  if (run.status === "orphaned") {
    addControl(controls, "refresh-ccw", "Reconcile orphan", () => actions.control(run.id, nodeId ?? undefined, "reconcile-orphan"));
  }
  addControl(controls, "copy", "Clone run", () => actions.control(run.id, undefined, "clone"));
  if (nodeId) addControl(controls, "git-fork", "Fork from node", () => actions.control(run.id, nodeId, "fork"));
}

function renderLatestControlReceipt(host: HTMLElement, run: SubagentRunSnapshot, state: SubagentViewState): void {
  const receipts = [...state.controlReceipts.values()]
    .filter((receipt) => receipt.runId === run.id)
    .sort((left, right) => right.timestamp - left.timestamp);
  const latest = receipts[0];
  if (!latest) return;
  host.createDiv({
    cls: `chatobby-subagents__control-receipt is-${latest.state}`,
    text: `${latest.action.replaceAll("-", " ")} · ${latest.state}${latest.message ? ` · ${latest.message}` : ""}`,
  });
}

function renderNodeGraph(host: HTMLElement, run: SubagentRunSnapshot, selectedNodeId: string | null, actions: SubagentScreenActions): void {
  const graph = host.createDiv({ cls: "chatobby-subagents__graph", attr: { "aria-label": "Workflow nodes" } });
  for (const node of Object.values(run.nodes)) {
    const button = graph.createEl("button", {
      cls: `chatobby-subagents__node is-${node.status}${selectedNodeId === node.id ? " is-active" : ""}`,
      attr: { type: "button", title: node.task },
    });
    button.addEventListener("click", () => void actions.selectNode(run.id, node.id));
    renderNodeStatusIcon(button, node.status);
    const text = button.createSpan({ cls: "chatobby-subagents__node-text" });
    text.createSpan({ cls: "chatobby-subagents__node-label", text: node.label });
    text.createSpan({ cls: "chatobby-subagents__node-agent", text: agentName(node) });
    if (node.dependsOn.length > 0) button.createSpan({ cls: "chatobby-subagents__node-deps", text: `← ${node.dependsOn.join(", ")}` });
  }
}

function renderNodeInspector(
  host: HTMLElement,
  run: SubagentRunSnapshot,
  node: SubagentNodeSnapshot,
  state: SubagentViewState,
  actions: SubagentScreenActions,
): void {
  const inspector = host.createDiv({ cls: "chatobby-subagents__inspector" });
  const technical = inspector.createEl("details", { cls: "chatobby-subagents__advanced chatobby-subagents__technical" });
  technical.createEl("summary", { text: "Technical details" });
  const facts = technical.createDiv({ cls: "chatobby-subagents__facts" });
  addFact(facts, "Executor", node.resolvedExecutionMode ?? node.requestedExecutionMode);
  addFact(
    facts,
    "Model",
    node.model ?? modelFromRuntime(node.attempts.at(-1)?.runtimeFingerprint) ?? node.runtimePolicy?.model ?? "Resolving",
    node.runtimePolicy?.model ? undefined : "Inherited from the parent or role policy",
  );
  addFact(facts, "Turns", String(node.turns));
  addFact(facts, "Tokens", formatTokens(node.tokens));
  addFact(facts, "Context", node.contextPercent == null ? "—" : `${Math.round(node.contextPercent)}%`);
  if (node.currentTool) addFact(facts, "Current tool", node.currentTool);
  const latestAttempt = node.attempts.at(-1);
  if (latestAttempt?.runtimeFingerprint) addFact(facts, "Runtime", latestAttempt.runtimeFingerprint);
  addFact(facts, "Workspace", run.workspace.provider);
  addFact(facts, "CWD", run.workspace.resolvedCwd);
  addFact(facts, "Changed files", String(run.workspace.changedFiles.length));

  const task = inspector.createDiv({ cls: "chatobby-subagents__task" });
  task.createDiv({ cls: "chatobby-subagents__section-label", text: "Task" });
  task.createDiv({ cls: "chatobby-subagents__task-copy", text: node.task });
  if (node.result) {
    task.createDiv({ cls: "chatobby-subagents__section-label", text: "Result" });
    task.createDiv({ cls: "chatobby-subagents__result", text: node.result });
  }
  if (node.error) {
    task.createDiv({ cls: "chatobby-subagents__section-label", text: "Failure" });
    task.createDiv({ cls: "chatobby-subagents__failure", text: node.error });
  }

  renderPendingDecision(inspector, run.id, node, actions);
  renderOpenChildFeed(inspector, run.id, node.id, agentName(node), false);
  renderArtifacts(inspector, state.artifacts.get(run.id) ?? [], actions);
}

function renderOpenChildFeed(
  host: HTMLElement,
  runId: string,
  nodeId: string,
  label: string,
  compact: boolean,
): void {
  const button = host.createEl("button", {
    cls: `chatobby-subagents__open-feed${compact ? " is-compact" : ""}`,
    attr: { type: "button", title: `Open ${label} feed`, "aria-label": `Open ${label} feed` },
  });
  if (!compact) button.createSpan({ text: `Open ${label} feed` });
  const icon = button.createSpan();
  setIcon(icon, "arrow-up-right");
  button.addEventListener("click", () => {
    button.dispatchEvent(new CustomEvent("chatobby:open-subagents", {
      bubbles: true,
      detail: { runId, nodeId, feedOnly: true },
    }));
  });
}

function addControl(host: HTMLElement, icon: string, label: string, action: () => Promise<void>, danger = false): void {
  const button = host.createEl("button", {
    cls: `chatobby-subagents__icon-button${danger ? " is-danger" : ""}`,
    attr: { type: "button", title: label, "aria-label": label },
  });
  setIcon(button, icon);
  button.addEventListener("click", () => void runPendingAction([button], action));
}

async function runPendingAction(buttons: HTMLButtonElement[], action: () => Promise<void>): Promise<void> {
  for (const button of buttons) button.disabled = true;
  try {
    await action();
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}

function addFact(host: HTMLElement, label: string, value: string, hint?: string): void {
  const fact = host.createDiv({ cls: "chatobby-subagents__fact" });
  fact.createSpan({ cls: "chatobby-subagents__fact-label", text: label });
  fact.createSpan({ cls: "chatobby-subagents__fact-value", text: value });
  if (hint) fact.createSpan({ cls: "chatobby-subagents__fact-hint", text: hint });
}

function agentName(node: SubagentNodeSnapshot): string {
  if (node.agentName?.trim()) return node.agentName.trim();
  return node.agentId.split(/[-_]/u).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function modelFromRuntime(runtimeFingerprint: string | undefined): string | undefined {
  if (!runtimeFingerprint?.startsWith("in-process:")) return undefined;
  const model = runtimeFingerprint.slice("in-process:".length);
  return model === "unresolved-model" ? undefined : model;
}

function formatTokens(tokens: number): string {
  if (tokens < 1_000) return `${tokens} tok`;
  return `${(tokens / 1_000).toFixed(tokens < 10_000 ? 1 : 0)}k tok`;
}

function relativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`;
  return `${Math.floor(elapsed / 86_400_000)}d`;
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function titleCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function renderStatusIcon(host: HTMLElement, status: SubagentRunStatus): void {
  const indicator = host.createSpan({
    cls: `chatobby-subagents__status-icon is-${status}`,
    attr: { title: titleCase(status), "aria-label": titleCase(status) },
  });
  setIcon(indicator, statusIcon(status));
}

function renderNodeStatusIcon(host: HTMLElement, status: string): void {
  const indicator = host.createSpan({
    cls: `chatobby-subagents__node-state is-${status}`,
    attr: { title: titleCase(status), "aria-label": titleCase(status) },
  });
  setIcon(indicator, statusIcon(status));
}

function statusIcon(status: string): string {
  if (status === "running") return "loader-circle";
  if (status === "completed") return "check";
  if (status === "failed") return "triangle-alert";
  if (status === "paused") return "pause";
  if (status === "cancelled") return "x";
  if (status === "orphaned") return "unplug";
  return "clock-3";
}
