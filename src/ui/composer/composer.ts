// Bound input, keyboard/interaction/slash routing, and ordered DOM restoration.
// Draft/submission state belongs to one instance across binds; reference
// presentation has its own bind lifetime. See docs/api/composer.md.

import { ComposerDraftState } from "./draft-state";
import { ComposerSubmissionLifecycle, isPromiseLike } from "./submission-lifecycle";
import { ComposerAttachments } from "./attachment-presentation";
import type { ComposerAttachment, ComposerDraftSnapshot, PromptSubmissionHost } from "./types";
export type { PromptSubmissionOutcome } from "./types";

import { Notice, setIcon } from "obsidian";
import { ChatobbyComponent } from "../shared/component";
import { resizeComposerInput } from "../shell/view-shell";
import type {
  ComposerKeybindings,
  InteractionState,
  SessionPreferences,
  SessionState,
  WsPromptAttachment,
} from "../../types";
import { DEFAULT_COMPOSER_KEYBINDINGS } from "../../types";
import { ABORT_CONFIRM_TIMEOUT_MS } from "../shared/constants";
import type { SlashArgumentOption, SlashCommandSpec, SlashHighlightRange, SlashParsedCommand, SlashToken } from "./slash-command";
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
import type { ComposerVaultReference } from "./references/search";
import { ComposerReferences } from "./references/controller";

/** Host interface — the view provides these to the composer. */
export interface ComposerHost extends PromptSubmissionHost {
  /** Steer a running turn (mid-generation correction). Distinct from starting a new prompt. */
  steer(message: string, attachments?: WsPromptAttachment[]): void | Promise<void>;
  /** Whether the transport can accept an abort request. */
  canAbort(): boolean;
  /** Get the current session state (null if no session). */
  getSessionState(): SessionState | null;
  /** Get current session preferences. */
  getSessionPreferences(): SessionPreferences;
  /** Focus-sensitive shortcuts configured for this Chatobby composer. */
  getComposerKeybindings?(): ComposerKeybindings;
  /** Let the current focused control picker own a key before the view scope cancels a draft/turn. */
  handleScopedControlKey?(event: KeyboardEvent): boolean;
  /** User prompts already present in the active session. */
  getPromptHistory?(): readonly string[];
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
  private readonly draft = new ComposerDraftState();
  private readonly submission: ComposerSubmissionLifecycle;
  private readonly attachments: ComposerAttachments;
  private inputEl: HTMLTextAreaElement | null = null;
  private highlightEl: HTMLElement | null = null;
  private activationRailEl: HTMLElement | null = null;
  private interactionRailEl: HTMLElement | null = null;
  private composerCardEl: HTMLElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private stopBtn: HTMLButtonElement | null = null;
	private isStreaming = false;
	private isStopping = false;
  private abortConfirmArmed = false;
  private abortConfirmTimer: number | null = null;
  private cancelledToken: { slashStart: number; tokenText: string; deletionSeen: boolean } | null = null;
  private pendingArgumentCompletion: { command: SlashParsedCommand } | null = null;
  private highlightSyncFrame = 0;
  private activeInteraction: InteractionState | null = null;
  private defaultPlaceholder = "";

  private readonly references: ComposerReferences;

  constructor(private host: ComposerHost) {
    super();
    this.submission = new ComposerSubmissionLifecycle(host, this.draft, {
      captureDraft: () => this.captureDraft(),
      clearDraft: revoke => this.clearDraft(revoke),
      restoreDraft: draft => this.restoreDraft(draft),
      restoreStashedDraftIfComposerEmpty: () => this.restoreStashedDraftIfComposerEmpty(),
      getReferences: () => this.references.selection,
      updateControls: () => this.updateControls(),
      setStopping: stopping => this.setStopping(stopping),
      disarmAbortConfirm: () => this.disarmAbortConfirm(),
    });
    this.attachments = new ComposerAttachments(host, this.draft, () => this.updateControls());
    this.references = new ComposerReferences({
      search: host.searchVaultReferences ? query => host.searchVaultReferences?.(query) ?? [] : undefined,
      open: reference => this.host.openVaultReference?.(reference),
      onTextChange: text => { this.draft.state.text = text; this.resizeInput(); this.refreshSlashState(); },
      onSelectionChange: () => this.updateControls(),
    });
  }

  protected componentClass(): string {
    return "chatobby-composer";
  }

  destroy(): void {
    if (this.highlightSyncFrame) window.cancelAnimationFrame(this.highlightSyncFrame);
    this.highlightSyncFrame = 0;
    this.references.destroy();
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
    this.interactionRailEl = card?.createDiv({ cls: "chatobby-interaction-rail is-hidden" }) ?? null;
    this.attachments.attachmentRailEl = card?.createDiv({ cls: "chatobby-attachment-rail is-hidden" }) ?? null;
    this.activationRailEl = card?.createDiv({ cls: "chatobby-activation-rail is-hidden" }) ?? null;
    if (this.attachments.attachmentRailEl && card) {
      const inputWrap = card.querySelector(".chatobby-input-wrap");
      if (inputWrap && this.interactionRailEl) card.insertBefore(this.interactionRailEl, inputWrap);
      if (inputWrap) card.insertBefore(this.attachments.attachmentRailEl, inputWrap);
      if (inputWrap && this.activationRailEl) card.insertBefore(this.activationRailEl, inputWrap);
      this.attachments.bindAttachmentEvents(card, this.inputEl);
    }
    this.references.bind(inputEl, card ?? null, { menu: this.interactionRailEl, rail: this.activationRailEl });
    if (card) this.attachments.bindAttachmentPicker(card, this.sendBtn);
    this.renderState();
  }

  /** Set streaming state — toggles send/stop button availability. */
	setStreaming(isStreaming: boolean): void {
		this.isStreaming = isStreaming;
		if (!isStreaming) {
			if (!this.submission.retractionPending) this.isStopping = false;
			this.disarmAbortConfirm();
			this.submission.finishStreaming();
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
      this.references.closePanel();
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
    return this.draft.state.text;
  }

  /** Set the input text (e.g., for prefill from command palette). */
  setText(text: string): void {
    this.disarmAbortConfirm();
    this.draft.resetHistoryNavigation();
    this.draft.state.text = text;
    this.references.replaceSelection([]);
    this.draft.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    if (this.inputEl) {
      this.inputEl.value = text;
    }
    this.resizeInput();
    this.refreshSlashState();
    this.references.render();
    this.updateControls();
  }

  /** Clear the input. */
  clear(): void {
    this.clearDraft(true);
  }

  private clearDraft(revokeAttachments: boolean): void {
    this.disarmAbortConfirm();
    this.draft.resetHistoryNavigation();
    if (revokeAttachments) this.draft.releaseDraftAttachments(this.captureDraft());
    this.draft.resetCurrent();
    this.references.replaceSelection([]);
    this.draft.activations = [];
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    if (this.inputEl) {
      this.inputEl.value = "";
    }
    this.attachments.clearPicker();
    this.resizeInput();
    this.host.closeSlash?.();
    this.renderHighlights([]);
    this.renderActivations([]);
    this.attachments.renderAttachments();
    this.references.render();
  }

  /** Send the current input. */
  send(): void {
    this.disarmAbortConfirm();
    if (this.activeInteraction) {
      if (this.activeInteraction.method === "input") {
        this.host.updateInteractionText?.(this.draft.state.text);
        this.host.submitInteraction?.();
      }
      return;
    }
    if (this.submission.promptInFlight) return;
    const rawText = this.draft.state.text;
    const text = this.promptText(rawText);
    if (!text && this.draft.state.attachments.length === 0) return;
    this.activateExactLeadingCommand();
    const commands = this.parseActivatedCommands();
    if (this.startArgumentCompletion(commands)) return;

    this.submission.send(rawText, text, commands);
  }

  /** Abort pending preparation or retract/stop an accepted turn. */
  stop(): void { this.submission.stop(); }

  /** Promote a recoverable send once a tool starts or assistant output completes. */
  observeTurnProgress(): void { this.submission.observeTurnProgress(); }

  /** Send the current input as a mid-generation steer (a correction to the running turn),
   *  not a new prompt. Only meaningful while a turn is active. */
  steer(): void {
    this.disarmAbortConfirm();
    const text = this.promptText(this.draft.state.text);
    if (!text && this.draft.state.attachments.length === 0) return;
    const attachments = this.draft.state.attachments.length > 0
      ? this.draft.state.attachments.map((attachment) => attachment.prompt)
      : undefined;
    const result = this.host.steer(text, attachments);
    this.clear();
    if (isPromiseLike(result)) void Promise.resolve(result).catch(() => { });
  }

  /** Handle keyboard shortcuts in the input. */
  handleKeydown(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
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

    if (this.references.handleKeydown(e)) return;

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
      if (this.submission.promptInFlight) {
        return;
      } else if (this.isTurnActive()) {
        // Mid-turn Enter STEERS the running turn (a correction) — it does not start a new prompt.
        if (this.draft.state.text.trim() || this.draft.state.attachments.length > 0 || this.references.selection.length > 0) this.steer();
      } else {
        this.send();
      }
    } else if (matchesComposerKeybinding(e, bindings.cancelTurn)) {
      if (this.currentToken()) {
        e.preventDefault();
        this.cancelCurrentToken();
      } else if (this.isTurnActive()) {
        e.preventDefault();
        if (this.submission.canRetractOnFirstEscape()) this.stop();
        else this.confirmAbortWithEscape();
      } else if (this.draft.state.text) {
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
    if (event.defaultPrevented) return true;
    if (applyComposerAction) {
      if (!this.host.isInteractionActive?.() && this.host.handleScopedControlKey?.(event)) return true;
      this.handleKeydown(event);
    }
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
    this.draft.resetHistoryNavigation();
    const nextText = this.inputEl?.value ?? "";
    // Forward live text to active interaction card (for input/editor types).
    if (this.host.isInteractionActive?.()) {
      this.host.updateInteractionText?.(nextText);
    }
    this.draft.activations = rebaseActivations(this.draft.activations, this.draft.state.text, nextText);
    if (this.pendingArgumentCompletion) {
      this.pendingArgumentCompletion = null;
      this.host.closeSlash?.();
    }
    if (this.inputEl) {
      this.draft.state.text = this.inputEl.value;
    }
    this.updateControls();
    // Keep the mirror current even while @ suggestions own autocomplete.
    // Ordinary prose stays native textarea text; the mirror takes over only
    // while an activated slash command needs mixed syntax colours.
    this.refreshSlashState();
    if (this.references.refresh()) this.host.closeSlash?.();
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

  private promptText(text: string): string {
    const prompt = text.trim();
    const references = this.references.selection.map((reference) => {
      const path = reference.kind === "folder"
        ? `${reference.promptPath.replace(/[\\/]$/u, "")}/`
        : reference.promptPath;
      return `@[[${path}]]`;
    });
    return [prompt, ...references].filter(Boolean).join(" ");
  }
  private isTurnActive(): boolean {
    const session = this.host.getSessionState();
    return this.submission.hasActiveTurn || this.isStreaming || session?.isStreaming === true;
  }

  private updateControls(): void {
    const turnActive = this.isTurnActive();
    const empty = this.draft.state.text.trim().length === 0 && this.draft.state.attachments.length === 0 && this.references.selection.length === 0;
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
        const pendingPrompt = this.submission.promptInFlight && !this.submission.slashCommandInFlight;
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
      this.submission.abortAcceptedTurn();
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

  private disarmAbortConfirm(): void {
    if (!this.abortConfirmArmed && !this.abortConfirmTimer) return;
    this.abortConfirmArmed = false;
    if (this.abortConfirmTimer) window.clearTimeout(this.abortConfirmTimer);
    this.abortConfirmTimer = null;
    this.updateControls();
  }

  private restoreStashedDraftIfComposerEmpty(): void {
    if (this.draft.state.text.length > 0 || this.draft.state.attachments.length > 0 || this.references.selection.length > 0) return;
    this.restoreStashedDraft();
  }

  private stashCurrentDraft(): void {
    if (!this.draft.state.text.trim() && this.draft.state.attachments.length === 0 && this.references.selection.length === 0) {
      return;
    }
    this.draft.replaceStashedDraft(this.captureDraft());
    this.clearDraft(false);
    new Notice("Draft stashed. It will return after your next message.");
  }

  private restoreStashExplicitly(): void {
    if (!this.draft.stashedDraft) return;
    if (this.draft.state.text.trim() || this.draft.state.attachments.length > 0 || this.references.selection.length > 0) {
      new Notice("Clear the composer before restoring the stashed draft.");
      return;
    }
    this.restoreStashedDraft();
    new Notice("Stashed draft restored.");
  }

  private restoreStashedDraft(): void {
    const stashed = this.draft.stashedDraft;
    if (!stashed) return;
    this.draft.stashedDraft = null;
    this.restoreDraft(stashed);
  }
  private recallPreviousMessage(): boolean {
    if (!this.inputEl || this.inputEl.selectionStart !== 0 || this.inputEl.selectionEnd !== 0) return false;
    const text = this.draft.recallPreviousMessage(this.host.getPromptHistory?.() ?? []);
    if (text === undefined) return false;
    this.applyHistoryText(text, "start");
    return true;
  }
  private recallNextMessage(): boolean {
    if (this.draft.historyIndex === null || !this.inputEl) return false;
    if (this.inputEl.selectionStart !== this.draft.state.text.length || this.inputEl.selectionEnd !== this.draft.state.text.length) {
      return false;
    }
    const text = this.draft.recallNextMessage(this.host.getPromptHistory?.() ?? []);
    this.applyHistoryText(text, "end");
    return true;
  }

  private applyHistoryText(text: string, cursor: "start" | "end"): void {
    this.draft.state.text = text;
    this.references.replaceSelection([]);
    this.draft.activations = [];
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
    this.references.render();
  }
  private captureDraft(): ComposerDraftSnapshot {
    return this.draft.captureDraft(this.references.selection);
  }

  private restoreDraft(draft: ComposerDraftSnapshot): void {
    this.draft.state.text = draft.text;
    this.draft.state.attachments = [...draft.attachments];
    this.draft.activations = draft.activations.map((activation) => ({ ...activation }));
    this.references.replaceSelection(draft.references);
    this.cancelledToken = null;
    this.pendingArgumentCompletion = null;
    this.draft.resetHistoryNavigation();
    if (this.inputEl) this.inputEl.value = draft.text;
    this.resizeInput();
    this.updateControls();
    this.refreshSlashState();
    this.attachments.renderAttachments();
    this.references.render();
    this.inputEl?.focus();
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
    if (this.draft.activations.length > 0) return;
    const match = /^(\s*)\/([A-Za-z0-9:_-]+)(?=\s|$)/.exec(this.draft.state.text);
    if (!match) return;
    const slashStart = match[1]?.length ?? 0;
    if (this.cancelledToken?.slashStart === slashStart) return;
    const name = match[2];
    if (!name || !findCommandSpec(this.commands(), name)) return;
    this.draft.activations.push({ name, slashStart });
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
    const nextText = `${this.draft.state.text.slice(0, token.slashStart)}${replacement}${this.draft.state.text.slice(token.commandEnd)}`;
    this.draft.state.text = nextText;
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
        tokenText: this.draft.state.text.slice(token.slashStart, token.commandEnd),
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

    const insert = argumentInsertPoint(this.draft.state.text, pending.command.commandRange.end);
    const leadingSpace = insert === pending.command.commandRange.end ? " " : "";
    const insertedText = `${leadingSpace}${option.value}`;
    const nextText = `${this.draft.state.text.slice(0, insert)}${insertedText}${this.draft.state.text.slice(insert)}`;
    this.draft.state.text = nextText;
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
    this.draft.activations = this.draft.activations.filter((activation) => activation.slashStart !== token.slashStart);
    this.draft.activations.push({ name: spec.name, slashStart: token.slashStart });
    this.draft.activations.sort((left, right) => left.slashStart - right.slashStart);
    const commands = this.parseActivatedCommands();
    this.renderHighlights(toHighlightRanges(commands));
    this.renderActivations(commands);
  }

  private parseActivatedCommands(): SlashParsedCommand[] {
    return parseSlashActivations(this.draft.state.text, this.commands(), this.draft.activations);
  }

  private commands(): readonly SlashCommandSpec[] {
    return this.host.getSlashCommands?.() ?? [];
  }

  private currentToken(): SlashToken | null {
    if (!this.inputEl) return null;
    return findSlashTokenAtCursor(this.draft.state.text, this.inputEl.selectionStart);
  }

  private updateCancellation(token: SlashToken | null): void {
    if (!this.cancelledToken || !token || token.slashStart !== this.cancelledToken.slashStart) return;
    const tokenText = this.draft.state.text.slice(token.slashStart, token.commandEnd);
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

    const inputWrap = this.inputEl?.closest<HTMLElement>(".chatobby-input-wrap") ?? null;
    const isSyntaxHighlighting = ranges.length > 0;
    inputWrap?.toggleClass("is-syntax-highlighting", isSyntaxHighlighting);
    this.highlightEl.toggleClass("is-active", isSyntaxHighlighting);

    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        this.highlightEl.createSpan({ cls: "chatobby-input-highlight__text", text: this.draft.state.text.slice(cursor, range.start) });
      }
      this.highlightEl.createSpan({
        cls: `chatobby-input-highlight__${range.kind}`,
        text: this.draft.state.text.slice(range.start, range.end),
      });
      cursor = range.end;
    }

    if (cursor < this.draft.state.text.length) {
      this.highlightEl.createSpan({ cls: "chatobby-input-highlight__text", text: this.draft.state.text.slice(cursor) });
    }
    // A pre-wrap div otherwise drops the textarea's final empty visual line,
    // which makes the mirrored glyphs drift from the native caret after a
    // trailing newline.
    if (this.draft.state.text.length === 0 || this.draft.state.text.endsWith("\n")) {
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

function argumentInsertPoint(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length && (text[cursor] === " " || text[cursor] === "\t")) {
    cursor += 1;
  }
  return cursor;
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

function truncateInteractionSummary(message: string): string {
  const normalized = message.replace(/\s+/gu, " ").trim();
  return normalized.length <= 160 ? normalized : `${normalized.slice(0, 157).trimEnd()}…`;
}
