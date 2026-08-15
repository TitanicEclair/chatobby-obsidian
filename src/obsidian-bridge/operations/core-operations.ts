// Connector-owned core operations that require the live Obsidian host.

import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { gatherEnvironmentContext } from "../../prompt/environment";
import { getObsidianSemanticContextService } from "../../obsidian-context";
import { resolveNote } from "./helpers/note-io";

export const handleContextGet: OperationHandler = async (args, _signal, app) => {
  const include = Array.isArray(args.include)
    ? args.include.filter(
        (value): value is "activeNote" | "selection" | "cursor" | "headings" | "openNotes" =>
          value === "activeNote"
          || value === "selection"
          || value === "cursor"
          || value === "headings"
          || value === "openNotes",
      )
    : undefined;
  const maxOpenNotes = typeof args.maxOpenNotes === "number" ? args.maxOpenNotes : undefined;
  const scope = typeof args.scope === "string"
    && ["current", "active-view", "workspace", "region", "leaf"].includes(args.scope)
    ? args.scope as "current" | "active-view" | "workspace" | "region" | "leaf"
    : undefined;
  const regionId = typeof args.regionId === "string" ? args.regionId : undefined;
  const leafId = typeof args.leafId === "string" ? args.leafId : undefined;
  const cursor = typeof args.cursor === "string" ? args.cursor : undefined;
  const limit = typeof args.limit === "number" ? args.limit : undefined;
  try {
    return {
      ...getObsidianSemanticContextService(app).contextProjection({
        include,
        maxOpenNotes,
        scope,
        regionId,
        leafId,
        cursor,
        limit,
      }),
      environment: gatherEnvironmentContext(app),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("REVISION_CONFLICT:")) {
      throw new BridgeError("REVISION_CONFLICT", message.slice("REVISION_CONFLICT:".length).trim());
    }
    if (message.startsWith("NOT_FOUND:")) {
      throw new BridgeError("NOTE_NOT_FOUND", message.slice("NOT_FOUND:".length).trim());
    }
    if (message.startsWith("INVALID_CURSOR:") || message.startsWith("INVALID_INPUT:")) {
      throw new BridgeError("INVALID_INPUT", message.replace(/^[A-Z_]+:\s*/u, ""));
    }
    throw error;
  }
};

export const handleNoteResolve: OperationHandler = async (args, _signal, app) => {
  const ref = typeof args.ref === "string" ? args.ref : undefined;
  if (!ref) throw new BridgeError("INVALID_INPUT", "note.resolve requires a 'ref' argument");

  const sourcePath = typeof args.sourcePath === "string" ? args.sourcePath : "";
  const mode = typeof args.mode === "string" ? args.mode as "path" | "name" | "wikilink" | "any" : "any";
  const limit = typeof args.limit === "number" ? args.limit : 5;
  return resolveNote(app, ref, sourcePath, mode, limit);
};
