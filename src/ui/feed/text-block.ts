import { setIcon } from "obsidian";
import type { StopReason, TextBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { formatDuration } from "../shared/format";
import { decorateAfterMarkdown } from "./decorations";
import type { FeedHost } from "./index";

export class TextBlockView extends ChatobbyComponent {
  private labelEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private copyButton: HTMLButtonElement | null = null;

  constructor(private readonly host: FeedHost, private block?: TextBlock) {
    super();
  }

  setBlock(block: TextBlock): void {
    this.block = block;
    this.renderMarkdown();
    this.updateLabel();
    this.container?.toggleClass("is-streaming", block.status === "streaming");
    this.updateCopyButton();
  }

  setStreaming(text: string): void {
    if (this.block) this.block = { ...this.block, text, status: "streaming" };
    this.renderMarkdown();
    this.updateLabel();
    this.container?.addClass("is-streaming");
  }

  complete(stopReason?: StopReason): void {
    if (this.block) this.block = { ...this.block, status: "complete", stopReason };
    this.updateLabel();
    this.container?.removeClass("is-streaming");
    this.updateCopyButton();
  }

  protected onRender(container: HTMLElement): void {
    const header = container.createDiv({ cls: "chatobby-text-block__header" });
    this.labelEl = header.createSpan({ cls: "chatobby-text-block__label" });
    this.contentEl = container.createDiv({ cls: "chatobby-text-block__content" });
    const actions = container.createDiv({ cls: "chatobby-text-block__actions" });
    this.copyButton = actions.createEl("button", {
      cls: "chatobby-text-block__copy",
      attr: { type: "button", "aria-label": "Copy response as Markdown", title: "Copy response as Markdown" },
    });
    setIcon(this.copyButton, "copy");
    this.copyButton.addEventListener("click", () => {
      if (!this.block) return;
      this.host.copyToClipboard(this.block.text);
      if (!this.copyButton) return;
      this.copyButton.empty();
      setIcon(this.copyButton, "check");
      this.copyButton.setAttr("aria-label", "Response copied");
      window.setTimeout(() => {
        if (!this.copyButton) return;
        this.copyButton.empty();
        setIcon(this.copyButton, "copy");
        this.copyButton.setAttr("aria-label", "Copy response as Markdown");
      }, 1_200);
    });
    if (this.block) this.setBlock(this.block);
  }

  /** Lightweight timer tick — only touches label textContent. No DOM rebuild. */
  tick(): void {
    this.updateLabel();
  }

  protected componentClass(): string {
    return "chatobby-text-block";
  }

  private updateLabel(): void {
    if (!this.labelEl || !this.block) return;
    if (this.block.status === "streaming") {
      if (this.block.startedAt) {
        this.labelEl.textContent = `Writing response ${formatDuration(Date.now() - this.block.startedAt)}`;
      } else {
        this.labelEl.textContent = "Writing response…";
      }
      this.labelEl.toggleClass("is-hidden", false);
    } else {
      this.labelEl.toggleClass("is-hidden", true);
    }
  }

  private renderMarkdown(): void {
    if (!this.contentEl || !this.block) return;
    this.contentEl.empty();
    const rendered = this.host.renderMarkdown(this.block.text, this.contentEl);
    decorateAfterMarkdown(this.contentEl, rendered, {
      openVaultLink: (path) => this.host.openVaultLink(path),
      openSystemPath: (path) => this.host.openSystemPath(path),
    });
  }

  private updateCopyButton(): void {
    this.copyButton?.toggleClass(
      "is-hidden",
      !this.block || this.block.status === "streaming" || this.block.text.trim().length === 0,
    );
  }
}
