import type { App, TFile } from "obsidian";
import { collectObsidianCapabilityState } from "../../obsidian-bridge/dependency-snapshot";
import { buildNoteContextExcerpt } from "../../obsidian-bridge/operations/helpers/note-io";
import { getVaultIdentity } from "../../obsidian-bridge/operations/helpers/vault-identity";
import { CONTEXT_EXCERPT_AFTER, CONTEXT_EXCERPT_BEFORE, CONTEXT_EXCERPT_MAX_CHARS } from "../../prompt/constants";
import type { SemanticContextSnapshot, SemanticContextOpenNote } from "./types";

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
  getLeavesOfType(type: string): LeafLike[];
  iterateAllLeaves?: (callback: (leaf: LeafLike) => void) => void;
  getLayout?: () => Record<string, unknown>;
}

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
  workspace.iterateAllLeaves?.((leaf) => { leaves.push(leaf); });
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

/** Read the live editor and workspace once; the service owns revision and cache lifetime. */
export function captureSemanticSnapshot(
  app: App,
  state: Pick<SemanticContextSnapshot, "contextId" | "sequence" | "revisions">,
  now: () => Date,
): SemanticContextSnapshot {
  const workspace = app.workspace as unknown as WorkspaceLike;
  const layout = sanitizeLayout(workspace);
  const currentLeaf = activeLeaf(workspace);
  const leaves = allLeaves(workspace);
  const currentView = currentLeaf?.view;
  const currentState = currentLeaf ? viewStateRecord(currentLeaf) : {};
  const viewType = currentView?.getViewType?.() ?? currentLeaf?.getViewState?.().type ?? "unknown";
  const path = typeof currentState.file === "string"
    ? currentState.file
    : currentView?.file?.path;
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
    contextId: state.contextId,
    sequence: state.sequence,
    capturedAt: now().toISOString(),
    revisions: { ...state.revisions },
    vault: getVaultIdentity(app),
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
    capabilities: collectObsidianCapabilityState(app),
    warnings,
  };
  return snapshot;
}

/** Explicit editor inspection may target another open note without rebinding the active snapshot. */
export function captureEditorForPath(app: App, snapshot: SemanticContextSnapshot, path: string): SemanticContextSnapshot {
  if (snapshot.editor.path === path) return snapshot;
  const workspace = app.workspace as unknown as WorkspaceLike;
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
