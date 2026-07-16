import { ChatobbyComponent } from "../../shared/component";

export class ActivityIndicator extends ChatobbyComponent {
  private labelEl: HTMLElement | null = null;

  setActivity(text: string | null): void {
    if (this.labelEl) this.labelEl.textContent = text ?? "";
    this.container?.toggleClass("is-active", text !== null);
  }

  clear(): void {
    this.setActivity(null);
  }

  protected onRender(container: HTMLElement): void {
    container.createDiv({ cls: "chatobby-activity-indicator__spinner" });
    this.labelEl = container.createDiv({ cls: "chatobby-activity-indicator__label" });
  }

  protected componentClass(): string {
    return "chatobby-activity-indicator";
  }
}
