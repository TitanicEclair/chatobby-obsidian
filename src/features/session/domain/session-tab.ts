import type {
  ComposerState,
  InteractionState,
  PermissionMode,
  SessionState,
} from "../../../types";
import {
  EMPTY_SESSION_STATE,
  INITIAL_COMPOSER_STATE,
} from "../../../types";
import { createFeedStore, type FeedStore } from "../../feed/public";

/** Complete per-tab state. Each tab owns an isolated normalized feed store. */
export interface SessionTab {
  readonly sessionId: string;
  readonly sessionFile?: string;
  readonly name?: string;
  readonly sessionState: SessionState;
  readonly composerState: ComposerState;
  readonly permissionMode: PermissionMode;
  readonly feedStore: FeedStore;
  readonly activeInteraction: InteractionState | null;
  readonly createdAt: number;
}

/** Creates a fresh session tab while carrying only explicit user preferences forward. */
export function createSessionTab(sessionId: string, previousTab?: SessionTab): SessionTab {
  return {
    sessionId,
    sessionState: {
      ...EMPTY_SESSION_STATE,
      sessionId,
      model: previousTab?.sessionState.model ?? "",
      thinkingLevel: previousTab?.sessionState.thinkingLevel ?? "medium",
    },
    composerState: INITIAL_COMPOSER_STATE,
    permissionMode: previousTab?.permissionMode ?? "default",
    feedStore: createFeedStore(),
    activeInteraction: null,
    createdAt: Date.now(),
  };
}
