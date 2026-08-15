import type { App } from "obsidian";
import type {
  ObsidianCapabilityState,
  ObsidianPluginState,
} from "../vendor/@chatobby/obsidian-protocol/index.js";
import { PLUGIN_CAPABILITIES } from "./capabilities";

interface CommunityPluginRegistry {
  enabledPlugins?: Set<string> | string[];
  manifests?: Record<string, { id?: string; name?: string; version?: string }>;
}

interface CorePluginRecord {
  enabled?: boolean;
  manifest?: { id?: string; name?: string; version?: string };
}

interface CorePluginRegistry {
  plugins?: Record<string, CorePluginRecord>;
}

/** Capture installed/enabled integrations and connector-owned capabilities. */
export function collectObsidianCapabilityState(app: App): ObsidianCapabilityState {
  const registries = app as unknown as {
    version?: string;
    plugins?: CommunityPluginRegistry;
    internalPlugins?: CorePluginRegistry;
  };
  return {
    capabilities: [...PLUGIN_CAPABILITIES],
    plugins: [
      ...communityPluginStates(registries.plugins),
      ...corePluginStates(registries.internalPlugins),
    ],
    runtimeDependencies: [],
  };
}

export function capabilityStateFingerprint(state: ObsidianCapabilityState): string {
  return JSON.stringify({
    capabilities: [...state.capabilities].sort(),
    plugins: [...state.plugins]
      .map((plugin) => ({ id: plugin.id, version: plugin.version, kind: plugin.kind, enabled: plugin.enabled }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    runtimeDependencies: [...state.runtimeDependencies]
      .map((dependency) => ({ id: dependency.id, available: dependency.available }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  });
}

function communityPluginStates(registry: CommunityPluginRegistry | undefined): ObsidianPluginState[] {
  const enabled = new Set(registry?.enabledPlugins instanceof Set
    ? [...registry.enabledPlugins]
    : registry?.enabledPlugins ?? []);
  return Object.entries(registry?.manifests ?? {}).map(([id, manifest]) => ({
    id,
    name: manifest.name ?? id,
    ...(manifest.version ? { version: manifest.version } : {}),
    kind: "community",
    installed: true,
    enabled: enabled.has(id),
  }));
}

function corePluginStates(registry: CorePluginRegistry | undefined): ObsidianPluginState[] {
  return Object.entries(registry?.plugins ?? {}).map(([id, plugin]) => ({
    id,
    name: plugin.manifest?.name ?? id,
    ...(plugin.manifest?.version ? { version: plugin.manifest.version } : {}),
    kind: "core",
    installed: true,
    enabled: plugin.enabled === true,
  }));
}
