import { Menu, setIcon } from "obsidian";
import type {
  FrontendProjectDetailViewModel,
  FrontendProjectScreenViewModel,
  FrontendProjectRootViewModel,
} from "../../../../vendor/chatobby-client/frontend-contracts.js";
import { createPageSection, createPageState } from "../../../../ui/shared/page-shell";
import { confirmAction, pickItem, promptText } from "../../../../ui/modals/modals";
import { openSystemPathExternally, revealSystemPathExternally } from "../../../../ui/controller/system-path-opener";
import { chooseSystemDirectories } from "../../infrastructure/system-directory-picker";
import type { ProjectPresentationActions, ProjectsViewProps } from "../project-view-types";
import type { SessionLibrary } from "../library/session-library";

type BrowsedWorkspace =
  | { readonly kind: "vault"; readonly label: "Vault" }
  | { readonly kind: "project"; readonly projectId: string; readonly label: string };

export interface ProjectDetailOptions extends ProjectPresentationActions,
  Pick<ProjectsViewProps, "app" | "getModel" | "onIntent" | "onRefresh"> {
  openEditor(): void;
  renderChatSection: SessionLibrary["renderChatSection"];
}

/** Project/root presentation and native choices; mutations keep canonical IDs and captured revisions. */
export class ProjectDetail {
  constructor(private readonly options: ProjectDetailOptions) { }

  renderDetail(parent: HTMLElement, model: FrontendProjectScreenViewModel, detail: FrontendProjectDetailViewModel): void {
    const header = parent.createEl("header", { cls: "chatobby-projects__detail-header" });
    const title = header.createDiv({ cls: "chatobby-projects__detail-title" });
    title.createEl("h2", { text: detail.name });
    if (detail.description) title.createEl("p", { text: detail.description });
    const actions = header.createDiv({ cls: "chatobby-projects__detail-actions" });
    if (detail.lifecycle === "active") {
      const newChat = actions.createEl("button", { cls: "mod-cta", text: "New chat in Project", attr: { type: "button" } });
      newChat.disabled = this.options.isBusy();
      newChat.addEventListener("click", () => void this.options.run("new-chat", {
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
        ? "No Project folder is linked. This Project stays rootless and does not inherit Vault access."
        : "Folders available to chats in this Project. Permissions still decide what agents may access.",
      className: "chatobby-projects__folders",
    });
    if (detail.roots.length === 0) {
      createPageState(folders.content, {
        kind: "empty",
        title: "No folders attached",
        description: "New chats keep this Project identity. Add a Project folder before relying on Project-scoped file access.",
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
    addFolders.disabled = detail.lifecycle !== "active" || this.options.isBusy();
    addFolders.addEventListener("click", () => void this.addFolders(detail));

    this.options.renderChatSection(parent, detail.sessions, {
      model,
      totalCount: detail.sessionCount,
      workspace: { kind: "project", projectId: detail.projectId },
      emptyTitle: "Start the first chat",
      emptyDescription: "The new chat will keep this Project identity even if it has no folders yet.",
      actionLabel: detail.lifecycle === "active" ? "New chat in Project" : undefined,
      onAction: detail.lifecycle === "active" ? () => void this.options.run("new-chat", {
        type: "session.create",
        payload: { workspace: { kind: "project", projectId: detail.projectId } },
      }) : undefined,
    });

    this.renderWorkspaceContext(parent, model, {
      kind: "project",
      projectId: detail.projectId,
      label: detail.name,
    });
  }

  renderVaultDetail(parent: HTMLElement, model: FrontendProjectScreenViewModel): void {
    const header = parent.createEl("header", { cls: "chatobby-projects__detail-header" });
    const title = header.createDiv({ cls: "chatobby-projects__detail-title" });
    title.createEl("h2", { text: "Vault" });
    title.createEl("p", { text: "Chats that are not assigned to a Project." });
    const actions = header.createDiv({ cls: "chatobby-projects__detail-actions" });
    const newChat = actions.createEl("button", { cls: "mod-cta", text: "New chat", attr: { type: "button" } });
    newChat.disabled = this.options.isBusy();
    newChat.addEventListener("click", () => void this.options.run("new-vault-chat", {
      type: "session.create",
      payload: { workspace: { kind: "vault" } },
    }));
    this.options.renderChatSection(parent, model.vaultSessions, {
      model,
      totalCount: model.vaultSessionCount,
      workspace: { kind: "vault" },
      emptyTitle: "No Vault chats yet",
      emptyDescription: "Start a chat that works from the vault root without assigning it to a Project.",
      actionLabel: "New chat",
      onAction: () => void this.options.run("new-vault-chat", {
        type: "session.create",
        payload: { workspace: { kind: "vault" } },
      }),
    });
    this.renderWorkspaceContext(parent, model, { kind: "vault", label: "Vault" });
  }

  private renderWorkspaceContext(
    parent: HTMLElement,
    model: FrontendProjectScreenViewModel,
    browsing: BrowsedWorkspace,
  ): void {
    const runningHere = browsing.kind === "vault"
      ? model.runningIn.kind === "vault"
      : model.runningIn.kind === "project" && model.runningIn.projectId === browsing.projectId;
    const suffix = runningHere ? "" : ". Browsing does not move the active chat.";
    parent.createDiv({
      cls: "chatobby-projects__current-note",
      text: `Browsing ${browsing.label} · Running in ${model.runningIn.label}${suffix}`,
    });
  }

  renderRoot(parent: HTMLElement, detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): void {
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
      primary.addEventListener("click", () => void this.options.run(`primary:${root.rootId}`, {
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

  private openProjectMenu(event: MouseEvent, detail: FrontendProjectDetailViewModel): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Edit name and description").setIcon("pencil").onClick(() => {
      this.options.openEditor();
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
    const running = this.options.getModel()?.runningIn;
    if (
      root.availability === "available" &&
      running?.kind === "project" &&
      running.projectId === detail.projectId &&
      running.activeRootId !== root.rootId
    ) {
      menu.addItem((item) => item.setTitle("Run current chat here").setIcon("play").onClick(() => void this.options.run(
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
        openSystemPathExternally(this.options.app, localPath);
      }));
      menu.addItem((item) => item.setTitle("Reveal in file explorer").setIcon("scan-search").onClick(() => {
        revealSystemPathExternally(this.options.app, localPath);
      }));
      menu.addItem((item) => item.setTitle("Copy path").setIcon("copy").onClick(() => {
        void navigator.clipboard.writeText(localPath);
      }));
      menu.addSeparator();
    }
    menu.addItem((item) => item.setTitle("Rename folder label").setIcon("pencil").onClick(() => void this.renameRoot(detail, root)));
    if (!root.primary) {
      menu.addItem((item) => item.setTitle("Make primary").setIcon("star").onClick(() => void this.options.run(`primary:${root.rootId}`, {
        type: "projects.root-set-primary",
        payload: { projectId: detail.projectId, expectedProjectRevision: detail.revision, rootId: root.rootId },
      })));
    }
    if (root.recoveryAction === "relink") {
      menu.addItem((item) => item.setTitle("Choose folder again").setIcon("folder-sync").onClick(() => void this.relinkRoot(detail, root)));
    } else if (root.recoveryAction) {
      menu.addItem((item) => item.setTitle("Repair folder connection").setIcon("wrench").onClick(() => void this.options.run(`recover:${root.rootId}`, {
        type: "projects.root-recover",
        payload: { projectId: detail.projectId, rootId: root.rootId },
      })));
    }
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Remove from Project").setIcon("trash-2").onClick(() => void this.removeRoot(detail, root)));
    menu.showAtMouseEvent(event);
  }

  async addFolders(detail: FrontendProjectDetailViewModel): Promise<void> {
    const folders = await chooseSystemDirectories("Add folders to Project", true);
    if (folders.length === 0) return;
    await this.options.runAction("add-folders", async () => {
      const current = this.options.getModel()?.detail;
      if (!current || current.projectId !== detail.projectId) throw new Error("The Project changed while adding folders.");
      await this.options.onIntent({
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
      await this.options.onRefresh();
    });
  }

  private async renameRoot(detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): Promise<void> {
    const label = await promptText(this.options.app, { title: "Rename folder label", value: root.label, submitLabel: "Rename" });
    if (!label?.trim()) return;
    await this.options.run(`rename-root:${root.rootId}`, {
      type: "projects.root-relabel",
      payload: { projectId: detail.projectId, expectedProjectRevision: detail.revision, rootId: root.rootId, label: label.trim() },
    });
  }

  private async relinkRoot(detail: FrontendProjectDetailViewModel, root: FrontendProjectRootViewModel): Promise<void> {
    const [folder] = await chooseSystemDirectories(`Choose ${root.label}`, false);
    if (!folder) return;
    await this.options.run(`relink:${root.rootId}`, {
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
    if (!await confirmAction(this.options.app, {
      title: "Remove folder from Project?",
      message: `Remove “${root.label}” from this Project? The folder and its files will not be deleted.`,
      confirmLabel: "Remove",
      destructive: true,
    })) return;
    let replacementRootId: string | undefined;
    if (root.primary && detail.roots.length > 1) {
      const replacement = await pickItem(
        this.options.app,
        detail.roots.filter((candidate) => candidate.rootId !== root.rootId),
        (candidate) => candidate.label,
        "Choose the new primary folder",
      );
      if (!replacement) return;
      replacementRootId = replacement.rootId;
    }
    await this.options.run(`remove-root:${root.rootId}`, {
      type: "projects.root-remove",
      payload: {
        projectId: detail.projectId,
        expectedProjectRevision: detail.revision,
        rootId: root.rootId,
        ...(replacementRootId ? { replacementRootId } : {}),
      },
    });
  }

  private async changeLifecycle(detail: FrontendProjectDetailViewModel, action: "archive" | "restore"): Promise<void> {
    if (action === "archive" && !await confirmAction(this.options.app, {
      title: "Archive Project?",
      message: "Its folders and chats are preserved and can be restored later.",
      confirmLabel: "Archive",
    })) return;
    await this.options.run(action, {
      type: action === "archive" ? "projects.archive" : "projects.restore",
      payload: { projectId: detail.projectId, expectedProjectRevision: detail.revision },
    });
  }
}
