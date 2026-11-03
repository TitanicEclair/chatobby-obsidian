import type { App } from "obsidian";
import type { VaultContext } from "./types";
import { OBSIDIAN_TOOL_CAPABILITY_CATALOG } from "../vendor/@chatobby/obsidian-protocol/index.js";
import { collectObsidianCapabilityState } from "../obsidian-bridge/dependency-snapshot";

export const RELEVANT_PLUGIN_IDS = new Set(
  OBSIDIAN_TOOL_CAPABILITY_CATALOG.flatMap((descriptor) => [
    ...descriptor.requiredPlugins,
    ...descriptor.enhancedByPlugins,
  ]),
);

/** Advertise connector capabilities without collecting passive note, editor, or UI context. */
export function gatherVaultCapabilities(app: App): NonNullable<VaultContext["capabilities"]> {
  return projectVaultCapabilities(collectObsidianCapabilityState(app));
}

export function projectVaultCapabilities(
  state: ReturnType<typeof collectObsidianCapabilityState>,
): NonNullable<VaultContext["capabilities"]> {
  return {
    featureFamilies: [...state.capabilities],
    integrations: state.plugins
      .filter((plugin) => RELEVANT_PLUGIN_IDS.has(plugin.id) && (plugin.installed || plugin.enabled))
      .map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        installed: plugin.installed,
        enabled: plugin.enabled,
      })),
    runtimeDependencies: state.runtimeDependencies.map((dependency) => ({ ...dependency })),
  };
}
