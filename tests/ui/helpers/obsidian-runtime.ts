export class Notice {
  constructor(readonly message: string, readonly timeout?: number) {}
}

export class Component {
  load(): void {}
  unload(): void {}
}

export class ItemView extends Component {
  readonly contentEl = document.createElement("div");
  readonly app: unknown;

  constructor(readonly leaf: unknown) {
    super();
    this.app = {};
  }

  getViewType(): string {
    return "test-view";
  }

  getDisplayText(): string {
    return "Test View";
  }
}

export class Plugin extends Component {
  readonly app: unknown = {};
  readonly manifest = { version: "0.0.0-test" };

  registerView(): void {}
  addSettingTab(): void {}
  addRibbonIcon(): void {}
  addCommand(): void {}
  async loadData(): Promise<unknown> {
    return {};
  }
  async saveData(): Promise<void> {}
}

export class PluginSettingTab {
  readonly containerEl = document.createElement("div");

  constructor(readonly app: unknown, readonly plugin: unknown) {}

  display(): void {}
}

export class Setting {
  readonly settingEl: HTMLElement;
  readonly nameEl: HTMLElement;
  readonly descEl: HTMLElement;
  readonly controlEl: HTMLElement;

  constructor(readonly containerEl: HTMLElement) {
    this.settingEl = document.createElement("div");
    this.settingEl.className = "setting-item";
    const info = document.createElement("div");
    info.className = "setting-item-info";
    this.nameEl = document.createElement("div");
    this.nameEl.className = "setting-item-name";
    this.descEl = document.createElement("div");
    this.descEl.className = "setting-item-description";
    info.append(this.nameEl, this.descEl);
    this.controlEl = document.createElement("div");
    this.controlEl.className = "setting-item-control";
    this.settingEl.append(info, this.controlEl);
    containerEl.appendChild(this.settingEl);
  }
  setName(name: string): this {
    this.nameEl.textContent = name;
    return this;
  }
  setDesc(description: string): this {
    this.descEl.textContent = description;
    return this;
  }
  setHeading(): this {
    this.settingEl.classList.add("setting-item-heading");
    return this;
  }
  addText(): this {
    return this;
  }
  addDropdown(): this {
    return this;
  }
  addToggle(callback: (toggle: TestToggleComponent) => unknown): this {
    callback(new TestToggleComponent(this.controlEl));
    return this;
  }
  addSlider(callback: (slider: TestSliderComponent) => unknown): this {
    callback(new TestSliderComponent(this.controlEl));
    return this;
  }
  addButton(): this {
    return this;
  }
}

export class Modal {
  readonly modalEl = document.createElement("div");
  readonly titleEl = document.createElement("div");
  readonly contentEl = document.createElement("div");

  constructor(readonly app: unknown) {
    this.modalEl.className = "modal";
    this.titleEl.className = "modal-title";
    this.contentEl.className = "modal-content";
    const title = this.titleEl as HTMLElement & { setText: (value: string) => void };
    title.setText = (value) => { title.textContent = value; };
    this.modalEl.append(this.titleEl, this.contentEl);
  }
  open(): void {
    document.body.appendChild(this.modalEl);
    const instance = this as Modal & { onOpen?: () => void };
    instance.onOpen?.();
  }
  close(): void {
    this.modalEl.remove();
  }
  setTitle(title: string): this {
    this.titleEl.textContent = title;
    return this;
  }
}

export class FuzzySuggestModal<T> {
  constructor(readonly app: unknown) {}
  open(): void {}
  close(): void {}
  getItems(): T[] {
    return [];
  }
}

export class Menu {
  static lastShown: Menu | null = null;
  readonly items: TestMenuItem[] = [];

  addItem(builder: (item: TestMenuItem) => void): this {
    const item = new TestMenuItem();
    builder(item);
    this.items.push(item);
    return this;
  }

  addSeparator(): this {
    return this;
  }

  showAtMouseEvent(): void {
    Menu.lastShown = this;
  }
}

export const MarkdownRenderer = {
  render: async (_app: unknown, markdown: string, container: HTMLElement): Promise<void> => {
    container.textContent = markdown;
  },
};

export function htmlToMarkdown(input: string | HTMLElement | Document | DocumentFragment): string {
  if (typeof input === "string") {
    const root = document.createElement("div");
    root.innerHTML = input;
    return markdownChildren(root);
  }
  return markdownChildren(input);
}

export function setIcon(el: HTMLElement, icon: string): void {
  el.dataset.icon = icon;
}

function markdownChildren(node: Node): string {
  return [...node.childNodes].map(markdownNode).join("");
}

function markdownNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return markdownChildren(node);
  const body = markdownChildren(node);
  switch (node.tagName) {
    case "STRONG":
    case "B":
      return `**${body}**`;
    case "EM":
    case "I":
      return `*${body}*`;
    case "A":
      return `[${body}](${node.getAttribute("href") ?? ""})`;
    case "CODE":
      return `\`${body}\``;
    case "P":
    case "DIV":
      return `${body}\n\n`;
    case "BR":
      return "\n";
    default:
      return body;
  }
}

class TestToggleComponent {
  readonly toggleEl: HTMLInputElement;

  constructor(host: HTMLElement) {
    this.toggleEl = document.createElement("input");
    this.toggleEl.type = "checkbox";
    host.appendChild(this.toggleEl);
  }

  setValue(value: boolean): this {
    this.toggleEl.checked = value;
    return this;
  }

  onChange(handler: (value: boolean) => void): this {
    this.toggleEl.addEventListener("change", () => handler(this.toggleEl.checked));
    return this;
  }
}

class TestSliderComponent {
  readonly sliderEl: HTMLInputElement;

  constructor(host: HTMLElement) {
    this.sliderEl = document.createElement("input");
    this.sliderEl.type = "range";
    host.appendChild(this.sliderEl);
  }

  setLimits(min: number, max: number, step: number): this {
    this.sliderEl.min = String(min);
    this.sliderEl.max = String(max);
    this.sliderEl.step = String(step);
    return this;
  }

  setValue(value: number): this {
    this.sliderEl.value = String(value);
    return this;
  }

  onChange(handler: (value: number) => void): this {
    this.sliderEl.addEventListener("change", () => handler(Number(this.sliderEl.value)));
    return this;
  }
}

class TestMenuItem {
  title = "";
  icon = "";
  callback: (() => void) | null = null;

  setTitle(title: string): this {
    this.title = title;
    return this;
  }

  setIcon(icon: string): this {
    this.icon = icon;
    return this;
  }

  onClick(callback: () => void): this {
    this.callback = callback;
    return this;
  }
}
