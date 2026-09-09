import type { FeedStore } from "../../features/feed/public";
import type {
  AttachmentContent,
  WsPromptAttachment,
  WsPromptContextPacket,
} from "../../types";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type { PromptSubmissionOutcome } from "../composer/composer";
import { gatherAuthorizedPromptContext } from "../../prompt/authorized-context";

type PromptTransport = Pick<
  ChatobbyTransport,
  "isConnected" | "prompt" | "retractPrompt"
>;
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

interface AuthorizedPromptOptions extends Omit<SubmitPromptOptions, "context"> {
  readonly readTarget: () => { sessionId?: string; runtimeInstanceId?: string } | undefined;
  readonly canCollect: () => boolean;
  readonly readStamp: ChatobbyTransport["getObsidianVaultAccessContext"];
  readonly gather: () => WsPromptContextPacket;
}

/** Keep passive collection and the final dispatch bound to the same live target. */
export async function submitAuthorizedPrompt(
  options: AuthorizedPromptOptions,
): Promise<PromptSubmissionOutcome | undefined> {
  const target = options.readTarget();
  if (!target?.sessionId) throw new Error("No active Chatobby session is available.");
  const isCurrentTarget = () => {
    const current = options.readTarget();
    return current?.sessionId === target.sessionId && current?.runtimeInstanceId === target.runtimeInstanceId;
  };
  const context = await gatherAuthorizedPromptContext({
    sessionId: target.sessionId,
    readStamp: () => options.canCollect() ? options.readStamp() : Promise.resolve(undefined),
    isCurrentTarget, gather: options.gather, signal: options.signal,
  });
  if (options.signal?.aborted) return undefined;
  if (!isCurrentTarget()) throw new Error("The active chat changed before the prompt was sent. Try again in the intended chat.");
  return submitPrompt({ ...options, context: options.canCollect() ? context : undefined });
}

export async function submitPrompt(
  options: SubmitPromptOptions,
): Promise<PromptSubmissionOutcome | undefined> {
  const {
    transport,
    feedStore,
    message,
    attachments,
    context,
    signal,
    submissionId,
  } = options;
  feedStore.dispatch({
    type: "feed.user-prompt-submitted",
    text: message,
    attachments: attachments?.map(toFeedAttachment),
    startRun: true,
    submissionId,
  });

  // The generated transport owns the canonical lifecycle deadline. A prompt
  // can be accepted immediately before or during automatic compaction, so a
  // second connector timer would report a false failure while the runtime is
  // correctly preparing the queued turn.
  const status = await transport.prompt(
    message,
    attachments,
    context,
    submissionId,
  );
  if (!submissionId || (!signal?.aborted && status !== "retracted"))
    return undefined;
  if (status === "retracted") {
    removeLocalPromptSubmission(feedStore, submissionId, message);
    return { retracted: true };
  }
  const retraction = await retractAcceptedPrompt(
    transport,
    feedStore,
    submissionId,
    message,
  );
  return {
    retracted: retraction.retracted,
    retractionReason: retraction.reason,
  };
}

/** Reconcile connector-owned optimistic progress with authoritative runtime activity. */
export function recordPromptFailure(
  feedStore: PromptFeedStore,
  input: string,
  guidance: string,
  runtimeActive: boolean,
): void {
  feedStore.dispatch({ type: "feed.runtime-activity-synchronized", active: runtimeActive });
  feedStore.dispatch({ type: "feed.local-feedback-appended", input, guidance });
}

export function toFeedAttachment(
  attachment: WsPromptAttachment,
): AttachmentContent {
  if (attachment.type === "image") {
    return {
      type: "attachment",
      name: attachment.name ?? "Attached image",
      kind: "image",
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      data: attachment.data,
    };
  }
  return {
    type: "attachment",
    name:
      attachment.name ??
      attachment.path.split(/[\\/]/u).at(-1) ??
      "Attached file",
    kind: attachmentKind(attachment),
    mimeType: attachment.mimeType,
    path: attachment.path,
    sizeBytes: attachment.sizeBytes,
  };
}

function attachmentKind(
  attachment: Extract<WsPromptAttachment, { type: "file_ref" }>,
): AttachmentContent["kind"] {
  if (attachment.mimeType?.startsWith("image/")) return "image";
  if (attachment.mimeType?.startsWith("text/")) return "text";
  const extension = /\.([^.]+)$/u
    .exec(attachment.name ?? attachment.path)?.[1]
    ?.toLowerCase();
  return extension && TEXT_ATTACHMENT_EXTENSIONS.has(extension)
    ? "text"
    : "binary";
}

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "csv",
  "dart",
  "go",
  "h",
  "hpp",
  "htm",
  "html",
  "java",
  "js",
  "json",
  "jsonc",
  "jsx",
  "log",
  "lua",
  "md",
  "php",
  "ps1",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "svg",
  "toml",
  "ts",
  "tsv",
  "tsx",
  "txt",
  "vue",
  "xml",
  "yaml",
  "yml",
  "zsh",
]);

export async function retractAcceptedPrompt(
  transport: PromptTransport | null,
  feedStore: PromptFeedStore,
  submissionId: string,
  message: string,
): Promise<{
  retracted: boolean;
  reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed";
}> {
  if (!transport?.isConnected) return { retracted: false, reason: "not-found" };
  const result = await transport.retractPrompt(submissionId);
  if (result.retracted)
    removeLocalPromptSubmission(feedStore, submissionId, message);
  return result;
}

function removeLocalPromptSubmission(
  feedStore: PromptFeedStore,
  submissionId: string,
  message: string,
): void {
  feedStore.dispatch({
    type: "feed.user-prompt-retracted",
    submissionId,
    text: message,
  });
}
