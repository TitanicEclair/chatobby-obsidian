export interface LinkDecorators {
  openVaultLink(path: string): void;
  openSystemPath(path: string): void;
}

export function decorateAfterMarkdown(
  container: HTMLElement,
  rendered: void | Promise<void>,
  decorators: LinkDecorators,
): void {
  const decorate = () => {
    decorateCodeBlocks(container);
    decorateMarkdownTables(container);
    decorateFeedLinks(container, decorators);
  };
  if (isPromiseLike(rendered)) {
    rendered.then(decorate).catch((e: unknown) => {
      console.error("Chatobby: markdown render failed", e);
    });
    return;
  }
  decorate();
}

export function decorateCodeBlocks(container: HTMLElement): void {
  for (const block of Array.from(container.querySelectorAll("pre"))) {
    block.addClass("chatobby-code-block");
    const btn = block.createEl("button", {
      cls: "chatobby-code-block__copy",
      attr: { "aria-label": "Copy code", title: "Copy code" },
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const code = block.querySelector("code")?.textContent ?? block.textContent ?? "";
      navigator.clipboard.writeText(code).catch(() => {});
      btn.addClass("is-copied");
      setTimeout(() => btn.removeClass("is-copied"), 1200);
    });
  }
}

export function decorateMarkdownTables(container: HTMLElement): void {
  for (const table of Array.from(container.querySelectorAll("table"))) {
    table.addClass("chatobby-markdown-table");
    const parent = table.parentElement;
    if (parent?.hasClass("chatobby-markdown-table-wrap")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "chatobby-markdown-table-wrap";
    parent?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
}

export function decorateFeedLinks(container: HTMLElement, decorators: LinkDecorators): void {
  decorateRenderedAnchors(container, decorators);
  linkifyPlainTextRefs(container, decorators);
}

export function decorateVaultLinks(container: HTMLElement, openVaultLink: (path: string) => void): void {
  decorateFeedLinks(container, {
    openVaultLink,
    openSystemPath: openVaultLink,
  });
}

function decorateRenderedAnchors(container: HTMLElement, decorators: LinkDecorators): void {
  for (const link of Array.from(container.querySelectorAll("a"))) {
    const target = linkTarget(link);
    if (!target) continue;
    link.addClass("chatobby-vault-link");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      decorators.openVaultLink(target);
    });
  }
}

const WIKILINK_RE = /\[\[([^\[\]\n]+?)\]\]/g;
const VAULT_PATH_RE = /(^|[^[\w/:.-])(\.?\/?[\w][\w/.-]*\.md)(?=[\s)\].,;:!?]|$)/g;
const WINDOWS_PATH_RE = /\b([A-Za-z]:\\[^\n<>:"|?*]+?)(?=[\s)\],;:!?]|$)/g;
const FILE_URL_RE = /\bfile:\/\/\/[^\s)\],;:!?]+/g;

type PlainRef = {
  start: number;
  end: number;
  label: string;
  target: string;
  kind: "vault" | "system";
};

function linkTarget(link: HTMLAnchorElement): string | null {
  const dataHref = link.getAttribute("data-href")?.trim();
  if (dataHref) return toVaultLinktext(dataHref);

  const href = link.getAttribute("href")?.trim();
  if (!href) return null;
  if (href.startsWith("obsidian://")) return obsidianUriTarget(href);
  if (href.endsWith(".md") || href.includes(".md#")) return toVaultLinktext(href);
  if (link.hasClass("internal-link")) return toVaultLinktext(href);
  return null;
}

function obsidianUriTarget(href: string): string | null {
  try {
    const url = new URL(href);
    const file = url.searchParams.get("file") ?? url.searchParams.get("path");
    if (!file) return null;
    return toVaultLinktext(file);
  } catch {
    return null;
  }
}

function linkifyPlainTextRefs(container: HTMLElement, decorators: LinkDecorators): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent || isExcludedTextParent(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text) nodes.push(node);
  }

  for (const node of nodes) {
    replaceTextRefs(node, decorators);
  }
}

function replaceTextRefs(node: Text, decorators: LinkDecorators): void {
  const text = node.nodeValue ?? "";
  const refs = findPlainRefs(text);
  if (refs.length === 0) return;

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const ref of refs) {
    if (ref.start > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, ref.start)));
    const link = document.createElement("a");
    link.className = ref.kind === "vault" ? "internal-link chatobby-vault-link" : "external-link chatobby-system-path-link";
    link.textContent = ref.label;
    link.setAttribute("href", ref.kind === "vault" ? ref.target : `file:///${ref.target.replace(/\\/g, "/")}`);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (ref.kind === "vault") decorators.openVaultLink(ref.target);
      else decorators.openSystemPath(ref.target);
    });
    fragment.appendChild(link);
    cursor = ref.end;
  }
  if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
  node.parentNode?.replaceChild(fragment, node);
}

function findPlainRefs(text: string): PlainRef[] {
  const refs = [...wikilinkRefs(text), ...vaultPathRefs(text), ...windowsPathRefs(text), ...fileUrlRefs(text)];
  refs.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: PlainRef[] = [];
  let cursor = 0;
  for (const ref of refs) {
    if (ref.start < cursor) continue;
    out.push(ref);
    cursor = ref.end;
  }
  return out;
}

function wikilinkRefs(text: string): PlainRef[] {
  const refs: PlainRef[] = [];
  for (const match of text.matchAll(WIKILINK_RE)) {
    if (match.index === undefined) continue;
    const inner = match[1];
    if (!inner) continue;
    const pipe = inner.indexOf("|");
    const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim() || target;
    if (!target) continue;
    refs.push({
      start: match.index,
      end: match.index + match[0].length,
      target: toVaultLinktext(target),
      label,
      kind: "vault",
    });
  }
  return refs;
}

function vaultPathRefs(text: string): PlainRef[] {
  const refs: PlainRef[] = [];
  for (const match of text.matchAll(VAULT_PATH_RE)) {
    if (match.index === undefined || match[2] === undefined) continue;
    const path = match[2];
    const start = match.index + match[0].length - path.length;
    refs.push({ start, end: start + path.length, target: toVaultLinktext(path), label: path, kind: "vault" });
  }
  return refs;
}

function windowsPathRefs(text: string): PlainRef[] {
  const refs: PlainRef[] = [];
  for (const match of text.matchAll(WINDOWS_PATH_RE)) {
    if (match.index === undefined || match[1] === undefined) continue;
    const path = trimPathSuffix(match[1]);
    refs.push({ start: match.index, end: match.index + path.length, target: path, label: path, kind: "system" });
  }
  return refs;
}

function fileUrlRefs(text: string): PlainRef[] {
  const refs: PlainRef[] = [];
  for (const match of text.matchAll(FILE_URL_RE)) {
    if (match.index === undefined) continue;
    const label = match[0];
    const target = fileUrlPath(label);
    if (!target) continue;
    refs.push({ start: match.index, end: match.index + label.length, target, label, kind: "system" });
  }
  return refs;
}

function toVaultLinktext(target: string): string {
  const clean = target.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  return clean.replace(/\.md(?=#|$)/i, "");
}

function fileUrlPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "file:") return null;
    return decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:\/)/, "$1").replace(/\//g, "\\");
  } catch {
    return null;
  }
}

function trimPathSuffix(path: string): string {
  return path.replace(/[.,;:!?]+$/, "");
}

function isExcludedTextParent(element: HTMLElement): boolean {
  return Boolean(element.closest("a, code, pre, script, style"));
}

function isPromiseLike(value: void | Promise<void>): value is Promise<void> {
  return Boolean(value && typeof value.then === "function");
}
