import { Notice, setIcon } from "obsidian";
import { revokeComposerAttachment } from "../../attachments/attachment-store";
import { attachmentMeta, attachmentVisual } from "../attachments/attachment-presentation";
import type { ComposerAttachment } from "./types";
import type { ComposerDraftState } from "./draft-state";

const MAX_COMPOSER_ATTACHMENTS = 8;

const COMPOSER_ATTACHMENT_ACCEPT = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf", ".docx", ".pptx", ".xlsx", ".odt", ".odp", ".ods", ".rtf",
  ".md", ".txt", ".json", ".jsonc", ".yaml", ".yml", ".xml", ".svg", ".html", ".htm", ".csv", ".tsv",
  ".log", ".css", ".js", ".jsx", ".ts", ".tsx", ".py", ".ps1", ".sh",
].join(",");

/** Presentation reads the instance's current draft and current picker after awaits. */
export class ComposerAttachments {
  attachmentRailEl: HTMLElement | null = null;
  private attachBtn: HTMLButtonElement | null = null;
  private attachInputEl: HTMLInputElement | null = null;
  constructor(
    private host: { storeFiles?(files: readonly File[]): Promise<ComposerAttachment[]> },
    private draft: ComposerDraftState,
    private updateControls: () => void,
  ) {}

  clearPicker(): void { if (this.attachInputEl) this.attachInputEl.value = ""; }

  bindAttachmentEvents(card: HTMLElement, inputEl: HTMLTextAreaElement | null): void {
    inputEl?.addEventListener("paste", (event) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void this.addFiles(files);
    });
    card.addEventListener("dragover", (event) => {
      if (!event.dataTransfer || event.dataTransfer.types.length === 0) return;
      event.preventDefault();
      card.addClass("is-drag-over");
    });
    card.addEventListener("dragleave", () => {
      card.removeClass("is-drag-over");
    });
    card.addEventListener("drop", (event) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      card.removeClass("is-drag-over");
      void this.addFiles(files);
    });
  }

  bindAttachmentPicker(card: HTMLElement, sendBtn: HTMLButtonElement | null): void {
    const actions = sendBtn?.closest<HTMLElement>(".chatobby-composer-actions") ?? sendBtn?.parentElement ?? card;
    const bar = actions.closest<HTMLElement>(".chatobby-composer-bar");
    const attachmentHost = bar ?? actions;
    this.attachInputEl = card.createEl("input", {
      cls: "chatobby-attachment-input",
      attr: { type: "file", accept: COMPOSER_ATTACHMENT_ACCEPT, multiple: "true", tabindex: "-1" },
    });
    this.attachBtn = attachmentHost.createEl("button", {
      cls: "chatobby-attach-btn",
      attr: { type: "button", "aria-label": "Attach files", title: "Attach files" },
    });
    setIcon(this.attachBtn, "plus");
    if (bar) {
      bar.insertBefore(this.attachBtn, bar.firstElementChild);
    } else if (sendBtn) {
      actions.insertBefore(this.attachBtn, sendBtn);
    }
    this.attachBtn.disabled = !this.host.storeFiles;
    this.attachBtn.addEventListener("click", () => this.attachInputEl?.click());
    this.attachInputEl.addEventListener("change", () => {
      const files = Array.from(this.attachInputEl?.files ?? []);
      if (files.length > 0) void this.addFiles(files);
      if (this.attachInputEl) this.attachInputEl.value = "";
    });
  }

  private async addFiles(files: readonly File[]): Promise<void> {
    if (!this.host.storeFiles) {
      new Notice("This Chatobby build cannot store attachments.");
      return;
    }
    if (this.draft.state.attachments.length + files.length > MAX_COMPOSER_ATTACHMENTS) {
      new Notice(`A message can include up to ${MAX_COMPOSER_ATTACHMENTS} attachments.`);
      return;
    }
    try {
      const attachments = await this.host.storeFiles(files);
      this.draft.state.attachments = [...this.draft.state.attachments, ...attachments];
      this.renderAttachments();
      this.updateControls();
    } catch (error) {
      console.error("Chatobby: failed to store attachment", error);
      new Notice(error instanceof Error ? error.message : "Failed to store attachment");
    }
  }

  private removeAttachment(id: string): void {
    const removed = this.draft.state.attachments.find((attachment) => attachment.id === id);
    if (removed) revokeComposerAttachment(removed);
    this.draft.state.attachments = this.draft.state.attachments.filter((attachment) => attachment.id !== id);
    this.renderAttachments();
    this.updateControls();
  }

  renderAttachments(): void {
    if (!this.attachmentRailEl) return;
    this.attachmentRailEl.empty();
    this.attachmentRailEl.toggleClass("is-hidden", this.draft.state.attachments.length === 0);
    for (const attachment of this.draft.state.attachments) {
      const item = this.attachmentRailEl.createDiv({ cls: "chatobby-attachment-chip" });
      const visual = attachmentVisual(
        attachment.name,
        attachment.delivery === "image" ? "image" : attachment.delivery === "text" ? "text" : "file",
      );
      item.dataset.fileKind = visual.kind;
      item.setAttr("title", attachment.name);
      if (attachment.previewUrl) {
        item.createEl("img", {
          cls: "chatobby-attachment-chip__thumb",
          attr: { src: attachment.previewUrl, alt: attachment.name },
        });
      } else {
        const icon = item.createSpan({ cls: "chatobby-attachment-chip__icon", attr: { "aria-hidden": "true" } });
        setIcon(icon, visual.icon);
      }
      const body = item.createDiv({ cls: "chatobby-attachment-chip__body" });
      body.createDiv({ cls: "chatobby-attachment-chip__name", text: attachment.name, attr: { title: attachment.name } });
      body.createDiv({
        cls: "chatobby-attachment-chip__meta",
        text: attachmentMeta(
          attachment.name,
          attachment.delivery.charAt(0).toUpperCase() + attachment.delivery.slice(1),
          attachment.sizeBytes,
        ),
      });
      const remove = item.createEl("button", {
        cls: "chatobby-attachment-chip__remove",
        attr: { type: "button", "aria-label": `Remove ${attachment.name}`, title: "Remove attachment" },
      });
      setIcon(remove, "x");
      remove.addEventListener("click", () => this.removeAttachment(attachment.id));
    }
  }
}
