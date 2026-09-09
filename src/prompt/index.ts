import type { App } from "obsidian";
import type { VaultContext } from "../types";
import type { WsPromptContextPacket } from "../vendor/chatobby-client/connector-types.js";
import { OBSIDIAN_TOOL_CAPABILITY_CATALOG } from "../vendor/@chatobby/obsidian-protocol/index.js";
import { getObsidianSemanticContextService, getObsidianUiSnapshotService } from "../obsidian-context";
import { collectObsidianCapabilityState } from "../obsidian-bridge/dependency-snapshot";
import { gatherEnvironmentContext } from "./environment";
import {
  CONTEXT_HEADING_MAX_CHARS,
  CONTEXT_MAX_HEADINGS,
  CONTEXT_MAX_OPEN_NOTES,
  CONTEXT_SELECTION_MAX_CHARS,
} from "./constants";

const NEW_SESSION_MESSAGE_COUNT = 0;
const PROMPT_LANDMARK_LIMIT = 8;
const PROMPT_LANDMARK_TEXT_LIMIT = 80;
const RELEVANT_PLUGIN_IDS = new Set(
  OBSIDIAN_TOOL_CAPABILITY_CATALOG.flatMap((descriptor) => [
    ...descriptor.requiredPlugins,
    ...descriptor.enhancedByPlugins,
  ]),
);

export { gatherEnvironmentContext } from "./environment";
export { gatherNoteContext } from "./note-context";
export { gatherOpenNotes } from "./open-notes";
export { resolveImageEmbeds } from "./image-resolver";

/** Volatile per-turn session state supplied by the view, not persisted in note content. */
export interface PromptWorkspaceContext {
  workingDirectory: string;
  sessionMessageCount: number;
  sessionName?: string;
}

/** Advertise connector capabilities without collecting passive note, editor, or UI context. */
export function gatherVaultCapabilities(app: App): NonNullable<VaultContext["capabilities"]> {
  return projectVaultCapabilities(collectObsidianCapabilityState(app));
}

function projectVaultCapabilities(
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

export function gatherVaultContext(app: App, options: { chatobbyVersion?: string } = {}): VaultContext {
  const snapshot = getObsidianSemanticContextService(app).snapshot();
  let uiContext: {
    landmarks: NonNullable<NonNullable<VaultContext["appContext"]>["landmarks"]>;
    inspection: NonNullable<NonNullable<VaultContext["appContext"]>["inspection"]>;
  } | undefined;
  try {
    const ui = getObsidianUiSnapshotService(app).snapshot({ limit: PROMPT_LANDMARK_LIMIT });
    uiContext = {
      landmarks: ui.nodes.map((node) => ({
        ref: node.ref,
        role: node.role,
        ...(node.name ? { name: node.name.slice(0, PROMPT_LANDMARK_TEXT_LIMIT) } : {}),
        ...(node.text ? { text: node.text.slice(0, PROMPT_LANDMARK_TEXT_LIMIT) } : {}),
        ...(node.href ? { href: node.href.slice(0, PROMPT_LANDMARK_TEXT_LIMIT) } : {}),
        ...(node.state.disabled !== undefined ? { disabled: node.state.disabled } : {}),
        ...(node.state.checked !== undefined ? { checked: node.state.checked } : {}),
        ...(node.state.expanded !== undefined ? { expanded: node.state.expanded } : {}),
      })),
      inspection: {
        leafId: ui.leafId,
        documentId: ui.documentId,
        documentRevision: ui.documentRevision,
        ...(ui.page.nextCursor ? { cursor: ui.page.nextCursor } : {}),
      },
    };
  } catch {
    // A view without an inspectable ItemView root still has exact workspace and
    // editor context. Semantic landmarks are an optional bounded enhancement.
  }
  const activeNote = snapshot.activeNote;
  const selection = snapshot.selection?.text;
  const headingCount = snapshot.headings?.length ?? 0;
  const headings = snapshot.headings
    ?.slice(0, CONTEXT_MAX_HEADINGS)
    .map((heading) => heading.text.length > CONTEXT_HEADING_MAX_CHARS
      ? `${heading.text.slice(0, CONTEXT_HEADING_MAX_CHARS - 1)}…`
      : heading.text);
  return {
    frontend: "obsidian",
    vault: app.vault.getName(),
    appContext: {
      contextId: snapshot.contextId,
      sequence: snapshot.sequence,
      capturedAt: snapshot.capturedAt,
      revisions: snapshot.revisions,
      focus: snapshot.focus,
      workspace: {
        leafCount: snapshot.workspace.leaves.length,
        openNoteCount: snapshot.openNotes.length,
      },
      ...(uiContext ?? {}),
    },
    environment: gatherEnvironmentContext(app, { chatobbyVersion: options.chatobbyVersion }),
    capabilities: projectVaultCapabilities(snapshot.capabilities),
    ...(activeNote ? {
      notePath: activeNote.path,
      cursor: snapshot.cursor,
      selection: selection
        ? selection.slice(0, CONTEXT_SELECTION_MAX_CHARS)
        : undefined,
      selectionCharacters: selection?.length,
      selectionTruncated: selection !== undefined && selection.length > CONTEXT_SELECTION_MAX_CHARS,
      contextExcerpt: {
        fromLine: activeNote.fromLine,
        toLine: activeNote.toLine,
        text: activeNote.excerpt,
      },
      headings,
      headingCount,
      headingsTruncated: headingCount > CONTEXT_MAX_HEADINGS,
    } : {}),
    openNotes: snapshot.openNotes
      .slice(0, CONTEXT_MAX_OPEN_NOTES)
      .map((note) => ({ path: note.path, title: note.title })),
  };
}

export function toPromptContextPacket(
  context: VaultContext,
  workspace?: PromptWorkspaceContext,
): WsPromptContextPacket {
  const selection = context.selection?.slice(0, CONTEXT_SELECTION_MAX_CHARS);
  const selectionCharacters = context.selectionCharacters ?? context.selection?.length;
  const headings = context.headings
    ?.slice(0, CONTEXT_MAX_HEADINGS)
    .map((heading) => heading.length > CONTEXT_HEADING_MAX_CHARS
      ? `${heading.slice(0, CONTEXT_HEADING_MAX_CHARS - 1)}…`
      : heading);
  const headingCount = context.headingCount ?? context.headings?.length;
  const integrations = context.capabilities?.integrations
    .filter((integration) => RELEVANT_PLUGIN_IDS.has(integration.id));
  const included: WsPromptContextPacket["privacy"]["included"] = [];
  if (workspace) included.push("workspace");
  if (context.appContext) included.push("app-state");
  if (context.appContext?.landmarks?.length) included.push("visible-landmarks");
  if (context.environment) included.push("environment");
  if (context.capabilities) included.push("capabilities");
  if (context.notePath) included.push("active-note");
  if (selection) included.push("selection");
  if (context.contextExcerpt) included.push("excerpt");
  if (headings?.length) included.push("headings");
  if (context.openNotes?.length) included.push("open-notes");
  return {
    schemaVersion: 2,
    source: "obsidian",
    vault: context.vault,
    workspace: workspace ? {
      workingDirectory: workspace.workingDirectory || ".",
      activeSurface: context.notePath ? "note" : context.appContext?.focus ? "view" : "vault",
      isNewSession: workspace.sessionMessageCount === NEW_SESSION_MESSAGE_COUNT,
      sessionMessageCount: workspace.sessionMessageCount,
      sessionName: workspace.sessionName,
    } : undefined,
    appContext: context.appContext,
    environment: context.environment ? {
      time: context.environment.time,
      locale: context.environment.locale,
      device: context.environment.device ? { platform: context.environment.device.platform } : undefined,
      app: context.environment.app,
		fileConventions: context.environment.fileConventions,
    } : undefined,
    capabilities: context.capabilities ? {
      featureFamilies: context.capabilities.featureFamilies,
      integrations: integrations ?? [],
      runtimeDependencies: context.capabilities.runtimeDependencies,
    } : undefined,
    activeNote: context.notePath ? {
      path: context.notePath,
      cursor: context.cursor,
      selection,
      selectionCharacters,
      selectionTruncated:
        context.selectionTruncated === true
        || (selectionCharacters !== undefined && selectionCharacters > CONTEXT_SELECTION_MAX_CHARS),
      excerpt: context.contextExcerpt,
      headings,
      headingCount,
      headingsTruncated:
        context.headingsTruncated === true
        || (headingCount !== undefined && headingCount > CONTEXT_MAX_HEADINGS),
    } : undefined,
    openNotes: context.openNotes?.slice(0, CONTEXT_MAX_OPEN_NOTES),
    privacy: {
      included,
      omitted: ["note body outside excerpt", "device fingerprint", "display metrics", "vault files not open", "unrelated plugin inventory"],
    },
  };
}
