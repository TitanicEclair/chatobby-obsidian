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
  private query = "";
  private activeIndex = 0;
  private searchInput: HTMLInputElement | null = null;
  private listEl: HTMLElement | null = null;
  private errorText: string | null = null;
  private busy = false;

  constructor(private readonly options: SelectionMenuOptions) {
    super();
    this.items = [...options.items];
    this.selectedValue = options.selectedValue;
    this.statusText = options.statusText ?? null;
    this.activeIndex = this.initialActiveIndex();
  }

  get id(): string {
    return this.menuId;
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
    document.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
    this.renderList();
    requestAnimationFrame(() => this.searchInput?.focus());
  }

  override destroy(): void {
    document.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    super.destroy();
  }

  private renderList(): void {
    const list = this.listEl;
    if (!list) return;
    list.empty();

    if (this.statusText) {
      this.searchInput?.removeAttribute("aria-activedescendant");
      list.createDiv({ cls: "chatobby-selection-menu__status", text: this.statusText, attr: { role: "status" } });
      return;
    }

    const items = this.filteredItems();
    if (items.length === 0) {
      this.searchInput?.removeAttribute("aria-activedescendant");
      list.createDiv({ cls: "chatobby-selection-menu__status", text: "No matching options", attr: { role: "status" } });
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
        requestAnimationFrame(() => option.scrollIntoView({ block: "nearest" }));
      }
    });

    if (this.errorText) list.createDiv({ cls: "chatobby-selection-menu__error", text: this.errorText, attr: { role: "alert" } });
  }

  private updateActiveOption(): void {
    const options = Array.from(this.listEl?.querySelectorAll<HTMLElement>(".chatobby-selection-menu__option") ?? []);
    options.forEach((option, index) => option.toggleClass("is-active", index === this.activeIndex));
    const active = options[this.activeIndex];
    if (active) {
      this.searchInput?.setAttr("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
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
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.container?.contains(target) || this.options.anchor.contains(target)) return;
    this.options.onClose(false);
  };
}
