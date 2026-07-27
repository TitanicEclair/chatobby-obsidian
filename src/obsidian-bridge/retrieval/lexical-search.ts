import type { App, TFile } from "obsidian";
import { degreeOf } from "../operations/helpers/retrieval-graph";
import type { GraphAdjacency } from "../operations/helpers/retrieval-graph";
import { BridgeError } from "../types";
import type { SemanticHit } from "./types";
import { normalizePath } from "./graphify-index";

const CONTENT_SCAN_BUDGET_MS = 4_000;
const CONTENT_SCAN_CONCURRENCY = 8;
const MAX_METADATA_CHARS = 8_000;

export interface LexicalSearchResult {
  hits: SemanticHit[];
  searchedFileCount: number;
  totalFileCount: number;
  incomplete: boolean;
  timedOut: boolean;
  failedFileCount: number;
}

interface RankedFile {
  file: TFile;
  quickScore: number;
  quickExcerpt?: string;
}

/**
 * Rank vault notes using cheap path/metadata matching first, then a bounded
 * concurrent content scan. Title/path matching is typo tolerant; note content
 * accepts case-insensitive phrases and unordered query terms.
 */
export async function searchVaultLexically(
  app: App,
  adjacency: GraphAdjacency,
  query: string,
  limit: number,
  folder?: string,
  signal?: AbortSignal,
): Promise<LexicalSearchResult> {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = tokenize(normalizedQuery);
  const normalizedFolder = folder ? normalizePath(folder) : undefined;
  const files = app.vault.getMarkdownFiles().filter((file) =>
    !normalizedFolder || file.path === normalizedFolder || file.path.startsWith(`${normalizedFolder}/`));
  const rankedFiles = files.map((file) => rankWithoutContent(app, file, normalizedQuery, queryTerms));
  rankedFiles.sort((left, right) =>
    right.quickScore - left.quickScore ||
    right.file.stat.mtime - left.file.stat.mtime ||
    left.file.path.localeCompare(right.file.path));

  const hits = new Map<string, SemanticHit>();
  for (const ranked of rankedFiles) {
    if (ranked.quickScore <= 0) continue;
    hits.set(ranked.file.path, {
      path: ranked.file.path,
      score: ranked.quickScore + degreeOf(adjacency, ranked.file.path) * 0.01,
      provider: "lexical",
      ...(ranked.quickExcerpt ? { excerpt: ranked.quickExcerpt } : {}),
    });
  }

  const deadline = Date.now() + CONTENT_SCAN_BUDGET_MS;
  let nextIndex = 0;
  let searchedFileCount = 0;
  let incomplete = false;
  let timedOut = false;
  let failedFileCount = 0;

  const scan = async (): Promise<void> => {
    while (nextIndex < rankedFiles.length) {
      if (signal?.aborted) throw abortedError();
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        incomplete = true;
        timedOut = true;
        return;
      }
      const ranked = rankedFiles[nextIndex++]!;
      const read = await readBeforeDeadline(app, ranked.file, remainingMs, signal);
      if (read.status === "timeout") {
        incomplete = true;
        timedOut = true;
        return;
      }
      if (read.status === "failed") {
        incomplete = true;
        failedFileCount += 1;
        continue;
      }
      searchedFileCount += 1;
      const contentScore = scoreSearchText(normalizedQuery, queryTerms, normalizeSearchText(read.content), false);
      if (contentScore <= 0) continue;
      const contentIndex = firstContentMatch(read.content, query, queryTerms);
      const existing = hits.get(ranked.file.path);
      const score = (existing?.score ?? degreeOf(adjacency, ranked.file.path) * 0.01) + contentScore * 1.5;
      hits.set(ranked.file.path, {
        path: ranked.file.path,
        score,
        provider: "lexical",
        ...(contentIndex >= 0
          ? { excerpt: excerptAround(read.content, contentIndex, query.length) }
          : existing?.excerpt ? { excerpt: existing.excerpt } : {}),
      });
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(CONTENT_SCAN_CONCURRENCY, rankedFiles.length) },
    () => scan(),
  ));
  if (nextIndex < rankedFiles.length) incomplete = true;

  return {
    hits: [...hits.values()]
      .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
      .slice(0, limit),
    searchedFileCount,
    totalFileCount: files.length,
    incomplete,
    timedOut,
    failedFileCount,
  };
}

function rankWithoutContent(
  app: App,
  file: TFile,
  normalizedQuery: string,
  queryTerms: string[],
): RankedFile {
  const normalizedPath = normalizeSearchText(`${file.basename} ${file.path}`);
  const pathScore = scoreSearchText(normalizedQuery, queryTerms, normalizedPath, true);
  const metadata = metadataSearchText(app, file);
  const metadataScore = metadata
    ? scoreSearchText(normalizedQuery, queryTerms, normalizeSearchText(metadata), true)
    : 0;
  const quickScore = pathScore * 3 + metadataScore * 2;
  return {
    file,
    quickScore,
    ...(pathScore > 0
      ? { quickExcerpt: `Matched note path: ${file.path}` }
      : metadataScore > 0 ? { quickExcerpt: "Matched note metadata" } : {}),
  };
}

function scoreSearchText(
  normalizedQuery: string,
  queryTerms: string[],
  normalizedText: string,
  allowTypos: boolean,
): number {
  if (!normalizedQuery || queryTerms.length === 0 || !normalizedText) return 0;
  if (normalizedText.includes(normalizedQuery)) return 1;

  const exactMatches = queryTerms.filter((term) => normalizedText.includes(term)).length;
  const exactCoverage = exactMatches / queryTerms.length;
  if (exactCoverage === 1) return 0.9;
  const minimumCoverage = queryTerms.length <= 2 ? 1 : 0.6;
  if (exactCoverage >= minimumCoverage) return 0.45 + exactCoverage * 0.35;
  if (!allowTypos) return 0;

  const candidateTerms = tokenize(normalizedText).slice(0, 256);
  if (candidateTerms.length === 0) return 0;
  let similarityTotal = 0;
  for (const queryTerm of queryTerms) {
    let best = 0;
    for (const candidate of candidateTerms) {
      if (Math.abs(candidate.length - queryTerm.length) > Math.max(2, Math.floor(queryTerm.length * 0.35))) continue;
      best = Math.max(best, wordSimilarity(queryTerm, candidate));
      if (best === 1) break;
    }
    if (best < 0.7) return 0;
    similarityTotal += best;
  }
  return 0.35 + (similarityTotal / queryTerms.length) * 0.4;
}

function wordSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }
  const distance = levenshteinDistance(left, right);
  return Math.max(0, 1 - distance / Math.max(left.length, right.length));
}

function levenshteinDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length]!;
}

function metadataSearchText(app: App, file: TFile): string {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache) return "";
  const values: string[] = [];
  for (const [key, value] of Object.entries(cache.frontmatter ?? {})) {
    values.push(key);
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values.push(String(value));
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
          values.push(String(entry));
        }
      }
    }
  }
  for (const tag of cache.tags ?? []) if (tag.tag) values.push(tag.tag);
  for (const heading of cache.headings ?? []) if (heading.heading) values.push(heading.heading);
  return values.join(" ").slice(0, MAX_METADATA_CHARS);
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}+/gu, "").toLocaleLowerCase();
}

function tokenize(value: string): string[] {
  return [...value.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => match[0]).filter(uniqueStrings);
}

function firstContentMatch(content: string, query: string, queryTerms: string[]): number {
  const normalizedContent = normalizeSearchText(content);
  const phraseIndex = normalizedContent.indexOf(normalizeSearchText(query));
  if (phraseIndex >= 0) return phraseIndex;
  for (const term of queryTerms) {
    const index = normalizedContent.indexOf(term);
    if (index >= 0) return index;
  }
  return -1;
}

function excerptAround(content: string, index: number, length: number): string {
  const start = Math.max(0, index - 120);
  const end = Math.min(content.length, index + Math.max(length, 1) + 120);
  return content.slice(start, end).replace(/\s+/g, " ").trim();
}

type ReadResult =
  | { status: "ok"; content: string }
  | { status: "failed" }
  | { status: "timeout" };

function readBeforeDeadline(
  app: App,
  file: TFile,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ReadResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: ReadResult): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(abortedError());
    };
    const timer = window.setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    app.vault.cachedRead(file).then(
      (content) => finish({ status: "ok", content }),
      () => finish({ status: "failed" }),
    );
  });
}

function abortedError(): BridgeError {
  return new BridgeError("DEADLINE_EXCEEDED", "Retrieval scan aborted", true);
}

function uniqueStrings(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}
