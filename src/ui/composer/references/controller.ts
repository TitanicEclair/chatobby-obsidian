import { setIcon } from "obsidian";
import type { ComposerVaultReference } from "./search";

interface ReferenceHost {
  search?(query: string): readonly ComposerVaultReference[] | Promise<readonly ComposerVaultReference[]>;
  open?(reference: ComposerVaultReference): void;
  onTextChange(text: string): void;
  onSelectionChange(): void;
}
interface ReferenceBinding {
  readonly owner: Window;
  readonly frames: Set<number>;
}
let referencePanelSequence = 0;

/** Owns reference presentation for one bound composer surface; never grants tool access.
 * @see docs/api/composer.md
 */
export class ComposerReferences {
  private binding: ReferenceBinding | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private referenceMenuEl: HTMLElement | null = null;
  private referencePanelEl: HTMLElement | null = null;
  private referenceRailEl: HTMLElement | null = null;
  private referenceSummaryButton: HTMLButtonElement | null = null;
  private referenceToken: ReferenceToken | null = null;
  private cancelledReferenceStart: number | null = null;
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
  private readonly referencePanelId = `chatobby-composer-reference-panel-${++referencePanelSequence}`;

  constructor(private readonly host: ReferenceHost) {}

  get selection(): readonly ComposerVaultReference[] { return this.selectedReferences; }

  /** Composer snapshots remain the sole owner of stashed/submitted draft history. */
  replaceSelection(references: readonly ComposerVaultReference[]): void {
    this.closeReferenceMenu();
    this.cancelledReferenceStart = null;
    this.selectedReferences = [...references];
  }

  bind(input: HTMLTextAreaElement, card: HTMLElement | null, anchors: { menu: HTMLElement | null; rail: HTMLElement | null }): void {
    this.destroy();
    const owner = input.ownerDocument.defaultView;
    if (!card || !owner) return;
    const binding = this.binding = { owner, frames: new Set<number>() };
    this.inputEl = input;
    this.referenceMenuEl = card.createDiv({ cls: "chatobby-reference-menu is-hidden" });
    this.referencePanelEl = card.createDiv({ cls: "chatobby-reference-panel is-hidden",
      attr: { tabindex: "-1", role: "listbox", "aria-label": "Selected references" } });
    this.referenceRailEl = card.createDiv({ cls: "chatobby-reference-rail is-hidden" });
    this.listen(this.referencePanelEl, "keydown", event => this.handleReferencePanelKey(event));
    const wrap = card.querySelector(".chatobby-input-wrap");
    card.insertBefore(this.referenceMenuEl, anchors.menu ?? wrap);
    card.insertBefore(this.referencePanelEl, anchors.menu ?? wrap);
    card.insertBefore(this.referenceRailEl, anchors.rail ?? wrap);
    if (typeof owner.ResizeObserver !== "undefined") {
      this.referenceResizeObserver = new owner.ResizeObserver(() => {
        if (this.binding === binding) this.reconcileReferenceOverflow();
      });
      this.referenceResizeObserver.observe(this.referenceRailEl);
    }
    this.render();
  }

  destroy(): void {
    const binding = this.binding;
    this.binding = null; // Retire before cancellation: already queued callbacks may still arrive.
    if (binding) for (const frame of binding.frames) binding.owner.cancelAnimationFrame(frame);
    this.referenceMeasureFrame = 0;
    this.referenceResizeObserver?.disconnect();
    this.referenceResizeObserver = null;
    this.closeReferenceMenu();
    this.cancelledReferenceStart = null;
    this.referencePanelOpen = false;
    for (const element of [this.referenceMenuEl, this.referencePanelEl, this.referenceRailEl]) element?.remove();
    this.inputEl = this.referenceMenuEl = this.referencePanelEl = this.referenceRailEl = this.referenceSummaryButton = null;
  }

  closePanel(): void { this.referencePanelOpen = false; this.renderReferencePanel(); }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) return true;
    const panel = this.referencePanelEl;
    // Obsidian's scope can reach us before the focused panel's DOM listener.
    if (panel?.contains(panel.ownerDocument.activeElement) && this.handleReferencePanelKey(event)) return true;
    if (!this.referenceToken || this.referenceMenuEl?.hasClass("is-hidden")) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); this.moveReference(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault(); this.commitReference();
    } else if (event.key === "Escape") {
      event.preventDefault(); this.closeReferenceMenu(true);
    } else return false;
    return true;
  }

  private contains(element: HTMLElement): boolean {
    return [this.referenceMenuEl, this.referencePanelEl, this.referenceRailEl].some(root => root?.contains(element));
  }

  private listen<K extends keyof HTMLElementEventMap>(element: HTMLElement, name: K, handler: (event: HTMLElementEventMap[K]) => void): void {
    const binding = this.binding;
    element.addEventListener(name, event => {
      if (binding && this.binding === binding && this.contains(element)) handler(event);
    });
  }

  private scheduleFrame(callback: () => void): number {
    const binding = this.binding;
    if (!binding) return 0;
    const id = binding.owner.requestAnimationFrame(() => {
      if (binding.frames.delete(id) && this.binding === binding) callback();
    });
    binding.frames.add(id);
    return id;
  }

  private cancelFrame(id: number): void {
    this.binding?.owner.cancelAnimationFrame(id);
    this.binding?.frames.delete(id);
  }

  private focusPanel(): void {
    const panel = this.referencePanelEl, focused = panel?.ownerDocument.activeElement;
    this.scheduleFrame(() => {
      if (panel && this.referencePanelEl === panel && this.referencePanelOpen
        && panel.ownerDocument.activeElement === focused) panel.focus();
    });
  }

  private scrollOption(element: HTMLElement | null | undefined): void {
    if (!element) return;
    this.scheduleFrame(() => {
      if (this.contains(element)) element.scrollIntoView({ block: "nearest" });
    });
  }

  refresh(): boolean {
    const input = this.inputEl;
    if (!this.binding || !input || !this.host.search) {
      this.closeReferenceMenu();
      return false;
    }
    let token = findReferenceToken(input.value, input.selectionStart ?? input.value.length);
    if (this.cancelledReferenceStart !== null) {
      if (input.value[this.cancelledReferenceStart] !== "@") {
        this.cancelledReferenceStart = null;
      } else if (token?.start === this.cancelledReferenceStart) {
        token = null;
      } else if (token && token.start > this.cancelledReferenceStart) {
        this.cancelledReferenceStart = null;
      }
    }
    if (!token) {
      this.closeReferenceMenu();
      return false;
    }
    const tokenChanged = this.referenceToken?.start !== token.start || this.referenceToken.query !== token.query;
    this.referenceToken = token;
    if (tokenChanged) this.referenceIndex = 0;
    const binding = this.binding;
    const sequence = ++this.referenceSearchSequence;
    const result = this.host.search(token.query);
    if (typeof result === "object" && result !== null && "then" in result) {
      this.referenceMatches = [];
      this.renderReferenceMenu(true);
      void Promise.resolve(result).then((matches) => {
        if (this.binding !== binding || sequence !== this.referenceSearchSequence || this.referenceToken?.query !== token.query) return;
        this.referenceMatches = matches;
        this.referenceIndex = Math.min(this.referenceIndex, Math.max(0, matches.length - 1));
        this.renderReferenceMenu();
      }, () => {
        if (this.binding !== binding || sequence !== this.referenceSearchSequence) return;
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
      this.listen(option, "pointerdown", (event) => event.preventDefault());
      this.listen(option, "click", () => {
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
    this.scrollOption(this.referenceMenuEl?.querySelector<HTMLElement>(`[data-reference-index="${this.referenceIndex}"]`));
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
    if (!this.selectedReferences.some((candidate) => candidate.id === reference.id)) {
      this.selectedReferences = [...this.selectedReferences, reference];
    }
    this.closeReferenceMenu();
    this.host.onTextChange(input.value);
    this.render();
    this.host.onSelectionChange();
  }

  private closeReferenceMenu(cancelled = false): void {
    if (cancelled && this.referenceToken) this.cancelledReferenceStart = this.referenceToken.start;
    this.referenceSearchSequence += 1;
    this.referenceToken = null;
    this.referenceMatches = [];
    this.referenceIndex = 0;
    this.referenceMenuEl?.empty();
    this.referenceMenuEl?.addClass("is-hidden");
  }

  render(remeasure = true): void {
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

    this.renderReferenceChips(rail);
    this.referencePanelOpen = false;
    this.renderReferencePanel();
    this.scheduleReferenceOverflowCheck();
  }

  private renderReferenceChips(rail: HTMLElement): void {
    for (const reference of this.selectedReferences) {
      const chip = rail.createDiv({ cls: "chatobby-reference-chip" });
      this.renderReferenceControls(chip, reference, false);
    }
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
    this.listen(button, "click", () => {
      this.referencePanelOpen = !this.referencePanelOpen;
      this.referencePanelIndex = Math.min(this.referencePanelIndex, this.selectedReferences.length - 1);
      this.renderReferencePanel();
      button.setAttr("aria-expanded", String(this.referencePanelOpen));
      if (this.referencePanelOpen) this.focusPanel();
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
      this.renderReferenceControls(row, reference, true);
    });
  }

  private renderReferenceControls(container: HTMLElement, reference: ComposerVaultReference, panel: boolean): void {
    const prefix = panel ? "chatobby-reference-panel" : "chatobby-reference-chip";
    const open = container.createEl("button", {
      cls: `${prefix}__open`,
      attr: { type: "button", title: reference.localPath ?? reference.vaultRelativePath ?? reference.path },
    });
    open.createSpan({ cls: `${prefix}__${panel ? "at" : "icon"}`, text: "@", attr: { "aria-hidden": "true" } });
    if (panel) {
      const copy = open.createSpan({ cls: `${prefix}__copy` });
      copy.createSpan({ cls: `${prefix}__name`, text: referenceChipLabel(reference) });
      copy.createSpan({ cls: `${prefix}__path`, text: reference.relativePath ?? reference.path });
    } else open.createSpan({ cls: `${prefix}__label`, text: referenceChipLabel(reference) });
    this.listen(open, "click", () => this.host.open?.(reference));
    const remove = container.createEl("button", {
      cls: `${prefix}__remove`, attr: { type: "button", "aria-label": `Remove ${reference.label}` },
    });
    setIcon(remove, "x");
    this.listen(remove, "click", () => this.removeReference(reference.id, panel));
  }

  private removeReference(referenceId: string, keepPanel = false): void {
    this.selectedReferences = this.selectedReferences.filter((candidate) => candidate.id !== referenceId);
    this.referencePanelIndex = Math.min(this.referencePanelIndex, Math.max(0, this.selectedReferences.length - 1));
    if (keepPanel && this.selectedReferences.length > 1) {
      this.referencesCollapsed = true;
      this.referencePanelOpen = true;
      const rail = this.referenceRailEl;
      if (rail) {
        // Measure this selection synchronously, without hiding the focused panel.
        // Keep it open until a real width increase, even if the remaining chips fit.
        rail.empty();
        this.renderReferenceChips(rail);
        this.referenceExpandedWidth = Math.max(rail.scrollWidth, rail.clientWidth + 1);
      }
      this.render(false);
      this.focusPanel();
    } else {
      this.referencePanelOpen = false;
      this.render();
      this.inputEl?.focus();
    }
    this.host.onSelectionChange();
  }

  private scheduleReferenceOverflowCheck(): void {
    if (this.referenceMeasureFrame) this.cancelFrame(this.referenceMeasureFrame);
    this.referenceMeasureFrame = this.scheduleFrame(() => {
      this.referenceMeasureFrame = 0;
      const rail = this.referenceRailEl;
      if (!rail || this.selectedReferences.length <= 1 || this.referencesCollapsed) return;
      this.referenceExpandedWidth = rail.scrollWidth;
      if (rail.clientWidth <= 0 || rail.scrollWidth <= rail.clientWidth + 1) return;
      this.referencesCollapsed = true;
      this.render(false);
    });
  }

  private reconcileReferenceOverflow(): void {
    const rail = this.referenceRailEl;
    if (!rail || this.selectedReferences.length <= 1) return;
    if (this.referencesCollapsed) {
      if (this.referenceExpandedWidth > 0 && rail.clientWidth >= this.referenceExpandedWidth) this.render();
      return;
    }
    this.scheduleReferenceOverflowCheck();
  }

  private handleReferencePanelKey(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) return true;
    if (!this.referencePanelOpen || this.selectedReferences.length === 0) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      this.referencePanelOpen = false;
      this.renderReferencePanel();
      this.referenceSummaryButton?.setAttr("aria-expanded", "false");
      this.referenceSummaryButton?.focus();
      return true;
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
      this.scrollOption(this.referencePanelEl?.querySelector<HTMLElement>(`[data-reference-panel-index="${this.referencePanelIndex}"]`));
      return true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const reference = this.selectedReferences[this.referencePanelIndex];
      if (reference) this.host.open?.(reference);
      return true;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const reference = this.selectedReferences[this.referencePanelIndex];
      if (reference) this.removeReference(reference.id, true);
      return true;
    }
    return false;
  }

}

interface ReferenceToken {
  readonly start: number;
  readonly end: number;
  readonly query: string;
}

function findReferenceToken(text: string, cursor: number): ReferenceToken | null {
  if (cursor <= 0 || cursor > text.length) return null;
  let start = text.lastIndexOf("@", cursor - 1);
  while (start >= 0 && start > 0 && !isReferenceBoundary(text[start - 1])) {
    start = text.lastIndexOf("@", start - 1);
  }
  if (start < 0) return null;
  const query = text.slice(start + 1, cursor);
  if (query.includes("[") || query.includes("]")) return null;
  return { start, end: cursor, query };
}

function isReferenceBoundary(character: string | undefined): boolean {
  return character === undefined || character === " " || character === "\n" || character === "\t";
}

function referenceChipLabel(reference: ComposerVaultReference): string {
  if (reference.kind === "file") return reference.label;
  const path = reference.relativePath || reference.label;
  return `${path.replace(/[\\/]$/u, "")}/`;
}
