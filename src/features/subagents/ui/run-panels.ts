import { setIcon } from "obsidian";
import type {
  FrontendSubagentNodeViewModel as SubagentNodeSnapshot,
  FrontendSubagentRunFilter as SubagentRunQuery,
  FrontendSubagentRunStatus as SubagentRunStatus,
  FrontendSubagentRunSummaryViewModel as SubagentRunSummary,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SubagentViewState } from "../state/subagent-store";
import type { SubagentScreenActions } from "../domain/screen-model";
import { renderPendingDecision } from "./agent-resources";

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
  heading.createSpan({ cls: "chatobby-subagents__panel-title", text: "Agent history" });
  heading.createSpan({ cls: "chatobby-subagents__count", text: `${state.runIds.length}${state.nextRunCursor ? "+" : ""}` });
  const hasActiveFilters = Object.values(state.runQuery).some((value) => value !== undefined);
  if (state.runIds.length > 0 || hasActiveFilters) renderRunFilters(panel, state, actions);
  if (state.runIds.length === 0) {
    panel.createDiv({
      cls: "chatobby-subagents__empty",
      text: hasActiveFilters ? "No matching agents." : "No agent history yet.",
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
    top.createSpan({ cls: "chatobby-subagents__run-name", text: run.agentIds.map((id) => id.replaceAll("-", " ")).join(", ") || run.description });
    renderStatusIcon(top, run.status);
    renderRunMeta(button, run);
  }
  if (state.nextRunCursor) {
    const more = panel.createEl("button", {
      cls: "chatobby-subagents__load-more",
      text: "Load older agents",
      attr: { type: "button" },
    });
    more.addEventListener("click", () => void actions.loadMoreRuns());
  }
}

function renderRunFilters(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const disclosure = host.createEl("details", { cls: "chatobby-subagents__run-filter-disclosure" });
  const activeCount = Object.values(state.runQuery).filter((value) => value !== undefined).length;
  disclosure.open = activeCount > 0;
  disclosure.createEl("summary", { text: activeCount > 0 ? `Filter history · ${activeCount} active` : "Filter history" });
  const form = disclosure.createEl("form", { cls: "chatobby-subagents__run-filters" });
  const search = addRunFilter(form, "Search", state.runQuery.search ?? "", "Search earlier assignments");
  const status = addRunFilterSelect(form, "Status", [
    ["", "All statuses"],
    ...(["created", "queued", "running", "paused", "waiting", "completed", "failed", "cancelled", "orphaned"] as const)
      .map((value): readonly [string, string] => [value, value]),
  ], state.runQuery.status?.[0] ?? "");
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
    const days = Number(age.value);
    const query: Omit<SubagentRunQuery, "cursor" | "limit"> = {
      search: search.value.trim() || undefined,
      status: statusValue ? [statusValue] : undefined,
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
  const run = state.selectedRunId ? state.runs.get(state.selectedRunId) : undefined;
  if (!run) {
    panel.createDiv({ cls: "chatobby-subagents__empty", text: state.selectedRunId ? "Loading conversation history…" : "Choose an agent to open its conversation." });
    return;
  }
  for (const node of Object.values(run.nodes)) {
    const card = panel.createDiv({ cls: "chatobby-subagents__history-agent" });
    const header = card.createDiv({ cls: "chatobby-subagents__history-agent-heading" });
    renderNodeStatusIcon(header, node.status);
    const copy = header.createDiv({ cls: "chatobby-subagents__history-agent-copy" });
    copy.createDiv({ cls: "chatobby-subagents__detail-title", text: agentName(node) });
    copy.createDiv({ cls: "chatobby-subagents__detail-subtitle", text: `${titleCase(node.status)} · ${formatTimestamp(run.updatedAt)}` });
    if (["running", "queued", "paused", "waiting"].includes(node.status)) {
      addControl(header, "square", "Stop agent", () => actions.control(run.id, node.id, "cancel"), true);
    }
    if (node.error) card.createDiv({ cls: "chatobby-subagents__failure", text: node.error });
    renderPendingDecision(card, run.id, node, actions);
    renderOpenChildFeed(card, run.id, node.id, agentName(node), false);
  }
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

function agentName(node: SubagentNodeSnapshot): string {
  if (node.agentName?.trim()) return node.agentName.trim();
  return node.agentId.split(/[-_]/u).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
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
