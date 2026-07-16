import { ChatobbyComponent } from "../shared/component";
import type { InteractionCard } from "./interaction-card";

export class KeyboardRouter extends ChatobbyComponent {
  private activeCard: InteractionCard | null = null;

  setActiveCard(card: InteractionCard | null): void {
    this.activeCard = card;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (!this.activeCard) return false;
    if (event.key === "Escape") {
      this.activeCard.cancel();
      return true;
    }
    return false;
  }

  protected onRender(container: HTMLElement): void {
    container.addClass("is-hidden");
  }

  protected componentClass(): string {
    return "chatobby-keyboard-router";
  }
}
