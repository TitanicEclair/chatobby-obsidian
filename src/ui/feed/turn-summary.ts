// TurnSummaryView — the collapsed "Worked for X" line that rolls up intermediate work once a
// final response is confirmed. First expansion shows an ordered trace: intermediate text,
// collapsed thinking, and collapsed tool groups. Tool groups can then expand into individual
// tool-call rows.
//
// Collapsed (default): [brain icon] Worked for 1m 18s [▸]
// Expanded: text blocks render normally; thinking/tool groups stay compressed until clicked.

import { setIcon } from "obsidian";
import type { ToolBlock, ToolItem, TurnSummary } from "../../types";
import { ChatobbyComponent } from "../shared/component";
import type { FeedHost } from "./index";
import { ThinkingBlockView } from "./thinking-block";
import { TextBlockView } from "./text-block";
import { ToolBlockView } from "./tools/tool-block";

export class TurnSummaryView extends ChatobbyComponent {
  private labelEl: HTMLElement | null = null;
  private detailsEl: HTMLElement | null = null;

  constructor(private readonly host: FeedHost, private summary?: TurnSummary) {
    super();
  }

  setSummary(summary: TurnSummary): void {
    this.summary = summary;
    if (this.labelEl) this.labelEl.textContent = summary.text;
    this.renderDetails();
    this.syncExpandedState();
  }

  toggleExpanded(): void {
    if (!this.summary) return;
    const expanded = !this.summary.isExpanded;
    this.summary = { ...this.summary, isExpanded: expanded };
    this.updateSummaryExpansion(expanded);
    this.syncExpandedState();
  }

  protected onRender(container: HTMLElement): void {
    const header = container.createDiv({ cls: "chatobby-turn-summary__header" });
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "false");
    const iconEl = header.createSpan({ cls: "chatobby-turn-summary__icon" });
    setIcon(iconEl, "brain");
    this.labelEl = header.createSpan({ cls: "chatobby-turn-summary__text" });
    const chevron = header.createSpan({ cls: "chatobby-turn-summary__chevron" });
    setIcon(chevron, "chevron-down");
    header.onclick = () => this.toggleExpanded();
    header.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.toggleExpanded();
      }
    };
    this.detailsEl = container.createDiv({ cls: "chatobby-turn-summary__details" });
    if (this.summary) this.setSummary(this.summary);
  }

  protected componentClass(): string {
    return "chatobby-turn-summary";
  }

  private renderDetails(): void {
    if (!this.detailsEl || !this.summary) return;
    this.detailsEl.empty();
    for (const block of this.summary.blocks) {
      const child = this.detailsEl.createDiv({ cls: `chatobby-turn-summary__child chatobby-turn-summary__child--${block.type}` });
      if (block.type === "thinking") {
        new ThinkingBlockView(this.host, { ...block, displayMode: block.displayMode ?? "collapsed" }).render(child);
      } else if (block.type === "tools") {
        this.renderToolGroup(child, block);
      } else if (block.type === "text") {
        new TextBlockView(this.host, block).render(child);
      }
    }
    this.syncExpandedState();
  }

  private renderToolGroup(container: HTMLElement, block: ToolBlock): void {
    const header = container.createDiv({ cls: "chatobby-turn-summary__tool-header" });
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    const iconEl = header.createSpan({ cls: "chatobby-turn-summary__tool-icon" });
    setIcon(iconEl, "wrench");
    const summary = summarizeProjectedTools(block.items);
    header.createSpan({
      cls: "chatobby-turn-summary__tool-text",
      text: summary.length > 0 ? summary.join(" · ") : "Tool calls",
    });
    const chevron = header.createSpan({ cls: "chatobby-turn-summary__tool-chevron" });
    setIcon(chevron, "chevron-down");
    const body = container.createDiv({ cls: "chatobby-turn-summary__tool-body" });
    new ToolBlockView(this.host, block).render(body);
    container.toggleClass("is-tool-expanded", block.isExpanded);
    header.setAttribute("aria-expanded", String(block.isExpanded));
    const toggle = () => {
      const expanded = !container.hasClass("is-tool-expanded");
      container.toggleClass("is-tool-expanded", expanded);
      header.setAttribute("aria-expanded", String(expanded));
      this.updateToolBlockExpansion(block.id, expanded);
    };
    header.onclick = toggle;
    header.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    };
  }

  private syncExpandedState(): void {
    if (!this.summary) return;
    this.container?.toggleClass("is-expanded", this.summary.isExpanded);
    this.container?.querySelector(".chatobby-turn-summary__header")?.setAttribute("aria-expanded", String(this.summary.isExpanded));
  }

  private updateSummaryExpansion(expanded: boolean): void {
    if (!this.summary) return;
    this.host.feedViewActions.setSummaryExpanded(this.summary.id, expanded);
  }

  private updateToolBlockExpansion(toolBlockId: string, expanded: boolean): void {
    this.host.feedViewActions.setToolBlockExpanded(toolBlockId, expanded);
  }
}

function summarizeProjectedTools(items: readonly ToolItem[]): readonly string[] {
  const groups = new Map<string, { title: string; count: number }>();
  for (const item of items) {
    const current = groups.get(item.semanticKind);
    if (current) current.count += 1;
    else groups.set(item.semanticKind, { title: item.displayTitle, count: 1 });
  }
  return [...groups.values()].map(({ title, count }) => count === 1 ? title : `${title} (${count})`);
}
