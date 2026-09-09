import type { FeedStore } from "../../features/feed/public";

/** Remove retained first-run feed panels; the welcome now lives in a native modal. */
export function removeOnboardingPanel(store: FeedStore): void {
  store.dispatch({ type: "feed.extension-panel-removed", key: "chatobby-first-run" });
}
