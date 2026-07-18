import type { App } from "obsidian";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { SemanticHit, SemanticIndexAdapter, SemanticIndexStatus } from "./types";
import { normalizePath } from "./graphify-index";

const MAX_AJSON_FILE_BYTES = 100 * 1024 * 1024;
const LIVE_QUERY_TIMEOUT_MS = 30_000;

interface AjsonEmbedding {
  vec: number[];
}

interface AjsonSourceRecord {
  path: string;
  embeddings: Record<string, AjsonEmbedding>;
}

interface AjsonParseResult {
  sources: Map<string, AjsonSourceRecord>;
  modelKey: string | null;
  dimension: number | null;
  filesScanned: number;
  sourcesWithVectors: number;
  newestMtime: number | null;
  warnings: string[];
}

interface SmartConnectionsResult {
  score?: unknown;
  path?: unknown;
  key?: unknown;
  item?: {
    path?: unknown;
    key?: unknown;
    collection_key?: unknown;
  };
}

interface SmartConnectionsEnvironment {
  state?: unknown;
  smart_sources?: {
    items?: Record<string, unknown>;
    embed_model?: {
      model_key?: unknown;
      embed?: unknown;
    };
    embed_model_key?: unknown;
    entities_vector_adapter?: {
      nearest?: unknown;
    };
  };
}

interface SmartConnectionsPluginLike {
  manifest?: { id?: unknown; version?: unknown };
  env?: SmartConnectionsEnvironment;
}

interface ObsidianPluginRegistryLike {
  getPlugin?: (id: string) => unknown;
}

interface LiveCapabilities {
  version?: string;
  model?: string;
  smartSources: NonNullable<SmartConnectionsEnvironment["smart_sources"]>;
}

export class AjsonSemanticAdapter implements SemanticIndexAdapter {
  private sources: Map<string, AjsonSourceRecord> | null = null;
  private loadPromise: Promise<Map<string, AjsonSourceRecord>> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private modelKey: string | null = null;
  private dimension: number | null = null;
  private filesScanned = 0;
  private sourcesWithVectors = 0;
  private newestMtime: number | null = null;
  private scannedFileCount: number | null = null;
  private loadedAt: string | null = null;

  constructor(private readonly vaultRoot: string) {}

  status(): SemanticIndexStatus {
    if (!this.sources) {
      return {
        available: false,
        queryEmbedding: false,
        provider: "smart-connections-ajson",
        reason: "Smart Connections AJSON index not loaded yet",
      };
    }

    const available = this.sourcesWithVectors > 0 && this.modelKey !== null && this.dimension !== null;
    return {
      available,
      queryEmbedding: false,
      model: this.modelKey ?? undefined,
      dimension: this.dimension ?? undefined,
      noteCount: this.sources.size,
      loadedAt: this.loadedAt ?? undefined,
      sourceMtime: this.newestMtime ?? undefined,
      provider: "smart-connections-ajson",
      reason: available ? undefined : `No usable Smart Connections vectors found across ${this.filesScanned} AJSON files`,
    };
  }

  async relatedToPath(notePath: string, limit: number): Promise<SemanticHit[]> {
    const sources = await this.ensureLoaded();
    const normalized = normalizePath(notePath);
    const source = sources.get(normalized);
    if (!source) return [];
    const [model, embedding] = Object.entries(source.embeddings)[0] ?? [];
    if (!model || !embedding) return [];

    const hits: SemanticHit[] = [];
    for (const [candidatePath, candidate] of sources) {
      if (candidatePath === normalized) continue;
      const candidateEmbedding = candidate.embeddings[model];
      if (!candidateEmbedding || candidateEmbedding.vec.length !== embedding.vec.length) continue;
      hits.push({
        path: candidatePath,
        score: cosineSimilarity(embedding.vec, candidateEmbedding.vec),
        model,
        provider: "smart-connections",
      });
    }

    return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
  }

  async isStale(): Promise<boolean> {
    if (!this.sources) return true;
    const files = await this.ajsonFiles().catch(() => null);
    if (!files) return true;
    if (files.length !== this.scannedFileCount) return true;
    const newest = await newestMtime(files);
    return newest !== this.newestMtime;
  }

  async refresh(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doLoad().then((sources) => {
      this.sources = sources;
    }).finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async ensureLoaded(): Promise<Map<string, AjsonSourceRecord>> {
    if (this.sources) return this.sources;
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.doLoad().then((sources) => {
      this.sources = sources;
      this.loadPromise = null;
      return sources;
    }, (error) => {
      this.loadPromise = null;
      throw error;
    });
    return this.loadPromise;
  }

  private async doLoad(): Promise<Map<string, AjsonSourceRecord>> {
    const files = await this.ajsonFiles();
    const result: AjsonParseResult = {
      sources: new Map(),
      modelKey: null,
      dimension: null,
      filesScanned: 0,
      sourcesWithVectors: 0,
      newestMtime: null,
      warnings: [],
    };

    for (const file of files) {
      result.filesScanned += 1;
      const fileStats = await stat(file);
      if (fileStats.size > MAX_AJSON_FILE_BYTES) {
        result.warnings.push(`Skipping oversized AJSON file: ${file}`);
        continue;
      }
      if (result.newestMtime === null || fileStats.mtimeMs > result.newestMtime) {
        result.newestMtime = fileStats.mtimeMs;
      }
      parseAjson(await readFile(file, "utf8"), result);
    }

    this.modelKey = result.modelKey;
    this.dimension = result.dimension;
    this.filesScanned = result.filesScanned;
    this.sourcesWithVectors = result.sourcesWithVectors;
    this.newestMtime = result.newestMtime;
    this.scannedFileCount = files.length;
    this.loadedAt = new Date().toISOString();
    return result.sources;
  }

  private async ajsonFiles(): Promise<string[]> {
    const dir = path.join(this.vaultRoot, ".smart-env", "multi");
    const names = await readdir(dir);
    return names.filter((name) => name.endsWith(".ajson")).map((name) => path.join(dir, name));
  }
}

export class SmartConnectionsLiveAdapter implements SemanticIndexAdapter {
  constructor(
    private readonly app: App,
    private readonly fallback: AjsonSemanticAdapter,
  ) {}

  status(): SemanticIndexStatus {
    const stored = this.fallback.status();
    const live = this.capabilities();
    if (!live) return stored;
    const liveCount = live.smartSources.items ? Object.keys(live.smartSources.items).length : undefined;
    return {
      available: true,
      queryEmbedding: true,
      model: live.model ?? stored.model,
      dimension: stored.dimension,
      noteCount: stored.noteCount ?? liveCount,
      loadedAt: stored.loadedAt,
      sourceMtime: stored.sourceMtime,
      provider: "smart-connections-live",
      providerVersion: live.version,
    };
  }

  relatedToPath(notePath: string, limit: number): Promise<SemanticHit[]> {
    return this.fallback.relatedToPath(notePath, limit);
  }

  async searchText(query: string, limit: number): Promise<SemanticHit[]> {
    const live = this.capabilities();
    if (!live) throw new Error("Live Smart Connections query embedding is unavailable");
    const embed = live.smartSources.embed_model?.embed;
    const nearest = live.smartSources.entities_vector_adapter?.nearest;
    if (typeof embed !== "function" || typeof nearest !== "function") {
      throw new Error("Live Smart Connections embed/nearest functions are unavailable");
    }

    const embedded = await withTimeout(Promise.resolve(embed.call(live.smartSources.embed_model, query)));
    const vector = embedded && typeof embedded === "object" ? (embedded as { vec?: unknown }).vec : undefined;
    if (!Array.isArray(vector) || !vector.every((value) => typeof value === "number")) {
      throw new Error("Smart Connections embedding did not return a numeric vec");
    }
    const raw = await withTimeout(Promise.resolve(nearest.call(live.smartSources.entities_vector_adapter, vector, { limit })));
    if (!Array.isArray(raw)) throw new Error("Smart Connections nearest result was not an array");
    return normalizeLiveHits(raw, Math.max(1, Math.min(limit, 100)), live.model);
  }

  isStale(): Promise<boolean> {
    return this.fallback.isStale();
  }

  refresh(): Promise<void> {
    return this.fallback.refresh();
  }

  private capabilities(): LiveCapabilities | null {
    const registry = (this.app as App & { plugins?: ObsidianPluginRegistryLike }).plugins;
    const plugin = registry?.getPlugin?.("smart-connections") as SmartConnectionsPluginLike | null | undefined;
    if (!plugin || plugin.manifest?.id !== "smart-connections") return null;
    const smartSources = plugin.env?.smart_sources;
    const embedModel = smartSources?.embed_model;
    if (plugin.env?.state !== "loaded" || !smartSources || !embedModel) return null;
    if (typeof embedModel.embed !== "function" || typeof smartSources.entities_vector_adapter?.nearest !== "function") return null;
    return {
      smartSources,
      version: typeof plugin.manifest.version === "string" ? plugin.manifest.version : undefined,
      model: typeof embedModel.model_key === "string"
        ? embedModel.model_key
        : typeof smartSources.embed_model_key === "string"
          ? smartSources.embed_model_key
          : undefined,
    };
  }
}

export function createSmartConnectionsAdapter(app: App, vaultRoot: string): SemanticIndexAdapter {
  return new SmartConnectionsLiveAdapter(app, new AjsonSemanticAdapter(vaultRoot));
}

function parseAjson(raw: string, result: AjsonParseResult): void {
  let wrapped = raw.trim();
  if (!wrapped) return;
  if (wrapped.endsWith(",")) wrapped = wrapped.slice(0, -1);
  const parsed = JSON.parse(`{${wrapped}}`) as Record<string, unknown>;
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith("smart_sources:") || !value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const sourcePath = typeof record.path === "string" ? normalizePath(record.path) : normalizePath(key.slice("smart_sources:".length));
    const embeddings = parseEmbeddings(record.embeddings, result);
    result.sources.set(sourcePath, { path: sourcePath, embeddings });
    if (Object.keys(embeddings).length > 0) result.sourcesWithVectors += 1;
  }
}

function parseEmbeddings(input: unknown, result: AjsonParseResult): Record<string, AjsonEmbedding> {
  const embeddings: Record<string, AjsonEmbedding> = {};
  if (!input || typeof input !== "object") return embeddings;
  for (const [model, rawEmbedding] of Object.entries(input as Record<string, unknown>)) {
    if (!rawEmbedding || typeof rawEmbedding !== "object") continue;
    const vec = (rawEmbedding as { vec?: unknown }).vec;
    if (!Array.isArray(vec) || vec.length === 0 || !vec.every((value) => typeof value === "number")) continue;
    if (result.modelKey === null) {
      result.modelKey = model;
      result.dimension = vec.length;
    }
    embeddings[model] = { vec: vec as number[] };
  }
  return embeddings;
}

function normalizeLiveHits(values: unknown[], limit: number, model?: string): SemanticHit[] {
  const bestByPath = new Map<string, SemanticHit>();
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const hit = normalizeLiveHit(value as SmartConnectionsResult, model);
    if (!hit) continue;
    const existing = bestByPath.get(hit.path);
    if (!existing || hit.score > existing.score) bestByPath.set(hit.path, hit);
  }
  return [...bestByPath.values()].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
}

function normalizeLiveHit(value: SmartConnectionsResult, model?: string): SemanticHit | null {
  if (value.item?.collection_key !== undefined && value.item.collection_key !== "smart_sources") return null;
  const rawPath = value.item?.path ?? value.item?.key ?? value.path ?? value.key;
  if (typeof rawPath !== "string" || typeof value.score !== "number" || !Number.isFinite(value.score)) return null;
  return {
    path: normalizePath(stripSmartSourcesPrefix(rawPath)),
    score: value.score,
    provider: "smart-connections-live",
    ...(model ? { model } : {}),
  };
}

function stripSmartSourcesPrefix(input: string): string {
  return input.startsWith("smart_sources:") ? input.slice("smart_sources:".length) : input;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Smart Connections query timed out after ${LIVE_QUERY_TIMEOUT_MS}ms`)), LIVE_QUERY_TIMEOUT_MS);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error: unknown) => {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function newestMtime(files: string[]): Promise<number | null> {
  let newest: number | null = null;
  for (const file of files) {
    const fileStats = await stat(file);
    if (newest === null || fileStats.mtimeMs > newest) newest = fileStats.mtimeMs;
  }
  return newest;
}
