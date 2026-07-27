import type { App } from "obsidian";
import type { OpenNoteInfo } from "../types";
import { getObsidianSemanticContextService } from "../obsidian-context";
import { CONTEXT_MAX_OPEN_NOTES } from "./constants";

export function gatherOpenNotes(app: App): OpenNoteInfo[] {
  return getObsidianSemanticContextService(app)
    .snapshot()
    .openNotes
    .slice(0, CONTEXT_MAX_OPEN_NOTES)
    .map((note) => ({ path: note.path, title: note.title }));
}
