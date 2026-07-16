// Plugin-native "data" operations (Phase C) — vault/metadata/links/tasks ops that
// read or mutate the vault via app.vault + app.metadataCache. Runtime surface
// ops (editor/workspace/commands/hotkeys) live in workspace-operations.ts.
//
// All handlers: (args, signal, app) → JSON-serializable result, throwing BridgeError
// with a correct code on failure. See docs/tooling/operation-catalog.md.

import type { App, TFile } from "obsidian";
import type { OperationHandler } from "../types";
import { BridgeError } from "../types";
import { getFilteredMarkdownFiles, fileToNoteRef } from "./helpers/search";
import { mergeFrontmatter, splitFrontmatter, serializeFrontmatter } from "./helpers/frontmatter";
import { parseTasks, setTaskStatus } from "./helpers/tasks";
import { neighborhood, degreeOf } from "./helpers/retrieval-graph";
import { getVaultRetrievalService } from "../retrieval/service";
import type { TaskStatus } from "./helpers/tasks";
import { base64ToArrayBuffer } from "./helpers/binary";
import { getVaultIdentity } from "./helpers/vault-identity";
import { collectObsidianCapabilityState } from "../dependency-snapshot";

// ── Shared local helpers ───────────────────────────────────────────────

/** Resolve a path to a TFile or throw NOTE_NOT_FOUND. */
function requireFile(app: App, path: string): TFile {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f || !("stat" in f)) throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);
  return f as TFile;
}

/** The subset of CachedMetadata these handlers consume. */
interface CacheEntry {
  frontmatter?: Record<string, unknown>;
  tags?: Array<{ tag: string; position?: { start: { line: number }; end: { line: number } } }>;
  links?: Array<{ link: string; original?: string; position?: { start: { line: number } } }>;
  headings?: Array<{ heading: string; level: number; position?: { start: { line: number } } }>;
}

function getCache(app: App, file: TFile): CacheEntry | null {
  return (app.metadataCache.getFileCache(file) as CacheEntry | null | undefined) ?? null;
}

/** resolvedLinks accessor — may be absent in some environments. */
function getResolvedLinks(app: App): Record<string, Record<string, number>> {
  const rl = (app.metadataCache as unknown as { resolvedLinks?: Record<string, Record<string, number>> }).resolvedLinks;
  return rl ?? {};
}

function strArg(args: Record<string, unknown>, key: string, required: true): string;
function strArg(args: Record<string, unknown>, key: string, required: false, fallback?: string): string | undefined;
function strArg(args: Record<string, unknown>, key: string, required: boolean, fallback?: string): string | undefined {
  const v = args[key];
  if (typeof v === "string") return v;
  if (required) throw new BridgeError("INVALID_INPUT", `Missing required string argument: ${key}`);
  return fallback;
}

// ── registry.status ───────────────────────────────────────────────────

export const handleRegistryStatus: OperationHandler = async (_args, _signal, app) => {
  return {
    vault: getVaultIdentity(app),
    ...collectObsidianCapabilityState(app),
  };
};

// ── metadata.get ──────────────────────────────────────────────────────

export const handleMetadataGet: OperationHandler = async (args, _signal, app) => {
  const path = strArg(args, "path", true);
  const file = requireFile(app, path);
  const cache = getCache(app, file);

  return {
    note: fileToNoteRef(file),
    ...(cache?.frontmatter ? { frontmatter: cache.frontmatter } : {}),
    ...(cache?.tags ? { tags: cache.tags } : {}),
    ...(cache?.links ? { links: cache.links } : {}),
    ...(cache?.headings ? { headings: cache.headings } : {}),
    stat: file.stat,
  };
};

// ── properties.list ───────────────────────────────────────────────────

export const handlePropertiesList: OperationHandler = async (args, signal, app) => {
  const folder = strArg(args, "folder", false);
  const limit = typeof args.limit === "number" ? args.limit : 200;
  const files = getFilteredMarkdownFiles(app, folder);

  const counts = new Map<string, { type: string; count: number }>();
  for (const file of files) {
    if (signal.aborted) break;
    const fm = getCache(app, file)?.frontmatter;
    if (!fm) continue;
    for (const [key, value] of Object.entries(fm)) {
      let entry = counts.get(key);
      if (!entry) {
        entry = { type: inferType(value), count: 0 };
        counts.set(key, entry);
      }
      entry.count += 1;
    }
  }

  const properties = Array.from(counts.entries())
    .map(([key, v]) => ({ key, type: v.type, count: v.count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);

  return { properties };
};

function inferType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

// ── frontmatter.update ────────────────────────────────────────────────

export const handleFrontmatterUpdate: OperationHandler = async (args, signal, app) => {
  const path = strArg(args, "path", true);
  const updates = (args.properties ?? args.updates ?? args.frontmatter) as Record<string, unknown> | undefined;
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new BridgeError("INVALID_INPUT", "frontmatter.update requires a 'properties' object argument");
  }
  const mode = (typeof args.mode === "string" ? args.mode : "merge") as "merge" | "replace";
  const expectedMtime = typeof args.expectedMtime === "number" ? args.expectedMtime : undefined;

  const file = requireFile(app, path);

  // Revision conflict check (matches note.edit's contract).
  if (expectedMtime !== undefined && file.stat.mtime !== expectedMtime) {
    throw new BridgeError(
      "REVISION_CONFLICT",
      `File was modified since last read (expected mtime ${expectedMtime}, got ${file.stat.mtime})`,
    );
  }

  // Prefer Obsidian's canonical frontmatter API when available.
  const processFrontMatter = (app as unknown as {
    fileManager?: { processFrontMatter?: (file: TFile, fn: (fm: Record<string, unknown>) => void) => Promise<void> };
  }).fileManager?.processFrontMatter;

  let changed = false;
  if (processFrontMatter) {
    await processFrontMatter(file, (fm) => {
      // In replace mode, clear all existing keys first.
      if (mode === "replace") {
        for (const k of Object.keys(fm)) {
          delete fm[k];
          changed = true;
        }
      }
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) {
          if (k in fm) { delete fm[k]; changed = true; }
        } else if (!Object.is(fm[k], v)) {
          fm[k] = v; changed = true;
        }
      }
    });
  } else {
    if (signal.aborted) throw new BridgeError("DEADLINE_EXCEEDED", "Request aborted", true);
    await app.vault.process(file, (content) => {
      if (mode === "replace") {
        // Replace: clear all existing keys, set only the updates.
        const split = splitFrontmatter(content);
        const newFm = { ...updates } as Record<string, unknown>;
        // Remove null/undefined entries (delete semantics).
        for (const [k, v] of Object.entries(newFm)) {
          if (v === null || v === undefined) delete newFm[k];
        }
        const fmText = serializeFrontmatter(newFm);
        const body = split.body.replace(/^\n/, "");
        const newContent = `---\n${fmText}\n---\n${body}`;
        changed = newContent !== content;
        return newContent;
      }
      const merged = mergeFrontmatter(content, updates);
      changed = merged.changed;
      return merged.content;
    });
  }

  return { note: fileToNoteRef(file), mtime: file.stat.mtime, changed };
};

// ── tags.list ─────────────────────────────────────────────────────────

export const handleTagsList: OperationHandler = async (args, signal, app) => {
  const folder = strArg(args, "folder", false);
  const limit = typeof args.limit === "number" ? args.limit : 200;
  const files = getFilteredMarkdownFiles(app, folder);

  const counts = new Map<string, number>();
  for (const file of files) {
    if (signal.aborted) break;
    const tags = getCache(app, file)?.tags;
    if (!tags) continue;
    for (const t of tags) {
      const name = t.tag.replace(/^#/, "");
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  const tags = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);

  return { tags };
};

// ── links.generate ────────────────────────────────────────────────────

export const handleLinksGenerate: OperationHandler = async (args, _signal, app) => {
  const path = strArg(args, "path", false);
  const ref = strArg(args, "ref", false);
  const format = strArg(args, "format", false, "wikilink") as "wikilink" | "markdown";
  const alias = strArg(args, "alias", false);

  if (!path && !ref) {
    throw new BridgeError("INVALID_INPUT", "links.generate requires 'path' or 'ref'");
  }

  let name: string;
  let resolvedPath: string | undefined;
  if (path) {
    const file = requireFile(app, path);
    name = file.basename;
    resolvedPath = file.path;
  } else {
    name = ref!;
  }

  const link = format === "markdown"
    ? alias ? `[${alias}](${resolvedPath ?? name})` : `[${name}](${resolvedPath ?? name})`
    : alias ? `[[${name}|${alias}]]` : `[[${name}]]`;

  return { link, format, ...(resolvedPath ? { target: resolvedPath } : {}) };
};

// ── links.get ─────────────────────────────────────────────────────────

export const handleLinksGet: OperationHandler = async (args, _signal, app) => {
  const path = strArg(args, "path", true);
  const file = requireFile(app, path);
  const direction = strArg(args, "direction", false, "both") as "out" | "in" | "both";

  const out: Array<{ target: string; display?: string; line?: number }> = [];
  if (direction !== "in") {
    const links = getCache(app, file)?.links;
    if (links) {
      for (const l of links) {
        out.push({
          target: l.link,
          ...(l.original ? { display: l.original } : {}),
          ...(l.position?.start?.line !== undefined ? { line: l.position.start.line } : {}),
        });
      }
    }
  }

  const incoming: Array<{ source: string }> = [];
  if (direction !== "out") {
    const rl = getResolvedLinks(app);
    for (const source of Object.keys(rl)) {
      const targets = rl[source] ?? {};
      if (typeof targets[file.path] === "number") {
        incoming.push({ source });
      }
    }
  }

  return { ...(direction !== "in" ? { outgoing: out } : {}), ...(direction !== "out" ? { incoming } : {}) };
};

// ── links.audit ───────────────────────────────────────────────────────

export const handleLinksAudit: OperationHandler = async (args, signal, app) => {
  const folder = strArg(args, "folder", false);
  const limit = typeof args.limit === "number" ? args.limit : 200;
  const files = getFilteredMarkdownFiles(app, folder);

  const broken: Array<{ path: string; target: string; line?: number }> = [];
  for (const file of files) {
    if (signal.aborted) break;
    const links = getCache(app, file)?.links;
    if (!links) continue;
    for (const l of links) {
      const resolved = app.metadataCache.getFirstLinkpathDest(l.link, file.path);
      if (!resolved) {
        broken.push({
          path: file.path,
          target: l.link,
          ...(l.position?.start?.line !== undefined ? { line: l.position.start.line } : {}),
        });
      }
      if (broken.length >= limit) break;
    }
    if (broken.length >= limit) break;
  }

  return { broken, count: broken.length };
};

// ── graph.traverse ────────────────────────────────────────────────────

export const handleGraphTraverse: OperationHandler = async (args, _signal, app) => {
  const path = strArg(args, "startPath", false) ?? strArg(args, "path", true);
  if (!app.vault.getAbstractFileByPath(path)) {
    throw new BridgeError("NOTE_NOT_FOUND", `Note not found: ${path}`);
  }
  const depth = typeof args.maxDepth === "number" ? args.maxDepth : typeof args.depth === "number" ? args.depth : 2;
  const limit = typeof args.maxNodes === "number" ? args.maxNodes : typeof args.limit === "number" ? args.limit : 50;

  const adj = getVaultRetrievalService(app).adjacency();
  const sub = neighborhood(adj, path, depth, limit);

  const nodes = Array.from(sub.nodes).map((p) => ({
    path: p,
    degree: degreeOf(adj, p),
  }));
  const edges = Array.from(sub.edges.values()).map((e) => ({
    source: e.source,
    target: e.target,
    ...(e.weight !== 1 ? { weight: e.weight } : {}),
  }));

  return { root: path, nodes, edges };
};

// ── tasks.list ────────────────────────────────────────────────────────

export const handleTasksList: OperationHandler = async (args, signal, app) => {
  const folder = strArg(args, "folder", false);
  const includeCompleted = args.includeCompleted !== false;
  const limit = typeof args.limit === "number" ? args.limit : 500;
  const files = getFilteredMarkdownFiles(app, folder);

  const tasks: ReturnType<typeof parseTasks> = [];
  for (const file of files) {
    if (signal.aborted) break;
    const content = await app.vault.cachedRead(file);
    tasks.push(...parseTasks(file.path, content, includeCompleted));
    if (tasks.length >= limit) { tasks.length = limit; break; }
  }

  // Convert 0-indexed internal lines to 1-indexed for the model
  return { tasks: tasks.map(t => ({ ...t, line: t.line + 1 })) };
};

// ── tasks.update ──────────────────────────────────────────────────────

export const handleTasksUpdate: OperationHandler = async (args, _signal, app) => {
  const path = strArg(args, "path", true);
  const status = mapTaskStatus(strArg(args, "status", true));
  if (status !== "checked" && status !== "unchecked" && status !== "in_progress" && status !== "cancelled") {
    throw new BridgeError("INVALID_INPUT", `Invalid task status: ${status}`);
  }

  const file = requireFile(app, path);
  let result: { content: string; changed: boolean } = { content: "", changed: false };
  await app.vault.process(file, (content) => {
    if (typeof args.line === "number") {
      try {
        // Accept 1-indexed line from model, convert to 0-indexed for internal use
        result = setTaskStatus(content, args.line - 1, status);
      } catch (error) {
        throw new BridgeError("INVALID_INPUT", error instanceof Error ? error.message : String(error));
      }
    } else if (typeof args.find === "string") {
      const line = findTaskLine(content, args.find);
      if (line < 0) throw new BridgeError("INVALID_INPUT", `No task matching: ${args.find}`);
      result = setTaskStatus(content, line, status);
    } else {
      throw new BridgeError("INVALID_INPUT", "tasks.update requires 'line' or 'find'");
    }
    return result.content;
  });

  return { note: fileToNoteRef(file), changed: result.changed };
};

function findTaskLine(content: string, needle: string): number {
  const lines = content.split(/\r?\n/);
  const lower = needle.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*[-*+]\s+\[[ xX-]\]\s+/.test(lines[i]!) && lines[i]!.toLowerCase().includes(lower)) {
      return i;
    }
  }
  return -1;
}

// ── folder.create ─────────────────────────────────────────────────────

export const handleFolderCreate: OperationHandler = async (args, _signal, app) => {
  const path = strArg(args, "path", true);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing) throw new BridgeError("PATH_EXISTS", `Folder already exists: ${path}`);
  await app.vault.createFolder(path);
  return { path, created: true };
};

// ── entry.copy ────────────────────────────────────────────────────────

export const handleEntryCopy: OperationHandler = async (args, _signal, app) => {
  const source = strArg(args, "sourcePath", false) ?? strArg(args, "source", true);
  const destination = strArg(args, "targetPath", false) ?? strArg(args, "destination", true);
  const src = requireFile(app, source);
  if (app.vault.getAbstractFileByPath(destination)) {
    throw new BridgeError("PATH_EXISTS", `Destination already exists: ${destination}`);
  }
  // Prefer vault.copy (handles binary + metadata in production Obsidian);
  // fall back to readBinary + createBinary for test mocks and older environments.
  const vaultAny = app.vault as unknown as { copy?: (f: TFile, dest: string) => Promise<TFile> };
  let created: TFile;
  if (typeof vaultAny.copy === "function") {
    created = await vaultAny.copy(src, destination);
  } else {
    const data = await app.vault.readBinary(src);
    created = await (app.vault as unknown as { createBinary: (p: string, d: ArrayBuffer) => Promise<TFile> }).createBinary(destination, data);
  }
  return { source, destination, note: fileToNoteRef(created) };
};

// ── entry.move ────────────────────────────────────────────────────────

export const handleEntryMove: OperationHandler = async (args, _signal, app) => {
  const source = strArg(args, "sourcePath", false) ?? strArg(args, "source", true);
  const destination = strArg(args, "targetPath", false) ?? strArg(args, "destination", true);
  const src = requireFile(app, source);
  if (app.vault.getAbstractFileByPath(destination)) {
    throw new BridgeError("PATH_EXISTS", `Destination already exists: ${destination}`);
  }
  await app.vault.rename(src, destination);
  return { source, destination, note: fileToNoteRef(src) };
};

// ── entry.trash ───────────────────────────────────────────────────────

export const handleEntryTrash: OperationHandler = async (args, _signal, app) => {
  const path = strArg(args, "path", true);
  const file = requireFile(app, path);
  const trashFile = (app.fileManager as unknown as { trashFile?: (file: TFile) => Promise<void> }).trashFile;
  if (!trashFile) {
    throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "File manager trash API unavailable — cannot recoverably delete");
  }
  await trashFile.call(app.fileManager, file);
  return { path, trashed: true };
};

// ── attachment.import ─────────────────────────────────────────────────

export const handleAttachmentImport: OperationHandler = async (args, _signal, app) => {
  // Accept MCP-canonical field names (targetPath, content) and legacy (path, base64).
  const path = strArg(args, "targetPath", false) ?? strArg(args, "path", true);
  if (app.vault.getAbstractFileByPath(path)) {
    throw new BridgeError("PATH_EXISTS", `Attachment already exists: ${path}`);
  }

  // content/base64: the MCP server reads a file and base64-encodes it server-side,
  // then sends the result as `content`. `base64` is the legacy field name.
  const base64 = typeof args.content === "string" ? args.content
    : typeof args.base64 === "string" ? args.base64
    : undefined;
  const mimeType = typeof args.mimeType === "string" ? args.mimeType : undefined;

  let sizeBytes: number;
  if (base64 !== undefined) {
    const buffer = base64ToArrayBuffer(base64);
    sizeBytes = buffer.byteLength;
    await (app.vault as unknown as { createBinary: (p: string, d: ArrayBuffer) => Promise<TFile> }).createBinary(path, buffer);
  } else if (typeof args.text === "string") {
    sizeBytes = args.text.length;
    await app.vault.create(path, args.text);
  } else {
    throw new BridgeError("INVALID_INPUT", "attachment.import requires 'content' (base64), 'base64' (legacy), or 'text'");
  }

  return { path, sizeBytes, ...(mimeType ? { mimeType } : {}) };
};

// ── Local helpers ─────────────────────────────────────────────────────

function mapTaskStatus(status: string): TaskStatus {
  switch (status) {
    case "done":
    case "checked":
      return "checked";
    case "in_progress":
      return "in_progress";
    case "todo":
    case "unchecked":
      return "unchecked";
    case "cancelled":
      return "cancelled";
    default:
      return status as TaskStatus;
  }
}
