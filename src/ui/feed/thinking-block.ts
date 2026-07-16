// ThinkingBlockView — the model's reasoning. Folds as soon as it finishes:
//   streaming  → expanded, header "Thinking…"
//   complete   → collapsed, header "Thought for Xs" (click to re-expand)
// Never holds response text (that's a separate TextBlock).

import type { ThinkingBlock, ThinkingDisplayMode } from "../../types";
import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../shared/component";
import { formatDuration } from "../shared/format";
import type { FeedHost } from "./index";

export class ThinkingBlockView extends ChatobbyComponent {
  private labelEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;

  constructor(private readonly host: FeedHost, private block?: ThinkingBlock) {
    super();
  }

  setBlock(block: ThinkingBlock): void {
    this.block = block;
    this.renderText();
    this.updateLabel();
    // Streaming reasoning stays open so the user can read along; completed reasoning folds.
    this.setDisplayMode(block.displayMode ?? (block.status === "streaming" ? "expanded" : this.host.getThinkingDisplay()));
    this.container?.toggleClass("is-streaming", block.status === "streaming");
  }

  setStreaming(text: string): void {
    if (this.block) this.block = { ...this.block, text, status: "streaming" };
    this.renderText();
    this.updateLabel();
    this.setDisplayMode(this.block?.displayMode ?? "expanded");
    this.container?.addClass("is-streaming");
  }

  complete(durationMs?: number): void {
    if (this.block) this.block = { ...this.block, status: "complete", durationMs: durationMs ?? this.block.durationMs };
    this.updateLabel();
    this.container?.removeClass("is-streaming");
    this.setDisplayMode(this.block?.displayMode ?? this.host.getThinkingDisplay());
  }

  setDisplayMode(mode: ThinkingDisplayMode): void {
    this.container?.toggleClass("is-collapsed", mode === "collapsed");
    this.container?.toggleClass("is-hidden", mode === "hidden");
  }

  toggleExpanded(): void {
    if (!this.container || !this.block) return;
    const mode: ThinkingDisplayMode = this.container.hasClass("is-collapsed") ? "expanded" : "collapsed";
    this.setDisplayMode(mode);
    this.persistDisplayMode(mode);
  }

  protected onRender(container: HTMLElement): void {
    const header = container.createDiv({ cls: "chatobby-thinking-block__header" });
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    const iconEl = header.createSpan({ cls: "chatobby-thinking-block__icon" });
    setIcon(iconEl, "brain");
    this.labelEl = header.createSpan({ cls: "chatobby-thinking-block__label" });
    const chevron = header.createSpan({ cls: "chatobby-thinking-block__chevron" });
    setIcon(chevron, "chevron-down");
    header.onclick = () => this.toggleExpanded();
    header.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.toggleExpanded();
      }
    };
    this.bodyEl = container.createDiv({ cls: "chatobby-thinking-block__body" });
    if (this.block) this.setBlock(this.block);
  }

  /** Lightweight timer tick — only touches label textContent. No DOM rebuild. */
  tick(): void {
    this.updateLabel();
  }

  protected componentClass(): string {
    return "chatobby-thinking-block";
  }

  private updateLabel(): void {
    if (!this.labelEl || !this.block) return;
    if (this.block.status === "streaming") {
      this.labelEl.textContent = this.block.startedAt ? `Thinking ${formatDuration(Date.now() - this.block.startedAt)}` : "Thinking…";
    } else if (this.block.durationMs) {
      this.labelEl.textContent = `Thought for ${formatDuration(this.block.durationMs)}`;
    } else {
      this.labelEl.textContent = "Thought";
    }
  }

  private renderText(): void {
    if (!this.bodyEl || !this.block) return;
    if (this.bodyEl.textContent !== this.block.text) this.bodyEl.textContent = this.block.text;
  }

  private persistDisplayMode(mode: ThinkingDisplayMode): void {
    if (!this.block) return;
    this.host.feedViewActions.setThinkingDisplay(this.block.id, mode);
  }
}
