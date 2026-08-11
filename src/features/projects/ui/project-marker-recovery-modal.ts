import { Modal, type App } from "obsidian";

export type ProjectMarkerRecoveryChoice = "retry" | "device-only" | "cancel";

export function requestProjectMarkerRecovery(
	app: App,
	input: { readonly canUseDeviceOnly: boolean; readonly detail: string },
): Promise<ProjectMarkerRecoveryChoice> {
	return new Promise((resolve) => new ProjectMarkerRecoveryModal(app, input, resolve).open());
}

class ProjectMarkerRecoveryModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly input: { readonly canUseDeviceOnly: boolean; readonly detail: string },
		private readonly resolve: (choice: ProjectMarkerRecoveryChoice) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Chatobby could not place a folder marker");
		this.contentEl.createDiv({
			text: this.input.detail,
		});
		if (this.input.canUseDeviceOnly) {
			this.contentEl.createDiv({
				cls: "setting-item-description",
				text: "You can continue with device-only bindings. The Project will work on this device, but Chatobby may need your help to relink a folder after it is renamed or moved.",
			});
		}
		const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
		actions.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => {
			this.finish("cancel");
		});
		if (this.input.canUseDeviceOnly) {
			actions.createEl("button", {
				text: "Continue without markers",
				attr: { type: "button" },
			}).addEventListener("click", () => {
				this.finish("device-only");
			});
		}
		const retry = actions.createEl("button", {
			cls: "mod-cta",
			text: "Try again",
			attr: { type: "button" },
		});
		retry.addEventListener("click", () => {
			this.finish("retry");
		});
		window.requestAnimationFrame(() => retry.focus());
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.settled) this.resolve("cancel");
	}

	private finish(choice: ProjectMarkerRecoveryChoice): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(choice);
		this.close();
	}
}
