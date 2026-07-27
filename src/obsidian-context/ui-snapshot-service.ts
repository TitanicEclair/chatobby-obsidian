import type { App, TFile } from "obsidian";
import { BridgeError } from "../obsidian-bridge/types";
import { getObsidianSemanticContextService } from "./semantic-context-service";

const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const MAX_CAPTURED_NODES = 2_000;
const MAX_RETAINED_DOCUMENTS = 16;
const DOCUMENT_TTL_MS = 5 * 60_000;
const MAX_NODE_TEXT = 240;

type UiAction = "click" | "focus" | "set_expanded" | "set_value";

interface ViewLike {
  contentEl?: HTMLElement;
  containerEl?: HTMLElement;
  file?: TFile | null;
  getViewType?: () => string;
  getDisplayText?: () => string;
}

interface LeafLike {
  id?: string;
  view?: ViewLike;
}

interface WorkspaceLike {
  activeLeaf?: LeafLike | null;
  getMostRecentLeaf?: () => LeafLike | null;
}

export interface ObsidianUiNodeState {
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
  checked?: boolean;
  pressed?: boolean;
  current?: string;
  valueRedacted?: boolean;
}

export interface ObsidianUiNode {
  ref: string;
  parentRef?: string;
  depth: number;
  role: string;
  tag: string;
  type?: string;
  name?: string;
  text?: string;
  description?: string;
  href?: string;
  value?: string;
  state: ObsidianUiNodeState;
}

interface CapturedNode {
  node: ObsidianUiNode;
  element: Element;
}

interface CapturedTree {
  nodes: CapturedNode[];
  scannedElements: number;
  availableNodes: number;
  fingerprint: string;
}

interface RetainedDocument {
  documentId: string;
  documentRevision: string;
  contextId: string;
  leafId: string;
  pageRevision: number;
  capturedAt: string;
  expiresAt: number;
  view: { viewType: string; title?: string; path?: string };
  focus: {
    ref?: string;
    role?: string;
    name?: string;
    caret?: { start: number; end: number; direction?: "forward" | "backward" | "none" };
  };
  nodes: CapturedNode[];
  availableNodes: number;
  fingerprint: string;
  workspace: {
    activeLeafId?: string;
    leaves: Array<Record<string, unknown>>;
    layout?: Record<string, unknown>;
  };
  warnings: string[];
}

interface CursorRecord {
  documentId: string;
  offset: number;
  expiresAt: number;
}

export interface ObsidianUiSnapshotInput {
  leafId?: string;
  cursor?: string;
  limit?: number;
}

export interface ObsidianUiInteractInput {
  ref: string;
  documentRevision: string;
  action: UiAction;
  value?: string;
  expanded?: boolean;
}

export interface ObsidianUiSnapshot {
  schemaVersion: 1;
  contextId: string;
  leafId: string;
  documentId: string;
  documentRevision: string;
  capturedAt: string;
  view: RetainedDocument["view"];
  focus: RetainedDocument["focus"];
  nodes: ObsidianUiNode[];
  page: {
    returned: number;
    total: number;
    nextCursor?: string;
    truncated: boolean;
  };
  coverage: {
    kind: "visible_item_view" | "visible_item_view_prefix";
    exact: boolean;
    availableNodes: number;
    capturedNodes: number;
    hardLimit: number;
  };
  workspace: RetainedDocument["workspace"];
  warnings: string[];
}

export interface ObsidianUiInteractionResult {
  performed: true;
  action: UiAction;
  ref: string;
  documentId: string;
  previousRevision: string;
  currentPageRevision: number;
  refreshRequired: true;
}

export interface ObsidianUiDiagnostics {
  snapshots: number;
  interactions: number;
  treeCaptures: number;
  scannedElements: number;
  semanticNodes: number;
  lastTraversalMs: number;
  maxTraversalMs: number;
}

const services = new WeakMap<App, ObsidianUiSnapshotService>();

function activeLeaf(app: App): LeafLike | undefined {
	const workspace = app.workspace as unknown as WorkspaceLike;
	return workspace.activeLeaf ?? workspace.getMostRecentLeaf?.() ?? undefined;
}

function viewRoot(view: ViewLike | undefined): HTMLElement | null {
  return view?.contentEl ?? view?.containerEl ?? null;
}

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

function hashText(value: string): string {
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

function captureTree(root: HTMLElement, signal?: AbortSignal): CapturedTree {
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

function focusedState(
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

function setElementValue(element: Element, value: string): void {
  const tag = element.tagName.toLowerCase();
  if (tag === "input") {
    const input = element as HTMLInputElement;
    if (["button", "submit", "reset", "checkbox", "radio", "file"].includes(input.type)) {
      throw new BridgeError("INVALID_INPUT", `set_value is not supported for input type '${input.type}'`);
    }
    input.value = value;
  } else if (tag === "textarea") {
    (element as HTMLTextAreaElement).value = value;
  } else if (tag === "select") {
    (element as HTMLSelectElement).value = value;
  } else if (element.getAttribute("contenteditable") === "true") {
    element.textContent = value;
  } else {
    throw new BridgeError("INVALID_INPUT", "set_value requires an input, textarea, select, or contenteditable element");
  }
  const EventConstructor = element.ownerDocument.defaultView?.Event ?? Event;
  element.dispatchEvent(new EventConstructor("input", { bubbles: true }));
  element.dispatchEvent(new EventConstructor("change", { bubbles: true }));
}

function performInteraction(element: Element, input: ObsidianUiInteractInput): void {
  if (input.action === "click") {
    const clickable = element as Element & { click?: () => void };
    if (clickable.click) clickable.click();
    else {
      const MouseEventConstructor = element.ownerDocument.defaultView?.MouseEvent ?? MouseEvent;
      element.dispatchEvent(new MouseEventConstructor("click", { bubbles: true, cancelable: true }));
    }
    return;
  }
  if (input.action === "focus") {
    const focusable = element as Element & { focus?: () => void };
    if (!focusable.focus) throw new BridgeError("INVALID_INPUT", "The referenced element cannot receive focus");
    focusable.focus();
    return;
  }
  if (input.action === "set_expanded") {
    if (input.expanded === undefined) {
      throw new BridgeError("INVALID_INPUT", "set_expanded requires the 'expanded' boolean");
    }
    if (element.tagName.toLowerCase() === "details") {
      (element as HTMLDetailsElement).open = input.expanded;
    } else if (element.hasAttribute("aria-expanded")) {
      element.setAttribute("aria-expanded", String(input.expanded));
    } else {
      throw new BridgeError("INVALID_INPUT", "set_expanded requires a details or aria-expanded element");
    }
    const EventConstructor = element.ownerDocument.defaultView?.Event ?? Event;
    element.dispatchEvent(new EventConstructor("toggle", { bubbles: true }));
    return;
  }
  if (input.value === undefined) throw new BridgeError("INVALID_INPUT", "set_value requires the 'value' string");
  setElementValue(element, input.value);
}

export class ObsidianUiSnapshotService {
  private readonly documents = new Map<string, RetainedDocument>();
  private readonly cursors = new Map<string, CursorRecord>();
  private readonly refDocuments = new Map<string, string>();
  private readonly diagnosticState: ObsidianUiDiagnostics = {
    snapshots: 0,
    interactions: 0,
    treeCaptures: 0,
    scannedElements: 0,
    semanticNodes: 0,
    lastTraversalMs: 0,
    maxTraversalMs: 0,
  };

  constructor(
    private readonly app: App,
    private readonly now: () => number = () => Date.now(),
    private readonly monotonicNow: () => number = () => window.performance?.now() ?? Date.now(),
  ) {}

  snapshot(input: ObsidianUiSnapshotInput, signal?: AbortSignal): ObsidianUiSnapshot {
    this.diagnosticState.snapshots += 1;
    this.prune();
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, input.limit ?? DEFAULT_PAGE_SIZE));
    if (input.cursor) return this.continueSnapshot(input.cursor, limit);

    const leaf = activeLeaf(this.app);
    if (!leaf?.id) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "No active Obsidian leaf with a stable id");
    if (input.leafId && input.leafId !== leaf.id) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        `The active Obsidian leaf changed from '${input.leafId}' to '${leaf.id}'. Take a fresh snapshot.`,
        false,
        { expectedLeafId: input.leafId, currentLeafId: leaf.id },
      );
    }
    const semantic = getObsidianSemanticContextService(this.app).snapshot();
    const root = viewRoot(leaf.view);
    const tree = root
      ? this.captureTree(root, signal)
      : { nodes: [], scannedElements: 0, availableNodes: 0, fingerprint: hashText("") };
    const documentId = `doc_${crypto.randomUUID()}`;
    const documentRevision = `${semantic.revisions.page}.${tree.fingerprint}`;
    const warnings: string[] = [];
    if (!root) warnings.push("The active ItemView does not expose a visible content root.");
    if (tree.availableNodes > tree.nodes.length) {
      warnings.push(`Only the first ${MAX_CAPTURED_NODES} semantic nodes were retained; narrow the visible view before interacting beyond that prefix.`);
    }
    const view = {
      viewType: leaf.view?.getViewType?.() ?? semantic.focus?.viewType ?? "unknown",
      ...(leaf.view?.getDisplayText?.() ? { title: leaf.view.getDisplayText() } : {}),
      ...(leaf.view?.file?.path ? { path: leaf.view.file.path } : {}),
    };
    const document: RetainedDocument = {
      documentId,
      documentRevision,
      contextId: semantic.contextId,
      leafId: leaf.id,
      pageRevision: semantic.revisions.page,
      capturedAt: semantic.capturedAt,
      expiresAt: this.now() + DOCUMENT_TTL_MS,
      view,
      focus: root ? focusedState(root, tree.nodes) : {},
      nodes: tree.nodes,
      availableNodes: tree.availableNodes,
      fingerprint: tree.fingerprint,
      workspace: {
        ...(semantic.workspace.activeLeafId ? { activeLeafId: semantic.workspace.activeLeafId } : {}),
        leaves: semantic.workspace.leaves,
        ...(semantic.workspace.layout ? { layout: semantic.workspace.layout } : {}),
      },
      warnings,
    };
    this.retain(document);
    return this.page(document, 0, limit);
  }

	interact(input: ObsidianUiInteractInput, signal?: AbortSignal): ObsidianUiInteractionResult {
		this.diagnosticState.interactions += 1;
		this.prune();
		if (signal?.aborted) throw new BridgeError("OPERATION_CANCELLED", "Obsidian UI interaction was cancelled");
		if (!input.ref || !input.documentRevision) {
			throw new BridgeError("INVALID_INPUT", "Obsidian UI interaction requires a ref and documentRevision");
		}
		if (!["click", "focus", "set_expanded", "set_value"].includes(input.action)) {
			throw new BridgeError("INVALID_INPUT", `Unsupported Obsidian UI action '${String(input.action)}'`);
		}
    const documentId = this.refDocuments.get(input.ref);
    const retained = documentId ? this.documents.get(documentId) : undefined;
    if (!retained) {
      throw new BridgeError("RESULT_EXPIRED", "The Obsidian UI ref expired. Take a fresh obsidian_ui_snapshot.", false);
    }
    if (input.documentRevision !== retained.documentRevision) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        "The supplied Obsidian UI document revision does not match the referenced snapshot.",
        false,
        { expected: retained.documentRevision, received: input.documentRevision },
      );
    }
    const leaf = activeLeaf(this.app);
    const root = viewRoot(leaf?.view);
    const semanticService = getObsidianSemanticContextService(this.app);
    const semantic = semanticService.snapshot();
    if (!leaf?.id || leaf.id !== retained.leafId || semantic.contextId !== retained.contextId || !root) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        "The active Obsidian view changed. Take a fresh obsidian_ui_snapshot.",
        false,
        {
          expectedLeafId: retained.leafId,
          currentLeafId: leaf?.id,
          expectedContextId: retained.contextId,
          currentContextId: semantic.contextId,
        },
      );
    }
    const currentTree = this.captureTree(root, signal);
    if (semantic.revisions.page !== retained.pageRevision || currentTree.fingerprint !== retained.fingerprint) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        "The visible Obsidian UI changed after the ref was captured. Take a fresh snapshot.",
        false,
        {
          expectedPageRevision: retained.pageRevision,
          currentPageRevision: semantic.revisions.page,
          fingerprintChanged: currentTree.fingerprint !== retained.fingerprint,
        },
      );
    }
    const captured = retained.nodes.find((entry) => entry.node.ref === input.ref);
    if (!captured || !root.contains(captured.element)) {
      throw new BridgeError("RESULT_EXPIRED", "The referenced Obsidian UI element is no longer available. Take a fresh snapshot.");
    }
    performInteraction(captured.element, input);
    semanticService.invalidate(input.action === "focus" ? ["focus", "page"] : ["page"]);
    const updated = semanticService.snapshot();
    this.dropDocument(retained.documentId);
    return {
      performed: true,
      action: input.action,
      ref: input.ref,
      documentId: retained.documentId,
      previousRevision: retained.documentRevision,
      currentPageRevision: updated.revisions.page,
      refreshRequired: true,
    };
  }

  private continueSnapshot(cursor: string, limit: number): ObsidianUiSnapshot {
    const record = this.cursors.get(cursor);
    const document = record ? this.documents.get(record.documentId) : undefined;
    if (!record || !document || record.expiresAt <= this.now()) {
      this.cursors.delete(cursor);
      throw new BridgeError("RESULT_EXPIRED", "The Obsidian UI cursor expired. Take a fresh snapshot.", false);
    }
    return this.page(document, record.offset, limit);
  }

  diagnostics(): ObsidianUiDiagnostics {
    return { ...this.diagnosticState };
  }

  private captureTree(root: HTMLElement, signal?: AbortSignal): CapturedTree {
    const startedAt = this.monotonicNow();
    const tree = captureTree(root, signal);
    const duration = Math.max(0, this.monotonicNow() - startedAt);
    this.diagnosticState.treeCaptures += 1;
    this.diagnosticState.scannedElements += tree.scannedElements;
    this.diagnosticState.semanticNodes += tree.availableNodes;
    this.diagnosticState.lastTraversalMs = duration;
    this.diagnosticState.maxTraversalMs = Math.max(this.diagnosticState.maxTraversalMs, duration);
    return tree;
  }

  private page(document: RetainedDocument, offset: number, limit: number): ObsidianUiSnapshot {
    const pageNodes = document.nodes.slice(offset, offset + limit).map((entry) => entry.node);
    const nextOffset = offset + pageNodes.length;
    const nextCursor = nextOffset < document.nodes.length ? this.createCursor(document, nextOffset) : undefined;
    return {
      schemaVersion: 1,
      contextId: document.contextId,
      leafId: document.leafId,
      documentId: document.documentId,
      documentRevision: document.documentRevision,
      capturedAt: document.capturedAt,
      view: document.view,
      focus: document.focus,
      nodes: pageNodes,
      page: {
        returned: pageNodes.length,
        total: document.nodes.length,
        ...(nextCursor ? { nextCursor } : {}),
        truncated: Boolean(nextCursor) || document.availableNodes > document.nodes.length,
      },
      coverage: {
        kind: document.availableNodes > document.nodes.length ? "visible_item_view_prefix" : "visible_item_view",
        exact: document.availableNodes === document.nodes.length,
        availableNodes: document.availableNodes,
        capturedNodes: document.nodes.length,
        hardLimit: MAX_CAPTURED_NODES,
      },
      workspace: document.workspace,
      warnings: document.warnings,
    };
  }

  private createCursor(document: RetainedDocument, offset: number): string {
    const cursor = `cur_${crypto.randomUUID()}`;
    this.cursors.set(cursor, {
      documentId: document.documentId,
      offset,
      expiresAt: document.expiresAt,
    });
    return cursor;
  }

  private retain(document: RetainedDocument): void {
    while (this.documents.size >= MAX_RETAINED_DOCUMENTS) {
      const oldest = this.documents.keys().next().value as string | undefined;
      if (!oldest) break;
      this.dropDocument(oldest);
    }
    this.documents.set(document.documentId, document);
    for (const node of document.nodes) this.refDocuments.set(node.node.ref, document.documentId);
  }

  private dropDocument(documentId: string): void {
    const document = this.documents.get(documentId);
    if (document) {
      for (const node of document.nodes) this.refDocuments.delete(node.node.ref);
    }
    this.documents.delete(documentId);
    for (const [cursor, record] of this.cursors) {
      if (record.documentId === documentId) this.cursors.delete(cursor);
    }
  }

  private prune(): void {
    const now = this.now();
    for (const [documentId, document] of this.documents) {
      if (document.expiresAt <= now) this.dropDocument(documentId);
    }
    for (const [cursor, record] of this.cursors) {
      if (record.expiresAt <= now) this.cursors.delete(cursor);
    }
  }
}

export function getObsidianUiSnapshotService(app: App): ObsidianUiSnapshotService {
  const existing = services.get(app);
  if (existing) return existing;
  const service = new ObsidianUiSnapshotService(app);
  services.set(app, service);
  return service;
}

export function disposeObsidianUiSnapshotService(app: App): void {
  services.delete(app);
}
