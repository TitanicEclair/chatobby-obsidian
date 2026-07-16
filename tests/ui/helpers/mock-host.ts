import { vi } from "vitest";
import {
  blockId,
  hydrateFeedStore,
  INITIAL_LEGACY_FEED_STATE,
  migrateLegacyFeedState,
  toolCallId,
  type LegacyFeedState,
  type FeedStore,
} from "../../../src/features/feed/public";
import type { FeedHost } from "../../../src/ui/feed";
import type { InteractionHost } from "../../../src/ui/feed/interaction-card";
import type { InteractionState } from "../../../src/types";

export interface MockFeedHost extends FeedHost {
  setFeedState(state: LegacyFeedState): void;
}

export function createMockFeedHost(initialState: LegacyFeedState = INITIAL_LEGACY_FEED_STATE): MockFeedHost {
  let store = hydrateFeedStore(migrateLegacyFeedState(initialState));
  return {
    ...createMockFeedHostForStore(() => store),
    setFeedState: (state) => {
      store = hydrateFeedStore(migrateLegacyFeedState(state));
    },
  };
}

export function createMockFeedHostForStore(getFeedStore: () => FeedStore): FeedHost {
  return {
    app: {} as FeedHost["app"],
    component: {} as FeedHost["component"],
    getFeedStore,
    feedViewActions: {
      setScroll: (isAtBottom, scrollTop) => getFeedStore().dispatch({
        type: "feed.ui.scroll-changed",
        scroll: { isAtBottom, scrollTop },
      }),
      setThinkingDisplay: (id, mode) => getFeedStore().dispatch({
        type: "feed.ui.thinking-display-set",
        blockId: blockId(id),
        mode,
      }),
      setSummaryExpanded: (id, expanded) => getFeedStore().dispatch({
        type: "feed.ui.summary-toggled",
        blockId: blockId(id),
        expanded,
      }),
      setToolBlockExpanded: (id, expanded) => getFeedStore().dispatch({
        type: "feed.ui.tool-block-toggled",
        blockId: blockId(id),
        expanded,
      }),
      setToolExpanded: (id, expanded) => getFeedStore().dispatch({
        type: "feed.ui.tool-toggled",
        toolCallId: toolCallId(id),
        expanded,
      }),
    },
    getAutoScroll: () => true,
    getThinkingDisplay: () => "collapsed",
    renderMarkdown: vi.fn((markdown: string, container: HTMLElement) => {
      container.textContent = markdown;
    }),
    scrollFeed: vi.fn(),
    openVaultLink: vi.fn(),
    openSystemPath: vi.fn(),
    copyToClipboard: vi.fn(),
    onAutoScrollChange: vi.fn(),
    onCompactionRequest: vi.fn(),
  };
}

export function createMockInteractionHost(active: InteractionState | null = null): InteractionHost {
  return {
    getActiveInteraction: () => active,
    respond: vi.fn(),
    cancel: vi.fn(),
  };
}
