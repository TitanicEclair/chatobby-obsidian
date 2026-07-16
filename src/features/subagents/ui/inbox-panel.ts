import type { FrontendSubagentNodeViewModel as SubagentNodeSnapshot } from "../../../vendor/chatobby-client/frontend-contracts.js";
import type { SubagentScreenActions } from "../domain/screen-model";
import type { SubagentViewState } from "../state/subagent-store";

/** Render all operator-blocking requests independently from the chat feed. */
export function renderInboxPanel(
  host: HTMLElement,
  state: SubagentViewState,
  actions: SubagentScreenActions,
): void {
  const header = host.createDiv({ cls: "chatobby-subagents__catalog-header" });
  header.createDiv({ cls: "chatobby-subagents__detail-title", text: "Inbox" });

  const cards = host.createDiv({ cls: "chatobby-subagents__inbox" });
  let pending = 0;
  for (const run of state.runs.values()) {
    for (const node of Object.values(run.nodes)) {
      if (node.pendingPermission?.status === "pending") {
        pending += 1;
        renderPermission(cards, run.id, node, actions);
      }
      if (node.acceptanceRecord?.status === "waiting-review") {
        pending += 1;
        renderAcceptance(cards, run.id, node, actions);
      }
    }
  }
  for (const message of state.messages) {
    if (!message.to.some((actor) => actor.kind === "user")) continue;
    if (message.status === "acknowledged" || message.status === "rejected" || message.status === "expired") continue;
    pending += 1;
    const card = cards.createDiv({ cls: "chatobby-subagents__inbox-card" });
    const senderLabel = message.data?.senderLabel;
    renderCardHeading(
      card,
      typeof senderLabel === "string" && senderLabel.trim() ? senderLabel : message.from.id,
      "Message",
    );
    card.createDiv({ cls: "chatobby-subagents__inbox-copy", text: message.text });
    const response = card.createEl("input", {
      cls: "chatobby-subagents__inbox-input",
      attr: { type: "text", placeholder: "Optional response", "aria-label": "Response to subagent" },
    });
    const actionsRow = card.createDiv({ cls: "chatobby-subagents__inbox-actions" });
    const acknowledge = actionsRow.createEl("button", { cls: "mod-cta", text: "Acknowledge", attr: { type: "button" } });
    acknowledge.addEventListener("click", () => void runPendingAction([acknowledge], () => actions.acknowledgeMessage(message, response.value)));
  }
  if (pending === 0) {
    cards.createDiv({
      cls: "chatobby-subagents__empty",
      text: "Nothing needs your attention.",
    });
  }
}

function renderPermission(
  host: HTMLElement,
  runId: string,
  node: SubagentNodeSnapshot,
  actions: SubagentScreenActions,
): void {
  const permission = node.pendingPermission;
  if (!permission) return;
  const card = host.createDiv({ cls: "chatobby-subagents__inbox-card is-warning" });
  renderCardHeading(card, permission.title, agentName(node));
  if (permission.message) card.createDiv({ cls: "chatobby-subagents__inbox-copy", text: permission.message });
  let valueControl: HTMLInputElement | HTMLSelectElement | null = null;
  if (permission.kind === "select") {
    valueControl = card.createEl("select", { cls: "chatobby-subagents__inbox-input" });
    for (const option of permission.options ?? []) valueControl.createEl("option", { text: option, attr: { value: option } });
  } else if (permission.kind === "input") {
    valueControl = card.createEl("input", {
      cls: "chatobby-subagents__inbox-input",
      attr: { type: "text", placeholder: permission.placeholder ?? "Value" },
    });
  }
  const actionsRow = card.createDiv({ cls: "chatobby-subagents__inbox-actions" });
  const deny = actionsRow.createEl("button", { text: "Deny", attr: { type: "button" } });
  const approve = actionsRow.createEl("button", { cls: "mod-cta", text: "Approve", attr: { type: "button" } });
  deny.addEventListener("click", () =>
    void runPendingAction([deny, approve], () => actions.decidePermission(runId, node.id, permission.id, false)));
  approve.addEventListener("click", () =>
    void runPendingAction(
      [deny, approve],
      () => actions.decidePermission(runId, node.id, permission.id, true, valueControl?.value),
    ));
}

function renderAcceptance(
  host: HTMLElement,
  runId: string,
  node: SubagentNodeSnapshot,
  actions: SubagentScreenActions,
): void {
  const acceptance = node.acceptanceRecord;
  if (!acceptance) return;
  const card = host.createDiv({ cls: "chatobby-subagents__inbox-card" });
  renderCardHeading(card, agentName(node), "Review");
  for (const check of acceptance.checks) {
    card.createDiv({
      cls: `chatobby-subagents__check${check.exitCode === 0 && !check.timedOut ? " is-passed" : " is-failed"}`,
      text: `${check.command} · ${check.timedOut ? "timed out" : `exit ${check.exitCode ?? "unknown"}`}`,
    });
  }
  const note = card.createEl("input", {
    cls: "chatobby-subagents__inbox-input",
    attr: { type: "text", placeholder: "Optional review note", "aria-label": "Acceptance review note" },
  });
  const actionsRow = card.createDiv({ cls: "chatobby-subagents__inbox-actions" });
  const reject = actionsRow.createEl("button", { text: "Reject", attr: { type: "button" } });
  const approve = actionsRow.createEl("button", { cls: "mod-cta", text: "Accept", attr: { type: "button" } });
  reject.addEventListener("click", () =>
    void runPendingAction([reject, approve], () => actions.decideAcceptance(runId, node.id, false, note.value)));
  approve.addEventListener("click", () =>
    void runPendingAction([reject, approve], () => actions.decideAcceptance(runId, node.id, true, note.value)));
}

function agentName(node: SubagentNodeSnapshot): string {
  return node.agentName?.trim() || node.agentId;
}

function renderCardHeading(host: HTMLElement, title: string, meta: string): void {
  const heading = host.createDiv({ cls: "chatobby-subagents__inbox-heading" });
  heading.createDiv({ cls: "chatobby-subagents__catalog-name", text: title });
  heading.createDiv({ cls: "chatobby-subagents__scope", text: meta });
}

async function runPendingAction(buttons: HTMLButtonElement[], action: () => Promise<void>): Promise<void> {
  for (const button of buttons) button.disabled = true;
  try {
    await action();
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}
