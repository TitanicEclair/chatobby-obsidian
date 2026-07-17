// Operation registry — single flat map of operation name → handler.
//
// Validates the operation name via isOperationName, dispatches to the handler,
// The connector implements only operations that require the live Obsidian
// process. CLI and generic process execution are runtime-owned.
//
// See docs/tooling/bridge-executor.md §7.3 for the dispatch flow and
// docs/tooling/operation-catalog.md for the full catalog.

import type { App } from "obsidian";
import type { ObsidianOperationName } from "../vendor/@chatobby/obsidian-protocol/bridge-operations";
import { isOperationName } from "../vendor/@chatobby/obsidian-protocol/bridge-operations";
import type { OperationHandler } from "./types";
import { BridgeError } from "./types";

// Core 10 handlers (Phase B).
import {
  handleContextGet,
  handleNoteRead,
  handleVaultSearch,
  handleNoteResolve,
  handleAttachmentRead,
  handleVaultList,
  handleNoteWrite,
  handleNoteEdit,
  handleNoteOpen,
  handleAppOpen,
} from "./operations/core-operations";

// Plugin-native "data" handlers (Phase C): vault/metadata/links/tasks.
import {
  handleRegistryStatus,
  handleMetadataGet,
  handlePropertiesList,
  handleFrontmatterUpdate,
  handleTagsList,
  handleLinksGenerate,
  handleLinksGet,
  handleLinksAudit,
  handleGraphTraverse,
  handleTasksList,
  handleTasksUpdate,
  handleFolderCreate,
  handleEntryCopy,
  handleEntryMove,
  handleEntryTrash,
  handleAttachmentImport,
} from "./operations/plugin-native-operations";

// Plugin-native "runtime" handlers (Phase C): editor/workspace/commands/hotkeys.
import {
  handleEditorGet,
  handleEditorEdit,
  handleEditorFocus,
  handleWorkspaceGet,
  handleWorkspaceManage,
  handleCommandsList,
  handleCommandsExecute,
  handleHotkeysList,
} from "./operations/workspace-operations";

// Browser handlers (Web viewer core plugin).
import {
  handleBrowserOpen,
  handleBrowserNavigate,
  handleBrowserList,
  handleBrowserSnapshot,
  handleBrowserRead,
  handleBrowserDom,
  handleBrowserClick,
  handleBrowserType,
  handleBrowserPress,
  handleBrowserWait,
  handleBrowserScreenshot,
  handleBrowserClose,
} from "./operations/browser-operations";

// Retrieval handlers (Phase D).
import {
  handleRetrievalExplore,
  handleRetrievalTrace,
  handleRetrievalRelated,
  handleRetrievalHubs,
  handleRetrievalCommunities,
  handleRetrievalExplain,
} from "./operations/retrieval-operations";

/**
 * The complete operation → handler map. Adding an operation is one line here.
 */
const HANDLERS: Record<string, OperationHandler> = {
  // ── Core (Phase B) ──
  "context.get": handleContextGet,
  "note.read": handleNoteRead,
  "vault.search": handleVaultSearch,
  "note.resolve": handleNoteResolve,
  "attachment.read": handleAttachmentRead,
  "vault.list": handleVaultList,
  "note.write": handleNoteWrite,
  "note.edit": handleNoteEdit,
  "note.open": handleNoteOpen,
  "app.open": handleAppOpen,

  // ── Plugin-native data (Phase C) ──
  "registry.status": handleRegistryStatus,
  "metadata.get": handleMetadataGet,
  "properties.list": handlePropertiesList,
  "frontmatter.update": handleFrontmatterUpdate,
  "tags.list": handleTagsList,
  "links.generate": handleLinksGenerate,
  "links.get": handleLinksGet,
  "links.audit": handleLinksAudit,
  "graph.traverse": handleGraphTraverse,
  "tasks.list": handleTasksList,
  "tasks.update": handleTasksUpdate,
  "folder.create": handleFolderCreate,
  "entry.copy": handleEntryCopy,
  "entry.move": handleEntryMove,
  "entry.trash": handleEntryTrash,
  "attachment.import": handleAttachmentImport,

  // ── Plugin-native runtime (Phase C) ──
  "editor.get": handleEditorGet,
  "editor.edit": handleEditorEdit,
  "editor.focus": handleEditorFocus,
  "workspace.get": handleWorkspaceGet,
  "workspace.manage": handleWorkspaceManage,
  "commands.list": handleCommandsList,
  "commands.execute": handleCommandsExecute,
  "hotkeys.list": handleHotkeysList,

  // ── Browser (Web viewer) ──
  "browser.open": handleBrowserOpen,
  "browser.navigate": handleBrowserNavigate,
  "browser.list": handleBrowserList,
  "browser.snapshot": handleBrowserSnapshot,
  "browser.read": handleBrowserRead,
  "browser.dom": handleBrowserDom,
  "browser.click": handleBrowserClick,
  "browser.type": handleBrowserType,
  "browser.press": handleBrowserPress,
  "browser.wait": handleBrowserWait,
  "browser.screenshot": handleBrowserScreenshot,
  "browser.close": handleBrowserClose,

  // ── Retrieval (Phase D) ──
  "retrieval.explore": handleRetrievalExplore,
  "retrieval.trace": handleRetrievalTrace,
  "retrieval.related": handleRetrievalRelated,
  "retrieval.hubs": handleRetrievalHubs,
  "retrieval.communities": handleRetrievalCommunities,
  "retrieval.explain": handleRetrievalExplain,

};

/**
 * Execute an operation by name.
 *
 * Validates the operation name, dispatches to the appropriate handler, and
 * enforces the deadline via the provided AbortSignal (handlers cooperate by
 * checking signal.aborted).
 *
 * Throws BridgeError on failure.
 */
export async function executeOperation(
  operation: ObsidianOperationName,
  args: Record<string, unknown>,
  signal: AbortSignal,
  app: App,
): Promise<unknown> {
  // Check abort before dispatching.
  if (signal.aborted) {
    throw new BridgeError("DEADLINE_EXCEEDED", "Request already aborted at dispatch time", true);
  }

  // Validate operation name.
  if (!isOperationName(operation)) {
    throw new BridgeError("UNSUPPORTED_OPERATION", `Unknown operation: ${operation}`, false);
  }

  // Static handler lookup.
  const handler = HANDLERS[operation];
  if (handler) {
    return handler(args, signal, app);
  }

  // Known protocol operations may be runtime-owned and therefore deliberately
  // absent from this connector registry.
  throw new BridgeError("UNSUPPORTED_OPERATION", `No handler for operation: ${operation}`, false);
}

/** The set of operation names with a concrete handler (introspection + drift tests). */
export function listImplementedOperations(): readonly string[] {
  return Object.keys(HANDLERS);
}
