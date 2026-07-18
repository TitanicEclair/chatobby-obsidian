// Plugin-native "runtime" operations (Phase C) — editor / workspace / commands /
// hotkeys. These touch live Obsidian runtime surfaces that have no useful behavior
// in a headless test, so each handler degrades gracefully (returns an "unavailable"
// result) when the surface is absent, and is otherwise correct in production.

import type { App, TFile } from "obsidian";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { editNote } from "./helpers/note-io";

// ── Command execution allowlist (defense-in-depth; mirrors the MCP server's
// command-allowlist.ts so a stale/modified MCP server cannot bypass the gate).
// Re-validate here per the api-surface contract.
const COMMAND_ALLOWLIST = new Set([
  "editor:save-file", "editor:toggle-pin", "editor:focus",
  "workspace:new-tab", "workspace:next-tab", "workspace:previous-tab", "workspace:close",
  "app:go-back", "app:go-forward",
  "graph:open",
  "file-explorer:new-file", "file-explorer:new-folder",
  "editor:insert-embed", "editor:insert-link",
  "editor:toggle-bold", "editor:toggle-italics", "editor:toggle-highlight", "editor:toggle-code",
]);

// ── Local surface types (kept minimal; cast via unknown to avoid `any`) ──

interface EditorLike {
  getCursor(): { line: number; ch: number };
  getCursor(side: "from" | "to"): { line: number; ch: number };
  getSelection(): string;
  getValue(): string;
  setValue(value: string): void;
  lineCount(): number;
  setCursor(pos: { line: number; ch: number }): void;
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
  activeLeaf?: LeafLike | null;
  getLeaf?(...args: unknown[]): LeafLike;
  setActiveLeaf?(leaf: LeafLike, opts?: { focus?: boolean }): void;
	iterateAllLeaves?(callback: (leaf: LeafLike) => void): void;
	getLayout?(): Record<string, unknown>;
	createLeafBySplit?(leaf: LeafLike, direction?: "vertical" | "horizontal", before?: boolean): LeafLike;
	duplicateLeaf?(leaf: LeafLike, direction?: "vertical" | "horizontal"): Promise<LeafLike>;
}

function getWorkspace(app: App): WorkspaceLike {
  return app.workspace as unknown as WorkspaceLike;
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
	if (leaves.length > 0) return leaves;
	for (const leaf of workspace.getLeavesOfType("markdown") ?? []) {
		if (!leaves.includes(leaf)) leaves.push(leaf);
	}
	if (workspace.activeLeaf && !leaves.includes(workspace.activeLeaf)) leaves.push(workspace.activeLeaf);
	return leaves;
}

function findLeafById(workspace: WorkspaceLike, id: string | undefined): LeafLike | undefined {
	return id ? allLeaves(workspace).find((leaf) => leafId(leaf) === id) : undefined;
}

function sanitizeLayoutNode(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sanitizeLayoutNode);
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	const sanitized: Record<string, unknown> = {};
	for (const key of ["id", "type", "direction", "currentTab"] as const) {
		if (typeof record[key] === "string" || typeof record[key] === "number") sanitized[key] = record[key];
	}
	if (Array.isArray(record.children)) sanitized.children = record.children.map(sanitizeLayoutNode);
	const state = record.state;
	if (state && typeof state === "object" && !Array.isArray(state)) {
		const stateRecord = state as Record<string, unknown>;
		if (typeof stateRecord.type === "string") sanitized.viewType = stateRecord.type;
	}
	return sanitized;
}

function sanitizedWorkspaceLayout(workspace: WorkspaceLike): Record<string, unknown> | undefined {
	const layout = workspace.getLayout?.();
	if (!layout) return undefined;
	const sanitized: Record<string, unknown> = {};
	for (const key of ["main", "left", "right", "floating"] as const) {
		const node = sanitizeLayoutNode(layout[key]);
		if (node !== undefined) sanitized[key] = node;
	}
	return sanitized;
}

/** Find an active markdown view, preferring the workspace's active leaf. */
function getActiveMarkdownView(app: App, path?: string): MarkdownViewLike | null {
  const ws = getWorkspace(app);
  const leaves = ws.getLeavesOfType("markdown") ?? [];
  const activeView = ws.activeLeaf?.view;
  const views: MarkdownViewLike[] = [];
  for (const leaf of leaves) {
    if (isMarkdownView(leaf.view)) views.push(leaf.view);
  }
  if (path) {
    return views.find((v) => v.file?.path === path) ?? null;
  }
  if (activeView && isMarkdownView(activeView)) return activeView;
  return views[0] ?? null;
}

// ── editor.get ────────────────────────────────────────────────────────

export const handleEditorGet: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  const view = getActiveMarkdownView(app, path);
  if (!view) {
    return { available: false, reason: "No active markdown editor for the requested note" };
  }
  const editor = view.editor;
  const cursor = editor.getCursor();
  return {
    available: true,
    path: view.file.path,
    cursor: { line: cursor.line + 1, ch: cursor.ch },
    selection: editor.getSelection() || undefined,
    lineCount: editor.lineCount(),
  };
};

// ── editor.edit ───────────────────────────────────────────────────────

export const handleEditorEdit: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  const edit = args.edit as Record<string, unknown> | undefined;
  if (!edit || typeof edit !== "object") {
    throw new BridgeError("INVALID_INPUT", "editor.edit requires an 'edit' argument");
  }

  const view = getActiveMarkdownView(app, path);
  if (!view) {
    // No live editor — apply the edit to the underlying file instead.
    if (!path) throw new BridgeError("INVALID_INPUT", "editor.edit requires 'path' when no active editor");
    const result = await editNote(app, path, edit);
    return { appliedTo: "file" as const, ...result };
  }

  const editor = view.editor;
  const current = editor.getValue();
  const transformed = applyEditTransform(current, edit);
  if (transformed !== current) {
    editor.setValue(transformed);
  }
  return { appliedTo: "editor" as const, path: view.file.path, changed: transformed !== current };
};

/** Mirror of note.edit's transform modes, applied to an in-memory string. */
function applyEditTransform(current: string, edit: Record<string, unknown>): string {
  const mode = edit.mode as string;
  const content = edit.content as string | undefined;
  switch (mode) {
    case "insert": {
      const at = asEditorPosition(edit.at) ?? { line: 0, ch: 0 };
      return replaceRange(current, content ?? "", at, at);
    }
    case "replace": {
      const from = asEditorPosition(edit.from);
      const to = asEditorPosition(edit.to);
      if (!from || !to) throw new BridgeError("INVALID_INPUT", "replace requires 'from' and 'to'");
      return replaceRange(current, content ?? "", from, to);
    }
    case "append": return current + (content ?? "");
    case "prepend": return (content ?? "") + current;
    case "replace_all": return content ?? "";
    case "replace_exact": {
      const find = edit.find as string | undefined;
      if (find === undefined) throw new BridgeError("INVALID_INPUT", "replace_exact requires 'find'");
      if (!current.includes(find)) throw new BridgeError("INVALID_INPUT", `Find string not found: ${find}`);
      return current.replace(find, (edit.replace as string | undefined) ?? "");
    }
    default: throw new BridgeError("INVALID_INPUT", `Unknown edit mode: ${mode}`);
  }
}

function asEditorPosition(value: unknown): { line: number; ch: number } | null {
  if (!value || typeof value !== "object") return null;
  const pos = value as Record<string, unknown>;
  return typeof pos.line === "number" && typeof pos.ch === "number"
    ? { line: pos.line, ch: pos.ch }
    : null;
}

function replaceRange(
  current: string,
  replacement: string,
  from: { line: number; ch: number },
  to: { line: number; ch: number },
): string {
  const lines = current.split(/\r?\n/);
  const start = offsetFromPosition(lines, from);
  const end = offsetFromPosition(lines, to);
  return current.slice(0, start) + replacement + current.slice(end);
}

function offsetFromPosition(lines: string[], pos: { line: number; ch: number }): number {
  const line = Math.max(0, Math.min(pos.line, lines.length - 1));
  const ch = Math.max(0, Math.min(pos.ch, lines[line]?.length ?? 0));
  let offset = 0;
  for (let i = 0; i < line; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  return offset + ch;
}

// ── editor.focus ──────────────────────────────────────────────────────

export const handleEditorFocus: OperationHandler = async (args, _signal, app) => {
  const path = typeof args.path === "string" ? args.path : undefined;
  if (!path) throw new BridgeError("INVALID_INPUT", "editor.focus requires 'path'");
  const file = app.vault.getAbstractFileByPath(path);
  if (!file || !("stat" in file)) throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);
  const tfile = file as TFile;

  const ws = getWorkspace(app);
  const leaf = ws.getLeaf ? ws.getLeaf(false) : ws.getLeavesOfType("markdown")[0];
  if (!leaf) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "No workspace leaf available");
  if (leaf.openFile) await leaf.openFile(tfile);
  if (ws.setActiveLeaf) ws.setActiveLeaf(leaf, { focus: true });

  const line = typeof args.line === "number" ? args.line : undefined;
  const ch = typeof args.ch === "number" ? args.ch : 0;
  if (line !== undefined) {
    const view = isMarkdownView((leaf as { view?: unknown }).view) ? (leaf.view as MarkdownViewLike) : null;
    if (view) view.editor.setCursor({ line, ch });
  }

  return { focused: true, path, ...(line !== undefined ? { line, ch } : {}) };
};

// ── workspace.get ─────────────────────────────────────────────────────

export const handleWorkspaceGet: OperationHandler = async (_args, _signal, app) => {
  const ws = getWorkspace(app);
  const leaves = allLeaves(ws);
  const activeLeafId = ws.activeLeaf ? leafId(ws.activeLeaf) : undefined;
  const openNotes = [];
  const leafSummaries: Array<Record<string, unknown>> = [];
  for (const leaf of leaves) {
    const viewState = leaf.getViewState?.();
    const state = viewState?.state && typeof viewState.state === "object" && !Array.isArray(viewState.state)
      ? viewState.state as Record<string, unknown>
      : {};
    const view = leaf.view as { getViewType?: () => string; getDisplayText?: () => string } | undefined;
    const viewType = view?.getViewType?.() ?? viewState?.type ?? "unknown";
    const id = leafId(leaf);
    const summary: Record<string, unknown> = {
      leafId: id,
      viewType,
      isActive: leaf === ws.activeLeaf,
      pinned: viewState?.pinned === true,
    };
    const title = view?.getDisplayText?.();
    if (title) summary.title = title;
    if (typeof state.file === "string") summary.path = state.file;
    if (typeof state.url === "string") summary.url = state.url;
    leafSummaries.push(summary);
    if (isMarkdownView(leaf.view)) {
      const v = leaf.view;
      openNotes.push({
        leafId: id,
        path: v.file.path,
        basename: v.file.basename,
        type: v.getViewType?.() ?? "markdown",
        mtime: v.file.stat.mtime,
        ctime: v.file.stat.ctime,
        isActive: leaf === ws.activeLeaf,
      });
    }
  }
  const layout = sanitizedWorkspaceLayout(ws);
  return {
    ...(activeLeafId ? { activeLeafId } : {}),
    leaves: leafSummaries,
    openNotes,
    ...(layout ? { layout } : {}),
  };
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
      if (!file || !("stat" in file)) throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);
      const leaf = ws.getLeaf ? ws.getLeaf("tab") : ws.getLeavesOfType("markdown")[0];
      if (!leaf?.openFile) return { action, path, applied: false, reason: "No available leaf" };
      await leaf.openFile(file as TFile);
      return { action, path, applied: true };
    }
    case "close":
    case "close-others": {
      const target = exactLeaf ?? (path
        ? ws.getLeavesOfType("markdown").find((l) => isMarkdownView(l.view) && (l.view as MarkdownViewLike).file.path === path)
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
        ? ws.getLeavesOfType("markdown").find((l) => isMarkdownView(l.view) && (l.view as MarkdownViewLike).file.path === path)
        : ws.activeLeaf ?? undefined;
      if (!target?.setPinned) return { action, path, applied: false, reason: "Pinning unavailable" };
      target.setPinned(action === "pin");
      return { action, path, applied: true };
    }
    default:
      throw new BridgeError("INVALID_INPUT", `Unknown workspace action: ${action}`);
  }
};

// ── commands.list ─────────────────────────────────────────────────────

interface CommandRegistryLike {
  listCommands?(): Array<{ id: string; name?: string }>;
  executeCommandById?(id: string): unknown;
}

function getCommands(app: App): CommandRegistryLike | null {
  const commands = (app as unknown as { commands?: CommandRegistryLike }).commands;
  return commands ?? null;
}

export const handleCommandsList: OperationHandler = async (args, _signal, app) => {
  const commands = getCommands(app);
  if (!commands?.listCommands) {
    return { available: false, commands: [], reason: "Command registry unavailable" };
  }
  const limit = typeof args.limit === "number" ? args.limit : 500;
  const query = typeof args.query === "string" ? args.query.toLowerCase() : "";
  const all = (commands.listCommands() ?? []).filter((command) => {
    if (!query) return true;
    return command.id.toLowerCase().includes(query) || (command.name?.toLowerCase().includes(query) ?? false);
  });
  return {
    available: true,
    commands: all.slice(0, limit).map((c) => ({ id: c.id, ...(c.name ? { name: c.name } : {}) })),
  };
};

// ── commands.execute ──────────────────────────────────────────────────

export const handleCommandsExecute: OperationHandler = async (args, _signal, app) => {
  const id = typeof args.commandId === "string" ? args.commandId : typeof args.id === "string" ? args.id : undefined;
  if (!id) throw new BridgeError("INVALID_INPUT", "commands.execute requires 'id'");
  // Defense-in-depth: re-validate the allowlist plugin-side.
  if (!COMMAND_ALLOWLIST.has(id)) {
    throw new BridgeError("COMMAND_NOT_ALLOWED", `Command '${id}' is not on the execution allowlist`, false, { commandId: id });
  }
  const commands = getCommands(app);
  if (!commands?.executeCommandById) {
    return { executed: false, id, reason: "Command registry unavailable" };
  }
  commands.executeCommandById(id);
  return { executed: true, id, commandId: id };
};

// ── hotkeys.list ──────────────────────────────────────────────────────

interface HotkeyBinding { modifiers: string; key: string }
interface HotkeyRegistryLike {
  getHotkeys?(commandId: string): HotkeyBinding[] | undefined;
}

function getHotkeys(app: App): HotkeyRegistryLike | null {
  const hotkeys = (app as unknown as { hotkeys?: HotkeyRegistryLike }).hotkeys;
  return hotkeys ?? null;
}

function formatBinding(b: HotkeyBinding): string {
  return b.modifiers ? `${b.modifiers}-${b.key}` : b.key;
}

export const handleHotkeysList: OperationHandler = async (args, _signal, app) => {
  const requestedCommandId = typeof args.commandId === "string" ? args.commandId : undefined;
  const hotkeys = getHotkeys(app);
  const commands = getCommands(app);
  if (!hotkeys?.getHotkeys) {
    return { available: false, hotkeys: [], reason: "Hotkey registry unavailable" };
  }
  const commandIds = requestedCommandId
    ? [requestedCommandId]
    : commands?.listCommands?.().map((c) => c.id) ?? [];
  const out: Array<{ command: string; keys: string[] }> = [];
  for (const id of commandIds) {
    const bindings = hotkeys.getHotkeys(id) ?? [];
    if (bindings.length === 0) continue;
    out.push({ command: id, keys: bindings.map(formatBinding) });
  }
  return { available: true, hotkeys: out, source: "obsidian" };
};
