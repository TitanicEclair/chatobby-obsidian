import type { DividerBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import { formatDuration } from "../shared/format";

/**
 * Centered single-line status rule used for compaction, fork, and clone
 * receipts. The rule stretches edge-to-edge in the faintest text color; the
 * label sits centered on it in the muted text color. When `animated`, a
 * cycling ellipsis follows the label (live compaction).
 */
export class DividerBlockView extends ChatobbyComponent {
  private activityEl: HTMLElement | null = null;
  private activityLabelEl: HTMLElement | null = null;
  private activityDetailEl: HTMLElement | null = null;
  private labelTextEl: HTMLElement | null = null;
  private dotsEl: HTMLElement | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;

  constructor(private block?: DividerBlock) {
    super();
  }

  setBlock(block: DividerBlock): void {
    this.block = block;
    this.apply(block);
  }

  private apply(block: DividerBlock): void {
    if (!this.container) return;
    this.container.toggleClass("is-error", block.tone === "error");
    if (this.labelTextEl) this.labelTextEl.textContent = block.label;
    if (this.dotsEl) this.dotsEl.toggleClass("is-animated", Boolean(block.animated));
    const hasActivity = block.activityStartedAt !== undefined;
    this.activityEl?.toggleClass("is-hidden", !hasActivity);
    if (this.activityDetailEl) {
      this.activityDetailEl.textContent = block.detail ?? "";
      this.activityDetailEl.toggleClass("is-hidden", !block.detail);
    }
    this.syncClock(block);
  }

  protected onRender(container: HTMLElement): void {
    container.setAttr("role", "status");
    container.setAttr("aria-live", "polite");
    this.activityEl = container.createDiv({ cls: "chatobby-divider-block__activity is-hidden" });
    this.activityLabelEl = this.activityEl.createDiv({ cls: "chatobby-divider-block__activity-label" });
    this.activityDetailEl = this.activityEl.createDiv({ cls: "chatobby-divider-block__activity-detail is-hidden" });
    const ruleRow = container.createDiv({ cls: "chatobby-divider-block__rule-row" });
    ruleRow.createSpan({ cls: "chatobby-divider-block__rule" });
    const label = ruleRow.createSpan({ cls: "chatobby-divider-block__label" });
    this.labelTextEl = label.createSpan({ cls: "chatobby-divider-block__label-text" });
    this.dotsEl = label.createSpan({ cls: "chatobby-divider-block__dots" });
    ruleRow.createSpan({ cls: "chatobby-divider-block__rule" });
    if (this.block) this.apply(this.block);
  }

  override destroy(): void {
    this.stopClock();
    super.destroy();
  }

  private syncClock(block: DividerBlock): void {
    this.stopClock();
    this.renderElapsed(block);
    if (block.activityStartedAt !== undefined && block.activityEndedAt === undefined) {
      this.clock = setInterval(() => this.renderElapsed(this.block), 1_000);
    }
  }

  private renderElapsed(block: DividerBlock | undefined): void {
    if (!block || block.activityStartedAt === undefined || !this.activityLabelEl) return;
    const end = block.activityEndedAt ?? Date.now();
    const duration = formatDuration(Math.max(0, end - block.activityStartedAt));
    if (block.activityEndedAt === undefined) {
      this.activityLabelEl.textContent = `${block.activityLabel ?? "Working"} for ${duration}`;
    } else if (block.tone === "done") {
      this.activityLabelEl.textContent = `Compacted in ${duration}`;
    } else {
      this.activityLabelEl.textContent = `Compaction stopped after ${duration}`;
    }
  }

  private stopClock(): void {
    if (this.clock) clearInterval(this.clock);
    this.clock = null;
  }

  protected componentClass(): string {
    return "chatobby-divider-block";
  }
}
