import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createMockApp } from "./helpers/mock-app";
import { executeOperation } from "../../src/obsidian-bridge/operation-registry";
import { BridgeError } from "../../src/obsidian-bridge/types";

const signal = new AbortController().signal;
type Obj = Record<string, unknown>;

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempVault(): string {
  const root = mkdtempSync(join(tmpdir(), "chatobby-retrieval-"));
  tempRoots.push(root);
  return root;
}

function writeGraphify(root: string): void {
  mkdirSync(join(root, "graphify-out"), { recursive: true });
  writeFileSync(join(root, "graphify-out", "graph.json"), JSON.stringify({
    directed: false,
    multigraph: false,
    graph: {},
    nodes: [
      { id: "alpha", label: "Alpha Concept", source_file: "alpha.md", community: 1 },
      { id: "beta", label: "Beta Concept", source_file: "beta.md", community: 1 },
      { id: "gamma", label: "Gamma Concept", source_file: "gamma.md", community: 2 },
    ],
    links: [
      { source: "alpha", target: "beta", relation: "relates", weight: 2 },
      { source: "beta", target: "gamma", relation: "supports", weight: 1 },
    ],
  }));
  writeFileSync(join(root, "graphify-out", ".graphify_labels.json"), JSON.stringify({ "1": "Alpha Cluster", "2": "Gamma Cluster" }));
}

function writeSmartConnections(root: string): void {
  mkdirSync(join(root, ".smart-env", "multi"), { recursive: true });
  writeFileSync(join(root, ".smart-env", "multi", "sources.ajson"), [
    `"smart_sources:alpha.md": {"path":"alpha.md","embeddings":{"TaylorAI/bge-micro-v2":{"vec":[1,0,0]}}}`,
    `"smart_sources:beta.md": {"path":"beta.md","embeddings":{"TaylorAI/bge-micro-v2":{"vec":[0.95,0.05,0]}}}`,
    `"smart_sources:gamma.md": {"path":"gamma.md","embeddings":{"TaylorAI/bge-micro-v2":{"vec":[0,1,0]}}}`,
  ].join(",\n"));
}

function appWithArtifacts(root: string) {
  return createMockApp(new Map([
    ["alpha.md", "alpha project atlas"],
    ["beta.md", "beta project atlas neighbor"],
    ["gamma.md", "gamma unrelated"],
  ]), {
    vaultBasePath: root,
    resolvedLinks: {
      "alpha.md": { "beta.md": 1 },
      "beta.md": { "gamma.md": 1 },
    },
    enabledPlugins: ["smart-connections"],
    pluginInstances: {
      "smart-connections": {
        manifest: { id: "smart-connections", version: "4.5.3" },
        env: {
          state: "loaded",
          smart_sources: {
            embed_model_key: "TaylorAI/bge-micro-v2",
            embed_model: {
              model_key: "TaylorAI/bge-micro-v2",
              embed: () => ({ vec: [1, 0, 0] }),
            },
            entities_vector_adapter: {
              nearest: () => [
                { score: 0.95, item: { collection_key: "smart_sources", path: "alpha.md" } },
                { score: 0.75, item: { collection_key: "smart_sources", path: "beta.md" } },
              ],
            },
          },
        },
      },
    },
  });
}

function backends(result: Obj): Obj[] {
  return result.backends as Obj[];
}

function backend(result: Obj, name: string): Obj {
  return backends(result).find((entry) => entry.name === name)!;
}

function graphPaths(result: Obj): string[] {
  const graph = result.graph as Obj | undefined;
  return ((graph?.nodes ?? []) as Obj[]).map((node) => node.path as string);
}

function semanticPaths(result: Obj): string[] {
  return ((result.semanticHits ?? []) as Obj[]).map((hit) => hit.path as string);
}

describe("retrieval provider primitives", () => {
  it("retrieval.explore returns only the requested Graphify component and backend metadata", async () => {
    const root = tempVault();
    writeGraphify(root);
    writeSmartConnections(root);

    const result = await executeOperation("retrieval.explore", {
      query: "Alpha",
      provider: "graphify",
      limit: 10,
    }, signal, appWithArtifacts(root)) as Obj;

    expect(result.available).toBe(true);
    expect(backend(result, "graphify").available).toBe(true);
    expect(backend(result, "smart-connections").available).toBe(true);
    expect(graphPaths(result)).toContain("alpha.md");
    expect(semanticPaths(result)).toEqual([]);
    expect((result.diagnostics as Obj).graphify).toMatchObject({ available: true, nodeCount: 3, edgeCount: 2 });
  });

  it("retrieval.explore keeps semantic and lexical acquisition independent", async () => {
    const root = tempVault();
    writeGraphify(root);
    writeSmartConnections(root);
    const app = createMockApp(new Map([
      ["alpha.md", "alpha project atlas"],
      ["delta.md", "needle-only exact phrase"],
    ]), {
      vaultBasePath: root,
      enabledPlugins: ["smart-connections"],
      pluginInstances: {
        "smart-connections": {
          manifest: { id: "smart-connections", version: "4.5.3" },
          env: {
            state: "loaded",
            smart_sources: {
              embed_model_key: "TaylorAI/bge-micro-v2",
              embed_model: {
                model_key: "TaylorAI/bge-micro-v2",
                embed: () => ({ vec: [1, 0, 0] }),
              },
              entities_vector_adapter: {
                nearest: () => [
                  { score: 0.9, item: { collection_key: "smart_sources", key: "smart_sources:alpha.md" } },
                ],
              },
            },
          },
        },
      },
    });

    const semantic = await executeOperation("retrieval.explore", {
      query: "needle-only",
      provider: "smart-connections",
      limit: 10,
    }, signal, app) as Obj;
    const lexical = await executeOperation("retrieval.explore", {
      query: "needle-only",
      provider: "lexical",
      limit: 10,
    }, signal, app) as Obj;

    expect(semanticPaths(semantic)).toEqual(["alpha.md"]);
    expect(semanticPaths(lexical)).toContain("delta.md");
    expect((lexical.semanticHits as Obj[]).find((hit) => hit.path === "delta.md")?.provider).toBe("lexical");
  });

  it("retrieval.related returns AJSON note-to-note semantic neighbors", async () => {
    const root = tempVault();
    writeGraphify(root);
    writeSmartConnections(root);

    const result = await executeOperation("retrieval.related", {
      subjectPath: "alpha.md",
      provider: "smart-connections",
      limit: 5,
    }, signal, appWithArtifacts(root)) as Obj;

    expect(result.subjectPath).toBe("alpha.md");
    expect(semanticPaths(result)[0]).toBe("beta.md");
    expect(((result.semanticHits as Obj[])[0]!.provider)).toBe("smart-connections");
    expect(graphPaths(result)).toEqual([]);
  });

  it("retrieval.trace returns the Graphify path between note refs", async () => {
    const root = tempVault();
    writeGraphify(root);
    writeSmartConnections(root);

    const result = await executeOperation("retrieval.trace", {
      fromRef: "alpha.md",
      toRef: "gamma.md",
      provider: "graphify",
    }, signal, appWithArtifacts(root)) as Obj;

    expect(backend(result, "graphify").available).toBe(true);
    expect(graphPaths(result)).toEqual(expect.arrayContaining(["alpha.md", "beta.md", "gamma.md"]));
    expect(((result.graph as Obj).edges as Obj[]).length).toBe(2);
  });

  it("retrieval.hubs and retrieval.communities use Graphify degree and community labels", async () => {
    const root = tempVault();
    writeGraphify(root);
    writeSmartConnections(root);
    const localApp = appWithArtifacts(root);

    const hubs = await executeOperation("retrieval.hubs", { provider: "graphify", limit: 2 }, signal, localApp) as Obj;
    const communities = await executeOperation("retrieval.communities", { provider: "graphify", limit: 2 }, signal, localApp) as Obj;

    expect(graphPaths(hubs)[0]).toBe("beta.md");
    const graph = communities.graph as Obj;
    const labels = ((graph.communities ?? []) as Obj[]).map((community) => community.label);
    expect(labels).toContain("Alpha Cluster");
  });

  it("retrieval.explain returns one requested component per call", async () => {
    const root = tempVault();
    writeGraphify(root);
    writeSmartConnections(root);

    const graphResult = await executeOperation("retrieval.explain", {
      subjectPath: "alpha.md",
      provider: "graphify",
      limit: 10,
    }, signal, appWithArtifacts(root)) as Obj;
    const semanticResult = await executeOperation("retrieval.explain", {
      subjectPath: "alpha.md",
      provider: "smart-connections",
      limit: 10,
    }, signal, appWithArtifacts(root)) as Obj;

    expect(graphResult.query).toBe("alpha.md explanation components");
    expect(graphPaths(graphResult)).toEqual(expect.arrayContaining(["alpha.md", "beta.md"]));
    expect(semanticPaths(graphResult)).toEqual([]);
    expect(semanticPaths(semanticResult)).toContain("beta.md");
  });

  it("retrieval.related exposes live Obsidian links and lexical weights as separate components", async () => {
    const root = tempVault();
    writeGraphify(root);
    writeSmartConnections(root);
    const localApp = createMockApp(new Map([
      ["alpha.md", "alpha project atlas"],
      ["beta.md", "beta project atlas neighbor"],
      ["delta.md", "newly linked live note"],
    ]), {
      vaultBasePath: root,
      resolvedLinks: {
        "alpha.md": { "beta.md": 1, "delta.md": 1 },
      },
    });

    const links = await executeOperation("retrieval.related", {
      subjectPath: "alpha.md",
      provider: "obsidian-links",
      limit: 10,
    }, signal, localApp) as Obj;
    const lexical = await executeOperation("retrieval.related", {
      subjectPath: "alpha.md",
      provider: "lexical",
      limit: 10,
    }, signal, localApp) as Obj;

    expect(graphPaths(links)).toContain("delta.md");
    expect(semanticPaths(links)).toEqual([]);
    expect(semanticPaths(lexical)).toContain("delta.md");
  });

  it("reports unavailable providers without choosing a fallback inside the connector", async () => {
    const root = tempVault();
    const localApp = createMockApp(new Map([
      ["alpha.md", "atlas topic"],
      ["beta.md", "linked topic"],
    ]), {
      vaultBasePath: root,
      resolvedLinks: { "alpha.md": { "beta.md": 1 } },
    });

    const graph = await executeOperation("retrieval.explore", {
      query: "atlas",
      provider: "graphify",
      limit: 10,
    }, signal, localApp) as Obj;
    const semantic = await executeOperation("retrieval.explore", {
      query: "atlas",
      provider: "smart-connections",
      limit: 10,
    }, signal, localApp) as Obj;
    const lexical = await executeOperation("retrieval.explore", {
      query: "atlas",
      provider: "lexical",
      limit: 10,
    }, signal, localApp) as Obj;

    expect(graph).toMatchObject({ available: false, partial: true });
    expect(semantic).toMatchObject({ available: false, partial: true });
    expect(backend(lexical, "lexical").available).toBe(true);
    expect(semanticPaths(lexical)).toContain("alpha.md");
    expect(((lexical.semanticHits as Obj[])[0]!.provider)).toBe("lexical");
  });

  it("throws INVALID_INPUT for missing trace endpoints", async () => {
    await expect(executeOperation("retrieval.trace", {}, signal, appWithArtifacts(tempVault()))).rejects.toThrow(BridgeError);
  });
});
