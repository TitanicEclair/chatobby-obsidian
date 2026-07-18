// Mock App harness for bridge executor tests.
// Provides stub implementations of Obsidian's App, Vault, Workspace, MetadataCache.
//
// Backward compatible: createMockApp(files) / createMockVault(files) /
// createMockMetadataCache() / createMockWorkspace() keep working. The optional
// second argument to createMockApp wires the richer surfaces the Phase C–E
// operations need (metadata cache, resolvedLinks, active editor view, commands,
// hotkeys, enabled plugins).

import type { App, Vault, Workspace, MetadataCache, TFile, TFolder, TAbstractFile, EventRef } from "obsidian";

// ── Mock data shapes ──────────────────────────────────────────────────

export interface MockFileCache {
  frontmatter?: Record<string, unknown>;
  tags?: Array<{ tag: string; position?: { start: { line: number }; end: { line: number } } }>;
  links?: Array<{ link: string; original?: string; position?: { start: { line: number } } }>;
  headings?: Array<{ heading: string; level: number; position?: { start: { line: number } } }>;
}

export interface MockAppOptions {
  /** Per-path metadata cache (frontmatter/tags/links/headings). */
  cache?: Map<string, MockFileCache>;
  /** resolvedLinks graph: Record<sourcePath, Record<targetPath, count>>. */
  resolvedLinks?: Record<string, Record<string, number>>;
  /** Enabled plugin ids (drives retrieval backend detection). */
  enabledPlugins?: string[];
  /** Base path returned by vault.adapter.getBasePath(). */
  vaultBasePath?: string;
  /** Optional plugin instances returned by app.plugins.getPlugin(). */
  pluginInstances?: Record<string, unknown>;
  /** Command registry contents (commands.list / commands.execute). */
  commands?: Array<{ id: string; name?: string }>;
  /** Hotkey bindings keyed by command id (hotkeys.list). */
  hotkeys?: Record<string, Array<{ modifiers: string; key: string }>>;
  /** Active markdown view for editor.* and workspace.* ops. */
  activeView?: { path: string; content?: string; cursor?: { line: number; ch: number }; selection?: string };
  /** Additional open note paths (workspace.get). */
  openNotes?: string[];
}

// ── Mock file / folder factories ──────────────────────────────────────

/** A minimal mock TFile. */
export function createMockFile(path: string, content: string, mtime = 1000, ctime = 900): TFile {
  const parts = path.split("/");
  const name = parts[parts.length - 1] ?? path;
  const dotIdx = name.lastIndexOf(".");
  const basename = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  const extension = dotIdx > 0 ? name.slice(dotIdx + 1) : "";

  return {
    path,
    name,
    basename,
    extension,
    stat: { mtime, ctime, size: content.length },
    vault: {} as Vault,
    parent: null,
  } as unknown as TFile;
}

/** A minimal mock TFolder. */
export function createMockFolder(path: string, children: TAbstractFile[]): TFolder {
  const name = path.split("/").pop() ?? path;
  return {
    path,
    name,
    children,
    isRoot: () => false,
    vault: {} as Vault,
    parent: null,
  } as unknown as TFolder;
}

// ── Mock Vault ────────────────────────────────────────────────────────

interface MockVaultState {
  files: Map<string, string>;
  fileMap: Map<string, TFile>;
  folders: Set<string>;
  binaries: Map<string, ArrayBuffer>;
}

/** Create a mock Vault with in-memory file storage. */
export function createMockVault(files: Map<string, string>, vaultBasePath = "/test-vault"): Vault & { __state: MockVaultState } {
  const fileMap = new Map<string, TFile>();
  const folders = new Set<string>();
  for (const [path, content] of files) {
    fileMap.set(path, createMockFile(path, content));
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }
  const state: MockVaultState = { files, fileMap, folders, binaries: new Map<string, ArrayBuffer>() };

  // Minimal vault event registry (modify/create/delete/rename) so tests can verify
  // listener-based cache invalidation. Real Obsidian semantics aren't needed — just
  // on/offref identity + a way to trigger callbacks from tests via __emit.
  const eventListeners = new Map<string, Array<(file: unknown) => void>>();
  const vaultOn = (name: string, cb: (file: unknown) => void): EventRef => {
    const arr = eventListeners.get(name) ?? [];
    arr.push(cb);
    eventListeners.set(name, arr);
    return { _cb: cb } as unknown as EventRef;
  };
  const vaultOffref = (ref: EventRef): void => {
    const cb = (ref as unknown as { _cb?: (file: unknown) => void })._cb;
    if (!cb) return;
    for (const [name, arr] of eventListeners) {
      eventListeners.set(name, arr.filter((fn) => fn !== cb));
    }
  };
  const vaultTrigger = (name: string, file?: unknown): void => {
    for (const cb of eventListeners.get(name) ?? []) cb(file);
  };

  const childrenOf = (folderPath: string): TAbstractFile[] => {
    const prefix = folderPath ? `${folderPath}/` : "";
    const out: TAbstractFile[] = [];
    const seen = new Set<string>();
    for (const folder of Array.from(state.folders).sort()) {
      if (!folder.startsWith(prefix)) continue;
      const rest = folder.slice(prefix.length);
      if (!rest || rest.includes("/")) continue;
      seen.add(folder);
      out.push(createMockFolder(folder, childrenOf(folder)));
    }
    for (const file of state.fileMap.values()) {
      if (!file.path.startsWith(prefix)) continue;
      const rest = file.path.slice(prefix.length);
      if (!rest || rest.includes("/") || seen.has(file.path)) continue;
      out.push(file);
    }
    return out;
  };

  const vault = {
    __state: state,
    getAbstractFileByPath(path: string): TAbstractFile | null {
      const normalized = path === "/" ? "" : path.replace(/^\/+|\/+$/g, "");
      return state.fileMap.get(normalized) ?? (state.folders.has(normalized) ? createMockFolder(normalized, childrenOf(normalized)) : null);
    },
    getRoot(): TFolder {
      return createMockFolder("", childrenOf(""));
    },
    getAllLoadedFiles(): TAbstractFile[] {
      return [createMockFolder("", childrenOf("")), ...Array.from(state.folders).map((path) => createMockFolder(path, childrenOf(path))), ...state.fileMap.values()];
    },
    async read(file: TFile): Promise<string> {
      return state.files.get(file.path) ?? "";
    },
    async cachedRead(file: TFile): Promise<string> {
      return state.files.get(file.path) ?? "";
    },
    async create(path: string, content: string): Promise<TFile> {
      if (state.files.has(path)) throw new Error("File already exists");
      state.files.set(path, content);
      const file = createMockFile(path, content);
      state.fileMap.set(path, file);
      return file;
    },
    async modify(file: TFile, content: string): Promise<void> {
      state.files.set(file.path, content);
      const existing = state.fileMap.get(file.path);
      if (existing) {
        (existing as unknown as { stat: { mtime: number; ctime: number; size: number } }).stat = {
          mtime: 2000,
          ctime: 900,
          size: content.length,
        };
      }
    },
    async process(file: TFile, callback: (content: string) => string): Promise<string> {
      const content = callback(state.files.get(file.path) ?? "");
      state.files.set(file.path, content);
      const existing = state.fileMap.get(file.path);
      if (existing) {
        (existing as unknown as { stat: { mtime: number; ctime: number; size: number } }).stat = {
          mtime: 2000,
          ctime: 900,
          size: content.length,
        };
      }
      return content;
    },
    async rename(file: TFile, newPath: string): Promise<void> {
      if (state.files.has(newPath) || state.folders.has(newPath)) throw new Error("File already exists");
      const content = state.files.get(file.path) ?? "";
      state.files.delete(file.path);
      state.fileMap.delete(file.path);
      state.files.set(newPath, content);
      const newFile = createMockFile(newPath, content);
      state.fileMap.set(newPath, newFile);
      // mutate the original handle so callers see the new path
      (file as unknown as { path: string; basename: string; name: string }).path = newPath;
      const parts = newPath.split("/");
      (file as unknown as { name: string; basename: string }).name = parts[parts.length - 1] ?? newPath;
      state.fileMap.set(newPath, file as unknown as TFile);
    },
    async trash(file: TFile): Promise<void> {
      state.files.delete(file.path);
      state.fileMap.delete(file.path);
    },
    async delete(file: TFile): Promise<void> {
      state.files.delete(file.path);
      state.fileMap.delete(file.path);
    },
    getMarkdownFiles(): TFile[] {
      return Array.from(state.fileMap.values()).filter((f) => (f as unknown as { extension: string }).extension === "md");
    },
    async readBinary(file: TFile): Promise<ArrayBuffer> {
      const stored = state.binaries.get(file.path);
      if (stored) return stored;
      const content = state.files.get(file.path) ?? "";
      return new TextEncoder().encode(content).buffer as ArrayBuffer;
    },
    async createBinary(path: string, data: ArrayBuffer): Promise<TFile> {
      if (state.files.has(path) || state.binaries.has(path)) throw new Error("File already exists");
      state.binaries.set(path, data);
      state.files.set(path, ""); // present in vault listings; content read via readBinary
      const file = createMockFile(path, "");
      state.fileMap.set(path, file);
      return file;
    },
    async createFolder(path: string): Promise<void> {
      if (state.folders.has(path) || state.fileMap.has(path)) throw new Error("Folder already exists");
      state.folders.add(path);
    },
    adapter: {
      getBasePath: () => vaultBasePath,
    },
    getName: () => "Test Vault",
    on: vaultOn,
    offref: vaultOffref,
    trigger: vaultTrigger,
    /** Test-only: emit a vault event to registered listeners. */
    __emit: vaultTrigger,
  } as unknown as Vault & { __state: MockVaultState; __emit: (name: string, file?: unknown) => void };

  return vault;
}

// ── Mock MetadataCache ────────────────────────────────────────────────

/** Create a mock MetadataCache. */
export function createMockMetadataCache(cache?: Map<string, MockFileCache>): MetadataCache & {
  resolvedLinks: Record<string, Record<string, number>>;
} {
  return {
    resolvedLinks: {},
    getFileCache(file: TFile): unknown {
      return cache?.get(file.path) ?? null;
    },
    getFirstLinkpathDest(linkpath: string, _sourcePath: string): TFile | null {
      return null; // overridden in createMockApp when a vault is available
    },
  } as unknown as MetadataCache & { resolvedLinks: Record<string, Record<string, number>> };
}

// ── Mock Workspace (with optional live editor view) ───────────────────

interface MockEditor {
  getCursor(): { line: number; ch: number };
  getCursor(side: "from" | "to"): { line: number; ch: number };
  getSelection(): string;
  getValue(): string;
  setValue(value: string): void;
  lineCount(): number;
  setCursor(pos: { line: number; ch: number }): void;
}

function createMockEditor(getContent: () => string, setContent: (s: string) => void, cursor = { line: 0, ch: 0 }, selection = ""): MockEditor {
  const state = { cursor: { ...cursor }, selection };
  return {
    getCursor: () => state.cursor,
    getSelection: () => state.selection,
    getValue: getContent,
    setValue: (v: string) => setContent(v),
    lineCount: () => getContent().split(/\r?\n/).length,
    setCursor: (pos: { line: number; ch: number }) => { state.cursor = { ...pos }; },
  };
}

/** Create a mock Workspace. */
export function createMockWorkspace(opts?: {
  activeView?: MockAppOptions["activeView"];
  openNotes?: string[];
  files?: Map<string, string>;
}): Workspace {
  interface MockLeaf {
    id: string;
    view: { editor?: MockEditor; file?: TFile; getViewType: () => string; getDisplayText: () => string };
    openFile(f: TFile): Promise<void>;
    getViewState(): { type: string; state: { file?: string }; pinned: boolean };
    setViewState(state: { type: string; state?: unknown; pinned?: boolean }): Promise<void>;
    detach(): void;
    setPinned(pinned: boolean): void;
  }
  const leaves: MockLeaf[] = [];
  let activeLeaf: MockLeaf | undefined;
  let nextLeafId = 1;

  const files = opts?.files ?? new Map<string, string>();
  const makeLeaf = (path: string, viewOpts?: MockAppOptions["activeView"]) => {
    let content = viewOpts?.content ?? files.get(path) ?? "";
    const editor = createMockEditor(
      () => content,
      (s) => { content = s; files.set(path, s); },
      viewOpts?.cursor,
      viewOpts?.selection,
    );
    let file = createMockFile(path, content);
    let viewType = "markdown";
    let pinned = false;
    const leaf = {
      id: `leaf-${nextLeafId++}`,
      view: { editor, file, getViewType: () => viewType, getDisplayText: () => file.basename },
      openFile: async (nextFile: TFile) => {
        file = nextFile;
        leaf.view.file = nextFile;
        viewType = "markdown";
      },
      getViewState: () => ({ type: viewType, state: { file: file.path }, pinned }),
      setViewState: async (state: { type: string; state?: unknown; pinned?: boolean }) => {
        viewType = state.type;
        pinned = state.pinned ?? pinned;
      },
      detach: () => {
        const index = leaves.indexOf(leaf);
        if (index >= 0) leaves.splice(index, 1);
        if (activeLeaf === leaf) activeLeaf = leaves[0];
      },
      setPinned: (nextPinned: boolean) => { pinned = nextPinned; },
    };
    return leaf;
  };

  if (opts?.activeView) {
    const leaf = makeLeaf(opts.activeView.path, opts.activeView);
    leaves.push(leaf);
    activeLeaf = leaf;
  }
  for (const path of opts?.openNotes ?? []) {
    if (!leaves.some((l) => l.view.file?.path === path)) {
      const leaf = makeLeaf(path);
      leaves.push(leaf);
      activeLeaf ??= leaf;
    }
  }

  const ws = {
    getActiveViewOfType() {
      return leaves[0]?.view ?? null;
    },
    getLeavesOfType(type: string) {
      return leaves.filter((leaf) => leaf.view.getViewType() === type);
    },
    getLeaf(...args: unknown[]) {
      if (args[0] === "tab" || args[0] === "split" || args[0] === "window") {
        const leaf = makeLeaf("temp.md");
        leaves.push(leaf);
        return leaf;
      }
      const leaf = activeLeaf ?? leaves[0] ?? makeLeaf("temp.md");
      if (!leaves.includes(leaf)) leaves.push(leaf);
      return leaf;
    },
    setActiveLeaf(leaf: unknown, _opts?: { focus?: boolean }) { activeLeaf = leaf as MockLeaf; },
    iterateAllLeaves(callback: (leaf: MockLeaf) => void) { for (const leaf of leaves) callback(leaf); },
    getLayout() {
      return {
        main: {
          id: "main-tabs",
          type: "tabs",
          currentTab: activeLeaf?.id,
          children: leaves.map((leaf) => ({ id: leaf.id, type: "leaf", state: { type: leaf.view.getViewType() } })),
        },
      };
    },
    createLeafBySplit(_source: MockLeaf) {
      const leaf = makeLeaf("temp.md");
      leaves.push(leaf);
      return leaf;
    },
    async duplicateLeaf(source: MockLeaf) {
      const leaf = makeLeaf(source.view.file?.path ?? "temp.md");
      leaves.push(leaf);
      return leaf;
    },
    openPopoutLeaf() {
      return activeLeaf ?? leaves[0] ?? makeLeaf("temp.md");
    },
    get activeLeaf() {
      return activeLeaf;
    },
  } as unknown as Workspace;
  return ws;
}

// ── Mock App ──────────────────────────────────────────────────────────

/** Create a complete mock App. */
export function createMockApp(files: Map<string, string>, opts?: MockAppOptions): App {
  const vault = createMockVault(files, opts?.vaultBasePath);
  const metadataCache = createMockMetadataCache(opts?.cache);
  if (opts?.resolvedLinks) {
    (metadataCache as unknown as { resolvedLinks: Record<string, Record<string, number>> }).resolvedLinks = opts.resolvedLinks;
  }
  // Override getFirstLinkpathDest to resolve against the vault (basename / path).
  (metadataCache as unknown as { getFirstLinkpathDest: (link: string, src: string) => TFile | null }).getFirstLinkpathDest =
    (linkpath: string) => {
      const byPath = vault.getAbstractFileByPath(linkpath);
      if (byPath && "stat" in byPath) return byPath as TFile;
      const byName = vault.getMarkdownFiles().find((f) => f.basename === linkpath || f.name === linkpath);
      return byName ?? null;
    };

  const workspace = createMockWorkspace({
    activeView: opts?.activeView,
    openNotes: opts?.openNotes,
    files,
  });

  const app = {
    vault,
    metadataCache,
    workspace,
    fileManager: {
      trashFile: (file: TFile) => (vault as unknown as { trash: (entry: TFile) => Promise<void> }).trash(file),
      getAvailablePathForAttachment: async (fileName: string) => `attachments/${fileName}`,
      generateMarkdownLink: (file: TFile) => `[[${file.path}]]`,
    },
  } as unknown as App & Record<string, unknown>;

  if (opts?.enabledPlugins || opts?.pluginInstances) {
    app.plugins = {
      enabledPlugins: new Set(opts?.enabledPlugins ?? Object.keys(opts?.pluginInstances ?? {})),
      getPlugin: (id: string) => opts?.pluginInstances?.[id] ?? null,
    };
  }
  if (opts?.commands) {
    const executed: string[] = [];
    app.commands = {
      listCommands: () => opts.commands!,
      executeCommandById: (id: string) => { executed.push(id); },
      __executed: executed,
    };
  }
  if (opts?.hotkeys) {
    app.hotkeys = { getHotkeys: (id: string) => opts.hotkeys![id] };
  }

  return app;
}
