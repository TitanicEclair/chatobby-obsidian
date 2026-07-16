import { ChatobbyComponent } from "../../shared/component";

export class ContextMeter extends ChatobbyComponent {
  private barEl: HTMLElement | null = null;
  private labelEl: HTMLElement | null = null;

  setUsage(tokens: number, percent: number | null, contextWindow: number): void {
    if (this.labelEl) this.labelEl.textContent = `${tokens}/${contextWindow}`;
    if (this.barEl) this.barEl.setAttr("aria-valuenow", String(percent ?? 0));
  }

  protected onRender(container: HTMLElement): void {
    this.barEl = container.createDiv({ cls: "chatobby-context-meter__bar" });
    this.labelEl = container.createDiv({ cls: "chatobby-context-meter__label" });
  }

  protected componentClass(): string {
    return "chatobby-context-meter";
  }
}
