import { InteractionCard, type InteractionHost } from "./interaction-card";
import type { InteractionState } from "../../types";

export class EditorCard extends InteractionCard {
  private textareaEl: HTMLTextAreaElement | null = null;

  constructor(host: InteractionHost) {
    super(host);
  }

  setState(state: InteractionState): void {
    super.setState(state);
    this.setText(state.text);
  }

  setText(text: string): void {
    if (this.textareaEl) this.textareaEl.value = text;
  }

  submit(): void {
    this.resolve(this.textareaEl?.value ?? "");
  }

  protected onRender(container: HTMLElement): void {
    super.onRender(container);
    this.textareaEl = this.bodyEl?.createEl("textarea", { cls: "chatobby-editor-card__textarea" }) ?? null;
    const submit = this.actionsEl?.createEl("button", { cls: "chatobby-editor-card__submit", text: "Submit" });
    const cancel = this.actionsEl?.createEl("button", { cls: "chatobby-editor-card__cancel", text: "Cancel" });
    if (submit) submit.onclick = () => this.submit();
    if (cancel) cancel.onclick = () => this.cancel();
  }

  protected componentClass(): string {
    return "chatobby-interaction-card chatobby-editor-card";
  }
}
