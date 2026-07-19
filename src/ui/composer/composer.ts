// Composer — handles user input, send/stop, keyboard shortcuts.
// Reads: SessionState (isStreaming for send/stop toggle), SessionPreferences
// Owns: ComposerState (text, attachments, isFocused)
//
// Target architecture (see docs/ui-state-guide.md):
//   - ComposerCard wraps ComposerInput + ComposerControls + ComposerActions
//   - ComposerControls replaces floating SessionControls popover (inline row below textarea)
//   - When interaction active: textarea hidden or repurposed for interaction input
//   - Keyboard routing: view delegates keystrokes to card or composer based on active interaction

import { Notice, setIcon } from "obsidian";
import { ChatobbyComponent } from "../shared/component";
import { resizeComposerInput } from "../shell/view-shell";
import type { ComposerAttachment, ComposerKeybindings, SessionPreferences, SessionState, WsPromptAttachment } from "../../types";
import { DEFAULT_COMPOSER_KEYBINDINGS, INITIAL_COMPOSER_STATE } from "../../types";
import { revokeComposerAttachment } from "../../attachments/attachment-store";
import { ABORT_CONFIRM_TIMEOUT_MS } from "../shared/constants";
import type { SlashActivation, SlashArgumentOption, SlashCommandSpec, SlashHighlightRange, SlashParsedCommand, SlashSubmitPlan, SlashToken } from "./slash-command";
import {
  filterSlashCommands,
  findCommandSpec,
  findSlashTokenAtCursor,
  parseSlashActivations,
  rebaseActivations,
  toHighlightRanges,
} from "./slash-state";
import { routePrintableKeyToComposer } from "./view-key-routing";
import { matchesComposerKeybinding } from "./keybindings";

const MAX_COMPOSER_ATTACHMENTS = 8;
const COMPOSER_ATTACHMENT_ACCEPT = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf", ".docx", ".pptx", ".xlsx", ".odt", ".odp", ".ods", ".rtf",
  ".md", ".txt", ".json", ".jsonc", ".yaml", ".yml", ".xml", ".svg", ".html", ".htm", ".csv", ".tsv",
  ".log", ".css", ".js", ".jsx", ".ts", ".tsx", ".py", ".ps1", ".sh",
].join(",");

/** Host interface — the view provides these to the composer. */
export interface ComposerHost {
  /** Send a message with optional attachments. */
  send(message: string, attachments?: WsPromptAttachment[], signal?: AbortSignal): void | Promise<void>;
  /** Steer a running turn (mid-generation correction). Distinct from starting a new prompt. */
  steer(message: string): void | Promise<void>;
  /** Abort the current generation. */
  abort(): void;
  /** Whether the transport can accept an abort request. */
  canAbort(): boolean;
  /** Get the current session state (null if no session). */
  getSessionState(): SessionState | null;
  /** Get current session preferences. */
  getSessionPreferences(): SessionPreferences;
  /** Focus-sensitive shortcuts configured for this Chatobby composer. */
  getComposerKeybindings?(): ComposerKeybindings;
  /** User prompts already present in the active session. */
  getPromptHistory?(): readonly string[];
  /** Stable representation of visible non-user output for early-cancel recovery. */
  getTurnOutputMarker?(): string;
  /** Current slash command catalog. */
  getSlashCommands?(): readonly SlashCommandSpec[];
  /** Update visible slash suggestions. */
  setSlashMatches?(matches: readonly SlashCommandSpec[]): void;
  /** Update visible slash argument options. */
  setSlashArgumentOptions?(options: readonly SlashArgumentOption[]): void;
  /** Whether the slash autocomplete menu is open. */
  isSlashOpen?(): boolean;
  moveSlash?(delta: 1 | -1): void;
  /** Current slash command selected in the visible menu. */
  currentSlashCommand?(): SlashCommandSpec | null;
  /** Current argument option selected in the visible menu. */
  currentSlashArgumentOption?(): SlashArgumentOption | null;
  closeSlash?(): void;
  /** Execute activated slash commands and any remaining prompt text. */
  submitSlashPlan?(plan: SlashSubmitPlan): void | Promise<void>;
  /** Whether a blocking interaction (select/confirm/input/editor) is active. */
  isInteractionActive?(): boolean;
  /** Forward a keystroke to the active interaction card. Returns true if consumed. */
  handleInteractionKey?(event: KeyboardEvent): boolean;
  /** Live text from composer to feed into an active input/editor card. */
  updateInteractionText?(text: string): void;
  /** Resolve or cancel the active interaction. */
  submitInteraction?(): void;
  cancelInteraction?(): void;
  /** Move focus from the composer into the conversation feed. */
  focusFeed?(): void;
  /** Persist pasted/dropped files and return prompt-safe attachment refs. */
  storeFiles?(files: readonly File[]): Promise<ComposerAttachment[]>;
}

export class Composer extends ChatobbyComponent {
  private inputEl: HTMLTextAreaElement | null = null;
  private highlightEl: HTMLElement | null = null;
  private attachmentRailEl: HTMLElement | null = null;
  private activationRailEl: HTMLElement | null = null;
  private attachBtn: HTMLButtonElement | null = null;
  private attachInputEl: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private stopBtn: HTMLButtonElement | null = null;

  private state = createInitialComposerState();
	private isStreaming = false;
	private isStopping = false;
  private promptInFlight = false;
  private pendingSendAbort: AbortController | null = null;
  private pendingSendSequence = 0;
  private activePendingSendId: number | null = null;
  private abortConfirmArmed = false;
  private abortConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  private activations: SlashActivation[] = [];
  private cancelledToken: { slashStart: number; tokenText: string; deletionSeen: boolean } | null = null;
  private pendingArgumentCompletion: { command: SlashParsedCommand } | null = null;
  private readonly submittedPromptHistory: string[] = [];
  private historyIndex: number | null = null;
  private historyDraft = "";
  private stashedDraft: ComposerDraftSnapshot | null = null;
  private recoverableSubmission: RecoverableSubmission | null = null;

  constructor(private host: ComposerHost) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-composer";
  }

  /** Bind to pre-built shell elements (from ViewShell). */
  bind(
    inputEl: HTMLTextAreaElement,
    sendBtn: HTMLButtonElement,
    stopBtn: HTMLButtonElement,
    highlightEl?: HTMLElement,
  ): void {
    this.inputEl = inputEl;
    this.sendBtn = sendBtn;
    this.stopBtn = stopBtn;
    this.highlightEl = highlightEl ?? null;
    this.inputEl.addEventListener("scroll", () => this.syncHighlightScroll());
    const card = this.inputEl.closest<HTMLElement>(".chatobby-composer-card");
    this.attachmentRailEl = card?.createDiv({ cls: "chatobby-attachment-rail is-hidden" }) ?? null;
    this.activationRailEl = card?.createDiv({ cls: "chatobby-activation-rail is-hidden" }) ?? null;
    if (this.attachmentRailEl && card) {
      const inputWrap = card.querySelector(".chatobby-input-wrap");
      if (inputWrap) card.insertBefore(this.attachmentRailEl, inputWrap);
      if (inputWrap && this.activationRailEl) card.insertBefore(this.activationRailEl, inputWrap);
      this.bindAttachmentEvents(card);
    }
    if (card) this.bindAttachmentPicker(card);
    this.renderState();
  }

  /** Set streaming state — toggles send/stop button availability. */
	setStreaming(isStreaming: boolean): void {
		this.isStreaming = isStreaming;
		if (!isStreaming) {
			this.isStopping = false;
			this.disarmAbortConfirm();
			this.discardRecoverableSubmission();
		}
		if (isStreaming) {
			this.observeTurnProgress();
		}
		this.updateControls();
	}

	/** Reflect an accepted Stop request until the terminal session patch arrives. */
	setStopping(isStopping: boolean): void {
		this.isStopping = isStopping;
		this.updateControls();
	}

  /** Focus the input textarea. */
  focus(): void {
    this.inputEl?.focus();
  }

  /** Get the current input text. */
  get text(): string {
    return this.state.text;
  }

  /** Set the input text (e.g., for prefill from command palette). */
  setText(text: string): void {
    this.disarmAbortConfirm();
    this.resetHistoryNavigation();
    this.state.text = text;
    this.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    if (this.inputEl) {
      this.inputEl.value = text;
    }
    this.resizeInput();
    this.refreshSlashState();
  }

  /** Clear the input. */
  clear(): void {
    this.clearDraft(true);
  }

  private clearDraft(revokeAttachments: boolean): void {
    this.disarmAbortConfirm();
    this.resetHistoryNavigation();
    if (revokeAttachments) this.releaseDraftAttachments(this.captureDraft());
    this.state = createInitialComposerState();
    this.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    if (this.inputEl) {
      this.inputEl.value = "";
    }
    if (this.attachInputEl) this.attachInputEl.value = "";
    this.resizeInput();
    this.host.closeSlash?.();
    this.renderHighlights([]);
    this.renderActivations([]);
    this.renderAttachments();
  }

  /** Send the current input. */
  send(): void {
    this.disarmAbortConfirm();
    if (this.promptInFlight) return;
    const rawText = this.state.text;
    const text = rawText.trim();
    if (!text && this.state.attachments.length === 0) return;
    this.activateExactLeadingCommand();
    const commands = this.parseActivatedCommands();
    if (this.startArgumentCompletion(commands)) return;

    this.setPromptInFlight(true);
    const pendingAbort = new AbortController();
    const pendingSendId = ++this.pendingSendSequence;
    this.pendingSendAbort = pendingAbort;
    this.activePendingSendId = pendingSendId;
    const submittedAttachmentIds = this.state.attachments.map((attachment) => attachment.id);
    const submittedDraft = this.captureDraft();
    const outputMarker = this.currentTurnOutputMarker();
    const recoverOnEarlyCancel = commands.length === 0;
    try {
      const attachments = this.state.attachments.length > 0 ? this.state.attachments.map((attachment) => attachment.prompt) : undefined;
      const result = commands.length > 0 && this.host.submitSlashPlan
        ? this.host.submitSlashPlan({ text: rawText, commands, attachments })
        : this.host.send(text, attachments, pendingAbort.signal);
      if (isPromiseLike(result)) {
        void Promise.resolve(result).then(
          () => {
            if (!pendingAbort.signal.aborted && this.submittedDraftIsCurrent(rawText, submittedAttachmentIds)) {
              this.acceptSubmittedDraft(submittedDraft, outputMarker, recoverOnEarlyCancel);
            }
            this.finishPendingSend(pendingSendId);
          },
          (error) => {
            console.error("Chatobby: pending send failed", error);
            this.finishPendingSend(pendingSendId);
          },
        );
      } else {
        if (!pendingAbort.signal.aborted && this.submittedDraftIsCurrent(rawText, submittedAttachmentIds)) {
          this.acceptSubmittedDraft(submittedDraft, outputMarker, recoverOnEarlyCancel);
        }
        this.pendingSendAbort = null;
        this.activePendingSendId = null;
        this.setPromptInFlight(false);
      }
    } catch (error) {
      this.pendingSendAbort = null;
      this.activePendingSendId = null;
      this.setPromptInFlight(false);
      console.error("Chatobby: pending send failed", error);
    }
  }

  /** Send the current input as a mid-generation steer (a correction to the running turn),
   *  not a new prompt. Only meaningful while a turn is active. */
  steer(): void {
    this.disarmAbortConfirm();
    const text = this.state.text.trim();
    if (!text) return;
    const result = this.host.steer(text);
    this.clear();
    if (isPromiseLike(result)) void Promise.resolve(result).catch(() => { });
  }

  /** Abort the current generation. */
  stop(): void {
    this.disarmAbortConfirm();
    if (this.promptInFlight && !this.isStreaming && this.host.getSessionState()?.isStreaming !== true) {
      this.pendingSendAbort?.abort();
      this.pendingSendAbort = null;
      this.activePendingSendId = null;
      this.setPromptInFlight(false);
      return;
    }
    this.abortAcceptedTurn();
  }

  /** Handle keyboard shortcuts in the input. */
  handleKeydown(e: KeyboardEvent): void {
    // Route to active interaction card first.
    if (this.host.isInteractionActive?.()) {
      const handled = this.host.handleInteractionKey?.(e) ?? false;
      if (handled) return;
      // For input-type cards: let typing through, update live text on next input event.
      // Non-input keys (arrows, enter, escape, numbers) are handled above.
      if (isTextInput(e)) return; // Let the character through to the textarea.
      return; // Swallow other keys during interaction.
    }

    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      this.host.focusFeed?.();
      return;
    }

    if (this.pendingArgumentCompletion && this.host.isSlashOpen?.()) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.host.moveSlash?.(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.host.moveSlash?.(-1); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); this.commitArgumentOption(); return; }
      if (e.key === "Escape") { e.preventDefault(); this.pendingArgumentCompletion = null; this.host.closeSlash?.(); return; }
    }

    if (e.key === " " && !e.shiftKey && this.activateCurrentTokenOnSpace()) {
      this.host.closeSlash?.();
      return;
    }

    // While the slash menu is open, it owns arrow/enter/tab/escape.
    if (this.host.isSlashOpen?.()) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.host.moveSlash?.(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.host.moveSlash?.(-1); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); this.autocompleteCurrentToken(); return; }
      if (e.key === "Escape") { e.preventDefault(); this.cancelCurrentToken(); return; }
    }

    const bindings = this.host.getComposerKeybindings?.() ?? DEFAULT_COMPOSER_KEYBINDINGS;
    if (matchesComposerKeybinding(e, bindings.stashDraft)) {
      e.preventDefault();
      this.stashCurrentDraft();
      return;
    }
    if (matchesComposerKeybinding(e, bindings.previousMessage) && this.recallPreviousMessage()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (this.promptInFlight) {
        return;
      } else if (this.isTurnActive()) {
        // Mid-turn Enter STEERS the running turn (a correction) — it does not start a new prompt.
        if (this.state.text.trim()) this.steer();
      } else {
        this.send();
      }
    } else if (matchesComposerKeybinding(e, bindings.cancelTurn)) {
      if (this.currentToken()) {
        e.preventDefault();
        this.cancelCurrentToken();
      } else if (this.isTurnActive()) {
        e.preventDefault();
        this.confirmAbortWithEscape();
      } else if (this.state.text) {
        this.clear();
      }
    }
  }

  /** Capture ordinary typing that began elsewhere in the visible chat surface. */
  handleViewKeydown(event: KeyboardEvent): boolean {
    return this.inputEl ? routePrintableKeyToComposer(event, this.inputEl) : false;
  }

  /** Handle input events (text change). */
  handleInput(): void {
    this.disarmAbortConfirm();
    this.resetHistoryNavigation();
    const nextText = this.inputEl?.value ?? "";
    // Forward live text to active interaction card (for input/editor types).
    if (this.host.isInteractionActive?.()) {
      this.host.updateInteractionText?.(nextText);
    }
    this.activations = rebaseActivations(this.activations, this.state.text, nextText);
    if (this.pendingArgumentCompletion) {
      this.pendingArgumentCompletion = null;
      this.host.closeSlash?.();
    }
    if (this.inputEl) {
      this.state.text = this.inputEl.value;
    }
    this.updateControls();
    this.refreshSlashState();
  }

  // ── Private helpers ────────────────────────────────────────────

  /** Re-measure the textarea height. Programmatic value changes (clear, prefill,
   *  slash autocomplete) don't fire DOM `input` events, so the autosize in
   *  ViewShell never runs — leaving an expanded box stuck tall after a long send. */
  private resizeInput(): void {
    if (this.inputEl) resizeComposerInput(this.inputEl);
  }

  private renderState(): void {
    this.isStreaming = this.host.getSessionState()?.isStreaming ?? false;
    this.updateControls();
  }

  private setPromptInFlight(promptInFlight: boolean): void {
    this.promptInFlight = promptInFlight;
    if (!promptInFlight) this.disarmAbortConfirm();
    this.updateControls();
  }

  private isTurnActive(): boolean {
    const session = this.host.getSessionState();
    return this.promptInFlight || this.recoverableSubmission !== null || this.isStreaming ||
      session?.isStreaming === true || session?.isCompacting === true;
  }

  private updateControls(): void {
    const turnActive = this.isTurnActive();
    const empty = this.state.text.trim().length === 0 && this.state.attachments.length === 0;

    // One morphing slot: send while idle, stop while a turn runs. Same circle, same place.
    // Send is disabled when the box is empty (nothing to send). Stop only exists mid-turn.
    if (this.sendBtn) {
      this.sendBtn.toggleClass("is-hidden", turnActive);
      this.sendBtn.disabled = turnActive || empty;
    }

		if (this.stopBtn) {
			this.stopBtn.toggleClass("is-hidden", !turnActive);
			this.stopBtn.disabled = !turnActive || this.isStopping || !this.host.canAbort();
			this.stopBtn.empty();
			if (turnActive && this.isStopping) {
				setIcon(this.stopBtn, "loader-circle");
				this.stopBtn.setAttr("aria-label", "Stopping current turn");
				this.stopBtn.setAttr("title", "Stopping current turn");
				this.stopBtn.addClass("is-stopping");
				this.stopBtn.removeClass("is-confirming");
			} else if (turnActive && this.abortConfirmArmed) {
				this.stopBtn.textContent = "Esc";
        this.stopBtn.setAttr("aria-label", "Press Escape again to stop current turn");
        this.stopBtn.setAttr("title", "Press Escape again to stop current turn");
				this.stopBtn.addClass("is-confirming");
				this.stopBtn.removeClass("is-stopping");
			} else {
        setIcon(this.stopBtn, this.promptInFlight ? "x" : "square");
        this.stopBtn.setAttr("aria-label", this.promptInFlight ? "Cancel pending send" : "Stop current turn");
        this.stopBtn.setAttr("title", this.promptInFlight ? "Cancel pending send" : "Stop current turn");
				this.stopBtn.removeClass("is-confirming");
				this.stopBtn.removeClass("is-stopping");
			}
    }
  }

  private confirmAbortWithEscape(): void {
    if (this.abortConfirmArmed) {
      this.disarmAbortConfirm();
      this.abortAcceptedTurn();
      return;
    }
    this.abortConfirmArmed = true;
    if (this.abortConfirmTimer) clearTimeout(this.abortConfirmTimer);
    this.abortConfirmTimer = setTimeout(() => {
      this.abortConfirmTimer = null;
      this.disarmAbortConfirm();
    }, ABORT_CONFIRM_TIMEOUT_MS);
    this.updateControls();
  }

  private disarmAbortConfirm(): void {
    if (!this.abortConfirmArmed && !this.abortConfirmTimer) return;
    this.abortConfirmArmed = false;
    if (this.abortConfirmTimer) clearTimeout(this.abortConfirmTimer);
    this.abortConfirmTimer = null;
    this.updateControls();
  }

  private submittedDraftIsCurrent(text: string, attachmentIds: readonly string[]): boolean {
    return this.state.text === text
      && this.state.attachments.length === attachmentIds.length
      && this.state.attachments.every((attachment, index) => attachment.id === attachmentIds[index]);
  }

  private finishPendingSend(pendingSendId: number): void {
    if (this.activePendingSendId !== pendingSendId) return;
    this.pendingSendAbort = null;
    this.activePendingSendId = null;
    this.setPromptInFlight(false);
  }

  private acceptSubmittedDraft(
    draft: ComposerDraftSnapshot,
    outputMarker: string,
    recoverOnEarlyCancel: boolean,
  ): void {
    if (draft.text.trim()) this.submittedPromptHistory.push(draft.text);
    this.resetHistoryNavigation();
    if (recoverOnEarlyCancel) {
      this.discardRecoverableSubmission();
      this.recoverableSubmission = { draft, outputMarker };
      this.clearDraft(false);
    } else {
      this.clearDraft(true);
    }
    this.restoreStashedDraft();
    this.observeTurnProgress();
  }

  private abortAcceptedTurn(): void {
    const recoverable = this.recoverableSubmission;
    if (recoverable && this.currentTurnOutputMarker() === recoverable.outputMarker) {
      this.recoverableSubmission = null;
      if (this.state.text.trim() || this.state.attachments.length > 0) {
        this.replaceStashedDraft(this.captureDraft());
      }
      this.restoreDraft(recoverable.draft);
      new Notice("Cancelled message restored.");
    } else {
      this.discardRecoverableSubmission();
    }
    this.host.abort();
  }

  /** Reconcile early-cancel recovery after a feed projection changes. */
  observeTurnProgress(): void {
    const recoverable = this.recoverableSubmission;
    if (recoverable && this.currentTurnOutputMarker() !== recoverable.outputMarker) {
      this.discardRecoverableSubmission();
    }
  }

  private currentTurnOutputMarker(): string {
    return this.host.getTurnOutputMarker?.() ?? "";
  }

  private discardRecoverableSubmission(): void {
    if (!this.recoverableSubmission) return;
    this.releaseDraftAttachments(this.recoverableSubmission.draft);
    this.recoverableSubmission = null;
  }

  private stashCurrentDraft(): void {
    if (!this.state.text.trim() && this.state.attachments.length === 0) {
      if (this.stashedDraft) {
        this.restoreStashedDraft();
        new Notice("Stashed draft restored.");
      }
      return;
    }
    this.replaceStashedDraft(this.captureDraft());
    this.clearDraft(false);
    new Notice("Draft stashed. It will return after your next message.");
  }

  private replaceStashedDraft(draft: ComposerDraftSnapshot): void {
    if (this.stashedDraft) this.releaseDraftAttachments(this.stashedDraft);
    this.stashedDraft = draft;
  }

  private restoreStashedDraft(): void {
    const stashed = this.stashedDraft;
    if (!stashed) return;
    this.stashedDraft = null;
    this.restoreDraft(stashed);
  }

  private recallPreviousMessage(): boolean {
    if (!this.inputEl || this.inputEl.selectionStart !== 0 || this.inputEl.selectionEnd !== 0) return false;
    const history = mergePromptHistory(this.host.getPromptHistory?.() ?? [], this.submittedPromptHistory);
    if (history.length === 0) return false;
    if (this.historyIndex === null) {
      this.historyDraft = this.state.text;
      this.historyIndex = history.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex -= 1;
    }
    this.applyHistoryText(history[this.historyIndex] ?? this.historyDraft);
    return true;
  }

  private applyHistoryText(text: string): void {
    this.state.text = text;
    this.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    if (this.inputEl) {
      this.inputEl.value = text;
      this.inputEl.setSelectionRange(0, 0);
    }
    this.resizeInput();
    this.updateControls();
    this.refreshSlashState();
  }

  private resetHistoryNavigation(): void {
    this.historyIndex = null;
    this.historyDraft = "";
  }

  private captureDraft(): ComposerDraftSnapshot {
    return {
      text: this.state.text,
      attachments: [...this.state.attachments],
      activations: this.activations.map((activation) => ({ ...activation })),
    };
  }

  private restoreDraft(draft: ComposerDraftSnapshot): void {
    this.state.text = draft.text;
    this.state.attachments = [...draft.attachments];
    this.activations = draft.activations.map((activation) => ({ ...activation }));
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    this.resetHistoryNavigation();
    if (this.inputEl) this.inputEl.value = draft.text;
    this.resizeInput();
    this.updateControls();
    this.refreshSlashState();
    this.renderAttachments();
    this.inputEl?.focus();
  }

  private releaseDraftAttachments(draft: ComposerDraftSnapshot): void {
    for (const attachment of draft.attachments) revokeComposerAttachment(attachment);
  }

  private bindAttachmentEvents(card: HTMLElement): void {
    this.inputEl?.addEventListener("paste", (event) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void this.addFiles(files);
    });
    card.addEventListener("dragover", (event) => {
      if (!event.dataTransfer || event.dataTransfer.types.length === 0) return;
      event.preventDefault();
      card.addClass("is-drag-over");
    });
    card.addEventListener("dragleave", () => {
      card.removeClass("is-drag-over");
    });
    card.addEventListener("drop", (event) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      card.removeClass("is-drag-over");
      void this.addFiles(files);
    });
  }

  private bindAttachmentPicker(card: HTMLElement): void {
    const actions = this.sendBtn?.closest<HTMLElement>(".chatobby-composer-actions") ?? this.sendBtn?.parentElement ?? card;
    this.attachInputEl = card.createEl("input", {
      cls: "chatobby-attachment-input",
      attr: { type: "file", accept: COMPOSER_ATTACHMENT_ACCEPT, multiple: "true", tabindex: "-1" },
    }) as HTMLInputElement;
    this.attachBtn = actions.createEl("button", {
      cls: "chatobby-attach-btn",
      attr: { type: "button", "aria-label": "Attach files", title: "Attach files" },
    });
    setIcon(this.attachBtn, "plus");
    if (this.sendBtn) actions.insertBefore(this.attachBtn, this.sendBtn);
    this.attachBtn.disabled = !this.host.storeFiles;
    this.attachBtn.addEventListener("click", () => this.attachInputEl?.click());
    this.attachInputEl.addEventListener("change", () => {
      const files = Array.from(this.attachInputEl?.files ?? []);
      if (files.length > 0) void this.addFiles(files);
      if (this.attachInputEl) this.attachInputEl.value = "";
    });
  }

  private async addFiles(files: readonly File[]): Promise<void> {
    if (!this.host.storeFiles) {
      new Notice("This Chatobby build cannot store attachments.");
      return;
    }
    if (this.state.attachments.length + files.length > MAX_COMPOSER_ATTACHMENTS) {
      new Notice(`A message can include up to ${MAX_COMPOSER_ATTACHMENTS} attachments.`);
      return;
    }
    try {
      const attachments = await this.host.storeFiles(files);
      this.state.attachments = [...this.state.attachments, ...attachments];
      this.renderAttachments();
      this.updateControls();
    } catch (error) {
      console.error("Chatobby: failed to store attachment", error);
      new Notice(error instanceof Error ? error.message : "Failed to store attachment");
    }
  }

  private removeAttachment(id: string): void {
    const removed = this.state.attachments.find((attachment) => attachment.id === id);
    if (removed) revokeComposerAttachment(removed);
    this.state.attachments = this.state.attachments.filter((attachment) => attachment.id !== id);
    this.renderAttachments();
    this.updateControls();
  }

  private renderAttachments(): void {
    if (!this.attachmentRailEl) return;
    this.attachmentRailEl.empty();
    this.attachmentRailEl.toggleClass("is-hidden", this.state.attachments.length === 0);
    for (const attachment of this.state.attachments) {
      const item = this.attachmentRailEl.createDiv({ cls: "chatobby-attachment-chip" });
      if (attachment.previewUrl) {
        item.createEl("img", {
          cls: "chatobby-attachment-chip__thumb",
          attr: { src: attachment.previewUrl, alt: attachment.name },
        });
      } else {
        const icon = item.createSpan({ cls: "chatobby-attachment-chip__icon", attr: { "aria-hidden": "true" } });
        setIcon(icon, attachment.delivery === "document" || attachment.delivery === "text" ? "file-text" : "paperclip");
      }
      const body = item.createDiv({ cls: "chatobby-attachment-chip__body" });
      body.createDiv({ cls: "chatobby-attachment-chip__name", text: attachment.name, attr: { title: attachment.name } });
      body.createDiv({ cls: "chatobby-attachment-chip__meta", text: attachmentMeta(attachment) });
      const remove = item.createEl("button", {
        cls: "chatobby-attachment-chip__remove",
        attr: { type: "button", "aria-label": `Remove ${attachment.name}`, title: "Remove attachment" },
      });
      setIcon(remove, "x");
      remove.addEventListener("click", () => this.removeAttachment(attachment.id));
    }
  }

  private refreshSlashState(): void {
    const token = this.currentToken();
    this.updateCancellation(token);

    if (!token || this.isTokenCancelled(token)) {
      this.host.closeSlash?.();
    } else {
      const matches = filterSlashCommands(this.commands(), token.query);
      this.host.setSlashMatches?.(matches);
      if (matches.length === 0) this.host.closeSlash?.();
    }

    const commands = this.parseActivatedCommands();
    this.renderHighlights(toHighlightRanges(commands));
    this.renderActivations(commands);
  }

  private activateCurrentTokenOnSpace(): boolean {
    const token = this.currentToken();
    if (!token || this.isTokenCancelled(token)) return false;
    const spec = findCommandSpec(this.commands(), token.query);
    if (!spec) return false;
    this.activateToken(token, spec);
    return true;
  }

  private activateExactLeadingCommand(): void {
    if (this.activations.length > 0) return;
    const match = /^(\s*)\/([A-Za-z0-9:_-]+)(?=\s|$)/.exec(this.state.text);
    if (!match) return;
    const slashStart = match[1]?.length ?? 0;
    if (this.cancelledToken?.slashStart === slashStart) return;
    const name = match[2];
    if (!name || !findCommandSpec(this.commands(), name)) return;
    this.activations.push({ name, slashStart });
  }

  private startArgumentCompletion(commands: readonly SlashParsedCommand[]): boolean {
    const command = commands.find((parsed) => !parsed.ok && parsed.spec.argumentOptions);
    if (!command) return false;

    const options = command.spec.argumentOptions?.(command) ?? [];
    if (options.length === 0) return false;

    this.pendingArgumentCompletion = { command };
    this.host.setSlashArgumentOptions?.(options);
    return true;
  }

  private autocompleteCurrentToken(): void {
    const token = this.currentToken();
    const command = this.host.currentSlashCommand?.() ?? null;
    if (!token || !command || !this.inputEl) {
      this.host.closeSlash?.();
      return;
    }

    const replacement = `/${command.name} `;
    const nextText = `${this.state.text.slice(0, token.slashStart)}${replacement}${this.state.text.slice(token.commandEnd)}`;
    this.state.text = nextText;
    this.inputEl.value = nextText;
    const cursor = token.slashStart + replacement.length;
    this.inputEl.setSelectionRange(cursor, cursor);
    this.activateToken({ slashStart: token.slashStart, commandEnd: token.slashStart + replacement.length - 1, query: command.name }, command);
    this.cancelledToken = null;
    this.host.closeSlash?.();
    this.resizeInput();
    this.updateControls();
    this.refreshSlashState();
  }

  private cancelCurrentToken(): void {
    const token = this.currentToken();
    if (token) {
      this.cancelledToken = {
        slashStart: token.slashStart,
        tokenText: this.state.text.slice(token.slashStart, token.commandEnd),
        deletionSeen: false,
      };
    }
    this.host.closeSlash?.();
  }

  private commitArgumentOption(): void {
    const pending = this.pendingArgumentCompletion;
    const option = this.host.currentSlashArgumentOption?.() ?? null;
    if (!pending || !option || !this.inputEl) {
      this.pendingArgumentCompletion = null;
      this.host.closeSlash?.();
      return;
    }

    const insert = argumentInsertPoint(this.state.text, pending.command.commandRange.end);
    const leadingSpace = insert === pending.command.commandRange.end ? " " : "";
    const insertedText = `${leadingSpace}${option.value}`;
    const nextText = `${this.state.text.slice(0, insert)}${insertedText}${this.state.text.slice(insert)}`;
    this.state.text = nextText;
    this.inputEl.value = nextText;
    const cursor = insert + insertedText.length;
    this.inputEl.setSelectionRange(cursor, cursor);
    this.pendingArgumentCompletion = null;
    this.host.closeSlash?.();
    this.resizeInput();
    this.updateControls();
    this.refreshSlashState();
  }

  private activateToken(token: SlashToken, spec: SlashCommandSpec): void {
    this.activations = this.activations.filter((activation) => activation.slashStart !== token.slashStart);
    this.activations.push({ name: spec.name, slashStart: token.slashStart });
    this.activations.sort((left, right) => left.slashStart - right.slashStart);
    const commands = this.parseActivatedCommands();
    this.renderHighlights(toHighlightRanges(commands));
    this.renderActivations(commands);
  }

  private parseActivatedCommands(): SlashParsedCommand[] {
    return parseSlashActivations(this.state.text, this.commands(), this.activations);
  }

  private commands(): readonly SlashCommandSpec[] {
    return this.host.getSlashCommands?.() ?? [];
  }

  private currentToken(): SlashToken | null {
    if (!this.inputEl) return null;
    return findSlashTokenAtCursor(this.state.text, this.inputEl.selectionStart);
  }

  private updateCancellation(token: SlashToken | null): void {
    if (!this.cancelledToken || !token || token.slashStart !== this.cancelledToken.slashStart) return;
    const tokenText = this.state.text.slice(token.slashStart, token.commandEnd);
    if (tokenText.length < this.cancelledToken.tokenText.length) {
      this.cancelledToken = { ...this.cancelledToken, tokenText, deletionSeen: true };
      return;
    }
    if (this.cancelledToken.deletionSeen && tokenText.length > this.cancelledToken.tokenText.length) {
      this.cancelledToken = null;
      return;
    }
    this.cancelledToken = { ...this.cancelledToken, tokenText };
  }

  private isTokenCancelled(token: SlashToken): boolean {
    return this.cancelledToken?.slashStart === token.slashStart;
  }

  private renderHighlights(ranges: readonly SlashHighlightRange[]): void {
    if (!this.highlightEl) return;
    this.highlightEl.empty();

    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        this.highlightEl.createSpan({ cls: "chatobby-input-highlight__text", text: this.state.text.slice(cursor, range.start) });
      }
      this.highlightEl.createSpan({
        cls: `chatobby-input-highlight__${range.kind}`,
        text: this.state.text.slice(range.start, range.end),
      });
      cursor = range.end;
    }

    if (cursor < this.state.text.length) {
      this.highlightEl.createSpan({ cls: "chatobby-input-highlight__text", text: this.state.text.slice(cursor) });
    }
    if (this.state.text.length === 0) {
      this.highlightEl.createSpan({ cls: "chatobby-input-highlight__text", text: " " });
    }
    this.syncHighlightScroll();
  }

  private renderActivations(commands: readonly SlashParsedCommand[]): void {
    if (!this.activationRailEl) return;
    this.activationRailEl.empty();
    this.activationRailEl.toggleClass("is-hidden", commands.length === 0);
    for (const command of commands) {
      const chip = this.activationRailEl.createDiv({
        cls: `chatobby-activation-chip chatobby-activation-chip--${command.spec.source}`,
        attr: {
          "aria-label": `${activationKindLabel(command.spec)} ${command.spec.name}`,
          title: `${activationKindLabel(command.spec)}: /${command.spec.name}`,
        },
      });
      const icon = chip.createSpan({ cls: "chatobby-activation-chip__icon" });
      setIcon(icon, activationIcon(command.spec));
      chip.createSpan({ cls: "chatobby-activation-chip__label", text: activationLabel(command.spec) });
    }
  }

  private syncHighlightScroll(): void {
    if (!this.inputEl || !this.highlightEl) return;
    this.highlightEl.scrollTop = this.inputEl.scrollTop;
    this.highlightEl.scrollLeft = this.inputEl.scrollLeft;
  }

  protected onRender(_container: HTMLElement): void {
    // Composer DOM is built by ViewShell; this component only updates it.
    this.renderState();
  }
}

/** True when the key event represents typing a printable character (not a control key). */
function isTextInput(e: KeyboardEvent): boolean {
  if (e.key === "Backspace" || e.key === "Delete") return true;
  return e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return typeof value === "object" && value !== null && "then" in value;
}

function argumentInsertPoint(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t")) {
    cursor += 1;
  }
  return cursor;
}

function createInitialComposerState(): typeof INITIAL_COMPOSER_STATE {
  return {
    ...INITIAL_COMPOSER_STATE,
    attachments: [],
  };
}

interface ComposerDraftSnapshot {
  text: string;
  attachments: ComposerAttachment[];
  activations: SlashActivation[];
}

interface RecoverableSubmission {
  draft: ComposerDraftSnapshot;
  outputMarker: string;
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

function activationIcon(command: SlashCommandSpec): string {
  if (command.name === "goal") return "target";
  if (command.source === "skill") return "sparkles";
  if (command.source === "prompt") return "file-text";
  if (command.source === "extension") return "puzzle";
  return "terminal";
}

function activationKindLabel(command: SlashCommandSpec): string {
  if (command.name === "goal") return "Goal";
  if (command.source === "skill") return "Skill";
  if (command.source === "prompt") return "Prompt";
  if (command.source === "extension") return "Command";
  return "Action";
}

function activationLabel(command: SlashCommandSpec): string {
  return command.source === "skill" && command.name.startsWith("skill:") ? command.name.slice(6) : command.name;
}

function attachmentMeta(attachment: ComposerAttachment): string {
  const extension = /\.([^.]+)$/u.exec(attachment.name)?.[1]?.toUpperCase();
  const kind = extension || attachment.delivery.charAt(0).toUpperCase() + attachment.delivery.slice(1);
  return attachment.sizeBytes === undefined ? kind : `${kind} · ${formatFileSize(attachment.sizeBytes)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`;
}
