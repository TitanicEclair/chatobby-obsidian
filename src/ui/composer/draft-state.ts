import { revokeComposerAttachment } from "../../attachments/attachment-store";
import { INITIAL_COMPOSER_STATE, type ComposerDraftSnapshot } from "./types";
import type { SlashActivation } from "./slash-command";
import type { ComposerVaultReference } from "./references/search";

/** One instance owns current, stashed and submitted draft references across binds. */
export class ComposerDraftState {
  state = createInitialComposerState();
  activations: SlashActivation[] = [];
  readonly submittedPromptHistory: string[] = [];
  historyIndex: number | null = null;
  private historyDraft = "";
  stashedDraft: ComposerDraftSnapshot | null = null;

  resetCurrent(): void { this.state = createInitialComposerState(); }

  captureDraft(references: readonly ComposerVaultReference[]): ComposerDraftSnapshot {
    return {
      text: this.state.text,
      attachments: [...this.state.attachments],
      activations: this.activations.map((activation) => ({ ...activation })),
      references: [...references],
    };
  }

  replaceStashedDraft(draft: ComposerDraftSnapshot): void {
    if (this.stashedDraft) this.releaseDraftAttachments(this.stashedDraft);
    this.stashedDraft = draft;
  }

  resetHistoryNavigation(): void {
    this.historyIndex = null;
    this.historyDraft = "";
  }

  releaseDraftAttachments(draft: ComposerDraftSnapshot): void {
    for (const attachment of draft.attachments) revokeComposerAttachment(attachment);
  }

  recallPreviousMessage(remote: readonly string[]): string | undefined {
    const history = mergePromptHistory(remote, this.submittedPromptHistory);
    if (history.length === 0) return undefined;
    if (this.historyIndex === null) {
      this.historyDraft = this.state.text;
      this.historyIndex = history.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex -= 1;
    }
    return history[this.historyIndex] ?? this.historyDraft;
  }

  recallNextMessage(remote: readonly string[]): string {
    const history = mergePromptHistory(remote, this.submittedPromptHistory);
    // Composer checks the cursor/history guard before the live host history read.
    if (this.historyIndex! < history.length - 1) {
      this.historyIndex! += 1;
      return history[this.historyIndex!] ?? this.historyDraft;
    }
    const draft = this.historyDraft;
    this.historyIndex = null;
    this.historyDraft = "";
    return draft;
  }
}

function createInitialComposerState(): typeof INITIAL_COMPOSER_STATE {
  return {
    ...INITIAL_COMPOSER_STATE,
    attachments: [],
  };
}

function mergePromptHistory(remote: readonly string[], local: readonly string[]): string[] {
  let overlap = Math.min(remote.length, local.length);
  while (overlap > 0) {
    const remoteStart = remote.length - overlap;
    if (local.slice(0, overlap).every((value, index) => value === remote[remoteStart + index])) break;
    overlap -= 1;
  }
  return [...remote, ...local.slice(overlap)];
}
