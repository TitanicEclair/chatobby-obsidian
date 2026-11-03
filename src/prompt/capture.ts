import type { App } from "obsidian";
import type { VaultContext } from "./types";
import { getObsidianSemanticContextService, getObsidianUiSnapshotService } from "../obsidian-context";
import { gatherEnvironmentContext } from "./environment";
import { projectVaultCapabilities } from "./capabilities";
import { CONTEXT_HEADING_MAX_CHARS, CONTEXT_MAX_HEADINGS, CONTEXT_SELECTION_MAX_CHARS } from "./constants";

const PROMPT_LANDMARK_LIMIT = 8;
const PROMPT_LANDMARK_TEXT_LIMIT = 80;

/** Capture observed facts only after the caller has established current collection eligibility. */
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
        capturedAt: ui.capturedAt,
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
    // The packet applies its reference limit after deduplication; leaf counts stay in appContext.
    openNotes: snapshot.openNotes.map((note) => ({ path: note.path, title: note.title })),
  };
}
