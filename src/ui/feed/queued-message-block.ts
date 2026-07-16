// QueuedMessageBlockView — a mid-turn steer or queued follow-up, shown with its server-ack state
// (pending → queued → applied) so the user knows their message was sent, accepted, and ingested.

import { setIcon } from "obsidian";
import type { QueuedMessageBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";

const STATUS_ICON: Record<QueuedMessageBlock["status"], string> = {
  pending: "loader-circle",
  queued: "clock",
  applied: "check",
};

const STATUS_LABEL: Record<QueuedMessageBlock["status"], string> = {
  pending: "sending…",
  queued: "queued",
  applied: "applied",
};

export class QueuedMessageBlockView extends ChatobbyComponent {
  constructor(private block: QueuedMessageBlock) {
    super();
  }

  setBlock(block: QueuedMessageBlock): void {
    this.block = block;
    if (this.container) this.renderInto(this.container);
  }

  protected componentClass(): string {
    return "chatobby-queued";
  }

  protected onRender(container: HTMLElement): void {
    this.renderInto(container);
  }

  private renderInto(container: HTMLElement): void {
    container.empty();
    container.toggleClass("is-steer", this.block.kind === "steer");
    container.toggleClass("is-followup", this.block.kind === "followUp");
    container.toggleClass("is-pending", this.block.status === "pending");
    container.toggleClass("is-queued", this.block.status === "queued");
    container.toggleClass("is-applied", this.block.status === "applied");

    container.createSpan({ cls: "chatobby-queued__badge", text: this.block.kind === "steer" ? "Steer" : "Follow-up" });
    container.createSpan({ cls: "chatobby-queued__text", text: this.block.text });
    const status = container.createSpan({ cls: "chatobby-queued__status" });
    const icon = status.createSpan({ cls: "chatobby-queued__status-icon" });
    setIcon(icon, STATUS_ICON[this.block.status]);
    if (this.block.status === "pending") icon.addClass("is-spinning");
    status.createSpan({ cls: "chatobby-queued__status-label", text: STATUS_LABEL[this.block.status] });
  }
}
