export type BrowserPageAction =
  | "page"
  | "snapshot"
  | "read"
  | "dom"
  | "click"
  | "fill"
  | "focus"
  | "bounds"
  | "wait"
  | "evaluate";

export interface BrowserPageInput extends Record<string, unknown> {
  action: BrowserPageAction;
}

/**
 * Browser guest runtime executed inside Obsidian's Web Viewer page.
 *
 * Keep this function self-contained. The connector serializes it with
 * `toString()` and executes the exact same implementation in the guest page;
 * tests call it directly against happy-dom fixtures.
 */
export async function executeBrowserPageOperation(input: BrowserPageInput): Promise<Record<string, unknown>> {
  interface PageRuntimeState {
    documentId: string;
    revision: number;
    nextRef: number;
    elementRefs: WeakMap<Element, string>;
    refElements: Map<string, Element>;
    observer: MutationObserver | null;
  }

  const stateKey = "__chatobbyBrowserPageV1_6f5c9f3b";
  const globalRecord = globalThis as unknown as Record<string, unknown>;

  function createDocumentId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  }

  function pageState(): PageRuntimeState {
    const existing = globalRecord[stateKey] as PageRuntimeState | undefined;
    if (existing?.documentId && existing.elementRefs && existing.refElements) return existing;
    const created: PageRuntimeState = {
      documentId: createDocumentId(),
      revision: 0,
      nextRef: 1,
      elementRefs: new WeakMap<Element, string>(),
      refElements: new Map<string, Element>(),
      observer: null,
    };
    if (document.documentElement && typeof MutationObserver !== "undefined") {
      created.observer = new MutationObserver(() => {
        created.revision += 1;
        for (const [ref, element] of created.refElements) {
          if (!element.isConnected) created.refElements.delete(ref);
        }
      });
      created.observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }
    globalRecord[stateKey] = created;
    return created;
  }

  const state = pageState();

  function clean(value: unknown): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function clip(value: unknown, max = 240): string {
    return clean(value).slice(0, max);
  }

  function pageEnvelope(): Record<string, unknown> {
    const root = document.documentElement;
    const body = document.body;
    return {
      documentId: state.documentId,
      revision: state.revision,
      url: location.href,
      title: document.title || "",
      readyState: document.readyState,
      language: root?.lang || "",
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentWidth: Math.max(root?.scrollWidth ?? 0, body?.scrollWidth ?? 0),
        documentHeight: Math.max(root?.scrollHeight ?? 0, body?.scrollHeight ?? 0),
      },
      activeRef: document.activeElement instanceof Element ? refFor(document.activeElement) : undefined,
    };
  }

  function refFor(element: Element): string {
    const existing = state.elementRefs.get(element);
    if (existing) return existing;
    const ref = `e${state.nextRef}`;
    state.nextRef += 1;
    state.elementRefs.set(element, ref);
    state.refElements.set(ref, element);
    return ref;
  }

  function cssEscape(value: string): string {
    return typeof CSS !== "undefined" ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function selectorFor(element: Element): string {
    if (element.id) return `#${cssEscape(element.id)}`;
    const parts: string[] = [];
    let current: Element | null = element;
    while (current && current !== document.body && parts.length < 6) {
      let selector = current.tagName.toLowerCase();
      const parentElement: Element | null = current.parentElement;
      const currentTag = current.tagName;
      const stableClass = Array.from(current.classList).find((name) => /^[a-zA-Z][\w-]{2,48}$/.test(name));
      if (stableClass) selector += `.${cssEscape(stableClass)}`;
      if (parentElement) {
        const same = Array.from(parentElement.children).filter((child: Element) => child.tagName === currentTag);
        if (!stableClass && same.length > 1) selector += `:nth-of-type(${same.indexOf(current) + 1})`;
      }
      parts.unshift(selector);
      current = parentElement;
    }
    return parts.length ? parts.join(" > ") : element.tagName.toLowerCase();
  }

  function visible(element: Element): boolean {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden"
      && style.display !== "none"
      && style.opacity !== "0"
      && rect.width > 0
      && rect.height > 0;
  }

  function implicitRole(element: Element): string {
    const explicit = element.getAttribute("role");
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "summary") return "button";
    if (tag === "img") return "img";
    if (tag === "main") return "main";
    if (tag === "nav") return "navigation";
    if (tag === "aside") return "complementary";
    if (tag === "header") return "banner";
    if (tag === "footer") return "contentinfo";
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "table") return "table";
    if (tag === "input") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "range") return "slider";
      if (["button", "submit", "reset"].includes(type)) return "button";
      return "textbox";
    }
    return "";
  }

  function labelledText(element: Element): string {
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
      if (clean(text)) return clean(text);
    }
    const aria = element.getAttribute("aria-label");
    if (aria) return clean(aria);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      const labels = Array.from(element.labels ?? []).map((label) => label.textContent ?? "").join(" ");
      if (clean(labels)) return clean(labels);
    }
    const alt = element.getAttribute("alt");
    if (alt) return clean(alt);
    const placeholder = element.getAttribute("placeholder");
    if (placeholder) return clean(placeholder);
    const title = element.getAttribute("title");
    if (title) return clean(title);
    return clean((element as HTMLElement).innerText || element.textContent || "");
  }

  function openRoots(root: ParentNode): ParentNode[] {
    const roots: ParentNode[] = [root];
    const visit = (candidate: ParentNode): void => {
      for (const element of Array.from(candidate.querySelectorAll("*"))) {
        if (element.shadowRoot) {
          roots.push(element.shadowRoot);
          visit(element.shadowRoot);
        }
      }
    };
    visit(root);
    return roots;
  }

  function deepQuery(root: ParentNode, selector: string): Element[] {
    const matches: Element[] = [];
    for (const candidate of openRoots(root)) matches.push(...Array.from(candidate.querySelectorAll(selector)));
    return matches;
  }

  function targetRoot(): ParentNode {
    const ref = typeof input.ref === "string" ? input.ref : undefined;
    if (ref) {
      const element = state.refElements.get(ref);
      if (!element?.isConnected) throw new Error(`Stale page reference: ${ref}`);
      return element;
    }
    const selector = typeof input.scopeSelector === "string" ? input.scopeSelector : undefined;
    if (selector) {
      try {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`No element matches selector: ${selector}`);
        return element;
      } catch (error) {
        if (error instanceof DOMException) throw new Error(`Invalid CSS selector: ${selector}`);
        throw error;
      }
    }
    return document;
  }

  function interactiveCandidates(root: ParentNode = document): Element[] {
    return deepQuery(root, [
      "a[href]",
      "button",
      "input:not([type=hidden])",
      "textarea",
      "select",
      "summary",
      "[role]",
      "[contenteditable=true]",
      "[onclick]",
      "area[href]",
    ].join(","));
  }

  function resolveElements(): Element[] {
    const expectedDocumentId = typeof input.documentId === "string" ? input.documentId : undefined;
    if (expectedDocumentId && expectedDocumentId !== state.documentId) {
      throw new Error(`Stale page document: expected ${expectedDocumentId}, current ${state.documentId}`);
    }
    if (typeof input.ref === "string") {
      const element = state.refElements.get(input.ref);
      if (!element?.isConnected) throw new Error(`Stale page reference: ${input.ref}`);
      return [element];
    }
    if (typeof input.cssSelector === "string") {
      try {
        return deepQuery(document, input.cssSelector);
      } catch {
        throw new Error(`Invalid CSS selector: ${input.cssSelector}`);
      }
    }
    const candidates = interactiveCandidates();
    if (typeof input.role === "string") {
      const role = input.role.toLowerCase();
      const name = typeof input.name === "string" ? clean(input.name) : "";
      return candidates.filter((element) => {
        if (implicitRole(element).toLowerCase() !== role) return false;
        if (!name) return true;
        const actual = labelledText(element);
        return input.exact === true ? actual === name : actual.toLowerCase().includes(name.toLowerCase());
      });
    }
    if (typeof input.text === "string") {
      const expected = clean(input.text);
      return candidates.filter((element) => {
        const actual = labelledText(element);
        return input.exact === true ? actual === expected : actual.toLowerCase().includes(expected.toLowerCase());
      });
    }
    throw new Error("Provide ref, cssSelector, role, or text");
  }

  function resolveOne(): Element {
    const matches = resolveElements();
    const index = typeof input.index === "number" ? input.index : undefined;
    if (index !== undefined) {
      const indexed = matches[index];
      if (!indexed) throw new Error(`No matching element at index ${index}`);
      return indexed;
    }
    if (matches.length === 0) throw new Error("No matching element found");
    if (input.strict === true && matches.length > 1) {
      const choices = matches.slice(0, 5).map((element) => `${implicitRole(element) || element.tagName.toLowerCase()}: ${clip(labelledText(element), 80)}`);
      throw new Error(`Target is ambiguous (${matches.length} matches): ${choices.join(" | ")}`);
    }
    return matches[0] as Element;
  }

  function elementSummary(element: Element, includeValue = true): Record<string, unknown> {
    const html = element as HTMLElement;
    const rect = element.getBoundingClientRect();
    const inputElement = element instanceof HTMLInputElement ? element : null;
    const inputType = inputElement?.type?.toLowerCase() ?? "";
    const sensitive = inputType === "password" || inputType === "hidden";
    const value = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
      ? sensitive ? "[redacted]" : String(element.value).slice(0, 160)
      : "";
    return {
      ref: refFor(element),
      selector: selectorFor(element),
      tag: element.tagName.toLowerCase(),
      role: implicitRole(element),
      name: clip(labelledText(element), 240),
      text: clip(html.innerText || element.textContent || "", 320),
      ariaLabel: element.getAttribute("aria-label") || "",
      href: element instanceof HTMLAnchorElement ? element.href : element.getAttribute("href") || "",
      inputType,
      ...(includeValue ? { value } : {}),
      checked: inputElement && typeof inputElement.checked === "boolean" ? inputElement.checked : undefined,
      disabled: "disabled" in html ? Boolean((html as HTMLElement & { disabled?: boolean }).disabled) : false,
      expanded: element.getAttribute("aria-expanded") || undefined,
      selected: element.getAttribute("aria-selected") || undefined,
      visible: visible(element),
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  function metadata(): Record<string, unknown> {
    const meta = (name: string): string => document.querySelector<HTMLMetaElement>(
      `meta[name="${cssEscape(name)}"],meta[property="${cssEscape(name)}"]`,
    )?.content || "";
    return {
      title: document.title || "",
      description: meta("description") || meta("og:description"),
      author: meta("author") || meta("article:author"),
      publishedTime: meta("article:published_time") || meta("date"),
      canonicalUrl: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || "",
      language: document.documentElement?.lang || "",
    };
  }

  function inlineMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (!(node instanceof Element)) return "";
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "noscript", "svg", "canvas", "form"].includes(tag)) return "";
    const content = Array.from(node.childNodes).map(inlineMarkdown).join("");
    if (tag === "a") {
      const href = (node as HTMLAnchorElement).href || node.getAttribute("href") || "";
      return href && clean(content) ? `[${clean(content)}](${href})` : content;
    }
    if (tag === "strong" || tag === "b") return `**${content}**`;
    if (tag === "em" || tag === "i") return `_${content}_`;
    if (tag === "code") return `\`${content.replace(/`/g, "\\`")}\``;
    if (tag === "br") return "\n";
    return content;
  }

  function tableMarkdown(table: HTMLTableElement): string {
    const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => clean(cell.innerText || cell.textContent || "").replace(/\|/g, "\\|")));
    if (rows.length === 0) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
    const head = normalized[0] as string[];
    return [
      `| ${head.join(" | ")} |`,
      `| ${head.map(() => "---").join(" | ")} |`,
      ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
    ].join("\n");
  }

  function readableRoot(): Element {
    const requested = targetRoot();
    if (requested instanceof Element) return requested;
    const candidates = Array.from(document.querySelectorAll("main,article,[role=main]"))
      .filter((element) => visible(element))
      .sort((left, right) => clean((right as HTMLElement).innerText || right.textContent).length - clean((left as HTMLElement).innerText || left.textContent).length);
    return candidates[0] ?? document.body ?? document.documentElement;
  }

  function readableBlocks(root: Element): Array<Record<string, unknown>> {
    const selector = "h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table,img";
    const elements = [
      ...(root.matches(selector) ? [root] : []),
      ...Array.from(root.querySelectorAll(selector)),
    ];
    const blocks: Array<Record<string, unknown>> = [];
    let totalChars = 0;
    for (const element of elements) {
      if (blocks.length >= 2_000 || totalChars >= 500_000 || !visible(element)) break;
      const tag = element.tagName.toLowerCase();
      if (tag === "p" && element.closest("li,blockquote,pre,table")) continue;
      if (tag === "li" && element.parentElement?.closest("li")) continue;
      let kind = "paragraph";
      let markdown = "";
      let text = clean((element as HTMLElement).innerText || element.textContent || "");
      let level: number | undefined;
      if (/^h[1-6]$/.test(tag)) {
        kind = "heading";
        level = Number(tag.slice(1));
        markdown = `${"#".repeat(level)} ${clean(inlineMarkdown(element))}`;
      } else if (tag === "li") {
        kind = "list-item";
        const parent = element.parentElement;
        const prefix = parent?.tagName.toLowerCase() === "ol"
          ? `${Array.from(parent.children).indexOf(element) + 1}.`
          : "-";
        markdown = `${prefix} ${clean(inlineMarkdown(element))}`;
      } else if (tag === "blockquote") {
        kind = "quote";
        markdown = clean(inlineMarkdown(element)).split("\n").map((line) => `> ${line}`).join("\n");
      } else if (tag === "pre") {
        kind = "code";
        markdown = `\`\`\`\n${element.textContent || ""}\n\`\`\``;
        text = element.textContent || "";
      } else if (tag === "table") {
        kind = "table";
        markdown = tableMarkdown(element as HTMLTableElement);
      } else if (tag === "img") {
        kind = "image";
        const image = element as HTMLImageElement;
        text = clean(image.alt || image.title || "");
        markdown = image.src ? `![${text}](${image.src})` : text;
      } else {
        markdown = clean(inlineMarkdown(element));
      }
      if (!clean(markdown) && !text) continue;
      const id = `b${blocks.length + 1}`;
      totalChars += markdown.length;
      blocks.push({ id, kind, ...(level ? { level } : {}), text, markdown, ref: refFor(element) });
    }
    return blocks;
  }

  function sanitizeHtml(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    for (const removable of Array.from(clone.querySelectorAll("script,style,noscript,iframe,object,embed,template"))) removable.remove();
    for (const candidate of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
      for (const attribute of Array.from(candidate.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value;
        if (name.startsWith("on") || name === "srcdoc") candidate.removeAttribute(attribute.name);
        if ((name === "src" || name === "href") && value.startsWith("data:") && value.length > 512) {
          candidate.setAttribute(attribute.name, "[data-url-removed]");
        }
        if (name === "value" && /password|token|secret|auth|csrf/i.test(`${candidate.getAttribute("type") || ""} ${candidate.getAttribute("name") || ""}`)) {
          candidate.setAttribute(attribute.name, "[redacted]");
        }
      }
    }
    return clone.outerHTML;
  }

  function scopeElement(): Element {
    if (typeof input.ref === "string") {
      const element = state.refElements.get(input.ref);
      if (!element?.isConnected) throw new Error(`Stale page reference: ${input.ref}`);
      return element;
    }
    if (typeof input.cssSelector === "string") {
      try {
        const element = document.querySelector(input.cssSelector);
        if (!element) throw new Error(`No element matches selector: ${input.cssSelector}`);
        return element;
      } catch (error) {
        if (error instanceof DOMException) throw new Error(`Invalid CSS selector: ${input.cssSelector}`);
        throw error;
      }
    }
    return document.documentElement;
  }

  if (input.action === "page") return { ok: true, page: pageEnvelope() };

  if (input.action === "snapshot") {
    const mode = input.mode === "structure" || input.mode === "all" ? input.mode : "interactive";
    const maxElements = typeof input.maxElements === "number" ? Math.max(1, Math.min(500, input.maxElements)) : 100;
    const maxTextChars = typeof input.maxTextChars === "number" ? Math.max(1, Math.min(50_000, input.maxTextChars)) : 8_000;
    const includeHidden = input.includeHidden === true;
    const root = targetRoot();
    const structureSelector = "main,article,nav,aside,header,footer,section,h1,h2,h3,h4,h5,h6,p,blockquote,pre,table,img";
    const candidates = mode === "interactive"
      ? interactiveCandidates(root)
      : mode === "structure"
        ? deepQuery(root, structureSelector)
        : Array.from(new Set([...interactiveCandidates(root), ...deepQuery(root, structureSelector)]));
    const elements: Array<Record<string, unknown>> = [];
    let budget = maxTextChars;
    for (const element of candidates) {
      if (!includeHidden && !visible(element)) continue;
      const summary = elementSummary(element);
      const text = String(summary.text ?? "").slice(0, Math.max(0, budget));
      summary.text = text;
      budget -= text.length;
      elements.push(summary);
      if (elements.length >= maxElements || budget <= 0) break;
    }
    const frames = document.querySelectorAll("iframe").length;
    const openShadowRoots = openRoots(root).length - 1;
    return {
      ok: true,
      page: pageEnvelope(),
      mode,
      totalCandidates: candidates.length,
      returnedElements: elements.length,
      truncated: elements.length < candidates.length,
      coverage: {
        frames,
        openShadowRoots,
        warnings: frames > 0 ? ["Cross-origin frame contents may not be represented."] : [],
      },
      elements,
    };
  }

  if (input.action === "read") {
    const root = readableRoot();
    const blocks = readableBlocks(root);
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .slice(0, 300)
      .map((link) => ({ text: clip(link.innerText || link.textContent || "", 160), url: link.href }))
      .filter((link) => link.text && link.url);
    const outline = blocks
      .filter((block) => block.kind === "heading")
      .slice(0, 200)
      .map((block) => ({ id: block.id, level: block.level, text: block.text, ref: block.ref }));
    const frames = document.querySelectorAll("iframe").length;
    return {
      ok: true,
      page: pageEnvelope(),
      metadata: metadata(),
      root: elementSummary(root, false),
      blocks,
      outline,
      links,
      captureTruncated: blocks.length >= 2_000,
      coverage: {
        frames,
        warnings: frames > 0 ? ["Cross-origin frame contents may not be included in the readable document."] : [],
      },
    };
  }

  if (input.action === "dom") {
    const operation = typeof input.operation === "string" ? input.operation : "inspect";
    const maxChars = typeof input.maxChars === "number" ? Math.max(1, Math.min(100_000, input.maxChars)) : 12_000;
    if (operation === "query") {
      if (typeof input.cssSelector !== "string") throw new Error("DOM query requires cssSelector");
      let matches: Element[];
      try {
        matches = deepQuery(document, input.cssSelector);
      } catch {
        throw new Error(`Invalid CSS selector: ${input.cssSelector}`);
      }
      const limit = typeof input.limit === "number" ? Math.max(1, Math.min(200, input.limit)) : 50;
      return {
        ok: true,
        page: pageEnvelope(),
        totalMatches: matches.length,
        truncated: matches.length > limit,
        elements: matches.slice(0, limit).map((element) => elementSummary(element)),
      };
    }
    const element = scopeElement();
    if (operation === "html") {
      const html = sanitizeHtml(element);
      return {
        ok: true,
        page: pageEnvelope(),
        element: elementSummary(element, false),
        html: html.slice(0, maxChars),
        totalChars: html.length,
        truncated: html.length > maxChars,
        sanitized: true,
      };
    }
    const attributes = Object.fromEntries(
      Array.from(element.attributes)
        .filter((attribute) => !attribute.name.toLowerCase().startsWith("on"))
        .slice(0, 100)
        .map((attribute) => [attribute.name, attribute.value.slice(0, 500)]),
    );
    return {
      ok: true,
      page: pageEnvelope(),
      element: elementSummary(element),
      attributes,
      childCount: element.children.length,
      children: Array.from(element.children).slice(0, 50).map((child) => elementSummary(child, false)),
    };
  }

  if (input.action === "click") {
    const element = resolveOne();
    if (!visible(element)) throw new Error("Target element is not visible");
    if ("disabled" in element && Boolean((element as HTMLElement & { disabled?: boolean }).disabled)) {
      throw new Error("Target element is disabled");
    }
    (element as HTMLElement).scrollIntoView({ block: "center", inline: "center" });
    (element as HTMLElement).focus?.();
    if (typeof (element as HTMLElement).click === "function") (element as HTMLElement).click();
    else element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    return { ok: true, clicked: true, page: pageEnvelope(), element: elementSummary(element, false) };
  }

  if (input.action === "fill") {
    const element = resolveOne();
    const text = String(input.value ?? input.text ?? "");
    const clear = input.clear !== false;
    (element as HTMLElement).scrollIntoView({ block: "center", inline: "center" });
    (element as HTMLElement).focus?.();
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const next = clear ? text : element.value + text;
      const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (setter) setter.call(element, next);
      else element.value = next;
      element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: text }));
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (element instanceof HTMLSelectElement) {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else if ((element as HTMLElement).isContentEditable) {
      element.textContent = clear ? text : (element.textContent || "") + text;
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    } else {
      throw new Error("Target element cannot receive text");
    }
    if (input.submit === true) {
      const form = element.closest("form");
      if (form) form.requestSubmit();
      else element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    return {
      ok: true,
      filled: true,
      page: pageEnvelope(),
      element: elementSummary(element, false),
      sensitive: element instanceof HTMLInputElement && element.type.toLowerCase() === "password",
    };
  }

  if (input.action === "focus") {
    const element = resolveOne();
    (element as HTMLElement).scrollIntoView({ block: "center", inline: "center" });
    (element as HTMLElement).focus?.();
    return { ok: true, focused: true, page: pageEnvelope(), element: elementSummary(element, false) };
  }

  if (input.action === "bounds") {
    const element = resolveOne();
    return { ok: true, page: pageEnvelope(), element: elementSummary(element, false) };
  }

  if (input.action === "wait") {
    const timeoutMs = typeof input.timeoutMs === "number" ? Math.max(100, Math.min(30_000, input.timeoutMs)) : 5_000;
    const stableMs = typeof input.stableMs === "number" ? Math.max(0, Math.min(5_000, input.stableMs)) : 0;
    const started = Date.now();
    let lastMutation = Date.now();
    if (typeof input.cssSelector === "string") {
      try {
        document.querySelector(input.cssSelector);
      } catch {
        throw new Error(`Invalid CSS selector: ${input.cssSelector}`);
      }
    }
    const matches = (): boolean => {
      if (input.state === "interactive" && document.readyState === "loading") return false;
      if (input.state === "complete" && document.readyState !== "complete") return false;
      if (typeof input.urlIncludes === "string" && !location.href.includes(input.urlIncludes)) return false;
      if (typeof input.cssSelector === "string") {
        const element = document.querySelector(input.cssSelector);
        if (input.hidden === true ? element && visible(element) : !element) return false;
        if (input.visible === true && element && !visible(element)) return false;
      }
      if (typeof input.text === "string") {
        const bodyText = clean(document.body?.innerText || document.body?.textContent || "");
        if (!bodyText.toLowerCase().includes(clean(input.text).toLowerCase())) return false;
      }
      if (stableMs > 0 && Date.now() - lastMutation < stableMs) return false;
      return true;
    };
    if (matches()) return { ok: true, matched: true, elapsedMs: 0, page: pageEnvelope() };
    const matched = await new Promise<boolean>((resolve) => {
      let settled = false;
      let stabilityTimer = 0;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        window.clearTimeout(timeout);
        window.clearTimeout(stabilityTimer);
        window.removeEventListener("load", check);
        window.removeEventListener("hashchange", check);
        window.removeEventListener("popstate", check);
        resolve(value);
      };
      const check = (): void => {
        if (matches()) finish(true);
        else if (stableMs > 0) {
          window.clearTimeout(stabilityTimer);
          stabilityTimer = window.setTimeout(check, stableMs);
        }
      };
      const observer = new MutationObserver(() => {
        lastMutation = Date.now();
        check();
      });
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      window.addEventListener("load", check);
      window.addEventListener("hashchange", check);
      window.addEventListener("popstate", check);
      const timeout = window.setTimeout(() => finish(false), timeoutMs);
      check();
    });
    return { ok: true, matched, elapsedMs: Date.now() - started, page: pageEnvelope() };
  }

  if (input.action === "evaluate") {
    const source = String(input.script || "");
    const maxChars = typeof input.maxChars === "number" ? Math.max(1, Math.min(100_000, input.maxChars)) : 12_000;
    const timeoutMs = typeof input.timeoutMs === "number" ? Math.max(100, Math.min(10_000, input.timeoutMs)) : 3_000;
    const run = async (): Promise<unknown> => {
      try {
        return await (0, eval)(source);
      } catch {
        return await (0, eval)(`(async () => {\n${source}\n})()`);
      }
    };
    const value = await Promise.race([
      run(),
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error(`Page script exceeded ${timeoutMs}ms`)), timeoutMs)),
    ]);
    let text: string;
    if (typeof value === "string") text = value;
    else if (value === undefined) text = "undefined";
    else {
      try {
        text = JSON.stringify(value, null, 2);
      } catch {
        text = String(value);
      }
    }
    return {
      ok: true,
      page: pageEnvelope(),
      resultType: value === null ? "null" : typeof value,
      text: text.slice(0, maxChars),
      totalChars: text.length,
      truncated: text.length > maxChars,
    };
  }

  throw new Error(`Unsupported browser page action: ${String(input.action)}`);
}
