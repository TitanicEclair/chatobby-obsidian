import { blockId, toolCallId } from "../../features/feed/public";
import type { FeedHost } from "./index";

export type FeedHostOptions = Omit<FeedHost, "feedViewActions">;

/** Builds the shared renderer host while routing every view mutation to the supplied store. */
export function createFeedHost(options: FeedHostOptions): FeedHost {
  return {
    ...options,
    feedViewActions: {
      setScroll: (isAtBottom, scrollTop) => options.getFeedStore().dispatch({
        type: "feed.ui.scroll-changed",
        scroll: { isAtBottom, scrollTop },
      }),
      setThinkingDisplay: (id, mode) => options.getFeedStore().dispatch({
        type: "feed.ui.thinking-display-set",
        blockId: blockId(id),
        mode,
      }),
      setSummaryExpanded: (id, expanded) => options.getFeedStore().dispatch({
        type: "feed.ui.summary-toggled",
        blockId: blockId(id),
        expanded,
      }),
      setToolBlockExpanded: (id, expanded) => options.getFeedStore().dispatch({
        type: "feed.ui.tool-block-toggled",
        blockId: blockId(id),
        expanded,
      }),
      setToolExpanded: (id, expanded) => options.getFeedStore().dispatch({
        type: "feed.ui.tool-toggled",
        toolCallId: toolCallId(id),
        expanded,
      }),
    },
  };
}
