import { setIcon } from "obsidian";
import type { ExtensionPanelBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { decorateAfterMarkdown } from "./decorations";
import type { FeedHost } from ".";

export class ExtensionPanelBlockView extends ChatobbyComponent {
  constructor(
    private readonly host: FeedHost,
    private readonly block: ExtensionPanelBlock,
  ) {
    super();
  }

  protected onRender(container: HTMLElement): void {
    container.toggleClass("is-warning", this.block.level === "warning");
    container.toggleClass("is-error", this.block.level === "error");

    const header = container.createDiv({ cls: "chatobby-extension-panel__header" });
    const icon = header.createSpan({ cls: "chatobby-extension-panel__icon" });
    setIcon(icon, iconForPanel(this.block));
    const title = header.createDiv({ cls: "chatobby-extension-panel__title" });
    title.createSpan({ cls: "chatobby-extension-panel__label", text: this.block.title });
    if (this.block.source) title.createSpan({ cls: "chatobby-extension-panel__source", text: this.block.source });

    const body = container.createDiv({ cls: "chatobby-extension-panel__body markdown-rendered" });
    const rendered = this.host.renderMarkdown(this.block.body || "No details.", body);
    decorateAfterMarkdown(body, rendered, {
      openVaultLink: (path) => this.host.openVaultLink(path),
      openSystemPath: (path) => this.host.openSystemPath(path),
    });

    if (this.block.actions?.length) {
      const actions = container.createDiv({ cls: "chatobby-extension-panel__actions" });
      for (const action of this.block.actions) {
        const button = actions.createEl("button", {
          cls: `chatobby-extension-panel__action is-${action.kind ?? "secondary"}`,
        });
        if (action.icon) {
          const icon = button.createSpan({ cls: "chatobby-extension-panel__action-icon" });
          setIcon(icon, action.icon);
        }
        button.createSpan({ cls: "chatobby-extension-panel__action-label", text: action.label });
        button.onclick = () => this.host.onExtensionPanelAction?.(action);
      }
    }
  }

  protected componentClass(): string {
    return "chatobby-extension-panel";
  }
}

function iconForPanel(block: ExtensionPanelBlock): string {
  if (block.level === "error") return "alert-circle";
  if (block.level === "warning") return "triangle-alert";
  if (block.panelKind === "widget") return "panel-top";
  if (block.panelKind === "screen") return "layout-dashboard";
  return "info";
}
