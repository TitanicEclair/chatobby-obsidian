import { InteractionCard, type InteractionHost } from "./interaction-card";
import type { InteractionState } from "../../types";
import { interactionCopy } from "../shared/interaction-copy";

export class InputCard extends InteractionCard {
  private text = "";

  constructor(host: InteractionHost) {
    super(host);
  }

  setState(state: InteractionState): void {
    super.setState(state);
    this.text = state.text;
    if (this.bodyEl) {
      this.bodyEl.empty();
      const message = interactionCopy(state.params, state.method).message;
      if (message) this.bodyEl.createDiv({ cls: "chatobby-input-card__request", text: message });
      this.bodyEl.createDiv({
        cls: "chatobby-input-card__hint",
        text: "Type your response in the composer below, then press Enter.",
      });
    }
  }

  /** Update the card's text from composer keystrokes in real-time. */
  setLiveText(text: string): void {
    this.text = text;
  }

  submit(): void {
    this.resolve(this.text);
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key === "Enter") {
      event.preventDefault();
      this.submit();
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.cancel();
      return true;
    }
    // Typing characters: let the composer handle text accumulation, we just reflect.
    return false;
  }

  protected onRender(container: HTMLElement): void {
    super.onRender(container);
    const cancel = this.actionsEl?.createEl("button", { cls: "chatobby-input-card__cancel", text: "Cancel" });
    if (cancel) cancel.onclick = () => this.cancel();
  }

  protected componentClass(): string {
    return "chatobby-interaction-card chatobby-input-card";
  }
}
