import type {
  FrontendSubagentAgentDefinition as AgentDefinition,
  FrontendSubagentSettingsViewModel as ResolvedSubagentSettings,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SubagentScreenActions } from "../domain/screen-model";
import type { SubagentViewState } from "../state/subagent-store";
import { renderWorkflowEditor } from "./workflow-editor";

const MILLISECONDS_PER_MINUTE = 60_000;
export function renderAgentsPanel(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const toolbar = host.createDiv({ cls: "chatobby-subagents__catalog-header" });
  toolbar.createDiv({ cls: "chatobby-subagents__detail-title", text: "Roles" });
  const add = toolbar.createEl("button", { text: "New", attr: { type: "button" } });
  const editor = host.createDiv({ cls: "chatobby-subagents__editor is-hidden" });
  add.addEventListener("click", () => renderAgentEditor(editor, null, state, actions));
  const grid = host.createDiv({ cls: "chatobby-subagents__catalog-grid" });
  for (const definition of state.definitions) {
    const card = grid.createDiv({ cls: `chatobby-subagents__catalog-card${definition.enabled ? "" : " is-disabled"}` });
    const top = card.createDiv({ cls: "chatobby-subagents__catalog-top" });
    top.createDiv({ cls: "chatobby-subagents__catalog-name", text: definition.name });
    top.createSpan({ cls: "chatobby-subagents__scope", text: scopeLabel(definition.scope) });
    card.createDiv({ cls: "chatobby-subagents__catalog-description", text: definition.description });
    const details = card.createEl("details", { cls: "chatobby-subagents__catalog-details" });
    details.createEl("summary", { text: "Details" });
    const meta = details.createDiv({ cls: "chatobby-subagents__catalog-meta" });
    meta.createSpan({ text: definition.policy.model ?? "Inherit model" });
    meta.createSpan({ text: definition.policy.executionMode ?? "Automatic executor" });
    meta.createSpan({ text: definition.policy.contextMode ?? "Fresh context" });
    meta.createSpan({ text: permissionPolicyLabel(state, definition.id) });
    const controls = card.createDiv({ cls: "chatobby-subagents__catalog-actions" });
    const edit = controls.createEl("button", { text: "Edit", attr: { type: "button" } });
    edit.addEventListener("click", () => renderAgentEditor(editor, definition, state, actions));
    const remove = controls.createEl("button", { cls: "mod-warning", text: "Delete", attr: { type: "button" } });
    remove.addEventListener("click", () => void actions.deleteDefinition(definition));
  }
  if (state.definitions.length === 0) grid.createDiv({ cls: "chatobby-subagents__empty", text: "No roles yet." });
}

export function renderWorkflowsPanel(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const toolbar = host.createDiv({ cls: "chatobby-subagents__catalog-header" });
  toolbar.createDiv({ cls: "chatobby-subagents__detail-title", text: "Flows" });
  const add = toolbar.createEl("button", { text: "New", attr: { type: "button" } });
  const editor = host.createDiv({ cls: "chatobby-subagents__editor is-hidden" });
  add.addEventListener("click", () => renderWorkflowEditor(editor, null, state, actions));
  const grid = host.createDiv({ cls: "chatobby-subagents__catalog-grid" });
  for (const workflow of state.workflows) {
    const card = grid.createDiv({ cls: "chatobby-subagents__catalog-card" });
    const top = card.createDiv({ cls: "chatobby-subagents__catalog-top" });
    top.createDiv({ cls: "chatobby-subagents__catalog-name", text: workflow.name });
    top.createSpan({ cls: "chatobby-subagents__scope", text: `${workflow.nodes.length} step${workflow.nodes.length === 1 ? "" : "s"}` });
    card.createDiv({ cls: "chatobby-subagents__catalog-description", text: workflow.description });
    const controls = card.createDiv({ cls: "chatobby-subagents__catalog-actions" });
    const run = controls.createEl("button", { cls: "mod-cta", text: "Run", attr: { type: "button" } });
    run.addEventListener("click", () => void actions.startWorkflow(workflow));
    const edit = controls.createEl("button", { text: "Edit", attr: { type: "button" } });
    edit.addEventListener("click", () => renderWorkflowEditor(editor, workflow, state, actions));
    const remove = controls.createEl("button", { cls: "mod-warning", text: "Delete", attr: { type: "button" } });
    remove.addEventListener("click", () => void actions.deleteWorkflow(workflow));
  }
  if (state.workflows.length === 0) grid.createDiv({ cls: "chatobby-subagents__empty", text: "No flows yet." });
}

export function renderSettingsPanel(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const resolved = state.settings;
  if (!resolved) {
    host.createDiv({ cls: "chatobby-subagents__empty", text: "Supervisor settings are unavailable until the backend snapshot loads." });
    return;
  }
  const form = host.createEl("form", { cls: "chatobby-subagents__settings" });
  form.createDiv({ cls: "chatobby-subagents__detail-title", text: "Settings" });
  const concurrency = addNumberField(form, "Agents working at once", resolved.settings.maxConcurrency, 1, 64);
  const sibling = addToggleField(form, "Allow agents to message each other", resolved.settings.allowSiblingCommunication);
  const advanced = form.createEl("details", { cls: "chatobby-subagents__role-advanced" });
  advanced.createEl("summary", { text: "Advanced supervisor limits" });
  const advancedGrid = advanced.createDiv({ cls: "chatobby-subagents__role-advanced-grid" });
  const depth = addNumberField(advancedGrid, "Maximum delegation depth", resolved.settings.defaultMaxDepth, 0, 16);
  const retention = addNumberField(advancedGrid, "Keep completed runs (days)", resolved.settings.retentionDays, 1, 3650);
  const mode = addSelectField(advancedGrid, "Default executor", resolved.settings.defaultExecutionMode, ["auto", "in-process", "worker-process"]);
  const turns = addOptionalNumberField(advancedGrid, "Default turn limit", resolved.settings.defaultMaxTurnsPerNode);
  const tokens = addOptionalNumberField(advancedGrid, "Default token budget", resolved.settings.defaultMaxTokens);
  const minutes = addOptionalNumberField(
    advancedGrid,
    "Default time budget (minutes)",
    resolved.settings.defaultMaxWallTimeMs === undefined
      ? undefined
      : resolved.settings.defaultMaxWallTimeMs / MILLISECONDS_PER_MINUTE,
  );
  const actionsRow = form.createDiv({ cls: "chatobby-subagents__settings-actions" });
  const submit = actionsRow.createEl("button", { cls: "mod-cta", text: "Save controls", attr: { type: "submit" } });
  submit.disabled = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const defaultMinutes = optionalPositiveNumber(minutes.value);
    const next: ResolvedSubagentSettings = {
      ...resolved,
      settings: {
        ...resolved.settings,
        maxConcurrency: Number(concurrency.value),
        defaultMaxDepth: Number(depth.value),
        retentionDays: Number(retention.value),
        defaultExecutionMode: mode.value as ResolvedSubagentSettings["settings"]["defaultExecutionMode"],
        allowSiblingCommunication: sibling.checked,
        defaultMaxTurnsPerNode: optionalPositiveNumber(turns.value),
        defaultMaxTokens: optionalPositiveNumber(tokens.value),
        defaultMaxWallTimeMs: defaultMinutes === undefined
          ? undefined
          : defaultMinutes * MILLISECONDS_PER_MINUTE,
      },
    };
    void actions.updateSettings(next);
  });
}

function renderAgentEditor(
  host: HTMLElement,
  existing: AgentDefinition | null,
  state: SubagentViewState,
  actions: SubagentScreenActions,
): void {
  host.empty();
  host.removeClass("is-hidden");
  const form = host.createEl("form");
  form.createDiv({ cls: "chatobby-subagents__editor-title", text: existing ? `Edit ${existing.name}` : "Create agent role" });
  const name = addTextField(form, "Role name", existing?.name ?? "", "Research assistant");
  const description = addTextField(form, "What is this role for?", existing?.description ?? "", "Finds, verifies, and summarizes research");
  const prompt = addTextAreaField(form, "Role instructions", existing?.systemPrompt ?? "", "Responsibilities, boundaries, diligence, evidence, and handoff expectations");
  prompt.parentElement?.addClass("is-wide");
  const model = addModelField(form, state, existing?.policy.model);
  const permission = addPermissionPolicyField(form, state, existing?.id, actions);
  const skills = addSkillPicker(form, state, new Set(existing?.policy.skills ?? []));

  const advanced = form.createEl("details", { cls: "chatobby-subagents__role-advanced" });
  advanced.createEl("summary", { text: "Advanced runtime settings" });
  const advancedGrid = advanced.createDiv({ cls: "chatobby-subagents__role-advanced-grid" });
  const id = addTextField(advancedGrid, "Role key", existing?.id ?? "", "Generated from the role name");
  const scope = addSelectField(advancedGrid, "Availability", existing?.scope ?? "vault", ["global", "vault", "directory", "session"]);
  const executor = addSelectField(advancedGrid, "Executor", existing?.policy.executionMode ?? "auto", ["auto", "in-process", "worker-process"]);
  const context = addSelectField(advancedGrid, "Starting context", existing?.policy.contextMode ?? "fresh", ["fresh", "fork", "selected", "summary"]);
  const thinking = addSelectField(advancedGrid, "Thinking", existing?.policy.thinking ?? "inherit", ["inherit", "off", "minimal", "low", "medium", "high", "xhigh"]);
  const maxDepth = addOptionalNumberField(advancedGrid, "Delegation depth limit", existing?.policy.maxDepth);
  const enabled = addToggleField(advancedGrid, "Role enabled", existing?.enabled ?? true);
  advancedGrid.createDiv({
    cls: "chatobby-subagents__scope-help",
    text: "Chatobby assigns the exact vault, directory, or session scope automatically.",
  });
  renderEditorActions(form, host, async () => {
    const roleId = id.value.trim() || slug(name.value);
    const definition: AgentDefinition = {
      id: roleId,
      name: name.value.trim(),
      description: description.value.trim(),
      scope: scope.value as AgentDefinition["scope"],
      scopeId: existing?.scopeId ?? "default",
      systemPrompt: prompt.value.trim(),
      enabled: enabled.checked,
      policy: {
        ...existing?.policy,
        executionMode: executor.value as NonNullable<AgentDefinition["policy"]["executionMode"]>,
        contextMode: context.value as NonNullable<AgentDefinition["policy"]["contextMode"]>,
        model: model.value.trim() || undefined,
        thinking: thinking.value === "inherit"
          ? undefined
          : thinking.value as NonNullable<AgentDefinition["policy"]["thinking"]>,
        tools: undefined,
        mcpTools: undefined,
        skills: skills.size > 0 ? [...skills] : undefined,
        maxDepth: optionalNonNegativeNumber(maxDepth.value),
      },
      revision: existing?.revision ?? 0,
      updatedAt: existing?.updatedAt ?? 0,
    };
    await actions.saveDefinition(definition, permission.value);
    host.addClass("is-hidden");
  });
}

function addModelField(host: HTMLElement, state: SubagentViewState, current: string | undefined): HTMLSelectElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: "Model" });
  const select = row.createEl("select", { attr: { "aria-label": "Role model" } });
  select.createEl("option", { text: "Inherit parent model", value: "" });
  const byProvider = new Map<string, typeof state.models>();
  for (const model of state.models) {
    byProvider.set(model.provider, [...(byProvider.get(model.provider) ?? []), model]);
  }
  for (const [provider, models] of [...byProvider.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const group = select.createEl("optgroup", { attr: { label: humanize(provider) } });
    for (const model of models) group.createEl("option", { text: model.name || model.id, value: model.id });
  }
  if (current && !state.models.some((model) => model.id === current)) {
    select.createEl("option", { text: `${current} (currently unavailable)`, value: current });
  }
  select.value = current ?? "";
  return select;
}

function addPermissionPolicyField(
  host: HTMLElement,
  state: SubagentViewState,
  roleId: string | undefined,
  actions: SubagentScreenActions,
): HTMLSelectElement {
  const row = host.createDiv({ cls: "chatobby-subagents__field" });
  row.createSpan({ text: "Permission policy" });
  const controls = row.createDiv({ cls: "chatobby-subagents__policy-field" });
  const select = controls.createEl("select", { attr: { "aria-label": "Role permission policy" } });
  select.createEl("option", { text: "Inherit parent policy", value: "inherit" });
  const snapshot = state.permissionSnapshot;
  for (const profile of snapshot?.document.profiles ?? []) {
    select.createEl("option", { text: profile.name, value: profile.id });
  }
  const assignment = roleId ? snapshot?.document.agentAssignments[roleId] : undefined;
  select.value = assignment?.mode === "profile" ? assignment.profileId : "inherit";
  const manage = controls.createEl("button", {
    text: "Manage policies",
    attr: { type: "button", title: "Open permission policies" },
  });
  manage.addEventListener("click", () => actions.openPermissions());
  return select;
}

function addSkillPicker(host: HTMLElement, state: SubagentViewState, selected: Set<string>): Set<string> {
  const details = host.createEl("details", { cls: "chatobby-subagents__choice-panel is-wide" });
  const summary = details.createEl("summary");
  summary.createSpan({ text: "User skills" });
  summary.createSpan({ cls: "chatobby-subagents__choice-summary", text: selected.size > 0 ? `${selected.size} selected` : "None selected" });
  details.createDiv({
    cls: "chatobby-subagents__catalog-copy",
    text: "Optional user skills for this role.",
  });
  if (state.skills.length === 0) {
    details.createDiv({ cls: "chatobby-subagents__empty is-compact", text: "No user skills are currently discoverable." });
    return selected;
  }
  addChoiceGroup(
    details,
    "Available skills",
    state.skills.map((skill) => ({ name: skill.name, label: humanize(skill.name), description: skill.description })),
    selected,
    summary,
    "None selected",
  );
  return selected;
}

function addChoiceGroup(
  host: HTMLElement,
  label: string,
  choices: readonly { name: string; label: string; description?: string }[],
  selected: Set<string>,
  summary: HTMLElement,
  emptySummary: string,
): void {
  const group = host.createDiv({ cls: "chatobby-subagents__choice-group" });
  group.createDiv({ cls: "chatobby-subagents__choice-title", text: label });
  const grid = group.createDiv({ cls: "chatobby-subagents__choice-grid" });
  for (const choice of choices) {
    const item = grid.createEl("label", { cls: "chatobby-subagents__choice" });
    const input = item.createEl("input", { attr: { type: "checkbox" } });
    input.checked = selected.has(choice.name);
    const copy = item.createDiv({ cls: "chatobby-subagents__choice-copy" });
    copy.createDiv({ cls: "chatobby-subagents__choice-name", text: choice.label });
    if (choice.description) copy.createDiv({ cls: "chatobby-subagents__choice-description", text: choice.description });
    input.addEventListener("change", () => {
      if (input.checked) selected.add(choice.name);
      else selected.delete(choice.name);
      const status = summary.querySelector<HTMLElement>(".chatobby-subagents__choice-summary");
      if (status) status.textContent = selected.size > 0 ? `${selected.size} selected` : emptySummary;
    });
  }
}

function renderEditorActions(form: HTMLFormElement, host: HTMLElement, save: () => Promise<void>): void {
  const row = form.createDiv({ cls: "chatobby-subagents__editor-actions" });
  const cancel = row.createEl("button", { text: "Cancel", attr: { type: "button" } });
  cancel.addEventListener("click", () => host.addClass("is-hidden"));
  row.createEl("button", { cls: "mod-cta", text: "Save", attr: { type: "submit" } });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });
}

function addTextField(host: HTMLElement, label: string, value: string, placeholder: string): HTMLInputElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: label });
  const input = row.createEl("input", { attr: { type: "text", value, placeholder } });
  input.value = value;
  return input;
}

function addTextAreaField(host: HTMLElement, label: string, value: string, placeholder: string): HTMLTextAreaElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: label });
  const input = row.createEl("textarea", { attr: { placeholder } });
  input.value = value;
  return input;
}

function addNumberField(host: HTMLElement, label: string, value: number, min: number, max: number): HTMLInputElement {
  const input = addTextField(host, label, String(value), "");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  return input;
}

function addOptionalNumberField(host: HTMLElement, label: string, value: number | undefined): HTMLInputElement {
  const input = addTextField(host, label, value === undefined ? "" : String(value), "Inherited");
  input.type = "number";
  input.min = "0";
  return input;
}

function addSelectField(host: HTMLElement, label: string, value: string, options: readonly string[]): HTMLSelectElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: label });
  const select = row.createEl("select");
  for (const option of options) select.createEl("option", { text: option, attr: { value: option } });
  select.value = value;
  return select;
}

function addToggleField(host: HTMLElement, label: string, checked: boolean): HTMLInputElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__toggle" });
  const input = row.createEl("input", { attr: { type: "checkbox" } });
  input.checked = checked;
  row.createSpan({ text: label });
  return input;
}

function optionalPositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function permissionPolicyLabel(state: SubagentViewState, roleId: string): string {
  const snapshot = state.permissionSnapshot;
  const assignment = snapshot?.document.agentAssignments[roleId];
  if (!assignment || assignment.mode === "inherit") return "Inherits permissions";
  return snapshot?.document.profiles.find((profile) => profile.id === assignment.profileId)?.name ?? "Custom permissions";
}

function scopeLabel(scope: AgentDefinition["scope"]): string {
  if (scope === "global") return "All vaults";
  if (scope === "vault") return "This vault";
  if (scope === "directory") return "This project";
  return "This session";
}

function humanize(value: string): string {
  const words = value.replace(/^obsidian_/, "").replaceAll("-", " ").replaceAll("_", " ");
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : value;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent-role";
}

function optionalNonNegativeNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
