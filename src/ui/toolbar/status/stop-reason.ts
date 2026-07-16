import type { StopReason } from "../../../types";
import { ChatobbyComponent } from "../../shared/component";

export class StopReasonBanner extends ChatobbyComponent {
  private messageEl: HTMLElement | null = null;

  show(reason: StopReason, message?: string): void {
    this.container?.removeClass("is-hidden");
    if (this.messageEl) this.messageEl.textContent = message ?? reason;
  }

  hide(): void {
    this.container?.addClass("is-hidden");
  }

  protected onRender(container: HTMLElement): void {
    this.messageEl = container.createDiv({ cls: "chatobby-stop-reason__message" });
  }

  protected componentClass(): string {
    return "chatobby-stop-reason";
  }
}
