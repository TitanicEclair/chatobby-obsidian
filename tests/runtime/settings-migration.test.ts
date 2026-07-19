import type { Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { SettingsStore } from "../../src/state/settings-store";
import { DEFAULT_PLUGIN_SETTINGS, type PluginSettings } from "../../src/types";

describe("runtime settings migration", () => {
  it("migrates a custom legacy command to developer mode and persists the new schema", async () => {
    const plugin = fakePlugin({
      serverUrl: "ws://localhost:9222",
      backendCommand: "node",
      backendArgs: ["C:\\dev\\chatobby\\cli.js"],
    });
    const settings = defaults();
    const store = new SettingsStore(plugin.value, settings);

    await store.load();

    expect(settings).toMatchObject({
      runtimeMode: "developer",
      developerCommand: "node",
      developerArgs: ["C:\\dev\\chatobby\\cli.js"],
    });
    expect(plugin.saveData).toHaveBeenCalledWith(expect.objectContaining({
      runtimeMode: "developer",
      developerCommand: "node",
      developerArgs: ["C:\\dev\\chatobby\\cli.js"],
    }));
    expect(plugin.saveData.mock.calls[0]![0]).not.toHaveProperty("backendCommand");
  });

  it("migrates a non-default legacy endpoint to external mode", async () => {
    const plugin = fakePlugin({ serverUrl: "wss://runtime.example.test/chatobby" });
    const settings = defaults();
    await new SettingsStore(plugin.value, settings).load();

    expect(settings.runtimeMode).toBe("external");
    expect(settings.externalServerUrl).toBe("wss://runtime.example.test/chatobby");
  });

  it("migrates the old loopback default to managed mode without persisting a fixed managed endpoint", async () => {
    const plugin = fakePlugin({ serverUrl: "ws://127.0.0.1:9222" });
    const settings = defaults();
    await new SettingsStore(plugin.value, settings).load();

    expect(settings.runtimeMode).toBe("managed");
    const persisted = plugin.saveData.mock.calls[0]![0] as Record<string, unknown>;
    expect(persisted).not.toHaveProperty("serverUrl");
    expect(persisted.externalServerUrl).toBe("ws://127.0.0.1:9222");
  });

  it("loads and persists the selected automatic session naming strategy", async () => {
    const plugin = fakePlugin({ autoNameStrategy: "model" });
    const settings = defaults();
    const store = new SettingsStore(plugin.value, settings);

    await store.load();
    await store.updateSettings({ autoNameStrategy: "truncate" });

    expect(settings.autoNameStrategy).toBe("truncate");
    expect(plugin.saveData).toHaveBeenCalledWith(expect.objectContaining({ autoNameStrategy: "truncate" }));
  });

  it("fills missing composer shortcuts and preserves valid custom bindings", async () => {
    const plugin = fakePlugin({ composerKeybindings: { stashDraft: "Mod+K" } });
    const settings = defaults();
    const store = new SettingsStore(plugin.value, settings);

    await store.load();
    await store.updateSettings({
      composerKeybindings: { ...settings.composerKeybindings, cancelTurn: "Mod+Escape" },
    });

    expect(settings.composerKeybindings).toEqual({
      previousMessage: "ArrowUp",
      stashDraft: "Mod+K",
      cancelTurn: "Mod+Escape",
    });
    expect(plugin.saveData).toHaveBeenCalledWith(expect.objectContaining({
      composerKeybindings: settings.composerKeybindings,
    }));
  });
});

function defaults(): PluginSettings {
  return {
    ...DEFAULT_PLUGIN_SETTINGS,
    developerArgs: [...DEFAULT_PLUGIN_SETTINGS.developerArgs],
    providerKeys: { ...DEFAULT_PLUGIN_SETTINGS.providerKeys },
    composerKeybindings: { ...DEFAULT_PLUGIN_SETTINGS.composerKeybindings },
  };
}

function fakePlugin(data: unknown) {
  const saveData = vi.fn(async (_value: unknown) => {});
  return {
    value: {
      loadData: vi.fn(async () => data),
      saveData,
    } as unknown as Plugin,
    saveData,
  };
}
