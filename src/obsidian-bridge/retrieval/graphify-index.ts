import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { GraphifyGraphData, GraphifySnapshot } from "./types";

const MAX_GRAPH_BYTES = 80 * 1024 * 1024;
const MAX_NODES = 100_000;
const MAX_LINKS = 500_000;

export class GraphifyIndex {
  private snapshot: GraphifySnapshot | null = null;
  private loadPromise: Promise<GraphifySnapshot> | null = null;

  constructor(private readonly vaultRoot: string) {}

  get available(): boolean {
    return this.snapshot !== null;
  }

  current(): GraphifySnapshot | null {
    return this.snapshot;
  }

  sourceMtime(): number | undefined {
    return this.snapshot?.sourceMtime;
  }

  async load(): Promise<GraphifySnapshot> {
    if (this.snapshot) return this.snapshot;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doLoad().then(
      (snapshot) => {
        this.snapshot = snapshot;
        this.loadPromise = null;
        return snapshot;
      },
      (error) => {
        this.loadPromise = null;
        throw error;
      },
    );
    return this.loadPromise;
  }

  async refresh(): Promise<GraphifySnapshot> {
    try {
      const snapshot = await this.doLoad();
      this.snapshot = snapshot;
      return snapshot;
    } catch (error) {
      if (!this.snapshot) throw error;
      this.snapshot = {
        ...this.snapshot,
        warnings: [
          ...this.snapshot.warnings,
          { code: "STALE_COMPONENT_DATA", message: `Graphify refresh failed: ${errorMessage(error)}` },
        ],
      };
      return this.snapshot;
    }
  }

  async isStale(): Promise<boolean> {
    if (!this.snapshot) return true;
    try {
      const stats = await stat(this.graphPath());
      return stats.mtimeMs !== this.snapshot.sourceMtime;
    } catch {
      return true;
    }
  }

  private async doLoad(): Promise<GraphifySnapshot> {
    const graphPath = this.graphPath();
    const stats = await stat(graphPath).catch(() => {
      throw new Error("Graphify index not found at graphify-out/graph.json");
    });
    if (stats.size > MAX_GRAPH_BYTES) {
      throw new Error(`Graphify index exceeds ${MAX_GRAPH_BYTES} byte limit`);
    }

    const graph = validateGraphData(JSON.parse(await readFile(graphPath, "utf8")));
    const labels = await this.readLabels();
    return buildSnapshot(graph, labels, stats.mtimeMs);
  }

  private graphPath(): string {
    return path.join(this.vaultRoot, "graphify-out", "graph.json");
  }

  private async readLabels(): Promise<Map<number, string>> {
    const labels = new Map<number, string>();
    const labelsPath = path.join(this.vaultRoot, "graphify-out", ".graphify_labels.json");
    const raw = await readFile(labelsPath, "utf8").catch(() => null);
    if (!raw) return labels;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        const id = Number(key);
        if (Number.isFinite(id) && typeof value === "string") labels.set(id, value);
      }
    } catch {
      // Labels are best-effort; graph data is still usable without them.
    }
    return labels;
  }
}

function validateGraphData(input: unknown): GraphifyGraphData {
  if (!input || typeof input !== "object") throw new Error("Graphify input is not an object");
  const data = input as Record<string, unknown>;
  if (!Array.isArray(data.nodes)) throw new Error("Graphify graph missing nodes array");
  if (!Array.isArray(data.links)) throw new Error("Graphify graph missing links array");
  if (data.nodes.length > MAX_NODES) throw new Error(`Graphify node count exceeds ${MAX_NODES}`);
  if (data.links.length > MAX_LINKS) throw new Error(`Graphify link count exceeds ${MAX_LINKS}`);

  for (const node of data.nodes) {
    if (!node || typeof node !== "object") throw new Error("Graphify node is not an object");
    const record = node as Record<string, unknown>;
    if (typeof record.id !== "string") throw new Error("Graphify node missing string id");
  }
  for (const link of data.links) {
    if (!link || typeof link !== "object") throw new Error("Graphify link is not an object");
    const record = link as Record<string, unknown>;
    if (typeof record.source !== "string" || typeof record.target !== "string") {
      throw new Error("Graphify link missing string source/target");
    }
  }

  return data as unknown as GraphifyGraphData;
}

function buildSnapshot(graph: GraphifyGraphData, labels: Map<number, string>, sourceMtime: number): GraphifySnapshot {
  const undirectedAdjacency = new Map<string, Set<string>>();
  const outgoingAdjacency = new Map<string, Set<string>>();
  const degree = new Map<string, number>();
  const nodeCommunity = new Map<string, number>();
  const pathToNode = new Map<string, string>();

  for (const node of graph.nodes) {
    undirectedAdjacency.set(node.id, new Set());
    outgoingAdjacency.set(node.id, new Set());
    degree.set(node.id, node.degree ?? 0);
    if (node.community !== undefined) nodeCommunity.set(node.id, node.community);
    if (node.source_file) pathToNode.set(normalizePath(node.source_file), node.id);
  }

  for (const link of graph.links) {
    outgoingAdjacency.get(link.source)?.add(link.target);
    undirectedAdjacency.get(link.source)?.add(link.target);
    undirectedAdjacency.get(link.target)?.add(link.source);
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }

  return {
    graph,
    labels,
    undirectedAdjacency,
    outgoingAdjacency,
    degree,
    nodeCommunity,
    pathToNode,
    loadedAt: new Date().toISOString(),
    sourceMtime,
    warnings: [],
  };
}

export function normalizePath(input: string): string {
  return input.trim().replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/$/, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
