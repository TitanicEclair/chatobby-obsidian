// Minimal modals for command surfaces that need a single string (rename, bash command, export
// path, import path) or a single choice (fork-point picker). These are functional, not the
// polished in-feed UI — that comes later. Keeps every backend command reachable from the palette.

import { App, FuzzySuggestModal, Modal } from "obsidian";

export interface PromptOptions {
  title: string;
  placeholder?: string;
  value?: string;
  submitLabel?: string;
  /** Render a <textarea> instead of an <input>; submit on Cmd/Ctrl+Enter. */
  multiline?: boolean;
}

/** Modal that resolves to the entered string, or null if cancelled. */
export class PromptModal extends Modal {
  private done = false;
  private inputEl!: HTMLInputElement | HTMLTextAreaElement;

  constructor(app: App, private opts: PromptOptions, private resolve: (value: string | null) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.opts.title);
    this.inputEl = this.opts.multiline
      ? this.contentEl.createEl("textarea", { cls: "chatobby-prompt-input", attr: { placeholder: this.opts.placeholder ?? "", rows: "4" } })
      : this.contentEl.createEl("input", { cls: "chatobby-prompt-input", attr: { type: "text", placeholder: this.opts.placeholder ?? "" } });
    this.inputEl.value = this.opts.value ?? "";

    const actions = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    const submit = actions.createEl("button", { text: this.opts.submitLabel ?? "OK", cls: "mod-cta" });
    submit.onclick = () => this.submit();

    this.inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter" && (!this.opts.multiline || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.submit();
      } else if (event.key === "Escape") {
        this.close();
      }
    });
    setTimeout(() => this.inputEl.focus(), 0);
  }

  private submit(): void {
    this.done = true;
    this.resolve(this.inputEl.value);
    this.close();
  }

  onClose(): void {
    super.onClose();
    if (!this.done) this.resolve(null);
  }
}

/** Fuzzy-suggest picker that resolves to the chosen item, or null if cancelled. */
export class PickModal<T> extends FuzzySuggestModal<T> {
  private done = false;

  constructor(
    app: App,
    private items: T[],
    private label: (item: T) => string,
    private resolve: (value: T | null) => void,
    placeholder?: string,
  ) {
    super(app);
    if (placeholder) this.setPlaceholder(placeholder);
  }

  getItems(): T[] {
    return this.items;
  }

  getItemText(item: T): string {
    return this.label(item);
  }

  onChooseItem(item: T): void {
    this.done = true;
    this.resolve(item);
  }

  onClose(): void {
    super.onClose();
    if (!this.done) this.resolve(null);
  }
}

/** Open a text-input modal. Resolves null on cancel. */
export function promptText(app: App, opts: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => new PromptModal(app, opts, resolve).open());
}

/** Open a fuzzy picker over items. Resolves null on cancel. */
export function pickItem<T>(app: App, items: T[], label: (item: T) => string, placeholder?: string): Promise<T | null> {
  return new Promise((resolve) => new PickModal(app, items, label, resolve, placeholder).open());
}
