import { Menu, Modal, setIcon, type App } from "obsidian";
import type {
  FrontendProjectDetailViewModel,
  FrontendProjectMessageSearchHitViewModel,
  FrontendProjectRootViewModel,
  FrontendProjectScreenViewModel,
  FrontendProjectSessionViewModel,
  FrontendProjectSummaryViewModel,
} from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { confirmAction, pickItem, promptText } from "../../../ui/modals/modals";
import {
  openSystemPathExternally,
  revealSystemPathExternally,
} from "../../../ui/controller/system-path-opener";
import type { SessionAdvancedAction } from "../../../ui/session/session-maintenance";
import type {
  ProjectCreationDraftSnapshot,
  ProjectDraftMarkerPolicy,
} from "../application/project-creation-draft";
import { chooseSystemDirectories } from "../infrastructure/system-directory-picker";
import {
  createPageIconButton,
  createPageSection,
  createPageState,
  PageShell,
} from "../../../ui/shared/page-shell";

export type ProjectsViewIntent =
  | { readonly type: "projects.set-view"; readonly payload: {
      readonly query: string;
      readonly lifecycleFilter: "active" | "archived" | "all";
      readonly availabilityFilter: "all" | "available" | "attention" | "missing" | "conflict" | "relink-required";
      readonly sort: FrontendProjectScreenViewModel["sort"];
      readonly sessionQuery: string;
      readonly sessionSearchMode: FrontendProjectScreenViewModel["sessionSearchMode"];
      readonly sessionSort: FrontendProjectScreenViewModel["sessionSort"];
      readonly sessionSearchPage: number;
      readonly selectedProjectId?: string;
    } }
  | { readonly type: "projects.create"; readonly payload: {
      readonly name: string;
      readonly description?: string;
      readonly rootMode?: "create-vault-folder" | "use-existing-folders";
      readonly roots?: readonly {
        readonly directoryCandidateRef: string;
        readonly label: string;
        readonly markerPolicy: "required" | "optional" | "disabled";
        readonly directoryReuse: "canonical" | "none";
      }[];
      readonly primaryDirectoryCandidateRef?: string;
      readonly vaultRelativePath?: string;
      readonly systemAbsolutePath?: string;
      readonly directoryReuse: "canonical" | "none";
      readonly markerPolicy: "required" | "optional" | "disabled";
      readonly useForCurrentSession?: boolean;
    } }
  | { readonly type: "projects.replace-details"; readonly payload: {
      readonly projectId: string;
      readonly expectedProjectRevision: number;
      readonly name: string;
      readonly description?: string;
    } }
  | { readonly type: "projects.archive" | "projects.restore"; readonly payload: {
      readonly projectId: string;
      readonly expectedProjectRevision: number;
    } }
  | { readonly type: "projects.root-add"; readonly payload: {
      readonly projectId: string;
      readonly expectedProjectRevision: number;
      readonly label: string;
      readonly vaultRelativePath?: string;
      readonly systemAbsolutePath?: string;
      readonly directoryReuse: "none";
      readonly markerPolicy: "required" | "optional" | "disabled";
    } }
  | { readonly type: "projects.roots-add-batch"; readonly payload: {
      readonly projectId: string;
      readonly expectedProjectRevision: number;
      readonly roots: readonly {
        readonly systemAbsolutePath: string;
        readonly markerPolicy: "required" | "optional" | "disabled";
        readonly directoryReuse: "canonical" | "none";
      }[];
    } }
  | { readonly type: "projects.root-relabel"; readonly payload: {
      readonly projectId: string;
      readonly expectedProjectRevision: number;
      readonly rootId: string;
      readonly label: string;
    } }
  | { readonly type: "projects.root-set-primary" | "projects.root-remove"; readonly payload: {
      readonly projectId: string;
      readonly expectedProjectRevision: number;
      readonly rootId: string;
      readonly replacementRootId?: string;
    } }
  | { readonly type: "projects.root-recover"; readonly payload: {
      readonly projectId: string;
      readonly rootId: string;
    } }
  | { readonly type: "projects.root-relink"; readonly payload: {
      readonly projectId: string;
      readonly expectedProjectRevision: number;
      readonly rootId: string;
      readonly vaultRelativePath?: string;
      readonly systemAbsolutePath?: string;
    } }
  | { readonly type: "projects.session-move"; readonly payload: {
      readonly sessionId: string;
      readonly expectedWorkspaceBindingRevision: number;
      readonly target: { readonly kind: "vault" } | { readonly kind: "project"; readonly projectId: string };
    } }
  | { readonly type: "session.create"; readonly payload: {
      readonly workspace:
        | { readonly kind: "vault" }
        | { readonly kind: "project"; readonly projectId: string };
    } }
  | { readonly type: "session.change-workspace"; readonly payload: {
      readonly target: {
        readonly kind: "project";
        readonly projectId: string;
        readonly activeRootId: string;
        readonly sessionAttachedRootIds: readonly string[];
      };
    } }
  | { readonly type: "session.resume-by-id"; readonly payload: { readonly sessionId: string } };

interface ProjectsViewProps {
  app: App;
  getModel(): FrontendProjectScreenViewModel | null;
  subscribe(listener: (model: FrontendProjectScreenViewModel | null) => void): () => void;
  onBack(): void;
  onRefresh(): Promise<void>;
  onIntent(intent: ProjectsViewIntent): Promise<void>;
  getCreationDraft(): ProjectCreationDraftSnapshot;
  resetCreationDraft(): void;
  updateCreationDraft(patch: { readonly name?: string; readonly description?: string }): void;
  setCreationMarkerPolicy(markerPolicy: ProjectDraftMarkerPolicy): void;
  addCreationFolders(paths: readonly string[]): Promise<void>;
  removeCreationFolder(directoryCandidateRef: string): void;
  makeCreationFolderPrimary(directoryCandidateRef: string): void;
  submitCreationDraft(): Promise<boolean>;
  onDeleteSession(sessionId: string): Promise<void>;
  onSessionAction(sessionId: string, action: SessionAdvancedAction): Promise<void>;
  onMessageHit(hit: FrontendProjectMessageSearchHitViewModel): Promise<void>;
}

type EditorMode = "create" | "details" | null;
const SEARCH_DEBOUNCE_MS = 250;

type SessionWorkspace = FrontendProjectSessionViewModel["workspace"];

type SessionMoveDestination =
  | { readonly kind: "vault"; readonly name: "Vault"; readonly current: boolean; readonly available: true }
  | {
      readonly kind: "project";
      readonly projectId: string;
      readonly name: string;
      readonly current: boolean;
      readonly available: boolean;
      readonly availabilityLabel: string;
    };

class MoveSessionModal extends Modal {
  private settled = false;
  private query = "";

  constructor(
    app: App,
    private readonly sessionName: string,
    private readonly destinations: readonly SessionMoveDestination[],
    private readonly resolve: (destination: SessionMoveDestination | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("Move chat");
    this.contentEl.createDiv({
      cls: "chatobby-projects__move-intro",
      text: `Choose where “${this.sessionName}” belongs. Its messages stay unchanged.`,
    });
    const search = this.contentEl.createEl("input", {
      cls: "chatobby-projects__move-search",
      attr: { type: "search", placeholder: "Search Projects", "aria-label": "Search Projects" },
    });
    const results = this.contentEl.createDiv({ cls: "chatobby-projects__move-results" });
    const render = () => {
      results.empty();
      const vault = this.destinations.find((destination) => destination.kind === "vault");
      if (vault) this.renderDestination(results, vault, true);
      results.createDiv({ cls: "chatobby-projects__move-heading", text: "Projects" });
      const normalized = this.query.trim().toLocaleLowerCase();
      const projects = this.destinations.filter(
        (destination) =>
          destination.kind === "project" &&
          (normalized.length === 0 || destination.name.toLocaleLowerCase().includes(normalized)),
      );
      if (projects.length === 0) {
        results.createDiv({ cls: "chatobby-projects__move-empty", text: "No matching Projects." });
      } else {
        for (const destination of projects) this.renderDestination(results, destination, false);
      }
    };
    search.addEventListener("input", () => {
      this.query = search.value;
      render();
    });
    render();
    window.requestAnimationFrame(() => search.focus());
  }

  onClose(): void {
    super.onClose();
    this.settle(null);
  }

  private renderDestination(parent: HTMLElement, destination: SessionMoveDestination, sticky: boolean): void {
    const button = parent.createEl("button", {
      cls: `chatobby-projects__move-destination${sticky ? " is-sticky" : ""}`,
      attr: {
        type: "button",
        ...(destination.current || !destination.available ? { disabled: "true" } : {}),
      },
    });
    const icon = button.createSpan({ cls: "chatobby-projects__move-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, destination.kind === "vault" ? "vault" : "folder-kanban");
    const copy = button.createDiv({ cls: "chatobby-projects__move-copy" });
    copy.createDiv({ cls: "chatobby-projects__move-name", text: destination.name });
    copy.createDiv({
      cls: "chatobby-projects__move-description",
      text: destination.current
        ? "Current location"
        : destination.kind === "vault"
          ? "Keep this chat outside Projects"
          : destination.available
            ? "Move this chat into this Project"
            : destination.availabilityLabel,
    });
    if (!destination.current && destination.available) {
      button.addEventListener("click", () => {
        this.settle(destination);
        this.close();
      });
    }
  }

  private settle(destination: SessionMoveDestination | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(destination);
  }
}

/** Project library and project-scoped chat browser. Browsing never changes the active chat. */
export class ProjectsView extends ChatobbyComponent {
  private shell: PageShell | null = null;
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;
  private busyAction: string | null = null;
  private editor: EditorMode = null;
  private projectSearchTimer: number | null = null;
  private sessionSearchTimer: number | null = null;
  private viewUpdateTail = Promise.resolve();
  private readonly pendingSessionMoves = new Map<string, {
    readonly source: SessionWorkspace;
    readonly target: SessionWorkspace;
  }>();

  constructor(private readonly props: ProjectsViewProps) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-page chatobby-projects";
  }

  protected onRender(container: HTMLElement): void {
    container.tabIndex = -1;
    this.shell = new PageShell(container, {
      title: "Projects",
      subtitle: "Keep related folders and chats together.",
			width: "full",
			bodyClass: "chatobby-projects__body",
    });
    createPageIconButton(this.shell.actions, "refresh-cw", "Refresh Projects")
      .addEventListener("click", () => void this.refresh());
    createPageIconButton(this.shell.actions, "x", "Close Projects")
      .addEventListener("click", () => this.props.onBack());
    this.unsubscribe = this.props.subscribe((model) => this.renderState(model));
    this.renderState(this.props.getModel());
  }

  override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.projectSearchTimer !== null) window.clearTimeout(this.projectSearchTimer);
    if (this.sessionSearchTimer !== null) window.clearTimeout(this.sessionSearchTimer);
    super.destroy();
  }

  focusContainer(): void {
    this.container?.focus();
  }

  setLocalError(error: string | null): void {
    this.localError = error;
    this.renderState(this.props.getModel());
  }

  async selectProject(projectId: string): Promise<void> {
    await this.changeView({ selectedProjectId: projectId });
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key !== "Escape" && event.key !== "BrowserBack") return false;
    if (this.editor) {
      if (this.editor === "create") this.props.resetCreationDraft();
      this.editor = null;
      this.renderState(this.props.getModel());
      event.preventDefault();
      return true;
    }
    return false;
  }

  private startCreating(model: FrontendProjectScreenViewModel): void {
    this.props.resetCreationDraft();
    this.editor = "create";
    this.renderState(model);
  }

  private renderState(model: FrontendProjectScreenViewModel | null): void {
    const shell = this.shell;
    if (!shell) return;
    shell.setBusy(this.busyAction !== null || model?.loading === true);
    const error = this.localError ?? model?.error;
    shell.setStatus(error
      ? { tone: "error", message: error, actionLabel: "Try again", onAction: () => void this.refresh() }
      : model?.statusMessage
        ? { tone: "success", message: model.statusMessage }
        : null);
    shell.setTabs([]);
    if (!model) {
      shell.updateBody("projects:loading", (body) => createPageState(body, {
        kind: error ? "error" : "loading",
        title: error ? "Projects are unavailable" : "Loading Projects",
        description: error ? "Reconnect Chatobby and try again." : "Reading your Projects and chats.",
      }));
      return;
    }
    this.reconcilePendingSessionMoves(model);
    shell.setTitle("Projects", "Keep related folders and chats together.");
		shell.updateBody(
			this.editor
				? `projects:${model.selectedProjectId ?? "none"}:${this.editor}`
				: `projects:${model.selectedProjectId ?? "none"}:view:${model.revision}`,
      (body) => this.renderWorkspace(body, model),
    );
  }

  private renderWorkspace(body: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const layout = body.createDiv({ cls: "chatobby-projects__workspace" });
    this.renderRail(layout.createEl("aside", { cls: "chatobby-projects__rail" }), model);
    const detail = layout.createEl("main", { cls: "chatobby-projects__detail" });
    if (this.editor === "create") {
      this.renderCreateForm(detail);
      return;
    }
    if (!model.detail && !model.selectedProjectId) {
      this.renderVaultDetail(detail, model);
      return;
    }
    if (!model.detail) {
      createPageState(detail, {
        kind: "empty",
        title: "Project unavailable",
        description: "This Project is no longer in the current view. Choose another Project or refresh.",
        actionLabel: "Create Project",
        onAction: () => this.startCreating(model),
      });
      return;
    }
    if (this.editor === "details") this.renderDetailsForm(detail, model.detail);
    else this.renderDetail(detail, model, model.detail);
  }

  private renderRail(parent: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const top = parent.createDiv({ cls: "chatobby-projects__rail-top" });
    top.createEl("strong", { text: "Chats and Projects" });
    const create = top.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": "Create Project" },
    });
		create.disabled = this.editor === "create";
    setIcon(create, "plus");
    create.addEventListener("click", () => this.startCreating(model));
    const search = parent.createEl("input", {
      cls: "chatobby-projects__search",
      attr: { type: "search", placeholder: "Search Projects", "aria-label": "Search Projects", enterkeyhint: "search" },
    });
    search.dataset.pageStateKey = "projects-search";
    search.value = model.query;
    this.bindSearchInput(search, "project");
    const filters = parent.createDiv({ cls: "chatobby-projects__rail-filters" });
    choiceSelect(filters, model.lifecycleOptions, model.lifecycleFilter, "Project status", (value) => {
      void this.changeView({ lifecycleFilter: value as FrontendProjectScreenViewModel["lifecycleFilter"] });
    });
    choiceSelect(filters, model.availabilityOptions, model.availabilityFilter, "Folder availability", (value) => {
      void this.changeView({ availabilityFilter: value as FrontendProjectScreenViewModel["availabilityFilter"] });
    });
    choiceSelect(filters, model.sortOptions, model.sort, "Project sorting", (value) => {
      void this.changeView({ sort: value as FrontendProjectScreenViewModel["sort"] });
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
    button.addEventListener("click", () => void this.changeView({ selectedProjectId: undefined }));
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
    button.addEventListener("click", () => void this.changeView({ selectedProjectId: project.projectId }));
  }

  private renderDetail(parent: HTMLElement, model: FrontendProjectScreenViewModel, detail: FrontendProjectDetailViewModel): void {
    const header = parent.createEl("header", { cls: "chatobby-projects__detail-header" });
    const title = header.createDiv({ cls: "chatobby-projects__detail-title" });
    title.createEl("h2", { text: detail.name });
    if (detail.description) title.createEl("p", { text: detail.description });
    const actions = header.createDiv({ cls: "chatobby-projects__detail-actions" });
    if (detail.lifecycle === "active") {
      const newChat = actions.createEl("button", { cls: "mod-cta", text: "New chat in Project", attr: { type: "button" } });
      newChat.disabled = this.busyAction !== null;
      newChat.addEventListener("click", () => void this.run("new-chat", {
        type: "session.create",
        payload: { workspace: { kind: "project", projectId: detail.projectId } },
      }));
    }
    const more = actions.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": `More actions for ${detail.name}` },
    });
    setIcon(more, "more-horizontal");
    more.addEventListener("click", (event) => this.openProjectMenu(event, detail));

    const folders = createPageSection(parent, {
      title: "Folders",
      description: detail.roots.length === 0
        ? "This Project currently uses the vault root. Add folders when you need a narrower workspace."
        : "Folders available to chats in this Project. Permissions still decide what agents may access.",
      className: "chatobby-projects__folders",
    });
    if (detail.roots.length === 0) {
      createPageState(folders.content, {
        kind: "empty",
        title: "No folders attached",
        description: "New chats still belong to this Project and run from the vault root.",
      });
    } else {
      const list = folders.content.createDiv({ cls: "chatobby-projects__folder-list" });
      for (const root of detail.roots) this.renderRoot(list, detail, root);
    }
    const addFolders = folders.content.createEl("button", {
      cls: "chatobby-projects__add-folders",
      text: "Add folders",
      attr: { type: "button" },
    });
    addFolders.disabled = detail.lifecycle !== "active" || this.busyAction !== null;
    addFolders.addEventListener("click", () => void this.addFolders(detail));

    this.renderChatSection(parent, detail.sessions, {
		model,
		totalCount: detail.sessionCount,
      workspace: { kind: "project", projectId: detail.projectId },
      emptyTitle: "Start the first chat",
      emptyDescription: "The new chat will keep this Project identity even if it has no folders yet.",
      actionLabel: detail.lifecycle === "active" ? "New chat in Project" : undefined,
      onAction: detail.lifecycle === "active" ? () => void this.run("new-chat", {
        type: "session.create",
        payload: { workspace: { kind: "project", projectId: detail.projectId } },
      }) : undefined,
    });

    if (model.runningIn.projectId === detail.projectId) {
      parent.createDiv({ cls: "chatobby-projects__current-note", text: "The current chat belongs to this Project." });
    }
  }

  private renderVaultDetail(parent: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const header = parent.createEl("header", { cls: "chatobby-projects__detail-header" });
    const title = header.createDiv({ cls: "chatobby-projects__detail-title" });
    title.createEl("h2", { text: "Vault" });
    title.createEl("p", { text: "Chats that are not assigned to a Project." });
    const actions = header.createDiv({ cls: "chatobby-projects__detail-actions" });
    const newChat = actions.createEl("button", { cls: "mod-cta", text: "New chat", attr: { type: "button" } });
    newChat.disabled = this.busyAction !== null;
    newChat.addEventListener("click", () => void this.run("new-vault-chat", {
      type: "session.create",
      payload: { workspace: { kind: "vault" } },
    }));
    this.renderChatSection(parent, model.vaultSessions, {
		model,
		totalCount: model.vaultSessionCount,
      workspace: { kind: "vault" },
      emptyTitle: "No Vault chats yet",
      emptyDescription: "Start a chat that works from the vault root without assigning it to a Project.",
      actionLabel: "New chat",
      onAction: () => void this.run("new-vault-chat", {
        type: "session.create",
        payload: { workspace: { kind: "vault" } },
      }),
    });
    if (model.runningIn.kind === "vault") {
      parent.createDiv({ cls: "chatobby-projects__current-note", text: "The current chat belongs to the Vault." });
    }
  }

  private renderChatSection(
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
    const visibleSessions = sessions.filter((session) => !this.isPendingMoveSource(session.sessionId, empty.workspace));
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
		onAction: empty.model.sessionQuery ? () => void this.changeView({ sessionQuery: "" }) : empty.onAction,
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
        onAction: () => void this.changeView({ sessionQuery: "", sessionSearchPage: 0 }),
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
    previous.addEventListener("click", () => void this.changeView({ sessionSearchPage: Math.max(0, page.page - 1) }));
    pagination.createSpan({ text: `Page ${page.page + 1} of ${Math.max(1, Math.ceil(page.totalCount / page.pageSize))}` });
    const next = pagination.createEl("button", { text: "Next", attr: { type: "button" } });
    next.disabled = !page.hasNext;
    next.addEventListener("click", () => void this.changeView({ sessionSearchPage: page.page + 1 }));
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
    button.addEventListener("click", () => void this.props.onMessageHit(hit));
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
	this.bindSearchInput(search, "session");
	const messages = controls.createEl("button", {
		cls: `chatobby-projects__message-search${model.sessionSearchMode === "messages" ? " is-active" : ""}`,
		text: "Search messages",
		attr: {
			type: "button",
			"aria-label": "Search inside chat messages",
			"aria-pressed": String(model.sessionSearchMode === "messages"),
		},
	});
	messages.addEventListener("click", () => void this.changeView({
		sessionSearchMode: model.sessionSearchMode === "messages" ? "titles" : "messages",
		sessionSearchPage: 0,
	}));
	choiceSelect(controls, model.sessionSortOptions, model.sessionSort, "Chat sorting", (value) => {
		void this.changeView({ sessionSort: value as FrontendProjectScreenViewModel["sessionSort"] });
	});
  }

  private renderRoot(parent: HTMLElement, detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): void {
    const row = parent.createDiv({ cls: `chatobby-projects__folder is-${root.availability}` });
    const icon = row.createSpan({ cls: "chatobby-projects__folder-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, root.availability === "available" ? "folder" : "triangle-alert");
    const copy = row.createDiv({ cls: "chatobby-projects__folder-copy" });
    const heading = copy.createDiv({ cls: "chatobby-projects__folder-heading" });
    heading.createSpan({ text: root.label });
    if (root.primary) heading.createSpan({ cls: "chatobby-projects__badge", text: "Primary" });
    const visiblePath = root.localPath ?? root.vaultRelativePath;
    if (visiblePath) {
      copy.createDiv({
        cls: "chatobby-projects__folder-path",
        text: visiblePath,
        attr: { title: visiblePath },
      });
    }
    if (root.availability !== "available") {
      copy.createDiv({ cls: "chatobby-projects__folder-warning", text: root.availabilityLabel });
    }
    const rowActions = row.createDiv({ cls: "chatobby-projects__row-actions" });
    if (!root.primary) {
      const primary = rowActions.createEl("button", {
        cls: "clickable-icon",
        attr: { type: "button", "aria-label": `Make ${root.label} primary` },
      });
      setIcon(primary, "star");
      primary.addEventListener("click", () => void this.run(`primary:${root.rootId}`, {
        type: "projects.root-set-primary",
        payload: { projectId: detail.projectId, expectedProjectRevision: detail.revision, rootId: root.rootId },
      }));
    }
    const remove = rowActions.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": `Remove ${root.label} from Project` },
    });
    setIcon(remove, "x");
    remove.addEventListener("click", () => void this.removeRoot(detail, root));
    const more = rowActions.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": `Folder actions for ${root.label}` },
    });
    setIcon(more, "more-horizontal");
    more.addEventListener("click", (event) => this.openRootMenu(event, detail, root));
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
    open.addEventListener("click", () => void this.run("resume-chat", {
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

  private openProjectMenu(event: MouseEvent, detail: FrontendProjectDetailViewModel): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Edit name and description").setIcon("pencil").onClick(() => {
      this.editor = "details";
      this.renderState(this.props.getModel());
    }));
    menu.addSeparator();
    if (detail.lifecycle === "active") {
      menu.addItem((item) => item.setTitle("Archive Project").setIcon("archive").onClick(() => void this.changeLifecycle(detail, "archive")));
    } else {
      menu.addItem((item) => item.setTitle("Restore Project").setIcon("rotate-ccw").onClick(() => void this.changeLifecycle(detail, "restore")));
    }
    menu.showAtMouseEvent(event);
  }

  private openRootMenu(event: MouseEvent, detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): void {
    event.preventDefault();
    const menu = new Menu();
    const running = this.props.getModel()?.runningIn;
    if (
      root.availability === "available" &&
      running?.kind === "project" &&
      running.projectId === detail.projectId &&
      running.activeRootId !== root.rootId
    ) {
      menu.addItem((item) => item.setTitle("Run current chat here").setIcon("play").onClick(() => void this.run(
        `active-root:${root.rootId}`,
        {
          type: "session.change-workspace",
          payload: {
            target: {
              kind: "project",
              projectId: detail.projectId,
              activeRootId: root.rootId,
              sessionAttachedRootIds: detail.roots
                .filter((candidate) => candidate.rootId !== root.rootId && candidate.availability === "available")
                .map((candidate) => candidate.rootId),
            },
          },
        },
      )));
      menu.addSeparator();
    }
    const localPath = root.localPath;
    if (localPath) {
      menu.addItem((item) => item.setTitle("Open folder").setIcon("folder-open").onClick(() => {
        openSystemPathExternally(this.props.app, localPath);
      }));
      menu.addItem((item) => item.setTitle("Reveal in file explorer").setIcon("scan-search").onClick(() => {
        revealSystemPathExternally(this.props.app, localPath);
      }));
      menu.addItem((item) => item.setTitle("Copy path").setIcon("copy").onClick(() => {
        void navigator.clipboard.writeText(localPath);
      }));
      menu.addSeparator();
    }
    menu.addItem((item) => item.setTitle("Rename folder label").setIcon("pencil").onClick(() => void this.renameRoot(detail, root)));
    if (!root.primary) {
      menu.addItem((item) => item.setTitle("Make primary").setIcon("star").onClick(() => void this.run(`primary:${root.rootId}`, {
        type: "projects.root-set-primary",
        payload: { projectId: detail.projectId, expectedProjectRevision: detail.revision, rootId: root.rootId },
      })));
    }
    if (root.recoveryAction === "relink") {
      menu.addItem((item) => item.setTitle("Choose folder again").setIcon("folder-sync").onClick(() => void this.relinkRoot(detail, root)));
    } else if (root.recoveryAction) {
      menu.addItem((item) => item.setTitle("Repair folder connection").setIcon("wrench").onClick(() => void this.run(`recover:${root.rootId}`, {
        type: "projects.root-recover",
        payload: { projectId: detail.projectId, rootId: root.rootId },
      })));
    }
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Remove from Project").setIcon("trash-2").onClick(() => void this.removeRoot(detail, root)));
    menu.showAtMouseEvent(event);
  }

  private openSessionMenu(event: MouseEvent, session: FrontendProjectSessionViewModel): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Resume").setIcon("message-square").onClick(() => void this.run("resume-chat", {
      type: "session.resume-by-id",
      payload: { sessionId: session.sessionId },
    })));
	menu.addItem((item) => item.setTitle("Move chat…").setIcon("folder-input").onClick(() => void this.moveSession(session)));
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

  private async moveSession(session: FrontendProjectSessionViewModel): Promise<void> {
    const model = this.props.getModel();
    if (!model) return;
    const sourceWorkspace: SessionWorkspace = session.workspace.kind === "vault"
      ? { kind: "vault" }
      : { kind: "project", projectId: session.workspace.projectId };
    const destinations: SessionMoveDestination[] = [
      {
        kind: "vault",
        name: "Vault",
        current: session.workspace.kind === "vault",
        available: true,
      },
      ...model.sessionMoveProjects.map((project) => ({
        kind: "project" as const,
        projectId: project.projectId,
        name: project.name,
        current: session.workspace.kind === "project" && session.workspace.projectId === project.projectId,
        available: project.available,
        availabilityLabel: project.availabilityLabel,
      })),
    ];
    const destination = await new Promise<SessionMoveDestination | null>((resolve) =>
      new MoveSessionModal(this.props.app, session.name, destinations, resolve).open(),
    );
    if (!destination) return;
    await this.runAction(`move-chat:${session.sessionId}`, async () => {
      await this.props.onIntent({
        type: "projects.session-move",
        payload: {
          sessionId: session.sessionId,
          expectedWorkspaceBindingRevision: session.workspaceBindingRevision,
          target:
            destination.kind === "vault"
              ? { kind: "vault" }
              : { kind: "project", projectId: destination.projectId },
        },
      });
      this.pendingSessionMoves.set(session.sessionId, {
        source: sourceWorkspace,
        target:
          destination.kind === "vault"
            ? { kind: "vault" }
            : { kind: "project", projectId: destination.projectId },
      });
      this.renderState(this.props.getModel());
      await this.props.onRefresh();
    });
  }

  private isPendingMoveSource(sessionId: string, workspace: SessionWorkspace): boolean {
    const pending = this.pendingSessionMoves.get(sessionId);
    return pending !== undefined && sameSessionWorkspace(workspace, pending.source);
  }

  private reconcilePendingSessionMoves(model: FrontendProjectScreenViewModel): void {
    for (const [sessionId, pending] of this.pendingSessionMoves) {
      const confirmed = pending.target.kind === "vault"
        ? model.vaultSessions.some((session) => session.sessionId === sessionId)
        : model.detail?.projectId === pending.target.projectId &&
          model.detail.sessions.some((session) => session.sessionId === sessionId);
      if (confirmed) this.pendingSessionMoves.delete(sessionId);
    }
  }

  private addSessionMenuItem(menu: Menu, session: FrontendProjectSessionViewModel, action: SessionAdvancedAction, title: string, icon: string): void {
    menu.addItem((item) => item.setTitle(title).setIcon(icon).onClick(() => void this.runAction(`session:${action}`, async () => {
      await this.props.onSessionAction(session.sessionId, action);
      await this.props.onRefresh();
    })));
  }

  private async addFolders(detail: FrontendProjectDetailViewModel): Promise<void> {
    const folders = await chooseSystemDirectories("Add folders to Project", true);
    if (folders.length === 0 || !await confirmDirectoryMarkers(this.props.app, folders.length)) return;
    await this.runAction("add-folders", async () => {
      const current = this.props.getModel()?.detail;
      if (!current || current.projectId !== detail.projectId) throw new Error("The Project changed while adding folders.");
      await this.props.onIntent({
        type: "projects.roots-add-batch",
        payload: {
          projectId: current.projectId,
          expectedProjectRevision: current.revision,
          roots: folders.map((folder) => ({
            systemAbsolutePath: folder,
            directoryReuse: "none" as const,
            markerPolicy: "required" as const,
          })),
        },
      });
      await this.props.onRefresh();
    });
  }

  private async renameRoot(detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): Promise<void> {
    const label = await promptText(this.props.app, { title: "Rename folder label", value: root.label, submitLabel: "Rename" });
    if (!label?.trim()) return;
    await this.run(`rename-root:${root.rootId}`, {
      type: "projects.root-relabel",
      payload: { projectId: detail.projectId, expectedProjectRevision: detail.revision, rootId: root.rootId, label: label.trim() },
    });
  }

  private async relinkRoot(detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): Promise<void> {
    const [folder] = await chooseSystemDirectories(`Choose ${root.label}`, false);
    if (!folder) return;
    if (!await confirmDirectoryMarkers(this.props.app, 1)) return;
    await this.run(`relink:${root.rootId}`, {
      type: "projects.root-relink",
      payload: {
        projectId: detail.projectId,
        expectedProjectRevision: detail.revision,
        rootId: root.rootId,
        systemAbsolutePath: folder,
      },
    });
  }

  private async removeRoot(detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): Promise<void> {
    if (!await confirmAction(this.props.app, {
      title: "Remove folder from Project?",
      message: `Remove “${root.label}” from this Project? The folder and its files will not be deleted.`,
      confirmLabel: "Remove",
      destructive: true,
    })) return;
    let replacementRootId: string | undefined;
    if (root.primary && detail.roots.length > 1) {
      const replacement = await pickItem(
        this.props.app,
        detail.roots.filter((candidate) => candidate.rootId !== root.rootId),
        (candidate) => candidate.label,
        "Choose the new primary folder",
      );
      if (!replacement) return;
      replacementRootId = replacement.rootId;
    }
    await this.run(`remove-root:${root.rootId}`, {
      type: "projects.root-remove",
      payload: {
        projectId: detail.projectId,
        expectedProjectRevision: detail.revision,
        rootId: root.rootId,
        ...(replacementRootId ? { replacementRootId } : {}),
      },
    });
  }

  private async deleteSession(session: FrontendProjectSessionViewModel): Promise<void> {
    if (!await confirmAction(this.props.app, {
      title: "Delete chat?",
      message: `Delete “${session.name}”? This removes its stored conversation and subagent run data.`,
      confirmLabel: "Delete",
      destructive: true,
    })) return;
    await this.runAction("delete-chat", async () => {
      await this.props.onDeleteSession(session.sessionId);
      await this.props.onRefresh();
    });
  }

  private async changeLifecycle(detail: FrontendProjectDetailViewModel, action: "archive" | "restore"): Promise<void> {
    if (action === "archive" && !await confirmAction(this.props.app, {
      title: "Archive Project?",
      message: "Its folders and chats are preserved and can be restored later.",
      confirmLabel: "Archive",
    })) return;
    await this.run(action, {
      type: action === "archive" ? "projects.archive" : "projects.restore",
      payload: { projectId: detail.projectId, expectedProjectRevision: detail.revision },
    });
  }

  private renderCreateForm(parent: HTMLElement): void {
    const draft = this.props.getCreationDraft();
    const section = createPageSection(parent, {
      title: "Create Project",
      description: "Keep one or more existing folders together, or let Chatobby create a new folder in this vault.",
    });
    const form = section.content.createEl("form", { cls: "chatobby-projects__form" });
    const name = textField(form, "Project name", "Project name", true, draft.name);
    name.addEventListener("input", () => this.props.updateCreationDraft({ name: name.value }));
    const description = textAreaField(form, "Description", "What are you working on?", draft.description);
    description.addEventListener("input", () => this.props.updateCreationDraft({ description: description.value }));

    const folders = form.createDiv({ cls: "chatobby-projects__draft-folders" });
    const folderHeading = folders.createDiv({ cls: "chatobby-projects__draft-heading" });
    folderHeading.createEl("strong", { text: "Project folders" });
    folderHeading.createSpan({
      text: draft.roots.length === 0
        ? "None selected"
        : `${draft.roots.length} ${plural(draft.roots.length, "folder")} selected`,
    });
    if (draft.roots.length === 0) {
      folders.createDiv({
        cls: "chatobby-projects__draft-empty",
        text: "No existing folder is selected. Chatobby will create a folder named after this Project in the vault root.",
      });
    } else {
      const rootList = folders.createDiv({ cls: "chatobby-projects__draft-root-list" });
      for (const root of draft.roots) {
        const row = rootList.createDiv({ cls: "chatobby-projects__draft-root" });
        const copy = row.createDiv({ cls: "chatobby-projects__draft-root-copy" });
        const title = copy.createDiv({ cls: "chatobby-projects__draft-root-title" });
        title.createSpan({ text: root.label });
        if (root.directoryCandidateRef === draft.primaryDirectoryCandidateRef) {
          title.createSpan({ cls: "chatobby-projects__badge", text: "Primary" });
        }
        copy.createDiv({
          cls: "chatobby-projects__folder-path",
          text: root.localPath,
          attr: { title: root.localPath },
        });
        const actions = row.createDiv({ cls: "chatobby-projects__row-actions" });
        if (root.directoryCandidateRef !== draft.primaryDirectoryCandidateRef) {
          const primary = actions.createEl("button", {
            cls: "clickable-icon",
            attr: { type: "button", "aria-label": `Make ${root.label} primary` },
          });
          setIcon(primary, "star");
          primary.addEventListener("click", () => {
            this.props.makeCreationFolderPrimary(root.directoryCandidateRef);
            this.renderState(this.props.getModel());
          });
        }
        const remove = actions.createEl("button", {
          cls: "clickable-icon",
          attr: { type: "button", "aria-label": `Remove ${root.label} from new Project` },
        });
        setIcon(remove, "x");
        remove.addEventListener("click", () => {
          this.props.removeCreationFolder(root.directoryCandidateRef);
          this.renderState(this.props.getModel());
        });
      }
    }
    const choose = folders.createEl("button", {
      text: draft.roots.length === 0 ? "Choose folders" : "Add more folders",
      attr: { type: "button" },
    });
    choose.addEventListener("click", () => void this.runAction("choose-project-folders", async () => {
      const paths = await chooseSystemDirectories("Choose Project folders", true);
      if (paths.length === 0) return;
      await this.props.addCreationFolders(paths);
    }));

    if (draft.roots.length > 0) {
      const marker = form.createEl("label", { cls: "chatobby-projects__marker-choice" });
      const input = marker.createEl("input", { attr: { type: "checkbox" } });
      input.checked = draft.markerPolicy === "required";
      marker.createSpan({
        text: "Place a Chatobby identity marker in these folders (recommended)",
      });
      marker.createDiv({
        cls: "chatobby-projects__field-help",
        text: "Markers help Chatobby recognize a folder after it is renamed or moved on this device. Turn this off to use device-only bindings.",
      });
      input.addEventListener("change", () => {
        this.props.setCreationMarkerPolicy(input.checked ? "required" : "disabled");
      });
    }

    const summary = form.createDiv({ cls: "chatobby-projects__draft-summary" });
    summary.createEl("strong", { text: "Ready to create" });
    summary.createDiv({
      text: draft.roots.length === 0
        ? "A new vault folder will become this Project’s primary folder."
        : `${draft.roots.find((root) => root.directoryCandidateRef === draft.primaryDirectoryCandidateRef)?.label ?? "The first folder"} will be primary; ${Math.max(0, draft.roots.length - 1)} ${plural(Math.max(0, draft.roots.length - 1), "folder")} will be attached.`,
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let created = false;
      void this.runAction("create-project", async () => {
        created = await this.props.submitCreationDraft();
      }).then((applied) => {
        if (!applied || !created) return;
        this.props.resetCreationDraft();
        this.editor = null;
        this.renderState(this.props.getModel());
      });
    });
    const actions = form.createDiv({ cls: "chatobby-projects__form-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => {
      this.props.resetCreationDraft();
      this.editor = null;
      this.renderState(this.props.getModel());
    });
    actions.createEl("button", { cls: "mod-cta", text: "Create Project", attr: { type: "submit" } });
    window.requestAnimationFrame(() => name.focus());
  }

  private renderDetailsForm(parent: HTMLElement, detail: FrontendProjectDetailViewModel): void {
    const section = createPageSection(parent, { title: "Edit Project", description: "Change how this Project appears in Chatobby." });
    const form = section.content.createEl("form", { cls: "chatobby-projects__form" });
    const name = textField(form, "Project name", "Project name", true, detail.name);
    const description = textAreaField(form, "Description", "What are you working on?", detail.description ?? "");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.run("edit-project", {
        type: "projects.replace-details",
        payload: {
          projectId: detail.projectId,
          expectedProjectRevision: detail.revision,
          name: name.value,
          description: description.value.trim() || undefined,
        },
		}).then((applied) => {
			if (!applied) return;
			this.editor = null;
			this.renderState(this.props.getModel());
		});
    });
    const actions = form.createDiv({ cls: "chatobby-projects__form-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => { this.editor = null; this.renderState(this.props.getModel()); });
    actions.createEl("button", { cls: "mod-cta", text: "Save", attr: { type: "submit" } });
  }

  private bindSearchInput(input: HTMLInputElement, kind: "project" | "session"): void {
	const submit = (): void => {
		if (kind === "project") {
			if (this.projectSearchTimer !== null) window.clearTimeout(this.projectSearchTimer);
			this.projectSearchTimer = null;
			void this.changeView({ query: input.value });
			return;
		}
		if (this.sessionSearchTimer !== null) window.clearTimeout(this.sessionSearchTimer);
		this.sessionSearchTimer = null;
		void this.changeView({ sessionQuery: input.value, sessionSearchPage: 0 });
	};
	input.addEventListener("input", () => {
		if (kind === "project") {
			if (this.projectSearchTimer !== null) window.clearTimeout(this.projectSearchTimer);
			this.projectSearchTimer = window.setTimeout(submit, SEARCH_DEBOUNCE_MS);
			return;
		}
		if (this.sessionSearchTimer !== null) window.clearTimeout(this.sessionSearchTimer);
		this.sessionSearchTimer = window.setTimeout(submit, SEARCH_DEBOUNCE_MS);
	});
	input.addEventListener("keydown", (event) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		submit();
	});
  }

  private async refresh(): Promise<void> {
    await this.runAction("refresh", () => this.props.onRefresh());
  }

  private async run(action: string, intent: ProjectsViewIntent): Promise<boolean> {
    return this.runAction(action, () => this.props.onIntent(intent));
  }

  private async runAction(action: string, operation: () => Promise<void>): Promise<boolean> {
    if (this.busyAction) return false;
    this.busyAction = action;
    this.renderState(this.props.getModel());
    try {
      await operation();
      this.localError = null;
      return true;
    } catch (error) {
      this.localError = error instanceof Error ? error.message : String(error);
      return false;
    } finally {
      this.busyAction = null;
      this.renderState(this.props.getModel());
    }
  }

  private async changeView(patch: Partial<Pick<FrontendProjectScreenViewModel,
    | "query"
	| "lifecycleFilter"
	| "availabilityFilter"
	| "sort"
	| "sessionQuery"
	| "sessionSearchMode"
	| "sessionSort"
	| "sessionSearchPage"
	| "selectedProjectId">>): Promise<void> {
    const model = this.props.getModel();
    if (!model) return;
	const intent: ProjectsViewIntent = {
      type: "projects.set-view",
      payload: {
        query: patch.query ?? model.query,
        lifecycleFilter: patch.lifecycleFilter ?? model.lifecycleFilter,
        availabilityFilter: patch.availabilityFilter ?? model.availabilityFilter,
        sort: patch.sort ?? model.sort,
		sessionQuery: patch.sessionQuery ?? model.sessionQuery,
		sessionSearchMode: patch.sessionSearchMode ?? model.sessionSearchMode,
		sessionSort: patch.sessionSort ?? model.sessionSort,
		sessionSearchPage: patch.sessionSearchPage ?? model.sessionSearchPage,
        selectedProjectId: Object.hasOwn(patch, "selectedProjectId") ? patch.selectedProjectId : model.selectedProjectId,
      },
	};
	this.viewUpdateTail = this.viewUpdateTail
		.catch(() => undefined)
		.then(async () => {
			try {
				await this.props.onIntent(intent);
				this.localError = null;
			} catch (error) {
				this.localError = error instanceof Error ? error.message : String(error);
				this.renderState(this.props.getModel());
			}
		});
	await this.viewUpdateTail;
  }
}

function sameSessionWorkspace(left: SessionWorkspace, right: SessionWorkspace): boolean {
  return left.kind === right.kind && (
    left.kind === "vault" || (right.kind === "project" && left.projectId === right.projectId)
  );
}

function confirmDirectoryMarkers(app: App, count: number): Promise<boolean> {
  return confirmAction(app, {
    title: count === 1 ? "Add this folder?" : `Add ${count} folders?`,
    message:
      "Chatobby will keep the folders in place and may write a small .chatobby-root.json identity file inside each one. " +
      "This does not grant agents access; the active permission policy still applies.",
    confirmLabel: count === 1 ? "Add folder" : "Add folders",
  });
}

function choiceSelect(
  parent: HTMLElement,
  options: readonly { readonly value: string; readonly label: string }[],
  selected: string,
  label: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const select = parent.createEl("select", { cls: "chatobby-projects__select dropdown" });
  select.setAttr("aria-label", label);
  for (const option of options) {
    const element = select.createEl("option", { value: option.value, text: option.label });
    element.selected = option.value === selected;
  }
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function textField(parent: HTMLElement, label: string, placeholder: string, required: boolean, value = ""): HTMLInputElement {
  const field = parent.createEl("label", { cls: "chatobby-projects__field" });
  field.createSpan({ cls: "chatobby-projects__field-label", text: label });
  const input = field.createEl("input", { attr: { type: "text", placeholder, "aria-label": label } });
	input.dataset.pageStateKey = label;
  input.required = required;
  input.value = value;
  return input;
}

function textAreaField(parent: HTMLElement, label: string, placeholder: string, value: string): HTMLTextAreaElement {
  const field = parent.createEl("label", { cls: "chatobby-projects__field" });
  field.createSpan({ cls: "chatobby-projects__field-label", text: label });
  const input = field.createEl("textarea", { attr: { placeholder, "aria-label": label } });
	input.dataset.pageStateKey = label;
  input.value = value;
  return input;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
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

function formatRelativeDate(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Date unavailable";
  const elapsed = Math.max(0, Date.now() - time);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(time).toLocaleDateString();
}
