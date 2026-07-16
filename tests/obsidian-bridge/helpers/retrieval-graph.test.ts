// Unit tests for the retrieval-graph helper (lexical backend).

import { describe, it, expect } from "vitest";
import {
  buildAdjacency,
  neighborhood,
  shortestPath,
  topHubs,
  connectedComponents,
  degreeOf,
} from "../../../src/obsidian-bridge/operations/helpers/retrieval-graph";

// Graph: a → b → c, a → d, isolated e
const LINKS = {
  "a.md": { "b.md": 1, "d.md": 2 },
  "b.md": { "c.md": 1 },
  "c.md": {},
  "d.md": {},
  "e.md": {},
};

describe("buildAdjacency + degreeOf", () => {
  const adj = buildAdjacency(LINKS);
  it("collects nodes from sources and targets", () => {
    expect(adj.nodes.has("a.md")).toBe(true);
    expect(adj.nodes.has("c.md")).toBe(true);
  });
  it("computes weighted degree (out-weights + in-count)", () => {
    // a: out 1(b)+2(d)=3, in 0 → 3
    expect(degreeOf(adj, "a.md")).toBe(3);
    // d: out 0, in from a → 1
    expect(degreeOf(adj, "d.md")).toBe(1);
  });
});

describe("neighborhood", () => {
  const adj = buildAdjacency(LINKS);
  it("BFS expands outward by depth", () => {
    const sub = neighborhood(adj, "a.md", 1, 50);
    expect(sub.nodes.has("a.md")).toBe(true);
    expect(sub.nodes.has("b.md")).toBe(true);
    expect(sub.nodes.has("d.md")).toBe(true);
    expect(sub.nodes.has("c.md")).toBe(false); // depth 1 from a doesn't reach c
  });
  it("respects the node limit", () => {
    const sub = neighborhood(adj, "a.md", 5, 2);
    expect(sub.nodes.size).toBeLessThanOrEqual(2);
  });
});

describe("shortestPath", () => {
  const adj = buildAdjacency(LINKS);
  it("finds a path over the undirected graph", () => {
    // c → b → a (b has no edge to a directed, but a→b is traversable undirected)
    expect(shortestPath(adj, "a.md", "c.md")).toEqual(["a.md", "b.md", "c.md"]);
  });
  it("returns null when unreachable", () => {
    expect(shortestPath(adj, "a.md", "e.md")).toBeNull();
  });
  it("returns the single node for from===to", () => {
    expect(shortestPath(adj, "a.md", "a.md")).toEqual(["a.md"]);
  });
});

describe("topHubs", () => {
  it("ranks nodes by degree, filtered to a folder", () => {
    const adj = buildAdjacency({ "f/a.md": { "f/b.md": 1 }, "f/b.md": {}, "x.md": {} });
    const hubs = topHubs(adj, "f", 10);
    expect(hubs[0]!.path).toBe("f/a.md");
  });
});

describe("connectedComponents", () => {
  it("groups connected nodes and isolates singletons", () => {
    const comps = connectedComponents(buildAdjacency(LINKS));
    // {a,b,c,d} form one component; {e} is isolated
    const big = comps.find((c) => c.includes("a.md"))!;
    expect(big).toContain("c.md");
    expect(big).toContain("d.md");
    const isolated = comps.find((c) => c.includes("e.md"))!;
    expect(isolated).toEqual(["e.md"]);
  });
});
