import type { FeedStore } from "../../features/feed/public";
import type { SessionTab } from "../../features/session/public";
import type { ComposerState, InteractionState } from "../../types";

export interface TabSwitchSnapshot {
  composer: ComposerState;
  feed: FeedStore;
  interaction: InteractionState | null;
}

export function switchTab(current: SessionTab, target: SessionTab): TabSwitchSnapshot {
  void current;
  return {
    composer: target.composerState,
    feed: target.feedStore,
    interaction: target.activeInteraction,
  };
}
