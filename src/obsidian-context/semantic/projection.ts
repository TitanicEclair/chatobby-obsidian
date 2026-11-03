import type { ContextInclude, SemanticContextProjectionInput, SemanticContextScope, SemanticContextSnapshot } from "./types";
import { CONTEXT_MAX_OPEN_NOTES } from "../../prompt/constants";

const DEFAULT_INCLUDE: ContextInclude[] = ["activeNote", "selection", "cursor", "headings", "openNotes"];
const DEFAULT_CONTEXT_PAGE_SIZE = 25;
const MAX_CONTEXT_PAGE_SIZE = 100;

interface ContextCursor {
  contextId: string;
  revision: number;
  scope: SemanticContextScope;
  regionId?: string;
  leafId?: string;
  offset: number;
  limit: number;
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

/** Rich tool projection; cursor revisions bind paging to the captured context. */
export function projectSemanticContext(snapshot: SemanticContextSnapshot, input: SemanticContextProjectionInput = {}): Record<string, unknown> {
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
