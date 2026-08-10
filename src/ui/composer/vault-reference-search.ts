import { prepareFuzzySearch, TFile, TFolder, type App } from "obsidian";

export interface ComposerVaultReference {
  readonly kind: "file" | "folder";
  readonly label: string;
  readonly path: string;
}

interface RankedReference {
  readonly reference: ComposerVaultReference;
  readonly score: number;
}

const MAX_REFERENCE_RESULTS = 12;

/**
 * Search the live Vault index without reading file contents. A reference only
 * inserts a path into the prompt; normal permission checks still govern any
 * later read or write.
 */
export function searchVaultReferences(app: App, query: string): readonly ComposerVaultReference[] {
  const normalizedQuery = query.trim();
  const fuzzy = normalizedQuery ? prepareFuzzySearch(normalizedQuery) : null;
  const ranked: RankedReference[] = [];
  for (const entry of app.vault.getAllLoadedFiles()) {
    if (!entry.path || isPrivateChatobbyPath(entry.path, app.vault.configDir)) continue;
    const kind = entry instanceof TFolder ? "folder" : entry instanceof TFile ? "file" : null;
    if (!kind) continue;
    const reference = { kind, label: entry.name || entry.path, path: entry.path } as const;
    if (!fuzzy) {
      ranked.push({ reference, score: pathDepth(entry.path) });
      continue;
    }
    const match = fuzzy(`${reference.label} ${entry.path}`);
    if (match) ranked.push({ reference, score: match.score });
  }
  ranked.sort((left, right) =>
    right.score - left.score
    || Number(left.reference.kind === "folder") - Number(right.reference.kind === "folder")
    || left.reference.path.localeCompare(right.reference.path));
  return ranked.slice(0, MAX_REFERENCE_RESULTS).map((entry) => entry.reference);
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
  let depth = 0;
  for (const character of path) if (character === "/") depth += 1;
  return depth;
}
