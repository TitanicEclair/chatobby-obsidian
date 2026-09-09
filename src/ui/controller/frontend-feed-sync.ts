import type { FeedStore } from "../../features/feed/public";
import { toFeedDocumentProjection } from "../../frontend/feed-adapter";
import type { FrontendBootstrap } from "../../vendor/chatobby-client/frontend-contracts.js";
import { removeOnboardingPanel } from "./onboarding-panel-controller";

export function synchronizeFrontendFeed(
  store: FeedStore,
  snapshot: FrontendBootstrap,
): void {
  store.dispatch({
    type: "feed.document-projection-synchronized",
    projection: toFeedDocumentProjection(snapshot.feed),
  });
  removeOnboardingPanel(store);
}
