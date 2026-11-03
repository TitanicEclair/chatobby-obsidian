import type { VaultContext } from "./types";
import type { WsPromptContextPacket } from "../vendor/chatobby-client/connector-types.js";
import { RELEVANT_PLUGIN_IDS } from "./capabilities";
import { CONTEXT_HEADING_MAX_CHARS, CONTEXT_MAX_HEADINGS, CONTEXT_MAX_OPEN_NOTES, CONTEXT_SELECTION_MAX_CHARS } from "./constants";

const NEW_SESSION_MESSAGE_COUNT = 0;

/** Volatile per-turn session state supplied by the view, not persisted in note content. */
export interface PromptWorkspaceContext {
  workingDirectory: string;
  sessionMessageCount: number;
  sessionName?: string;
}

/** Project a bounded reference packet; the runtime replaces estimated session facts. */
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
  const openNotes = projectOpenNoteReferences(context.openNotes);
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
  if (openNotes?.length) included.push("open-notes");
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
    openNotes,
    privacy: {
      included,
      omitted: ["note body outside excerpt", "device fingerprint", "display metrics", "vault files not open", "unrelated plugin inventory"],
    },
  };
}

/** TFile paths are canonical vault-relative identities; multiple leaves do not consume extra references. */
function projectOpenNoteReferences(notes: VaultContext["openNotes"]): VaultContext["openNotes"] {
  if (!notes) return undefined;
  const paths = new Set<string>();
  const references: NonNullable<VaultContext["openNotes"]> = [];
  for (const note of notes) {
    if (paths.has(note.path)) continue;
    paths.add(note.path);
    references.push(note);
    if (references.length === CONTEXT_MAX_OPEN_NOTES) break;
  }
  return references;
}
