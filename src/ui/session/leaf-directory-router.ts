import { normalizeVaultDirectoryInput } from "./session-directory";

interface LeafDirectoryRouterOptions<T> {
  currentTarget: () => T;
  currentDirectory: () => string;
  canReuseCurrentTarget: () => boolean;
  isDirectory: (path: string) => boolean;
  setCurrentDirectory: (path: string) => Promise<void>;
  rememberDefaultDirectory: (path: string) => Promise<void>;
  openDirectoryTarget: (path: string) => Promise<T>;
  openSessionTarget: (path: string, sessionPath?: string) => Promise<T>;
  ensureDirectoryTarget: (target: T) => Promise<void>;
  closeCurrentExplorer: () => Promise<void>;
  resumeInTarget: (target: T, sessionPath: string) => Promise<void>;
  createInTarget: (target: T) => Promise<void>;
  focusTarget: (target: T) => void;
}

/** Routes working-directory changes without mutating a leaf that already owns sessions. */
export class LeafDirectoryRouter<T> {
  constructor(private readonly options: LeafDirectoryRouterOptions<T>) {}

  async use(rawPath: string): Promise<T> {
    const path = normalizeVaultDirectoryInput(rawPath);
    if (!this.options.isDirectory(path)) throw new Error(`"${rawPath}" is not a directory in this vault.`);
    if (path === this.options.currentDirectory() || this.options.canReuseCurrentTarget()) {
      await this.options.setCurrentDirectory(path);
      const target = this.options.currentTarget();
      await this.options.ensureDirectoryTarget(target);
      return target;
    }
    await this.options.rememberDefaultDirectory(path);
    const target = await this.options.openDirectoryTarget(path);
    await this.options.ensureDirectoryTarget(target);
    return target;
  }

  async resume(sessionPath: string, directoryPath: string): Promise<void> {
    if (!this.options.canReuseCurrentTarget()) await this.options.closeCurrentExplorer();
    const target = await this.sessionTarget(directoryPath, sessionPath);
    await this.options.resumeInTarget(target, sessionPath);
    this.options.focusTarget(target);
  }

  async create(directoryPath: string): Promise<void> {
    if (!this.options.canReuseCurrentTarget()) await this.options.closeCurrentExplorer();
    const target = await this.sessionTarget(directoryPath);
    await this.options.createInTarget(target);
    this.options.focusTarget(target);
  }

  private async sessionTarget(rawPath: string, sessionPath?: string): Promise<T> {
    const path = normalizeVaultDirectoryInput(rawPath);
    if (!this.options.isDirectory(path)) throw new Error(`"${rawPath}" is not a directory in this vault.`);
    if (this.options.canReuseCurrentTarget()) {
      await this.options.setCurrentDirectory(path);
      return this.options.currentTarget();
    }
    await this.options.rememberDefaultDirectory(path);
    return this.options.openSessionTarget(path, sessionPath);
  }
}
