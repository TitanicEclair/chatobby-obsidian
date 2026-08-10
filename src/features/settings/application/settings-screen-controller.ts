import { Setting, setIcon, type App } from "obsidian";
import type ChatobbyPlugin from "../../../main";
import { ChatobbySettingTab } from "../../../settings";
import { PageShell } from "../../../ui/shared/page-shell";

interface SettingsScreenControllerOptions {
	readonly app: App;
	readonly plugin: ChatobbyPlugin;
	readonly getHost: () => HTMLElement;
	readonly prepareOpen: () => void;
	readonly onOpened: () => void;
	readonly onClosed: (renderChat: boolean) => void;
	readonly downloadGuide: () => void;
}

/** Owns the Chatobby-local settings surface while reusing the secure settings services. */
export class SettingsScreenController {
	private readonly settings: ChatobbySettingTab;
	private openState = false;
	private settingsHost: HTMLElement | null = null;

	constructor(private readonly options: SettingsScreenControllerOptions) {
		this.settings = new ChatobbySettingTab(options.app, options.plugin);
	}

	open(): void {
		this.options.prepareOpen();
		const host = this.options.getHost();
		host.empty();
		const root = host.createDiv({ cls: "chatobby-page chatobby-settings-page" });
		const page = new PageShell(root, {
			title: "Settings",
			subtitle: "Models, conversations, documents, Projects, and Chatobby help.",
			width: "form",
		});
		const close = page.actions.createEl("button", {
			cls: "chatobby-page__icon-button clickable-icon",
			attr: { type: "button", "aria-label": "Close Settings", title: "Close Settings" },
		});
		setIcon(close, "x");
		close.addEventListener("click", () => this.close(true));

		const guide = page.body.createDiv({ cls: "chatobby-settings-page__guide" });
		new Setting(guide)
			.setName("Chatobby Guide")
			.setDesc("Add or update Chatobby's linked, user-friendly guide inside this vault.")
			.addButton((button) => button.setButtonText("Add guide to vault").setCta().onClick(() => this.options.downloadGuide()));

		this.settingsHost = page.body.createDiv({ cls: "chatobby-settings-page__settings" });
		this.settings.renderChatobbySettings(this.settingsHost);
		this.openState = true;
		this.options.onOpened();
	}

	close(renderChat: boolean): void {
		if (!this.openState) return;
		this.settings.detachChatobbySettings(this.settingsHost);
		this.settingsHost = null;
		this.openState = false;
		this.options.getHost().empty();
		this.options.onClosed(renderChat);
	}

	destroy(): void {
		this.close(false);
	}

	handleKeydown(_event: KeyboardEvent): boolean {
		return false;
	}
}
