import type { App } from "obsidian";
import type { VaultContext } from "../types";
import { CONTEXT_EXCERPT_AFTER, CONTEXT_EXCERPT_BEFORE, CONTEXT_EXCERPT_MAX_CHARS } from "./constants";

export type NoteContext = Pick<VaultContext, "notePath" | "cursor" | "selection" | "contextExcerpt" | "headings">;

export function gatherNoteContext(app: App): NoteContext {
  const activeFile = app.workspace.getActiveFile();
  return {
    notePath: activeFile?.path,
    contextExcerpt: activeFile ? { fromLine: 0, toLine: CONTEXT_EXCERPT_BEFORE + CONTEXT_EXCERPT_AFTER, text: "" } : undefined,
    headings: [],
  };
}

export function clampContextText(text: string): string {
  return text.length > CONTEXT_EXCERPT_MAX_CHARS ? text.slice(0, CONTEXT_EXCERPT_MAX_CHARS) : text;
}
