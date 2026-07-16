import type { FeedAction } from "../actions";
import type { FeedTransaction } from "../feed-transaction";

type PanelAction = Extract<FeedAction,
  { type: "feed.extension-panel-upserted" | "feed.extension-panel-removed" }
>;

/** Reduces replaceable extension panels without scanning unrelated blocks. */
export function reduceExtensionPanelAction(transaction: FeedTransaction, action: PanelAction): void {
  if (action.type === "feed.extension-panel-removed") {
    const existing = transaction.findExtensionPanelByKey(action.key);
    if (existing) transaction.removeBlock(existing);
    return;
  }

  const input = action.panel;
  const existing = input.key ? transaction.findExtensionPanelByKey(input.key) : undefined;
  const entity = {
    type: "extension-panel" as const,
    id: existing ?? transaction.allocateBlockId(),
    key: input.key,
    panelKind: input.panelKind,
    title: input.title,
    body: input.body,
    level: input.level,
    source: input.source,
    actions: input.actions ? [...input.actions] : undefined,
    createdAt: transaction.now(),
  };
  if (existing) transaction.updateBlock(existing, () => entity);
  else transaction.addBlock(entity);
}
