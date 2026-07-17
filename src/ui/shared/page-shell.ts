import { setIcon } from "obsidian";
import { chatobbyPerformance } from "../../frontend/performance-monitor";

export interface PageHeaderElements {
  readonly header: HTMLElement;
  readonly title: HTMLElement;
  readonly actions: HTMLElement;
}

interface PageHeaderOptions {
  readonly title: string;
  readonly headerClass?: string;
  readonly titleClass?: string;
  readonly actionsClass?: string;
}

interface PageIconButtonOptions {
  readonly className?: string;
}

interface PageTabOptions {
  readonly label: string;
  readonly active: boolean;
  readonly className?: string;
  readonly count?: number;
  readonly countClass?: string;
}

/** Shared visual and semantic shell for every full-page Chatobby surface. */
export function createPageHeader(parent: HTMLElement, options: PageHeaderOptions): PageHeaderElements {
	chatobbyPerformance.recordPageRender(options.title.toLowerCase());
  const header = parent.createDiv({ cls: classes("chatobby-page__header", options.headerClass) });
  const title = header.createDiv({
    cls: classes("chatobby-page__title", options.titleClass),
    text: options.title,
  });
  const actions = header.createDiv({
    cls: classes("chatobby-page__header-actions", options.actionsClass),
  });
  return { header, title, actions };
}

export function createPageIconButton(
  parent: HTMLElement,
  icon: string,
  label: string,
  options: PageIconButtonOptions = {},
): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: classes("chatobby-page__icon-button", "clickable-icon", options.className),
    attr: { type: "button", "aria-label": label, title: label },
  });
  setIcon(button, icon);
  return button;
}

export function createPageTabs(parent: HTMLElement, className?: string): HTMLElement {
  return parent.createDiv({
    cls: classes("chatobby-page__tabs", className),
    attr: { role: "tablist" },
  });
}

export function createPageTab(parent: HTMLElement, options: PageTabOptions): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: classes("chatobby-page__tab", options.className, options.active ? "is-active" : undefined),
    attr: {
      type: "button",
      role: "tab",
      "aria-selected": String(options.active),
    },
  });
  button.createSpan({ text: options.label });
  if (options.count !== undefined && options.count > 0) {
    button.createSpan({
      cls: classes("chatobby-page__tab-count", options.countClass),
      text: String(options.count),
    });
  }
  return button;
}

function classes(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
