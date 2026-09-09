import { setIcon } from "obsidian";
import type { SubagentScreenActions } from "../domain/screen-model";
import type { SubagentViewState } from "../state/subagent-store";
import { createPageState } from "../../../ui/shared/page-shell";

const ACTIVE = new Set(["created", "queued", "running", "waiting", "paused", "blocked", "orphaned"]);

/** Active work is grouped by its real parent; opening a feed never changes this page's scope. */
export function renderActiveAgents(host: HTMLElement, state: SubagentViewState, actions: SubagentScreenActions): void {
  const runs = [...state.runs.values()].filter((run) => ACTIVE.has(run.status));
  const parents = new Map((state.parentSessions ?? []).map((parent) => [parent.sessionId, parent]));
  const ids = new Set([...parents.values()].filter((parent) => parent.active).map((parent) => parent.sessionId));
  for (const run of runs) ids.add(run.parentSessionId);
  if (!ids.size) {
    createPageState(host, { kind: "empty", title: "Room for a little teamwork", description: "Ask Chatobby to delegate research, compare ideas, or review a draft. Active conversations and their agents will appear here." });
    return;
  }
  const list = host.createDiv({ cls: "chatobby-active-agents" });
  for (const id of ids) {
    const parent = parents.get(id);
    const group = list.createDiv({ cls: "chatobby-active-agents__group" });
    const heading = group.createDiv({ cls: "chatobby-active-agents__parent" });
    setIcon(heading.createSpan({ cls: "chatobby-active-agents__icon" }), "message-square");
    const identity = heading.createDiv({ cls: "chatobby-active-agents__identity" });
    const link = identity.createEl("button", { text: parent?.label ?? "Conversation", cls: "chatobby-active-agents__name" });
    link.addEventListener("click", () => actions.openParentSession?.(id));
    identity.createDiv({ cls: "chatobby-active-agents__detail", text: `${parent?.workspaceLabel ?? "Workspace"} · ${parent?.active ? "Working" : "Chat is idle"}` });
    if (parent?.active && actions.stopParentSession) heading.createEl("button", { text: "Stop chat", cls: "chatobby-active-agents__stop" }).addEventListener("click", () => actions.stopParentSession?.(id));
    const children = group.createDiv({ cls: "chatobby-active-agents__children" });
    for (const run of runs.filter((candidate) => candidate.parentSessionId === id)) {
      for (const node of Object.values(run.nodes).filter((candidate) => ACTIVE.has(candidate.status))) {
        const row = children.createDiv({ cls: "chatobby-active-agents__agent" });
        setIcon(row.createSpan({ cls: `chatobby-active-agents__icon${node.status === "running" ? " is-working" : ""}` }), "bot");
        const copy = row.createDiv({ cls: "chatobby-active-agents__identity" });
        const open = copy.createEl("button", { text: node.agentName || node.label || node.agentId, cls: "chatobby-active-agents__name" });
        open.addEventListener("click", () => { if (actions.openAgentFeed) actions.openAgentFeed(run.id, node.id); else void actions.selectNode(run.id, node.id); });
        copy.createDiv({ cls: "chatobby-active-agents__task", text: run.description });
        copy.createDiv({ cls: "chatobby-active-agents__detail", text: node.currentTool ? `Using ${node.currentTool}` : node.status === "waiting" ? "Idle · ready for follow-up" : node.status.replaceAll("-", " ") });
        const stop = row.createEl("button", { text: "Stop", cls: "chatobby-active-agents__stop" });
        stop.addEventListener("click", () => {
          stop.disabled = true;
          void actions.control(run.id, node.id, "cancel").catch((error: unknown) => {
            stop.disabled = false; stop.title = error instanceof Error ? error.message : "Could not stop this agent";
          });
        });
      }
    }
    if (!children.childElementCount) children.createDiv({ cls: "chatobby-active-agents__detail", text: "No active subagents in this conversation." });
  }
}
