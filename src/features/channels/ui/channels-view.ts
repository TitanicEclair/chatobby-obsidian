import { type App, Menu, setIcon } from "obsidian";
import { confirmAction } from "../../../ui/modals/modals";
import { ChatobbyComponent } from "../../../ui/shared/component";
import {
  createPageIconButton,
  createPageMasterDetail,
  createPageState,
  PageShell,
} from "../../../ui/shared/page-shell";
import type {
  FrontendChannelMessageViewModel,
  FrontendChannelScreenViewModel,
  FrontendNavigationReference,
} from "../../../vendor/chatobby-client/frontend-contracts.js";

export interface ChannelsViewOptions {
  app: App;
  getModel(): FrontendChannelScreenViewModel | null;
  subscribe(listener: (model: FrontendChannelScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onSelectChannel(channelId: string): Promise<void>;
  onLoadEarlier(cursor: string): Promise<void>;
  onSetArchived(channelId: string, archived: boolean): Promise<void>;
  onDeleteChannel(channelId: string): Promise<void>;
  onOpenAgent(reference: FrontendNavigationReference): Promise<void>;
  focusMessageId?: string;
}

/** Native renderer for the runtime-owned vault channel read model. */
export class ChannelsView extends ChatobbyComponent {
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;
  private shell: PageShell | null = null;
  private refreshButton: HTMLButtonElement | null = null;

  constructor(private readonly options: ChannelsViewOptions) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-channels";
  }

  protected onRender(container: HTMLElement): void {
    container.setAttr("tabindex", "-1");
    this.shell = new PageShell(container, {
      title: "Channels",
      width: "full",
      containedBody: true,
      headerClass: "chatobby-channels__header",
      actionsClass: "chatobby-channels__header-actions",
      bodyClass: "chatobby-channels__body",
    });
    this.refreshButton = createPageIconButton(this.shell.actions, "refresh-cw", "Refresh channels");
    this.refreshButton.addEventListener("click", () => void this.options.onRefresh());
    createPageIconButton(this.shell.actions, "x", "Close channels")
      .addEventListener("click", () => this.options.onBack());
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
    const shell = this.shell;
    if (!shell) return;
    const previousMessages = shell.body.querySelector<HTMLElement>(".chatobby-channels__messages");
    const previousScroll = previousMessages ? {
      pinned: previousMessages.scrollHeight - previousMessages.scrollTop - previousMessages.clientHeight < 24,
      top: previousMessages.scrollTop,
    } : null;
    const error = this.localError ?? model?.error;
    shell.setBusy(Boolean(model?.loading));
    this.refreshButton?.toggleClass("is-loading", model?.loading ?? false);
    this.refreshButton?.setAttr("aria-busy", String(model?.loading ?? false));
    shell.setStatus(
      error
        ? { tone: "error", message: error, actionLabel: "Try again", onAction: () => void this.options.onRefresh() }
        : null,
    );
    shell.updateBody(`channels:${model?.selectedChannelId ?? "none"}`, (body) => {
      const layout = createPageMasterDetail(body, {
        className: "chatobby-channels__layout",
        masterLabel: "Channel list",
        detailLabel: model?.heading ?? "Channel conversation",
      });
      layout.master.addClass("chatobby-channels__sidebar");
      layout.detail.addClass("chatobby-channels__conversation");
      this.renderSidebar(layout.master, model);
      this.renderConversation(layout.detail, model);
    });
    const nextMessages = shell.body.querySelector<HTMLElement>(".chatobby-channels__messages");
    if (nextMessages && previousScroll) {
      nextMessages.scrollTop = previousScroll.pinned ? nextMessages.scrollHeight : previousScroll.top;
    }
  }

  private renderSidebar(sidebar: HTMLElement, model: FrontendChannelScreenViewModel | null): void {
    if (!model || model.groups.length === 0) {
      createPageState(sidebar, {
        kind: this.localError ? "error" : model?.loading || !model ? "loading" : "empty",
        title: this.localError ? "Channels unavailable" : model?.loading || !model ? "Loading channels" : "No channels",
      });
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
        button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          this.openChannelMenu(event, item);
        });
      }
    }
  }

  private renderConversation(conversation: HTMLElement, model: FrontendChannelScreenViewModel | null): void {
    const heading = conversation.createDiv({ cls: "chatobby-channels__conversation-heading" });
    const headingCopy = heading.createDiv({ cls: "chatobby-channels__conversation-heading-copy" });
    headingCopy.createEl("strong", { text: model?.heading ?? "Select a channel" });
    if (model?.subheading) headingCopy.createSpan({ text: model.subheading });
    const selected = model?.groups.flatMap((group) => group.items).find((item) => item.id === model.selectedChannelId);
    if (selected && (selected.archived || selected.canArchive || selected.canDelete)) {
      const actions = heading.createDiv({ cls: "chatobby-channels__conversation-actions" });
      const archived = selected.archived;
      const manage = createPageIconButton(
        actions,
        archived ? "archive-restore" : "archive",
        archived ? "Restore channel" : "Archive channel",
      );
      manage.addEventListener("click", () => {
        void this.confirmArchive(selected.id, selected.label, archived);
      });
      if (selected.canDelete) {
        const remove = createPageIconButton(actions, "trash-2", "Delete channel permanently");
        remove.addClass("is-danger");
        remove.addEventListener("click", () => {
          void this.confirmDelete(selected.id, selected.label);
        });
      }
    }
    const messages = conversation.createDiv({
      cls: "chatobby-channels__messages",
      attr: {
        role: "log",
        "aria-live": "polite",
        "data-page-scroll-key": `messages:${model?.selectedChannelId ?? "none"}`,
      },
    });
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
      createPageState(messages, {
        kind: this.localError ? "error" : "loading",
        title: this.localError ? "Channel messages are unavailable" : "Loading messages",
      });
      return;
    }
    if (!model.selectedChannelId) {
      createPageState(messages, {
        kind: "empty",
        title: "Choose a channel",
        description: "Select a channel to read its messages.",
      });
      return;
    }
    if (model.messages.length === 0) {
      createPageState(messages, { kind: "empty", title: "No messages in this channel yet" });
      return;
    }
    let previousDate = "";
    for (const message of model.messages) {
      const date = dateKey(message.createdAt);
      if (date !== previousDate) {
        const separator = messages.createDiv({
          cls: "chatobby-channels__date-separator",
          attr: { role: "separator", "aria-label": formatDate(message.createdAt) },
        });
        separator.createEl("time", {
          text: formatDate(message.createdAt),
          attr: { datetime: date },
        });
        previousDate = date;
      }
      this.renderMessage(messages, message);
    }
  }

  private renderMessage(parent: HTMLElement, message: FrontendChannelMessageViewModel): void {
    const row = parent.createDiv({ cls: "chatobby-channels__message" });
    row.dataset.messageId = message.id;
    if (message.id === this.options.focusMessageId) {
      row.addClass("is-target");
      window.requestAnimationFrame(() => row.scrollIntoView({ block: "center" }));
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

  private async confirmArchive(id: string, label: string, archived: boolean): Promise<void> {
    if (!archived && !await confirmAction(this.options.app, {
      title: "Archive channel?",
      message: `Archive “${label}”? Its messages remain available under Archived.`,
      confirmLabel: "Archive",
    })) return;
    await this.options.onSetArchived(id, !archived);
  }

  private async confirmDelete(id: string, label: string): Promise<void> {
    if (!await confirmAction(this.options.app, {
      title: "Delete channel permanently?",
      message: `Permanently delete “${label}” and all of its messages? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    })) return;
    await this.options.onDeleteChannel(id);
  }

  private openChannelMenu(
    event: MouseEvent,
    item: FrontendChannelScreenViewModel["groups"][number]["items"][number],
  ): void {
    const menu = new Menu();
    menu.addItem((entry) => entry
      .setTitle("Open channel")
      .setIcon("messages-square")
      .onClick(() => void this.options.onSelectChannel(item.id)));
    menu.addItem((entry) => entry
      .setTitle("Copy channel name")
      .setIcon("copy")
      .onClick(() => void navigator.clipboard.writeText(item.label)));
    if (item.archived || item.canArchive) {
      menu.addSeparator();
      menu.addItem((entry) => entry
        .setTitle(item.archived ? "Restore channel" : "Archive channel")
        .setIcon(item.archived ? "archive-restore" : "archive")
        .onClick(() => void this.confirmArchive(item.id, item.label, item.archived)));
    }
    if (item.canDelete) {
      menu.addItem((entry) => entry
        .setTitle("Delete channel permanently")
        .setIcon("trash-2")
        .onClick(() => void this.confirmDelete(item.id, item.label)));
    }
    menu.showAtMouseEvent(event);
  }
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function dateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (target === today) return "Today";
  if (target === today - 86_400_000) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .format(date);
}
