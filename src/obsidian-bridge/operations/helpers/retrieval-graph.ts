// Retrieval graph helpers — build and query the note-link graph from
// app.metadataCache.resolvedLinks. Powers the lexical retrieval backend for the
// retrieval.* operations (explore / trace / related / hubs / communities).
//
// resolvedLinks: Record<sourcePath, Record<targetPath, linkCount>>.
// Zero runtime deps; pure data transformations.

export interface GraphAdjacency {
  /** All known node paths (sources + targets). */
  nodes: Set<string>;
  /** sourcePath → (targetPath → weight). */
  outgoing: Map<string, Map<string, number>>;
  /** targetPath → set of sourcePaths. */
  incoming: Map<string, Set<string>>;
}

/** Build an adjacency view from Obsidian's resolvedLinks map. */
export function buildAdjacency(
  resolvedLinks: Record<string, Record<string, number>> | undefined,
): GraphAdjacency {
  const nodes = new Set<string>();
  const outgoing = new Map<string, Map<string, number>>();
  const incoming = new Map<string, Set<string>>();

  const addIncoming = (target: string, source: string): void => {
    let set = incoming.get(target);
    if (!set) {
      set = new Set<string>();
      incoming.set(target, set);
    }
    set.add(source);
  };

  const src = resolvedLinks ?? {};
  for (const source of Object.keys(src)) {
    nodes.add(source);
    const targets = src[source] ?? {};
    let outMap = outgoing.get(source);
    if (!outMap) {
      outMap = new Map<string, number>();
      outgoing.set(source, outMap);
    }
    for (const target of Object.keys(targets)) {
      const weight = targets[target] ?? 1;
      if (weight <= 0) continue;
      nodes.add(target);
      outMap.set(target, weight);
      addIncoming(target, source);
    }
  }
  return { nodes, outgoing, incoming };
}

/** Weighted degree of a node (sum of out-weights + in-weights). */
export function degreeOf(adj: GraphAdjacency, path: string): number {
  let deg = 0;
  const out = adj.outgoing.get(path);
  if (out) for (const w of out.values()) deg += w;
  const inc = adj.incoming.get(path);
  if (inc) deg += inc.size;
  return deg;
}

export interface Subgraph {
  nodes: Set<string>;
  /** edge key `${source}\0${target}` → weight. */
  edges: Map<string, { source: string; target: string; weight: number }>;
}

/**
 * BFS neighborhood of `root` up to `depth` hops, following outgoing edges.
 * Returns the set of reachable nodes (including root) and the edges between them.
 */
export function neighborhood(adj: GraphAdjacency, root: string, depth: number, limit: number): Subgraph {
  const nodes = new Set<string>([root]);
  const edges = new Map<string, { source: string; target: string; weight: number }>();
  if (depth <= 0 || !adj.nodes.has(root)) {
    return { nodes, edges };
  }
  let frontier: string[] = [root];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const node of frontier) {
      if (nodes.size >= limit) break;
      const out = adj.outgoing.get(node);
      if (!out) continue;
      for (const [target, weight] of out) {
        const key = `${node}\0${target}`;
        if (!edges.has(key)) edges.set(key, { source: node, target, weight });
        if (!nodes.has(target)) {
          nodes.add(target);
          next.push(target);
          if (nodes.size >= limit) break;
        }
      }
    }
    if (next.length === 0 || nodes.size >= limit) break;
    frontier = next;
  }
  return { nodes, edges };
}

/**
 * Shortest path from `from` to `to` over the *undirected* link graph
 * (outgoing ∪ incoming). Returns the list of node paths, or null if unreachable.
 */
export function shortestPath(adj: GraphAdjacency, from: string, to: string): string[] | null {
  if (from === to) return [from];
  if (!adj.nodes.has(from) || !adj.nodes.has(to)) return null;
  const prev = new Map<string, string>();
  const seen = new Set<string>([from]);
  const queue: string[] = [from];
  while (queue.length > 0) {
    const node = queue.shift()!;
    const neighbors = new Set<string>();
    const out = adj.outgoing.get(node);
    if (out) for (const t of out.keys()) neighbors.add(t);
    const inc = adj.incoming.get(node);
    if (inc) for (const s of inc) neighbors.add(s);
    for (const nb of neighbors) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      prev.set(nb, node);
      if (nb === to) {
        // reconstruct
        const path: string[] = [to];
        let cur: string | undefined = to;
        while (cur !== undefined && cur !== from) {
          const p: string | undefined = prev.get(cur);
          if (p === undefined) break;
          path.unshift(p);
          cur = p;
        }
        return path;
      }
      queue.push(nb);
    }
  }
  return null;
}

/** Rank nodes by weighted degree, optionally filtered to a folder prefix. */
export function topHubs(adj: GraphAdjacency, folder: string | undefined, limit: number): Array<{ path: string; degree: number }> {
  const prefix = folder ? folder.replace(/^\/+|\/+$/g, "") : "";
  const ranked: Array<{ path: string; degree: number }> = [];
  for (const path of adj.nodes) {
    if (prefix && !(path.startsWith(prefix + "/") || path === prefix)) continue;
    ranked.push({ path, degree: degreeOf(adj, path) });
  }
  ranked.sort((a, b) => b.degree - a.degree || a.path.localeCompare(b.path));
  return ranked.slice(0, Math.max(0, limit));
}

/** Connected components over the undirected link graph (union-find). */
export function connectedComponents(adj: GraphAdjacency): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const p = parent.get(cur) ?? cur;
      parent.set(cur, p);
      cur = p;
    }
    return cur;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const n of adj.nodes) parent.set(n, n);
  for (const [source, out] of adj.outgoing) {
    for (const target of out.keys()) union(source, target);
  }
  const groups = new Map<string, string[]>();
  for (const n of adj.nodes) {
    const root = find(n);
    let arr = groups.get(root);
    if (!arr) {
      arr = [];
      groups.set(root, arr);
    }
    arr.push(n);
  }
  const components = Array.from(groups.values());
  // Isolated nodes (degree 0) get their own singleton component — keep them,
  // but sort components largest-first for deterministic output.
  components.sort((a, b) => b.length - a.length);
  for (const c of components) c.sort();
  return components;
}
