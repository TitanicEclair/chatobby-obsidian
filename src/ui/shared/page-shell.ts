import { setIcon } from "obsidian";
import { chatobbyPerformance } from "../../frontend/performance-monitor";
import { isDomNodeOfType } from "./dom";

export type PageWidth = "reading" | "form" | "wide" | "full";
export type PageStatusTone = "info" | "success" | "warning" | "error";
export type PageStateKind = "loading" | "empty" | "error" | "no-results";
export type PageSurface = "plain" | "divided" | "inset";

export interface PageHeaderElements {
  readonly header: HTMLElement;
  readonly title: HTMLElement;
  readonly subtitle: HTMLElement;
  readonly actions: HTMLElement;
}

interface PageHeaderOptions {
  readonly title: string;
  readonly subtitle?: string;
  readonly headerClass?: string;
  readonly titleClass?: string;
  readonly actionsClass?: string;
}

interface PageIconButtonOptions {
  readonly className?: string;
}

interface PageTabOptions {
  readonly id?: string;
  readonly label: string;
  readonly active: boolean;
  readonly className?: string;
  readonly count?: number;
  readonly countClass?: string;
  readonly disabled?: boolean;
}

export interface PageTabDefinition extends PageTabOptions {
  readonly id: string;
  readonly onSelect: () => void;
}

export interface PageStatus {
  readonly tone: PageStatusTone;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export interface PageShellOptions extends PageHeaderOptions {
  readonly width?: PageWidth;
  readonly bodyClass?: string;
  readonly tabsClass?: string;
  readonly statusClass?: string;
  readonly containedBody?: boolean;
}

export interface PageSectionOptions {
  readonly title?: string;
  readonly description?: string;
  readonly className?: string;
  readonly surface?: PageSurface;
  readonly headingLevel?: 3 | 4;
}

export interface PageStateOptions {
  readonly kind: PageStateKind;
  readonly title: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export interface PageSectionElements {
  readonly section: HTMLElement;
  readonly header: HTMLElement | null;
  readonly actions: HTMLElement | null;
  readonly content: HTMLElement;
}

export interface PageMasterDetailElements {
  readonly layout: HTMLElement;
  readonly master: HTMLElement;
  readonly detail: HTMLElement;
}

interface PageInteractionSnapshot {
  readonly controls: ReadonlyMap<string, ControlSnapshot>;
  readonly details: ReadonlyMap<string, boolean>;
  readonly scroll: ReadonlyMap<string, { readonly left: number; readonly top: number }>;
  readonly focusKey: string | null;
}

interface ControlSnapshot {
  readonly value?: string;
  readonly checked?: boolean;
  readonly selectionStart?: number | null;
  readonly selectionEnd?: number | null;
}

let pageShellSequence = 0;

/**
 * Stable structural shell for a full Chatobby page.
 *
 * Header, tabs, status, and body mount once. Domain pages may rebuild the body
 * while migrating to keyed rows; interaction state remains stable across
 * ordinary patches and scope changes intentionally reset it.
 */
export class PageShell {
  readonly header: HTMLElement;
  readonly title: HTMLElement;
  readonly subtitle: HTMLElement;
  readonly actions: HTMLElement;
  readonly tabs: HTMLElement;
  readonly status: HTMLElement;
  readonly body: HTMLElement;

  private readonly instanceId: string;
  private readonly tabDefinitions = new Map<string, PageTabDefinition>();
  private bodyScope: string | null = null;

  constructor(parent: HTMLElement, options: PageShellOptions) {
    this.instanceId = `chatobby-page-${++pageShellSequence}`;
    parent.dataset.pageWidth = options.width ?? "wide";
    parent.toggleClass("chatobby-page--contained", Boolean(options.containedBody));
    const header = createPageHeader(parent, options);
    this.header = header.header;
    this.title = header.title;
    this.subtitle = header.subtitle;
    this.actions = header.actions;
    this.tabs = createPageTabs(parent, options.tabsClass);
    this.tabs.addClass("is-hidden");
    this.status = parent.createDiv({
      cls: classes("chatobby-page__status", options.statusClass, "is-hidden"),
      attr: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
    });
    this.body = parent.createEl("main", {
      cls: classes("chatobby-page__body", options.bodyClass),
      attr: { tabindex: "-1" },
    });
    if (options.containedBody) this.body.addClass("is-contained");
  }

  setTitle(title: string, subtitle?: string): void {
    this.title.textContent = title;
    this.subtitle.textContent = subtitle ?? "";
    this.subtitle.toggleClass("is-hidden", !subtitle);
  }

  setBusy(busy: boolean): void {
    this.body.setAttr("aria-busy", String(busy));
    this.body.toggleClass("is-busy", busy);
  }

  setStatus(status: PageStatus | null): void {
    this.status.empty();
    this.status.removeClass("is-info", "is-success", "is-warning", "is-error");
    this.status.toggleClass("is-hidden", !status);
    if (!status) return;
    this.status.addClass(`is-${status.tone}`);
    this.status.setAttr("role", status.tone === "error" ? "alert" : "status");
    const icon = this.status.createSpan({ cls: "chatobby-page__status-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, statusIcon(status.tone));
    this.status.createSpan({ cls: "chatobby-page__status-message", text: status.message });
    if (status.actionLabel && status.onAction) {
      this.status.createEl("button", {
        cls: "chatobby-page__status-action",
        text: status.actionLabel,
        attr: { type: "button" },
      }).addEventListener("click", status.onAction);
    }
  }

  setTabs(definitions: readonly PageTabDefinition[]): void {
    this.tabDefinitions.clear();
    for (const definition of definitions) this.tabDefinitions.set(definition.id, definition);
    const existing = new Map(
      Array.from(this.tabs.querySelectorAll<HTMLButtonElement>(".chatobby-page__tab"))
        .map((button) => [button.dataset.pageTabId ?? "", button] as const),
    );
    for (const definition of definitions) {
      let button = existing.get(definition.id);
      if (!button) {
        button = createPageTab(this.tabs, definition);
        button.dataset.pageTabId = definition.id;
        button.addEventListener("click", () => this.tabDefinitions.get(definition.id)?.onSelect());
        button.addEventListener("keydown", (event: KeyboardEvent) => this.handleTabKeydown(event, definition.id));
      }
      updatePageTab(button, definition, this.instanceId);
      this.tabs.append(button);
      existing.delete(definition.id);
    }
    for (const button of existing.values()) button.remove();
    this.tabs.toggleClass("is-hidden", definitions.length === 0);
    const active = definitions.find((definition) => definition.active);
    this.body.setAttr("role", definitions.length > 0 ? "tabpanel" : "main");
    if (active) {
      this.body.id = `${this.instanceId}-panel-${active.id}`;
      this.body.setAttr("aria-labelledby", `${this.instanceId}-tab-${active.id}`);
    } else {
      this.body.removeAttribute("id");
      this.body.removeAttribute("aria-labelledby");
    }
  }

  updateBody(scope: string, render: (body: HTMLElement) => void): void {
    const preserve = this.bodyScope === scope;
    const snapshot = preserve ? captureInteraction(this.body) : null;
    this.body.empty();
    render(this.body);
    this.bodyScope = scope;
    if (snapshot) restoreInteraction(this.body, snapshot);
    else {
      this.body.scrollTop = 0;
      this.body.scrollLeft = 0;
    }
  }

  private handleTabKeydown(event: KeyboardEvent, id: string): void {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const definitions = [...this.tabDefinitions.values()].filter((definition) => !definition.disabled);
    const current = definitions.findIndex((definition) => definition.id === id);
    if (current < 0 || definitions.length === 0) return;
    event.preventDefault();
    const index = event.key === "Home"
      ? 0
      : event.key === "End"
        ? definitions.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + definitions.length) % definitions.length;
    const next = definitions[index];
    if (!next) return;
    next.onSelect();
    this.tabs.querySelector<HTMLButtonElement>(`[data-page-tab-id="${cssEscape(next.id)}"]`)?.focus();
  }
}

export function createPageHeader(parent: HTMLElement, options: PageHeaderOptions): PageHeaderElements {
  chatobbyPerformance.recordPageRender(options.title.toLowerCase());
  const header = parent.createEl("header", { cls: classes("chatobby-page__header", options.headerClass) });
  const heading = header.createDiv({ cls: "chatobby-page__heading" });
  const title = heading.createEl("h2", {
    cls: classes("chatobby-page__title", options.titleClass),
    text: options.title,
  });
  const subtitle = heading.createDiv({
    cls: classes("chatobby-page__subtitle", options.subtitle ? undefined : "is-hidden"),
    text: options.subtitle ?? "",
  });
  const actions = header.createDiv({
    cls: classes("chatobby-page__header-actions", options.actionsClass),
  });
  return { header, title, subtitle, actions };
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
  return parent.createEl("nav", {
    cls: classes("chatobby-page__tabs", className),
    attr: { role: "tablist", "aria-label": "Page sections" },
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
  button.createSpan({ cls: "chatobby-page__tab-label", text: options.label });
  if (options.count !== undefined && options.count > 0) {
    button.createSpan({
      cls: classes("chatobby-page__tab-count", options.countClass),
      text: String(options.count),
    });
  }
  return button;
}

export function createPageSection(parent: HTMLElement, options: PageSectionOptions = {}): PageSectionElements {
  const section = parent.createEl("section", {
    cls: classes("chatobby-page__section", `is-${options.surface ?? "plain"}`, options.className),
  });
  let header: HTMLElement | null = null;
  let actions: HTMLElement | null = null;
  if (options.title || options.description) {
    header = section.createDiv({ cls: "chatobby-page__section-header" });
    const copy = header.createDiv({ cls: "chatobby-page__section-copy" });
    if (options.title) {
      copy.createEl(options.headingLevel === 4 ? "h4" : "h3", {
        cls: "chatobby-page__section-title",
        text: options.title,
      });
    }
    if (options.description) {
      copy.createDiv({ cls: "chatobby-page__section-description", text: options.description });
    }
    actions = header.createDiv({ cls: "chatobby-page__section-actions" });
  }
  const content = section.createDiv({ cls: "chatobby-page__section-content" });
  return { section, header, actions, content };
}

export function createPageToolbar(parent: HTMLElement, className?: string): HTMLElement {
  return parent.createDiv({ cls: classes("chatobby-page__toolbar", className) });
}

export function createPageActionRow(parent: HTMLElement, className?: string): HTMLElement {
  return parent.createDiv({ cls: classes("chatobby-page__action-row", className) });
}

export function createPageDisclosure(parent: HTMLElement, key: string, summary: string, open = false): HTMLDetailsElement {
  const details = parent.createEl("details", {
    cls: "chatobby-page__disclosure",
    attr: { "data-page-state-key": `disclosure:${key}` },
  });
  details.open = open;
  details.createEl("summary", { text: summary });
  return details;
}

export function createPageState(parent: HTMLElement, options: PageStateOptions): HTMLElement {
  const state = parent.createDiv({
    cls: classes("chatobby-page__state", `is-${options.kind}`),
    attr: { role: options.kind === "error" ? "alert" : "status" },
  });
  const icon = state.createSpan({ cls: "chatobby-page__state-icon", attr: { "aria-hidden": "true" } });
  setIcon(icon, stateIcon(options.kind));
  const copy = state.createDiv({ cls: "chatobby-page__state-copy" });
  copy.createDiv({ cls: "chatobby-page__state-title", text: options.title });
  if (options.description) copy.createDiv({ cls: "chatobby-page__state-description", text: options.description });
  if (options.actionLabel && options.onAction) {
    state.createEl("button", {
      text: options.actionLabel,
      attr: { type: "button" },
    }).addEventListener("click", options.onAction);
  }
  return state;
}

export function createPageMasterDetail(
  parent: HTMLElement,
  options: { readonly className?: string; readonly masterLabel: string; readonly detailLabel: string },
): PageMasterDetailElements {
  const layout = parent.createDiv({ cls: classes("chatobby-page__master-detail", options.className) });
  const master = layout.createEl("aside", {
    cls: "chatobby-page__master",
    attr: { "aria-label": options.masterLabel, "data-page-scroll-key": "master" },
  });
  const detail = layout.createEl("section", {
    cls: "chatobby-page__detail",
    attr: { "aria-label": options.detailLabel, "data-page-scroll-key": "detail" },
  });
  return { layout, master, detail };
}

/** Focus the selected tab in the active shared page shell. */
export function focusPageNavigation(root: HTMLElement): boolean {
  const active = root.querySelector<HTMLButtonElement>(
    ".chatobby-page__tab[aria-selected='true']:not(:disabled)",
  );
  if (!active) return false;
  active.focus({ preventScroll: true });
  return true;
}

/** Select and focus the adjacent tab in the active shared page shell. */
export function movePageNavigation(root: HTMLElement, delta: 1 | -1): boolean {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>(".chatobby-page__tab:not(:disabled)"));
  if (tabs.length === 0) return false;
  const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  const nextIndex = current < 0 ? 0 : (current + delta + tabs.length) % tabs.length;
  const next = tabs[nextIndex];
  if (!next) return false;
  next.click();
  next.focus({ preventScroll: true });
  return true;
}

export function reconcileKeyed<T>(
  parent: HTMLElement,
  items: readonly T[],
  keyOf: (item: T) => string,
  create: (item: T) => HTMLElement,
  update: (element: HTMLElement, item: T) => void,
): void {
  const existing = new Map(
    Array.from(parent.children)
      .filter((child): child is HTMLElement => isDomNodeOfType(child, HTMLElement) && Boolean(child.dataset.pageKey))
      .map((child) => [child.dataset.pageKey ?? "", child] as const),
  );
  for (const [index, item] of items.entries()) {
    const key = keyOf(item);
    const element = existing.get(key) ?? create(item);
    element.dataset.pageKey = key;
    update(element, item);
    // Moving an already positioned row disrupts browser scroll anchoring and focus.
    const position = parent.children.item(index);
    if (position !== element) parent.insertBefore(element, position);
    existing.delete(key);
  }
  for (const element of existing.values()) element.remove();
}

function updatePageTab(button: HTMLButtonElement, definition: PageTabDefinition, instanceId: string): void {
  button.id = `${instanceId}-tab-${definition.id}`;
  button.setAttr("aria-controls", `${instanceId}-panel-${definition.id}`);
  button.setAttr("aria-selected", String(definition.active));
  button.setAttr("aria-disabled", String(Boolean(definition.disabled)));
  button.disabled = Boolean(definition.disabled);
  button.tabIndex = definition.active ? 0 : -1;
  button.toggleClass("is-active", definition.active);
  const label = button.querySelector<HTMLElement>(".chatobby-page__tab-label");
  if (label) label.textContent = definition.label;
  const count = button.querySelector<HTMLElement>(".chatobby-page__tab-count");
  if (definition.count !== undefined && definition.count > 0) {
    const target = count ?? button.createSpan({ cls: classes("chatobby-page__tab-count", definition.countClass) });
    target.textContent = String(definition.count);
  } else {
    count?.remove();
  }
}

function captureInteraction(root: HTMLElement): PageInteractionSnapshot {
  const controls = new Map<string, ControlSnapshot>();
  const details = new Map<string, boolean>();
  const scroll = new Map<string, { left: number; top: number }>();
  for (const control of Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input[data-page-state-key], textarea[data-page-state-key], select[data-page-state-key]",
  ))) {
    const key = control.dataset.pageStateKey;
    if (!key) continue;
    controls.set(key, {
      value: control.value,
      checked: control instanceof HTMLInputElement ? control.checked : undefined,
      selectionStart: supportsSelection(control) ? control.selectionStart : undefined,
      selectionEnd: supportsSelection(control) ? control.selectionEnd : undefined,
    });
  }
  for (const [index, detail] of Array.from(root.querySelectorAll<HTMLDetailsElement>("details")).entries()) {
    details.set(stateKey(detail, `details:${index}`), detail.open);
  }
  scroll.set("body", { left: root.scrollLeft, top: root.scrollTop });
  for (const [index, element] of Array.from(root.querySelectorAll<HTMLElement>("[data-page-scroll-key]")).entries()) {
    scroll.set(element.dataset.pageScrollKey ?? `scroll:${index}`, { left: element.scrollLeft, top: element.scrollTop });
  }
  const active = root.ownerDocument.activeElement;
  const focusable = Array.from(root.querySelectorAll<HTMLElement>("button, input, textarea, select, summary, [tabindex]"));
  const activeIndex = active instanceof HTMLElement ? focusable.indexOf(active) : -1;
  return {
    controls,
    details,
    scroll,
    focusKey: active instanceof HTMLElement && activeIndex >= 0
      ? stateKey(active, `focus:${activeIndex}`)
      : null,
  };
}

function restoreInteraction(root: HTMLElement, snapshot: PageInteractionSnapshot): void {
  for (const control of Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input[data-page-state-key], textarea[data-page-state-key], select[data-page-state-key]",
  ))) {
    const key = control.dataset.pageStateKey;
    if (!key) continue;
    const value = snapshot.controls.get(key);
    if (!value) continue;
    if (value.value !== undefined) control.value = value.value;
    if (control instanceof HTMLInputElement && value.checked !== undefined) control.checked = value.checked;
    if (
      supportsSelection(control)
      && value.selectionStart !== undefined
      && value.selectionEnd !== undefined
    ) {
      control.setSelectionRange(value.selectionStart, value.selectionEnd);
    }
  }
  for (const [index, detail] of Array.from(root.querySelectorAll<HTMLDetailsElement>("details")).entries()) {
    const open = snapshot.details.get(stateKey(detail, `details:${index}`));
    if (open !== undefined) detail.open = open;
  }
  const bodyScroll = snapshot.scroll.get("body");
  if (bodyScroll) {
    root.scrollLeft = bodyScroll.left;
    root.scrollTop = bodyScroll.top;
  }
  for (const [index, element] of Array.from(root.querySelectorAll<HTMLElement>("[data-page-scroll-key]")).entries()) {
    const position = snapshot.scroll.get(element.dataset.pageScrollKey ?? `scroll:${index}`);
    if (!position) continue;
    element.scrollLeft = position.left;
    element.scrollTop = position.top;
  }
  if (!snapshot.focusKey) return;
  const target = Array.from(root.querySelectorAll<HTMLElement>("button, input, textarea, select, summary, [tabindex]"))
    .find((element, index) => stateKey(element, `focus:${index}`) === snapshot.focusKey);
  target?.focus({ preventScroll: true });
}

function stateKey(element: HTMLElement, fallback: string): string {
  return [
    element.dataset.pageStateKey,
    element.dataset.pageFocusKey,
    element.getAttribute("name"),
    element.getAttribute("aria-label"),
    element.id,
  ].find((value): value is string => Boolean(value)) ?? fallback;
}

function supportsSelection(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): control is HTMLInputElement | HTMLTextAreaElement {
  if (control instanceof HTMLTextAreaElement) return true;
  if (!(control instanceof HTMLInputElement)) return false;
  return ["text", "search", "url", "tel", "password", "email"].includes(control.type);
}

function statusIcon(tone: PageStatusTone): string {
  if (tone === "success") return "check-circle-2";
  if (tone === "warning") return "triangle-alert";
  if (tone === "error") return "circle-alert";
  return "info";
}

function stateIcon(kind: PageStateKind): string {
  if (kind === "loading") return "loader-circle";
  if (kind === "error") return "circle-alert";
  if (kind === "no-results") return "search-x";
  return "inbox";
}

function cssEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function classes(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
