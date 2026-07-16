interface CreateElOptions {
  cls?: string;
  text?: string;
  attr?: Record<string, string>;
}

declare global {
  interface HTMLElement {
    createDiv(options?: CreateElOptions): HTMLDivElement;
    createSpan(options?: CreateElOptions): HTMLSpanElement;
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, options?: CreateElOptions): HTMLElementTagNameMap[K];
    empty(): void;
    addClass(cls: string): void;
    removeClass(cls: string): void;
    toggleClass(cls: string, value?: boolean): void;
    hasClass(cls: string): boolean;
    setAttr(name: string, value: string): void;
    setCssStyles(styles: Partial<CSSStyleDeclaration>): void;
    setCssProps(props: Record<string, string>): void;
  }
}

if (typeof HTMLElement !== "undefined") {
  HTMLElement.prototype.createEl = function createEl<K extends keyof HTMLElementTagNameMap>(
    this: HTMLElement,
    tag: K,
    options?: CreateElOptions,
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (options?.cls) el.className = options.cls;
    if (options?.text) el.textContent = options.text;
    if (options?.attr) {
      for (const [name, value] of Object.entries(options.attr)) {
        el.setAttribute(name, value);
      }
    }
    this.appendChild(el);
    return el;
  };

  HTMLElement.prototype.createDiv = function createDiv(this: HTMLElement, options?: CreateElOptions): HTMLDivElement {
    return this.createEl("div", options);
  };

  HTMLElement.prototype.createSpan = function createSpan(this: HTMLElement, options?: CreateElOptions): HTMLSpanElement {
    return this.createEl("span", options);
  };

  HTMLElement.prototype.empty = function empty(this: HTMLElement): void {
    this.replaceChildren();
  };

  HTMLElement.prototype.addClass = function addClass(this: HTMLElement, cls: string): void {
    this.classList.add(...cls.split(" "));
  };

  HTMLElement.prototype.removeClass = function removeClass(this: HTMLElement, cls: string): void {
    this.classList.remove(...cls.split(" "));
  };

  HTMLElement.prototype.toggleClass = function toggleClass(this: HTMLElement, cls: string, value?: boolean): void {
    this.classList.toggle(cls, value);
  };

  HTMLElement.prototype.hasClass = function hasClass(this: HTMLElement, cls: string): boolean {
    return this.classList.contains(cls);
  };

  HTMLElement.prototype.setAttr = function setAttr(this: HTMLElement, name: string, value: string): void {
    this.setAttribute(name, value);
  };

  HTMLElement.prototype.setCssStyles = function setCssStyles(
    this: HTMLElement,
    styles: Partial<CSSStyleDeclaration>,
  ): void {
    Object.assign(this.style, styles);
  };

  HTMLElement.prototype.setCssProps = function setCssProps(this: HTMLElement, props: Record<string, string>): void {
    for (const [name, value] of Object.entries(props)) this.style.setProperty(name, value);
  };
}

export {};
