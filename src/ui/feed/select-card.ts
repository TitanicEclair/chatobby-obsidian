import { INTERACTION_MAX_OPTIONS_VISIBLE } from "../shared/constants";
import { InteractionCard, type InteractionHost } from "./interaction-card";
import type { InteractionState } from "../../types";

export class SelectCard extends InteractionCard {
  private options: string[] = [];
  private selectedIndex = 0;
  private optionsEl: HTMLElement | null = null;

  constructor(host: InteractionHost) {
    super(host);
  }

  setState(state: InteractionState): void {
    super.setState(state);
    const rawOptions = state.params.options;
    if (Array.isArray(rawOptions)) this.setOptions(rawOptions.filter((item): item is string => typeof item === "string"));
  }

  setOptions(options: string[]): void {
    this.options = options.slice(0, INTERACTION_MAX_OPTIONS_VISIBLE);
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.options.length - 1));
    this.renderOptions();
  }

  moveSelection(delta: number): void {
    if (this.options.length === 0) return;
    this.selectedIndex = Math.max(0, Math.min(this.options.length - 1, this.selectedIndex + delta));
    this.renderOptions();
  }

  select(): void {
    this.resolve(this.options[this.selectedIndex] ?? null);
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key === "ArrowDown") { event.preventDefault(); this.moveSelection(1); return true; }
    if (event.key === "ArrowUp") { event.preventDefault(); this.moveSelection(-1); return true; }
    if (event.key === "Enter") { event.preventDefault(); this.select(); return true; }
    if (event.key === "Escape") { event.preventDefault(); this.cancel(); return true; }
    // Number keys 1-9 directly select options.
    const digit = parseInt(event.key, 10);
    if (digit >= 1 && digit <= 9 && digit <= this.options.length) {
      event.preventDefault();
      this.selectedIndex = digit - 1;
      this.select();
      return true;
    }
    return false;
  }

  protected onRender(container: HTMLElement): void {
    super.onRender(container);
    this.optionsEl = this.bodyEl?.createDiv({ cls: "chatobby-select-card__options" }) ?? null;
    const cancel = this.actionsEl?.createEl("button", { cls: "chatobby-select-card__cancel", text: "Cancel" });
    if (cancel) cancel.onclick = () => this.cancel();
  }

  protected componentClass(): string {
    return "chatobby-interaction-card chatobby-select-card";
  }

  private renderOptions(): void {
    this.optionsEl?.empty();
    this.options.forEach((option, index) => {
      const el = this.optionsEl?.createEl("button", {
        cls: "chatobby-select-card__option",
        attr: {
          type: "button",
          "aria-selected": String(index === this.selectedIndex),
        },
      });
      if (!el) return;
      el.toggleClass("is-selected", index === this.selectedIndex);
      el.createSpan({ cls: "chatobby-select-card__option-key", text: String(index + 1) });
      const body = el.createSpan({ cls: "chatobby-select-card__option-body" });
      body.createSpan({ cls: "chatobby-select-card__option-label", text: option });
      el.onclick = () => {
        this.selectedIndex = index;
        this.select();
      };
    });
  }
}
