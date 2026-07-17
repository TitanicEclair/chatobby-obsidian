import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../shared/component";
import type { ChatobbyViewMode } from "../controller/view-navigation-controller";

export interface TabBarHost {
  workingDirectoryLabel(): string;
	activeMode(): ChatobbyViewMode;
	onReturnToChat(): void;
	onCreateView(): void;
	onNavigate(mode: "subagents" | "channels" | "permissions" | "memory" | "events" | "queries"): void;
  onSetWorkingDirectory(): void;
}

export class TabBar extends ChatobbyComponent {
  private directoryLabelEl: HTMLButtonElement | null = null;
	private pagesEl: HTMLElement | null = null;

  constructor(private readonly host: TabBarHost) {
    super();
  }

  refresh(): void {
    if (this.directoryLabelEl) this.directoryLabelEl.textContent = this.host.workingDirectoryLabel();
		for (const element of Array.from(this.pagesEl?.children ?? [])) {
			if (!(element instanceof HTMLElement)) continue;
			const active = element.dataset.mode === this.host.activeMode();
			element.toggleClass("is-active", active);
			element.setAttr("aria-pressed", String(active));
			if (active) element.setAttr("aria-current", "page");
			else element.removeAttribute("aria-current");
		}
  }

  protected onRender(container: HTMLElement): void {
    this.directoryLabelEl = container.createEl("button", {
      cls: "chatobby-tab-bar__directory",
      attr: { type: "button", title: "Return to main chat", "aria-label": "Return to main chat" },
    });
		this.directoryLabelEl.addEventListener("click", () => this.host.onReturnToChat());
		const actions = container.createDiv({
			cls: "chatobby-tab-bar__actions",
			attr: { role: "toolbar", "aria-label": "Chatobby view controls" },
		});
		this.pagesEl = actions.createDiv({ cls: "chatobby-tab-bar__pages", attr: { role: "group", "aria-label": "Chatobby pages" } });
		this.renderPage("subagents", "bot", "Subagents");
		this.renderPage("channels", "messages-square", "Channels");
		this.renderPage("permissions", "shield-check", "Permissions");
		this.renderPage("memory", "brain", "Memory");
		this.renderPage("events", "calendar-clock", "Events");
		this.renderPage("queries", "braces", "Queries");
		actions.createDiv({ cls: "chatobby-tab-bar__separator", attr: { role: "separator", "aria-orientation": "vertical" } });
    const newButton = actions.createEl("button", {
      cls: "chatobby-tab-bar__action chatobby-tab-bar__new clickable-icon",
			attr: { type: "button", "aria-label": "Open new Chatobby view", title: "Open new Chatobby view" },
    });
    setIcon(newButton, "plus");
		newButton.addEventListener("click", () => this.host.onCreateView());
    const directoryButton = actions.createEl("button", {
      cls: "chatobby-tab-bar__action chatobby-tab-bar__new-directory clickable-icon",
      attr: {
			type: "button",
			"aria-label": "Set Chatobby working directory",
			title: "Set Chatobby working directory",
		},
    });
    setIcon(directoryButton, "folder-open");
    directoryButton.addEventListener("click", () => this.host.onSetWorkingDirectory());
    this.refresh();
  }

  protected componentClass(): string {
    return "chatobby-tab-bar";
  }

	private renderPage(mode: "subagents" | "channels" | "permissions" | "memory" | "events" | "queries", icon: string, label: string): void {
		if (!this.pagesEl) return;
		const button = this.pagesEl.createEl("button", {
			cls: "chatobby-tab-bar__action chatobby-tab-bar__page clickable-icon",
			attr: { type: "button", title: label, "aria-label": `Open ${label}`, "aria-pressed": "false" },
		});
		button.dataset.mode = mode;
		setIcon(button, icon);
		button.addEventListener("click", () => {
			if (this.host.activeMode() === mode) return;
			this.host.onNavigate(mode);
		});
	}
}
