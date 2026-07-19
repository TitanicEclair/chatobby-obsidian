import type { FeedStore } from "../../features/feed/public";
import type { WsPromptAttachment, WsPromptContextPacket } from "../../types";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type { PromptSubmissionOutcome } from "../composer/composer";
import { withTimeout } from "./view-utils";

export const PROMPT_START_TIMEOUT_MS = 30_000;
type PromptTransport = Pick<ChatobbyTransport, "isConnected" | "prompt" | "retractPrompt">;
type PromptFeedStore = Pick<FeedStore, "dispatch">;

interface SubmitPromptOptions {
  readonly transport: PromptTransport;
  readonly feedStore: PromptFeedStore;
  readonly message: string;
  readonly attachments?: WsPromptAttachment[];
  readonly context?: WsPromptContextPacket;
  readonly signal?: AbortSignal;
  readonly submissionId?: string;
}

export async function submitPrompt(options: SubmitPromptOptions): Promise<PromptSubmissionOutcome | undefined> {
  const { transport, feedStore, message, attachments, context, signal, submissionId } = options;
  feedStore.dispatch({
    type: "feed.user-prompt-submitted",
    text: message,
    startRun: true,
    submissionId,
  });

  const status = await withTimeout(
    transport.prompt(message, attachments, context, submissionId),
    PROMPT_START_TIMEOUT_MS,
    "Prompt did not start",
  );
  if (!submissionId || (!signal?.aborted && status !== "retracted")) return undefined;
  if (status === "retracted") {
    removeLocalPromptSubmission(feedStore, submissionId, message);
    return { retracted: true };
  }
  const retraction = await retractAcceptedPrompt(transport, feedStore, submissionId, message);
  return { retracted: retraction.retracted, retractionReason: retraction.reason };
}

export async function retractAcceptedPrompt(
  transport: PromptTransport | null,
  feedStore: PromptFeedStore,
  submissionId: string,
  message: string,
): Promise<{ retracted: boolean; reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed" }> {
  if (!transport?.isConnected) return { retracted: false, reason: "not-found" };
  const result = await transport.retractPrompt(submissionId);
  if (result.retracted) removeLocalPromptSubmission(feedStore, submissionId, message);
  return result;
}

function removeLocalPromptSubmission(feedStore: PromptFeedStore, submissionId: string, message: string): void {
  feedStore.dispatch({
    type: "feed.user-prompt-retracted",
    submissionId,
    text: message,
  });
}
