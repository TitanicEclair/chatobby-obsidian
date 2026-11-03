import { Modal, Notice, Setting, type App } from "obsidian";
import type { WsProviderInfo } from "../../../types";

export class ProviderCredentialModal extends Modal {
  private providerId: string;
  private key = "";
  private saving = false;

  constructor(
    app: App,
    private readonly provider: WsProviderInfo | undefined,
    private readonly saveProvider: (
      providerId: string,
      key: string,
    ) => Promise<void>,
  ) {
    super(app);
    this.providerId = provider?.id ?? "";
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-provider-modal");
    this.titleEl.setText(
      this.provider
        ? `Connect ${this.provider.name}`
        : "Connect custom provider",
    );
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "chatobby-provider-modal__intro",
      text: this.provider
        ? "Paste an API key to connect this provider. Existing keys are replaced securely."
        : "Use the exact provider id from your models.json configuration.",
    });
    if (!this.provider) {
      new Setting(this.contentEl).setName("Provider id").addText((text) =>
        text.setPlaceholder("provider-id").onChange((value) => {
          this.providerId = value.trim();
        }),
      );
    }
    let keyInput: HTMLInputElement | null = null;
    new Setting(this.contentEl).setName("API key").addText((text) => {
      keyInput = text.inputEl;
      text.inputEl.type = "password";
      text.setPlaceholder("Paste API key").onChange((value) => {
        this.key = value.trim();
      });
    });
    const actions = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    const cancel = actions.createEl("button", {
      text: "Cancel",
      attr: { type: "button" },
    });
    cancel.addEventListener("click", () => this.close());
    const connect = actions.createEl("button", {
      cls: "mod-cta",
      text: "Connect",
      attr: { type: "button" },
    });
    connect.addEventListener("click", () => void this.connect(connect, cancel));
    window.requestAnimationFrame(() => keyInput?.focus());
  }

  private async connect(
    connect: HTMLButtonElement,
    cancel: HTMLButtonElement,
  ): Promise<void> {
    if (this.saving) return;
    if (!this.providerId || !this.key) {
      new Notice("Provider and API key are required");
      return;
    }
    this.saving = true;
    connect.disabled = true;
    cancel.disabled = true;
    try {
      await this.saveProvider(this.providerId, this.key);
      this.close();
    } catch (error) {
      console.error("Chatobby: failed to connect provider", error);
      new Notice(`Could not connect ${this.providerId}`);
      connect.disabled = false;
      cancel.disabled = false;
    } finally {
      this.saving = false;
    }
  }
}

export class WebSearchCredentialModal extends Modal {
  private key = "";
  private saving = false;

  constructor(
    app: App,
    private readonly save: (key: string) => Promise<void>,
    private readonly afterSave: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-provider-modal");
    this.titleEl.setText("Connect Brave Search");
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "chatobby-provider-modal__intro",
      text: "Paste a Brave Search API key. Chatobby stores it in Obsidian's secret storage and does not save it in plugin settings, logs, or diagnostics.",
    });
    let keyInput: HTMLInputElement | null = null;
    new Setting(this.contentEl).setName("API key").addText((text) => {
      keyInput = text.inputEl;
      text.inputEl.type = "password";
      text.setPlaceholder("Paste Brave Search API key").onChange((value) => {
        this.key = value.trim();
      });
    });
    const actions = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    const cancel = actions.createEl("button", {
      text: "Cancel",
      attr: { type: "button" },
    });
    cancel.addEventListener("click", () => this.close());
    const connect = actions.createEl("button", {
      cls: "mod-cta",
      text: "Connect",
      attr: { type: "button" },
    });
    connect.addEventListener("click", () => void this.connect(connect, cancel));
    window.requestAnimationFrame(() => keyInput?.focus());
  }

  private async connect(
    connect: HTMLButtonElement,
    cancel: HTMLButtonElement,
  ): Promise<void> {
    if (this.saving) return;
    if (!this.key) {
      new Notice("A Brave Search API key is required");
      return;
    }
    this.saving = true;
    connect.disabled = true;
    cancel.disabled = true;
    try {
      await this.save(this.key);
      this.afterSave();
      new Notice("Enhanced web search connected");
      this.close();
    } catch (error) {
      console.error("Chatobby: failed to connect enhanced web search", error);
      new Notice("Could not connect enhanced web search");
      connect.disabled = false;
      cancel.disabled = false;
    } finally {
      this.saving = false;
    }
  }
}
