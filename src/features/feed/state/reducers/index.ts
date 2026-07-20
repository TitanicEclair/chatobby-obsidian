import type { FeedAction } from "../actions";
import type { FeedTransaction } from "../feed-transaction";
import { reduceDocumentProjection } from "./document-projection";
import { reduceExtensionPanelAction } from "./extension-panels";
import { reduceLocalFeedAction } from "./local-actions";
import { reduceTransportInterruption } from "./transport-interruption";
import { isFeedViewAction, reduceFeedViewAction } from "./ui-actions";

/** Routes a public feed action to one focused reducer module. */
export function reduceFeedAction(transaction: FeedTransaction, action: FeedAction): void {
  if (isFeedViewAction(action)) {
    reduceFeedViewAction(transaction, action);
    return;
  }
  switch (action.type) {
    case "feed.user-prompt-submitted":
    case "feed.user-prompt-retracted":
    case "feed.local-feedback-appended":
    case "feed.queued-message-appended":
    case "feed.queued-message-promoted":
      reduceLocalFeedAction(transaction, action);
      return;
    case "feed.document-projection-synchronized":
      reduceDocumentProjection(transaction, action.projection);
      return;
    case "feed.runtime-activity-synchronized":
      if (action.active) transaction.beginRun();
      else transaction.completeRun();
      return;
    case "feed.transport-interrupted":
      reduceTransportInterruption(transaction);
      return;
    case "feed.extension-panel-upserted":
    case "feed.extension-panel-removed":
      reduceExtensionPanelAction(transaction, action);
      return;
  }
}
