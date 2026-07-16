import type { App } from "obsidian";
import type { ChatobbyTransport } from "../../transport/ws-client";
import { listSessionDirectories, type SessionDirectoryOption } from "./session-directory";
import { SessionPickerComponent } from "./session-picker";
import type { SessionAdvancedAction } from "./session-maintenance";

interface SessionPickerScope {
  cwd: string;
  vaultDirectoryPath: string;
}

interface SessionPickerModeOptions {
  app: App;
  getHost: () => HTMLElement;
  getTransport: () => Promise<ChatobbyTransport | null>;
  getScope: () => SessionPickerScope | null;
  prepareOpen: () => void;
  useDirectory: (directory: SessionDirectoryOption) => Promise<void>;
  resumeSession: (sessionPath: string, directory: SessionDirectoryOption) => Promise<void>;
  createSession: (directory: SessionDirectoryOption) => Promise<void>;
  deleteSession: (sessionPath: string) => Promise<void>;
  runAdvancedAction: (sessionPath: string, action: SessionAdvancedAction) => Promise<void>;
  onOpened: () => void;
  onClosed: () => void;
  onComplete: () => void;
}

/** Coordinates the mutually exclusive session explorer without leaking picker state into the main view. */
export class SessionPickerModeController {
  private picker: SessionPickerComponent | null = null;
  private readonly options: SessionPickerModeOptions;

  constructor(options: SessionPickerModeOptions) {
    this.options = options;
  }

  async open(): Promise<void> {
    const scope = this.options.getScope();
    if (!scope) return;
    this.options.prepareOpen();
    this.picker?.destroy();
    this.picker = new SessionPickerComponent({
      getTransport: this.options.getTransport,
      directories: listSessionDirectories(this.options.app),
      initialDirectoryPath: scope.vaultDirectoryPath,
      onSelect: (path, directory) => this.resume(path, directory),
      onUseDirectory: (directory) => { void this.useDirectory(directory); },
      onCreateSession: (directory) => this.create(directory),
      onDelete: (session) => this.options.deleteSession(session.path),
      onAdvancedAction: (session, directory, action) => this.runAdvancedAction(session.path, directory, action),
    });
    this.options.onOpened();
    this.picker.render(this.options.getHost());
  }

  refresh(): void {
    this.picker?.refresh();
  }

  exit(): void {
    this.picker?.destroy();
    this.picker = null;
    this.options.onClosed();
  }

  destroy(): void {
    this.picker?.destroy();
    this.picker = null;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    return this.picker?.handleKeydown(event) ?? false;
  }

  private async resume(path: string, directory: SessionDirectoryOption): Promise<void> {
    await this.options.resumeSession(path, directory);
  }

  private async useDirectory(directory: SessionDirectoryOption): Promise<void> {
    await this.options.useDirectory(directory);
    this.exit();
    this.options.onComplete();
  }

  private async create(directory: SessionDirectoryOption): Promise<void> {
    this.exit();
    this.options.onComplete();
    await this.options.createSession(directory);
  }

  private async runAdvancedAction(
    sessionPath: string,
    directory: SessionDirectoryOption,
    action: SessionAdvancedAction,
  ): Promise<void> {
    void directory;
    await this.options.runAdvancedAction(sessionPath, action);
  }
}
