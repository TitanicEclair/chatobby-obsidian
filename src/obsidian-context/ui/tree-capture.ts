import { BridgeError } from "../../obsidian-bridge/types";
import type { CapturedNode, CapturedTree, RetainedDocument, ObsidianUiNode, ObsidianUiNodeState } from "./types";

export const MAX_CAPTURED_NODES = 2_000;
const MAX_NODE_TEXT = 240;

function normalizedText(value: string | null | undefined, limit = MAX_NODE_TEXT): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function ariaBoolean(element: Element, name: string): boolean | undefined {
  const value = element.getAttribute(name);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function implicitRole(element: Element): string | undefined {
  const explicit = element.getAttribute("role")?.trim();
  if (explicit) return explicit;
  const tag = element.tagName.toLowerCase();
  if (tag === "button" || tag === "summary") return "button";
  if (tag === "a" && element.hasAttribute("href")) return "link";
  if (tag === "textarea") return "textbox";
  if (tag === "select") return "combobox";
  if (tag === "option") return "option";
  if (tag === "details") return "group";
  if (/^h[1-6]$/u.test(tag)) return "heading";
  if (tag === "p") return "paragraph";
  if (tag === "li") return "listitem";
  if (tag === "td") return "cell";
  if (tag === "th") return "columnheader";
  if (tag === "pre") return "pre";
  if (tag === "code") return "code";
  if (tag === "blockquote") return "blockquote";
  if (tag === "nav") return "navigation";
  if (tag === "main") return "main";
  if (tag === "aside") return "complementary";
  if (tag === "input") {
    const type = (element.getAttribute("type") ?? "text").toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "button" || type === "submit" || type === "reset") return "button";
    return "textbox";
  }
  if (element.getAttribute("contenteditable") === "true") return "textbox";
  if (element.hasAttribute("tabindex")) return "generic";
  return undefined;
}

function isVisible(element: Element, root: Element, cache: WeakMap<Element, boolean>): boolean {
  const cached = cache.get(element);
  if (cached !== undefined) return cached;

  let visible = true;
  if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") {
    visible = false;
  } else {
    const style = element.getAttribute("style")?.toLowerCase() ?? "";
    if (
      /(?:^|;)\s*display\s*:\s*none(?:;|$)/u.test(style)
      || /(?:^|;)\s*visibility\s*:\s*hidden(?:;|$)/u.test(style)
    ) {
      visible = false;
    } else {
      const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
      if (
        computed?.display === "none"
        || computed?.visibility === "hidden"
        || computed?.visibility === "collapse"
      ) {
        visible = false;
      }
    }
  }

  if (visible && element !== root) {
    const parent = element.parentElement;
    visible = Boolean(parent && root.contains(parent) && isVisible(parent, root, cache));
    if (visible && parent?.tagName.toLowerCase() === "details" && !(parent as HTMLDetailsElement).open) {
      const summary = Array.from(parent.children).find((child) => child.tagName.toLowerCase() === "summary");
      visible = Boolean(summary && (element === summary || summary.contains(element)));
    }
  }

  cache.set(element, visible);
  return visible;
}

function isInteractiveRole(role: string): boolean {
  return [
    "button",
    "link",
    "textbox",
    "checkbox",
    "radio",
    "combobox",
    "option",
    "tab",
    "menuitem",
    "treeitem",
    "slider",
    "switch",
  ].includes(role);
}

function isDuplicateTextBlock(element: Element, role: string): boolean {
  if (isInteractiveRole(role)) return false;
  const parent = element.parentElement?.closest(
    "button,a[href],input,textarea,select,summary,[role='button'],[role='link'],[role='tab'],[role='menuitem']",
  );
  return parent !== null;
}

function labelledText(element: Element): string | undefined {
  const ariaLabel = normalizedText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const document = element.ownerDocument;
    const labels = labelledBy
      .split(/\s+/u)
      .map((id) => normalizedText(document.getElementById(id)?.textContent))
      .filter((value): value is string => Boolean(value));
    if (labels.length > 0) return normalizedText(labels.join(" "));
  }
  for (const attribute of ["title", "alt", "placeholder"] as const) {
    const value = normalizedText(element.getAttribute(attribute));
    if (value) return value;
  }
  const id = element.getAttribute("id");
  if (id) {
    const css = element.ownerDocument.defaultView?.CSS;
    const escaped = css?.escape ? css.escape(id) : id.replace(/["\\]/gu, "\\$&");
    const label = element.ownerDocument.querySelector(`label[for="${escaped}"]`);
    const value = normalizedText(label?.textContent);
    if (value) return value;
  }
  return normalizedText(element.textContent);
}

function describedText(element: Element): string | undefined {
  const direct = normalizedText(element.getAttribute("aria-description"));
  if (direct) return direct;
  const describedBy = element.getAttribute("aria-describedby");
  if (!describedBy) return undefined;
  const values = describedBy
    .split(/\s+/u)
    .map((id) => normalizedText(element.ownerDocument.getElementById(id)?.textContent))
    .filter((value): value is string => Boolean(value));
  return normalizedText(values.join(" "));
}

function isSensitiveValueElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "input") {
    const type = (element as HTMLInputElement).type.toLowerCase();
    if (type === "password" || type === "file") return true;
  }
  const autocomplete = element.getAttribute("autocomplete")?.toLowerCase().split(/\s+/u) ?? [];
  return autocomplete.some((token) => [
    "current-password",
    "new-password",
    "one-time-code",
    "cc-csc",
    "cc-number",
  ].includes(token));
}

function elementState(element: Element, role: string): ObsidianUiNodeState {
  const tag = element.tagName.toLowerCase();
  const input = tag === "input" ? element as HTMLInputElement : undefined;
  const option = tag === "option" ? element as HTMLOptionElement : undefined;
  const details = tag === "details" ? element as HTMLDetailsElement : undefined;
  const disabled = "disabled" in element
    ? Boolean((element as Element & { disabled?: boolean }).disabled)
    : ariaBoolean(element, "aria-disabled");
  const state: ObsidianUiNodeState = {};
  if (disabled !== undefined) state.disabled = disabled;
  const expanded = details ? details.open : ariaBoolean(element, "aria-expanded");
  if (expanded !== undefined) state.expanded = expanded;
  const selected = option ? option.selected : ariaBoolean(element, "aria-selected");
  if (selected !== undefined) state.selected = selected;
  const checked = input && (role === "checkbox" || role === "radio")
    ? input.checked
    : ariaBoolean(element, "aria-checked");
  if (checked !== undefined) state.checked = checked;
  const pressed = ariaBoolean(element, "aria-pressed");
  if (pressed !== undefined) state.pressed = pressed;
  const current = element.getAttribute("aria-current");
  if (current) state.current = current;
  if (isSensitiveValueElement(element)) state.valueRedacted = true;
  return state;
}

function elementValue(element: Element): string | undefined {
  if (isSensitiveValueElement(element)) return undefined;
  const tag = element.tagName.toLowerCase();
  if (tag === "input") {
    const input = element as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") {
      return undefined;
    }
    return normalizedText(input.value);
  }
  if (tag === "textarea") return normalizedText((element as HTMLTextAreaElement).value);
  if (tag === "select") return normalizedText((element as HTMLSelectElement).value);
  if (element.getAttribute("contenteditable") === "true") return normalizedText(element.textContent);
  return undefined;
}

function elementText(element: Element, role: string): string | undefined {
  return isInteractiveRole(role) || role === "heading" ? undefined : normalizedText(element.textContent);
}

export function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function nodeSignature(node: Omit<ObsidianUiNode, "ref" | "parentRef">): string {
	return JSON.stringify(node);
}

function domDepth(element: Element, root: Element): number {
	let depth = 0;
	let current = element;
	while (current !== root && current.parentElement) {
		depth += 1;
		current = current.parentElement;
	}
	return depth;
}

export function captureTree(root: HTMLElement, signal?: AbortSignal): CapturedTree {
  const candidates = [root, ...Array.from(root.querySelectorAll("*"))];
  const nodes: CapturedNode[] = [];
  const refs = new Map<Element, string>();
  const depths = new Map<Element, number>();
  const visibility = new WeakMap<Element, boolean>();
  let availableNodes = 0;
  const signatures: string[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    if (index % 100 === 0 && signal?.aborted) {
      throw new BridgeError("OPERATION_CANCELLED", "Obsidian UI snapshot was cancelled", false);
    }
    const element = candidates[index];
    if (!element || !isVisible(element, root, visibility)) continue;
    const role = implicitRole(element);
    if (!role || isDuplicateTextBlock(element, role)) continue;
    availableNodes += 1;
    const tag = element.tagName.toLowerCase();
    const type = tag === "input" ? (element.getAttribute("type") ?? "text").toLowerCase() : undefined;
    const name = isInteractiveRole(role) || role === "heading" ? labelledText(element) : undefined;
    const text = elementText(element, role);
    const description = describedText(element);
    const value = elementValue(element);
    const baseNode: Omit<ObsidianUiNode, "ref" | "parentRef"> = {
      depth: 0,
      role,
      tag,
      ...(type ? { type } : {}),
      ...(name ? { name } : {}),
      ...(text ? { text } : {}),
      ...(description ? { description } : {}),
      ...(tag === "a" && element.getAttribute("href") ? { href: element.getAttribute("href")! } : {}),
      ...(value ? { value } : {}),
      state: elementState(element, role),
    };
		signatures.push(`${domDepth(element, root)}:${nodeSignature(baseNode)}`);
    if (nodes.length >= MAX_CAPTURED_NODES) continue;
    let parent = element.parentElement;
    let parentRef: string | undefined;
    let depth = 0;
    while (parent && root.contains(parent)) {
      const ref = refs.get(parent);
      if (ref) {
        parentRef = ref;
        depth = (depths.get(parent) ?? -1) + 1;
        break;
      }
      if (parent === root) break;
      parent = parent.parentElement;
    }
    const ref = `ui_${crypto.randomUUID()}`;
    refs.set(element, ref);
    depths.set(element, depth);
    nodes.push({
      element,
      node: {
        ...baseNode,
        ref,
        ...(parentRef ? { parentRef } : {}),
        depth,
      },
    });
  }
  return {
    nodes,
    scannedElements: candidates.length,
    availableNodes,
    fingerprint: hashText(signatures.join("\n")),
  };
}

export function focusedState(
  root: HTMLElement,
  nodes: readonly CapturedNode[],
): RetainedDocument["focus"] {
  const active = root.ownerDocument.activeElement;
  if (!active || !root.contains(active)) return {};
  const captured = nodes.find((entry) => entry.element === active);
  const focus: RetainedDocument["focus"] = {
    ...(captured ? {
      ref: captured.node.ref,
      role: captured.node.role,
      ...(captured.node.name ? { name: captured.node.name } : {}),
    } : {}),
  };
  const tag = active.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") {
    const input = active as HTMLInputElement | HTMLTextAreaElement;
    if (input.selectionStart !== null && input.selectionEnd !== null) {
      const direction = input.selectionDirection;
      focus.caret = {
        start: input.selectionStart,
        end: input.selectionEnd,
        ...(direction === "forward" || direction === "backward" || direction === "none"
          ? { direction }
          : {}),
      };
    }
  } else if (active.getAttribute("contenteditable") === "true") {
    const selection = root.ownerDocument.defaultView?.getSelection();
    if (selection?.anchorNode && active.contains(selection.anchorNode)) {
      focus.caret = {
        start: selection.anchorOffset,
        end: selection.focusOffset,
      };
    }
  }
  return focus;
}
