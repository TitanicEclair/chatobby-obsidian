import type { Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { SettingsStore } from "../../src/state/settings-store";
import { SettingsStore as OwnedSettingsStore } from "../../src/features/settings/infrastructure/settings-store";
import {
  DEFAULT_COMPOSER_KEYBINDINGS as ownedKeybindings,
  DEFAULT_PLUGIN_SETTINGS as ownedSettings,
} from "../../src/features/settings/domain/settings";
import {
  DEFAULT_COMPOSER_KEYBINDINGS,
  DEFAULT_PLUGIN_SETTINGS,
  DEFAULT_SESSION_PREFERENCES,
  type PluginSettings,
} from "../../src/types";

/** Characterizes the actual persistence boundary before its owner moves.
 * The snapshots retain legacy normalization, including accepted old values;
 * ordering cases distinguish credential failure from persistence failure.
 * @see ../../src/features/settings/README.md
 */
describe("settings persistence ownership", () => {
  it("keeps compatibility paths on the same constructor and default objects", () => {
    expect(SettingsStore).toBe(OwnedSettingsStore);
    expect(DEFAULT_PLUGIN_SETTINGS).toBe(ownedSettings);
    expect(DEFAULT_COMPOSER_KEYBINDINGS).toBe(ownedKeybindings);
  });

  it("hydrates the plugin's original object and preserves existing default references", async () => {
    const fixture = setup();
    const original = fixture.settings;
    expect(fixture.store.sessionPrefs).toBe(DEFAULT_SESSION_PREFERENCES);
    await fixture.store.load();
    expect(fixture.settings).toBe(original);
    expect(fixture.settings).toEqual(DEFAULT_PLUGIN_SETTINGS);
    expect(fixture.settings.developerArgs).toBe(DEFAULT_PLUGIN_SETTINGS.developerArgs);
    expect(fixture.settings.providerKeys).toBe(DEFAULT_PLUGIN_SETTINGS.providerKeys);
    expect(fixture.settings.composerKeybindings).not.toBe(DEFAULT_PLUGIN_SETTINGS.composerKeybindings);
    expect(fixture.store.sessionPrefs).not.toBe(DEFAULT_SESSION_PREFERENCES);
    expect(fixture.saveData).not.toHaveBeenCalled();
    await fixture.store.updateSettings({});
    expect(fixture.persisted).toMatchSnapshot();
  });

  it.each([
    { name: "missing", data: null, migrationWrites: 0 },
    { name: "legacy command wins over endpoint", data: { backendCommand: "custom-runtime", backendArgs: ["--local"], serverUrl: "wss://synthetic.example.test" }, migrationWrites: 1 },
    { name: "explicit mode prevents legacy autosave", data: { runtimeMode: "managed", backendCommand: "custom-runtime", serverUrl: "wss://synthetic.example.test" }, migrationWrites: 0 },
    { name: "invalid explicit mode still prevents autosave", data: { runtimeMode: "old-mode", backendArgs: ["--local"] }, migrationWrites: 0 },
    { name: "legacy loopback checks host and port", data: { serverUrl: "https://localhost:9222/old-path" }, migrationWrites: 1 },
    { name: "invalid legacy endpoint remains external", data: { serverUrl: "old endpoint text" }, migrationWrites: 1 },
    { name: "old preferences and display values are retained", data: { thinkingDisplay: "legacy-display", sessionPreferences: { model: "synthetic-model", thinkingLevel: "legacy-effort", extraPreference: "retained" }, providerKeys: { configured: true, missing: false }, documentOcrLanguage: "  ", advancedOcrCommand: "  local-ocr  ", composerKeybindings: { previousMessage: "  Mod+Up  ", cancelTurn: "  " } }, migrationWrites: 0 },
  ])("preserves $name normalization and the precise migration write condition", async ({ data, migrationWrites }) => {
    const fixture = setup(data);
    await fixture.store.load();
    expect(fixture.saveData).toHaveBeenCalledTimes(migrationWrites);
    await fixture.store.updateSettings({});
    expect({ settings: fixture.settings, preferences: fixture.store.getSessionPreferences(), saved: fixture.persisted.at(-1) }).toMatchSnapshot();
    const saved = fixture.persisted.at(-1) as Record<string, unknown>;
    expect(saved).not.toHaveProperty("backendCommand");
    expect(saved).not.toHaveProperty("backendArgs");
    expect(saved).not.toHaveProperty("serverUrl");
  });

  it("publishes an in-memory settings update before awaiting its single save", async () => {
    const fixture = setup();
    await fixture.store.load();
    const gate = deferred();
    fixture.saveData.mockImplementation(async (value: unknown) => { fixture.persisted.push(structuredClone(value)); await gate.promise; });
    const saving = fixture.store.updateSettings({ autoScroll: false });
    expect(fixture.settings.autoScroll).toBe(false);
    expect(fixture.saveData).toHaveBeenCalledOnce();
    gate.reject(new Error("synthetic save failure"));
    await expect(saving).rejects.toThrow("synthetic save failure");
    expect(fixture.settings.autoScroll).toBe(false);
  });

  it("returns preference copies and retains a merged preference after save rejection", async () => {
    const fixture = setup({ sessionPreferences: { model: "old-model" } });
    await fixture.store.load();
    const copy = fixture.store.getSessionPreferences();
    copy.model = "outside mutation";
    expect(fixture.store.getSessionPreferences().model).toBe("old-model");
    const previous = fixture.store.sessionPrefs;
    fixture.saveData.mockRejectedValue(new Error("synthetic save failure"));
    await expect(fixture.store.rememberSessionPreferences({ model: "next-model" })).rejects.toThrow("synthetic save failure");
    expect(fixture.store.sessionPrefs).not.toBe(previous);
    expect(fixture.store.getSessionPreferences()).toEqual({ ...DEFAULT_SESSION_PREFERENCES, model: "next-model" });
  });

  it("waits for credential dispatch before publishing a configured flag and never saves the value", async () => {
    const fixture = setup({ providerKeys: { old: true, disabled: false } });
    await fixture.store.load();
    const gate = deferred();
    fixture.writeCredential.mockImplementation(async () => { fixture.events.push("credential"); await gate.promise; });
    const setting = fixture.store.setProviderKey("synthetic-provider", "synthetic-value");
    expect(fixture.writeCredential).toHaveBeenCalledExactlyOnceWith("synthetic-provider", "synthetic-value");
    expect(fixture.settings.providerKeys).toEqual({ old: true, disabled: false });
    expect(fixture.saveData).not.toHaveBeenCalled();
    gate.resolve();
    await setting;
    expect(fixture.events).toEqual(["load", "credential", "save"]);
    expect(fixture.store.configuredProviders()).toEqual(["old", "synthetic-provider"]);
    expect((fixture.persisted.at(-1) as PluginSettings).providerKeys).toEqual({ old: true, disabled: false, "synthetic-provider": true });
    expect(JSON.stringify(fixture.persisted)).not.toContain("synthetic-value");
  });

  it.each(["set", "remove"] as const)("leaves provider flags untouched when %s credential dispatch fails", async (operation) => {
    const fixture = setup({ providerKeys: { provider: true } });
    await fixture.store.load();
    const original = fixture.settings.providerKeys;
    fixture.writeCredential.mockRejectedValue(new Error("synthetic credential failure"));
    const result = operation === "set" ? fixture.store.setProviderKey("new", "synthetic-value") : fixture.store.removeProviderKey("provider");
    await expect(result).rejects.toThrow("synthetic credential failure");
    expect(fixture.settings.providerKeys).toBe(original);
    expect(fixture.settings.providerKeys).toEqual({ provider: true });
    expect(fixture.saveData).not.toHaveBeenCalled();
  });

  it("removes credentials before flags and retains the flag change if saving subsequently fails", async () => {
    const fixture = setup({ providerKeys: { first: true, remove: true, last: true } });
    await fixture.store.load();
    fixture.saveData.mockImplementation(async (value: unknown) => { fixture.events.push("save"); fixture.persisted.push(structuredClone(value)); throw new Error("synthetic save failure"); });
    await expect(fixture.store.removeProviderKey("remove")).rejects.toThrow("synthetic save failure");
    expect(fixture.writeCredential).toHaveBeenCalledExactlyOnceWith("remove", null);
    expect(fixture.events).toEqual(["load", "credential", "save"]);
    expect(fixture.settings.providerKeys).toEqual({ first: true, last: true });
    expect(fixture.store.configuredProviders()).toEqual(["first", "last"]);
  });

  it("retains hydration when its required legacy migration save fails", async () => {
    const fixture = setup({ backendCommand: "synthetic-runtime" });
    fixture.saveData.mockRejectedValue(new Error("synthetic migration failure"));
    await expect(fixture.store.load()).rejects.toThrow("synthetic migration failure");
    expect(fixture.settings.runtimeMode).toBe("developer");
    expect(fixture.settings.developerCommand).toBe("synthetic-runtime");
    expect(fixture.saveData).toHaveBeenCalledOnce();
  });
});

function setup(data: unknown = null) {
  const settings = structuredClone(DEFAULT_PLUGIN_SETTINGS);
  const events: string[] = [];
  const persisted: unknown[] = [];
  const loadData = vi.fn(async () => { events.push("load"); return data; });
  const saveData = vi.fn(async (value: unknown) => { events.push("save"); persisted.push(structuredClone(value)); });
  const writeCredential = vi.fn(async (_provider: string, _value: string | null) => { events.push("credential"); });
  const plugin = { loadData, saveData } as unknown as Plugin;
  const store = new SettingsStore(plugin, settings, writeCredential);
  return { settings, events, persisted, loadData, saveData, writeCredential, store };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
