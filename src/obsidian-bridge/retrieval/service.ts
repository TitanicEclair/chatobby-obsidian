import type { App, EventRef } from "obsidian";
import type {
  ObsidianRetrievalBackendStatus,
  ObsidianRetrievalDiagnostics,
  ObsidianRetrievalEnvelope,
  ObsidianRetrievalWarning,
} from "../../vendor/@chatobby/obsidian-protocol/index.js";
import {
  buildAdjacency,
  connectedComponents,
  degreeOf,
  shortestPath,
  topHubs,
} from "../operations/helpers/retrieval-graph";
import type { GraphAdjacency } from "../operations/helpers/retrieval-graph";
import { GraphifyIndex, normalizePath } from "./graphify-index";
import { createSmartConnectionsAdapter } from "./smart-connections-adapter";
import type { GraphComponent, GraphifySnapshot, SemanticHit, SemanticIndexAdapter } from "./types";
import { isTFile } from "../operations/helpers/file-types";
import { searchVaultLexically } from "./lexical-search";

export type RetrievalPrimitiveProvider = "graphify" | "smart-connections" | "lexical" | "obsidian-links";

const services = new WeakMap<App, VaultRetrievalService>();

export function getVaultRetrievalService(app: App): VaultRetrievalService {
  const existing = services.get(app);
  if (existing) return existing;
  const service = new VaultRetrievalService(app);
  services.set(app, service);
  return service;
}

export function disposeVaultRetrievalService(app: App): void {
  services.get(app)?.dispose();
  services.delete(app);
}

/** Mechanical access to Graphify, Smart Connections, lexical, and link data.
 * The caller selects exactly one provider per request; this class never chooses
 * a fallback or fuses providers. */
export class VaultRetrievalService {
  readonly graph: GraphifyIndex;
  readonly semantic: SemanticIndexAdapter;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private adjacencyCache: GraphAdjacency | null = null;
  private adjacencyRefs: EventRef[] = [];
  private adjacencyListenersRegistered = false;

  constructor(private readonly app: App, semanticAdapter?: SemanticIndexAdapter) {
    const vaultRoot = (app.vault.adapter as { getBasePath?: () => string }).getBasePath?.() ?? "";
    this.graph = new GraphifyIndex(vaultRoot);
    this.semantic = semanticAdapter ?? createSmartConnectionsAdapter(app, vaultRoot);
  }

  async explore(
    query: string,
    provider: RetrievalPrimitiveProvider,
    limit = 50,
    folder?: string,
    signal?: AbortSignal,
  ): Promise<ObsidianRetrievalEnvelope> {
    if (provider === "lexical") {
      const lexical = await searchVaultLexically(this.app, this.getAdjacency(), query, limit, folder, signal);
      const result = this.envelope(provider, { query, semanticHits: lexical.hits });
      result.diagnostics = {
        ...result.diagnostics,
        lexical: {
          searchedFileCount: lexical.searchedFileCount,
          totalFileCount: lexical.totalFileCount,
        },
      };
      if (lexical.incomplete) {
        result.partial = true;
        result.warnings = [{
          code: "STALE_COMPONENT_DATA",
          message: lexical.timedOut
            ? `Lexical content search inspected ${lexical.searchedFileCount} of ${lexical.totalFileCount} notes before its time budget elapsed. Path and metadata matches are still included.`
            : `Lexical content search skipped ${lexical.failedFileCount} unreadable note(s). Other ranked matches are still included.`,
        }];
      }
      return result;
    }
    if (provider === "smart-connections") {
      const status = this.semantic.status();
      if (!status.available || !status.queryEmbedding || !this.semantic.searchText) {
        return this.unavailable(provider, "Smart Connections text search is unavailable", { query });
      }
      try {
        const hits = filterHitsByFolder(await this.semantic.searchText(query, limit), folder);
        return this.envelope(provider, { query, semanticHits: hits });
      } catch {
        return this.unavailable(provider, "Smart Connections query embedding failed", { query }, "EMBEDDING_FAILED");
      }
    }
    if (provider === "graphify") {
      const snapshot = await this.graphSnapshot();
      if (!snapshot) return this.unavailable(provider, "Graphify index is unavailable", { query });
      const hits = this.graphExplore(snapshot, query, limit);
      return this.envelope(provider, {
        query,
        graph: graphFromNodeIds(snapshot, new Set(hits.map((hit) => hit.nodeId))),
      });
    }
    return this.envelope(provider, { query, graph: lexicalGraphFromPaths(this.getAdjacency(), []) });
  }

  async related(subjectPath: string, provider: RetrievalPrimitiveProvider, limit = 50): Promise<ObsidianRetrievalEnvelope> {
    const normalized = normalizePath(subjectPath);
    if (provider === "lexical") {
      return this.envelope(provider, { subjectPath: normalized, semanticHits: this.lexicalRelated(normalized, limit) });
    }
    if (provider === "smart-connections") {
      await this.ensureSemanticFresh();
      if (!this.semantic.status().available) {
        return this.unavailable(provider, "Smart Connections vectors are unavailable", { subjectPath: normalized });
      }
      try {
        return this.envelope(provider, {
          subjectPath: normalized,
          semanticHits: await this.semantic.relatedToPath(normalized, limit),
        });
      } catch {
        return this.unavailable(provider, "Smart Connections vector lookup failed", { subjectPath: normalized });
      }
    }
    if (provider === "graphify") {
      const snapshot = await this.graphSnapshot();
      const root = snapshot?.pathToNode.get(normalized);
      if (!snapshot || !root) return this.unavailable(provider, "Graphify has no node for the requested note", { subjectPath: normalized });
      return this.envelope(provider, {
        subjectPath: normalized,
        graph: graphFromNodeIds(snapshot, neighborhoodNodeIds(snapshot, root, 1, limit)),
      });
    }
    const neighbors = this.lexicalRelated(normalized, limit).map((hit) => hit.path);
    return this.envelope(provider, {
      subjectPath: normalized,
      graph: lexicalGraphFromPaths(this.getAdjacency(), [normalized, ...neighbors]),
    });
  }

  async trace(
    fromRef: string,
    toRef: string,
    provider: Extract<RetrievalPrimitiveProvider, "graphify" | "obsidian-links">,
  ): Promise<ObsidianRetrievalEnvelope> {
    if (provider === "graphify") {
      const snapshot = await this.graphSnapshot();
      if (!snapshot) return this.unavailable(provider, "Graphify index is unavailable", { subjectPath: fromRef });
      const path = this.graphShortestPath(snapshot, fromRef, toRef);
      return this.envelope(provider, {
        subjectPath: fromRef,
        graph: graphFromNodeIds(snapshot, new Set(path), path),
      });
    }
    const fromPath = this.resolveFilePath(fromRef);
    const toPath = this.resolveFilePath(toRef);
    const path = shortestPath(this.getAdjacency(), fromPath, toPath) ?? [];
    return this.envelope(provider, {
      subjectPath: fromPath,
      graph: lexicalGraphFromPaths(this.getAdjacency(), path),
    });
  }

  async hubs(
    provider: Extract<RetrievalPrimitiveProvider, "graphify" | "obsidian-links">,
    limit = 50,
    folder?: string,
    communityId?: string,
  ): Promise<ObsidianRetrievalEnvelope> {
    if (provider === "graphify") {
      const snapshot = await this.graphSnapshot();
      if (!snapshot) return this.unavailable(provider, "Graphify index is unavailable");
      const nodes = [...snapshot.graph.nodes]
        .filter((node) => node.source_file && (!folder || normalizePath(node.source_file).startsWith(normalizePath(folder))))
        .filter((node) => communityId === undefined || String(snapshot.nodeCommunity.get(node.id)) === communityId)
        .map((node) => ({ node, degree: snapshot.degree.get(node.id) ?? 0 }))
        .sort((a, b) => b.degree - a.degree || (a.node.label ?? a.node.id).localeCompare(b.node.label ?? b.node.id))
        .slice(0, limit)
        .map((entry) => entry.node.id);
      return this.envelope(provider, { graph: graphFromNodeIds(snapshot, new Set(nodes)) });
    }
    const paths = topHubs(this.getAdjacency(), folder, limit).map((hub) => hub.path);
    return this.envelope(provider, { graph: lexicalGraphFromPaths(this.getAdjacency(), paths) });
  }

  async communities(
    provider: Extract<RetrievalPrimitiveProvider, "graphify" | "obsidian-links">,
    limit = 50,
    labeled = false,
  ): Promise<ObsidianRetrievalEnvelope> {
    if (provider === "graphify") {
      const snapshot = await this.graphSnapshot();
      if (!snapshot) return this.unavailable(provider, "Graphify index is unavailable");
      const byCommunity = new Map<number, string[]>();
      for (const [nodeId, community] of snapshot.nodeCommunity) {
        const current = byCommunity.get(community) ?? [];
        current.push(nodeId);
        byCommunity.set(community, current);
      }
      const selected = [...byCommunity.entries()]
        .filter(([id]) => !labeled || snapshot.labels.has(id))
        .sort((a, b) => b[1].length - a[1].length || a[0] - b[0])
        .slice(0, limit);
      const graph = graphFromNodeIds(snapshot, new Set(selected.flatMap(([, ids]) => ids)));
      graph.communities = selected.map(([id, ids]) => ({
        id: String(id),
        label: snapshot.labels.get(id) ?? `Community ${id}`,
        hubPaths: ids
          .map((nodeId) => ({ nodeId, degree: snapshot.degree.get(nodeId) ?? 0 }))
          .sort((a, b) => b.degree - a.degree)
          .slice(0, 5)
          .map((entry) => snapshot.graph.nodes.find((node) => node.id === entry.nodeId)?.source_file)
          .filter((value): value is string => typeof value === "string")
          .map(normalizePath)
          .filter(uniqueStrings),
      }));
      return this.envelope(provider, { graph });
    }
    const components = connectedComponents(this.getAdjacency()).filter((component) => component.length > 1).slice(0, limit);
    const graph = lexicalGraphFromPaths(this.getAdjacency(), components.flat());
    graph.communities = components.map((component, index) => ({
      id: `links-${index}`,
      label: `${component.length} linked notes`,
      hubPaths: component.slice(0, 5),
    }));
    return this.envelope(provider, { graph });
  }

  async explain(subjectPath: string, provider: RetrievalPrimitiveProvider, limit = 50): Promise<ObsidianRetrievalEnvelope> {
    const result = await this.related(subjectPath, provider, limit);
    return { ...result, query: `${normalizePath(subjectPath)} explanation components` };
  }

  adjacency(): GraphAdjacency {
    return this.getAdjacency();
  }

  dispose(): void {
    const binder = this.app.vault as unknown as { offref?(ref: EventRef): void };
    if (typeof binder.offref === "function") {
      for (const ref of this.adjacencyRefs) {
        try { binder.offref(ref); } catch { /* best-effort */ }
      }
    }
    this.adjacencyRefs = [];
    this.adjacencyCache = null;
    this.adjacencyListenersRegistered = false;
  }

  private async graphSnapshot(): Promise<GraphifySnapshot | null> {
    await this.ensureInitialized();
    await this.graph.isStale().then((stale) => stale ? this.graph.refresh() : undefined).catch(() => undefined);
    return this.graph.current();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.graph.load().catch(() => undefined).then(() => {
      this.initialized = true;
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async ensureSemanticFresh(): Promise<void> {
    if (!this.semantic.isStale || !this.semantic.refresh) return;
    await this.semantic.isStale().then((stale) => stale ? this.semantic.refresh?.() : undefined).catch(() => undefined);
  }

  private getAdjacency(): GraphAdjacency {
    if (!this.adjacencyCache) {
      this.adjacencyCache = buildAdjacency(getResolvedLinks(this.app));
      this.ensureAdjacencyListeners();
    }
    return this.adjacencyCache;
  }

  private ensureAdjacencyListeners(): void {
    if (this.adjacencyListenersRegistered) return;
    this.adjacencyListenersRegistered = true;
    const binder = this.app.vault as unknown as { on?(name: string, callback: () => void): EventRef };
    if (typeof binder.on !== "function") return;
    const invalidate = (): void => { this.adjacencyCache = null; };
    for (const event of ["modify", "create", "delete", "rename"]) {
      try { this.adjacencyRefs.push(binder.on(event, invalidate)); } catch { /* best-effort */ }
    }
  }

  private lexicalRelated(path: string, limit: number): SemanticHit[] {
    const adj = this.getAdjacency();
    const weights = new Map<string, number>();
    for (const [target, weight] of adj.outgoing.get(path) ?? []) weights.set(target, (weights.get(target) ?? 0) + weight);
    for (const source of adj.incoming.get(path) ?? []) weights.set(source, (weights.get(source) ?? 0) + 1);
    return [...weights.entries()]
      .map(([hitPath, score]) => ({ path: hitPath, score, provider: "lexical" as const }))
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, limit);
  }

  private graphExplore(snapshot: GraphifySnapshot, query: string, limit: number): Array<{ nodeId: string; path: string; score: number }> {
    const wanted = query.toLocaleLowerCase();
    const hits: Array<{ nodeId: string; path: string; score: number }> = [];
    for (const node of snapshot.graph.nodes) {
      if (!node.source_file) continue;
      const label = (node.label ?? node.id).toLocaleLowerCase();
      const source = node.source_file.toLocaleLowerCase();
      if (!label.includes(wanted) && !source.includes(wanted)) continue;
      hits.push({
        nodeId: node.id,
        path: normalizePath(node.source_file),
        score: (label === wanted ? 2 : 1) + (snapshot.degree.get(node.id) ?? 0) * 0.01,
      });
    }
    return hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
  }

  private graphShortestPath(snapshot: GraphifySnapshot, fromRef: string, toRef: string): string[] {
    const from = resolveGraphNode(snapshot, fromRef);
    const to = resolveGraphNode(snapshot, toRef);
    if (!from || !to) return [];
    if (from === to) return [from];
    const seen = new Set<string>([from]);
    const previous = new Map<string, string>();
    const queue = [from];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of snapshot.undirectedAdjacency.get(current) ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        previous.set(neighbor, current);
        if (neighbor === to) return reconstructPath(previous, from, to);
        queue.push(neighbor);
      }
    }
    return [];
  }

  private resolveFilePath(ref: string): string {
    const byPath = this.app.vault.getAbstractFileByPath(ref);
    if (isTFile(byPath)) return byPath.path;
    const lower = ref.toLocaleLowerCase();
    const byName = this.app.vault.getMarkdownFiles().find((file) =>
      file.basename.toLocaleLowerCase() === lower || file.name.toLocaleLowerCase() === lower);
    return byName?.path ?? normalizePath(ref);
  }

  private envelope(provider: RetrievalPrimitiveProvider, extra: Partial<ObsidianRetrievalEnvelope>): ObsidianRetrievalEnvelope {
    const backends = this.backends();
    return {
      available: backendAvailable(backends, provider),
      partial: false,
      backends,
      warnings: [],
      ...(extra.query !== undefined ? { query: extra.query } : {}),
      ...(extra.subjectPath !== undefined ? { subjectPath: extra.subjectPath } : {}),
      ...(extra.graph !== undefined ? { graph: extra.graph } : {}),
      ...(extra.semanticHits !== undefined ? { semanticHits: extra.semanticHits } : {}),
      diagnostics: this.diagnostics(backends),
    };
  }

  private unavailable(
    provider: RetrievalPrimitiveProvider,
    message: string,
    extra: Partial<ObsidianRetrievalEnvelope> = {},
    code?: ObsidianRetrievalWarning["code"],
  ): ObsidianRetrievalEnvelope {
    const result = this.envelope(provider, extra);
    return {
      ...result,
      available: false,
      partial: true,
      warnings: [{
        code: code ?? (provider === "graphify" ? "GRAPHIFY_UNAVAILABLE" : "SMART_CONNECTIONS_UNAVAILABLE"),
        message,
      }],
    };
  }

  private backends(): ObsidianRetrievalBackendStatus[] {
    const semantic = this.semantic.status();
    return [
      {
        name: "graphify",
        available: this.graph.available,
        sourceMtime: this.graph.sourceMtime(),
        reason: this.graph.available ? undefined : "Graphify artifact is not loaded",
      },
      {
        name: "smart-connections",
        available: semantic.available,
        sourceMtime: semantic.sourceMtime,
        reason: semantic.available ? undefined : semantic.reason,
      },
      { name: "lexical", available: true },
      { name: "obsidian-links", available: true },
    ];
  }

  private diagnostics(backends: ObsidianRetrievalBackendStatus[]): ObsidianRetrievalDiagnostics {
    const snapshot = this.graph.current();
    const semantic = this.semantic.status();
    const markdownPaths = new Set(this.app.vault.getMarkdownFiles().map((file) => normalizePath(file.path)));
    const graphPaths = new Set<string>();
    const pathCounts = new Map<string, number>();
    let graphNodesMissingVaultFiles = 0;
    for (const node of snapshot?.graph.nodes ?? []) {
      if (!node.source_file) continue;
      const normalized = normalizePath(node.source_file);
      graphPaths.add(normalized);
      pathCounts.set(normalized, (pathCounts.get(normalized) ?? 0) + 1);
      if (!markdownPaths.has(normalized)) graphNodesMissingVaultFiles += 1;
    }
    let vaultFilesMissingFromGraph = 0;
    if (snapshot) for (const path of markdownPaths) if (!graphPaths.has(path)) vaultFilesMissingFromGraph += 1;
    return {
      backends,
      graphify: {
        available: this.graph.available,
        sourceMtime: this.graph.sourceMtime(),
        nodeCount: snapshot?.graph.nodes.length,
        edgeCount: snapshot?.graph.links.length,
        duplicatePathCount: [...pathCounts.values()].filter((count) => count > 1).length,
        vaultFilesMissingFromGraph,
        graphNodesMissingVaultFiles,
      },
      smartConnections: {
        available: semantic.available,
        liveAvailable: semantic.provider === "smart-connections-live" && semantic.queryEmbedding,
        ajsonAvailable: semantic.provider === "smart-connections-ajson" ? semantic.available : semantic.noteCount !== undefined,
        model: semantic.model,
        dimension: semantic.dimension,
        indexedNoteCount: semantic.noteCount,
        sourceMtime: semantic.sourceMtime,
        reason: semantic.reason,
      },
      lexical: {
        searchedFileCount: markdownPaths.size,
        totalFileCount: markdownPaths.size,
      },
    };
  }
}

function backendAvailable(backends: ObsidianRetrievalBackendStatus[], provider: RetrievalPrimitiveProvider): boolean {
  return backends.find((backend) => backend.name === provider)?.available ?? provider === "obsidian-links";
}

function getResolvedLinks(app: App): Record<string, Record<string, number>> {
  return (app.metadataCache as unknown as { resolvedLinks?: Record<string, Record<string, number>> }).resolvedLinks ?? {};
}

function graphFromNodeIds(snapshot: GraphifySnapshot, nodeIds: Set<string>, orderedPath?: string[]): GraphComponent {
  const nodesByPath = new Map<string, GraphComponent["nodes"][number]>();
  for (const node of nodeIds) {
    const value = snapshot.graph.nodes.find((candidate) => candidate.id === node);
    if (!value?.source_file) continue;
    const path = normalizePath(value.source_file);
    const degree = snapshot.degree.get(value.id);
    const existing = nodesByPath.get(path);
    if (existing && (existing.degree ?? 0) >= (degree ?? 0)) continue;
    nodesByPath.set(path, {
      path,
      label: value.label,
      degree,
      communityId: snapshot.nodeCommunity.has(value.id) ? String(snapshot.nodeCommunity.get(value.id)) : undefined,
    });
  }
  const edges = snapshot.graph.links
    .filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target))
    .filter((link) => orderedPath ? pathContainsEdge(orderedPath, link.source, link.target) : true)
    .map((link) => {
      const source = snapshot.graph.nodes.find((node) => node.id === link.source)?.source_file;
      const target = snapshot.graph.nodes.find((node) => node.id === link.target)?.source_file;
      if (!source || !target) return null;
      return {
        sourcePath: normalizePath(source),
        targetPath: normalizePath(target),
        weight: link.weight,
        type: link.relation,
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null);
  return { nodes: [...nodesByPath.values()], edges, source: "graphify" };
}

function lexicalGraphFromPaths(adjacency: GraphAdjacency, paths: string[]): GraphComponent {
  const nodes = new Set(paths.filter(Boolean));
  const edges: GraphComponent["edges"] = [];
  for (const source of nodes) {
    for (const [target, weight] of adjacency.outgoing.get(source) ?? []) {
      if (nodes.has(target)) edges.push({ sourcePath: source, targetPath: target, weight });
    }
  }
  return {
    nodes: [...nodes].map((path) => ({ path, degree: degreeOf(adjacency, path) })),
    edges,
    source: "obsidian-links",
  };
}

function filterHitsByFolder(hits: SemanticHit[], folder: string | undefined): SemanticHit[] {
  if (!folder) return hits;
  const normalized = normalizePath(folder);
  return hits.filter((hit) => hit.path === normalized || hit.path.startsWith(`${normalized}/`));
}

function neighborhoodNodeIds(snapshot: GraphifySnapshot, root: string, depth: number, limit: number): Set<string> {
  const seen = new Set<string>([root]);
  let frontier = [root];
  for (let level = 0; level < depth && seen.size < limit; level += 1) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of snapshot.undirectedAdjacency.get(nodeId) ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        next.push(neighbor);
        if (seen.size >= limit) break;
      }
    }
    frontier = next;
  }
  return seen;
}

function resolveGraphNode(snapshot: GraphifySnapshot, ref: string): string | null {
  const byPath = snapshot.pathToNode.get(normalizePath(ref));
  if (byPath) return byPath;
  const byId = snapshot.graph.nodes.find((node) => node.id === ref);
  if (byId) return byId.id;
  const lower = ref.toLocaleLowerCase();
  return snapshot.graph.nodes.find((node) => (node.label ?? "").toLocaleLowerCase() === lower)?.id ?? null;
}

function reconstructPath(previous: Map<string, string>, from: string, to: string): string[] {
  const path = [to];
  let current = to;
  while (current !== from) {
    const parent = previous.get(current);
    if (!parent) return [];
    path.unshift(parent);
    current = parent;
  }
  return path;
}

function pathContainsEdge(path: string[], source: string, target: string): boolean {
  for (let index = 0; index < path.length - 1; index += 1) {
    const a = path[index]!;
    const b = path[index + 1]!;
    if ((a === source && b === target) || (a === target && b === source)) return true;
  }
  return false;
}

function uniqueStrings(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}
