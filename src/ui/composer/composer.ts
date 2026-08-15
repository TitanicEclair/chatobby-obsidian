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
import type {
  ComposerAttachment,
  ComposerKeybindings,
  InteractionState,
  SessionPreferences,
  SessionState,
  WsPromptAttachment,
} from "../../types";
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
import { interactionCopy } from "../shared/interaction-copy";
import { attachmentMeta, attachmentVisual } from "../attachments/attachment-presentation";
import type { ComposerVaultReference } from "./vault-reference-search";

const MAX_COMPOSER_ATTACHMENTS = 8;
let composerReferencePanelSequence = 0;
const COMPOSER_ATTACHMENT_ACCEPT = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf", ".docx", ".pptx", ".xlsx", ".odt", ".odp", ".ods", ".rtf",
  ".md", ".txt", ".json", ".jsonc", ".yaml", ".yml", ".xml", ".svg", ".html", ".htm", ".csv", ".tsv",
  ".log", ".css", ".js", ".jsx", ".ts", ".tsx", ".py", ".ps1", ".sh",
].join(",");

/** Result of starting a prompt whose pending cancellation may have raced with acceptance. */
export interface PromptSubmissionOutcome {
  retracted?: boolean;
  retractionReason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed";
}

/** Host interface — the view provides these to the composer. */
export interface ComposerHost {
  /** Send a message with optional attachments. */
  send(
    message: string,
    attachments?: WsPromptAttachment[],
    signal?: AbortSignal,
    submissionId?: string,
  ): void | PromptSubmissionOutcome | Promise<void | PromptSubmissionOutcome>;
  /** Steer a running turn (mid-generation correction). Distinct from starting a new prompt. */
  steer(message: string, attachments?: WsPromptAttachment[]): void | Promise<void>;
  /** Abort the current generation. */
  abort(): void;
  /** Retract a specific prompt before visible response output begins. */
  retractPrompt?(
    submissionId: string,
    message: string,
  ): Promise<{ retracted: boolean; reason?: "not-found" | "output-started" | "drain-timeout" | "prompt-failed" }>;
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
  submitSlashPlan?(plan: SlashSubmitPlan, onAccepted: () => void): void | Promise<void>;
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
  /** Search file and folder names for an inline @ reference. */
  searchVaultReferences?(query: string): readonly ComposerVaultReference[] | Promise<readonly ComposerVaultReference[]>;
  /** Open or reveal a selected reference without granting agent access. */
  openVaultReference?(reference: ComposerVaultReference): void;
}

export class Composer extends ChatobbyComponent {
  private inputEl: HTMLTextAreaElement | null = null;
  private highlightEl: HTMLElement | null = null;
  private attachmentRailEl: HTMLElement | null = null;
  private referenceRailEl: HTMLElement | null = null;
  private activationRailEl: HTMLElement | null = null;
  private interactionRailEl: HTMLElement | null = null;
  private composerCardEl: HTMLElement | null = null;
  private attachBtn: HTMLButtonElement | null = null;
  private attachInputEl: HTMLInputElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private stopBtn: HTMLButtonElement | null = null;
  private referenceMenuEl: HTMLElement | null = null;
  private referencePanelEl: HTMLElement | null = null;
  private referenceSummaryButton: HTMLButtonElement | null = null;

  private state = createInitialComposerState();
	private isStreaming = false;
	private isStopping = false;
  private promptInFlight = false;
  private slashCommandInFlight = false;
  private pendingSendAbort: AbortController | null = null;
  private pendingSubmissionDraft: ComposerDraftSnapshot | null = null;
  private pendingSubmissionDraftRestored = false;
  private pendingSendSequence = 0;
  private activePendingSendId: number | null = null;
  private abortConfirmArmed = false;
  private abortConfirmTimer: number | null = null;
  private activations: SlashActivation[] = [];
  private cancelledToken: { slashStart: number; tokenText: string; deletionSeen: boolean } | null = null;
  private pendingArgumentCompletion: { command: SlashParsedCommand } | null = null;
  private readonly submittedPromptHistory: string[] = [];
  private historyIndex: number | null = null;
  private historyDraft = "";
  private stashedDraft: ComposerDraftSnapshot | null = null;
  private recoverableSubmission: RecoverableSubmission | null = null;
  private retractionPending = false;
  private committedTurnPending = false;
  private highlightSyncFrame = 0;
  private activeInteraction: InteractionState | null = null;
  private defaultPlaceholder = "";
  private referenceToken: ReferenceToken | null = null;
  private referenceMatches: readonly ComposerVaultReference[] = [];
  private referenceIndex = 0;
  private referenceSearchSequence = 0;
  private selectedReferences: ComposerVaultReference[] = [];
  private referencesCollapsed = false;
  private referencePanelOpen = false;
  private referencePanelIndex = 0;
  private referenceExpandedWidth = 0;
  private referenceMeasureFrame = 0;
  private referenceResizeObserver: ResizeObserver | null = null;
  private readonly referencePanelId = `chatobby-composer-reference-panel-${++composerReferencePanelSequence}`;

  constructor(private host: ComposerHost) {
    super();
  }

  protected componentClass(): string {
    return "chatobby-composer";
  }

  destroy(): void {
    if (this.highlightSyncFrame) window.cancelAnimationFrame(this.highlightSyncFrame);
    if (this.referenceMeasureFrame) window.cancelAnimationFrame(this.referenceMeasureFrame);
    this.highlightSyncFrame = 0;
    this.referenceMeasureFrame = 0;
    this.referenceResizeObserver?.disconnect();
    this.referenceResizeObserver = null;
    super.destroy();
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
    this.defaultPlaceholder = inputEl.placeholder;
    this.inputEl.addEventListener("scroll", () => this.syncHighlightScroll());
    const card = this.inputEl.closest<HTMLElement>(".chatobby-composer-card");
    this.composerCardEl = card;
    this.referenceMenuEl = card?.createDiv({ cls: "chatobby-reference-menu is-hidden" }) ?? null;
    this.referencePanelEl = card?.createDiv({
      cls: "chatobby-reference-panel is-hidden",
      attr: { tabindex: "-1", role: "listbox", "aria-label": "Selected references" },
    }) ?? null;
    this.referencePanelEl?.addEventListener("keydown", (event) => this.handleReferencePanelKey(event));
    this.interactionRailEl = card?.createDiv({ cls: "chatobby-interaction-rail is-hidden" }) ?? null;
    this.attachmentRailEl = card?.createDiv({ cls: "chatobby-attachment-rail is-hidden" }) ?? null;
    this.referenceRailEl = card?.createDiv({ cls: "chatobby-reference-rail is-hidden" }) ?? null;
    this.activationRailEl = card?.createDiv({ cls: "chatobby-activation-rail is-hidden" }) ?? null;
    if (this.attachmentRailEl && card) {
      const inputWrap = card.querySelector(".chatobby-input-wrap");
      if (inputWrap && this.referenceMenuEl) card.insertBefore(this.referenceMenuEl, inputWrap);
      if (inputWrap && this.referencePanelEl) card.insertBefore(this.referencePanelEl, inputWrap);
      if (inputWrap && this.interactionRailEl) card.insertBefore(this.interactionRailEl, inputWrap);
      if (inputWrap) card.insertBefore(this.attachmentRailEl, inputWrap);
      if (inputWrap && this.referenceRailEl) card.insertBefore(this.referenceRailEl, inputWrap);
      if (inputWrap && this.activationRailEl) card.insertBefore(this.activationRailEl, inputWrap);
      this.bindAttachmentEvents(card);
    }
    if (this.referenceRailEl && typeof ResizeObserver !== "undefined") {
      this.referenceResizeObserver = new ResizeObserver(() => this.reconcileReferenceOverflow());
      this.referenceResizeObserver.observe(this.referenceRailEl);
    }
    if (card) this.bindAttachmentPicker(card);
    this.renderState();
  }

  /** Set streaming state — toggles send/stop button availability. */
	setStreaming(isStreaming: boolean): void {
		this.isStreaming = isStreaming;
		if (!isStreaming) {
			if (!this.retractionPending) this.isStopping = false;
			this.disarmAbortConfirm();
			if (!this.retractionPending) this.commitRecoverableSubmission(false);
			this.committedTurnPending = false;
		} else {
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

  /** Present one blocking request in the composer without mixing it into the user's next prompt. */
  setInteraction(interaction: InteractionState | null): void {
    this.activeInteraction = interaction;
    if (interaction) {
      this.referencePanelOpen = false;
      this.renderReferencePanel();
    }
    this.composerCardEl?.toggleClass("has-interaction", interaction !== null);
    if (this.inputEl) {
      this.inputEl.readOnly = interaction !== null && interaction.method !== "input";
      this.inputEl.placeholder = interaction
        ? interaction.method === "input"
          ? (typeof interaction.params.placeholder === "string" ? interaction.params.placeholder : "Type a response")
          : "Choose an option above"
        : this.defaultPlaceholder;
    }
    this.renderInteractionContext();
    this.updateControls();
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
    this.selectedReferences = [];
    this.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    this.closeReferenceMenu();
    if (this.inputEl) {
      this.inputEl.value = text;
    }
    this.resizeInput();
    this.refreshSlashState();
    this.renderReferences();
    this.updateControls();
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
    this.selectedReferences = [];
    this.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    this.closeReferenceMenu();
    if (this.inputEl) {
      this.inputEl.value = "";
    }
    if (this.attachInputEl) this.attachInputEl.value = "";
    this.resizeInput();
    this.host.closeSlash?.();
    this.renderHighlights([]);
    this.renderActivations([]);
    this.renderAttachments();
    this.renderReferences();
  }

  /** Send the current input. */
  send(): void {
    this.disarmAbortConfirm();
    if (this.activeInteraction) {
      if (this.activeInteraction.method === "input") {
        this.host.updateInteractionText?.(this.state.text);
        this.host.submitInteraction?.();
      }
      return;
    }
    if (this.promptInFlight) return;
    const rawText = this.state.text;
    const text = this.promptText(rawText);
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
      this.clearDraft(false);
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
        this.updateControls();
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

  /** Send the current input as a mid-generation steer (a correction to the running turn),
   *  not a new prompt. Only meaningful while a turn is active. */
  steer(): void {
    this.disarmAbortConfirm();
    const text = this.promptText(this.state.text);
    if (!text && this.state.attachments.length === 0) return;
    const attachments = this.state.attachments.length > 0
      ? this.state.attachments.map((attachment) => attachment.prompt)
      : undefined;
    const result = this.host.steer(text, attachments);
    this.clear();
    if (isPromiseLike(result)) void Promise.resolve(result).catch(() => { });
  }

  /** Abort the current generation. */
  stop(): void {
    this.disarmAbortConfirm();
    if (this.promptInFlight && !this.slashCommandInFlight) {
      this.pendingSendAbort?.abort();
      this.restorePendingSubmissionDraft();
      this.setStopping(true);
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

    if (this.referenceToken && !this.referenceMenuEl?.hasClass("is-hidden")) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.moveReference(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.moveReference(-1); return; }
      if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); this.commitReference(); return; }
      if (e.key === "Escape") { e.preventDefault(); this.closeReferenceMenu(); return; }
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
    if (matchesComposerKeybinding(e, bindings.previousMessage) && this.recallPreviousMessage()) {
      e.preventDefault();
      return;
    }
    if (matchesComposerKeybinding(e, bindings.nextMessage) && this.recallNextMessage()) {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (this.promptInFlight) {
        return;
      } else if (this.isTurnActive()) {
        // Mid-turn Enter STEERS the running turn (a correction) — it does not start a new prompt.
        if (this.state.text.trim() || this.state.attachments.length > 0 || this.selectedReferences.length > 0) this.steer();
      } else {
        this.send();
      }
    } else if (matchesComposerKeybinding(e, bindings.cancelTurn)) {
      if (this.currentToken()) {
        e.preventDefault();
        this.cancelCurrentToken();
      } else if (this.isTurnActive()) {
        e.preventDefault();
        if (this.canRetractOnFirstEscape()) this.stop();
        else this.confirmAbortWithEscape();
      } else if (this.state.text) {
        e.preventDefault();
        this.clear();
      }
    }
  }

  /** Capture ordinary typing that began elsewhere in the visible chat surface. */
  handleViewKeydown(event: KeyboardEvent): boolean {
    return this.inputEl ? routePrintableKeyToComposer(event, this.inputEl) : false;
  }

  handleScopedKeydown(event: KeyboardEvent, applyComposerAction: boolean): boolean {
    const bindings = this.host.getComposerKeybindings?.() ?? DEFAULT_COMPOSER_KEYBINDINGS;
    if (!matchesComposerKeybinding(event, bindings.cancelTurn)
      && !matchesComposerKeybinding(event, DEFAULT_COMPOSER_KEYBINDINGS.cancelTurn)) return false;
    if (applyComposerAction) this.handleKeydown(event);
    event.preventDefault();
    return true;
  }

  stashDraft(): void {
    this.stashCurrentDraft();
  }

  restoreStash(): void {
    this.restoreStashExplicitly();
  }

  recallPrevious(): boolean {
    this.focus();
    return this.recallPreviousMessage();
  }

  recallNext(): boolean {
    this.focus();
    return this.recallNextMessage();
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
    // The textarea itself is transparent; the highlight mirror is the visible
    // text. Keep it current even while @ suggestions own autocomplete.
    this.refreshSlashState();
    if (this.refreshReferenceState()) this.host.closeSlash?.();
  }

  // ── Private helpers ────────────────────────────────────────────

  /** Re-measure the textarea height. Programmatic value changes (clear, prefill,
   *  slash autocomplete) don't fire DOM `input` events, so the autosize in
   *  ViewShell never runs — leaving an expanded box stuck tall after a long send. */
  private resizeInput(): void {
    if (!this.inputEl) return;
    resizeComposerInput(this.inputEl);
    this.scheduleHighlightScrollSync();
  }

  private renderState(): void {
    this.isStreaming = this.host.getSessionState()?.isStreaming ?? false;
    this.updateControls();
  }

  private refreshReferenceState(): boolean {
    const input = this.inputEl;
    if (!input || !this.host.searchVaultReferences) {
      this.closeReferenceMenu();
      return false;
    }
    const token = findReferenceToken(input.value, input.selectionStart ?? input.value.length);
    if (!token) {
      this.closeReferenceMenu();
      return false;
    }
    const tokenChanged = this.referenceToken?.start !== token.start || this.referenceToken.query !== token.query;
    this.referenceToken = token;
    if (tokenChanged) this.referenceIndex = 0;
    const sequence = ++this.referenceSearchSequence;
    const result = this.host.searchVaultReferences(token.query);
    if (isPromiseLike(result)) {
      this.referenceMatches = [];
      this.renderReferenceMenu(true);
      void Promise.resolve(result).then((matches) => {
        if (sequence !== this.referenceSearchSequence || this.referenceToken?.query !== token.query) return;
        this.referenceMatches = matches;
        this.referenceIndex = Math.min(this.referenceIndex, Math.max(0, matches.length - 1));
        this.renderReferenceMenu();
      }, () => {
        if (sequence !== this.referenceSearchSequence) return;
        this.referenceMatches = [];
        this.renderReferenceMenu();
      });
      return true;
    }
    this.referenceMatches = result;
    this.referenceIndex = Math.min(this.referenceIndex, Math.max(0, result.length - 1));
    this.renderReferenceMenu();
    return true;
  }

  private renderReferenceMenu(loading = false): void {
    const menu = this.referenceMenuEl;
    if (!menu) return;
    menu.empty();
    menu.removeClass("is-hidden");
    menu.createDiv({ cls: "chatobby-reference-menu__title", text: "Reference a file or folder" });
    if (loading || this.referenceMatches.length === 0) {
      menu.createDiv({
        cls: "chatobby-reference-menu__empty",
        text: loading ? "Looking through this workspace…" : "No matching files or folders",
      });
      return;
    }
    const list = menu.createDiv({ cls: "chatobby-reference-menu__list", attr: { role: "listbox" } });
    this.referenceMatches.forEach((reference, index) => {
      const option = list.createEl("button", {
        cls: `chatobby-reference-menu__option${index === this.referenceIndex ? " is-active" : ""}`,
        attr: {
          type: "button",
          role: "option",
          "aria-selected": String(index === this.referenceIndex),
          "data-reference-index": String(index),
        },
      });
      const icon = option.createSpan({ cls: "chatobby-reference-menu__icon", attr: { "aria-hidden": "true" } });
      setIcon(icon, reference.kind === "folder" ? "folder" : "file-text");
      const copy = option.createSpan({ cls: "chatobby-reference-menu__copy" });
      copy.createSpan({ cls: "chatobby-reference-menu__name", text: reference.label });
      copy.createSpan({ cls: "chatobby-reference-menu__path", text: reference.path });
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => {
        this.referenceIndex = index;
        this.commitReference();
      });
    });
    menu.createDiv({
      cls: "chatobby-reference-menu__hint",
      text: "A reference names the item; it does not grant Chatobby permission to open or change it.",
    });
  }

  private moveReference(delta: 1 | -1): void {
    if (this.referenceMatches.length === 0) return;
    this.referenceIndex = (this.referenceIndex + delta + this.referenceMatches.length) % this.referenceMatches.length;
    this.renderReferenceMenu();
    window.requestAnimationFrame(() => {
      this.referenceMenuEl
        ?.querySelector<HTMLElement>(`[data-reference-index="${this.referenceIndex}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }

  private commitReference(): void {
    const input = this.inputEl;
    const token = this.referenceToken;
    const reference = this.referenceMatches[this.referenceIndex];
    if (!input || !token || !reference) return;
    const cursor = input.selectionStart ?? token.end;
    const before = input.value.slice(0, token.start);
    const after = input.value.slice(cursor).replace(/^\s+/u, "");
    input.value = `${before}${after}`;
    const nextCursor = token.start;
    input.setSelectionRange(nextCursor, nextCursor);
    this.state.text = input.value;
    if (!this.selectedReferences.some((candidate) => candidate.id === reference.id)) {
      this.selectedReferences = [...this.selectedReferences, reference];
    }
    this.closeReferenceMenu();
    this.resizeInput();
    this.refreshSlashState();
    this.renderReferences();
    this.updateControls();
  }

  private closeReferenceMenu(): void {
    this.referenceSearchSequence += 1;
    this.referenceToken = null;
    this.referenceMatches = [];
    this.referenceIndex = 0;
    this.referenceMenuEl?.empty();
    this.referenceMenuEl?.addClass("is-hidden");
  }

  private renderReferences(remeasure = true): void {
    const rail = this.referenceRailEl;
    if (!rail) return;
    if (remeasure) {
      this.referencesCollapsed = false;
      this.referenceExpandedWidth = 0;
    }
    this.referenceSummaryButton = null;
    rail.empty();
    const empty = this.selectedReferences.length === 0;
    rail.toggleClass("is-hidden", empty);
    if (empty) {
      this.referencePanelOpen = false;
      this.referencePanelIndex = 0;
      this.renderReferencePanel();
      return;
    }

    if (this.referencesCollapsed && this.selectedReferences.length > 1) {
      this.renderReferenceSummary(rail);
      this.renderReferencePanel();
      return;
    }

    for (const reference of this.selectedReferences) {
      const chip = rail.createDiv({ cls: "chatobby-reference-chip" });
      const open = chip.createEl("button", {
        cls: "chatobby-reference-chip__open",
        attr: { type: "button", title: reference.localPath ?? reference.vaultRelativePath ?? reference.path },
      });
      open.createSpan({ cls: "chatobby-reference-chip__icon", text: "@", attr: { "aria-hidden": "true" } });
      open.createSpan({ cls: "chatobby-reference-chip__label", text: referenceChipLabel(reference) });
      open.addEventListener("click", () => this.host.openVaultReference?.(reference));
      const remove = chip.createEl("button", {
        cls: "chatobby-reference-chip__remove",
        attr: { type: "button", "aria-label": `Remove ${reference.label}` },
      });
      setIcon(remove, "x");
      remove.addEventListener("click", () => this.removeReference(reference.id));
    }
    this.referencePanelOpen = false;
    this.renderReferencePanel();
    this.scheduleReferenceOverflowCheck();
  }

  private renderReferenceSummary(rail: HTMLElement): void {
    const button = rail.createEl("button", {
      cls: "chatobby-reference-summary",
      attr: {
        type: "button",
        title: `${this.selectedReferences.length} selected references`,
        "aria-expanded": String(this.referencePanelOpen),
        "aria-controls": this.referencePanelId,
      },
    });
    this.referenceSummaryButton = button;
    button.createSpan({ cls: "chatobby-reference-summary__at", text: "@", attr: { "aria-hidden": "true" } });
    button.createSpan({ cls: "chatobby-reference-summary__label", text: `${this.selectedReferences.length} references` });
    button.addEventListener("click", () => {
      this.referencePanelOpen = !this.referencePanelOpen;
      this.referencePanelIndex = Math.min(this.referencePanelIndex, this.selectedReferences.length - 1);
      this.renderReferencePanel();
      button.setAttr("aria-expanded", String(this.referencePanelOpen));
      if (this.referencePanelOpen) window.requestAnimationFrame(() => this.referencePanelEl?.focus());
    });
  }

  private renderReferencePanel(): void {
    const panel = this.referencePanelEl;
    if (!panel) return;
    panel.empty();
    panel.id = this.referencePanelId;
    const visible = this.referencePanelOpen && this.referencesCollapsed && this.selectedReferences.length > 1;
    panel.toggleClass("is-hidden", !visible);
    panel.toggleClass("is-open", visible);
    if (!visible) return;

    const list = panel.createDiv({ cls: "chatobby-reference-panel__list" });
    this.selectedReferences.forEach((reference, index) => {
      const row = list.createDiv({
        cls: `chatobby-reference-panel__row${index === this.referencePanelIndex ? " is-active" : ""}`,
        attr: { "data-reference-panel-index": String(index), role: "option", "aria-selected": String(index === this.referencePanelIndex) },
      });
      const open = row.createEl("button", {
        cls: "chatobby-reference-panel__open",
        attr: { type: "button", title: reference.localPath ?? reference.vaultRelativePath ?? reference.path },
      });
      open.createSpan({ cls: "chatobby-reference-panel__at", text: "@", attr: { "aria-hidden": "true" } });
      const copy = open.createSpan({ cls: "chatobby-reference-panel__copy" });
      copy.createSpan({ cls: "chatobby-reference-panel__name", text: referenceChipLabel(reference) });
      copy.createSpan({ cls: "chatobby-reference-panel__path", text: reference.relativePath ?? reference.path });
      open.addEventListener("click", () => this.host.openVaultReference?.(reference));
      const remove = row.createEl("button", {
        cls: "chatobby-reference-panel__remove",
        attr: { type: "button", "aria-label": `Remove ${reference.label}` },
      });
      setIcon(remove, "x");
      remove.addEventListener("click", () => this.removeReference(reference.id, true));
    });
  }

  private removeReference(referenceId: string, keepPanel = false): void {
    this.selectedReferences = this.selectedReferences.filter((candidate) => candidate.id !== referenceId);
    this.referencePanelIndex = Math.min(this.referencePanelIndex, Math.max(0, this.selectedReferences.length - 1));
    if (keepPanel && this.selectedReferences.length > 1) {
      this.referencesCollapsed = true;
      this.referencePanelOpen = true;
      this.renderReferences(false);
      window.requestAnimationFrame(() => this.referencePanelEl?.focus());
    } else {
      this.referencePanelOpen = false;
      this.renderReferences();
      this.inputEl?.focus();
    }
    this.updateControls();
  }

  private scheduleReferenceOverflowCheck(): void {
    if (this.referenceMeasureFrame) window.cancelAnimationFrame(this.referenceMeasureFrame);
    this.referenceMeasureFrame = window.requestAnimationFrame(() => {
      this.referenceMeasureFrame = 0;
      const rail = this.referenceRailEl;
      if (!rail || this.selectedReferences.length <= 1 || this.referencesCollapsed) return;
      this.referenceExpandedWidth = rail.scrollWidth;
      if (rail.clientWidth <= 0 || rail.scrollWidth <= rail.clientWidth + 1) return;
      this.referencesCollapsed = true;
      this.renderReferences(false);
    });
  }

  private reconcileReferenceOverflow(): void {
    const rail = this.referenceRailEl;
    if (!rail || this.selectedReferences.length <= 1) return;
    if (this.referencesCollapsed) {
      if (this.referenceExpandedWidth > 0 && rail.clientWidth >= this.referenceExpandedWidth) this.renderReferences();
      return;
    }
    this.scheduleReferenceOverflowCheck();
  }

  private handleReferencePanelKey(event: KeyboardEvent): void {
    if (!this.referencePanelOpen || this.selectedReferences.length === 0) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.referencePanelOpen = false;
      this.renderReferencePanel();
      this.referenceSummaryButton?.setAttr("aria-expanded", "false");
      this.referenceSummaryButton?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (event.key === "Home") this.referencePanelIndex = 0;
      else if (event.key === "End") this.referencePanelIndex = this.selectedReferences.length - 1;
      else {
        const delta = event.key === "ArrowDown" ? 1 : -1;
        this.referencePanelIndex = (this.referencePanelIndex + delta + this.selectedReferences.length)
          % this.selectedReferences.length;
      }
      this.renderReferencePanel();
      window.requestAnimationFrame(() => {
        this.referencePanelEl
          ?.querySelector<HTMLElement>(`[data-reference-panel-index="${this.referencePanelIndex}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const reference = this.selectedReferences[this.referencePanelIndex];
      if (reference) this.host.openVaultReference?.(reference);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const reference = this.selectedReferences[this.referencePanelIndex];
      if (reference) this.removeReference(reference.id, true);
    }
  }

  private promptText(text: string): string {
    const prompt = text.trim();
    const references = this.selectedReferences.map((reference) => {
      const path = reference.kind === "folder"
        ? `${reference.promptPath.replace(/[\\/]$/u, "")}/`
        : reference.promptPath;
      return `@[[${path}]]`;
    });
    return [prompt, ...references].filter(Boolean).join(" ");
  }

  private setPromptInFlight(promptInFlight: boolean): void {
    this.promptInFlight = promptInFlight;
    if (!promptInFlight) this.disarmAbortConfirm();
    this.updateControls();
  }

  private isTurnActive(): boolean {
    const session = this.host.getSessionState();
    return this.promptInFlight || this.recoverableSubmission !== null || this.retractionPending ||
      this.committedTurnPending || this.isStreaming ||
      session?.isStreaming === true || session?.isCompacting === true;
  }

  private updateControls(): void {
    const turnActive = this.isTurnActive();
    const empty = this.state.text.trim().length === 0 && this.state.attachments.length === 0 && this.selectedReferences.length === 0;
    const submittingInteraction = this.activeInteraction?.method === "input";

    // One morphing slot: send while idle, stop while a turn runs. Same circle, same place.
    // Send is disabled when the box is empty (nothing to send). Stop only exists mid-turn.
    if (this.sendBtn) {
      this.sendBtn.toggleClass("is-hidden", turnActive && !submittingInteraction);
      this.sendBtn.disabled = submittingInteraction ? false : turnActive || empty || this.activeInteraction !== null;
      this.sendBtn.setAttr("aria-label", submittingInteraction ? "Submit response" : "Send message");
      this.sendBtn.setAttr("title", submittingInteraction ? "Submit response" : "Send message");
    }

		if (this.stopBtn) {
			this.stopBtn.toggleClass("is-hidden", !turnActive || submittingInteraction);
			this.stopBtn.disabled = !turnActive || submittingInteraction || this.isStopping || !this.host.canAbort();
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
        const pendingPrompt = this.promptInFlight && !this.slashCommandInFlight;
        setIcon(this.stopBtn, pendingPrompt ? "x" : "square");
        this.stopBtn.setAttr("aria-label", pendingPrompt ? "Cancel pending send" : "Stop current turn");
        this.stopBtn.setAttr("title", pendingPrompt ? "Cancel pending send" : "Stop current turn");
				this.stopBtn.removeClass("is-confirming");
				this.stopBtn.removeClass("is-stopping");
			}
    }
  }

  private renderInteractionContext(): void {
    const rail = this.interactionRailEl;
    if (!rail) return;
    rail.empty();
    const interaction = this.activeInteraction;
    rail.toggleClass("is-hidden", interaction === null);
    if (!interaction) return;
    const icon = rail.createSpan({ cls: "chatobby-interaction-rail__icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, "shield-question");
    const copy = rail.createDiv({ cls: "chatobby-interaction-rail__copy" });
    const display = interactionCopy(interaction.params, "Response requested");
    copy.createDiv({ cls: "chatobby-interaction-rail__title", text: display.title });
    const message = display.message;
    if (message) {
      copy.createDiv({
        cls: "chatobby-interaction-rail__summary",
        text: truncateInteractionSummary(message),
        attr: { title: message },
      });
    }
  }

  private confirmAbortWithEscape(): void {
    if (this.abortConfirmArmed) {
      this.disarmAbortConfirm();
      this.abortAcceptedTurn();
      return;
    }
    this.abortConfirmArmed = true;
    if (this.abortConfirmTimer) window.clearTimeout(this.abortConfirmTimer);
    this.abortConfirmTimer = window.setTimeout(() => {
      this.abortConfirmTimer = null;
      this.disarmAbortConfirm();
    }, ABORT_CONFIRM_TIMEOUT_MS);
    this.updateControls();
  }

  private canRetractOnFirstEscape(): boolean {
    if (this.promptInFlight) return true;
    this.observeTurnProgress();
    return this.recoverableSubmission !== null;
  }

  private disarmAbortConfirm(): void {
    if (!this.abortConfirmArmed && !this.abortConfirmTimer) return;
    this.abortConfirmArmed = false;
    if (this.abortConfirmTimer) window.clearTimeout(this.abortConfirmTimer);
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
    this.pendingSubmissionDraft = null;
    this.pendingSubmissionDraftRestored = false;
    this.activePendingSendId = null;
    this.slashCommandInFlight = false;
    this.setPromptInFlight(false);
    this.setStopping(false);
  }

  private acceptSubmittedDraft(
    draft: ComposerDraftSnapshot,
    outputMarker: string,
    submissionId: string | undefined,
    trackCommittedTurn: boolean,
    alreadyCleared = false,
  ): void {
    this.resetHistoryNavigation();
    if (submissionId) {
      this.recoverableSubmission = { draft, outputMarker, submissionId };
      this.committedTurnPending = false;
      if (!alreadyCleared) this.clearDraft(false);
      this.restoreStashedDraftIfComposerEmpty();
      this.observeTurnProgress();
      return;
    }
    if (draft.text.trim()) this.submittedPromptHistory.push(draft.text);
    this.committedTurnPending = trackCommittedTurn;
    if (alreadyCleared) {
      this.releaseDraftAttachments(draft);
    } else {
      this.clearDraft(true);
    }
    this.restoreStashedDraftIfComposerEmpty();
  }

  private restorePendingSubmissionDraft(): void {
    const draft = this.pendingSubmissionDraft;
    if (!draft || this.pendingSubmissionDraftRestored) return;
    if (this.state.text.length > 0 || this.state.attachments.length > 0 || this.selectedReferences.length > 0) return;
    this.restoreDraft(draft);
    this.pendingSubmissionDraftRestored = true;
  }

  private removeRestoredPendingDraft(text: string, attachmentIds: readonly string[]): void {
    if (!this.pendingSubmissionDraftRestored || !this.submittedDraftIsCurrent(text, attachmentIds)) return;
    this.clearDraft(false);
    this.pendingSubmissionDraftRestored = false;
  }

  private restoreStashedDraftIfComposerEmpty(): void {
    if (this.state.text.length > 0 || this.state.attachments.length > 0 || this.selectedReferences.length > 0) return;
    this.restoreStashedDraft();
  }

  private abortAcceptedTurn(): void {
    this.observeTurnProgress();
    const recoverable = this.recoverableSubmission;
    if (!recoverable || !this.host.retractPrompt) {
      this.commitRecoverableSubmission(true);
      this.host.abort();
      return;
    }

    this.retractionPending = true;
    this.setStopping(true);
    void this.host.retractPrompt(recoverable.submissionId, recoverable.draft.text).then(
      (result) => {
        this.retractionPending = false;
        if (result.retracted) {
          this.recoverableSubmission = null;
          this.committedTurnPending = false;
          if (this.state.text.trim() || this.state.attachments.length > 0 || this.selectedReferences.length > 0) {
            this.replaceStashedDraft(this.captureDraft());
          }
          this.restoreDraft(recoverable.draft);
          this.setStopping(false);
          return;
        }
        this.commitRecoverableSubmission(true);
        if (result.reason !== "output-started") this.host.abort();
        this.updateControls();
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
    this.updateControls();
  }

  private currentTurnOutputMarker(): string {
    return this.host.getTurnOutputMarker?.() ?? "";
  }

  private commitRecoverableSubmission(trackCommittedTurn: boolean): void {
    const recoverable = this.recoverableSubmission;
    if (!recoverable) return;
    this.recoverableSubmission = null;
    if (recoverable.draft.text.trim()) this.submittedPromptHistory.push(recoverable.draft.text);
    this.releaseDraftAttachments(recoverable.draft);
    this.committedTurnPending = trackCommittedTurn;
  }

  private stashCurrentDraft(): void {
    if (!this.state.text.trim() && this.state.attachments.length === 0 && this.selectedReferences.length === 0) {
      return;
    }
    this.replaceStashedDraft(this.captureDraft());
    this.clearDraft(false);
    new Notice("Draft stashed. It will return after your next message.");
  }

  private restoreStashExplicitly(): void {
    if (!this.stashedDraft) return;
    if (this.state.text.trim() || this.state.attachments.length > 0 || this.selectedReferences.length > 0) {
      new Notice("Clear the composer before restoring the stashed draft.");
      return;
    }
    this.restoreStashedDraft();
    new Notice("Stashed draft restored.");
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
    this.applyHistoryText(history[this.historyIndex] ?? this.historyDraft, "start");
    return true;
  }

  private recallNextMessage(): boolean {
    if (this.historyIndex === null || !this.inputEl) return false;
    if (this.inputEl.selectionStart !== this.state.text.length || this.inputEl.selectionEnd !== this.state.text.length) {
      return false;
    }
    const history = mergePromptHistory(this.host.getPromptHistory?.() ?? [], this.submittedPromptHistory);
    if (this.historyIndex < history.length - 1) {
      this.historyIndex += 1;
      this.applyHistoryText(history[this.historyIndex] ?? this.historyDraft, "end");
      return true;
    }
    const draft = this.historyDraft;
    this.historyIndex = null;
    this.historyDraft = "";
    this.applyHistoryText(draft, "end");
    return true;
  }

  private applyHistoryText(text: string, cursor: "start" | "end"): void {
    this.state.text = text;
    this.selectedReferences = [];
    this.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    if (this.inputEl) {
      this.inputEl.value = text;
      const offset = cursor === "start" ? 0 : text.length;
      this.inputEl.setSelectionRange(offset, offset);
    }
    this.resizeInput();
    this.updateControls();
    this.refreshSlashState();
    this.renderReferences();
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
      references: [...this.selectedReferences],
    };
  }

  private restoreDraft(draft: ComposerDraftSnapshot): void {
    this.state.text = draft.text;
    this.state.attachments = [...draft.attachments];
    this.activations = draft.activations.map((activation) => ({ ...activation }));
    this.selectedReferences = [...draft.references];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    this.resetHistoryNavigation();
    if (this.inputEl) this.inputEl.value = draft.text;
    this.resizeInput();
    this.updateControls();
    this.refreshSlashState();
    this.renderAttachments();
    this.renderReferences();
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
    const bar = actions.closest<HTMLElement>(".chatobby-composer-bar");
    const attachmentHost = bar ?? actions;
    this.attachInputEl = card.createEl("input", {
      cls: "chatobby-attachment-input",
      attr: { type: "file", accept: COMPOSER_ATTACHMENT_ACCEPT, multiple: "true", tabindex: "-1" },
    });
    this.attachBtn = attachmentHost.createEl("button", {
      cls: "chatobby-attach-btn",
      attr: { type: "button", "aria-label": "Attach files", title: "Attach files" },
    });
    setIcon(this.attachBtn, "plus");
    if (bar) {
      bar.insertBefore(this.attachBtn, bar.firstElementChild);
    } else if (this.sendBtn) {
      actions.insertBefore(this.attachBtn, this.sendBtn);
    }
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
      const visual = attachmentVisual(
        attachment.name,
        attachment.delivery === "image" ? "image" : attachment.delivery === "text" ? "text" : "file",
      );
      item.dataset.fileKind = visual.kind;
      item.setAttr("title", attachment.name);
      if (attachment.previewUrl) {
        item.createEl("img", {
          cls: "chatobby-attachment-chip__thumb",
          attr: { src: attachment.previewUrl, alt: attachment.name },
        });
      } else {
        const icon = item.createSpan({ cls: "chatobby-attachment-chip__icon", attr: { "aria-hidden": "true" } });
        setIcon(icon, visual.icon);
      }
      const body = item.createDiv({ cls: "chatobby-attachment-chip__body" });
      body.createDiv({ cls: "chatobby-attachment-chip__name", text: attachment.name, attr: { title: attachment.name } });
      body.createDiv({
        cls: "chatobby-attachment-chip__meta",
        text: attachmentMeta(
          attachment.name,
          attachment.delivery.charAt(0).toUpperCase() + attachment.delivery.slice(1),
          attachment.sizeBytes,
        ),
      });
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
    // A pre-wrap div otherwise drops the textarea's final empty visual line,
    // which makes the mirrored glyphs drift from the native caret after a
    // trailing newline.
    if (this.state.text.length === 0 || this.state.text.endsWith("\n")) {
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

  private scheduleHighlightScrollSync(): void {
    this.syncHighlightScroll();
    if (this.highlightSyncFrame) return;
    this.highlightSyncFrame = window.requestAnimationFrame(() => {
      this.highlightSyncFrame = 0;
      this.syncHighlightScroll();
    });
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

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
	return typeof value === "object" && value !== null && "then" in value;
}

interface ReferenceToken {
  readonly start: number;
  readonly end: number;
  readonly query: string;
}

function findReferenceToken(text: string, cursor: number): ReferenceToken | null {
  if (cursor <= 0 || cursor > text.length) return null;
  let start = cursor - 1;
  while (start >= 0 && !isReferenceBoundary(text[start])) start -= 1;
  start += 1;
  if (text[start] !== "@") return null;
  if (start > 0 && !isReferenceBoundary(text[start - 1])) return null;
  const query = text.slice(start + 1, cursor);
  if (query.includes("[") || query.includes("]")) return null;
  return { start, end: cursor, query };
}

function isReferenceBoundary(character: string | undefined): boolean {
  return character === undefined || character === " " || character === "\n" || character === "\t";
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
  references: ComposerVaultReference[];
}

interface RecoverableSubmission {
  draft: ComposerDraftSnapshot;
  outputMarker: string;
  submissionId: string;
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

function referenceChipLabel(reference: ComposerVaultReference): string {
  if (reference.kind === "file") return reference.label;
  const path = reference.relativePath || reference.label;
  return `${path.replace(/[\\/]$/u, "")}/`;
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

function truncateInteractionSummary(message: string): string {
  const normalized = message.replace(/\s+/gu, " ").trim();
  return normalized.length <= 160 ? normalized : `${normalized.slice(0, 157).trimEnd()}…`;
}
