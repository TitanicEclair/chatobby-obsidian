import { Notice, TFolder, type App } from "obsidian";
import type ChatobbyPlugin from "../../main";
import {
  getVaultBasePath,
  normalizeVaultDirectoryInput,
  resolveVaultDirectoryCwd,
} from "./session-directory";
import { workingDirectoryLabel } from "../controller/view-utils";

export interface WorkingDirectoryScope {
  cwd: string;
  label: string;
  vaultDirectoryPath: string;
}

/** Leaf-local working-directory identity and validation. */
export class WorkingDirectoryController {
  private vaultDirectoryPath: string;

  constructor(private readonly app: App, private readonly plugin: ChatobbyPlugin) {
    this.vaultDirectoryPath = normalizeVaultDirectoryInput(plugin.getActiveVaultDirectory());
  }

  current(): string { return this.vaultDirectoryPath; }

  restore(rawPath: string): void {
    this.vaultDirectoryPath = normalizeVaultDirectoryInput(rawPath);
  }

  isVaultDirectory(path: string): boolean {
    return !path || this.app.vault.getAbstractFileByPath(path) instanceof TFolder;
  }

  async set(rawPath: string): Promise<void> {
    const path = normalizeVaultDirectoryInput(rawPath);
    if (!this.isVaultDirectory(path)) {
      new Notice(`"${rawPath}" is not a directory in this vault.`);
      return;
    }
    this.vaultDirectoryPath = path;
    await this.plugin.setActiveVaultDirectory(path);
    new Notice(`Chatobby working directory: ${workingDirectoryLabel(path, this.app.vault.getName())}`);
  }

  resolve(action: string): WorkingDirectoryScope | null {
    if (!this.isVaultDirectory(this.vaultDirectoryPath)) {
      new Notice(`Cannot ${action}: "${this.vaultDirectoryPath}" is not a directory in this vault.`);
      return null;
    }
    const vaultBasePath = getVaultBasePath(this.app);
    if (!vaultBasePath) {
      new Notice(`Cannot ${action}: Chatobby could not resolve the vault base path.`);
      return null;
    }
    return {
      cwd: resolveVaultDirectoryCwd(vaultBasePath, this.vaultDirectoryPath),
      label: workingDirectoryLabel(this.vaultDirectoryPath, this.app.vault.getName()),
      vaultDirectoryPath: this.vaultDirectoryPath,
    };
  }
}

export function sameWorkingDirectory(left: string, right: string): boolean {
  const normalize = (value: string): string => value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLocaleLowerCase();
  return normalize(left) === normalize(right);
}
