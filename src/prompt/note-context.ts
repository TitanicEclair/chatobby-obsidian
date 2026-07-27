import type { App } from "obsidian";
import type { VaultContext } from "../types";
import { getObsidianSemanticContextService } from "../obsidian-context";
import {
  CONTEXT_HEADING_MAX_CHARS,
  CONTEXT_MAX_HEADINGS,
  CONTEXT_SELECTION_MAX_CHARS,
} from "./constants";

export type NoteContext = Pick<
  VaultContext,
  | "notePath"
  | "cursor"
  | "selection"
  | "selectionCharacters"
  | "selectionTruncated"
  | "contextExcerpt"
  | "headings"
  | "headingCount"
  | "headingsTruncated"
>;

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
  const snapshot = getObsidianSemanticContextService(app).snapshot();
  const activeNote = snapshot.activeNote;
  if (!activeNote) return {};
  const selection = snapshot.selection?.text;
  const headingCount = snapshot.headings?.length ?? 0;
  return {
    notePath: activeNote.path,
    cursor: snapshot.cursor,
    selection: selection?.slice(0, CONTEXT_SELECTION_MAX_CHARS),
    selectionCharacters: selection?.length,
    selectionTruncated: selection !== undefined && selection.length > CONTEXT_SELECTION_MAX_CHARS,
    contextExcerpt: {
      fromLine: activeNote.fromLine,
      toLine: activeNote.toLine,
      text: activeNote.excerpt,
    },
    headings: snapshot.headings
      ?.slice(0, CONTEXT_MAX_HEADINGS)
      .map((heading) => heading.text.length > CONTEXT_HEADING_MAX_CHARS
        ? `${heading.text.slice(0, CONTEXT_HEADING_MAX_CHARS - 1)}…`
        : heading.text),
    headingCount,
    headingsTruncated: headingCount > CONTEXT_MAX_HEADINGS,
  };
}
