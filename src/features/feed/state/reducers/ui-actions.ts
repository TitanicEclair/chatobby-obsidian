import type { FeedViewAction } from "../actions";
import type { FeedTransaction } from "../feed-transaction";

/** Applies presentation-only actions without changing feed document revision. */
export function reduceFeedViewAction(transaction: FeedTransaction, action: FeedViewAction): void {
  switch (action.type) {
    case "feed.ui.summary-toggled":
      transaction.setSummaryExpanded(action.blockId, action.expanded);
      return;
    case "feed.ui.tool-block-toggled":
      transaction.setToolBlockExpanded(action.blockId, action.expanded);
      return;
    case "feed.ui.tool-toggled":
      transaction.setToolExpanded(action.toolCallId, action.expanded);
      return;
    case "feed.ui.thinking-display-set":
      transaction.setThinkingOverride(action.blockId, action.mode);
      return;
    case "feed.ui.scroll-changed":
      transaction.setScroll(action.scroll);
  }
}

export function isFeedViewAction(action: { type: string }): action is FeedViewAction {
  return action.type.startsWith("feed.ui.");
}
