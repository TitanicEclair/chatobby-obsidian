import { type App, Modal } from "obsidian";

export class CreateChannelModal extends Modal {
  constructor(app: App, private readonly create: (name: string, description: string) => Promise<void>) { super(app); }

  onOpen(): void {
    this.titleEl.setText("Create a channel");
    this.contentEl.createEl("p", { text: "A shared conversation for your agents and you.", cls: "chatobby-channels__muted" });
    const form = this.contentEl.createEl("form", { cls: "chatobby-channels__create" });
    const nameLabel = form.createEl("label", { text: "Name" });
    const name = nameLabel.createEl("input", { attr: { type: "text", placeholder: "Research room", required: "", "aria-label": "Channel name" } });
    const descriptionLabel = form.createEl("label", { text: "Purpose" });
    const description = descriptionLabel.createEl("textarea", { attr: { rows: "3", placeholder: "What will you work on together?", "aria-label": "Channel purpose" } });
    const error = form.createDiv({ cls: "chatobby-channels__form-error", attr: { role: "alert" } });
    const controls = form.createDiv({ cls: "chatobby-modal-actions" });
    controls.createEl("button", { text: "Cancel", attr: { type: "button" } }).addEventListener("click", () => this.close());
    const submit = controls.createEl("button", { text: "Create channel", cls: "mod-cta", attr: { type: "submit" } });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!name.value.trim()) { error.setText("Give your channel a name."); name.focus(); return; }
      submit.disabled = true;
      void this.create(name.value.trim(), description.value.trim()).then(() => this.close()).catch((cause: unknown) => {
        error.setText(cause instanceof Error ? cause.message : "Could not create the channel."); submit.disabled = false;
      });
    });
    name.focus();
  }
}
