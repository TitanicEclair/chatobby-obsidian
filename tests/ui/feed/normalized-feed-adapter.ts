import type {
  AgentEvent,
  AgentMessage,
  ExtensionEvent,
  ExtensionPanelBlock,
} from "../../../src/types";
import {
  hydrateFeedStore,
  materializeLegacyFeedState,
  migrateLegacyFeedState,
  type LegacyFeedState,
} from "../../../src/features/feed/public";

/** Test-only adapter that keeps historical parity fixtures while exercising FeedStore reducers. */
export function applyFeedEvent(state: LegacyFeedState, event: AgentEvent): LegacyFeedState {
  return apply(state, { type: "feed.agent-event-received", event });
}

export function applyExtensionEvent(state: LegacyFeedState, event: ExtensionEvent): LegacyFeedState {
  return apply(state, { type: "feed.extension-event-received", event });
}

export function appendSubmittedUserPrompt(
  state: LegacyFeedState,
  text: string,
  _echoedText = text,
  options: { startRun?: boolean } = {},
): LegacyFeedState {
  return apply(state, {
    type: "feed.user-prompt-submitted",
    text,
    startRun: options.startRun !== false,
  });
}

export function appendLocalCommandFeedback(state: LegacyFeedState, input: string, guidance: string): LegacyFeedState {
  return apply(state, { type: "feed.local-feedback-appended", input, guidance });
}

export function appendExtensionPanel(
  state: LegacyFeedState,
  panel: Omit<ExtensionPanelBlock, "id" | "createdAt" | "type">,
): LegacyFeedState {
  return apply(state, { type: "feed.extension-panel-upserted", panel });
}

export function removeExtensionPanel(state: LegacyFeedState, key: string): LegacyFeedState {
  return apply(state, { type: "feed.extension-panel-removed", key });
}

export function messagesToFeedState(messages: readonly AgentMessage[]): LegacyFeedState {
  const store = hydrateFeedStore(migrateLegacyFeedState(emptyLegacyState()));
  store.dispatch({ type: "feed.history-loaded", messages });
  return materializeLegacyFeedState(store);
}

function apply(state: LegacyFeedState, action: Parameters<ReturnType<typeof createStore>["dispatch"]>[0]): LegacyFeedState {
  const store = createStore(state);
  store.dispatch(action);
  return materializeLegacyFeedState(store);
}

function createStore(state: LegacyFeedState) {
  return hydrateFeedStore(migrateLegacyFeedState(state));
}

function emptyLegacyState(): LegacyFeedState {
  return {
    blocks: [],
    nextSeq: 0,
    activeTurnId: null,
    completedTurnId: null,
    turnStartMs: null,
    runStartMs: null,
    runDurationMs: null,
    pendingUserEchoes: [],
    subagents: {},
    isAtBottom: true,
    scrollTop: 0,
  };
}
