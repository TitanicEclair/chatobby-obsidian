// In-process implementations for CLI-family tools that can be computed from
// metadataCache + resolvedLinks + workspace — no external Obsidian CLI binary
// required. Used by cli-operations.ts as a fallback when the CLI binary is
// unavailable (the common case for most users), or as the primary path when
// the in-process result is authoritative.
//
// Each function returns a plain object; cli-operations.ts JSON.stringifies it
// as the tool's stdout.

import type { App, TFile } from "obsidian";
import { buildAdjacency } from "./retrieval-graph";

function getMarkdownFiles(app: App): TFile[] {
  return app.vault.getMarkdownFiles();
}

function getResolvedLinks(app: App): Record<string, Record<string, number>> {
  return (app.metadataCache as unknown as { resolvedLinks?: Record<string, Record<string, number>> }).resolvedLinks ?? {};
}

// ── outline ────────────────────────────────────────────────────────────

interface OutlineHeading {
  level: number;
  text: string;
  line: number;
}

export function computeOutline(app: App, filePath: string): { headings: OutlineHeading[] } {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || !("stat" in file)) throw new Error(`File not found: ${filePath}`);
  const cache = app.metadataCache.getFileCache(file as TFile);
  const headings = (cache?.headings ?? []).map((h) => ({
    level: h.level,
    text: h.heading,
    line: h.position.start.line + 1,
  }));
  return { headings };
}

// ── backlinks ──────────────────────────────────────────────────────────

interface BacklinkEntry {
  source: string;
  line?: number;
}

export function computeBacklinks(app: App, filePath: string): { backlinks: BacklinkEntry[] } {
  const rl = getResolvedLinks(app);
  const backlinks: BacklinkEntry[] = [];
  for (const [source, targets] of Object.entries(rl)) {
    if (targets && typeof targets[filePath] === "number" && targets[filePath] > 0) {
      backlinks.push({ source });
    }
  }
  return { backlinks };
}

// ── unresolved ─────────────────────────────────────────────────────────

interface UnresolvedEntry {
  source: string;
  target: string;
  line?: number;
}

export function computeUnresolved(app: App): { unresolved: UnresolvedEntry[] } {
  const unresolved: UnresolvedEntry[] = [];
  const files = getMarkdownFiles(app);
  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    if (!cache?.links) continue;
    for (const link of cache.links) {
      const resolved = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
      if (!resolved) {
        unresolved.push({
          source: file.path,
          target: link.link,
          ...(link.position?.start?.line !== undefined ? { line: link.position.start.line + 1 } : {}),
        });
      }
    }
  }
  return { unresolved };
}

// ── orphans ────────────────────────────────────────────────────────────

export function computeOrphans(app: App): { orphans: string[] } {
  const adj = buildAdjacency(getResolvedLinks(app));
  const files = getMarkdownFiles(app);
  const orphans = files
    .filter((f) => !adj.incoming.has(f.path) || (adj.incoming.get(f.path)?.size ?? 0) === 0)
    .map((f) => f.path);
  return { orphans };
}

// ── wordcount ──────────────────────────────────────────────────────────

export async function computeWordcount(app: App, filePath: string): Promise<{ path: string; words: number; characters: number; lines: number }> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file || !("stat" in file)) throw new Error(`File not found: ${filePath}`);
  const content = await app.vault.cachedRead(file as TFile);
  const stripped = content.replace(/^---[\s\S]*?---\s*/, ""); // strip frontmatter
  const words = stripped.trim() === "" ? 0 : stripped.trim().split(/\s+/).length;
  const characters = stripped.length;
  const lines = content.split(/\r?\n/).length;
  return { path: filePath, words, characters, lines };
}

// ── deadends ───────────────────────────────────────────────────────────

export function computeDeadends(app: App): { deadends: string[] } {
  const adj = buildAdjacency(getResolvedLinks(app));
  const files = getMarkdownFiles(app);
  const deadends = files
    .filter((f) => {
      const out = adj.outgoing.get(f.path);
      return !out || out.size === 0;
    })
    .map((f) => f.path);
  return { deadends };
}

// ── recents ────────────────────────────────────────────────────────────

export function computeRecents(app: App): { files: string[] } {
  const ws = app.workspace as unknown as { getLastOpenFiles?: () => string[] };
  const files = typeof ws.getLastOpenFiles === "function" ? ws.getLastOpenFiles() : [];
  return { files };
}

// ── random ─────────────────────────────────────────────────────────────

export function computeRandom(app: App, folder?: string): { path: string; basename: string } {
  let files = getMarkdownFiles(app);
  if (folder) {
    const prefix = folder.replace(/^\/+|\/+$/g, "");
    files = files.filter((f) => f.path.startsWith(prefix + "/") || f.path === prefix);
  }
  if (files.length === 0) throw new Error("No markdown files available");
  const pick = files[Math.floor(Math.random() * files.length)]!;
  return { path: pick.path, basename: pick.basename };
}
