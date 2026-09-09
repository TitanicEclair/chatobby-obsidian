import { ItemView, Menu, Notice, setIcon, type WorkspaceLeaf, type ViewStateResult } from "obsidian";
import type ChatobbyPlugin from "../../../main";
import { FrontendResyncRequiredError } from "../../../frontend/frontend-store";
import type { FrontendProjectScreenViewModel, FrontendProjectSessionViewModel, FrontendProjectSummaryViewModel } from "../../../vendor/chatobby-client/frontend-contracts.js";
import { WorkspaceConnection } from "../../../ui/workspace/workspace-connection";
import { WORKSPACE_PAGES } from "../../../ui/workspace/workspace-pages";
import { reconcileKeyed } from "../../../ui/shared/page-shell";
import { ProjectsScreenController } from "../application/projects-screen-controller";
import { StoredSessionController } from "../../session/public";
import { StoredSessionActions } from "../../../ui/session/stored-session-actions";
import { confirmAction } from "../../../ui/modals/modals";
import { parseNavigatorState, orderItems, moveBefore, type NavigatorState } from "../application/navigator-state";

export const VIEW_TYPE_CHATOBBY_NAVIGATOR = "chatobby-project-navigator";

/** Native left sidebar. Its own projection can browse without replacing any conversation. */
export class ProjectNavigatorView extends ItemView {
  private readonly connection: WorkspaceConnection;
  private readonly projects: ProjectsScreenController;
  private state: NavigatorState = parseNavigatorState(null);
  private query = "";
  private readonly visibleCounts = new Map<string, number>();
  private readonly searchVisibleCounts = new Map<string, number>();
  private list: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private editorHost: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private refreshPending: Promise<void> | null = null;
  private refreshRequested = false;
  private closed = false;
  private readonly active = new Set<string>();
  private readonly completed = new Set<string>();
  private dragged: { kind: "project" | "session"; id: string; group: string } | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ChatobbyPlugin) {
    super(leaf);
    this.navigation = false;
    this.connection = new WorkspaceConnection(plugin, () => void this.refresh(), (error) => this.showError(error));
    const sessions = new StoredSessionController({
      app: plugin.app,
      ensureConnectedTransport: async () => { await this.connection.connect(); return this.connection.getTransport(); },
      runOperation: (descriptor, operation) => plugin.runOperation(descriptor, operation),
    });
    const actions = new StoredSessionActions({ app: plugin.app, sessions, refresh: () => plugin.notifySessionDirectoryChanged() });
    this.projects = new ProjectsScreenController({
      app: plugin.app, getHost: () => this.editorHost ?? this.contentEl,
      getStore: () => this.connection.store, getProtocol: () => this.connection.protocol,
      prepareOpen: () => {}, onOpened: () => {}, onClosed: () => {},
      deleteSession: (sessionId) => sessions.delete({ sessionId }),
      runSessionAction: (sessionId, action) => actions.run({ sessionId }, action),
      navigateToMessageHit: async (hit) => {
        const view = await plugin.openSessionById(hit.sessionId);
        await view.revealMessage(hit.targetBlockId);
      },
      openSessionIntent: async (intent) => {
        if (intent.type === "session.resume-by-id") await plugin.openSessionById(intent.payload.sessionId);
        else await this.newChat(intent.payload.workspace.kind === "project" ? intent.payload.workspace.projectId : undefined);
      },
    });
  }

  getViewType(): string { return VIEW_TYPE_CHATOBBY_NAVIGATOR; }
  getDisplayText(): string { return "Chatobby"; }
  getIcon(): string { return "messages-square"; }
  getState(): Record<string, unknown> { return { ...this.state }; }
  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    this.state = parseNavigatorState(state);
    result.history = false;
    this.renderProjects();
    await super.setState(state, result);
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("chatobby-navigator");
    const brand = this.contentEl.createDiv({ cls: "chatobby-navigator__brand" });
    const emblem = brand.createSpan({ cls: "chatobby-navigator__emblem" });
    setIcon(emblem, "messages-square");
    brand.createEl("strong", { text: "Chatobby" });
    const create = this.contentEl.createEl("button", { cls: "chatobby-navigator__new", attr: { type: "button" } });
    setIcon(create.createSpan(), "square-pen"); create.createSpan({ text: "New chat" });
    create.addEventListener("click", () => this.perform(() => this.newChat()));
    const navigation = this.contentEl.createEl("nav", { cls: "chatobby-navigator__pages", attr: { "aria-label": "Chatobby pages" } });
    for (const page of WORKSPACE_PAGES) {
      const button = navigation.createEl("button", { cls: "chatobby-navigator__page", attr: { type: "button" } });
      setIcon(button.createSpan(), page.icon); button.createSpan({ text: page.label });
      button.addEventListener("click", () => this.perform(() => this.plugin.openWorkspacePage({ mode: page.mode })));
    }
    const searchField = this.contentEl.createDiv({ cls: "chatobby-navigator__search-field" });
    const searchIcon = searchField.createSpan({ cls: "chatobby-navigator__search-icon", attr: { "aria-hidden": "true" } });
    setIcon(searchIcon, "search");
    const search = searchField.createEl("input", { cls: "chatobby-navigator__search", attr: { type: "search", placeholder: "Search Projects and chats", "aria-label": "Search Projects and chats" } });
    search.addEventListener("input", () => { this.query = search.value; this.searchVisibleCounts.clear(); this.renderProjects(); });
    const heading = this.contentEl.createDiv({ cls: "chatobby-navigator__heading" });
    heading.createSpan({ text: "Projects" });
    this.iconButton(heading, "plus", "Create Project", () => this.perform(() => this.projects.openEditor()));
    this.iconButton(heading, "archive", "Browse archived Projects", () => this.perform(() => this.plugin.openWorkspacePage({ mode: "projects" })));
    this.status = this.contentEl.createDiv({ cls: "chatobby-navigator__status", text: "Loading your workspace…", attr: { role: "status" } });
    this.list = this.contentEl.createDiv({ cls: "chatobby-navigator__list" });
    this.editorHost = this.contentEl.createDiv({ cls: "is-hidden" });
    this.unsubscribe = this.connection.store.subscribeSelector(
      (snapshot) => snapshot.screenModels.find((screen): screen is FrontendProjectScreenViewModel => screen.screenId === "projects") ?? null,
      () => this.renderProjects(),
    );
    await this.connection.open().catch((error: unknown) => this.showError(error));
  }

  async onClose(): Promise<void> {
    this.closed = true;
    this.unsubscribe?.();
    this.projects.destroy();
    await this.connection.close();
  }

  private model(): FrontendProjectScreenViewModel | null {
    return this.connection.store.snapshot?.screenModels.find((screen): screen is FrontendProjectScreenViewModel => screen.screenId === "projects") ?? null;
  }

  refreshSessionDirectory(): void { void this.refresh(); }

  private refresh(): Promise<void> {
    if (this.closed || !this.connection.store.snapshot) return Promise.resolve();
    this.refreshRequested = true;
    this.refreshPending ??= this.refreshCurrent().finally(() => { this.refreshPending = null; });
    return this.refreshPending;
  }

  private async refreshCurrent(): Promise<void> {
    let staleResponses = 0;
    while (this.refreshRequested && !this.closed) {
      this.refreshRequested = false;
      try {
        await this.connection.protocol.loadScreen({ screenId: "projects" });
      } catch (error: unknown) {
        if (error instanceof FrontendResyncRequiredError && error.code === "stale-screen-response") {
          // Keep the newer subscribed model. Retry from its sequence, without an
          // unbounded busy loop if live updates continue overtaking the request.
          if (!this.closed) {
            this.renderProjects();
            if (++staleResponses < 3) this.refreshRequested = true;
          }
          continue;
        }
        if (!this.closed) this.showError(error);
      }
    }
  }

  private renderProjects(): void {
    const model = this.model();
    const list = this.list;
    if (!model || !list) return;
    this.status?.toggleClass("is-hidden", !model.error);
    if (model.error) this.status?.setText(model.error);
    const sessions = model.navigatorSessions ?? [...model.vaultSessions, ...(model.detail?.sessions ?? [])];
    for (const session of sessions) {
      if (session.active) { this.active.add(session.sessionId); this.completed.delete(session.sessionId); }
      else if (this.active.delete(session.sessionId)) this.completed.add(session.sessionId);
    }
    const query = this.query.trim().toLocaleLowerCase();
    const matching = (session: FrontendProjectSessionViewModel) => !query || session.name.toLocaleLowerCase().includes(query);
    const projects = orderItems(model.projects.filter((project) => project.lifecycle === "active" && (
      !query || project.name.toLocaleLowerCase().includes(query) || sessions.some((session) => session.workspace.kind === "project" && session.workspace.projectId === project.projectId && matching(session))
    )), this.state.projectOrder, (project) => project.projectId);
    const groups: Array<{ id: string; project?: FrontendProjectSummaryViewModel }> = [...projects.map((project) => ({ id: project.projectId, project })), { id: "vault" }];
    reconcileKeyed(list, groups, (group) => group.id, (group) => this.createGroup(group.id), (element, group) => {
      const title = element.querySelector<HTMLElement>(".chatobby-navigator__group-title");
      const titleButton = element.querySelector<HTMLButtonElement>(".chatobby-navigator__group-toggle");
      const icon = element.querySelector<HTMLElement>(".chatobby-navigator__group-icon");
      const project = group.project;
      if (title) title.textContent = project?.name ?? "Chats";
      const collapsed = !query && this.state.collapsed.includes(group.id);
      titleButton?.setAttr("aria-expanded", String(!collapsed));
      if (icon) setIcon(icon, collapsed ? "chevron-right" : "chevron-down");
      element.toggleClass("is-root-chats", !project);
      const children = element.querySelector<HTMLElement>(".chatobby-navigator__sessions");
      if (!children) return;
      children.toggleClass("is-hidden", collapsed);
      const projectMatches = project?.name.toLocaleLowerCase().includes(query);
      const scoped = orderItems(sessions.filter((session) => (project
        ? session.workspace.kind === "project" && session.workspace.projectId === project.projectId
        : session.workspace.kind === "vault") && (!query || projectMatches || matching(session))), this.state.sessionOrder[group.id] ?? [], (session) => session.sessionId);
      const batchSize = project ? 5 : 50;
      const counts = query ? this.searchVisibleCounts : this.visibleCounts;
      const limit = counts.get(group.id) ?? batchSize;
      reconcileKeyed(children, scoped.slice(0, limit), (session) => session.sessionId, (session) => this.createSession(session.sessionId, group.id), (row, session) => {
        const name = row.querySelector<HTMLElement>(".chatobby-navigator__session-name");
        if (name) name.textContent = session.name;
        row.setAttr("title", session.name);
        row.toggleClass("is-running", session.active === true);
        row.toggleClass("is-complete", this.completed.has(session.sessionId));
        const activity = row.querySelector<HTMLElement>(".chatobby-navigator__activity");
        activity?.setAttr("aria-label", session.active ? "Working" : this.completed.has(session.sessionId) ? "New activity" : "");
      });
      const more = element.querySelector<HTMLButtonElement>(".chatobby-navigator__more");
      more?.toggleClass("is-hidden", collapsed || scoped.length <= limit);
      more?.setAttr("aria-label", `Show ${Math.min(batchSize, Math.max(0, scoped.length - limit))} more chats in ${project?.name ?? "Vault"}`);
      let empty = element.querySelector<HTMLElement>(".chatobby-navigator__empty");
      if (scoped.length === 0 && !collapsed) {
        empty ??= element.createDiv({ cls: "chatobby-navigator__empty" });
        empty.setText(query ? "No matching chats" : project ? "Start a chat in this Project" : "Your conversations will appear here");
      } else empty?.remove();
    });
  }

  private createGroup(id: string): HTMLElement {
    const element = createDiv({ cls: "chatobby-navigator__group" });
    const header = element.createDiv({ cls: "chatobby-navigator__group-header" });
    const toggle = header.createEl("button", { cls: "chatobby-navigator__group-toggle", attr: { type: "button" } });
    toggle.createSpan({ cls: "chatobby-navigator__group-icon" });
    toggle.createSpan({ cls: "chatobby-navigator__group-title" });
    toggle.addEventListener("click", () => {
      this.state.collapsed = this.state.collapsed.includes(id) ? this.state.collapsed.filter((value) => value !== id) : [...this.state.collapsed, id];
      this.save(); this.renderProjects();
    });
    if (id !== "vault") {
      this.iconButton(header, "more-horizontal", "Project actions", (event) => this.projectMenu(event, id));
      this.dragOrder(header, "project", id, "projects");
    }
    this.iconButton(header, "plus", id === "vault" ? "New chat" : "New chat in Project", () => this.perform(() => this.newChat(id === "vault" ? undefined : id)));
    element.createDiv({ cls: "chatobby-navigator__sessions" });
    const more = element.createEl("button", { cls: "chatobby-navigator__more is-hidden", text: "Show more", attr: { type: "button" } });
    more.addEventListener("click", () => {
      const counts = this.query.trim() ? this.searchVisibleCounts : this.visibleCounts;
      const batchSize = id === "vault" ? 50 : 5;
      const previousLimit = counts.get(id) ?? batchSize;
      const scrollTop = this.list?.scrollTop ?? 0;
      const hadFocus = more.ownerDocument.activeElement === more;
      counts.set(id, previousLimit + batchSize);
      this.renderProjects();
      if (hadFocus && more.hasClass("is-hidden")) {
        element.querySelectorAll<HTMLButtonElement>(".chatobby-navigator__session-open")[previousLimit]?.focus({ preventScroll: true });
      }
      if (this.list) this.list.scrollTop = scrollTop;
    });
    return element;
  }

  private createSession(id: string, group: string): HTMLElement {
    const row = createDiv({ cls: "chatobby-navigator__session" });
    const button = row.createEl("button", { cls: "chatobby-navigator__session-open", attr: { type: "button" } });
    button.createSpan({ cls: "chatobby-navigator__session-name" });
    button.createSpan({ cls: "chatobby-navigator__activity", attr: { role: "status" } });
    button.addEventListener("click", () => {
      this.completed.delete(id); this.renderProjects();
      this.perform(async () => { await this.plugin.openSessionById(id); });
    });
    const menu = (event: MouseEvent) => {
      event.preventDefault();
      const session = this.model()?.navigatorSessions?.find((candidate) => candidate.sessionId === id);
      if (session) this.projects.showSessionMenu(event, session);
    };
    row.addEventListener("contextmenu", menu);
    this.iconButton(row, "more-horizontal", "Chat actions", menu);
    this.dragOrder(row, "session", id, group);
    return row;
  }

  private projectMenu(event: MouseEvent, projectId: string): void {
    const project = this.model()?.projects.find((entry) => entry.projectId === projectId);
    if (!project) return;
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Edit Project").setIcon("pencil").onClick(() => this.perform(() => this.projects.openEditor(projectId))));
    menu.addItem((item) => item.setTitle("Browse chats and search messages").setIcon("search").onClick(() => this.perform(() => this.plugin.openWorkspacePage({ mode: "projects", projectId }))));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Archive Project").setIcon("archive").onClick(() => this.perform(async () => {
      if (!await confirmAction(this.app, { title: "Archive Project?", message: "Its folders and conversations are preserved. You can restore it from Projects.", confirmLabel: "Archive" })) return;
      const snapshot = this.connection.store.snapshot;
      if (!snapshot) return;
      const outcome = await this.connection.protocol.dispatch({ schemaVersion: 1, intentId: crypto.randomUUID(), viewId: snapshot.viewId, type: "projects.archive", payload: { projectId, expectedProjectRevision: project.revision } });
      if (outcome.status !== "applied") throw new Error(outcome.notice?.message ?? "Could not archive this Project.");
    })));
    menu.showAtMouseEvent(event);
  }

  private dragOrder(element: HTMLElement, kind: "project" | "session", id: string, group: string): void {
    element.draggable = true;
    element.addEventListener("dragstart", (event) => {
      this.dragged = { kind, id, group };
      event.dataTransfer?.setData("text/plain", id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    element.addEventListener("dragover", (event) => {
      if (this.dragged?.kind !== kind || this.dragged.group !== group) return;
      event.preventDefault(); element.addClass("is-drop-target");
    });
    element.addEventListener("dragleave", () => element.removeClass("is-drop-target"));
    element.addEventListener("dragend", () => { this.dragged = null; element.removeClass("is-drop-target"); });
    element.addEventListener("drop", (event) => {
      element.removeClass("is-drop-target");
      const dragged = this.dragged;
      if (!dragged || dragged.kind !== kind || dragged.group !== group) return;
      event.preventDefault(); event.stopPropagation();
      const ids = kind === "project" ? (this.model()?.projects.map((project) => project.projectId) ?? []) : (this.model()?.navigatorSessions?.filter((session) => group === "vault" ? session.workspace.kind === "vault" : session.workspace.kind === "project" && session.workspace.projectId === group).map((session) => session.sessionId) ?? []);
      const existing = kind === "project" ? this.state.projectOrder : this.state.sessionOrder[group] ?? [];
      const order = moveBefore(orderItems(ids, existing, (value) => value), dragged.id, id);
      if (kind === "project") this.state.projectOrder = order;
      else this.state.sessionOrder[group] = order;
      this.dragged = null; this.save(); this.renderProjects();
    });
  }

  private async newChat(projectId?: string): Promise<void> {
    const view = await this.plugin.openBlankView("");
    if (projectId) await view.createSessionForProject(projectId);
  }
  private save(): void { this.app.workspace.requestSaveLayout(); }
  private perform(action: () => Promise<void>): void { void action().catch((error: unknown) => this.showError(error)); }
  private showError(error: unknown): void {
    const message = error instanceof Error ? error.message : "Could not load the workspace.";
    if (this.status) { this.status.removeClass("is-hidden"); this.status.setText(message); }
    else new Notice(message);
  }
  private iconButton(parent: HTMLElement, icon: string, label: string, action: (event: MouseEvent) => void): void {
    const button = parent.createEl("button", { cls: "clickable-icon chatobby-navigator__action", attr: { type: "button", "aria-label": label, title: label } });
    setIcon(button, icon); button.addEventListener("click", action);
  }
}
