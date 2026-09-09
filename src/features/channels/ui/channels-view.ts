import { type App, Menu, setIcon } from "obsidian";
import { confirmAction } from "../../../ui/modals/modals";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { CreateChannelModal } from "./channel-dialog";
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
  onCreateChannel?(name: string, description: string): Promise<void>;
  onSendMessage?(channelId: string, text: string, replyTo?: string, recipientActorIds?: readonly string[]): Promise<void>;
  onSetParticipant?(channelId: string, actorId: string, action: "invite" | "disconnect"): Promise<void>;
  focusMessageId?: string;
}

/** Native renderer for the runtime-owned vault channel read model. */
export class ChannelsView extends ChatobbyComponent {
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;
  private shell: PageShell | null = null;
  private refreshButton: HTMLButtonElement | null = null;
  private readonly drafts = new Map<string, { text: string; replyTo?: string; replyLabel?: string; recipient: string; revision: number }>();
  private readonly sending = new Set<string>();
  private query = "";
  private createButton: HTMLButtonElement | null = null;
  private createDialog: CreateChannelModal | null = null;
  private previousChannelId: string | undefined;

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
    if (this.options.onCreateChannel) {
      this.createButton = this.shell.actions.createEl("button", { text: "New channel", cls: "mod-cta", attr: { type: "button" } });
      this.createButton.addEventListener("click", () => {
        if (!this.options.onCreateChannel) return;
        this.createDialog?.close();
        this.createDialog = new CreateChannelModal(this.options.app, (name, description) => this.options.onCreateChannel!(name, description));
        this.createDialog.open();
      });
    }
    this.refreshButton = createPageIconButton(this.shell.actions, "refresh-cw", "Refresh channels");
    this.refreshButton.addEventListener("click", () => void this.options.onRefresh());
    createPageIconButton(this.shell.actions, "x", "Close channels")
      .addEventListener("click", () => this.options.onBack());
    this.unsubscribe = this.options.subscribe((model) => this.renderState(model));
    this.renderState(this.options.getModel());
  }

  override destroy(): void {
    this.createDialog?.close();
    this.createDialog = null;
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
    const sameChannel = this.previousChannelId === model?.selectedChannelId;
    this.previousChannelId = model?.selectedChannelId;
    if (this.createButton) this.createButton.disabled = !model?.workspaceWide || model.loading;
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
    if (nextMessages && previousScroll && sameChannel) {
      nextMessages.scrollTop = previousScroll.pinned ? nextMessages.scrollHeight : previousScroll.top;
    } else if (nextMessages) nextMessages.scrollTop = nextMessages.scrollHeight;
  }

  private renderSidebar(sidebar: HTMLElement, model: FrontendChannelScreenViewModel | null): void {
    const search = sidebar.createEl("input", { cls: "chatobby-channels__search", attr: { type: "search", placeholder: "Find a channel…", "aria-label": "Find a channel", "data-page-state-key": "channel-search" } });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      for (const row of Array.from(sidebar.querySelectorAll<HTMLElement>(".chatobby-channels__channel"))) row.hidden = !row.textContent?.toLowerCase().includes(this.query.toLowerCase());
    });
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
        button.hidden = !`${item.label} ${item.subtitle}`.toLowerCase().includes(this.query.toLowerCase());
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
    if (model?.workspaceWide && model.selectedChannelId) this.renderParticipants(conversation, model);
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
    if (model?.canCompose && this.options.onSendMessage) this.renderComposer(conversation, model);
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
        description: "Keep research, decisions, and agent handoffs together. Choose a conversation or create a shared channel.",
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
    row.toggleClass("is-operator", message.operatorAuthored === true);
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
    const navigation = message.senderNavigation;
    if (navigation) {
      const open = menu.createEl("button", { text: "Go to agent feed", attr: { type: "button" } });
      open.addEventListener("click", (event) => { event.preventDefault(); void this.options.onOpenAgent(navigation); });
    }
    const model = this.options.getModel();
    if (model?.canCompose && model.selectedChannelId) {
      const channelId = model.selectedChannelId;
      menu.createEl("button", { text: "Reply", attr: { type: "button" } }).addEventListener("click", () => {
        const draft = this.getDraft(channelId);
        draft.replyTo = message.id; draft.replyLabel = `${message.senderLabel}: ${message.text.slice(0, 100)}`;
        this.renderState(this.options.getModel());
        this.shell?.body.querySelector<HTMLTextAreaElement>(".chatobby-channels__compose-input")?.focus();
      });
    }
    const copy = menu.createEl("button", { text: "Copy message", attr: { type: "button" } });
    copy.addEventListener("click", (event) => {
      event.preventDefault();
      void navigator.clipboard.writeText(message.text);
    });
    if (message.contextLabel) menu.createDiv({ cls: "chatobby-channels__message-context", text: message.contextLabel });
    if (message.deliveryLabel) content.createDiv({ cls: "chatobby-channels__delivery", text: message.deliveryLabel });
    if (message.replyTo) {
      const reply = content.createEl("button", { text: "View replied message", cls: "chatobby-channels__reply-link" });
      reply.addEventListener("click", () => {
        const target = Array.from(this.shell?.body.querySelectorAll<HTMLElement>("[data-message-id]") ?? []).find((element) => element.dataset.messageId === message.replyTo);
        if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
        else this.setLocalError("Load earlier messages to see this reply’s original message.");
      });
    }
  }

  private renderParticipants(host: HTMLElement, model: FrontendChannelScreenViewModel): void {
    const channelId = model.selectedChannelId;
    if (!channelId) return;
    const details = host.createEl("details", { cls: "chatobby-channels__participants", attr: { "data-page-state-key": `participants:${channelId}` } });
    details.createEl("summary", { text: `Participants · ${model.participants?.filter((member) => member.state !== "disconnected").length ?? 0}` });
    const list = details.createDiv({ cls: "chatobby-channels__participant-list" });
    for (const member of model.participants ?? []) {
      if (member.state === "disconnected") continue;
      const row = list.createDiv({ cls: "chatobby-channels__participant" });
      const navigation = member.navigation;
      if (navigation) row.createEl("button", { text: member.label, cls: "chatobby-channels__participant-name" }).addEventListener("click", () => void this.options.onOpenAgent(navigation));
      else row.createSpan({ text: member.label, cls: "chatobby-channels__participant-name" });
      if (member.kind !== "user") row.createSpan({ text: member.state === "connected" ? (member.live ? "Connected" : "Offline") : member.state.replaceAll("_", " "), cls: "chatobby-channels__muted" });
      if (member.kind !== "user" && model.canCompose && this.options.onSetParticipant) row.createEl("button", { cls: "chatobby-channels__participant-action", text: member.state === "connected" ? "Disconnect" : "Cancel invite" }).addEventListener("click", () => void this.options.onSetParticipant?.(channelId, member.actorId, "disconnect").catch((error: unknown) => this.setLocalError(error instanceof Error ? error.message : "Could not update this participant.")));
    }
    if (!model.participants?.some((member) => member.state !== "disconnected")) list.createDiv({ text: "Invite agents to bring their work into this channel.", cls: "chatobby-channels__muted" });
    if (model.canCompose && this.options.onSetParticipant && model.availableAgents?.length) {
      const row = details.createDiv({ cls: "chatobby-channels__invite" });
      const select = row.createEl("select", { attr: { "aria-label": "Agent to invite" } });
      select.createEl("option", { text: "Choose an agent…", value: "" });
      for (const agent of model.availableAgents) select.createEl("option", { text: agent.label, value: agent.actorId });
      row.createEl("button", { text: "Invite" }).addEventListener("click", () => {
        if (!select.value) { select.focus(); return; }
        void this.options.onSetParticipant?.(channelId, select.value, "invite").catch((error: unknown) => this.setLocalError(error instanceof Error ? error.message : "Could not invite this agent."));
      });
    }
  }

  private getDraft(channelId: string): { text: string; replyTo?: string; replyLabel?: string; recipient: string; revision: number } {
    let draft = this.drafts.get(channelId);
    if (!draft) { draft = { text: "", recipient: "", revision: 0 }; this.drafts.set(channelId, draft); }
    return draft;
  }

  private renderComposer(host: HTMLElement, model: FrontendChannelScreenViewModel): void {
    const channelId = model.selectedChannelId;
    if (!channelId) return;
    const draft = this.getDraft(channelId);
    const form = host.createEl("form", { cls: "chatobby-channels__composer" });
    if (draft.replyTo) {
      const reply = form.createDiv({ cls: "chatobby-channels__reply-preview" });
      reply.createSpan({ text: `Replying to ${draft.replyLabel ?? "a message"}` });
      createPageIconButton(reply, "x", "Cancel reply").addEventListener("click", () => { draft.replyTo = undefined; draft.replyLabel = undefined; this.renderState(this.options.getModel()); });
    }
    const input = form.createEl("textarea", { cls: "chatobby-channels__compose-input", attr: { "aria-label": "Channel message", placeholder: "Share an update, a question, or a direction…", rows: "3", "data-page-state-key": `channel-draft:${channelId}:${draft.revision}` } });
    input.value = draft.text;
    input.addEventListener("input", () => { draft.text = input.value; });
    const controls = form.createDiv({ cls: "chatobby-channels__composer-controls" });
    const recipient = controls.createEl("select", { attr: { "aria-label": "Message recipient", "data-page-state-key": `channel-recipient:${channelId}` } });
    recipient.createEl("option", { text: "Everyone in this channel", value: "" });
    for (const member of model.participants ?? []) if (member.kind !== "user" && member.state === "connected") recipient.createEl("option", { text: member.label, value: member.actorId });
    if (draft.recipient && !Array.from(recipient.options).some((option) => option.value === draft.recipient)) recipient.createEl("option", { text: "Selected recipient is no longer connected", value: draft.recipient });
    recipient.value = draft.recipient;
    recipient.addEventListener("change", () => { draft.recipient = recipient.value; });
    const send = controls.createEl("button", { text: this.sending.has(channelId) ? "Sending…" : "Send", cls: "mod-cta", attr: { type: "submit" } });
    send.disabled = this.sending.has(channelId);
    const submit = (): void => {
      const text = draft.text.trim();
      if (!text || this.sending.has(channelId) || !this.options.onSendMessage) return;
      const submittedText = draft.text;
      this.sending.add(channelId); send.disabled = true;
      void this.options.onSendMessage(channelId, text, draft.replyTo, draft.recipient ? [draft.recipient] : undefined).then(() => {
        if (draft.text === submittedText) { draft.text = ""; draft.replyTo = undefined; draft.replyLabel = undefined; draft.revision += 1; }
        this.localError = null;
      }).catch((error: unknown) => { this.localError = error instanceof Error ? error.message : "Could not send the message. Your draft is saved here."; }).finally(() => {
        this.sending.delete(channelId);
        if (this.container) this.renderState(this.options.getModel());
      });
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
    input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); } });
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
