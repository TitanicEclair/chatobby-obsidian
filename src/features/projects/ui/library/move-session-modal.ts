import { Modal, setIcon, type App } from "obsidian";

export type SessionMoveDestination =
  | { readonly kind: "vault"; readonly name: "Vault"; readonly current: boolean; readonly available: true }
  | {
    readonly kind: "project";
    readonly projectId: string;
    readonly name: string;
    readonly current: boolean;
    readonly available: boolean;
    readonly availabilityLabel: string;
  };

/** One native selection; close resolves cancellation unless a destination already settled. */
export class MoveSessionModal extends Modal {
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
      text: `Choose where “${this.sessionName}” belongs. Future file, tool, and memory work uses the new workspace; existing messages remain in this conversation. Start a new Project chat for separate context.`,
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
