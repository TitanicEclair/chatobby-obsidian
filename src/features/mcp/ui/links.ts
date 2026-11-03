export function safeExternalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** All external MCP links share the same scheme and new-window boundary. */
export function renderExternalLink(parent: HTMLElement, text: string, value: string | undefined): HTMLAnchorElement | undefined {
  const href = safeExternalUrl(value);
  if (!href) return undefined;
  return parent.createEl("a", { text, href, attr: { target: "_blank", rel: "noopener noreferrer" } });
}
