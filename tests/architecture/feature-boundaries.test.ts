import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INITIAL_COMPOSER_STATE as publicComposerState } from "../../src/types";
import { INITIAL_COMPOSER_STATE as ownedComposerState } from "../../src/ui/composer/types";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = join(repositoryRoot, "src");

describe("frontend feature boundaries", () => {
  it("keeps test support outside the production import graph", () => {
    const testsRoot = `${resolve(repositoryRoot, "tests").replaceAll("\\", "/")}/`;
    const violations: string[] = [];
    for (const path of typescriptFiles(sourceRoot)) {
      for (const specifier of importSpecifiers(readFileSync(path, "utf8"))) {
        if (!specifier.startsWith(".")) continue;
        const target = resolve(dirname(path), specifier).replaceAll("\\", "/");
        if (target.startsWith(testsRoot)) violations.push(`${relative(repositoryRoot, path)} -> ${specifier}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps the manifest and settings headings compatible with community review", () => {
    const manifest = JSON.parse(readFileSync(join(repositoryRoot, "manifest.json"), "utf8")) as {
      description?: unknown;
    };
    expect(typeof manifest.description).toBe("string");
    expect(manifest.description).not.toMatch(/\bobsidian\b/i);

    const settings = [
      "settings.ts",
      "features/settings/ui/settings-view.ts",
      "features/settings/ui/runtime-section.ts",
      "features/settings/ui/document-section.ts",
      "features/settings/ui/display-section.ts",
      "features/settings/ui/provider-section.ts",
      "features/settings/ui/credential-modals.ts",
    ].map(path => readFileSync(join(sourceRoot, path), "utf8")).join("\n");
    expect(settings).not.toMatch(/\.createEl\(["']h[1-6]["']/);
    expect(settings).not.toMatch(/\.setName\(["']Chatobby["']\)[\s\S]{0,80}\.setHeading\(\)/);
    expect(settings.match(/\.setHeading\(\)/g)).toHaveLength(6);
  });

  it("prevents source outside the feed feature from deep-importing feed internals", () => {
    const violations = typescriptFiles(sourceRoot).flatMap(path =>
      featureImportViolations(relative(repositoryRoot, path).replaceAll("\\", "/"), readFileSync(path, "utf8"))
        .filter(violation => violation.includes("features/feed/")),
    );
    expect(violations).toEqual([]);
  });

  it("prevents source outside any feature from deep-importing that feature", () => {
    const violations = typescriptFiles(sourceRoot).flatMap((path) =>
      featureImportViolations(relative(repositoryRoot, path).replaceAll("\\", "/"), readFileSync(path, "utf8")),
    );
    expect(violations).toEqual([]);
  });

  // The settings owner guide explains why compatibility exports avoid the UI barrel.
  it("allows only the named settings compatibility exports, never a private-import exemption", () => {
    const defaults = 'export { DEFAULT_COMPOSER_KEYBINDINGS, DEFAULT_PLUGIN_SETTINGS } from "./features/settings/domain/settings";';
    const types = 'export type { ComposerKeybindings, PluginSettings, ThinkingDisplay } from "./features/settings/domain/settings";';
    const store = 'export { SettingsStore } from "../features/settings/infrastructure/settings-store";';
    expect(featureImportViolations("src/types.ts", `${defaults}\n${types}`)).toEqual([]);
    // A local named export ends before the next module export; do not join statements.
    expect(featureImportViolations("src/types.ts", `export type { Existing };\n${defaults}`)).toEqual([]);
    expect(featureImportViolations("src/state/settings-store.ts", store)).toEqual([]);
    for (const source of [
      defaults.replace("export", "import"),
      `${defaults}\n${defaults.replace("export", "import")}`,
      defaults.replace("{ DEFAULT_COMPOSER_KEYBINDINGS, DEFAULT_PLUGIN_SETTINGS }", "*"),
      defaults.replace("DEFAULT_PLUGIN_SETTINGS }", "DEFAULT_PLUGIN_SETTINGS, Extra }"),
      defaults.replace("DEFAULT_PLUGIN_SETTINGS }", "DEFAULT_PLUGIN_SETTINGS as AnotherName }"),
      defaults.replace("domain/settings", "infrastructure/settings-store"),
    ]) expect(featureImportViolations("src/types.ts", source)).not.toEqual([]);
    expect(featureImportViolations("src/another.ts", defaults)).not.toEqual([]);
    expect(featureImportViolations("src/state/settings-store.ts", store.replace("export", "import"))).not.toEqual([]);
  });

  it("keeps settings declarations independent of the compatibility hub, UI and persistence", () => {
    const source = readFileSync(join(sourceRoot, "features/settings/domain/settings.ts"), "utf8");
    expect(importSpecifiers(source)).toEqual(["../../../vendor/chatobby-client/connector-types.js"]);
  });

  /** @see src/features/README.md — data-only facade exceptions remain exact exports. */
  it("preserves exact feed/session facade exports and rejects imports, aliases and extra names", () => {
    const facade = readFileSync(join(sourceRoot, "types.ts"), "utf8");
    const declarations = moduleReferences(facade).filter(entry => /features\/(feed|session)\/domain\//.test(entry.specifier));
    expect(declarations).toHaveLength(5);
    for (const { statement } of declarations) {
      expect(featureImportViolations("src/types.ts", statement)).toEqual([]);
      for (const changed of [
        statement.replace(/^export/, "import"),
        statement.replace(/\{[^}]+\}/, "*"),
        statement.replace(/\s*}/, ", Extra }"),
        statement.replace(/\s*}/, " as Renamed }"),
      ]) expect(featureImportViolations("src/types.ts", changed)).not.toEqual([]);
      expect(featureImportViolations("src/elsewhere.ts", statement)).not.toEqual([]);
    }
  });

  it("keeps local model leaves independent of the root hub and UI-bearing barrels", () => {
    const owners: Record<string, readonly string[]> = {
      "features/feed/domain/presentation.ts": ["../../../vendor/chatobby-client/frontend-contracts.js"],
      "features/session/domain/preferences.ts": ["../../../vendor/chatobby-client/wire-types.js"],
      "features/session/domain/state.ts": ["../../../vendor/chatobby-client/wire-types.js", "../../../vendor/chatobby-client/connector-types.js"],
      "prompt/types.ts": [],
    };
    for (const [path, allowed] of Object.entries(owners)) {
      const dependencies = importSpecifiers(readFileSync(join(sourceRoot, path), "utf8"));
      expect(dependencies, path).toEqual(allowed);
      for (const forbidden of ["../../../types", "../public", "obsidian", "../../../ui/view"]) {
        expect(importSpecifiers(`import type { Extra } from "${forbidden}";`).filter(name => !allowed.includes(name))).toEqual([forbidden]);
      }
    }
  });

  // docs/api/composer.md names the instance state, submission and DOM owners.
  it("keeps Composer owners independent of their facade and compatibility type hub", () => {
    expect(publicComposerState).toBe(ownedComposerState);
    for (const [path, allowed] of Object.entries(composerOwnerDependencies)) {
      const source = readFileSync(join(sourceRoot, "ui/composer", path), "utf8");
      expect(importSpecifiers(source).filter(specifier => !allowed.includes(specifier)), path).toEqual([]);
      for (const forbidden of ["./composer", "../../types", "../../ui/view"]) {
        expect(importSpecifiers(`import type { Extra } from "${forbidden}";`)
          .filter(specifier => !allowed.includes(specifier)), path).toEqual([forbidden]);
      }
    }
    const facade = readFileSync(join(sourceRoot, "types.ts"), "utf8");
    const entries = moduleReferences(facade).filter(entry => entry.specifier === "./ui/composer/types");
    expect(entries.map(entry => entry.statement.replace(/\s+/g, " "))).toEqual([
      'export { INITIAL_COMPOSER_STATE } from "./ui/composer/types"',
      'export type { ComposerState, ComposerAttachmentDelivery, ComposerAttachment } from "./ui/composer/types"',
    ]);
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

  it("keeps permission identities and request metadata independent of UI and effects", () => {
    const violations: string[] = [];
    for (const path of typescriptFiles(join(sourceRoot, "features", "permissions", "domain"))) {
      for (const specifier of importSpecifiers(readFileSync(path, "utf8"))) {
        const target = resolve(dirname(path), specifier).replaceAll("\\", "/");
        if (specifier === "obsidian" || /\/(ui|application|frontend)\//.test(target)) {
          violations.push(`${relative(repositoryRoot, path)} -> ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps semantic theme variables centralized in the token layer", () => {
    const tokenPath = join(sourceRoot, "ui", "shared", "tokens.css");
    const violations: string[] = [];
    for (const path of filesWithExtension(sourceRoot, ".css")) {
      if (path === tokenPath) continue;
      const source = readFileSync(path, "utf8");
      const rawVariables = [...source.matchAll(/var\(--(?:background-|interactive-|text-(?:accent|error|warning)|color-)[^)]+\)/g)];
      for (const match of rawVariables) violations.push(`${relative(repositoryRoot, path)}: ${match[0]}`);
    }
    expect(violations).toEqual([]);
  });

  it("uses complete Obsidian font stacks instead of bare theme families", () => {
    const violations: string[] = [];
    for (const path of filesWithExtension(sourceRoot, ".css")) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/font-family:\s*var\(--font-(?:interface|monospace)-theme\)/gu)) {
        violations.push(`${relative(repositoryRoot, path)}: ${match[0]}`);
      }
    }
    expect(violations).toEqual([]);

    const shell = readFileSync(join(sourceRoot, "ui", "shell", "shell.css"), "utf8");
    expect(shell).toContain("font-family: var(--font-interface, system-ui, sans-serif);");
    const tools = readFileSync(join(sourceRoot, "ui", "feed", "tools", "tools.css"), "utf8");
    expect(tools).toContain("font-family: var(--font-monospace, ui-monospace, monospace);");
  });

  it("keeps the memory screen on one vertical scroll owner with responsive tabs", () => {
    const css = readFileSync(join(sourceRoot, "features", "memory", "ui", "memory-view.css"), "utf8");
    const shellCss = readFileSync(join(sourceRoot, "ui", "shared", "page-shell.css"), "utf8");
    expect(shellCss).toMatch(/\.chatobby-page\s*\{[^}]*overflow:\s*hidden;/s);
    expect(shellCss).toMatch(/\.chatobby-page__body\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(shellCss).toMatch(/\.chatobby-page__tabs\s*\{[^}]*overflow-x:\s*auto;/s);
    expect(css).toMatch(/\.chatobby-memory__record-summary\s*\{[^}]*height:\s*auto;/s);
    expect(css).toMatch(/\.chatobby-memory__record-content\s*\{[^}]*-webkit-line-clamp:\s*2;/s);
    expect(css).toMatch(/\.chatobby-memory__records\s*\{[^}]*display:\s*grid;[^}]*gap:/s);
    expect(css).toContain("@container chatobby-page (max-width: 620px)");
    const imports: readonly string[] = readFileSync(join(sourceRoot, "ui", "styles.css"), "utf8").match(/@import[^;]+;/g) ?? [];
    const memoryIndex = imports.indexOf('@import "../features/memory/ui/memory-view.css";');
    expect(memoryIndex).toBeGreaterThan(0);
    expect(imports.slice(memoryIndex - 1, memoryIndex + 2)).toEqual([
      '@import "./feed/tools/tools.css";',
      '@import "../features/memory/ui/memory-view.css";',
      '@import "../features/permissions/ui/permissions-view.css";',
    ]);
  });

  it("keeps the subagent screen on one vertical scroll owner with responsive management panes", () => {
    const css = readFileSync(join(sourceRoot, "features", "subagents", "ui", "subagents.css"), "utf8");
    const shellCss = readFileSync(join(sourceRoot, "ui", "shared", "page-shell.css"), "utf8");
    expect(shellCss).toMatch(/\.chatobby-page\s*\{[^}]*overflow:\s*hidden;/s);
    expect(shellCss).toMatch(/\.chatobby-page__body\s*\{[^}]*overflow-y:\s*auto;/s);
    expect(css).toContain('.chatobby-view[data-layout="compact"] .chatobby-subagents__run-layout');
    expect(css).toContain("grid-template-columns: 1fr;");
    expect(css).toMatch(/\.chatobby-subagents__run-filters\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  });

  it("keeps full-screen feature pages on the shared stable page shell", () => {
    const pages = [
      ["features", "memory", "ui", "memory-view.ts"],
      ["features", "permissions", "ui", "permissions-view.ts"],
      ["features", "events", "ui", "events-view.ts"],
      ["features", "channels", "ui", "channels-view.ts"],
      ["features", "subagents", "ui", "subagents-view.ts"],
      ["features", "projects", "ui", "projects-view.ts"],
      ["features", "settings", "application", "settings-screen-controller.ts"],
    ];
    for (const segments of pages) {
      expect(readFileSync(join(sourceRoot, ...segments), "utf8")).toContain("new PageShell(");
    }
  });

  it("keeps shared page hierarchy styling out of page-specific stylesheets", () => {
    const sharedShellPath = join(sourceRoot, "ui", "shared", "page-shell.css");
    const violations: string[] = [];
    for (const path of filesWithExtension(sourceRoot, ".css")) {
      if (path === sharedShellPath) continue;
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(
        /\.chatobby-page__(?:header|title|tabs|status|body|section(?:-[a-z-]+)?)(?![a-z-])/gu,
      )) {
        violations.push(`${relative(repositoryRoot, path)}: ${match[0]}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps focused reducers and extracted controllers within reviewable size limits", () => {
    const violations: string[] = [];
    const roots = [
      join(sourceRoot, "features", "feed", "state", "reducers"),
      join(sourceRoot, "ui", "controller"),
      join(sourceRoot, "ui", "screens"),
      join(sourceRoot, "features", "permissions", "application"),
      join(sourceRoot, "features", "mcp", "ui", "editor"),
      join(sourceRoot, "features", "mcp", "ui", "controls"),
      join(sourceRoot, "features", "mcp", "ui", "catalogue"),
      join(sourceRoot, "features", "mcp", "ui", "detail"),
      join(sourceRoot, "obsidian-context"),
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
      ["src/ui/composer/composer.ts", { max: 920, reason: "Bound input, keyboard/interaction/slash routing and ordered DOM restore; instance draft/submission state and attachment presentation have separate owners." }],
      ["src/ui/composer/references/controller.ts", { max: 520, reason: "One bound reference menu, selected chips and keyboard overflow panel with their asynchronous search, frame and resize lifetime; no submission or durable state." }],
      ["src/features/mcp/ui/mcp-view.ts", { max: 550, reason: "PageShell lifecycle, navigation/search state, editor identity and runtime intent completion; catalogue/detail DOM and controls have separate owners." }],
      ["src/features/mcp/ui/plugin-summary.ts", { max: 180, reason: "Shared row/detail identity and metadata presentation; no navigation state or runtime actions." }],
      ["src/ui/view.ts", { max: 1450, reason: "Obsidian lifecycle and public command adapter; coordinates native leaf navigation, ribbon screens, Project launches, and session-local feed notices while stateful policies live in controllers." }],
      ["src/ui/feed/index.ts", { max: 650, reason: "Commit-driven DOM adapter with block-specific view construction and reader scroll-intent tracking (detaches on upward motion, re-pins via ResizeObserver on late content growth) so streaming never yanks a scrolled-up view back to the bottom." }],
      ["src/features/memory/ui/memory-view.ts", { max: 650, reason: "Stateful library/detail editor with runtime-projected target/policy controls; filter rendering and screen lifecycle have separate owners." }],
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
      ...typescriptFiles(join(sourceRoot, "ui", "composer")),
      join(sourceRoot, "attachments", "attachment-store.ts"),
      ...typescriptFiles(join(sourceRoot, "obsidian-context")),
      ...typescriptFiles(join(sourceRoot, "prompt")),
      ...typescriptFiles(join(sourceRoot, "obsidian-bridge", "browser")),
      join(sourceRoot, "obsidian-bridge", "operations", "browser-operations.ts"),
      join(sourceRoot, "obsidian-bridge", "operations", "browser-read.ts"),
      join(sourceRoot, "types.ts"),
      join(sourceRoot, "settings.ts"),
      join(sourceRoot, "state", "settings-store.ts"),
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

  it("keeps browser observation, webview and read adapters in bounded modules", () => {
    const modules = [
      "browser/console-capture.ts", "browser/webview.ts", "browser/tab-state.ts",
      "browser/read-pagination.ts", "operations/browser-operations.ts", "operations/browser-read.ts",
    ];
    for (const module of modules) {
      const path = join(sourceRoot, "obsidian-bridge", module);
      expect(readFileSync(path, "utf8").split(/\r?\n/).length, module).toBeLessThanOrEqual(400);
    }
  });
});

const composerOwnerDependencies: Readonly<Record<string, readonly string[]>> = {
  "draft-state.ts": ["../../attachments/attachment-store", "./types", "./slash-command", "./references/search"],
  "submission-lifecycle.ts": ["./draft-state", "./types", "./slash-command", "./references/search"],
  "attachment-presentation.ts": ["obsidian", "../../attachments/attachment-store", "../attachments/attachment-presentation", "./types", "./draft-state"],
  "types.ts": ["../../vendor/chatobby-client/connector-types.js", "./slash-command", "./references/search"],
};

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
  return moduleReferences(source).map(({ specifier }) => specifier);
}

function moduleReferences(source: string): { statement: string; specifier: string }[] {
  const matches = source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"';]+?\s+from\s+)?["']([^"']+)["']/g);
  return [...matches].flatMap((match) => match[1] ? [{ statement: match[0], specifier: match[1] }] : []);
}

function featureImportViolations(path: string, source: string): string[] {
  // Exact legacy facades may re-export only these owner declarations. Ordinary
  // feature consumers still use public.ts; imports and wildcard exports fail.
  const compatibilityExports: Readonly<Record<string, readonly string[]>> = {
    "src/types.ts": [
      "export type { TextContent, ImageContent, AttachmentContent, UserMessage, StopReason, ToolItemStatus, ToolCategory, ToolItem, BlockStatus, ThinkingDisplayMode, ThinkingBlock, ToolBlock, TextBlock, UserBlock, SystemBlock, TurnSummary, QueuedMessageBlock, DividerBlock, SubagentEventChannel, SubagentActivityStatus, SubagentTokenUsage, SubagentActivity, SubagentBlock, SubagentCommunicationBlock, ExtensionPanelBlock, ExtensionPanelAction, FeedBlock } from \"./features/feed/domain/presentation\"",
      "export { DEFAULT_SESSION_PREFERENCES } from \"./features/session/domain/preferences\"",
      "export type { SessionPreferences, PermissionMode } from \"./features/session/domain/preferences\"",
      "export { DEFAULT_AUTO_COMPACTION_THRESHOLD_PERCENT, EMPTY_SESSION_STATE } from \"./features/session/domain/state\"",
      "export type { WsSessionState, SessionState, SessionListItem, SessionEvent } from \"./features/session/domain/state\"",
      'export { DEFAULT_COMPOSER_KEYBINDINGS, DEFAULT_PLUGIN_SETTINGS } from "./features/settings/domain/settings"',
      'export type { ComposerKeybindings, PluginSettings, ThinkingDisplay } from "./features/settings/domain/settings"',
    ],
    "src/state/settings-store.ts": [
      'export { SettingsStore } from "../features/settings/infrastructure/settings-store"',
    ],
  };
  const violations: string[] = [];
  for (const { statement, specifier } of moduleReferences(source)) {
    const match = specifier.match(/features\/([^/]+)\/(.+)$/);
    const feature = match?.[1];
    const tail = match?.[2];
    if (!feature || tail === "public" || path.startsWith(`src/features/${feature}/`)) continue;
    if (compatibilityExports[path]?.includes(statement.replace(/\s+/g, " "))) continue;
    violations.push(`${path} -> ${specifier}`);
  }
  return violations;
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
