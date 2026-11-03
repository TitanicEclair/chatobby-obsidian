import type { WsPromptAttachment } from "../../vendor/chatobby-client/connector-types.js";
import type { SlashActivation, SlashSubmitPlan } from "./slash-command";
import type { ComposerVaultReference } from "./references/search";

/** Composer input state. Owned by the Composer component. */
export interface ComposerState {
  text: string;
  attachments: ComposerAttachment[];
  isFocused: boolean;
}

export const INITIAL_COMPOSER_STATE: ComposerState = {
  text: "",
  attachments: [],
  isFocused: false,
};

export type ComposerAttachmentDelivery = "image" | "document" | "text" | "file";

export interface ComposerAttachment {
  id: string;
  name: string;
  prompt: WsPromptAttachment;
  delivery: ComposerAttachmentDelivery;
  previewUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  localPath?: string;
}

export interface ComposerDraftSnapshot {
  text: string;
  attachments: ComposerAttachment[];
  activations: SlashActivation[];
  references: ComposerVaultReference[];
}

export interface RecoverableSubmission {
  draft: ComposerDraftSnapshot;
  outputMarker: string;
  submissionId: string;
}

/** Result of starting a prompt whose pending cancellation may have raced with acceptance. */
export interface PromptSubmissionOutcome {
  retracted?: boolean;
  retractionReason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed";
}

/** Submission callbacks retain the original view host as their receiver. */
export interface PromptSubmissionHost {
  /** Send a message with optional attachments. */
  send(
    message: string,
    attachments?: WsPromptAttachment[],
    signal?: AbortSignal,
    submissionId?: string,
  ): void | PromptSubmissionOutcome | Promise<void | PromptSubmissionOutcome>;
  /** Abort the current generation. */
  abort(): void;
  /** Retract a specific prompt before visible response output begins. */
  retractPrompt?(
    submissionId: string,
    message: string,
  ): Promise<{ retracted: boolean; reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed" }>;
  /** Stable representation of visible non-user output for early-cancel recovery. */
  getTurnOutputMarker?(): string;
  /** Execute activated slash commands and any remaining prompt text. */
  submitSlashPlan?(plan: SlashSubmitPlan, onAccepted: () => void): void | Promise<void>;
}
