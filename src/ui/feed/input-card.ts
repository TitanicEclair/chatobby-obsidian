import { InteractionCard, type InteractionHost } from "./interaction-card";
import type { InteractionState } from "../../types";

export class InputCard extends InteractionCard {
  private inputEl: HTMLInputElement | null = null;

  constructor(host: InteractionHost) {
    super(host);
  }

  setState(state: InteractionState): void {
    super.setState(state);
    this.setText(state.text || (typeof state.params.placeholder === "string" ? "" : ""));
    if (this.inputEl && typeof state.params.placeholder === "string") this.inputEl.placeholder = state.params.placeholder;
  }

  setText(text: string): void {
    if (this.inputEl) this.inputEl.value = text;
  }

  /** Update the card's text from composer keystrokes in real-time. */
  setLiveText(text: string): void {
    if (this.inputEl) {
      this.inputEl.value = text;
      this.inputEl.scrollLeft = this.inputEl.scrollWidth;
    }
  }

  submit(): void {
    this.resolve(this.inputEl?.value ?? "");
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
    this.inputEl = this.bodyEl?.createEl("input", { cls: "chatobby-input-card__input" }) ?? null;
    const submit = this.actionsEl?.createEl("button", { cls: "chatobby-input-card__submit", text: "Submit" });
    const cancel = this.actionsEl?.createEl("button", { cls: "chatobby-input-card__cancel", text: "Cancel" });
    if (submit) submit.onclick = () => this.submit();
    if (cancel) cancel.onclick = () => this.cancel();
  }

  protected componentClass(): string {
    return "chatobby-interaction-card chatobby-input-card";
  }
}
