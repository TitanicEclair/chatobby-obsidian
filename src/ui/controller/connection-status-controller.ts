import type { FeedStore } from "../../features/feed/public";

export interface TransportInterruption {
  hadActiveWork: boolean;
  hadInteraction: boolean;
}

/** Projects meaningful transport interruption and recovery receipts into one replaceable feed notice. */
export class ConnectionStatusController {
  private recoveryPending = false;

  constructor(private readonly getFeedStore: () => FeedStore) {}

  markInterrupted(interruption: TransportInterruption): void {
    if (!interruption.hadActiveWork && !interruption.hadInteraction) return;
    this.recoveryPending = true;
    this.getFeedStore().dispatch({
      type: "feed.extension-panel-upserted",
      panel: {
        key: "runtime-connection-status",
        panelKind: "notice",
        title: "Connection interrupted",
        body: interruption.hadInteraction
          ? "A pending request was cancelled when Chatobby disconnected. The active session will be checked after reconnection."
          : "Chatobby disconnected during active work. The visible session will be checked after reconnection.",
        level: "warning",
        source: "Chatobby",
      },
    });
  }

  markRestored(): void {
    if (!this.recoveryPending) return;
    this.recoveryPending = false;
    this.getFeedStore().dispatch({
      type: "feed.extension-panel-upserted",
      panel: {
        key: "runtime-connection-status",
        panelKind: "notice",
        title: "Connection restored",
        body: "Chatobby reattached this tab to its visible session. You can continue here.",
        level: "info",
        source: "Chatobby",
      },
    });
  }
}
