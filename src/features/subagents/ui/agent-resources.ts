import type {
  FrontendSubagentArtifactViewModel as SubagentArtifactSummary,
  FrontendSubagentNodeViewModel as SubagentNodeSnapshot,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SubagentScreenActions } from "../domain/screen-model";

/** Renders actionable permission and evidence decisions for one child node. */
export function renderPendingDecision(
  host: HTMLElement,
  runId: string,
  node: SubagentNodeSnapshot,
  actions: SubagentScreenActions,
): void {
  const permission = node.pendingPermission;
  if (permission?.status === "pending") {
    const card = host.createDiv({ cls: "chatobby-subagents__inbox-card is-warning" });
    card.createDiv({ cls: "chatobby-subagents__section-label", text: "Permission required" });
    card.createDiv({ cls: "chatobby-subagents__inbox-copy", text: permission.message ?? permission.title });
    let value: HTMLInputElement | HTMLSelectElement | null = null;
    if (permission.kind === "select") {
      value = card.createEl("select", { cls: "chatobby-subagents__inbox-input" });
      for (const option of permission.options ?? []) value.createEl("option", { text: option, attr: { value: option } });
    } else if (permission.kind === "input") {
      value = card.createEl("input", {
        cls: "chatobby-subagents__inbox-input",
        attr: { type: "text", placeholder: permission.placeholder ?? "Value" },
      });
    }
    const row = card.createDiv({ cls: "chatobby-subagents__inbox-actions" });
    const deny = row.createEl("button", { text: "Deny", attr: { type: "button" } });
    const approve = row.createEl("button", { cls: "mod-cta", text: "Approve", attr: { type: "button" } });
    deny.addEventListener("click", () =>
      void runPendingAction([deny, approve], () => actions.decidePermission(runId, node.id, permission.id, false)));
    approve.addEventListener("click", () =>
      void runPendingAction(
        [deny, approve],
        () => actions.decidePermission(runId, node.id, permission.id, true, value?.value),
      ));
  }
  const acceptance = node.acceptanceRecord;
  if (acceptance?.status !== "waiting-review") return;
  const card = host.createDiv({ cls: "chatobby-subagents__inbox-card" });
  card.createDiv({ cls: "chatobby-subagents__section-label", text: "Evidence review required" });
  for (const check of acceptance.checks) {
    card.createDiv({
      cls: `chatobby-subagents__check${check.exitCode === 0 && !check.timedOut ? " is-passed" : " is-failed"}`,
      text: `${check.command} · ${check.timedOut ? "timed out" : `exit ${check.exitCode ?? "unknown"}`}`,
    });
  }
  const note = card.createEl("input", {
    cls: "chatobby-subagents__inbox-input",
    attr: { type: "text", placeholder: "Optional review note" },
  });
  const row = card.createDiv({ cls: "chatobby-subagents__inbox-actions" });
  const reject = row.createEl("button", { text: "Reject", attr: { type: "button" } });
  const accept = row.createEl("button", { cls: "mod-cta", text: "Accept", attr: { type: "button" } });
  reject.addEventListener("click", () =>
    void runPendingAction([reject, accept], () => actions.decideAcceptance(runId, node.id, false, note.value)));
  accept.addEventListener("click", () =>
    void runPendingAction([reject, accept], () => actions.decideAcceptance(runId, node.id, true, note.value)));
}

/** Renders durable child artifacts and explicit vault-promotion controls. */
export function renderArtifacts(
  host: HTMLElement,
  artifacts: readonly SubagentArtifactSummary[],
  actions: SubagentScreenActions,
): void {
  const visible = artifacts.filter((artifact) => artifact.kind !== "transcript");
  if (visible.length === 0) return;
  const section = host.createDiv({ cls: "chatobby-subagents__artifacts" });
  for (const artifact of visible) {
    const row = section.createDiv({ cls: "chatobby-subagents__artifact" });
    row.createSpan({ cls: "chatobby-subagents__artifact-kind", text: artifact.kind });
    const text = row.createSpan();
    text.createDiv({ cls: "chatobby-subagents__artifact-name", text: artifact.name });
    text.createDiv({ cls: "chatobby-subagents__artifact-path", text: artifact.path });
    if (artifact.promotedVaultPath) {
      text.createDiv({ cls: "chatobby-subagents__artifact-path", text: `Promoted to ${artifact.promotedVaultPath}` });
      continue;
    }
    const promote = row.createDiv({ cls: "chatobby-subagents__artifact-promote" });
    const target = promote.createEl("input", {
      attr: { type: "text", placeholder: "Vault-relative destination" },
    });
    const button = promote.createEl("button", { text: "Add to vault", attr: { type: "button" } });
    button.addEventListener("click", () => void actions.promoteArtifact(artifact.id, artifact.revision, target.value));
  }
}

async function runPendingAction(buttons: HTMLButtonElement[], action: () => Promise<void>): Promise<void> {
  for (const button of buttons) button.disabled = true;
  try {
    await action();
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}
