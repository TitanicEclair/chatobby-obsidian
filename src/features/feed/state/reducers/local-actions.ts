import type { UserMessage } from "../../../../types";
import type { FeedAction } from "../actions";
import type { FeedTransaction } from "../feed-transaction";

type LocalAction = Extract<FeedAction,
  { type: "feed.user-prompt-submitted" | "feed.user-prompt-retracted" | "feed.local-feedback-appended" | "feed.queued-message-appended" }
>;

/** Reduces locally-originated prompt, feedback, and queue actions. */
export function reduceLocalFeedAction(transaction: FeedTransaction, action: LocalAction): void {
  switch (action.type) {
    case "feed.user-prompt-submitted": {
      if (action.startRun) transaction.beginRun();
      const message: UserMessage = { role: "user", content: [{ type: "text", text: action.text }] };
      transaction.addBlock({
        type: "user",
        id: transaction.allocateBlockId(),
        messageId: transaction.allocateId("message"),
        submissionId: action.submissionId,
        message,
      });
      transaction.appendPendingPromptEcho(normalizeText(action.text));
      return;
    }
    case "feed.user-prompt-retracted": {
      for (const id of transaction.orderedBlockIds()) {
        const block = transaction.getBlock(id);
        if (block?.type === "user" && block.submissionId === action.submissionId) {
          transaction.removeBlock(id);
          break;
        }
      }
      transaction.removePendingPromptEcho(normalizeText(action.text));
      transaction.completeRun();
      return;
    }
    case "feed.local-feedback-appended": {
      const userMessage: UserMessage = { role: "user", content: [{ type: "text", text: action.input }] };
      const systemMessage: UserMessage = { role: "user", content: [{ type: "text", text: action.guidance }] };
      transaction.addBlock({
        type: "user",
        id: transaction.allocateBlockId(),
        messageId: transaction.allocateId("message"),
        message: userMessage,
      });
      transaction.addBlock({
        type: "system",
        id: transaction.allocateBlockId(),
        messageId: transaction.allocateId("message"),
        message: systemMessage,
      });
      return;
    }
    case "feed.queued-message-appended":
      transaction.addBlock({
        type: "queued",
        id: transaction.allocateBlockId(),
        kind: action.kind,
        text: action.text,
        status: "pending",
      });
  }
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}
