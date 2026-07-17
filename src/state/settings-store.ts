// SettingsStore — owns the two persisted layers (PluginSettings + SessionPreferences)
// and their load/save + mutators, extracted from main.ts.
//
// PluginSettings stays a public field ON the plugin (read by SettingTab), so the
// store mutates that object IN PLACE rather than holding its own copy — this keeps
// `plugin.settings.*` live without a getter (which would clash with the base
// Plugin class). SessionPreferences is owned here. API-key writes go through
// Runtime credential commands; the store keeps per-provider "configured" flags only.

import type { Plugin } from "obsidian";
import {
  DEFAULT_PLUGIN_SETTINGS,
  DEFAULT_SESSION_PREFERENCES,
  type PluginSettings,
  type SessionPreferences,
  type ThinkingDisplay,
} from "../types";

/** Shape of the full data.json on disk. */
interface PersistedData {
	onboardingVersion?: number;
  runtimeMode?: string;
  runtimeAutoStart?: boolean;
  runtimeLifetime?: string;
  externalServerUrl?: string;
  developerCommand?: string;
  developerArgs?: string[];
  commandShell?: string;
  customShellPath?: string;
  // One-time migration inputs from the pre-runtime-manager settings schema.
  serverUrl?: string;
  backendCommand?: string;
  backendArgs?: string[];
  providerKeys?: Record<string, boolean>;
  thinkingDisplay?: string;
  autoScroll?: boolean;
  autoNameStrategy?: string;
  activeVaultDirectory?: string;
  sessionPreferences?: Partial<SessionPreferences>;
}

export class SettingsStore {
  /** Session defaults (model, thinking, permission). Owned here, not on the plugin. */
  sessionPrefs: SessionPreferences = DEFAULT_SESSION_PREFERENCES;

  constructor(
    private readonly plugin: Plugin,
    /** The plugin's public settings field, mutated in place by this store. */
    private readonly settings: PluginSettings,
    private readonly writeCredential: (provider: string, apiKey: string | null) => Promise<void>,
  ) {}

  /** Single loadData() that hydrates both settings and session prefs. */
  async load(): Promise<void> {
    const data = (await this.plugin.loadData() ?? {}) as PersistedData;
    const runtimeMode = resolveRuntimeMode(data);

    Object.assign(this.settings, {
		onboardingVersion: resolveOnboardingVersion(data),
      runtimeMode,
      runtimeAutoStart: data.runtimeAutoStart ?? DEFAULT_PLUGIN_SETTINGS.runtimeAutoStart,
      runtimeLifetime: data.runtimeLifetime === "background" ? "background" : "obsidian-session",
      externalServerUrl: data.externalServerUrl ?? data.serverUrl ?? DEFAULT_PLUGIN_SETTINGS.externalServerUrl,
      developerCommand: data.developerCommand ?? data.backendCommand ?? DEFAULT_PLUGIN_SETTINGS.developerCommand,
      developerArgs: data.developerArgs ?? data.backendArgs ?? DEFAULT_PLUGIN_SETTINGS.developerArgs,
      commandShell: isCommandShell(data.commandShell) ? data.commandShell : DEFAULT_PLUGIN_SETTINGS.commandShell,
      customShellPath: data.customShellPath ?? DEFAULT_PLUGIN_SETTINGS.customShellPath,
      providerKeys: data.providerKeys ?? DEFAULT_PLUGIN_SETTINGS.providerKeys,
      thinkingDisplay: (data.thinkingDisplay as ThinkingDisplay) ?? DEFAULT_PLUGIN_SETTINGS.thinkingDisplay,
      autoScroll: data.autoScroll ?? DEFAULT_PLUGIN_SETTINGS.autoScroll,
      autoNameStrategy: data.autoNameStrategy === "model" ? "model" : "truncate",
      activeVaultDirectory: data.activeVaultDirectory ?? DEFAULT_PLUGIN_SETTINGS.activeVaultDirectory,
    });

    this.sessionPrefs = { ...DEFAULT_SESSION_PREFERENCES, ...(data.sessionPreferences ?? {}) };
    if (data.runtimeMode === undefined && hasLegacyRuntimeSettings(data)) await this.save();
  }

  /** Save everything to data.json in a single write. */
  private async save(): Promise<void> {
    await this.plugin.saveData({
		onboardingVersion: this.settings.onboardingVersion,
      runtimeMode: this.settings.runtimeMode,
      runtimeAutoStart: this.settings.runtimeAutoStart,
      runtimeLifetime: this.settings.runtimeLifetime,
      externalServerUrl: this.settings.externalServerUrl,
      developerCommand: this.settings.developerCommand,
      developerArgs: this.settings.developerArgs,
      commandShell: this.settings.commandShell,
      customShellPath: this.settings.customShellPath,
      providerKeys: this.settings.providerKeys,
      thinkingDisplay: this.settings.thinkingDisplay,
      autoScroll: this.settings.autoScroll,
      autoNameStrategy: this.settings.autoNameStrategy,
      activeVaultDirectory: this.settings.activeVaultDirectory,
      sessionPreferences: this.sessionPrefs,
    } satisfies PersistedData);
  }

  /** Defensive copy of session preferences. */
  getSessionPreferences(): SessionPreferences {
    return { ...this.sessionPrefs };
  }

  async updateSettings(patch: Partial<PluginSettings>): Promise<void> {
    Object.assign(this.settings, patch);
    await this.save();
  }

  /** Merge a partial patch into session preferences and persist. */
  async rememberSessionPreferences(patch: Partial<SessionPreferences>): Promise<void> {
    this.sessionPrefs = { ...this.sessionPrefs, ...patch };
    await this.save();
  }

  async setExternalServerUrl(url: string): Promise<void> {
    await this.updateSettings({ externalServerUrl: url || DEFAULT_PLUGIN_SETTINGS.externalServerUrl });
  }

  configuredProviders(): string[] {
    return Object.entries(this.settings.providerKeys)
      .filter(([, configured]) => configured)
      .map(([provider]) => provider);
  }

  async setProviderKey(provider: string, key: string): Promise<void> {
    await this.writeCredential(provider, key);
    await this.updateSettings({
      providerKeys: { ...this.settings.providerKeys, [provider]: true },
    });
  }

  async removeProviderKey(provider: string): Promise<void> {
    await this.writeCredential(provider, null);
    const nextProviderKeys = { ...this.settings.providerKeys };
    delete nextProviderKeys[provider];
    await this.updateSettings({ providerKeys: nextProviderKeys });
  }

}

function resolveOnboardingVersion(data: PersistedData): number {
	if (typeof data.onboardingVersion === "number" && Number.isSafeInteger(data.onboardingVersion)) {
		return Math.max(0, data.onboardingVersion);
	}
	return Object.values(data.providerKeys ?? {}).some(Boolean) ? 1 : 0;
}

function isCommandShell(value: string | undefined): value is PluginSettings["commandShell"] {
  return value === "auto" || value === "pwsh" || value === "powershell" || value === "cmd" ||
    value === "bash" || value === "zsh" || value === "fish" || value === "sh" || value === "custom";
}

function resolveRuntimeMode(data: PersistedData): PluginSettings["runtimeMode"] {
  if (data.runtimeMode === "managed" || data.runtimeMode === "external" || data.runtimeMode === "developer") {
    return data.runtimeMode;
  }
  if ((data.backendCommand && data.backendCommand !== "chatobby") || (data.backendArgs?.length ?? 0) > 0) {
    return "developer";
  }
  if (data.serverUrl && !isLegacyDefaultUrl(data.serverUrl)) return "external";
  return "managed";
}

function hasLegacyRuntimeSettings(data: PersistedData): boolean {
  return data.serverUrl !== undefined || data.backendCommand !== undefined || data.backendArgs !== undefined;
}

function isLegacyDefaultUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.port === "9222";
  } catch {
    return false;
  }
}
