// ToolBlockView — a stack of ToolItemView rows. No "Tools" header; each tool call is its own
// compact, individually-expandable row (see ToolItemView). The block is just a container.

import type { ToolBlock, ToolItem } from "../../../types";
import { ChatobbyComponent } from "../../shared/component";
import type { FeedHost } from "../index";
import { ToolItemView } from "./tool-item";

export class ToolBlockView extends ChatobbyComponent {
  private itemsEl: HTMLElement | null = null;
  private views = new Map<string, ToolItemView>();

  constructor(private readonly host: FeedHost, private block?: ToolBlock) {
    super();
  }

  setBlock(block: ToolBlock): void {
    this.block = block;
    if (this.itemsEl) this.syncItems(block.items);
  }

  addItem(item: ToolItem): void {
    if (!this.itemsEl) return;
    const view = new ToolItemView(this.host, item);
    view.render(this.itemsEl);
    this.views.set(item.id, view);
  }

  updateItem(id: string, patch: Partial<ToolItem>): void {
    const view = this.views.get(id);
    if (!view) return;
    if (patch.status) view.setStatus(patch.status);
    if (patch.arguments !== undefined) view.setArgs(patch.arguments);
    if (patch.result !== undefined) view.setResult(patch.result, patch.isError ?? false);
    if (patch.isExpanded !== undefined) view.setExpanded(patch.isExpanded);
  }

  protected onRender(container: HTMLElement): void {
    this.itemsEl = container.createDiv({ cls: "chatobby-tool-block__items" });
    if (this.block) this.syncItems(this.block.items);
  }

  protected componentClass(): string {
    return "chatobby-tool-block";
  }

  /** Incremental sync: patch changed items, add new ones, remove stale ones. */
  private syncItems(items: readonly ToolItem[]): void {
    if (!this.itemsEl) return;
    const nextIds = new Set(items.map((i) => i.id));

    // Remove views for items no longer present.
    for (const [id, view] of this.views) {
      if (!nextIds.has(id)) { view.destroy(); this.views.delete(id); }
    }

    // Patch existing or create new.
    for (const item of items) {
      const existing = this.views.get(item.id);
      if (existing) {
        existing.sync(item);
      } else {
        this.addItem(item);
      }
    }
  }
}
