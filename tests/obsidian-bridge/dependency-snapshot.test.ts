import type { App } from "obsidian";
import { describe, expect, it } from "vitest";
import {
  capabilityStateFingerprint,
  collectObsidianCapabilityState,
} from "../../src/obsidian-bridge/dependency-snapshot";

describe("Obsidian dependency snapshot", () => {
  it("distinguishes installed, enabled, and core plugin states", () => {
    const app = {
      plugins: {
        enabledPlugins: new Set(["smart-connections"]),
        manifests: {
          "smart-connections": { name: "Smart Connections", version: "3.0.0" },
          dataview: { name: "Dataview", version: "0.5.0" },
        },
      },
      internalPlugins: {
        plugins: {
          webviewer: { enabled: true, manifest: { name: "Web viewer" } },
          sync: { enabled: false, manifest: { name: "Sync" } },
        },
      },
    } as unknown as App;

    const state = collectObsidianCapabilityState(app);

    expect(state.plugins).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "smart-connections", kind: "community", installed: true, enabled: true }),
      expect.objectContaining({ id: "dataview", kind: "community", installed: true, enabled: false }),
      expect.objectContaining({ id: "webviewer", kind: "core", installed: true, enabled: true }),
      expect.objectContaining({ id: "sync", kind: "core", installed: true, enabled: false }),
    ]));
    expect(state.runtimeDependencies).toEqual([]);
  });

  it("changes its fingerprint when an integration is enabled", () => {
    const disabled = {
      capabilities: [],
      plugins: [{
        id: "dataview",
        name: "Dataview",
        kind: "community" as const,
        installed: true,
        enabled: false,
      }],
      runtimeDependencies: [],
    };
    const enabled = {
      ...disabled,
      plugins: [{ ...disabled.plugins[0], enabled: true }],
    };

    expect(capabilityStateFingerprint(enabled)).not.toBe(capabilityStateFingerprint(disabled));
  });

  it("does not probe runtime-owned executables from the connector", () => {
    const state = collectObsidianCapabilityState({ version: "1.8.0" } as unknown as App);
    expect(state.runtimeDependencies).toEqual([]);
  });
});
