import { normalizeVaultDirectoryInput } from "./session-directory";

interface LeafDirectoryRouterOptions<T> {
  currentTarget: () => T;
  currentDirectory: () => string;
  hasSessions: () => boolean;
  isDirectory: (path: string) => boolean;
  setCurrentDirectory: (path: string) => Promise<void>;
  rememberDefaultDirectory: (path: string) => Promise<void>;
  openDirectoryTarget: (path: string) => Promise<T>;
  openSessionTarget: (path: string, sessionPath?: string) => Promise<T>;
  ensureDirectoryTarget: (target: T) => Promise<void>;
  closeCurrentExplorer: () => void;
  resumeInTarget: (target: T, sessionPath: string) => Promise<void>;
  createInTarget: (target: T) => Promise<void>;
}

/** Routes working-directory changes without mutating a leaf that already owns sessions. */
export class LeafDirectoryRouter<T> {
  constructor(private readonly options: LeafDirectoryRouterOptions<T>) {}

  async use(rawPath: string): Promise<T> {
    const path = normalizeVaultDirectoryInput(rawPath);
    if (!this.options.isDirectory(path)) throw new Error(`"${rawPath}" is not a directory in this vault.`);
    if (path === this.options.currentDirectory() || !this.options.hasSessions()) {
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
    const target = await this.sessionTarget(directoryPath, sessionPath);
    if (target !== this.options.currentTarget()) this.options.closeCurrentExplorer();
    await this.options.resumeInTarget(target, sessionPath);
  }

  async create(directoryPath: string): Promise<void> {
    const target = await this.sessionTarget(directoryPath);
    if (target !== this.options.currentTarget()) this.options.closeCurrentExplorer();
    await this.options.createInTarget(target);
  }

  private async sessionTarget(rawPath: string, sessionPath?: string): Promise<T> {
    const path = normalizeVaultDirectoryInput(rawPath);
    if (!this.options.isDirectory(path)) throw new Error(`"${rawPath}" is not a directory in this vault.`);
    if (!this.options.hasSessions()) {
      await this.options.setCurrentDirectory(path);
      return this.options.currentTarget();
    }
    await this.options.rememberDefaultDirectory(path);
    return this.options.openSessionTarget(path, sessionPath);
  }
}
