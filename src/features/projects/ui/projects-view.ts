import type { FrontendProjectScreenViewModel, FrontendProjectSessionViewModel } from "../../../vendor/chatobby-client/frontend-contracts.js";
import { ChatobbyComponent } from "../../../ui/shared/component";
import { createPageIconButton, createPageState, PageShell } from "../../../ui/shared/page-shell";
import type { ProjectsViewIntent } from "../application/project-actions";
import type { ProjectsViewProps, ProjectPresentationActions, ProjectViewPatch, SessionWorkspace } from "./project-view-types";
import { ProjectEditor } from "./editor/project-editor";
import { SessionLibrary } from "./library/session-library";
import { MoveSessionModal, type SessionMoveDestination } from "./library/move-session-modal";
import { ProjectDetail } from "./detail/project-detail";
export type { ProjectsViewIntent } from "../application/project-actions";

const SEARCH_DEBOUNCE_MS = 250;

/** Page composition and shared operation/search/move lifetime; browsing never rebinds the chat. */
export class ProjectsView extends ChatobbyComponent {
  private shell: PageShell | null = null;
  private unsubscribe: (() => void) | null = null;
  private localError: string | null = null;
  private busyAction: string | null = null;
  private readonly editor: ProjectEditor;
  private readonly library: SessionLibrary;
  private readonly detail: ProjectDetail;
  private projectSearchTimer: number | null = null;
  private sessionSearchTimer: number | null = null;
  private viewUpdateTail = Promise.resolve();
  private readonly pendingSessionMoves = new Map<string, {
    readonly source: SessionWorkspace;
    readonly target: SessionWorkspace;
  }>();

  constructor(private readonly props: ProjectsViewProps) {
    super();
    const actions: ProjectPresentationActions = {
      isBusy: () => this.busyAction !== null,
      run: (action, intent) => this.run(action, intent),
      runAction: (action, operation) => this.runAction(action, operation),
    };
    const context = { ...actions, app: props.app, getModel: () => this.props.getModel(), onRefresh: () => this.props.onRefresh() };
    this.library = new SessionLibrary({
      ...context,
      onMessageHit: (hit) => this.props.onMessageHit(hit),
      onSessionAction: (id, action) => this.props.onSessionAction(id, action),
      onDeleteSession: (id) => this.props.onDeleteSession(id),
      isCreating: () => this.editor.mode === "create",
      startCreating: (model) => this.startCreating(model),
      changeView: (patch) => this.changeView(patch),
      bindSearchInput: (input, kind) => this.bindSearchInput(input, kind),
      isPendingMoveSource: (id, workspace) => this.isPendingMoveSource(id, workspace),
      moveSession: (session) => this.moveSession(session),
    });
    this.detail = new ProjectDetail({
      ...context,
      onIntent: (intent) => this.props.onIntent(intent),
      openEditor: () => { this.editor.mode = "details"; this.renderState(this.props.getModel()); },
      renderChatSection: (parent, sessions, empty) => this.library.renderChatSection(parent, sessions, empty),
    });
    this.editor = new ProjectEditor({
      ...context,
      getError: () => this.localError,
      renderState: (model) => this.renderState(model),
      getCreationDraft: () => this.props.getCreationDraft(),
      resetCreationDraft: () => this.props.resetCreationDraft(),
      updateCreationDraft: (patch) => this.props.updateCreationDraft(patch),
      setCreationMarkerPolicy: (policy) => this.props.setCreationMarkerPolicy(policy),
      addCreationFolders: (paths) => this.props.addCreationFolders(paths),
      removeCreationFolder: (ref) => this.props.removeCreationFolder(ref),
      makeCreationFolderPrimary: (ref) => this.props.makeCreationFolderPrimary(ref),
      submitCreationDraft: () => this.props.submitCreationDraft(),
      renderRoot: (parent, detail, root) => this.detail.renderRoot(parent, detail, root),
      addFolders: (detail) => this.detail.addFolders(detail),
    });
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
    this.editor.destroy();
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

  openEditor(create = false): void {
    const model = this.props.getModel();
    if (!model) return;
    if (create) this.startCreating(model);
    else { this.editor.mode = "details"; this.renderState(model); }
  }

  showSessionMenu(event: MouseEvent, session: FrontendProjectSessionViewModel): void {
    this.library.openSessionMenu(event, session);
  }

  private startCreating(model: FrontendProjectScreenViewModel): void {
    this.props.resetCreationDraft();
    this.editor.mode = "create";
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
    this.editor.render(model);
    shell.setTitle("Projects", "Keep related folders and chats together.");
    shell.updateBody(
      this.editor.mode
        ? `projects:${model.selectedProjectId ?? "none"}:${this.editor.mode}`
        : `projects:${model.selectedProjectId ?? "none"}:view:${model.revision}`,
      (body) => this.renderWorkspace(body, model),
    );
  }

  private renderWorkspace(body: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const layout = body.createDiv({ cls: "chatobby-projects__workspace" });
    this.library.renderRail(layout.createEl("aside", { cls: "chatobby-projects__rail" }), model);
    const detail = layout.createEl("main", { cls: "chatobby-projects__detail" });
    if (!model.detail && !model.selectedProjectId) {
      this.detail.renderVaultDetail(detail, model);
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
    this.detail.renderDetail(detail, model, model.detail);
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

  private async changeView(patch: ProjectViewPatch): Promise<void> {
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

  handleKeydown(event: KeyboardEvent): boolean {
    return this.editor.handleKeydown(event);
  }
}

function sameSessionWorkspace(left: SessionWorkspace, right: SessionWorkspace): boolean {
  return left.kind === right.kind && (
    left.kind === "vault" || (right.kind === "project" && left.projectId === right.projectId)
  );
}
