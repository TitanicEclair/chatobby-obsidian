import type { App, EventRef, TFile } from "obsidian";
import type {
  ObsidianBridgeContextChanged,
  ObsidianContextChangedDomain,
  ObsidianContextRevisions,
} from "../vendor/@chatobby/obsidian-protocol/bridge-protocol";
import type { ObsidianCapabilityState } from "../vendor/@chatobby/obsidian-protocol/tool-capabilities";
import { collectObsidianCapabilityState } from "../obsidian-bridge/dependency-snapshot";
import { buildNoteContextExcerpt } from "../obsidian-bridge/operations/helpers/note-io";
import { getVaultIdentity } from "../obsidian-bridge/operations/helpers/vault-identity";
import {
  CONTEXT_EXCERPT_AFTER,
  CONTEXT_EXCERPT_BEFORE,
  CONTEXT_EXCERPT_MAX_CHARS,
  CONTEXT_MAX_OPEN_NOTES,
} from "../prompt/constants";

type ContextInclude = "activeNote" | "selection" | "cursor" | "headings" | "openNotes";
export type SemanticContextScope = "current" | "active-view" | "workspace" | "region" | "leaf";

export interface SemanticContextProjectionInput {
  include?: ContextInclude[];
  maxOpenNotes?: number;
  scope?: SemanticContextScope;
  regionId?: string;
  leafId?: string;
  cursor?: string;
  limit?: number;
}

interface ContextCursor {
  contextId: string;
  revision: number;
  scope: SemanticContextScope;
  regionId?: string;
  leafId?: string;
  offset: number;
  limit: number;
}

interface EventSource {
  on?(name: string, callback: (...args: unknown[]) => unknown): EventRef;
  offref?(ref: EventRef): void;
}

interface EditorPosition {
  line: number;
  ch: number;
}

interface EditorLike {
  getCursor(): EditorPosition;
  getCursor(side: "from" | "to"): EditorPosition;
  getSelection(): string;
  getValue(): string;
  lineCount(): number;
}

interface ViewLike {
  editor?: EditorLike;
  file?: TFile | null;
  getViewType?: () => string;
  getDisplayText?: () => string;
}

interface LeafLike {
  id?: string;
  view?: ViewLike;
  getViewState?: () => {
    type: string;
    state?: unknown;
    pinned?: boolean;
  };
}

interface WorkspaceLike {
  activeLeaf?: LeafLike | null;
  getMostRecentLeaf?: () => LeafLike | null;
  getActiveFile?: () => TFile | null;
  getLeavesOfType(type: string): LeafLike[];
  iterateAllLeaves?: (callback: (leaf: LeafLike) => void) => void;
  getLayout?: () => Record<string, unknown>;
}

export interface SemanticContextFocus {
  activeLeafId?: string;
  viewType: string;
  title?: string;
  path?: string;
}

export interface SemanticContextOpenNote {
  leafId?: string;
  path: string;
  basename: string;
  title: string;
  mtime: number;
  ctime: number;
  isActive: boolean;
}

export interface SemanticContextSnapshot {
  schemaVersion: 2;
  contextId: string;
  sequence: number;
  capturedAt: string;
  revisions: ObsidianContextRevisions;
  vault: ReturnType<typeof getVaultIdentity>;
  focus?: SemanticContextFocus;
  activeNote?: {
    path: string;
    basename: string;
    title: string;
    mtime: number;
    ctime: number;
    excerpt: string;
    fromLine: number;
    toLine: number;
  };
  cursor?: { line: number; ch: number };
  selection?: { text: string; from: number; to: number };
  headings?: Array<{ level: number; text: string; heading: string; line: number }>;
  openNotes: SemanticContextOpenNote[];
  workspace: {
    activeLeafId?: string;
    leaves: Array<{
      leafId?: string;
      viewType: string;
      title?: string;
      path?: string;
      url?: string;
      isActive: boolean;
      pinned: boolean;
    }>;
    openNotes: SemanticContextOpenNote[];
    layout?: Record<string, unknown>;
  };
  editor: {
    available: boolean;
    path?: string;
    cursor?: { line: number; ch: number };
    selection?: string;
    lineCount?: number;
    reason?: string;
  };
  capabilities: ObsidianCapabilityState;
  warnings: string[];
}

export interface SemanticContextDiagnostics {
  captures: number;
  emittedEvents: number;
  invalidations: number;
  coalescedInvalidations: number;
  lastCaptureMs: number;
  maxCaptureMs: number;
}

const DEFAULT_INCLUDE: ContextInclude[] = ["activeNote", "selection", "cursor", "headings", "openNotes"];
const EVENT_COALESCE_MS = 75;
const CURSOR_EVENT_COALESCE_MS = 200;
const DEFAULT_CONTEXT_PAGE_SIZE = 25;
const MAX_CONTEXT_PAGE_SIZE = 100;
const services = new WeakMap<App, ObsidianSemanticContextService>();

function isMarkdownView(view: ViewLike | undefined): view is ViewLike & { editor: EditorLike; file: TFile } {
  return view?.getViewType?.() === "markdown" && !!view.editor && !!view.file;
}

function leafId(leaf: LeafLike | null | undefined): string | undefined {
  return leaf?.id;
}

function activeLeaf(workspace: WorkspaceLike): LeafLike | undefined {
  return workspace.activeLeaf ?? workspace.getMostRecentLeaf?.() ?? undefined;
}

function allLeaves(workspace: WorkspaceLike): LeafLike[] {
  const leaves: LeafLike[] = [];
  workspace.iterateAllLeaves?.((leaf) => leaves.push(leaf));
  for (const leaf of workspace.getLeavesOfType("markdown")) {
    if (!leaves.includes(leaf)) leaves.push(leaf);
  }
  const active = activeLeaf(workspace);
  if (active && !leaves.includes(active)) leaves.push(active);
  return leaves;
}

function viewStateRecord(leaf: LeafLike): Record<string, unknown> {
  const state = leaf.getViewState?.().state;
  return state && typeof state === "object" && !Array.isArray(state)
    ? state as Record<string, unknown>
    : {};
}

function sanitizeLayoutNode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeLayoutNode);
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of ["id", "type", "direction", "currentTab", "collapsed"] as const) {
    if (
      typeof input[key] === "string"
      || typeof input[key] === "number"
      || (key === "collapsed" && typeof input[key] === "boolean")
    ) {
      output[key] = input[key];
    }
  }
  if (Array.isArray(input.children)) output.children = input.children.map(sanitizeLayoutNode);
  const state = input.state;
  if (state && typeof state === "object" && !Array.isArray(state)) {
    const stateRecord = state as Record<string, unknown>;
    if (typeof stateRecord.type === "string") output.viewType = stateRecord.type;
  }
  return output;
}

function sanitizeLayout(workspace: WorkspaceLike): Record<string, unknown> | undefined {
  const layout = workspace.getLayout?.();
  if (!layout) return undefined;
  const output: Record<string, unknown> = {};
  for (const key of ["main", "left", "right", "floating"] as const) {
    const node = sanitizeLayoutNode(layout[key]);
    if (node !== undefined) output[key] = node;
  }
  return output;
}

function clampExcerpt(text: string): string {
  return text.length > CONTEXT_EXCERPT_MAX_CHARS ? text.slice(0, CONTEXT_EXCERPT_MAX_CHARS) : text;
}

function encodeContextCursor(cursor: ContextCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeContextCursor(value: string): ContextCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    const cursor = parsed as Record<string, unknown>;
    if (
      typeof cursor.contextId !== "string"
      || typeof cursor.revision !== "number"
      || !["current", "active-view", "workspace", "region", "leaf"].includes(String(cursor.scope))
      || typeof cursor.offset !== "number"
      || typeof cursor.limit !== "number"
    ) {
      throw new Error("missing cursor fields");
    }
    return cursor as unknown as ContextCursor;
  } catch {
    throw new Error("INVALID_CURSOR: The Obsidian context cursor is invalid");
  }
}

function findLayoutNode(value: unknown, id: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.id === id) return record;
  const children = Array.isArray(record.children)
    ? record.children
    : Object.values(record);
  for (const child of children) {
    const match = findLayoutNode(child, id);
    if (match) return match;
  }
  return undefined;
}

function parseLiveHeadings(content: string): NonNullable<SemanticContextSnapshot["headings"]> {
  const lines = content.split(/\r?\n/u);
  const headings: NonNullable<SemanticContextSnapshot["headings"]> = [];
  let frontmatter = lines[0]?.trim() === "---";
  let fence: "`" | "~" | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (frontmatter) {
      if (index > 0 && line.trim() === "---") frontmatter = false;
      continue;
    }
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1]?.[0];
      if (marker === "`" || marker === "~") fence = fence === marker ? undefined : fence ?? marker;
      continue;
    }
    if (fence) continue;
    const atx = line.match(/^\s{0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/u);
    if (atx?.[1] && atx[2]) {
      headings.push({
        level: atx[1].length,
        text: atx[2],
        heading: atx[2],
        line: index + 1,
      });
      continue;
    }
    if (index === 0 || !line.match(/^\s{0,3}(=+|-+)\s*$/u)) continue;
    const previous = lines[index - 1]?.trim();
    if (!previous || previous.startsWith("#")) continue;
    const level = line.includes("=") ? 1 : 2;
    headings.push({
      level,
      text: previous,
      heading: previous,
      line: index,
    });
  }
  return headings;
}

/**
 * One connector-owned authority for volatile Obsidian state. Prompt context and
 * bridge projections are derived from the same snapshot instead of independently
 * guessing which leaf, editor buffer, or plugin inventory is current.
 */
export class ObsidianSemanticContextService {
  private readonly contextId = crypto.randomUUID();
  private readonly listeners = new Set<(event: ObsidianBridgeContextChanged) => void>();
  private readonly eventRefs: Array<{ source: EventSource; ref: EventRef }> = [];
  private readonly domDisposers: Array<() => void> = [];
  private readonly pendingDomains = new Set<ObsidianContextChangedDomain>();
  private readonly revisions: ObsidianContextRevisions = {
    workspace: 1,
    editor: 1,
    page: 1,
    capabilities: 1,
  };
  private sequence = 1;
  private flushTimer: number | null = null;
  private started = false;
  private currentSnapshot: SemanticContextSnapshot | undefined;
  private readonly diagnosticState: SemanticContextDiagnostics = {
    captures: 0,
    emittedEvents: 0,
    invalidations: 0,
    coalescedInvalidations: 0,
    lastCaptureMs: 0,
    maxCaptureMs: 0,
  };

  constructor(
    private readonly app: App,
    private readonly now: () => Date = () => new Date(),
    private readonly monotonicNow: () => number = () => window.performance?.now() ?? Date.now(),
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    const workspace = this.app.workspace as unknown as EventSource;
    const vault = this.app.vault as unknown as EventSource;
    this.listen(workspace, "active-leaf-change", ["focus", "workspace", "editor", "page"]);
    this.listen(workspace, "file-open", ["focus", "workspace", "editor", "page"]);
    this.listen(workspace, "layout-change", ["focus", "workspace", "page", "capabilities"]);
    this.listen(workspace, "window-open", ["focus", "workspace", "page"]);
    this.listen(workspace, "window-close", ["focus", "workspace", "page"]);
    this.listen(workspace, "editor-change", ["editor", "page"]);
    this.listen(vault, "modify", ["editor", "page"]);
    this.listen(vault, "create", ["workspace", "page"]);
    this.listen(vault, "delete", ["workspace", "editor", "page"]);
    this.listen(vault, "rename", ["workspace", "editor", "page"]);
    const document = window.document;
    const handleSelectionChange = (): void => {
      const active = document.activeElement;
      if (!active?.closest(".markdown-source-view, .cm-editor")) return;
      this.invalidate(["editor", "page"], CURSOR_EVENT_COALESCE_MS);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    this.domDisposers.push(() => document.removeEventListener("selectionchange", handleSelectionChange));
  }

  dispose(): void {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    for (const { source, ref } of this.eventRefs) source.offref?.(ref);
    this.eventRefs.length = 0;
    for (const dispose of this.domDisposers) dispose();
    this.domDisposers.length = 0;
    this.pendingDomains.clear();
    this.listeners.clear();
    this.started = false;
  }

  onChange(listener: (event: ObsidianBridgeContextChanged) => void): () => void {
    this.start();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  invalidate(
    domains: readonly ObsidianContextChangedDomain[],
    coalesceMs = EVENT_COALESCE_MS,
  ): void {
    this.diagnosticState.invalidations += 1;
    for (const domain of domains) this.pendingDomains.add(domain);
    if (this.flushTimer !== null) {
      this.diagnosticState.coalescedInvalidations += 1;
      return;
    }
    this.flushTimer = window.setTimeout(() => this.flushPending(), coalesceMs);
  }

  snapshot(): SemanticContextSnapshot {
    this.start();
    const revised = this.flushPending();
    if (revised) return revised;
    this.currentSnapshot ??= this.capture();
    return this.currentSnapshot;
  }

  diagnostics(): SemanticContextDiagnostics {
    return { ...this.diagnosticState };
  }

  contextProjection(input: SemanticContextProjectionInput = {}): Record<string, unknown> {
    const snapshot = this.snapshot();
    const scope = input.scope ?? "current";
    const include = new Set(input.include ?? DEFAULT_INCLUDE);
    const maxOpenNotes = Math.max(1, Math.min(100, input.maxOpenNotes ?? CONTEXT_MAX_OPEN_NOTES));
    const requestedLimit = Math.max(1, Math.min(MAX_CONTEXT_PAGE_SIZE, input.limit ?? DEFAULT_CONTEXT_PAGE_SIZE));
    const cursor = input.cursor ? decodeContextCursor(input.cursor) : undefined;
    const revision = scope === "active-view" || scope === "leaf"
      ? snapshot.revisions.page
      : snapshot.revisions.workspace;
    if (cursor) {
      if (
        cursor.contextId !== snapshot.contextId
        || cursor.revision !== revision
        || cursor.scope !== scope
        || cursor.regionId !== input.regionId
        || cursor.leafId !== input.leafId
      ) {
        throw new Error("REVISION_CONFLICT: The Obsidian context changed; request a fresh snapshot");
      }
      if (input.limit !== undefined && input.limit !== cursor.limit) {
        throw new Error("INVALID_CURSOR: Continue with the page size bound to the cursor");
      }
    }
    const limit = cursor?.limit ?? requestedLimit;
    const offset = cursor?.offset ?? 0;
    const base = {
      schemaVersion: snapshot.schemaVersion,
      contextId: snapshot.contextId,
      sequence: snapshot.sequence,
      capturedAt: snapshot.capturedAt,
      revisions: snapshot.revisions,
      scope,
      vault: snapshot.vault,
      capabilities: ["context", "notes", "search"],
      warnings: snapshot.warnings,
    };
    if (scope === "workspace") {
      const leaves = snapshot.workspace.leaves.slice(offset, offset + limit);
      const nextOffset = offset + leaves.length;
      return {
        ...base,
        workspace: {
          activeLeafId: snapshot.workspace.activeLeafId,
          layout: snapshot.workspace.layout,
          leaves,
        },
        coverage: {
          kind: "exact",
          returned: leaves.length,
          total: snapshot.workspace.leaves.length,
          hasMore: nextOffset < snapshot.workspace.leaves.length,
          ...(nextOffset < snapshot.workspace.leaves.length ? {
            nextCursor: encodeContextCursor({
              contextId: snapshot.contextId,
              revision,
              scope,
              offset: nextOffset,
              limit,
            }),
          } : {}),
        },
      };
    }
    if (scope === "region") {
      if (!input.regionId) throw new Error("INVALID_INPUT: regionId is required for region scope");
      const region = findLayoutNode(snapshot.workspace.layout, input.regionId);
      if (!region) throw new Error(`NOT_FOUND: Workspace region not found: ${input.regionId}`);
      return {
        ...base,
        region,
        coverage: { kind: "exact", returned: 1, total: 1, hasMore: false },
      };
    }
    if (scope === "leaf") {
      if (!input.leafId) throw new Error("INVALID_INPUT: leafId is required for leaf scope");
      const leaf = snapshot.workspace.leaves.find((candidate) => candidate.leafId === input.leafId);
      if (!leaf) throw new Error(`NOT_FOUND: Workspace leaf not found: ${input.leafId}`);
      return {
        ...base,
        leaf,
        ...(leaf.isActive ? {
          activeView: snapshot.focus,
          editor: snapshot.editor,
          ...(snapshot.activeNote ? { activeNote: snapshot.activeNote } : {}),
        } : {}),
        coverage: { kind: "exact", returned: 1, total: 1, hasMore: false },
      };
    }
    if (scope === "active-view") {
      return {
        ...base,
        activeView: snapshot.focus,
        editor: snapshot.editor,
        ...(snapshot.activeNote ? { activeNote: snapshot.activeNote } : {}),
        ...(snapshot.cursor ? { cursor: snapshot.cursor } : {}),
        ...(snapshot.selection ? { selection: snapshot.selection } : {}),
        ...(snapshot.headings ? { headings: snapshot.headings } : {}),
        coverage: {
          kind: "exact",
          returned: snapshot.focus ? 1 : 0,
          total: snapshot.focus ? 1 : 0,
          hasMore: false,
        },
      };
    }
    return {
      ...base,
      focus: snapshot.focus,
      activeView: snapshot.focus,
      workspace: {
        activeLeafId: snapshot.workspace.activeLeafId,
        leafCount: snapshot.workspace.leaves.length,
        openNoteCount: snapshot.workspace.openNotes.length,
      },
      ...(include.has("activeNote") && snapshot.activeNote ? { activeNote: snapshot.activeNote } : {}),
      ...(include.has("cursor") && snapshot.cursor ? { cursor: snapshot.cursor } : {}),
      ...(include.has("selection") && snapshot.selection ? { selection: snapshot.selection } : {}),
      ...(include.has("headings") && snapshot.headings ? { headings: snapshot.headings } : {}),
      ...(include.has("openNotes") ? { openNotes: snapshot.openNotes.slice(0, maxOpenNotes) } : {}),
      coverage: {
        openNotes: {
          returned: include.has("openNotes") ? Math.min(snapshot.openNotes.length, maxOpenNotes) : 0,
          total: snapshot.openNotes.length,
          truncated: include.has("openNotes") && snapshot.openNotes.length > maxOpenNotes,
        },
      },
    };
  }

  workspaceProjection(): SemanticContextSnapshot["workspace"] & {
    schemaVersion: 2;
    contextId: string;
    sequence: number;
    capturedAt: string;
    revision: number;
  } {
    const snapshot = this.snapshot();
    return {
      schemaVersion: 2,
      contextId: snapshot.contextId,
      sequence: snapshot.sequence,
      capturedAt: snapshot.capturedAt,
      revision: snapshot.revisions.workspace,
      ...snapshot.workspace,
    };
  }

  editorProjection(path?: string): SemanticContextSnapshot["editor"] & {
    schemaVersion: 2;
    contextId: string;
    sequence: number;
    capturedAt: string;
    revision: number;
  } {
    const snapshot = path ? this.captureForPath(path) : this.snapshot();
    return {
      schemaVersion: 2,
      contextId: snapshot.contextId,
      sequence: snapshot.sequence,
      capturedAt: snapshot.capturedAt,
      revision: snapshot.revisions.editor,
      ...snapshot.editor,
    };
  }

  private listen(
    source: EventSource,
    name: string,
    domains: readonly ObsidianContextChangedDomain[],
  ): void {
    const ref = source.on?.(name, () => this.invalidate(domains));
    if (!ref) return;
    this.eventRefs.push({ source, ref });
  }

  private flushPending(): SemanticContextSnapshot | undefined {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pendingDomains.size === 0) return undefined;
    const changed = [...this.pendingDomains];
    this.pendingDomains.clear();
    const revised = new Set<keyof ObsidianContextRevisions>();
    for (const domain of changed) {
      if (domain === "focus") revised.add("workspace").add("editor").add("page");
      else revised.add(domain);
    }
    for (const domain of revised) this.revisions[domain] += 1;
    this.sequence += 1;
    const snapshot = this.capture();
    this.currentSnapshot = snapshot;
    this.diagnosticState.emittedEvents += 1;
    const event: ObsidianBridgeContextChanged = {
      type: "context_changed",
      sequence: this.sequence,
      capturedAt: snapshot.capturedAt,
      changed,
      revisions: { ...this.revisions },
      ...(snapshot.focus ? {
        summary: {
          ...(snapshot.focus.activeLeafId ? { activeLeafId: snapshot.focus.activeLeafId } : {}),
          viewType: snapshot.focus.viewType,
          ...(snapshot.focus.path ? { path: snapshot.focus.path } : {}),
        },
      } : {}),
    };
    for (const listener of this.listeners) listener(event);
    return snapshot;
  }

  private captureForPath(path: string): SemanticContextSnapshot {
    const snapshot = this.flushPending() ?? this.capture();
    if (snapshot.editor.path === path) return snapshot;
    const workspace = this.app.workspace as unknown as WorkspaceLike;
    const leaf = workspace.getLeavesOfType("markdown")
      .find((candidate) => isMarkdownView(candidate.view) && candidate.view.file.path === path);
    if (!leaf || !isMarkdownView(leaf.view)) {
      return {
        ...snapshot,
        editor: { available: false, reason: `No open markdown editor for ${path}` },
      };
    }
    const editor = leaf.view.editor;
    const cursor = editor.getCursor();
    return {
      ...snapshot,
      editor: {
        available: true,
        path,
        cursor: { line: cursor.line + 1, ch: cursor.ch },
        selection: editor.getSelection() || undefined,
        lineCount: editor.lineCount(),
      },
    };
  }

  private capture(): SemanticContextSnapshot {
    const captureStartedAt = this.monotonicNow();
    const workspace = this.app.workspace as unknown as WorkspaceLike;
    const layout = sanitizeLayout(workspace);
    const currentLeaf = activeLeaf(workspace);
    const leaves = allLeaves(workspace);
    const currentView = currentLeaf?.view;
    const currentState = currentLeaf ? viewStateRecord(currentLeaf) : {};
    const viewType = currentView?.getViewType?.() ?? currentLeaf?.getViewState?.().type ?? "unknown";
    const path = typeof currentState.file === "string"
      ? currentState.file
      : currentView?.file?.path ?? workspace.getActiveFile?.()?.path;
    const title = currentView?.getDisplayText?.();
    const focus = currentLeaf || path ? {
      ...(leafId(currentLeaf) ? { activeLeafId: leafId(currentLeaf) } : {}),
      viewType,
      ...(title ? { title } : {}),
      ...(path ? { path } : {}),
    } : undefined;

    const leafSummaries: SemanticContextSnapshot["workspace"]["leaves"] = [];
    const openNotes: SemanticContextOpenNote[] = [];
    for (const leaf of leaves) {
      const state = viewStateRecord(leaf);
      const view = leaf.view;
      const type = view?.getViewType?.() ?? leaf.getViewState?.().type ?? "unknown";
      const summary = {
        ...(leafId(leaf) ? { leafId: leafId(leaf) } : {}),
        viewType: type,
        ...(view?.getDisplayText?.() ? { title: view.getDisplayText?.() } : {}),
        ...(typeof state.file === "string" ? { path: state.file } : {}),
        ...(typeof state.url === "string" ? { url: state.url } : {}),
        isActive: leaf === currentLeaf,
        pinned: leaf.getViewState?.().pinned === true,
      };
      leafSummaries.push(summary);
      if (isMarkdownView(view)) {
        openNotes.push({
          ...(leafId(leaf) ? { leafId: leafId(leaf) } : {}),
          path: view.file.path,
          basename: view.file.basename,
          title: view.file.basename,
          mtime: view.file.stat.mtime,
          ctime: view.file.stat.ctime,
          isActive: leaf === currentLeaf,
        });
      }
    }

    let activeNote: SemanticContextSnapshot["activeNote"];
    let cursor: SemanticContextSnapshot["cursor"];
    let selection: SemanticContextSnapshot["selection"];
    let headings: SemanticContextSnapshot["headings"];
    let editorSnapshot: SemanticContextSnapshot["editor"] = {
      available: false,
      reason: currentLeaf ? "The active view is not a markdown editor" : "No active workspace leaf",
    };
    const warnings: string[] = [];
    if (isMarkdownView(currentView)) {
      const editor = currentView.editor;
      const file = currentView.file;
      const content = editor.getValue();
      const currentCursor = editor.getCursor();
      const selectedText = editor.getSelection();
      const from = selectedText ? editor.getCursor("from") : currentCursor;
      const to = selectedText ? editor.getCursor("to") : currentCursor;
      const excerpt = buildNoteContextExcerpt(
        content,
        currentCursor.line,
        to.line,
        CONTEXT_EXCERPT_BEFORE,
        CONTEXT_EXCERPT_AFTER,
      );
      activeNote = {
        path: file.path,
        basename: file.basename,
        title: file.basename,
        mtime: file.stat.mtime,
        ctime: file.stat.ctime,
        excerpt: clampExcerpt(excerpt.text),
        fromLine: excerpt.fromLine + 1,
        toLine: excerpt.toLine + 1,
      };
      cursor = { line: currentCursor.line + 1, ch: currentCursor.ch };
      selection = selectedText ? { text: selectedText, from: from.line + 1, to: to.line + 1 } : undefined;
      headings = parseLiveHeadings(content);
      editorSnapshot = {
        available: true,
        path: file.path,
        cursor,
        selection: selectedText || undefined,
        lineCount: editor.lineCount(),
      };
    } else {
      warnings.push("NO_ACTIVE_NOTE: The active view is not a markdown note");
    }

    const snapshot: SemanticContextSnapshot = {
      schemaVersion: 2,
      contextId: this.contextId,
      sequence: this.sequence,
      capturedAt: this.now().toISOString(),
      revisions: { ...this.revisions },
      vault: getVaultIdentity(this.app),
      focus,
      activeNote,
      cursor,
      selection,
      headings,
      openNotes,
      workspace: {
        ...(leafId(currentLeaf) ? { activeLeafId: leafId(currentLeaf) } : {}),
        leaves: leafSummaries,
        openNotes,
        ...(layout ? { layout } : {}),
      },
      editor: editorSnapshot,
      capabilities: collectObsidianCapabilityState(this.app),
      warnings,
    };
    const duration = Math.max(0, this.monotonicNow() - captureStartedAt);
    this.diagnosticState.captures += 1;
    this.diagnosticState.lastCaptureMs = duration;
    this.diagnosticState.maxCaptureMs = Math.max(this.diagnosticState.maxCaptureMs, duration);
    return snapshot;
  }
}

export function getObsidianSemanticContextService(app: App): ObsidianSemanticContextService {
  const existing = services.get(app);
  if (existing) return existing;
  const service = new ObsidianSemanticContextService(app);
  services.set(app, service);
  service.start();
  return service;
}

export function disposeObsidianSemanticContextService(app: App): void {
  const service = services.get(app);
  if (!service) return;
  services.delete(app);
  service.dispose();
}
