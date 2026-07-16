import type { App } from "obsidian";
import type { VaultContext } from "../types";
import { collectObsidianCapabilityState } from "../obsidian-bridge/dependency-snapshot";
import { OBSIDIAN_TOOL_CAPABILITY_CATALOG } from "../vendor/@chatobby/obsidian-protocol/tool-capabilities";
import type { WsPromptContextPacket } from "../vendor/chatobby-client/connector-types.js";
import { gatherEnvironmentContext } from "./environment";
import { gatherNoteContext } from "./note-context";
import { gatherOpenNotes } from "./open-notes";

const NEW_SESSION_MESSAGE_COUNT = 0;

export { gatherEnvironmentContext } from "./environment";
export { gatherNoteContext } from "./note-context";
export { gatherOpenNotes } from "./open-notes";
export { resolveImageEmbeds } from "./image-resolver";

/** Volatile per-turn session state supplied by the view, not persisted in note content. */
export interface PromptWorkspaceContext {
  workingDirectory: string;
  sessionMessageCount: number;
  sessionName?: string;
  permissionMode?: string;
}

export function gatherVaultContext(app: App, options: { chatobbyVersion?: string } = {}): VaultContext {
  const capabilityState = collectObsidianCapabilityState(app);
  const pluginById = new Map(capabilityState.plugins.map((plugin) => [plugin.id, plugin]));
  const relevantPluginIds = new Set(OBSIDIAN_TOOL_CAPABILITY_CATALOG.flatMap((descriptor) => [
    ...descriptor.requiredPlugins,
    ...descriptor.enhancedByPlugins,
  ]));
  return {
    frontend: "obsidian",
    vault: app.vault.getName(),
    environment: gatherEnvironmentContext(app, { chatobbyVersion: options.chatobbyVersion }),
    capabilities: {
      featureFamilies: [...capabilityState.capabilities],
      integrations: [...relevantPluginIds].sort().map((id) => {
        const plugin = pluginById.get(id);
        return {
          id,
          name: plugin?.name ?? id,
          installed: plugin?.installed ?? false,
          enabled: plugin?.enabled ?? false,
        };
      }),
      runtimeDependencies: capabilityState.runtimeDependencies.map((dependency) => ({ ...dependency })),
    },
    ...gatherNoteContext(app),
    openNotes: gatherOpenNotes(app),
  };
}

export function toPromptContextPacket(
  context: VaultContext,
  workspace?: PromptWorkspaceContext,
): WsPromptContextPacket {
  const included: WsPromptContextPacket["privacy"]["included"] = [];
  if (workspace) included.push("workspace");
  if (context.environment) included.push("environment");
  if (context.capabilities) included.push("capabilities");
  if (context.notePath) included.push("active-note");
  if (context.selection) included.push("selection");
  if (context.contextExcerpt) included.push("excerpt");
  if (context.headings?.length) included.push("headings");
  if (context.openNotes?.length) included.push("open-notes");
  return {
    schemaVersion: 1,
    source: "obsidian",
    vault: context.vault,
    workspace: workspace ? {
      workingDirectory: workspace.workingDirectory || ".",
      activeSurface: context.notePath ? "note" : "vault",
      isNewSession: workspace.sessionMessageCount === NEW_SESSION_MESSAGE_COUNT,
      sessionMessageCount: workspace.sessionMessageCount,
      sessionName: workspace.sessionName,
      permissionMode: workspace.permissionMode,
    } : undefined,
    environment: context.environment ? {
      time: context.environment.time,
      locale: context.environment.locale,
      device: context.environment.device ? { platform: context.environment.device.platform } : undefined,
      app: context.environment.app,
    } : undefined,
    capabilities: context.capabilities,
    activeNote: context.notePath ? {
      path: context.notePath,
      cursor: context.cursor,
      selection: context.selection,
      excerpt: context.contextExcerpt,
      headings: context.headings,
    } : undefined,
    openNotes: context.openNotes,
    privacy: {
      included,
      omitted: ["note body outside excerpt", "device fingerprint", "display metrics", "vault files not open", "unrelated plugin inventory"],
    },
  };
}
