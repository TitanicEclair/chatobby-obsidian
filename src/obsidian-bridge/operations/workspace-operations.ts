// Plugin-native runtime operations for live editors and workspace layout. These
// touch live Obsidian surfaces that have no useful behavior
// in a headless test, so each handler degrades gracefully (returns an "unavailable"
// result) when the surface is absent, and is otherwise correct in production.

import { createHash } from "node:crypto";
import type { TFile, App } from "obsidian";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { isTFile } from "./helpers/file-types";
import { getObsidianSemanticContextService } from "../../obsidian-context";


// ── Local surface types (kept minimal; cast via unknown to avoid `any`) ──

interface EditorLike {
  getCursor(): { line: number; ch: number };
  getCursor(side: "from" | "to"): { line: number; ch: number };
  getSelection(): string;
  getValue(): string;
  lineCount(): number;
  setCursor(pos: { line: number; ch: number }): void;
  listSelections(): Array<{ anchor: { line: number; ch: number }; head: { line: number; ch: number } }>;
  hasFocus(): boolean;
  focus(): void;
  getScrollInfo(): { top: number; left: number };
  offsetToPos(offset: number): { line: number; ch: number };
  posToOffset(position: { line: number; ch: number }): number;
  transaction(transaction: {
    changes?: Array<{ from: { line: number; ch: number }; to?: { line: number; ch: number }; text: string }>;
    selections?: Array<{ from: { line: number; ch: number }; to?: { line: number; ch: number } }>;
  }, origin?: string): void;
  scrollIntoView(range: { from: { line: number; ch: number }; to: { line: number; ch: number } }, center?: boolean): void;
  undo(): void;
  redo(): void;
}

interface MarkdownViewLike {
  editor: EditorLike;
  file: TFile;
  getViewType(): string;
}

interface LeafLike {
	id?: string;
  view?: unknown;
  openFile?(file: TFile): Promise<void> | void;
	getViewState?(): { type: string; state?: unknown; pinned?: boolean };
	setViewState?(state: { type: string; state?: unknown; pinned?: boolean; active?: boolean }): Promise<void> | void;
  setPinned?(pinned: boolean): void;
  detach?(): void;
}

interface WorkspaceLike {
  getLeavesOfType(type: string): LeafLike[];
  getLeafById?(id: string): LeafLike | null;
  activeLeaf?: LeafLike | null;
  getLeaf?(...args: unknown[]): LeafLike;
  setActiveLeaf?(leaf: LeafLike, opts?: { focus?: boolean }): void;
	iterateAllLeaves?(callback: (leaf: LeafLike) => void): void;
	createLeafBySplit?(leaf: LeafLike, direction?: "vertical" | "horizontal", before?: boolean): LeafLike;
	duplicateLeaf?(leaf: LeafLike, direction?: "vertical" | "horizontal"): Promise<LeafLike>;
}

function getWorkspace(app: App): WorkspaceLike {
  return app.workspace;
}

function isMarkdownView(view: unknown): view is MarkdownViewLike {
  return !!view && typeof view === "object" && "editor" in view && "file" in view;
}

function leafId(leaf: LeafLike): string {
	return leaf.id ?? (leaf as unknown as { id?: string }).id ?? "";
}

function allLeaves(workspace: WorkspaceLike): LeafLike[] {
	const leaves: LeafLike[] = [];
	workspace.iterateAllLeaves?.((leaf) => leaves.push(leaf));
	for (const leaf of workspace.getLeavesOfType("markdown") ?? []) {
		if (!leaves.includes(leaf)) leaves.push(leaf);
	}
	if (workspace.activeLeaf && !leaves.includes(workspace.activeLeaf)) leaves.push(workspace.activeLeaf);
	return leaves;
}

function findLeafById(workspace: WorkspaceLike, id: string | undefined): LeafLike | undefined {
	if (!id) return undefined;
	return workspace.getLeafById?.(id) ?? allLeaves(workspace).find((leaf) => leafId(leaf) === id);
}

/** Find an active markdown view, preferring the workspace's active leaf. */
interface EditorTarget {
  leaf: LeafLike;
  view: MarkdownViewLike;
}

function getActiveMarkdownView(app: App, target?: { path?: string; leafId?: string }): EditorTarget | null {
  const ws = getWorkspace(app);
  const leaves = ws.getLeavesOfType("markdown") ?? [];
  const candidates = leaves.filter((leaf): leaf is LeafLike & { view: MarkdownViewLike } => isMarkdownView(leaf.view));
  if (target?.leafId) {
    const leaf = findLeafById(ws, target.leafId);
    if (!leaf || !isMarkdownView(leaf.view) || (target.path && leaf.view.file.path !== target.path)) return null;
    return { leaf, view: leaf.view };
  }
  if (target?.path) {
    const matches = candidates.filter((leaf) => leaf.view.file.path === target.path);
    const active = matches.find((leaf) => leaf === ws.activeLeaf);
    if (active) return { leaf: active, view: active.view };
    if (matches.length > 1) throw new BridgeError("PATH_AMBIGUOUS", `More than one live editor is open for ${target.path}; provide leafId.`);
    const leaf = matches[0];
    return leaf ? { leaf, view: leaf.view } : null;
  }
  const active = ws.activeLeaf;
  if (active && isMarkdownView(active.view)) return { leaf: active, view: active.view };
  const first = candidates[0];
  return first ? { leaf: first, view: first.view } : null;
}

// ── editor.get ────────────────────────────────────────────────────────

export const handleEditorGet: OperationHandler = async (args, _signal, app) => {
  const target = editorTarget(args.target);
  const selected = getActiveMarkdownView(app, target);
  if (!selected) throw new BridgeError("EDITOR_NOT_OPEN", "No matching live markdown editor is open.");
  const { leaf, view } = selected;
  const editor = view.editor;
  const content = editor.getValue();
  const contentHash = hashText(content);
  const result: Record<string, unknown> = {
    schemaVersion: 1,
    path: view.file.path,
    leafId: leafId(leaf),
    contentHash,
    editorRevision: contentHash,
    focused: editor.hasFocus(),
    cursor: editor.getCursor(),
    selections: editor.listSelections().map((selection) => ({ from: selection.anchor, to: selection.head })),
    scroll: editor.getScrollInfo(),
    lineCount: editor.lineCount(),
    coordinateSystem: "zero-based-line-and-column",
  };
  if (args.includeContent === true) {
    const fromLine = numberArgument(args.fromLine, 0);
    const requestedTo = numberArgument(args.toLine, Math.max(0, editor.lineCount() - 1));
    const maxChars = Math.min(48_000, Math.max(1, numberArgument(args.maxChars, 24_000)));
    const lines = content.split(/\r?\n/u);
    const toLine = Math.min(requestedTo, Math.max(0, lines.length - 1));
    const returned: string[] = [];
    let returnedChars = 0;
    let nextFromLine: number | undefined;
    for (let line = Math.max(0, fromLine); line <= toLine; line += 1) {
      const value = lines[line] ?? "";
      const added = value.length + (returned.length > 0 ? 1 : 0);
      if (returned.length > 0 && returnedChars + added > maxChars) {
        nextFromLine = line;
        break;
      }
      returned.push(value);
      returnedChars += added;
    }
    result.content = returned.join("\n");
    result.fromLine = Math.max(0, fromLine);
    result.toLine = Math.max(0, fromLine) + Math.max(0, returned.length - 1);
    result.coverage = {
      kind: nextFromLine === undefined ? "exact" : "partial",
      returned: returned.length,
      total: Math.max(0, toLine - Math.max(0, fromLine) + 1),
      hasMore: nextFromLine !== undefined,
      ...(nextFromLine !== undefined ? { nextFromLine } : {}),
    };
  }
  return result;
};

// ── editor.edit ───────────────────────────────────────────────────────

export const handleEditorEdit: OperationHandler = async (args, _signal, app) => {
  const target = editorTarget(args.target);
  const selected = getActiveMarkdownView(app, target);
  if (!selected) throw new BridgeError("EDITOR_NOT_OPEN", "No matching live markdown editor is open; no durable file was changed.");
  const { leaf, view } = selected;
  const editor = view.editor;
  const current = editor.getValue();
  const expectedContentHash = typeof args.expectedContentHash === "string" ? args.expectedContentHash : undefined;
  if (!expectedContentHash || expectedContentHash !== hashText(current)) {
    throw new BridgeError("EDITOR_TRANSFORM_STALE", "The live editor changed after it was inspected; no mutation was applied.");
  }
  const changes = editorChanges(args.changes, editor, current.length);
  const selections = editorSelections(args.selections);
  editor.transaction({ changes, ...(selections ? { selections } : {}) }, "chatobby");
  const reveal = asRecord(args.reveal);
  const revealFrom = asEditorPosition(reveal.from);
  if (revealFrom) editor.scrollIntoView({ from: revealFrom, to: asEditorPosition(reveal.to) ?? revealFrom }, reveal.center === true);
  const updated = editor.getValue();
  return {
    schemaVersion: 1,
    appliedTo: "live-editor",
    path: view.file.path,
    leafId: leafId(leaf),
    changed: updated !== current,
    changeCount: changes.length,
    beforeContentHash: expectedContentHash,
    contentHash: hashText(updated),
    coordinateSystem: "zero-based-line-and-column",
  };
};

// ── editor.focus ──────────────────────────────────────────────────────

export const handleEditorFocus: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  if (!path) throw new BridgeError("INVALID_INPUT", "editor.focus requires 'path'");
  const file = app.vault.getAbstractFileByPath(path);
  if (!isTFile(file)) throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);

  const ws = getWorkspace(app);
  const requestedLeafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const leaf = findLeafById(ws, requestedLeafId) ?? (ws.getLeaf ? ws.getLeaf(false) : ws.getLeavesOfType("markdown")[0]);
  if (requestedLeafId && !findLeafById(ws, requestedLeafId)) throw new BridgeError("EDITOR_NOT_OPEN", `Workspace leaf not found: ${requestedLeafId}`);
  if (!leaf) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "No workspace leaf available");
  if (leaf.openFile) await leaf.openFile(file);
  if (ws.setActiveLeaf) ws.setActiveLeaf(leaf, { focus: true });

  const line = typeof args.line === "number" ? args.line : undefined;
  const ch = typeof args.ch === "number" ? args.ch : 0;
  if (line !== undefined) {
    const view = isMarkdownView((leaf as { view?: unknown }).view) ? (leaf.view as MarkdownViewLike) : null;
    if (view) {
      view.editor.setCursor({ line, ch });
      view.editor.focus();
      view.editor.scrollIntoView({ from: { line, ch }, to: { line, ch } }, true);
    }
  }

  return { focused: true, path, leafId: leafId(leaf), ...(line !== undefined ? { line, ch } : {}) };
};

export const handleEditorHistory: OperationHandler = async (args, _signal, app) => {
  const action = args.action === "undo" || args.action === "redo" ? args.action : undefined;
  if (!action) throw new BridgeError("INVALID_INPUT", "editor.history requires action=undo or action=redo.");
  const selected = getActiveMarkdownView(app, editorTarget(args.target));
  if (!selected) throw new BridgeError("EDITOR_NOT_OPEN", "No matching live markdown editor is open.");
  selected.view.editor[action]();
  const contentHash = hashText(selected.view.editor.getValue());
  return { schemaVersion: 1, action, acknowledged: true, path: selected.view.file.path, leafId: leafId(selected.leaf), contentHash };
};

function editorTarget(value: unknown): { path?: string; leafId?: string } | undefined {
  const record = asRecord(value);
  const path = typeof record.path === "string" ? record.path : undefined;
  const requestedLeafId = typeof record.leafId === "string" ? record.leafId : undefined;
  return path || requestedLeafId ? { ...(path ? { path } : {}), ...(requestedLeafId ? { leafId: requestedLeafId } : {}) } : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asEditorPosition(value: unknown): { line: number; ch: number } | null {
  const record = asRecord(value);
  return Number.isInteger(record.line) && Number.isInteger(record.ch) && Number(record.line) >= 0 && Number(record.ch) >= 0
    ? { line: Number(record.line), ch: Number(record.ch) }
    : null;
}

function numberArgument(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function editorChanges(value: unknown, editor: EditorLike, contentLength: number): Array<{ from: { line: number; ch: number }; to?: { line: number; ch: number }; text: string }> {
  if (!Array.isArray(value) || value.length === 0) throw new BridgeError("INVALID_INPUT", "editor.edit requires one or more changes.");
  const normalized = value.map((item) => {
    const record = asRecord(item);
    if (typeof record.text !== "string") throw new BridgeError("INVALID_INPUT", "Every editor change requires text.");
    const from = typeof record.from === "number" ? editor.offsetToPos(record.from) : asEditorPosition(record.from);
    const to = record.to === undefined ? from : typeof record.to === "number" ? editor.offsetToPos(record.to) : asEditorPosition(record.to);
    if (!from || !to) throw new BridgeError("INVALID_INPUT", "Editor change positions must be non-negative offsets or zero-based line/ch positions.");
    const fromOffset = editor.posToOffset(from);
    const toOffset = editor.posToOffset(to);
    if (fromOffset < 0 || toOffset < fromOffset || toOffset > contentLength) throw new BridgeError("INVALID_INPUT", "Editor change range is outside the live buffer.");
    return { from, to, text: record.text, fromOffset, toOffset };
  }).sort((left, right) => left.fromOffset - right.fromOffset);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index]!.fromOffset < normalized[index - 1]!.toOffset) throw new BridgeError("INVALID_INPUT", "Editor changes must not overlap.");
  }
  return normalized.map(({ from, to, text }) => ({ from, to, text }));
}

function editorSelections(value: unknown): Array<{ from: { line: number; ch: number }; to?: { line: number; ch: number } }> | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BridgeError("INVALID_INPUT", "selections must be an array.");
  return value.map((item) => {
    const record = asRecord(item);
    const from = asEditorPosition(record.from);
    const to = record.to === undefined ? undefined : asEditorPosition(record.to);
    if (!from || (record.to !== undefined && !to)) throw new BridgeError("INVALID_INPUT", "Selection positions must use zero-based line/ch.");
    return { from, ...(to ? { to } : {}) };
  });
}

// ── workspace.get ─────────────────────────────────────────────────────

export const handleWorkspaceGet: OperationHandler = async (_args, _signal, app) => {
  return getObsidianSemanticContextService(app).workspaceProjection();
};

// ── workspace.manage ──────────────────────────────────────────────────

export const handleWorkspaceManage: OperationHandler = async (args, _signal, app) => {
  const action = typeof args.action === "string" ? args.action : undefined;
  const path = typeof args.path === "string" ? args.path : undefined;
  const requestedLeafId = typeof args.leafId === "string" ? args.leafId : undefined;
  if (!action) throw new BridgeError("INVALID_INPUT", "workspace.manage requires 'action'");
  const ws = getWorkspace(app);
	const exactLeaf = findLeafById(ws, requestedLeafId);
	if (requestedLeafId && !exactLeaf) {
		throw new BridgeError("INVALID_INPUT", `Workspace leaf not found: ${requestedLeafId}`);
	}

  switch (action) {
    case "split": {
      const active = exactLeaf ?? ws.activeLeaf ?? ws.getLeavesOfType("markdown")[0];
      if (!active) return { action, applied: false, reason: "No available leaf" };
      const direction = typeof args.direction === "string" ? args.direction : "right";
      const splitDirection = direction === "up" || direction === "down" ? "horizontal" : "vertical";
      const before = direction === "left" || direction === "up";
      const leaf = ws.createLeafBySplit?.(active, splitDirection, before)
        ?? ws.getLeaf?.("split", splitDirection)
        ?? active;
      if (!leaf) return { action, applied: false, reason: "No available leaf" };
      if (ws.setActiveLeaf) ws.setActiveLeaf(leaf, { focus: true });
      return { action, applied: true, direction, leafId: leafId(leaf), sourceLeafId: leafId(active) };
    }
    case "duplicate": {
      const active = exactLeaf ?? ws.activeLeaf ?? ws.getLeavesOfType("markdown")[0];
      if (!active) return { action, applied: false, reason: "No available leaf" };
      const direction = typeof args.direction === "string" ? args.direction : "right";
      const splitDirection = direction === "up" || direction === "down" ? "horizontal" : "vertical";
      let leaf = await ws.duplicateLeaf?.(active, splitDirection);
      if (!leaf) {
        const before = direction === "left" || direction === "up";
        leaf = ws.createLeafBySplit?.(active, splitDirection, before) ?? ws.getLeaf?.("split", splitDirection) ?? active;
        const state = active.getViewState?.();
        if (state && leaf !== active) await leaf.setViewState?.({ ...state, active: true });
      }
      ws.setActiveLeaf?.(leaf, { focus: true });
      return { action, applied: true, direction, leafId: leafId(leaf), sourceLeafId: leafId(active) };
    }
    case "open": {
      if (!path) throw new BridgeError("INVALID_INPUT", "workspace.manage 'open' requires 'path'");
      const file = app.vault.getAbstractFileByPath(path);
      if (!isTFile(file)) throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);
      const leaf = ws.getLeaf ? ws.getLeaf("tab") : ws.getLeavesOfType("markdown")[0];
      if (!leaf?.openFile) return { action, path, applied: false, reason: "No available leaf" };
      await leaf.openFile(file);
      return { action, path, applied: true };
    }
    case "close":
    case "close-others": {
      const target = exactLeaf ?? (path
        ? ws.getLeavesOfType("markdown").find((l) => isMarkdownView(l.view) && (l.view).file.path === path)
        : ws.activeLeaf ?? undefined);
      if (!target) return { action, path, applied: false, reason: "No matching leaf" };
      if (action === "close-others") {
        for (const leaf of ws.getLeavesOfType("markdown")) {
          if (leaf !== target) leaf.detach?.();
        }
      } else {
        target.detach?.();
      }
      return { action, path, leafId: leafId(target), applied: true };
    }
    case "pin":
    case "unpin": {
      const target = path
        ? ws.getLeavesOfType("markdown").find((l) => isMarkdownView(l.view) && (l.view).file.path === path)
        : ws.activeLeaf ?? undefined;
      if (!target?.setPinned) return { action, path, applied: false, reason: "Pinning unavailable" };
      target.setPinned(action === "pin");
      return { action, path, applied: true };
    }
    default:
      throw new BridgeError("INVALID_INPUT", `Unknown workspace action: ${action}`);
  }
};
