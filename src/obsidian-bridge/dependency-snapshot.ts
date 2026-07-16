import { existsSync } from "node:fs";
import { delimiter, extname, isAbsolute, join } from "node:path";
import type { App } from "obsidian";
import type {
  ObsidianCapabilityState,
  ObsidianPluginState,
} from "../vendor/@chatobby/obsidian-protocol/tool-capabilities";
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

/** Capture installed/enabled integrations plus local executable dependencies. */
export function collectObsidianCapabilityState(app: App): ObsidianCapabilityState {
  const registries = app as unknown as {
    plugins?: CommunityPluginRegistry;
    internalPlugins?: CorePluginRegistry;
  };
  return {
    capabilities: [...PLUGIN_CAPABILITIES],
    plugins: [
      ...communityPluginStates(registries.plugins),
      ...corePluginStates(registries.internalPlugins),
    ],
    runtimeDependencies: [{
      id: "obsidian-cli",
      name: "Obsidian CLI",
      available: executableAvailable(process.env.CHATOBBY_OBSIDIAN_CLI_BIN || "obsidian"),
      detail: "Required for CLI-backed daily note, Bases, Sync, plugin, and diagnostics tools.",
    }],
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

function executableAvailable(command: string): boolean {
  const candidate = command.trim().replace(/^['"]|['"]$/g, "");
  if (!candidate) return false;
  if (isAbsolute(candidate) || candidate.includes("/") || candidate.includes("\\")) return existsSync(candidate);
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];
  const suffixes = extname(candidate) ? [""] : extensions;
  for (const directory of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      if (existsSync(join(directory, `${candidate}${suffix}`))) return true;
    }
  }
  return false;
}
