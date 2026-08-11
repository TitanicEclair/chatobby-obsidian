import { readdir } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { prepareFuzzySearch, TFile, TFolder, type App } from "obsidian";
import type { FrontendProjectRootViewModel } from "../../vendor/chatobby-client/frontend-contracts.js";

export interface ComposerVaultReference {
  readonly id: string;
  readonly kind: "file" | "folder";
  readonly label: string;
  readonly path: string;
  readonly promptPath: string;
  readonly scope: "vault" | "project";
  readonly vaultRelativePath?: string;
  readonly localPath?: string;
  readonly rootId?: string;
  readonly rootLabel?: string;
  readonly relativePath?: string;
}

export interface ComposerReferenceWorkspace {
  readonly roots: readonly FrontendProjectRootViewModel[];
  readonly activeRootId?: string;
}

interface RankedReference {
  readonly reference: ComposerVaultReference;
  readonly score: number;
}

const MAX_REFERENCE_RESULTS = 16;
const MAX_EXTERNAL_ENTRIES = 2_000;
const MAX_EXTERNAL_DEPTH = 5;

/**
 * Search the live Vault index and the current Project's verified device-local
 * roots without reading file contents. References never grant access.
 */
export async function searchWorkspaceReferences(
  app: App,
  query: string,
  workspace?: ComposerReferenceWorkspace,
): Promise<readonly ComposerVaultReference[]> {
  const vault = searchVaultReferences(app, query, workspace);
  if (!workspace?.roots.length) return vault;
  const external = await searchProjectRootReferences(query, workspace);
  const activeRoot = workspace.roots.find((root) => root.rootId === workspace.activeRootId);
  return activeRoot?.locationKind === "vault-relative"
    ? deduplicateAndLimit([...vault, ...external])
    : deduplicateAndLimit([...external, ...vault]);
}

/** Search Vault-backed references synchronously for fast local fallback and tests. */
export function searchVaultReferences(
  app: App,
  query: string,
  workspace?: ComposerReferenceWorkspace,
): readonly ComposerVaultReference[] {
  const normalizedQuery = query.trim();
  const fuzzy = normalizedQuery ? prepareFuzzySearch(normalizedQuery) : null;
  const ranked: RankedReference[] = [];
  const activeRoot = workspace?.roots.find((root) => root.rootId === workspace.activeRootId);
  const activeVaultPrefix = activeRoot?.vaultRelativePath?.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
  const adapter = app.vault.adapter as (typeof app.vault.adapter & { getFullPath?(path: string): string }) | undefined;
  for (const entry of app.vault.getAllLoadedFiles()) {
    if (!entry.path || isPrivateChatobbyPath(entry.path, app.vault.configDir)) continue;
    const kind = entry instanceof TFolder ? "folder" : entry instanceof TFile ? "file" : null;
    if (!kind) continue;
    const relativeToActive = activeVaultPrefix && (
      entry.path === activeVaultPrefix || entry.path.startsWith(`${activeVaultPrefix}/`)
    ) ? entry.path.slice(activeVaultPrefix.length).replace(/^\//u, "") : undefined;
    const reference: ComposerVaultReference = {
      id: `vault:${entry.path}`,
      kind,
      label: entry.name || entry.path,
      path: entry.path,
      promptPath: entry.path,
      scope: "vault",
      vaultRelativePath: entry.path,
      ...(adapter?.getFullPath ? { localPath: adapter.getFullPath(entry.path) } : {}),
      ...(relativeToActive === undefined ? {} : { relativePath: relativeToActive }),
    };
    if (!fuzzy) {
      const inActiveRoot = relativeToActive !== undefined;
      const depth = pathDepth(relativeToActive ?? entry.path);
      ranked.push({ reference, score: (inActiveRoot ? 10_000 : 0) + (kind === "folder" ? 200 : 0) - depth * 25 });
      continue;
    }
    const match = fuzzy(`${reference.label} ${relativeToActive ?? ""} ${entry.path}`);
    if (match) ranked.push({ reference, score: match.score + (relativeToActive !== undefined ? 10_000 : 0) });
  }
  return sortAndLimit(ranked);
}

async function searchProjectRootReferences(
  query: string,
  workspace: ComposerReferenceWorkspace,
): Promise<readonly ComposerVaultReference[]> {
  const ranked: RankedReference[] = [];
  const normalizedQuery = query.trim();
  const fuzzy = normalizedQuery ? prepareFuzzySearch(normalizedQuery) : null;
  for (const root of workspace.roots) {
    if (root.availability !== "available" || !root.localPath) continue;
    if (root.locationKind === "vault-relative") continue;
    const active = root.rootId === workspace.activeRootId;
    const entries = await walkRoot(root.localPath, normalizedQuery.length === 0 ? 2 : MAX_EXTERNAL_DEPTH);
    for (const entry of entries) {
      const relativePath = relative(root.localPath, entry.path).split(sep).join("/");
      if (!relativePath || isPrivateChatobbyPath(relativePath, undefined)) continue;
      const label = basename(entry.path) || relativePath;
      const reference: ComposerVaultReference = {
        id: `project:${root.directoryId}:${relativePath}`,
        kind: entry.kind,
        label,
        path: `${root.label}/${relativePath}`,
        promptPath: entry.path,
        scope: "project",
        localPath: entry.path,
        rootId: root.rootId,
        rootLabel: root.label,
        relativePath,
        ...(root.vaultRelativePath
          ? { vaultRelativePath: `${root.vaultRelativePath.replace(/\/$/u, "")}/${relativePath}` }
          : {}),
      };
      if (!fuzzy) {
        ranked.push({
          reference,
          score: (active ? 20_000 : 10_000) + (entry.kind === "folder" ? 200 : 0) - pathDepth(relativePath) * 25,
        });
        continue;
      }
      const match = fuzzy(`${label} ${relativePath} ${root.label}`);
      if (match) ranked.push({ reference, score: match.score + (active ? 20_000 : 10_000) });
    }
  }
  return sortAndLimit(ranked);
}

async function walkRoot(
  root: string,
  maximumDepth: number,
): Promise<readonly { readonly path: string; readonly kind: "file" | "folder" }[]> {
  const results: { path: string; kind: "file" | "folder" }[] = [];
  const queue: { path: string; depth: number }[] = [{ path: root, depth: 0 }];
  while (queue.length > 0 && results.length < MAX_EXTERNAL_ENTRIES) {
    const current = queue.shift();
    if (!current) break;
    let entries;
    try {
      entries = await readdir(current.path, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (results.length >= MAX_EXTERNAL_ENTRIES) break;
      if (entry.name === ".chatobby" || entry.name === ".git" || entry.name === "node_modules") continue;
      const path = join(current.path, entry.name);
      if (entry.isDirectory()) {
        results.push({ path, kind: "folder" });
        if (current.depth < maximumDepth) queue.push({ path, depth: current.depth + 1 });
      } else if (entry.isFile()) {
        results.push({ path, kind: "file" });
      }
    }
  }
  return results;
}

function deduplicateAndLimit(references: readonly ComposerVaultReference[]): readonly ComposerVaultReference[] {
  const seen = new Set<string>();
  const result: ComposerVaultReference[] = [];
  for (const reference of references) {
    const identity = reference.localPath?.toLocaleLowerCase() ?? reference.vaultRelativePath?.toLocaleLowerCase() ?? reference.id;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(reference);
    if (result.length >= MAX_REFERENCE_RESULTS) break;
  }
  return result;
}

function sortAndLimit(ranked: readonly RankedReference[]): readonly ComposerVaultReference[] {
  return [...ranked]
    .sort((left, right) =>
      right.score - left.score
      || Number(right.reference.kind === "folder") - Number(left.reference.kind === "folder")
      || left.reference.path.localeCompare(right.reference.path))
    .slice(0, MAX_REFERENCE_RESULTS)
    .map((entry) => entry.reference);
}

function isPrivateChatobbyPath(path: string, configDir: string | undefined): boolean {
  const normalizedPath = path.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "").toLocaleLowerCase();
  const normalizedConfigDir = configDir
    ?.replaceAll("\\", "/")
    .replace(/^\/+|\/+$/gu, "")
    .toLocaleLowerCase();
  return normalizedPath === ".chatobby"
    || normalizedPath.startsWith(".chatobby/")
    || (normalizedConfigDir !== undefined && (
      normalizedPath === normalizedConfigDir
      || normalizedPath.startsWith(`${normalizedConfigDir}/`)
    ));
}

function pathDepth(path: string): number {
  return path.split(/[\\/]/u).filter(Boolean).length;
}
