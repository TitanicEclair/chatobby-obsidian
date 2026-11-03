import { Menu, setIcon } from "obsidian";
import type {
  FrontendProjectScreenViewModel,
  FrontendProjectSessionViewModel,
  FrontendProjectSummaryViewModel,
  FrontendProjectMessageSearchHitViewModel,
} from "../../../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection, createPageState } from "../../../../ui/shared/page-shell";
import { confirmAction } from "../../../../ui/modals/modals";
import type { SessionAdvancedAction } from "../../../../ui/session/session-maintenance";
import { choiceSelect, plural } from "../project-elements";
import type { ProjectPresentationActions, ProjectsViewProps, ProjectViewPatch, SessionWorkspace } from "../project-view-types";

export interface SessionLibraryOptions extends ProjectPresentationActions,
  Pick<ProjectsViewProps, "app" | "onMessageHit" | "onSessionAction" | "onRefresh" | "onDeleteSession"> {
  isCreating(): boolean;
  startCreating(model: FrontendProjectScreenViewModel): void;
  changeView(patch: ProjectViewPatch): Promise<void>;
  bindSearchInput(input: HTMLInputElement, kind: "project" | "session"): void;
  isPendingMoveSource(sessionId: string, workspace: SessionWorkspace): boolean;
  moveSession(session: FrontendProjectSessionViewModel): Promise<void>;
}

/** Project rail, session rows and message search; queues and pending moves stay view-owned. */
export class SessionLibrary {
  constructor(private readonly options: SessionLibraryOptions) { }

  renderRail(parent: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const top = parent.createDiv({ cls: "chatobby-projects__rail-top" });
    top.createEl("strong", { text: "Chats and Projects" });
    const create = top.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": "Create Project" },
    });
    create.disabled = this.options.isCreating();
    setIcon(create, "plus");
    create.addEventListener("click", () => this.options.startCreating(model));
    const search = parent.createEl("input", {
      cls: "chatobby-projects__search",
      attr: { type: "search", placeholder: "Search Projects", "aria-label": "Search Projects", enterkeyhint: "search" },
    });
    search.dataset.pageStateKey = "projects-search";
    search.value = model.query;
    this.options.bindSearchInput(search, "project");
    const filters = parent.createDiv({ cls: "chatobby-projects__rail-filters" });
    choiceSelect(filters, model.lifecycleOptions, model.lifecycleFilter, "Project status", (value) => {
      void this.options.changeView({ lifecycleFilter: value as FrontendProjectScreenViewModel["lifecycleFilter"] });
    });
    choiceSelect(filters, model.availabilityOptions, model.availabilityFilter, "Folder availability", (value) => {
      void this.options.changeView({ availabilityFilter: value as FrontendProjectScreenViewModel["availabilityFilter"] });
    });
    choiceSelect(filters, model.sortOptions, model.sort, "Project sorting", (value) => {
      void this.options.changeView({ sort: value as FrontendProjectScreenViewModel["sort"] });
    });
    const list = parent.createDiv({ cls: "chatobby-projects__rail-list" });
    this.renderVaultRailItem(list, model);
    for (const project of model.projects) this.renderRailProject(list, project, model);
    if (model.projects.length === 0) {
      list.createDiv({ cls: "chatobby-projects__rail-empty", text: model.query ? "No matching Projects" : "No Projects yet" });
    }
  }

  private renderVaultRailItem(parent: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const button = parent.createEl("button", {
      cls: `chatobby-projects__rail-project${model.selectedProjectId ? "" : " is-active"}`,
      attr: { type: "button", "aria-label": "Open Vault chats" },
    });
    const icon = button.createSpan({ cls: "chatobby-projects__rail-project-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, "vault");
    const copy = button.createDiv({ cls: "chatobby-projects__rail-project-copy" });
    copy.createDiv({ cls: "chatobby-projects__rail-project-name", text: "Vault" });
    copy.createDiv({
      cls: "chatobby-projects__rail-project-meta",
      text: `${model.vaultSessionCount} ${plural(model.vaultSessionCount, "chat")}`,
    });
    button.addEventListener("click", () => void this.options.changeView({ selectedProjectId: undefined }));
  }

  private renderRailProject(parent: HTMLElement, project: FrontendProjectSummaryViewModel, model: FrontendProjectScreenViewModel): void {
    const button = parent.createEl("button", {
      cls: `chatobby-projects__rail-project${project.projectId === model.selectedProjectId ? " is-active" : ""}`,
      attr: { type: "button", "aria-label": `Open ${project.name}` },
    });
    const icon = button.createSpan({ cls: "chatobby-projects__rail-project-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, project.availability === "available" ? "folder-kanban" : "triangle-alert");
    const copy = button.createDiv({ cls: "chatobby-projects__rail-project-copy" });
    copy.createDiv({ cls: "chatobby-projects__rail-project-name", text: project.name });
    copy.createDiv({
      cls: "chatobby-projects__rail-project-meta",
      text: `${project.sessionCount} ${plural(project.sessionCount, "chat")} · ${project.rootCount} ${plural(project.rootCount, "folder")}`,
    });
    button.addEventListener("click", () => void this.options.changeView({ selectedProjectId: project.projectId }));
  }

  renderChatSection(
    parent: HTMLElement,
    sessions: readonly FrontendProjectSessionViewModel[],
    empty: {
      readonly model: FrontendProjectScreenViewModel;
      readonly totalCount: number;
      readonly workspace: SessionWorkspace;
      readonly emptyTitle: string;
      readonly emptyDescription: string;
      readonly actionLabel?: string;
      readonly onAction?: () => void;
    },
  ): void {
    const visibleSessions = sessions.filter((session) => !this.options.isPendingMoveSource(session.sessionId, empty.workspace));
    const hiddenCount = sessions.length - visibleSessions.length;
    const visibleTotalCount = Math.max(0, empty.totalCount - hiddenCount);
    const chats = createPageSection(parent, {
      title: "Chats",
      description: empty.model.sessionQuery
        ? `${visibleSessions.length} of ${visibleTotalCount} conversations`
        : visibleTotalCount === 0 ? "No conversations here yet." : `${visibleTotalCount} conversations`,
      className: "chatobby-projects__chats",
    });
    this.renderChatControls(chats.content, empty.model);
    if (empty.model.sessionSearchMode === "messages" && empty.model.sessionQuery.trim()) {
      this.renderMessageSearchPage(chats.content, empty.model);
      return;
    }
    if (visibleSessions.length === 0) {
      createPageState(chats.content, {
        kind: "empty",
        title: empty.model.sessionQuery ? "No matching chats" : empty.emptyTitle,
        description: empty.model.sessionQuery
          ? empty.model.sessionSearchMode === "messages"
            ? "No chat names, opening prompts, or message contents matched this search."
            : "No chat names or opening prompts matched. Turn on message search to look inside conversations."
          : empty.emptyDescription,
        actionLabel: empty.model.sessionQuery ? "Clear search" : empty.actionLabel,
        onAction: empty.model.sessionQuery ? () => void this.options.changeView({ sessionQuery: "" }) : empty.onAction,
      });
      return;
    }
    const list = chats.content.createDiv({ cls: "chatobby-projects__chat-list" });
    for (const session of visibleSessions) this.renderSession(list, session);
  }

  private renderMessageSearchPage(parent: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const page = model.messageSearchPage;
    if (!page || page.items.length === 0) {
      createPageState(parent, {
        kind: "empty",
        title: "No matching messages",
        description: "No indexed user or assistant message in this scope contains that text.",
        actionLabel: "Clear search",
        onAction: () => void this.options.changeView({ sessionQuery: "", sessionSearchPage: 0 }),
      });
      return;
    }
    const summary = parent.createDiv({
      cls: "chatobby-projects__message-results-summary",
      text: `${page.totalCount} ${plural(page.totalCount, "match")} · page ${page.page + 1}`,
    });
    summary.setAttr("aria-live", "polite");
    const list = parent.createDiv({ cls: "chatobby-projects__message-results" });
    for (const hit of page.items) this.renderMessageHit(list, hit);
    if (!page.hasPrevious && !page.hasNext) return;
    const pagination = parent.createDiv({ cls: "chatobby-projects__message-pagination" });
    const previous = pagination.createEl("button", { text: "Previous", attr: { type: "button" } });
    previous.disabled = !page.hasPrevious;
    previous.addEventListener("click", () => void this.options.changeView({ sessionSearchPage: Math.max(0, page.page - 1) }));
    pagination.createSpan({ text: `Page ${page.page + 1} of ${Math.max(1, Math.ceil(page.totalCount / page.pageSize))}` });
    const next = pagination.createEl("button", { text: "Next", attr: { type: "button" } });
    next.disabled = !page.hasNext;
    next.addEventListener("click", () => void this.options.changeView({ sessionSearchPage: page.page + 1 }));
  }

  private renderMessageHit(parent: HTMLElement, hit: FrontendProjectMessageSearchHitViewModel): void {
    const button = parent.createEl("button", {
      cls: "chatobby-projects__message-result",
      attr: { type: "button", "aria-label": `Open match in ${hit.sessionName}` },
    });
    const header = button.createDiv({ cls: "chatobby-projects__message-result-header" });
    header.createSpan({ cls: "chatobby-projects__message-result-session", text: hit.sessionName });
    header.createSpan({ cls: "chatobby-projects__message-result-meta", text: `${humanizeRole(hit.role)} · ${formatRelativeDate(hit.timestamp)}` });
    const excerpt = button.createDiv({ cls: "chatobby-projects__message-result-excerpt" });
    renderMatchRanges(excerpt, hit.excerpt, hit.matchRanges);
    button.addEventListener("click", () => void this.options.onMessageHit(hit));
  }

  private renderChatControls(parent: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const controls = parent.createDiv({ cls: "chatobby-projects__chat-controls" });
    const search = controls.createEl("input", {
      cls: "chatobby-projects__chat-search",
      attr: {
        type: "search",
        placeholder: model.sessionSearchMode === "messages" ? "Search chat messages" : "Search chats",
        "aria-label": "Search chats",
        enterkeyhint: "search",
      },
    });
    search.dataset.pageStateKey = "project-chats-search";
    search.value = model.sessionQuery;
    this.options.bindSearchInput(search, "session");
    const messages = controls.createEl("button", {
      cls: `chatobby-projects__message-search${model.sessionSearchMode === "messages" ? " is-active" : ""}`,
      text: "Search messages",
      attr: {
        type: "button",
        "aria-label": "Search inside chat messages",
        "aria-pressed": String(model.sessionSearchMode === "messages"),
      },
    });
    messages.addEventListener("click", () => void this.options.changeView({
      sessionSearchMode: model.sessionSearchMode === "messages" ? "titles" : "messages",
      sessionSearchPage: 0,
    }));
    choiceSelect(controls, model.sessionSortOptions, model.sessionSort, "Chat sorting", (value) => {
      void this.options.changeView({ sessionSort: value as FrontendProjectScreenViewModel["sessionSort"] });
    });
  }

  private renderSession(parent: HTMLElement, session: FrontendProjectSessionViewModel): void {
    const row = parent.createDiv({ cls: `chatobby-projects__chat${session.running ? " is-running" : ""}` });
    const open = row.createEl("button", {
      cls: "chatobby-projects__chat-open",
      attr: { type: "button", "aria-label": `Resume ${session.name}` },
    });
    const copy = open.createDiv({ cls: "chatobby-projects__chat-copy" });
    const heading = copy.createDiv({ cls: "chatobby-projects__chat-heading" });
    heading.createSpan({ text: session.name });
    if (session.running) heading.createSpan({ cls: "chatobby-projects__badge", text: "Open" });
    if (session.matchSnippet) copy.createDiv({ cls: "chatobby-projects__chat-snippet", text: session.matchSnippet });
    const meta = open.createDiv({ cls: "chatobby-projects__chat-meta" });
    meta.createSpan({ cls: "chatobby-projects__chat-meta-updated", text: formatRelativeDate(session.updatedAt) });
    meta.createSpan({ cls: "chatobby-projects__chat-meta-messages", text: `${session.messageCount} ${plural(session.messageCount, "message")}` });
    open.addEventListener("click", () => void this.options.run("resume-chat", {
      type: "session.resume-by-id",
      payload: { sessionId: session.sessionId },
    }));
    const more = row.createEl("button", {
      cls: "clickable-icon chatobby-projects__row-action",
      attr: { type: "button", "aria-label": `More actions for ${session.name}` },
    });
    setIcon(more, "more-horizontal");
    const openMenu = (event: MouseEvent) => this.openSessionMenu(event, session);
    more.addEventListener("click", openMenu);
    row.addEventListener("contextmenu", openMenu);
  }

  openSessionMenu(event: MouseEvent, session: FrontendProjectSessionViewModel): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Resume").setIcon("message-square").onClick(() => void this.options.run("resume-chat", {
      type: "session.resume-by-id",
      payload: { sessionId: session.sessionId },
    })));
    menu.addItem((item) => item.setTitle("Move chat…").setIcon("folder-input").onClick(() => void this.options.moveSession(session)));
    menu.addSeparator();
    this.addSessionMenuItem(menu, session, "rename", "Rename", "pencil");
    this.addSessionMenuItem(menu, session, "clone", "Clone", "copy");
    this.addSessionMenuItem(menu, session, "fork", "Fork from a message", "git-fork");
    menu.addSeparator();
    this.addSessionMenuItem(menu, session, "export-html", "Export as HTML", "file-code");
    this.addSessionMenuItem(menu, session, "export-jsonl", "Export as JSONL", "file-json");
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Delete").setIcon("trash-2").onClick(() => void this.deleteSession(session)));
    menu.showAtMouseEvent(event);
  }

  private addSessionMenuItem(menu: Menu, session: FrontendProjectSessionViewModel, action: SessionAdvancedAction, title: string, icon: string): void {
    menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(() => void this.options.runAction(`session:${action}`, async () => {
      await this.options.onSessionAction(session.sessionId, action);
      await this.options.onRefresh();
    })));
  }

  private async deleteSession(session: FrontendProjectSessionViewModel): Promise<void> {
    if (!await confirmAction(this.options.app, {
      title: "Delete chat?",
      message: `Delete “${session.name}”? This removes its stored conversation and subagent run data.`,
      confirmLabel: "Delete",
      destructive: true,
    })) return;
    await this.options.runAction("delete-chat", async () => {
      await this.options.onDeleteSession(session.sessionId);
      await this.options.onRefresh();
    });
  }
}

function humanizeRole(role: FrontendProjectMessageSearchHitViewModel["role"]): string {
  return role === "user" ? "You" : "Chatobby";
}

function renderMatchRanges(
  parent: HTMLElement,
  text: string,
  ranges: readonly { readonly start: number; readonly end: number }[],
): void {
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(cursor, Math.min(text.length, range.start));
    const end = Math.max(start, Math.min(text.length, range.end));
    if (start > cursor) parent.append(document.createTextNode(text.slice(cursor, start)));
    parent.createEl("mark", { text: text.slice(start, end) });
    cursor = end;
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function formatRelativeDate(value: string | undefined): string {
  const time = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(time)) return "Date unavailable";
  const elapsed = Math.max(0, Date.now() - time);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(time).toLocaleDateString();
}
