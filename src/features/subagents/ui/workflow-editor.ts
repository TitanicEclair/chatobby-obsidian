import type {
  FrontendSubagentAcceptancePolicy,
  FrontendSubagentAgentDefinition as AgentDefinition,
  FrontendSubagentWorkflowDefinition as WorkflowDefinition,
  FrontendSubagentWorkflowNodeDefinition as WorkflowNodeDefinition,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SubagentScreenActions } from "../domain/screen-model";
import type { SubagentViewState } from "../state/subagent-store";

type AcceptanceLevel = FrontendSubagentAcceptancePolicy["level"];

const EXECUTION_MODES = ["inherit", "auto", "in-process", "worker-process"] as const;
const CONTEXT_MODES = ["inherit", "fresh", "fork", "selected", "summary"] as const;
const ACCEPTANCE_LEVELS: readonly AcceptanceLevel[] = ["none", "attested", "checked"];

/** Render the user-facing workflow builder. Specialized fields that this editor does not expose
 *  (schemas, fan-out, and verification commands) are preserved on existing workflow nodes. */
export function renderWorkflowEditor(
  host: HTMLElement,
  existing: WorkflowDefinition | null,
  state: SubagentViewState,
  actions: SubagentScreenActions,
): void {
  host.empty();
  host.removeClass("is-hidden");
  const draftId = existing?.id ?? "$new";
  const storedDraft = actions.getWorkflowEditorDraft(draftId);
  const initialWorkflow: WorkflowDefinition = storedDraft?.workflow ?? existing ?? {
    id: "",
    name: "",
    description: "",
    nodes: [newNode(1, null, state.definitions)],
    maxConcurrency: 3,
    failFast: true,
    revision: 0,
    updatedAt: 0,
  };
  const form = host.createEl("form", { cls: "chatobby-subagents__workflow-form" });
  form.createDiv({ cls: "chatobby-subagents__editor-title", text: existing ? `Edit ${existing.name}` : "New flow" });

  const name = addTextField(form, "Name", initialWorkflow.name, "Research and review");
  const description = addTextField(
    form,
    "Description",
    initialWorkflow.description,
    "Researches and reviews evidence",
  );
  const nodes = initialWorkflow.nodes.map(copyNode);
  const steps = form.createDiv({ cls: "chatobby-subagents__workflow-steps" });
  const error = form.createDiv({ cls: "chatobby-subagents__field-error" });
  let persistDraft = (): void => undefined;

  const renderSteps = (): void => {
    steps.empty();
    const heading = steps.createDiv({ cls: "chatobby-subagents__workflow-steps-header" });
    const headingCopy = heading.createDiv();
    headingCopy.createDiv({ cls: "chatobby-subagents__workflow-steps-title", text: "Steps" });
    const add = heading.createEl("button", { text: "Add step", attr: { type: "button" } });
    add.addEventListener("click", () => {
      nodes.push(newNode(nextNodeIndex(nodes), nodes.at(-1)?.id ?? null, state.definitions));
      renderSteps();
      persistDraft();
    });

    nodes.forEach((node, index) => renderStep(steps, node, index, nodes, state.definitions, () => {
      nodes.splice(index, 1);
      for (const candidate of nodes) candidate.dependsOn = candidate.dependsOn.filter((id) => id !== node.id);
      renderSteps();
      persistDraft();
    }));
  };
  renderSteps();

  const advanced = form.createEl("details", { cls: "chatobby-subagents__role-advanced chatobby-subagents__workflow-advanced" });
  advanced.createEl("summary", { text: "Advanced workflow controls" });
  const advancedGrid = advanced.createDiv({ cls: "chatobby-subagents__role-advanced-grid" });
  const id = addTextField(advancedGrid, "Workflow key", initialWorkflow.id, "Generated from the workflow name");
  const maxConcurrency = addNumberField(
    advancedGrid,
    "Agents working at once",
    initialWorkflow.maxConcurrency ?? 3,
    1,
    64,
  );
  maxConcurrency.parentElement?.createDiv({
    cls: "chatobby-subagents__field-help",
    text: "Limits parallel steps; dependencies still determine when each step can start.",
  });
  const failFast = addToggleField(
    advancedGrid,
    "Stop remaining steps after a failure",
    initialWorkflow.failFast ?? true,
  );
  failFast.parentElement?.createDiv({
    cls: "chatobby-subagents__field-help",
    text: "Turn off only when independent steps should continue after another step fails.",
  });

  persistDraft = () => {
    actions.setWorkflowEditorDraft(draftId, {
      workflow: {
        ...initialWorkflow,
        id: id.value,
        name: name.value,
        description: description.value,
        nodes: nodes.map(copyNode),
        maxConcurrency: Number(maxConcurrency.value),
        failFast: failFast.checked,
      },
    });
  };
  form.addEventListener("input", persistDraft);
  form.addEventListener("change", persistDraft);
  persistDraft();

  const actionsRow = form.createDiv({ cls: "chatobby-subagents__editor-actions" });
  const cancel = actionsRow.createEl("button", { text: "Cancel", attr: { type: "button" } });
  cancel.addEventListener("click", () => {
    actions.clearWorkflowEditorDraft(draftId);
    host.addClass("is-hidden");
  });
  const save = actionsRow.createEl("button", { cls: "mod-cta", text: "Save", attr: { type: "submit" } });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.empty();
    persistDraft();
    const draft = actions.getWorkflowEditorDraft(draftId);
    if (!draft) {
      error.textContent = "Workflow draft is unavailable.";
      return;
    }
    const issue = validateWorkflow(draft.workflow.name, draft.workflow.nodes);
    if (issue) {
      error.textContent = issue;
      return;
    }
    const workflow: WorkflowDefinition = {
      ...draft.workflow,
      id: draft.workflow.id.trim() || slug(draft.workflow.name),
      name: draft.workflow.name.trim(),
      description: draft.workflow.description.trim(),
      nodes: draft.workflow.nodes.map(copyNode),
    };
    save.disabled = true;
    save.textContent = "Saving…";
    void actions.saveWorkflow(workflow).then(
      () => {
        actions.clearWorkflowEditorDraft(draftId);
        host.addClass("is-hidden");
      },
      (reason: unknown) => {
        error.textContent = reason instanceof Error ? reason.message : String(reason);
      },
    ).finally(() => {
      save.disabled = false;
      save.textContent = "Save";
    });
  });
}

function renderStep(
  host: HTMLElement,
  node: WorkflowNodeDefinition,
  index: number,
  nodes: readonly WorkflowNodeDefinition[],
  definitions: readonly AgentDefinition[],
  remove: () => void,
): void {
  const card = host.createDiv({ cls: "chatobby-subagents__workflow-step" });
  const header = card.createDiv({ cls: "chatobby-subagents__workflow-step-header" });
  header.createDiv({ cls: "chatobby-subagents__workflow-step-number", text: `Step ${index + 1}` });
  const removeButton = header.createEl("button", {
    cls: "mod-warning",
    text: "Remove",
    attr: { type: "button", "aria-label": `Remove step ${index + 1}` },
  });
  removeButton.disabled = nodes.length === 1;
  removeButton.addEventListener("click", remove);

  const grid = card.createDiv({ cls: "chatobby-subagents__workflow-step-grid" });
  const label = addTextField(grid, "Step name", node.label, "Gather sources");
  label.addEventListener("input", () => { node.label = label.value; });
  const agent = addAgentField(grid, definitions, node.agentId);
  agent.addEventListener("change", () => { node.agentId = agent.value; });
  const task = addTextAreaField(grid, "Task", node.task, "What should this agent produce and verify?");
  task.parentElement?.addClass("is-wide");
  task.addEventListener("input", () => { node.task = task.value; });

  const advanced = card.createEl("details", { cls: "chatobby-subagents__workflow-step-advanced" });
  advanced.createEl("summary", { text: "Step order, runtime, and review" });
  const advancedGrid = advanced.createDiv({ cls: "chatobby-subagents__workflow-step-advanced-grid" });
  renderDependencies(advancedGrid, node, nodes);
  const execution = addSelectField(
    advancedGrid,
    "Executor",
    node.executionMode ?? "inherit",
    EXECUTION_MODES,
    "Inherit uses the role's executor. Override only when this step needs different isolation.",
  );
  execution.addEventListener("change", () => {
    node.executionMode = execution.value === "inherit"
      ? undefined
      : execution.value as NonNullable<WorkflowNodeDefinition["executionMode"]>;
  });
  const context = addSelectField(
    advancedGrid,
    "Starting context",
    node.contextMode ?? "inherit",
    CONTEXT_MODES,
    "Inherit uses the role. Fresh is smallest; fork is richest; selected and summary keep context bounded.",
  );
  context.addEventListener("change", () => {
    node.contextMode = context.value === "inherit"
      ? undefined
      : context.value as NonNullable<WorkflowNodeDefinition["contextMode"]>;
  });
  const acceptance = addSelectField(
    advancedGrid,
    "Completion check",
    node.acceptance?.level ?? "none",
    ACCEPTANCE_LEVELS,
    "Attested requires the agent to report evidence; checked requires configured verification to pass.",
  );
  const criteria = addTextAreaField(
    advancedGrid,
    "Acceptance criteria",
    node.acceptance?.criteria?.join("\n") ?? "",
    "One check per line",
  );
  acceptance.addEventListener("change", () => updateAcceptance(node, acceptance.value as AcceptanceLevel, criteria.value));
  criteria.addEventListener("input", () => updateAcceptance(node, acceptance.value as AcceptanceLevel, criteria.value));
}

function renderDependencies(
  host: HTMLElement,
  node: WorkflowNodeDefinition,
  nodes: readonly WorkflowNodeDefinition[],
): void {
  const field = host.createDiv({ cls: "chatobby-subagents__workflow-dependencies" });
  field.createSpan({ text: "Runs after" });
  field.createDiv({
    cls: "chatobby-subagents__field-help",
    text: "Choose the steps that must finish before this one can start.",
  });
  const options = field.createDiv({ cls: "chatobby-subagents__workflow-dependency-options" });
  const candidates = nodes.filter((candidate) => candidate.id !== node.id);
  if (candidates.length === 0) {
    options.createSpan({ cls: "chatobby-subagents__catalog-copy", text: "Starts immediately" });
    return;
  }
  for (const candidate of candidates) {
    const option = options.createEl("label");
    const checkbox = option.createEl("input", { attr: { type: "checkbox" } });
    checkbox.checked = node.dependsOn.includes(candidate.id);
    option.createSpan({ text: candidate.label || candidate.id });
    checkbox.addEventListener("change", () => {
      node.dependsOn = checkbox.checked
        ? [...new Set([...node.dependsOn, candidate.id])]
        : node.dependsOn.filter((id) => id !== candidate.id);
    });
  }
}

function addAgentField(host: HTMLElement, definitions: readonly AgentDefinition[], current: string): HTMLSelectElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: "Agent role" });
  const select = row.createEl("select");
  select.createEl("option", { text: "Choose an agent role", value: "" });
  for (const definition of definitions.filter((candidate) => candidate.enabled || candidate.id === current)) {
    select.createEl("option", { text: definition.name, value: definition.id });
  }
  if (current && !definitions.some((definition) => definition.id === current)) {
    select.createEl("option", { text: `${current} (unavailable)`, value: current });
  }
  select.value = current;
  return select;
}

function addTextField(host: HTMLElement, label: string, value: string, placeholder: string): HTMLInputElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: label });
  const input = row.createEl("input", { attr: { type: "text", placeholder } });
  input.value = value;
  return input;
}

function addTextAreaField(host: HTMLElement, label: string, value: string, placeholder: string): HTMLTextAreaElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: label });
  const textarea = row.createEl("textarea", { attr: { placeholder } });
  textarea.value = value;
  return textarea;
}

function addNumberField(host: HTMLElement, label: string, value: number, min: number, max: number): HTMLInputElement {
  const input = addTextField(host, label, String(value), "");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  return input;
}

function addSelectField(
  host: HTMLElement,
  label: string,
  value: string,
  options: readonly string[],
  help?: string,
): HTMLSelectElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__field" });
  row.createSpan({ text: label });
  const select = row.createEl("select");
  for (const option of options) select.createEl("option", { text: humanize(option), value: option });
  select.value = value;
  if (help) row.createDiv({ cls: "chatobby-subagents__field-help", text: help });
  return select;
}

function addToggleField(host: HTMLElement, label: string, checked: boolean): HTMLInputElement {
  const row = host.createEl("label", { cls: "chatobby-subagents__toggle" });
  const input = row.createEl("input", { attr: { type: "checkbox" } });
  input.checked = checked;
  row.createSpan({ text: label });
  return input;
}

function newNode(index: number, dependency: string | null, definitions: readonly AgentDefinition[]): WorkflowNodeDefinition {
  return {
    id: `step-${index}`,
    agentId: definitions.find((definition) => definition.enabled)?.id ?? "",
    label: `Step ${index}`,
    task: "",
    dependsOn: dependency ? [dependency] : [],
  };
}

function nextNodeIndex(nodes: readonly WorkflowNodeDefinition[]): number {
  const ids = new Set(nodes.map((node) => node.id));
  let index = nodes.length + 1;
  while (ids.has(`step-${index}`)) index += 1;
  return index;
}

function copyNode(node: WorkflowNodeDefinition): WorkflowNodeDefinition {
  return {
    ...node,
    dependsOn: [...node.dependsOn],
    acceptance: node.acceptance
      ? {
        ...node.acceptance,
        criteria: node.acceptance.criteria ? [...node.acceptance.criteria] : undefined,
        evidence: node.acceptance.evidence ? [...node.acceptance.evidence] : undefined,
        verify: node.acceptance.verify?.map((command) => ({ ...command })),
      }
      : undefined,
  };
}

function updateAcceptance(node: WorkflowNodeDefinition, level: AcceptanceLevel, criteriaText: string): void {
  if (level === "none") {
    node.acceptance = undefined;
    return;
  }
  const criteria = criteriaText.split("\n").map((item) => item.trim()).filter(Boolean);
  node.acceptance = {
    ...node.acceptance,
    level,
    criteria: criteria.length > 0 ? criteria : undefined,
  };
}

function validateWorkflow(name: string, nodes: readonly WorkflowNodeDefinition[]): string | null {
  if (!name.trim()) return "Give this workflow a name.";
  if (nodes.length === 0) return "Add at least one workflow step.";
  for (const [index, node] of nodes.entries()) {
    if (!node.label.trim()) return `Step ${index + 1} needs a name.`;
    if (!node.agentId) return `Choose an agent role for step ${index + 1}.`;
    if (!node.task.trim()) return `Add instructions for step ${index + 1}.`;
  }
  return hasDependencyCycle(nodes) ? "Workflow dependencies contain a cycle. Adjust which steps run after one another." : null;
}

function hasDependencyCycle(nodes: readonly WorkflowNodeDefinition[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      if (byId.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return nodes.some((node) => visit(node.id));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workflow";
}

function humanize(value: string): string {
  const words = value.replaceAll("-", " ").replaceAll("_", " ");
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : value;
}
