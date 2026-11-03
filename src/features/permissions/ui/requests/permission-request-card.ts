import { DEFAULT_COMPOSER_KEYBINDINGS, type InteractionState } from "../../../../types";
import { permissionRequestDisplay } from "../../domain/permission-request";
import { matchesComposerKeybinding } from "../../../../ui/composer/keybindings";
import { InteractionCard, type InteractionHost } from "../../../../ui/feed/interaction-card";

/** Deliberate one-time approval; typing Enter in the composer never grants permission. */
export class PermissionRequestCard extends InteractionCard {
  constructor(host: InteractionHost, private readonly getCancelKeybinding: () => string = () => DEFAULT_COMPOSER_KEYBINDINGS.cancelTurn) { super(host); }

  override setState(state: InteractionState): void {
    super.setState(state);
    const details = permissionRequestDisplay(state.params);
    if (!this.bodyEl || !details) return;
    if (this.titleEl) this.titleEl.textContent = `Allow ${details.toolName}?`;
    this.bodyEl.empty();
    this.bodyEl.createDiv({ cls: "chatobby-permission-request__label", text: "Requested action" });
    this.bodyEl.createEl("pre", { cls: "chatobby-permission-request__operation", text: details.operationSummary });
    this.bodyEl.createDiv({ cls: "chatobby-permission-request__label", text: "Reason" });
    this.bodyEl.createEl("p", { cls: "chatobby-permission-request__reason", text: details.reason });
  }

  override cancel(): void { this.resolve(false); }

  override handleKeydown(event: KeyboardEvent): boolean {
    if (matchesComposerKeybinding(event, this.getCancelKeybinding())) { event.preventDefault(); this.resolve(false); return true; }
    if (event.key === "Enter") { event.preventDefault(); return true; }
    return false;
  }

  protected override onRender(container: HTMLElement): void {
    super.onRender(container);
    container.setAttr("aria-label", "Permission request");
    container.setAttr("aria-live", "polite");
    const deny = this.actionsEl?.createEl("button", { text: "Deny", attr: { type: "button" } });
    const allow = this.actionsEl?.createEl("button", { cls: "mod-cta", text: "Allow once", attr: { type: "button" } });
    deny?.addEventListener("click", () => this.resolve(false));
    allow?.addEventListener("click", () => this.resolve(true));
    // Native button activation remains available after deliberate focus.
    this.actionsEl?.addEventListener("keydown", (event) => {
      if (matchesComposerKeybinding(event, this.getCancelKeybinding())) this.handleKeydown(event);
      event.stopPropagation();
    });
  }

  protected override componentClass(): string { return "chatobby-interaction-card chatobby-permission-request"; }
}
