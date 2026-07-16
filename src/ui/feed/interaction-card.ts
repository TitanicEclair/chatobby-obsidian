import type { InteractionState } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { setIcon } from "obsidian";

export interface InteractionHost {
  getActiveInteraction(): InteractionState | null;
  respond(id: string, result: unknown): void;
  cancel(id: string): void;
}

export abstract class InteractionCard extends ChatobbyComponent {
  protected state: InteractionState | null = null;
  protected titleEl: HTMLElement | null = null;
  protected bodyEl: HTMLElement | null = null;
  protected actionsEl: HTMLElement | null = null;

  constructor(protected readonly host: InteractionHost) {
    super();
  }

  setState(state: InteractionState): void {
    this.state = state;
    this.container?.toggleClass("is-submitted", state.submitted);
    if (this.titleEl) this.titleEl.textContent = interactionTitle(state);
  }

  /** Handle a keystroke from the composer. Return true if consumed. */
  handleKeydown(_event: KeyboardEvent): boolean { return false; }

  /** Live text from the composer for input-type interactions. */
  setLiveText(_text: string): void {}

  resolve(result: unknown): void {
    if (this.state) this.host.respond(this.state.id, result);
  }

  cancel(): void {
    if (this.state) this.host.cancel(this.state.id);
  }

  focus(): void {
    this.container?.focus();
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    container.setAttr("role", "group");
    const header = container.createDiv({ cls: "chatobby-interaction-card__header" });
    const icon = header.createSpan({ cls: "chatobby-interaction-card__icon" });
    setIcon(icon, "circle-help");
    const heading = header.createDiv({ cls: "chatobby-interaction-card__heading" });
    heading.createDiv({ cls: "chatobby-interaction-card__eyebrow", text: "Input requested" });
    this.titleEl = heading.createDiv({ cls: "chatobby-interaction-card__title" });
    this.bodyEl = container.createDiv({ cls: "chatobby-interaction-card__body" });
    this.actionsEl = container.createDiv({ cls: "chatobby-interaction-card__actions" });
  }

  protected componentClass(): string {
    return "chatobby-interaction-card";
  }
}

function interactionTitle(state: InteractionState): string {
  const title = state.params.title;
  if (typeof title === "string" && title.trim()) return title;
  return state.method;
}
