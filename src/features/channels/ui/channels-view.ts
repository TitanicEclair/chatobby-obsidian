import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { createPageHeader, createPageIconButton } from "../../../ui/shared/page-shell";
import type {
  FrontendChannelMessageViewModel,
  FrontendChannelScreenViewModel,
  FrontendNavigationReference,
} from "../../../vendor/chatobby-client/frontend-contracts.js";

export interface ChannelsViewOptions {
  getModel(): FrontendChannelScreenViewModel | null;
  subscribe(listener: (model: FrontendChannelScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onSelectChannel(channelId: string): Promise<void>;
  onLoadEarlier(cursor: string): Promise<void>;
  onSetArchived(channelId: string, archived: boolean): Promise<void>;
  onOpenAgent(reference: FrontendNavigationReference): Promise<void>;
  focusMessageId?: string;
}

/** Native renderer for the runtime-owned vault channel read model. */
export class ChannelsView extends ChatobbyComponent {
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;

  constructor(private readonly options: ChannelsViewOptions) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-channels";
  }

  protected onRender(container: HTMLElement): void {
    container.setAttr("tabindex", "-1");
    this.unsubscribe = this.options.subscribe((model) => this.renderState(model));
    this.renderState(this.options.getModel());
  }

  override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.destroy();
  }

  focusContainer(): void {
    this.container?.focus();
  }

  setLocalError(error: string | null): void {
    this.localError = error;
    this.renderState(this.options.getModel());
  }

  private renderState(model: FrontendChannelScreenViewModel | null): void {
    const container = this.container;
    if (!container) return;
    const previousMessages = container.querySelector<HTMLElement>(".chatobby-channels__messages");
    const previousScroll = previousMessages ? {
      pinned: previousMessages.scrollHeight - previousMessages.scrollTop - previousMessages.clientHeight < 24,
      top: previousMessages.scrollTop,
    } : null;
    container.empty();
    const { actions } = createPageHeader(container, {
      title: "Channels",
      headerClass: "chatobby-channels__header",
      actionsClass: "chatobby-channels__header-actions",
    });
    const refresh = createPageIconButton(actions, "refresh-cw", "Refresh channels");
    refresh.toggleClass("is-loading", model?.loading ?? false);
    refresh.setAttr("aria-busy", String(model?.loading ?? false));
    refresh.addEventListener("click", () => void this.options.onRefresh());
    const back = createPageIconButton(actions, "x", "Close channels");
    back.addEventListener("click", () => this.options.onBack());

    const error = this.localError ?? model?.error;
    if (error) container.createDiv({ cls: "chatobby-channels__notice is-error", text: error });
    const layout = container.createDiv({ cls: "chatobby-channels__layout" });
    this.renderSidebar(layout, model);
    this.renderConversation(layout, model);
    const nextMessages = container.querySelector<HTMLElement>(".chatobby-channels__messages");
    if (nextMessages && previousScroll) {
      nextMessages.scrollTop = previousScroll.pinned ? nextMessages.scrollHeight : previousScroll.top;
    }
  }

  private renderSidebar(layout: HTMLElement, model: FrontendChannelScreenViewModel | null): void {
    const sidebar = layout.createEl("aside", { cls: "chatobby-channels__sidebar", attr: { "aria-label": "Channel list" } });
    if (!model || model.groups.length === 0) {
      sidebar.createDiv({ cls: "chatobby-channels__empty", text: model?.loading || !model ? "Loading…" : "No channels" });
      return;
    }
    for (const groupModel of model.groups) {
      const group = sidebar.createDiv({ cls: "chatobby-channels__group" });
      group.createDiv({ cls: "chatobby-channels__section-label", text: groupModel.label });
      for (const item of groupModel.items) {
        const button = group.createEl("button", {
          cls: "chatobby-channels__channel",
          attr: { type: "button", "aria-current": item.selected ? "page" : null },
        });
        button.toggleClass("is-active", item.selected);
        const icon = button.createSpan({ cls: "chatobby-channels__channel-icon", attr: { "aria-hidden": "true" } });
        setIcon(icon, item.iconToken);
        const copy = button.createSpan({ cls: "chatobby-channels__channel-copy" });
        copy.createSpan({ cls: "chatobby-channels__channel-name", text: item.label });
        copy.createSpan({ cls: "chatobby-channels__channel-members", text: item.subtitle });
        button.addEventListener("click", () => void this.options.onSelectChannel(item.id));
      }
    }
  }

  private renderConversation(layout: HTMLElement, model: FrontendChannelScreenViewModel | null): void {
    const conversation = layout.createDiv({ cls: "chatobby-channels__conversation" });
    const heading = conversation.createDiv({ cls: "chatobby-channels__conversation-heading" });
    const headingCopy = heading.createDiv({ cls: "chatobby-channels__conversation-heading-copy" });
    headingCopy.createEl("strong", { text: model?.heading ?? "Select a channel" });
    if (model?.subheading) headingCopy.createSpan({ text: model.subheading });
    const selected = model?.groups.flatMap((group) => group.items).find((item) => item.id === model.selectedChannelId);
    if (selected && (selected.archived || selected.canArchive)) {
      const archived = selected.archived;
      const manage = createPageIconButton(
        heading,
        archived ? "archive-restore" : "archive",
        archived ? "Restore channel" : "Archive channel",
      );
      manage.addEventListener("click", () => {
        if (!archived && !window.confirm(`Archive “${selected.label}”? Its messages remain available under Archived.`)) return;
        void this.options.onSetArchived(selected.id, !archived);
      });
    }
    const messages = conversation.createDiv({ cls: "chatobby-channels__messages", attr: { role: "log", "aria-live": "polite" } });
    if (model?.nextCursor) {
      const cursor = model.nextCursor;
      const earlier = messages.createEl("button", {
        cls: "chatobby-channels__earlier",
        text: "Load earlier messages",
        attr: { type: "button" },
      });
      earlier.addEventListener("click", () => void this.options.onLoadEarlier(cursor));
    }
    if (!model || model.loading) {
      messages.createDiv({ cls: "chatobby-channels__empty", text: "Loading messages…" });
      return;
    }
    if (!model.selectedChannelId) {
      messages.createDiv({ cls: "chatobby-channels__empty", text: "Choose a channel to inspect its communication." });
      return;
    }
    if (model.messages.length === 0) {
      messages.createDiv({ cls: "chatobby-channels__empty", text: "No messages in this channel yet." });
      return;
    }
    for (const message of model.messages) this.renderMessage(messages, message);
  }

  private renderMessage(parent: HTMLElement, message: FrontendChannelMessageViewModel): void {
    const row = parent.createDiv({ cls: "chatobby-channels__message" });
    row.dataset.messageId = message.id;
    if (message.id === this.options.focusMessageId) {
      row.addClass("is-target");
      requestAnimationFrame(() => row.scrollIntoView({ block: "center" }));
    }
    row.createDiv({ cls: "chatobby-channels__avatar", text: message.senderInitials }).setAttr("aria-hidden", "true");
    const content = row.createDiv({ cls: "chatobby-channels__message-content" });
    const meta = content.createDiv({ cls: "chatobby-channels__message-meta" });
    meta.createEl("strong", { text: message.senderLabel });
    meta.createSpan({ cls: "chatobby-channels__message-route", text: message.recipientLabel });
    meta.createSpan({ cls: "chatobby-channels__message-kind", text: message.kindLabel });
    meta.createEl("time", { text: formatTime(message.createdAt), attr: { datetime: new Date(message.createdAt).toISOString() } });
    const bubble = content.createEl("details", { cls: "chatobby-channels__bubble" });
    bubble.createEl("summary", { text: message.text });
    const menu = bubble.createDiv({ cls: "chatobby-channels__message-menu" });
    const open = menu.createEl("button", { text: "Go to agent feed", attr: { type: "button" } });
    open.addEventListener("click", (event) => {
      event.preventDefault();
      void this.options.onOpenAgent(message.senderNavigation);
    });
    const copy = menu.createEl("button", { text: "Copy message", attr: { type: "button" } });
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      void navigator.clipboard.writeText(message.text);
    });
    if (message.contextLabel) menu.createDiv({ cls: "chatobby-channels__message-context", text: message.contextLabel });
  }
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}
