/**
 * Vault & directory-based session preferences.
 *
 * Reads/writes `.chatobby/session-dirs.json` at the vault root.
 * Resolves effective preferences by walking up the directory tree
 * from a given path to the vault root, falling back to vaultDefaults.
 *
 * Target architecture — see docs/vault-session-prefs.md for full design.
 */

import type { App } from "obsidian";
import type { SessionPreferences, VaultSessionConfig } from "../../types";
import { DEFAULT_SESSION_PREFERENCES } from "../../types";
import { VAULT_PREFS_JSON_INDENT } from "../shared/constants";

// Config path: ".chatobby/session-dirs.json"
const CONFIG_DIR = ".chatobby";
const CONFIG_PATH = `${CONFIG_DIR}/session-dirs.json`;

/** Default config created on first run. */
const DEFAULT_CONFIG: VaultSessionConfig = {
  vaultDefaults: { ...DEFAULT_SESSION_PREFERENCES },
  directories: {},
};

/**
 * Load the vault session config from .chatobby/session-dirs.json.
 * Creates the file with defaults if it does not exist.
 */
export async function loadVaultPrefs(app: App): Promise<VaultSessionConfig> {
  const adapter = app.vault.adapter as unknown as VaultPrefsAdapter;
  if (!(await adapter.exists(CONFIG_PATH))) {
    await ensureConfigExists(adapter);
    return cloneDefaultConfig();
  }

  const raw = await adapter.read(CONFIG_PATH);
  return normalizeConfig(JSON.parse(raw) as unknown);
}

/**
 * Save the vault session config to .chatobby/session-dirs.json.
 */
export async function saveVaultPrefs(app: App, config: VaultSessionConfig): Promise<void> {
  const adapter = app.vault.adapter as unknown as VaultPrefsAdapter;
  await ensureConfigDir(adapter);
  await adapter.write(CONFIG_PATH, JSON.stringify(normalizeConfig(config), null, VAULT_PREFS_JSON_INDENT));
}

/**
 * Resolve effective session preferences for a directory path.
 *
 * Walk-up hierarchy: "Projects/chatobby/src" checks:
 *   1. directories["Projects/chatobby/src"]
 *   2. directories["Projects/chatobby"]
 *   3. directories["Projects"]
 *   4. directories[""] (vault root)
 *   5. vaultDefaults (final fallback)
 *
 * Each level fills gaps — a child overriding thinkingLevel does not
 * prevent a parent from providing model.
 *
 * @param dirPath Vault-relative directory path. Empty string = vault root.
 * @param config The loaded VaultSessionConfig.
 */
export function resolvePrefs(dirPath: string, config: VaultSessionConfig): SessionPreferences {
  const merged: Partial<SessionPreferences & { enabledTools?: string[] }> = {};
  const segments = dirPath.split("/").filter(Boolean);

  // Walk up from deepest to root
  for (let i = segments.length; i >= 0; i--) {
    const key = segments.slice(0, i).join("/");
    const prefs = config.directories[key];
    if (!prefs) continue;

    if (merged.model === undefined && prefs.model !== undefined) merged.model = prefs.model;
    if (merged.thinkingLevel === undefined && prefs.thinkingLevel !== undefined) merged.thinkingLevel = prefs.thinkingLevel;
    if (merged.permissionMode === undefined && prefs.permissionMode !== undefined) merged.permissionMode = prefs.permissionMode;
    if (merged.enabledTools === undefined && prefs.enabledTools !== undefined) merged.enabledTools = prefs.enabledTools;
  }

  return {
    model: merged.model ?? config.vaultDefaults.model,
    thinkingLevel: merged.thinkingLevel ?? config.vaultDefaults.thinkingLevel,
    permissionMode: merged.permissionMode ?? config.vaultDefaults.permissionMode,
  };
}

/**
 * Record that a session was created in a directory. Upserts the directory
 * entry with lastUsed timestamp. Does NOT overwrite existing pref overrides.
 *
 * @param dirPath Vault-relative directory path. Empty string = vault root.
 */
export async function recordSessionDir(app: App, config: VaultSessionConfig, dirPath: string): Promise<VaultSessionConfig> {
  const existing = config.directories[dirPath] ?? {};
  config.directories[dirPath] = {
    ...existing,
    lastUsed: Date.now(),
  };
  await saveVaultPrefs(app, config);
  return config;
}

interface VaultPrefsAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}

async function ensureConfigExists(adapter: VaultPrefsAdapter): Promise<void> {
  await ensureConfigDir(adapter);
  await adapter.write(CONFIG_PATH, JSON.stringify(cloneDefaultConfig(), null, VAULT_PREFS_JSON_INDENT));
}

async function ensureConfigDir(adapter: VaultPrefsAdapter): Promise<void> {
  if (!(await adapter.exists(CONFIG_DIR))) {
    await adapter.mkdir(CONFIG_DIR);
  }
}

function cloneDefaultConfig(): VaultSessionConfig {
  return {
    vaultDefaults: { ...DEFAULT_CONFIG.vaultDefaults },
    directories: {},
  };
}

function normalizeConfig(input: unknown): VaultSessionConfig {
  if (!isRecord(input)) return cloneDefaultConfig();
  return {
    vaultDefaults: normalizePreferences(input.vaultDefaults),
    directories: normalizeDirectories(input.directories),
  };
}

function normalizePreferences(input: unknown): SessionPreferences {
  const record = isRecord(input) ? input : {};
  return {
    model: typeof record.model === "string" || record.model === null ? record.model : DEFAULT_SESSION_PREFERENCES.model,
    thinkingLevel: isThinkingLevel(record.thinkingLevel) ? record.thinkingLevel : DEFAULT_SESSION_PREFERENCES.thinkingLevel,
    permissionMode: isPermissionMode(record.permissionMode) ? record.permissionMode : DEFAULT_SESSION_PREFERENCES.permissionMode,
  };
}

function normalizeDirectories(input: unknown): VaultSessionConfig["directories"] {
  if (!isRecord(input)) return {};
  const directories: VaultSessionConfig["directories"] = {};
  for (const [path, value] of Object.entries(input)) {
    if (!isRecord(value)) continue;
    directories[path] = {
      model: typeof value.model === "string" || value.model === null ? value.model : undefined,
      thinkingLevel: isThinkingLevel(value.thinkingLevel) ? value.thinkingLevel : undefined,
      permissionMode: isPermissionMode(value.permissionMode) ? value.permissionMode : undefined,
      enabledTools: Array.isArray(value.enabledTools) ? value.enabledTools.filter((tool): tool is string => typeof tool === "string") : undefined,
      lastUsed: typeof value.lastUsed === "number" ? value.lastUsed : undefined,
    };
  }
  return directories;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isThinkingLevel(value: unknown): value is SessionPreferences["thinkingLevel"] {
  return value === "off" || value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh";
}

function isPermissionMode(value: unknown): value is SessionPreferences["permissionMode"] {
  return value === "default" || value === "acceptEdits" || value === "bypassPermissions" || value === "plan" || value === "dontAsk" || value === "auto";
}
