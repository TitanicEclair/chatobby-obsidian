import { TFolder, type App } from "obsidian";

/** Directory entry shown by the session browser. */
export interface SessionDirectoryOption {
  readonly vaultDirectoryPath: string;
  readonly cwd: string;
  readonly label: string;
}

interface VaultAdapterWithBasePath {
  getBasePath(): string;
}

export function getVaultBasePath(app: App): string | null {
  const adapter: unknown = app.vault.adapter;
  if (!isVaultAdapterWithBasePath(adapter)) return null;
  const basePath = adapter.getBasePath().trim();
  return basePath.length > 0 ? basePath : null;
}

export function normalizeVaultDirectoryInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "." || trimmed === "/" || trimmed === "\\") return "";
  return trimmed
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

export function vaultDirectoryTabName(vaultDirectoryPath: string | undefined, vaultName: string): string {
  const normalized = vaultDirectoryPath === undefined ? "" : normalizeVaultDirectoryInput(vaultDirectoryPath);
  if (!normalized) return vaultName.trim() || "Vault";
  const parts = normalized.split("/").filter((part) => part.length > 0);
  return (parts[parts.length - 1] ?? vaultName.trim()) || "Vault";
}

export function resolveVaultDirectoryCwd(vaultBasePath: string, vaultDirectoryPath: string): string {
  const base = vaultBasePath.replace(/[\\/]+$/, "");
  const normalized = normalizeVaultDirectoryInput(vaultDirectoryPath);
  if (!normalized) return base;
  const separator = base.includes("\\") ? "\\" : "/";
  return `${base}${separator}${normalized.replace(/\//g, separator)}`;
}

/** Lists the vault root and every loaded folder as backend cwd options. */
export function listSessionDirectories(app: App): SessionDirectoryOption[] {
  const basePath = getVaultBasePath(app);
  if (!basePath) return [];
  const vaultName = app.vault.getName().trim() || "Vault";
  const paths = app.vault.getAllLoadedFiles()
    .filter((file): file is TFolder => file instanceof TFolder)
    .map((folder) => normalizeVaultDirectoryInput(folder.path))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  return ["", ...paths].map((vaultDirectoryPath) => ({
    vaultDirectoryPath,
    cwd: resolveVaultDirectoryCwd(basePath, vaultDirectoryPath),
    label: vaultDirectoryPath ? `/${vaultDirectoryPath}` : `${vaultName} /`,
  }));
}

function isVaultAdapterWithBasePath(adapter: unknown): adapter is VaultAdapterWithBasePath {
  if (typeof adapter !== "object" || adapter === null) return false;
  const candidate = adapter as { getBasePath?: unknown };
  return typeof candidate.getBasePath === "function";
}
