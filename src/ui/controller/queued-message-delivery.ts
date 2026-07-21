import type { FeedStore } from "../../features/feed/public";

type QueueKind = "steer" | "followUp";
type DeliveryStatus = "accepted" | "queued" | "started" | "promoted-to-prompt";

/** Keeps optimistic queue rows consistent when an idle runtime promotes input to a normal prompt. */
export async function deliverQueuedMessage(
  store: FeedStore,
  kind: QueueKind,
  text: string,
  send: (message: string) => Promise<DeliveryStatus>,
): Promise<void> {
  store.dispatch({ type: "feed.queued-message-appended", kind, text });
  try {
    if (await send(text) === "promoted-to-prompt") {
      store.dispatch({ type: "feed.queued-message-promoted", kind, text });
    }
  } catch (error) {
    console.error(`Chatobby: ${kind} failed`, error);
  }
}
