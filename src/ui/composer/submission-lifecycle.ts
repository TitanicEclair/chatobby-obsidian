import type { ComposerDraftState } from "./draft-state";
import type { ComposerDraftSnapshot, RecoverableSubmission, PromptSubmissionHost } from "./types";
import type { SlashParsedCommand } from "./slash-command";
import type { ComposerVaultReference } from "./references/search";

/** DOM changes remain ordered by Composer; no detached snapshot of live input. */
export interface SubmissionView {
  captureDraft(): ComposerDraftSnapshot;
  clearDraft(revokeAttachments: boolean): void;
  restoreDraft(draft: ComposerDraftSnapshot): void;
  restoreStashedDraftIfComposerEmpty(): void;
  getReferences(): readonly ComposerVaultReference[];
  updateControls(): void;
  setStopping(stopping: boolean): void;
  disarmAbortConfirm(): void;
}

/** Pending/accepted/recoverable state belongs to the Composer instance, not a bind. */
export class ComposerSubmissionLifecycle {

  promptInFlight = false;
  slashCommandInFlight = false;
  private pendingSendAbort: AbortController | null = null;
  private pendingSubmissionDraft: ComposerDraftSnapshot | null = null;
  private pendingSubmissionDraftRestored = false;
  private pendingSendSequence = 0;
  private activePendingSendId: number | null = null;
  private recoverableSubmission: RecoverableSubmission | null = null;
  retractionPending = false;
  private committedTurnPending = false;
  constructor(private host: PromptSubmissionHost, private draft: ComposerDraftState, private view: SubmissionView) {}

  get hasActiveTurn(): boolean {
    return this.promptInFlight || this.recoverableSubmission !== null || this.retractionPending || this.committedTurnPending;
  }

  finishStreaming(): void {
    if (!this.retractionPending) this.commitRecoverableSubmission(false);
    this.committedTurnPending = false;
  }

  send(rawText: string, text: string, commands: SlashParsedCommand[]): void {
    this.setPromptInFlight(true);
    const pendingAbort = new AbortController();
    const pendingSendId = ++this.pendingSendSequence;
    this.pendingSendAbort = pendingAbort;
    this.activePendingSendId = pendingSendId;
    const submittedAttachmentIds = this.draft.state.attachments.map((attachment) => attachment.id);
    const submittedDraft = this.view.captureDraft();
    const recoverOnEarlyCancel = commands.length === 0;
    const submissionId = recoverOnEarlyCancel ? crypto.randomUUID() : undefined;
    const outputMarker = this.currentTurnOutputMarker();
    const attachments = submittedDraft.attachments.length > 0
      ? submittedDraft.attachments.map((attachment) => attachment.prompt)
      : undefined;
    const isSlashSubmission = commands.length > 0 && this.host.submitSlashPlan !== undefined;
    if (!isSlashSubmission) {
      this.pendingSubmissionDraft = submittedDraft;
      this.pendingSubmissionDraftRestored = false;
      // Clear before the transport publishes the optimistic feed block. Waiting
      // for prompt acceptance leaves the same text visible in both surfaces.
      this.view.clearDraft(false);
    }
    try {
      let slashAccepted = false;
      this.slashCommandInFlight = isSlashSubmission;
      const acceptSlashSubmission = () => {
        if (slashAccepted) return;
        slashAccepted = true;
        if (this.submittedDraftIsCurrent(rawText, submittedAttachmentIds)) {
          this.acceptSubmittedDraft(submittedDraft, outputMarker, undefined, false);
        }
        this.view.updateControls();
      };
      const result = isSlashSubmission
        ? this.host.submitSlashPlan?.({ text, commands, attachments }, acceptSlashSubmission)
        : this.host.send(text, attachments, pendingAbort.signal, submissionId);
      if (isPromiseLike(result)) {
        void Promise.resolve(result).then(
          (outcome) => {
            if (isSlashSubmission) {
              this.finishPendingSend(pendingSendId);
              return;
            }
            if (pendingAbort.signal.aborted) {
              if (outcome?.retracted !== false) {
                this.restorePendingSubmissionDraft();
                this.finishPendingSend(pendingSendId);
                return;
              }
              this.removeRestoredPendingDraft(rawText, submittedAttachmentIds);
              this.acceptSubmittedDraft(submittedDraft, outputMarker, undefined, true, true);
              this.finishPendingSend(pendingSendId);
              return;
            }
            this.acceptSubmittedDraft(submittedDraft, outputMarker, submissionId, false, true);
            this.finishPendingSend(pendingSendId);
          },
          (error) => {
            if (!pendingAbort.signal.aborted) console.error("Chatobby: pending send failed", error);
            this.restorePendingSubmissionDraft();
            this.finishPendingSend(pendingSendId);
          },
        );
      } else {
        if (!isSlashSubmission && !pendingAbort.signal.aborted) {
          this.acceptSubmittedDraft(submittedDraft, outputMarker, submissionId, false, true);
        }
        this.pendingSendAbort = null;
        this.pendingSubmissionDraft = null;
        this.pendingSubmissionDraftRestored = false;
        this.activePendingSendId = null;
        this.slashCommandInFlight = false;
        this.setPromptInFlight(false);
      }
    } catch (error) {
      this.restorePendingSubmissionDraft();
      this.pendingSendAbort = null;
      this.pendingSubmissionDraft = null;
      this.pendingSubmissionDraftRestored = false;
      this.activePendingSendId = null;
      this.slashCommandInFlight = false;
      this.setPromptInFlight(false);
      console.error("Chatobby: pending send failed", error);
    }
  }

  /** Abort the current generation. */
  stop(): void {
    this.view.disarmAbortConfirm();
    if (this.promptInFlight && !this.slashCommandInFlight) {
      this.pendingSendAbort?.abort();
      this.restorePendingSubmissionDraft();
      this.view.setStopping(true);
      return;
    }
    this.abortAcceptedTurn();
  }

  private setPromptInFlight(promptInFlight: boolean): void {
    this.promptInFlight = promptInFlight;
    if (!promptInFlight) this.view.disarmAbortConfirm();
    this.view.updateControls();
  }

  private submittedDraftIsCurrent(text: string, attachmentIds: readonly string[]): boolean {
    return this.draft.state.text === text
      && this.draft.state.attachments.length === attachmentIds.length
      && this.draft.state.attachments.every((attachment, index) => attachment.id === attachmentIds[index]);
  }

  private finishPendingSend(pendingSendId: number): void {
    if (this.activePendingSendId !== pendingSendId) return;
    this.pendingSendAbort = null;
    this.pendingSubmissionDraft = null;
    this.pendingSubmissionDraftRestored = false;
    this.activePendingSendId = null;
    this.slashCommandInFlight = false;
    this.setPromptInFlight(false);
    this.view.setStopping(false);
  }

  private acceptSubmittedDraft(
    draft: ComposerDraftSnapshot,
    outputMarker: string,
    submissionId: string | undefined,
    trackCommittedTurn: boolean,
    alreadyCleared = false,
  ): void {
    this.draft.resetHistoryNavigation();
    if (submissionId) {
      this.recoverableSubmission = { draft, outputMarker, submissionId };
      this.committedTurnPending = false;
      if (!alreadyCleared) this.view.clearDraft(false);
      this.view.restoreStashedDraftIfComposerEmpty();
      this.observeTurnProgress();
      return;
    }
    if (draft.text.trim()) this.draft.submittedPromptHistory.push(draft.text);
    this.committedTurnPending = trackCommittedTurn;
    if (alreadyCleared) {
      this.draft.releaseDraftAttachments(draft);
    } else {
      this.view.clearDraft(true);
    }
    this.view.restoreStashedDraftIfComposerEmpty();
  }

  private restorePendingSubmissionDraft(): void {
    const draft = this.pendingSubmissionDraft;
    if (!draft || this.pendingSubmissionDraftRestored) return;
    if (this.draft.state.text.length > 0 || this.draft.state.attachments.length > 0 || this.view.getReferences().length > 0) return;
    this.view.restoreDraft(draft);
    this.pendingSubmissionDraftRestored = true;
  }

  private removeRestoredPendingDraft(text: string, attachmentIds: readonly string[]): void {
    if (!this.pendingSubmissionDraftRestored || !this.submittedDraftIsCurrent(text, attachmentIds)) return;
    this.view.clearDraft(false);
    this.pendingSubmissionDraftRestored = false;
  }

  abortAcceptedTurn(): void {
    this.observeTurnProgress();
    const recoverable = this.recoverableSubmission;
    if (!recoverable || !this.host.retractPrompt) {
      this.commitRecoverableSubmission(true);
      this.host.abort();
      return;
    }

    this.retractionPending = true;
    this.view.setStopping(true);
    void this.host.retractPrompt(recoverable.submissionId, recoverable.draft.text).then(
      (result) => {
        this.retractionPending = false;
        if (result.retracted) {
          this.recoverableSubmission = null;
          this.committedTurnPending = false;
          if (this.draft.state.text.trim() || this.draft.state.attachments.length > 0 || this.view.getReferences().length > 0) {
            this.draft.replaceStashedDraft(this.view.captureDraft());
          }
          this.view.restoreDraft(recoverable.draft);
          this.view.setStopping(false);
          return;
        }
        this.commitRecoverableSubmission(true);
        if (result.reason !== "output-started") this.host.abort();
        this.view.updateControls();
      },
      (error) => {
        console.error("Chatobby: prompt retraction failed", error);
        this.retractionPending = false;
        this.commitRecoverableSubmission(true);
        this.host.abort();
      },
    );
  }

  /** Promote a recoverable send once a tool starts or assistant output completes. */
  observeTurnProgress(): void {
    if (this.retractionPending || !this.recoverableSubmission) return;
    if (this.currentTurnOutputMarker() === this.recoverableSubmission.outputMarker) return;
    this.commitRecoverableSubmission(true);
    this.view.updateControls();
  }

  private currentTurnOutputMarker(): string {
    return this.host.getTurnOutputMarker?.() ?? "";
  }

  private commitRecoverableSubmission(trackCommittedTurn: boolean): void {
    const recoverable = this.recoverableSubmission;
    if (!recoverable) return;
    this.recoverableSubmission = null;
    if (recoverable.draft.text.trim()) this.draft.submittedPromptHistory.push(recoverable.draft.text);
    this.draft.releaseDraftAttachments(recoverable.draft);
    this.committedTurnPending = trackCommittedTurn;
  }

  canRetractOnFirstEscape(): boolean {
    if (this.promptInFlight) return true;
    this.observeTurnProgress();
    return this.recoverableSubmission !== null;
  }
}

export function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
	return typeof value === "object" && value !== null && "then" in value;
}
