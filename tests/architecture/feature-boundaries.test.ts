import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = join(repositoryRoot, "src");

describe("frontend feature boundaries", () => {
  it("prevents source outside the feed feature from deep-importing feed internals", () => {
    const violations: string[] = [];
    for (const path of typescriptFiles(sourceRoot)) {
      const normalized = path.replaceAll("\\", "/");
      if (normalized.includes("/src/features/feed/")) continue;
      const source = readFileSync(path, "utf8");
      for (const specifier of importSpecifiers(source)) {
        if (!specifier.includes("features/feed/")) continue;
        if (specifier.endsWith("features/feed/public")) continue;
        violations.push(`${relative(repositoryRoot, path)} -> ${specifier}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("prevents source outside any feature from deep-importing that feature", () => {
    const violations: string[] = [];
    for (const path of typescriptFiles(sourceRoot)) {
      const normalizedPath = path.replaceAll("\\", "/");
      const source = readFileSync(path, "utf8");
      for (const specifier of importSpecifiers(source)) {
        const match = specifier.match(/features\/([^/]+)\/(.+)$/);
        if (!match) continue;
        const feature = match[1];
        const tail = match[2];
        if (!feature || tail === "public" || normalizedPath.includes(`/src/features/${feature}/`)) continue;
        violations.push(`${relative(repositoryRoot, path)} -> ${specifier}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps feed domain and state modules independent from Obsidian and DOM presentation", () => {
    const violations: string[] = [];
    for (const folder of ["domain", "state"]) {
      const root = join(sourceRoot, "features", "feed", folder);
      for (const path of typescriptFiles(root)) {
        const source = readFileSync(path, "utf8");
        for (const specifier of importSpecifiers(source)) {
          if (specifier === "obsidian" || specifier.includes("/presentation/")) {
            violations.push(`${relative(repositoryRoot, path)} -> ${specifier}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps deleted legacy feed modules out of the import graph", () => {
    const violations = typescriptFiles(sourceRoot).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return importSpecifiers(source)
        .filter((specifier) => specifier.endsWith("feed-reducer") || specifier.endsWith("feed-render-store"))
        .map((specifier) => `${relative(repositoryRoot, path)} -> ${specifier}`);
    });
    expect(violations).toEqual([]);
  });

  it("keeps semantic theme variables centralized in the token layer", () => {
    const tokenPath = join(sourceRoot, "ui", "shared", "tokens.css");
    const violations: string[] = [];
    for (const path of filesWithExtension(join(sourceRoot, "ui"), ".css")) {
      if (path === tokenPath) continue;
      const source = readFileSync(path, "utf8");
      const rawVariables = [...source.matchAll(/var\(--(?:background-|interactive-|text-(?:accent|error|warning)|color-)[^)]+\)/g)];
      for (const match of rawVariables) violations.push(`${relative(repositoryRoot, path)}: ${match[0]}`);
    }
    expect(violations).toEqual([]);
  });

  it("keeps the memory screen on one vertical scroll owner with responsive tabs", () => {
    const css = readFileSync(join(sourceRoot, "ui", "memory", "memory-view.css"), "utf8");
    expect(css).toMatch(/\.chatobby-memory-view\s*\{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.chatobby-memory__body\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/\.chatobby-memory__tabs\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.chatobby-memory__record-summary\s*\{[^}]*height:\s*auto;/s);
    expect(css).toMatch(/\.chatobby-memory__record-content\s*\{[^}]*-webkit-line-clamp:\s*3;/s);
    expect(css).toContain('.chatobby-view[data-layout="compact"] .chatobby-memory__setting-row');
  });

  it("keeps the subagent screen on one vertical scroll owner with responsive management panes", () => {
    const css = readFileSync(join(sourceRoot, "features", "subagents", "ui", "subagents.css"), "utf8");
    expect(css).toMatch(/\.chatobby-subagents\s*\{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.chatobby-subagents__body\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(css).toContain('.chatobby-view[data-layout="compact"] .chatobby-subagents__run-layout');
    expect(css).toContain("grid-template-columns: 1fr;");
  });

  it("keeps focused reducers and extracted controllers within reviewable size limits", () => {
    const violations: string[] = [];
    const roots = [
      join(sourceRoot, "features", "feed", "state", "reducers"),
      join(sourceRoot, "ui", "controller"),
      join(sourceRoot, "ui", "screens"),
    ];
    for (const root of roots) {
      for (const path of typescriptFiles(root)) {
        const lines = readFileSync(path, "utf8").split(/\r?\n/).length;
        if (lines > 400) violations.push(`${relative(repositoryRoot, path)} has ${lines} lines`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("documents the temporary size ceilings for lifecycle adapters", () => {
    const ceilings = new Map<string, { max: number; reason: string }>([
      ["src/ui/view.ts", { max: 1400, reason: "Obsidian lifecycle and public command adapter; coordinates native leaf navigation, ribbon screens, and session-local feed notices while stateful policies live in controllers." }],
      ["src/ui/feed/index.ts", { max: 650, reason: "Commit-driven DOM adapter with block-specific view construction and reader scroll-intent tracking (detaches on upward motion, re-pins via ResizeObserver on late content growth) so streaming never yanks a scrolled-up view back to the bottom." }],
      ["src/ui/memory/memory-view.ts", { max: 650, reason: "Stateful library/detail coordinator; operations and policy sections are extracted." }],
      ["src/features/feed/state/feed-transaction.ts", { max: 500, reason: "Atomic reducer capability surface with private normalized state." }],
    ]);
    const violations: string[] = [];
    for (const [relativePath, ceiling] of ceilings) {
      expect(ceiling.reason.length).toBeGreaterThan(20);
      const lines = readFileSync(join(repositoryRoot, relativePath), "utf8").split(/\r?\n/).length;
      if (lines > ceiling.max) violations.push(`${relativePath} has ${lines} lines; ceiling is ${ceiling.max}`);
    }
    expect(violations).toEqual([]);
  });

  it("contains no relative TypeScript import cycles", () => {
    const files = [
      ...typescriptFiles(join(sourceRoot, "features")),
      ...typescriptFiles(join(sourceRoot, "ui", "controller")),
      ...typescriptFiles(join(sourceRoot, "ui", "screens")),
    ];
    const fileSet = new Set(files.map((path) => resolve(path)));
    const graph = new Map<string, string[]>();
    for (const path of files) {
      const dependencies = importSpecifiers(readFileSync(path, "utf8"))
        .filter((specifier) => specifier.startsWith("."))
        .map((specifier) => resolveImport(path, specifier))
        .filter((candidate): candidate is string => candidate !== null && fileSet.has(candidate));
      graph.set(resolve(path), dependencies);
    }
    expect(findCycles(graph).map((cycle) => cycle.map((path) => relative(repositoryRoot, path)))).toEqual([]);
  });
});

function typescriptFiles(root: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...typescriptFiles(path));
    else if (name.endsWith(".ts")) files.push(path);
  }
  return files;
}

function filesWithExtension(root: string, extension: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...filesWithExtension(path, extension));
    else if (extname(name) === extension) files.push(path);
  }
  return files;
}

function importSpecifiers(source: string): string[] {
  const matches = source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g);
  return [...matches].map((match) => match[1]).filter((value): value is string => value !== undefined);
}

function resolveImport(importer: string, specifier: string): string | null {
  const base = resolve(dirname(importer), specifier);
  for (const candidate of [`${base}.ts`, join(base, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return resolve(candidate);
    } catch {
      // Missing candidates are external to the source graph.
    }
  }
  return null;
}

function findCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const visit = (node: string): void => {
    if (active.has(node)) {
      const index = stack.indexOf(node);
      cycles.push([...stack.slice(index), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    stack.pop();
    active.delete(node);
  };
  for (const node of graph.keys()) visit(node);
  return cycles;
}
