import { InteractionCard, type InteractionHost } from "./interaction-card";
import type { InteractionState } from "../../types";

export class ConfirmCard extends InteractionCard {
  constructor(host: InteractionHost) {
    super(host);
  }

  setState(state: InteractionState): void {
    super.setState(state);
    if (this.bodyEl) this.bodyEl.textContent = typeof state.params.message === "string" ? state.params.message : "";
  }

  confirm(): void {
    this.resolve(true);
  }

  deny(): void {
    this.resolve(false);
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key === "Enter" || event.key === "y" || event.key === "Y") {
      event.preventDefault();
      this.confirm();
      return true;
    }
    if (event.key === "Escape" || event.key === "n" || event.key === "N") {
      event.preventDefault();
      this.deny();
      return true;
    }
    return false;
  }

  protected onRender(container: HTMLElement): void {
    super.onRender(container);
    if (this.bodyEl) {
      this.bodyEl.textContent = typeof this.state?.params.message === "string" ? this.state.params.message : "";
    }
    const confirm = this.actionsEl?.createEl("button", {
      cls: "chatobby-confirm-card__confirm",
      attr: { type: "button" },
    });
    confirm?.createSpan({ cls: "chatobby-confirm-card__action-label", text: "Confirm" });
    confirm?.createSpan({ cls: "chatobby-confirm-card__action-key", text: "Y / Enter" });
    const deny = this.actionsEl?.createEl("button", {
      cls: "chatobby-confirm-card__deny",
      attr: { type: "button" },
    });
    deny?.createSpan({ cls: "chatobby-confirm-card__action-label", text: "Cancel" });
    deny?.createSpan({ cls: "chatobby-confirm-card__action-key", text: "N / Esc" });
    if (confirm) confirm.onclick = () => this.confirm();
    if (deny) deny.onclick = () => this.deny();
  }

  protected componentClass(): string {
    return "chatobby-interaction-card chatobby-confirm-card";
  }
}
