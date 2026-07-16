import { setIcon } from "obsidian";
import type { CompactionBlock } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import type { FeedHost } from "./index";

export class CompactionBlockView extends ChatobbyComponent {
  private iconEl: HTMLElement | null = null;
  private labelEl: HTMLElement | null = null;
  private metaEl: HTMLElement | null = null;

  constructor(private readonly host: FeedHost, private block?: CompactionBlock) {
    super();
  }

  setBlock(block: CompactionBlock): void {
    this.block = block;
    if (block.status === "active") this.setActive(block.reason);
    else this.setDone(block.errorMessage);
  }

  setActive(reason?: string): void {
    this.container?.addClass("is-active");
    this.container?.removeClass("is-complete", "is-error");
    if (this.iconEl) setIcon(this.iconEl, "loader-circle");
    if (this.labelEl) this.labelEl.textContent = "Compacting context";
    if (this.metaEl) this.metaEl.textContent = reason ? reasonLabel(reason) : "Preparing a smaller session context";
  }

  setDone(errorMessage?: string): void {
    this.container?.removeClass("is-active");
    this.container?.addClass("is-complete");
    this.container?.toggleClass("is-error", Boolean(errorMessage));
    if (this.iconEl) setIcon(this.iconEl, errorMessage ? "circle-alert" : "circle-check");
    if (this.labelEl) this.labelEl.textContent = errorMessage ? "Compaction did not complete" : "Context compacted";
    if (this.metaEl) this.metaEl.textContent = errorMessage ?? "Older context was summarized for continuity";
  }

  protected onRender(container: HTMLElement): void {
    container.setAttr("role", "status");
    container.setAttr("aria-live", "polite");
    this.iconEl = container.createSpan({ cls: "chatobby-compaction-block__icon" });
    const copy = container.createDiv({ cls: "chatobby-compaction-block__copy" });
    this.labelEl = copy.createDiv({ cls: "chatobby-compaction-block__label" });
    this.metaEl = copy.createDiv({ cls: "chatobby-compaction-block__meta" });
    if (this.block) this.setBlock(this.block);
    void this.host;
  }

  protected componentClass(): string {
    return "chatobby-compaction-block";
  }
}

function reasonLabel(reason: string): string {
  if (reason === "threshold") return "Session context reached its model threshold";
  if (reason === "overflow") return "Recovering from the model context limit";
  if (reason === "manual") return "Started manually";
  return reason;
}
