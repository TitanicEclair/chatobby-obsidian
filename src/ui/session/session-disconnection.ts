import type { SessionTab } from "../../features/session/public";
import type { TransportInterruption } from "../controller/connection-status-controller";

export interface DisconnectedSession {
  tab: SessionTab;
  interruption: TransportInterruption;
}

/** Clear backend-owned transient state while preserving the leaf's durable session identity. */
export function disconnectSession(tab: SessionTab): DisconnectedSession {
  tab.feedStore.dispatch({ type: "feed.transport-interrupted" });
  return {
    interruption: {
      hadActiveWork: tab.sessionState.isStreaming
        || tab.sessionState.isCompacting
        || tab.sessionState.isRetrying
        || tab.sessionState.activeTools.length > 0,
      hadInteraction: tab.activeInteraction !== null,
    },
    tab: {
      ...tab,
      activeInteraction: null,
      sessionState: {
        ...tab.sessionState,
        isStreaming: false,
        isCompacting: false,
        isRetrying: false,
        activeTools: [],
      },
    },
  };
}
