import { setIcon } from "obsidian";
import { ChatobbyComponent } from "../shared/component";

let selectionMenuSequence = 0;

export interface SelectionMenuItem {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectionMenuOptions {
  anchor: HTMLButtonElement;
  title: string;
  searchPlaceholder: string;
  items: readonly SelectionMenuItem[];
  selectedValue: string;
  statusText?: string;
  onChoose(item: SelectionMenuItem): void | Promise<void>;
  onClose(restoreFocus: boolean): void;
}

/** Searchable, bounded composer picker matching the slash-command menu pattern. */
export class SelectionMenu extends ChatobbyComponent {
  private readonly menuId = `chatobby-selection-menu-${++selectionMenuSequence}`;
  private readonly listId = `${this.menuId}-list`;
  private items: SelectionMenuItem[];
  private selectedValue: string;
  private statusText: string | null;
  private noticeText: string | null = null;
  private query = "";
  private activeIndex = 0;
  private searchInput: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private errorText: string | null = null;
  private busy = false;
  private readonly ownerDocument: Document;
  private readonly ownerWindow: Window;
  private resizeObserver: ResizeObserver | null = null;
  private focusFrame: number | null = null;

  constructor(private readonly options: SelectionMenuOptions) {
    super();
    this.ownerDocument = options.anchor.ownerDocument;
    this.ownerWindow = this.ownerDocument.defaultView ?? window;
    this.items = [...options.items];
    this.selectedValue = options.selectedValue;
    this.statusText = options.statusText ?? null;
    this.activeIndex = this.initialActiveIndex();
  }

  get id(): string {
    return this.menuId;
  }

  /** Keep the existing picker outside clipped/container-query composer ancestors. */
  override render(parent: HTMLElement): void {
    super.render(this.ownerDocument.body ?? parent);
  }

  setItems(items: readonly SelectionMenuItem[], selectedValue: string): void {
    this.items = [...items];
    this.selectedValue = selectedValue;
    this.statusText = null;
    this.errorText = null;
    this.activeIndex = this.initialActiveIndex();
    this.renderList();
  }

  setStatus(statusText: string): void {
    this.statusText = statusText;
    this.errorText = null;
    this.activeIndex = 0;
    this.renderList();
  }

  /** Non-blocking refresh feedback keeps existing choices and the search query usable. */
  setNotice(text: string): void {
    this.noticeText = text || null;
    this.renderList();
  }

  protected componentClass(): string {
    return "chatobby-selection-menu";
  }

  protected onRender(container: HTMLElement): void {
    container.setAttr("id", this.menuId);
    container.setAttr("role", "dialog");
    container.setAttr("aria-label", this.options.title);

    const header = container.createDiv({ cls: "chatobby-selection-menu__header" });
    header.createDiv({ cls: "chatobby-selection-menu__title", text: this.options.title });
    this.searchInput = header.createEl("input", {
      cls: "chatobby-selection-menu__search",
      attr: {
        type: "search",
        placeholder: this.options.searchPlaceholder,
        "aria-label": this.options.searchPlaceholder,
        role: "combobox",
        autocomplete: "off",
        "aria-autocomplete": "list",
        "aria-expanded": "true",
        "aria-controls": this.listId,
      },
    });
    this.listEl = container.createDiv({
      cls: "chatobby-selection-menu__list",
      attr: { id: this.listId, role: "listbox", "aria-label": `${this.options.title} options` },
    });
    this.searchInput.addEventListener("input", () => {
      this.query = this.searchInput?.value ?? "";
      this.activeIndex = 0;
      this.renderList();
    });
    container.addEventListener("keydown", this.handleKeydown);
    this.ownerDocument.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
    this.ownerDocument.addEventListener("scroll", this.handleScroll, true);
    this.ownerWindow.addEventListener("resize", this.positionMenu);
    this.ownerWindow.visualViewport?.addEventListener("resize", this.positionMenu);
    this.ownerWindow.visualViewport?.addEventListener("scroll", this.positionMenu);
    this.resizeObserver = new ResizeObserver((entries) => {
      // A blocking interaction or hidden leaf must not leave a body portal open.
      if (entries.some((entry) => entry.target === this.options.anchor && entry.contentRect.width === 0 && entry.contentRect.height === 0)) {
        this.options.onClose(false);
        return;
      }
      this.positionMenu();
    });
    this.resizeObserver.observe(this.options.anchor);
    if (this.options.anchor.parentElement) this.resizeObserver.observe(this.options.anchor.parentElement);
    this.renderList();
    this.focusFrame = this.ownerWindow.requestAnimationFrame(() => {
      this.focusFrame = null;
      this.searchInput?.focus({ preventScroll: true });
      this.updateActiveOption();
    });
  }

  override destroy(): void {
    this.ownerDocument.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    this.ownerDocument.removeEventListener("scroll", this.handleScroll, true);
    this.ownerWindow.removeEventListener("resize", this.positionMenu);
    this.ownerWindow.visualViewport?.removeEventListener("resize", this.positionMenu);
    this.ownerWindow.visualViewport?.removeEventListener("scroll", this.positionMenu);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.focusFrame !== null) this.ownerWindow.cancelAnimationFrame(this.focusFrame);
    this.focusFrame = null;
    this.searchInput = null;
    this.listEl = null;
    super.destroy();
  }

  private readonly positionMenu = (): void => {
    const menu = this.container;
    if (!menu) return;
    if (!this.options.anchor.isConnected) {
      this.options.onClose(false);
      return;
    }
    const viewport = this.ownerWindow.visualViewport;
    const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
    const topEdge = (viewport?.offsetTop ?? 0) + 8;
    const width = Math.max(0, (viewport?.width ?? this.ownerWindow.innerWidth) - 16);
    const bottomEdge = topEdge + Math.max(0, (viewport?.height ?? this.ownerWindow.innerHeight) - 16);
    const anchor = this.options.anchor.getBoundingClientRect();
    const above = Math.max(0, anchor.top - topEdge - 6);
    const below = Math.max(0, bottomEdge - anchor.bottom - 6);
    const opensAbove = above >= below;
    const menuWidth = Math.min(380, width);
    const maxHeight = Math.min(360, opensAbove ? above : below);
    menu.style.width = `${menuWidth}px`;
    menu.style.maxHeight = `${maxHeight}px`;
    menu.style.left = `${Math.max(leftEdge, Math.min(anchor.left, leftEdge + width - menuWidth))}px`;
    const height = Math.min(maxHeight, menu.getBoundingClientRect().height);
    const top = opensAbove ? anchor.top - height - 6 : anchor.bottom + 6;
    menu.style.top = `${Math.max(topEdge, Math.min(top, bottomEdge - height))}px`;
  };

  private readonly handleScroll = (event: Event): void => {
    if (event.composedPath().includes(this.container!)) return;
    this.positionMenu();
  };

  private renderList(): void {
    const list = this.listEl;
    if (!list) return;
    list.empty();
    if (this.noticeText) list.createDiv({ cls: "chatobby-selection-menu__status", text: this.noticeText, attr: { role: "status" } });

    if (this.statusText) {
      this.searchInput?.removeAttribute("aria-activedescendant");
      list.createDiv({ cls: "chatobby-selection-menu__status", text: this.statusText, attr: { role: "status" } });
      this.positionMenu();
      return;
    }

    const items = this.filteredItems();
    if (items.length === 0) {
      this.searchInput?.removeAttribute("aria-activedescendant");
      list.createDiv({ cls: "chatobby-selection-menu__status", text: "No matching options", attr: { role: "status" } });
      this.positionMenu();
      return;
    }
    if (this.activeIndex >= items.length) this.activeIndex = items.length - 1;

    items.forEach((item, index) => {
      const optionId = `${this.listId}-${index}`;
      const selected = item.value === this.selectedValue;
      const option = list.createEl("button", {
        cls: "chatobby-selection-menu__option",
        attr: {
          id: optionId,
          type: "button",
          role: "option",
          tabindex: "-1",
          "aria-selected": String(selected),
        },
      });
      option.toggleClass("is-active", index === this.activeIndex);
      option.toggleClass("is-selected", selected);
      option.disabled = this.busy || item.disabled === true;
      const body = option.createSpan({ cls: "chatobby-selection-menu__option-body" });
      body.createSpan({ cls: "chatobby-selection-menu__option-name", text: item.label });
      if (item.description) body.createSpan({ cls: "chatobby-selection-menu__option-description", text: item.description });
      const indicator = option.createSpan({ cls: "chatobby-selection-menu__option-indicator", attr: { "aria-hidden": "true" } });
      if (selected) setIcon(indicator, "check");
      option.addEventListener("pointermove", () => {
        if (this.activeIndex === index) return;
        this.activeIndex = index;
        this.updateActiveOption();
      });
      option.addEventListener("click", () => void this.choose(item));
      if (index === this.activeIndex) {
        this.searchInput?.setAttr("aria-activedescendant", optionId);
      }
    });

    if (this.errorText) list.createDiv({ cls: "chatobby-selection-menu__error", text: this.errorText, attr: { role: "alert" } });
    this.positionMenu();
    this.updateActiveOption();
  }

  private updateActiveOption(): void {
    const options = Array.from(this.listEl?.querySelectorAll<HTMLElement>(".chatobby-selection-menu__option") ?? []);
    options.forEach((option, index) => option.toggleClass("is-active", index === this.activeIndex));
    const active = options[this.activeIndex];
    if (active) {
      this.searchInput?.setAttr("aria-activedescendant", active.id);
      // Scroll only the option list, never its pane or the owning document.
      const list = this.listEl!;
      const listBounds = list.getBoundingClientRect();
      const activeBounds = active.getBoundingClientRect();
      if (activeBounds.top < listBounds.top) list.scrollTop += activeBounds.top - listBounds.top;
      else if (activeBounds.bottom > listBounds.bottom) {
        list.scrollTop += activeBounds.bottom - listBounds.bottom;
      }
    }
  }

  private filteredItems(): SelectionMenuItem[] {
    const query = this.query.trim().toLocaleLowerCase();
    if (!query) return this.items;
    return this.items.filter((item) => `${item.label} ${item.description ?? ""}`.toLocaleLowerCase().includes(query));
  }

  private initialActiveIndex(): number {
    const index = this.items.findIndex((item) => item.value === this.selectedValue && !item.disabled);
    return index >= 0 ? index : Math.max(0, this.items.findIndex((item) => !item.disabled));
  }

  private async choose(item: SelectionMenuItem): Promise<void> {
    if (this.busy || item.disabled) return;
    this.busy = true;
    this.errorText = null;
    this.container?.addClass("is-busy");
    this.renderList();
    try {
      await this.options.onChoose(item);
      this.options.onClose(true);
    } catch {
      this.busy = false;
      this.container?.removeClass("is-busy");
      this.errorText = "Could not apply this selection.";
      this.renderList();
      this.searchInput?.focus();
    }
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.options.onClose(true);
      return;
    }
    if (event.key === "Tab") {
      // Restore the trigger, then let native Tab/Shift+Tab follow composer order.
      this.options.onClose(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(event.key)) return;
    const items = this.filteredItems();
    if (items.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Enter") {
      const item = items[this.activeIndex];
      if (item) void this.choose(item);
      return;
    }
    if (event.key === "Home") this.activeIndex = 0;
    else if (event.key === "End") this.activeIndex = items.length - 1;
    else if (event.key === "ArrowDown") this.activeIndex = (this.activeIndex + 1) % items.length;
    else this.activeIndex = (this.activeIndex - 1 + items.length) % items.length;
    this.updateActiveOption();
  };

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    const path = event.composedPath();
    if (path.includes(this.container!) || path.includes(this.options.anchor)) return;
    this.options.onClose(false);
  };
}
