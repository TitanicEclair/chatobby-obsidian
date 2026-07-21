import { Menu, Notice, setIcon } from "obsidian";
import type { SessionListItem } from "../../types";
import type { ChatobbyTransport } from "../../transport/ws-client";
import { errorMessage } from "../../utils";
import { ChatobbyComponent } from "../shared/component";
import type { SessionDirectoryOption } from "./session-directory";
import type { SessionAdvancedAction } from "./session-maintenance";

export interface SessionPickerProps {
  getTransport: () => Promise<Pick<ChatobbyTransport, "listSessions"> | null>;
  directories?: readonly SessionDirectoryOption[];
  getDirectories?: () => readonly SessionDirectoryOption[];
  initialDirectoryPath: string;
  onSelect: (path: string, directory: SessionDirectoryOption) => Promise<void>;
  onUseDirectory: (directory: SessionDirectoryOption) => void;
  onCreateSession: (directory: SessionDirectoryOption) => Promise<void>;
  onDelete: (session: SessionListItem) => Promise<void>;
  onAdvancedAction: (session: SessionListItem, directory: SessionDirectoryOption, action: SessionAdvancedAction) => Promise<void>;
}

type PickerState =
  | { status: "loading"; sessions: SessionListItem[] }
  | { status: "ready"; sessions: SessionListItem[] }
  | { status: "error"; sessions: SessionListItem[]; message: string };

/** Two-pane browser for vault directories and their persisted Chatobby sessions. */
export class SessionPickerComponent extends ChatobbyComponent {
  private state: PickerState = { status: "loading", sessions: [] };
  private query = "";
  private selected = 0;
  private searchInput: HTMLInputElement | null = null;
  private directory: SessionDirectoryOption;
  private loadSequence = 0;
  private readonly rootCwd: string;
  private operation: "resuming" | "creating" | "maintaining" | null = null;
  private readonly expandedDirectories = new Set<string>();
  private directories: readonly SessionDirectoryOption[];

  constructor(private readonly props: SessionPickerProps) {
    super();
    this.directories = this.readDirectories();
    const selected = this.directories.find((item) => item.vaultDirectoryPath === props.initialDirectoryPath);
    this.directory = selected ?? this.directories[0] ?? {
      vaultDirectoryPath: "",
      cwd: "",
      label: "Vault /",
    };
    this.rootCwd = this.directories[0]?.cwd ?? this.directory.cwd;
    for (const path of ancestorDirectoryPaths(this.directory.vaultDirectoryPath)) {
      this.expandedDirectories.add(path);
    }
  }

  move(delta: 1 | -1): void {
    const sessions = this.filteredSessions();
    if (sessions.length === 0) return;
    this.selected = (this.selected + delta + sessions.length) % sessions.length;
    this.renderSessions();
  }

  refresh(): void {
    this.refreshDirectories();
    void this.loadSessions();
  }

  current(): SessionListItem | null {
    return this.filteredSessions()[this.selected] ?? null;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.move(1);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.move(-1);
      return true;
    }
    if (event.key === "Enter") {
      const session = this.current();
      if (!session) return false;
      event.preventDefault();
      void this.resumeSession(session);
      return true;
    }
    if (event.key === "ArrowLeft") {
      if (!this.expandedDirectories.has(this.directory.vaultDirectoryPath)) return false;
      event.preventDefault();
      this.expandedDirectories.delete(this.directory.vaultDirectoryPath);
      this.renderDirectories();
      return true;
    }
    if (event.key === "ArrowRight") {
      if (this.expandedDirectories.has(this.directory.vaultDirectoryPath)) return false;
      event.preventDefault();
      this.expandedDirectories.add(this.directory.vaultDirectoryPath);
      this.renderDirectories();
      return true;
    }
    return false;
  }

  protected componentClass(): string {
    return "chatobby-session-picker";
  }

  protected onRender(container: HTMLElement): void {
    this.renderShell(container);
    void this.loadSessions();
  }

  private readDirectories(): readonly SessionDirectoryOption[] {
    return this.props.getDirectories?.() ?? this.props.directories ?? [];
  }

  private refreshDirectories(): void {
    const next = this.readDirectories();
    const selected = next.find((directory) => directory.vaultDirectoryPath === this.directory.vaultDirectoryPath);
    this.directories = next;
    this.directory = selected ?? nearestExistingDirectory(next, this.directory.vaultDirectoryPath) ?? next[0] ?? this.directory;
    for (const path of ancestorDirectoryPaths(this.directory.vaultDirectoryPath)) this.expandedDirectories.add(path);
    this.renderDirectories();
  }

  private async loadSessions(): Promise<void> {
    const sequence = ++this.loadSequence;
    if (this.state.status !== "ready") {
      this.state = { status: "loading", sessions: [] };
      this.renderSessions();
    }
    try {
      const transport = await this.props.getTransport();
      if (!transport) throw new Error("Chatobby backend is not connected");
      const sessions = await transport.listSessions(this.rootCwd, true);
      if (sequence !== this.loadSequence) return;
      this.state = { status: "ready", sessions };
    } catch (error) {
      if (sequence !== this.loadSequence) return;
      this.state = { status: "error", sessions: [], message: errorMessage(error) };
    }
    this.selected = 0;
    this.renderDirectories();
    this.renderSessions();
  }

  private renderShell(container: HTMLElement): void {
    container.empty();
    const header = container.createDiv({ cls: "chatobby-session-picker__header" });
    header.createDiv({ cls: "chatobby-session-picker__title", text: "Sessions" });
    const directoryActions = header.createDiv({ cls: "chatobby-session-picker__directory-actions" });
    const useDirectory = directoryActions.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": "Use selected working directory", title: "Use selected working directory" },
    });
    setIcon(useDirectory, "folder-check");
    useDirectory.addEventListener("click", () => this.props.onUseDirectory(this.directory));
    const create = directoryActions.createEl("button", {
      cls: "clickable-icon",
      attr: { type: "button", "aria-label": "New session in selected directory", title: "New session here" },
    });
    setIcon(create, "message-square-plus");
    create.addEventListener("click", () => void this.createSession());

    this.searchInput = container.createEl("input", {
      cls: "chatobby-session-picker__search",
      attr: { type: "search", placeholder: "Search folders and sessions", "aria-label": "Search folders and sessions" },
    });
    this.searchInput.addEventListener("input", () => {
      this.query = this.searchInput?.value ?? "";
      this.selected = 0;
      this.renderDirectories();
      this.renderSessions();
    });

    const workspace = container.createDiv({ cls: "chatobby-session-picker__workspace" });
    const directories = workspace.createDiv({ cls: "chatobby-session-picker__directories", attr: { "aria-label": "Working directories" } });
    this.renderDirectoryTree(directories);
    workspace.createDiv({ cls: "chatobby-session-picker__body" });
    container.createDiv({ cls: "chatobby-session-picker__hint", text: "Select a folder to browse its sessions · ↑↓ navigate · ↵ resume · use Obsidian Back to return" });
    requestAnimationFrame(() => this.searchInput?.focus());
    this.renderSessions();
  }

  private selectDirectory(directory: SessionDirectoryOption): void {
    if (directory.vaultDirectoryPath === this.directory.vaultDirectoryPath) return;
    this.directory = directory;
    for (const path of ancestorDirectoryPaths(directory.vaultDirectoryPath)) this.expandedDirectories.add(path);
    this.selected = 0;
    this.renderDirectories();
    this.renderSessions();
  }

  private renderDirectories(): void {
    const directories = this.container?.querySelector<HTMLElement>(".chatobby-session-picker__directories");
    if (!directories) return;
    directories.empty();
    this.renderDirectoryTree(directories);
  }

  private renderDirectoryTree(host: HTMLElement): void {
    const byParent = new Map<string, SessionDirectoryOption[]>();
    for (const directory of this.directories) {
      const parent = parentDirectoryPath(directory.vaultDirectoryPath);
      byParent.set(parent, [...(byParent.get(parent) ?? []), directory]);
    }
    const visiblePaths = this.visibleDirectoryPaths();
    const renderBranch = (directory: SessionDirectoryOption, container: HTMLElement): void => {
      if (!visiblePaths.has(directory.vaultDirectoryPath)) return;
      const branch = container.createDiv({ cls: "chatobby-session-picker__directory-branch" });
      const count = this.sessionsForDirectory(directory).length;
      const row = branch.createDiv({ cls: "chatobby-session-picker__directory-row" });
      const children = (byParent.get(directory.vaultDirectoryPath) ?? [])
        .filter((child) => child.vaultDirectoryPath !== directory.vaultDirectoryPath && visiblePaths.has(child.vaultDirectoryPath));
      const expanded = this.query.trim().length > 0 || this.expandedDirectories.has(directory.vaultDirectoryPath);
      if (children.length > 0) {
        const disclosure = row.createEl("button", {
          cls: "chatobby-session-picker__disclosure clickable-icon",
          attr: {
            type: "button",
            "aria-label": `${expanded ? "Collapse" : "Expand"} ${directoryName(directory, this.directories[0]?.label ?? "Vault")}`,
            "aria-expanded": String(expanded),
          },
        });
        setIcon(disclosure, expanded ? "chevron-down" : "chevron-right");
        disclosure.addEventListener("click", () => this.toggleDirectory(directory.vaultDirectoryPath));
      } else row.createSpan({ cls: "chatobby-session-picker__disclosure-spacer" });
      const button = row.createEl("button", {
        cls: `chatobby-session-picker__directory${count > 0 ? " has-sessions" : ""}`,
        attr: {
          type: "button",
          title: directory.cwd,
          "data-directory-path": directory.vaultDirectoryPath,
        },
      });
      button.dataset.directoryPath = directory.vaultDirectoryPath;
      const icon = button.createSpan({ cls: "chatobby-session-picker__directory-icon" });
      setIcon(icon, count > 0 ? "folder-clock" : "folder");
      button.createSpan({
        cls: "chatobby-session-picker__directory-name",
        text: directoryName(directory, this.directories[0]?.label ?? "Vault"),
      });
      if (count > 0) button.createSpan({ cls: "chatobby-session-picker__directory-count", text: String(count) });
      button.toggleClass("is-active", directory.vaultDirectoryPath === this.directory.vaultDirectoryPath);
      button.addEventListener("click", () => this.selectDirectory(directory));
      if (expanded && children.length > 0) {
        const childrenHost = branch.createDiv({ cls: "chatobby-session-picker__directory-children" });
        for (const child of children) renderBranch(child, childrenHost);
      }
    };
    const root = this.directories.find((directory) => directory.vaultDirectoryPath === "");
    if (root) renderBranch(root, host);
    else for (const directory of byParent.get("") ?? []) renderBranch(directory, host);
  }

  private toggleDirectory(path: string): void {
    if (this.expandedDirectories.has(path)) this.expandedDirectories.delete(path);
    else this.expandedDirectories.add(path);
    this.renderDirectories();
  }

  private renderSessions(): void {
    const body = this.container?.querySelector(".chatobby-session-picker__body");
    if (!(body instanceof HTMLElement)) return;
    body.empty();
    const searching = this.query.trim().length > 0;
    body.createDiv({
      cls: "chatobby-session-picker__directory-heading",
      text: searching ? `Search results for “${this.query.trim()}”` : this.directory.label,
    });
    if (this.state.status === "loading") {
      body.createDiv({ cls: "chatobby-session-picker__state is-loading", text: "Loading sessions" });
      return;
    }
    if (this.state.status === "error") {
      const state = body.createDiv({ cls: "chatobby-session-picker__state is-error" });
      state.createDiv({ text: `Could not load sessions: ${this.state.message}` });
      const retry = state.createEl("button", { text: "Retry connection", attr: { type: "button" } });
      retry.addEventListener("click", () => this.refresh());
      return;
    }
    if (this.operation === "resuming") {
      const state = body.createDiv({
        cls: "chatobby-session-picker__state is-resuming",
        attr: { role: "status", "aria-live": "polite", "aria-label": "Resuming session" },
      });
      state.createSpan({ text: "Resuming session" });
      state.createSpan({ cls: "chatobby-session-picker__loading-dots", attr: { "aria-hidden": "true" } });
      return;
    }
    if (this.operation) {
      body.createDiv({
        cls: "chatobby-session-picker__operation",
        text: this.operation === "creating" ? "Creating session…" : "Updating session…",
      });
    }
    const sessions = this.filteredSessions();
    if (sessions.length === 0) {
      body.createDiv({
        cls: "chatobby-session-picker__state is-empty",
        text: searching ? "No matching folders or sessions" : "No stored sessions in this directory",
      });
      return;
    }
    const list = body.createDiv({ cls: "chatobby-session-picker__list" });
    sessions.forEach((session, index) => {
      const item = list.createDiv({
        cls: `chatobby-session-picker__item${index === this.selected ? " is-active" : ""}`,
        attr: { title: "Right-click for session actions" },
      });
      if (index === this.selected) scrollActiveItemIntoView(item);
      const open = item.createEl("button", {
        cls: "chatobby-session-picker__item-open",
        attr: { type: "button", "aria-label": `Resume ${sessionTitle(session)}` },
      });
      open.disabled = this.operation !== null;
      open.addEventListener("click", () => void this.resumeSession(session));
      const main = open.createDiv({ cls: "chatobby-session-picker__item-main" });
      main.createDiv({ cls: "chatobby-session-picker__item-title", text: sessionTitle(session) });
      if (searching) {
        main.createDiv({ cls: "chatobby-session-picker__item-directory", text: this.directoryLabelForSession(session) });
      }
      const meta = open.createDiv({ cls: "chatobby-session-picker__item-meta" });
      const lastUsed = meta.createSpan({ cls: "chatobby-session-picker__item-meta-last" });
      lastUsed.createSpan({ cls: "chatobby-session-picker__item-meta-label", text: "Last used " });
      lastUsed.createSpan({ text: formatTimestamp(session.modified) });
      const created = meta.createSpan({ cls: "chatobby-session-picker__item-meta-created" });
      created.createSpan({ cls: "chatobby-session-picker__item-meta-label", text: "Created " });
      created.createSpan({ text: formatTimestamp(session.created) });
      meta.createSpan({
        cls: "chatobby-session-picker__item-meta-messages",
        text: `${session.messageCount} ${session.messageCount === 1 ? "message" : "messages"}`,
      });
      item.addEventListener("contextmenu", (event) => this.openSessionMenu(event, session));
    });
  }

  private openSessionMenu(event: MouseEvent, session: SessionListItem): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle("Resume")
      .setIcon("message-square")
      .onClick(() => void this.resumeSession(session)));
    menu.addSeparator();
    this.addAdvancedMenuItem(menu, session, "rename", "Rename", "pencil");
    this.addAdvancedMenuItem(menu, session, "clone", "Clone", "copy");
    this.addAdvancedMenuItem(menu, session, "fork", "Fork from a message", "git-fork");
    menu.addSeparator();
    this.addAdvancedMenuItem(menu, session, "export-html", "Export as HTML", "file-code");
    this.addAdvancedMenuItem(menu, session, "export-jsonl", "Export as JSONL", "file-json");
    menu.addSeparator();
    menu.addItem((item) => item
      .setTitle("Delete")
      .setIcon("trash-2")
      .onClick(() => void this.deleteSession(session)));
    menu.showAtMouseEvent(event);
  }

  private addAdvancedMenuItem(
    menu: Menu,
    session: SessionListItem,
    action: SessionAdvancedAction,
    title: string,
    icon: string,
  ): void {
    menu.addItem((item) => item
      .setTitle(title)
      .setIcon(icon)
      .onClick(() => void this.runAdvancedAction(session, action)));
  }

  private async runAdvancedAction(session: SessionListItem, action: SessionAdvancedAction): Promise<void> {
    if (this.operation) return;
    this.operation = "maintaining";
    this.renderSessions();
    try {
      await this.props.onAdvancedAction(session, this.directoryForSession(session) ?? this.directory, action);
    } catch (error) {
      new Notice(`Could not ${action.replace("-", " ")} session: ${errorMessage(error)}`);
    } finally {
      this.operation = null;
      this.renderSessions();
    }
  }

  private filteredSessions(): SessionListItem[] {
    if (this.state.status !== "ready") return [];
    const needle = this.query.trim().toLowerCase();
    if (!needle) return this.sessionsForDirectory(this.directory);
    return this.state.sessions.filter((session) => {
      const directory = this.directoryForSession(session);
      const haystack = `${sessionTitle(session)} ${directory?.vaultDirectoryPath ?? session.cwd}`.toLowerCase();
      return haystack.includes(needle);
    });
  }

  private visibleDirectoryPaths(): Set<string> {
    const needle = this.query.trim().toLowerCase();
    if (!needle) return new Set(this.directories.map((directory) => directory.vaultDirectoryPath));
    const visible = new Set<string>();
    for (const directory of this.directories) {
      const directoryMatches = `${directory.label} ${directory.vaultDirectoryPath}`.toLowerCase().includes(needle);
      const sessionMatches = this.sessionsForDirectory(directory)
        .some((session) => sessionTitle(session).toLowerCase().includes(needle));
      if (!directoryMatches && !sessionMatches) continue;
      for (const path of ancestorDirectoryPaths(directory.vaultDirectoryPath)) visible.add(path);
    }
    return visible;
  }

  private directoryForSession(session: SessionListItem): SessionDirectoryOption | undefined {
    const cwd = normalizeSystemPath(session.cwd);
    return this.directories.find((directory) => normalizeSystemPath(directory.cwd) === cwd);
  }

  private directoryLabelForSession(session: SessionListItem): string {
    return this.directoryForSession(session)?.label ?? session.cwd;
  }

  private sessionsForDirectory(directory: SessionDirectoryOption): SessionListItem[] {
    if (this.state.status === "loading") return [];
    const cwd = normalizeSystemPath(directory.cwd);
    return this.state.sessions.filter((session) => normalizeSystemPath(session.cwd) === cwd);
  }

  private async deleteSession(session: SessionListItem): Promise<void> {
    if (!window.confirm(`Delete “${sessionTitle(session)}”? This removes its stored conversation and subagent run data.`)) return;
    try {
      await this.props.onDelete(session);
      if (this.state.status !== "loading") {
        this.state = { status: "ready", sessions: this.state.sessions.filter((item) => item.path !== session.path) };
      }
      this.selected = Math.max(0, Math.min(this.selected, this.filteredSessions().length - 1));
      this.renderDirectories();
      this.renderSessions();
    } catch (error) {
      new Notice(`Could not delete session: ${errorMessage(error)}`);
    }
  }

  private async resumeSession(session: SessionListItem): Promise<void> {
    if (this.operation) return;
    this.operation = "resuming";
    this.renderSessions();
    try {
      await this.props.onSelect(session.path, this.directory);
    } finally {
      this.operation = null;
      this.renderSessions();
    }
  }

  private async createSession(): Promise<void> {
    if (this.operation) return;
    this.operation = "creating";
    this.renderSessions();
    try {
      await this.props.onCreateSession(this.directory);
    } finally {
      this.operation = null;
      this.renderSessions();
    }
  }
}

function sessionTitle(session: SessionListItem): string {
  const name = session.name?.trim();
  if (name) return name;
  return "Untitled session";
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function parentDirectoryPath(path: string): string {
  if (!path) return "";
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function directoryName(directory: SessionDirectoryOption, rootLabel: string): string {
  if (!directory.vaultDirectoryPath) return rootLabel.replace(/\s*\/\s*$/u, "") || "Vault";
  return directory.vaultDirectoryPath.split("/").at(-1) ?? directory.label;
}

function ancestorDirectoryPaths(path: string): string[] {
  const paths = [""];
  if (!path) return paths;
  const segments = path.split("/").filter(Boolean);
  for (let index = 1; index <= segments.length; index += 1) paths.push(segments.slice(0, index).join("/"));
  return paths;
}

function nearestExistingDirectory(
  directories: readonly SessionDirectoryOption[],
  previousPath: string,
): SessionDirectoryOption | undefined {
  const ancestors = ancestorDirectoryPaths(previousPath).reverse();
  return ancestors
    .map((path) => directories.find((directory) => directory.vaultDirectoryPath === path))
    .find((directory) => directory !== undefined);
}

function normalizeSystemPath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/u, "");
  return /^[A-Z]:/u.test(normalized) ? normalized.toLowerCase() : normalized;
}

function scrollActiveItemIntoView(item: HTMLElement): void {
  requestAnimationFrame(() => item.scrollIntoView({ block: "nearest" }));
}
