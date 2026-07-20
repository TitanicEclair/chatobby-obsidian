import type { App, MarkdownView } from "obsidian";
import type { VaultContext } from "../types";
import { buildNoteContextExcerpt } from "../obsidian-bridge/operations/helpers/note-io";
import { CONTEXT_EXCERPT_AFTER, CONTEXT_EXCERPT_BEFORE, CONTEXT_EXCERPT_MAX_CHARS } from "./constants";

export type NoteContext = Pick<VaultContext, "notePath" | "cursor" | "selection" | "contextExcerpt" | "headings">;

/**
 * Resolve the active markdown view, preferring the workspace's active leaf
 * (correct when several notes are open) and falling back to the first markdown
 * leaf. Mirrors `handleContextGet` so the per-turn packet and the
 * `obsidian_get_context` tool agree on which note is "active".
 */
function resolveActiveMarkdownView(app: App): MarkdownView | null {
  type LeafLike = { view: unknown };
  const ws = app.workspace as unknown as {
    activeLeaf?: LeafLike | null;
    getLeavesOfType(type: string): LeafLike[];
  };
  const activeLeaf = ws.activeLeaf;
  const activeIsMarkdown =
    !!activeLeaf?.view && (activeLeaf.view as { getViewType?: () => string }).getViewType?.() === "markdown";
  const markdownLeaf: LeafLike | undefined = activeIsMarkdown
    ? activeLeaf!
    : ws.getLeavesOfType("markdown").find(
        (leaf) => (leaf.view as { getViewType?: () => string }).getViewType?.() === "markdown",
      );
  if (!markdownLeaf) return null;
  const view = markdownLeaf.view as MarkdownView;
  // file is null for an unsaved/untitled buffer — no excerpt to build in that case.
  return view.editor && view.file ? view : null;
}

/**
 * Gather the active note's path, cursor, selection, a bounded text excerpt
 * around the cursor, and heading titles.
 *
 * Reads the editor's live buffer (`editor.getValue()`) so unsaved edits are
 * reflected — this is the content the user is actually looking at. The excerpt
 * is built with the shared `buildNoteContextExcerpt` used by the bridge's
 * `context.get` handler, so the two paths cannot drift.
 *
 * Line numbers are 1-indexed to match `obsidian_get_context`.
 */
export function gatherNoteContext(app: App): NoteContext {
  const view = resolveActiveMarkdownView(app);
  if (!view) {
    // No markdown editor open — still surface the active file path (any type) if any.
    const activeFile = (app.workspace as { getActiveFile?: () => { path?: string } | null }).getActiveFile?.();
    return { notePath: activeFile?.path };
  }

  const editor = view.editor;
  const file = view.file;
  if (!file) return { notePath: undefined };
  const content = editor.getValue();
  const cursor = editor.getCursor();
  const selectionText = editor.getSelection();
  const excerpt = buildNoteContextExcerpt(
    content,
    cursor.line,
    selectionText ? editor.getCursor("to").line : cursor.line,
    CONTEXT_EXCERPT_BEFORE,
    CONTEXT_EXCERPT_AFTER,
  );
  const headings = app.metadataCache.getFileCache(file)?.headings?.map((heading) => heading.heading);

  return {
    notePath: file.path,
    cursor: { line: cursor.line + 1, ch: cursor.ch },
    selection: selectionText || undefined,
    contextExcerpt: {
      fromLine: excerpt.fromLine + 1,
      toLine: excerpt.toLine + 1,
      text: clampContextText(excerpt.text),
    },
    headings: headings?.length ? headings : undefined,
  };
}

export function clampContextText(text: string): string {
  return text.length > CONTEXT_EXCERPT_MAX_CHARS ? text.slice(0, CONTEXT_EXCERPT_MAX_CHARS) : text;
}
