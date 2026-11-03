import { Modal, setIcon } from "obsidian";
import type {
  FrontendProjectDetailViewModel,
  FrontendProjectScreenViewModel,
} from "../../../../vendor/chatobby-client/frontend-contracts.js";
import { PageShell, createPageSection } from "../../../../ui/shared/page-shell";
import { chooseSystemDirectories } from "../../infrastructure/system-directory-picker";
import { plural } from "../project-elements";
import type { ProjectPresentationActions, ProjectsViewProps } from "../project-view-types";
import type { ProjectDetail } from "../detail/project-detail";

type EditorMode = "create" | "details" | null;

export interface ProjectEditorOptions extends ProjectPresentationActions,
  Pick<ProjectsViewProps, "app" | "getModel" | "getCreationDraft" | "resetCreationDraft"
    | "updateCreationDraft" | "setCreationMarkerPolicy" | "addCreationFolders"
    | "removeCreationFolder" | "makeCreationFolderPrimary" | "submitCreationDraft"> {
  getError(): string | null;
  renderState(model: FrontendProjectScreenViewModel | null): void;
  renderRoot: ProjectDetail["renderRoot"];
  addFolders: ProjectDetail["addFolders"];
}

/** Owns the native editor lifetime; creation draft and shared operation state remain external. */
export class ProjectEditor {
  mode: EditorMode = null;
  private modal: Modal | null = null;
  private shell: PageShell | null = null;
  constructor(private readonly options: ProjectEditorOptions) { }

  destroy(): void {
    this.modal?.close();
    this.modal = null;
    this.shell = null;
  }

  render(model: FrontendProjectScreenViewModel): void {
    if (!this.mode) {
      this.modal?.close();
      this.modal = null;
      this.shell = null;
      return;
    }
    if (!this.modal) {
      const modal = new Modal(this.options.app);
      this.modal = modal;
      modal.modalEl.addClass("chatobby-project-editor-modal");
      modal.contentEl.addClass("chatobby-page", "chatobby-projects");
      this.shell = new PageShell(modal.contentEl, { title: this.mode === "create" ? "Create Project" : "Edit Project", width: "form" });
      modal.onClose = () => {
        this.mode = null;
        this.modal = null;
        this.shell = null;
      };
      modal.open();
    }
    const shell = this.shell;
    if (!shell) return;
    shell.setBusy(this.options.isBusy());
    const error = this.options.getError();
    shell.setStatus(error ? { tone: "error", message: error } : null);
    shell.updateBody(`editor:${this.mode}:${model.selectedProjectId ?? "new"}`, (body) => {
      if (this.mode === "create") this.renderCreateForm(body);
      else if (model.detail) {
        this.renderDetailsForm(body, model.detail);
        const folders = createPageSection(body, { title: "Folders", description: "Changes to folder links apply immediately. Your files stay in place." });
        for (const root of model.detail.roots) this.options.renderRoot(folders.content, model.detail, root);
        const add = folders.content.createEl("button", { text: "Add folders", attr: { type: "button" } });
        add.disabled = this.options.isBusy() || model.detail.lifecycle !== "active";
        const detail = model.detail;
        add.addEventListener("click", () => void this.options.addFolders(detail));
      }
    });
  }

  private renderCreateForm(parent: HTMLElement): void {
    const draft = this.options.getCreationDraft();
    const section = createPageSection(parent, {
      title: "Create Project",
      description: "Keep one or more existing folders together, or let Chatobby create a new folder in this vault.",
    });
    const form = section.content.createEl("form", { cls: "chatobby-projects__form" });
    const name = textField(form, "Project name", "Project name", true, draft.name);
    name.addEventListener("input", () => this.options.updateCreationDraft({ name: name.value }));
    const description = textAreaField(form, "Description", "What are you working on?", draft.description);
    description.addEventListener("input", () => this.options.updateCreationDraft({ description: description.value }));

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
            this.options.makeCreationFolderPrimary(root.directoryCandidateRef);
            this.options.renderState(this.options.getModel());
          });
        }
        const remove = actions.createEl("button", {
          cls: "clickable-icon",
          attr: { type: "button", "aria-label": `Remove ${root.label} from new Project` },
        });
        setIcon(remove, "x");
        remove.addEventListener("click", () => {
          this.options.removeCreationFolder(root.directoryCandidateRef);
          this.options.renderState(this.options.getModel());
        });
      }
    }
    const choose = folders.createEl("button", {
      text: draft.roots.length === 0 ? "Choose folders" : "Add more folders",
      attr: { type: "button" },
    });
    choose.addEventListener("click", () => void this.options.runAction("choose-project-folders", async () => {
      const paths = await chooseSystemDirectories("Choose Project folders", true);
      if (paths.length === 0) return;
      await this.options.addCreationFolders(paths);
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
        this.options.setCreationMarkerPolicy(input.checked ? "required" : "disabled");
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
      void this.options.runAction("create-project", async () => {
        created = await this.options.submitCreationDraft();
      }).then((applied) => {
        if (!applied || !created) return;
        this.options.resetCreationDraft();
        this.mode = null;
        this.options.renderState(this.options.getModel());
      });
    });
    const actions = form.createDiv({ cls: "chatobby-projects__form-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => {
      this.options.resetCreationDraft();
      this.mode = null;
      this.options.renderState(this.options.getModel());
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
      void this.options.run("edit-project", {
        type: "projects.replace-details",
        payload: {
          projectId: detail.projectId,
          expectedProjectRevision: detail.revision,
          name: name.value,
          description: description.value.trim() || undefined,
        },
      }).then((applied) => {
        if (!applied) return;
        this.mode = null;
        this.options.renderState(this.options.getModel());
      });
    });
    const actions = form.createDiv({ cls: "chatobby-projects__form-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => { this.mode = null; this.options.renderState(this.options.getModel()); });
    actions.createEl("button", { cls: "mod-cta", text: "Save", attr: { type: "submit" } });
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key !== "Escape" && event.key !== "BrowserBack") return false;
    if (this.mode) {
      if (this.mode === "create") this.options.resetCreationDraft();
      this.mode = null;
      this.options.renderState(this.options.getModel());
      event.preventDefault();
      return true;
    }
    return false;
  }
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
