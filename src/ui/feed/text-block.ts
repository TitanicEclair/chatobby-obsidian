import { setIcon } from "obsidian";
import type { StopReason, TextBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { chatobbyPerformance } from "../../frontend/performance-monitor";
import { STREAM_MARKDOWN_RENDER_MS } from "../shared/constants";
import { formatDuration } from "../shared/format";
import { decorateAfterMarkdown } from "./decorations";
import type { FeedHost } from "./index";

export class TextBlockView extends ChatobbyComponent {
  private labelEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private copyButton: HTMLButtonElement | null = null;
  private markdownTimer: number | null = null;
  private selectionRetryTimer: number | null = null;
  private renderRevision = 0;
  private lastMarkdownRenderAt: number | null = null;

  constructor(private readonly host: FeedHost, private block?: TextBlock) {
    super();
  }

  setBlock(block: TextBlock): void {
    this.block = block;
    this.scheduleMarkdownRender(block.status !== "streaming");
    this.updateLabel();
    this.container?.toggleClass("is-streaming", block.status === "streaming");
    this.updateCopyButton();
  }

  setStreaming(text: string): void {
    if (this.block) this.block = { ...this.block, text, status: "streaming" };
    this.scheduleMarkdownRender(false);
    this.updateLabel();
    this.container?.addClass("is-streaming");
  }

  complete(stopReason?: StopReason): void {
    if (this.block) this.block = { ...this.block, status: "complete", stopReason };
    this.scheduleMarkdownRender(true);
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

  destroy(): void {
    this.cancelScheduledRender();
    this.renderRevision += 1;
    super.destroy();
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

  private scheduleMarkdownRender(force: boolean): void {
    if (!this.contentEl || !this.block) return;
    if (force) {
      this.cancelScheduledRender();
      this.renderMarkdownNow();
      return;
    }
    if (this.markdownTimer !== null) return;
    const elapsed = this.lastMarkdownRenderAt === null ? Number.POSITIVE_INFINITY : performance.now() - this.lastMarkdownRenderAt;
    if (elapsed >= STREAM_MARKDOWN_RENDER_MS) {
      this.renderMarkdownNow();
      return;
    }
    this.markdownTimer = window.setTimeout(() => {
      this.markdownTimer = null;
      this.renderMarkdownNow();
    }, STREAM_MARKDOWN_RENDER_MS - elapsed);
  }

  private renderMarkdownNow(): void {
    if (!this.contentEl || !this.block) return;
    const revision = ++this.renderRevision;
    const isFinal = this.block.status !== "streaming";
    const staging = this.contentEl.ownerDocument.createElement("div");
    const startedAt = performance.now();
    let rendered: void | Promise<void>;
    try {
      rendered = this.host.renderMarkdown(this.block.text, staging);
    } catch (error) {
      console.error("Chatobby: markdown render failed", error);
      return;
    }
    this.lastMarkdownRenderAt = startedAt;
    const finish = () => {
      chatobbyPerformance.recordMarkdownRender(performance.now() - startedAt);
      if (revision !== this.renderRevision || !this.contentEl) return;
      decorateAfterMarkdown(staging, undefined, {
        openVaultLink: (path) => this.host.openVaultLink(path),
        openSystemPath: (path) => this.host.openSystemPath(path),
      });
      this.commitRenderedMarkdown(staging, revision, isFinal);
    };
    if (rendered instanceof Promise) {
      void rendered.then(finish).catch((error: unknown) => {
        if (revision === this.renderRevision) console.error("Chatobby: markdown render failed", error);
      });
      return;
    }
    finish();
  }

  private commitRenderedMarkdown(staging: HTMLElement, revision: number, isFinal: boolean): void {
    if (!this.contentEl || revision !== this.renderRevision) return;
    if (!isFinal && selectionIntersects(this.contentEl)) {
      if (this.selectionRetryTimer !== null) window.clearTimeout(this.selectionRetryTimer);
      this.selectionRetryTimer = window.setTimeout(() => {
        this.selectionRetryTimer = null;
        this.commitRenderedMarkdown(staging, revision, false);
      }, 100);
      return;
    }
    this.contentEl.replaceChildren(...Array.from(staging.childNodes));
  }

  private cancelScheduledRender(): void {
    if (this.markdownTimer !== null) window.clearTimeout(this.markdownTimer);
    if (this.selectionRetryTimer !== null) window.clearTimeout(this.selectionRetryTimer);
    this.markdownTimer = null;
    this.selectionRetryTimer = null;
  }

  private updateCopyButton(): void {
    this.copyButton?.toggleClass(
      "is-hidden",
      !this.block || this.block.status === "streaming" || this.block.text.trim().length === 0,
    );
  }
}

function selectionIntersects(container: HTMLElement): boolean {
  const selection = container.ownerDocument.defaultView?.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return range.intersectsNode(container);
}
