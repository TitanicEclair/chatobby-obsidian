import { setIcon } from "obsidian";
import type { SubagentCommunicationBlock } from "../../types";
import type { FrontendSubagentActorViewModel as SubagentActorAddress } from "../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../shared/component";
import type { FeedHost } from "./index";

/** Renders supervisor-routed traffic without presenting it as operator speech. */
export class SubagentCommunicationBlockView extends ChatobbyComponent {
  constructor(private readonly block: SubagentCommunicationBlock, private readonly host?: FeedHost) {
    super();
  }

  protected onRender(container: HTMLElement): void {
    const message = this.block.message;
    const header = container.createDiv({ cls: "chatobby-subagent-communication__header" });
    const icon = header.createSpan({ cls: "chatobby-subagent-communication__icon" });
    setIcon(icon, message.kind === "request" ? "message-circle-question" : "message-square");
    const title = header.createDiv({ cls: "chatobby-subagent-communication__title" });
    title.createSpan({ cls: "chatobby-subagent-communication__name", text: actorLabel(message.from, message.data) });
    title.createSpan({ cls: "chatobby-subagent-communication__route", text: routeLabel(message.to) });
    const purpose = purposeLabel(message.kind);
    if (purpose) header.createSpan({ cls: "chatobby-subagent-communication__purpose", text: purpose });
    header.createEl("time", {
      cls: "chatobby-subagent-communication__time",
      text: formatTime(message.createdAt),
      attr: { datetime: new Date(message.createdAt).toISOString() },
    });

    const nodeId = relatedNodeId(message.from, message.to, message.nodeId);
    if (!nodeId || nodeId !== this.host?.getCurrentSubagentNodeId?.()) {
      const open = header.createEl("button", {
        cls: "chatobby-subagent-communication__open clickable-icon",
        attr: {
          type: "button",
          "aria-label": nodeId ? "Open agent feed" : "Open subagent run",
          title: nodeId ? "Open agent feed" : "Open subagent run",
        },
      });
      setIcon(open, "panel-right-open");
      open.addEventListener("click", () => {
        open.dispatchEvent(new CustomEvent("chatobby:open-subagents", {
          bubbles: true,
          detail: { runId: message.runId, nodeId, feedOnly: true },
        }));
      });
    }

    container.createDiv({ cls: "chatobby-subagent-communication__content", text: message.text });
    if (message.response?.text) {
      const response = container.createDiv({ cls: "chatobby-subagent-communication__response" });
      response.createSpan({ text: `${actorLabel(message.response.actor)} replied` });
      response.createDiv({ text: message.response.text });
    }
  }

  protected componentClass(): string {
    return "chatobby-subagent-communication";
  }
}

function actorLabel(actor: SubagentActorAddress, data?: Record<string, unknown>): string {
  if (actor.label?.trim()) return actor.label;
  const named = data?.senderLabel;
  if (typeof named === "string" && named.trim()) return named;
  if (actor.kind === "user") return actor.id === "obsidian-operator" ? "You" : "User";
  if (actor.kind === "parent") return "Main agent";
  if (actor.kind === "system") return "Subagent supervisor";
  return actor.id;
}

function purposeLabel(kind: "inform" | "request" | "decision" | "steer" | "result"): string {
  if (kind === "request") return "Question";
  if (kind === "decision") return "Decision";
  if (kind === "steer") return "Direction";
  if (kind === "result") return "Update";
  return "";
}

function routeLabel(recipients: readonly SubagentActorAddress[]): string {
  if (recipients.length === 0) return "";
  return `to ${recipients.map((recipient) => actorLabel(recipient)).join(", ")}`;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function relatedNodeId(
  sender: SubagentActorAddress,
  recipients: readonly SubagentActorAddress[],
  explicitNodeId: string | undefined,
): string | undefined {
  if (explicitNodeId) return explicitNodeId;
  if (sender.kind === "agent") return sender.id;
  return recipients.find((recipient) => recipient.kind === "agent")?.id;
}
