import { Modal, Setting, type App } from "obsidian";

export interface DirectoryProjectDecision {
	readonly action: "reuse-canonical" | "create-new";
	readonly remember: boolean;
}

export interface DirectoryProjectDraft {
	readonly name: string;
	readonly description?: string;
}

export function requestDirectoryProjectDecision(
	app: App,
	input: { readonly projectName: string; readonly vaultRelativePath: string },
): Promise<DirectoryProjectDecision | null> {
	return new Promise((resolve) => new DirectoryProjectDecisionModal(app, input, resolve).open());
}

export function requestDirectoryProjectDraft(
	app: App,
	vaultRelativePath: string,
): Promise<DirectoryProjectDraft | null> {
	return new Promise((resolve) => new DirectoryProjectDraftModal(app, vaultRelativePath, resolve).open());
}

class DirectoryProjectDecisionModal extends Modal {
	private settled = false;
	private remember = false;

	constructor(
		app: App,
		private readonly input: { readonly projectName: string; readonly vaultRelativePath: string },
		private readonly resolve: (decision: DirectoryProjectDecision | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("This folder already has a Project");
		this.contentEl.createDiv({
			cls: "chatobby-project-directory-modal__description",
			text: `Continue in ${this.input.projectName}, or create another Project that uses ${this.input.vaultRelativePath}.`,
		});
		new Setting(this.contentEl)
			.setName("Don't ask again")
			.setDesc("Remember this choice for this vault. You can change it in Chatobby settings.")
			.addToggle((toggle) => toggle.setValue(false).onChange((value) => {
				this.remember = value;
			}));

		const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
		actions.createEl("button", { text: "Create new Project" }).addEventListener("click", () => {
			this.finish({ action: "create-new", remember: this.remember });
		});
		const continueButton = actions.createEl("button", {
			cls: "mod-cta",
			text: "Continue existing Project",
		});
		continueButton.addEventListener("click", () => {
			this.finish({ action: "reuse-canonical", remember: this.remember });
		});
		window.requestAnimationFrame(() => continueButton.focus());
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.settled) this.resolve(null);
	}

	private finish(decision: DirectoryProjectDecision): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(decision);
		this.close();
	}
}

class DirectoryProjectDraftModal extends Modal {
	private settled = false;
	private name: string;
	private description = "";

	constructor(
		app: App,
		private readonly vaultRelativePath: string,
		private readonly resolve: (draft: DirectoryProjectDraft | null) => void,
	) {
		super(app);
		this.name = directoryName(vaultRelativePath);
	}

	onOpen(): void {
		this.titleEl.setText("Create Project");
		this.contentEl.createDiv({
			cls: "chatobby-project-directory-modal__description",
			text: `This Project will use ${this.vaultRelativePath} as its primary folder.`,
		});
		new Setting(this.contentEl).setName("Name").addText((text) => {
			text.setValue(this.name).onChange((value) => {
				this.name = value;
			});
			window.requestAnimationFrame(() => text.inputEl.select());
		});
		new Setting(this.contentEl).setName("Description").setDesc("Optional").addTextArea((text) => {
			text.setValue(this.description).onChange((value) => {
				this.description = value;
			});
		});
		const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
		actions.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
		actions.createEl("button", { cls: "mod-cta", text: "Create Project" }).addEventListener("click", () => {
			const name = this.name.trim();
			if (!name) return;
			this.finish({
				name,
				description: this.description.trim() || undefined,
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.settled) this.resolve(null);
	}

	private finish(draft: DirectoryProjectDraft): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(draft);
		this.close();
	}
}

function directoryName(vaultRelativePath: string): string {
	const segments = vaultRelativePath.replaceAll("\\", "/").split("/").filter(Boolean);
	return segments.at(-1) ?? "New Project";
}
