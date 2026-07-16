import type { App, MarkdownView } from "obsidian";
import type { OpenNoteInfo } from "../types";
import { CONTEXT_MAX_OPEN_NOTES } from "./constants";

export function gatherOpenNotes(app: App): OpenNoteInfo[] {
  const leaves = app.workspace.getLeavesOfType("markdown").slice(0, CONTEXT_MAX_OPEN_NOTES);
  return leaves.flatMap((leaf) => {
    const view = leaf.view as MarkdownView;
    const file = view.file;
    return file ? [{ path: file.path, title: file.basename }] : [];
  });
}
