import type { FeedStore } from "../../features/feed/public";
import type { AttachmentContent, WsPromptAttachment } from "../../types";
import { toFeedAttachment } from "./prompt-submission-controller";

type QueueKind = "steer" | "followUp";
type DeliveryStatus = "accepted" | "queued" | "started" | "promoted-to-prompt";

/** Keeps optimistic queue rows consistent when an idle runtime promotes input to a normal prompt. */
export async function deliverQueuedMessage(
  store: FeedStore,
  kind: QueueKind,
  text: string,
  attachments: readonly AttachmentContent[] | undefined,
  send: (message: string) => Promise<DeliveryStatus>,
): Promise<void> {
  store.dispatch({ type: "feed.queued-message-appended", kind, text, attachments });
  try {
    if (await send(text) === "promoted-to-prompt") {
      store.dispatch({ type: "feed.queued-message-promoted", kind, text });
    }
  } catch (error) {
    console.error(`Chatobby: ${kind} failed`, error);
  }
}

export async function deliverSteer(
  store: FeedStore,
  message: string,
  attachments: readonly WsPromptAttachment[] | undefined,
  send: (message: string, attachments?: WsPromptAttachment[]) => Promise<DeliveryStatus>,
): Promise<void> {
  await deliverQueuedMessage(
    store,
    "steer",
    message,
    attachments?.map(toFeedAttachment),
    (queuedMessage) => send(queuedMessage, attachments ? [...attachments] : undefined),
  );
}
