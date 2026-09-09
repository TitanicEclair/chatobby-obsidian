// Operation registry — single flat map of operation name → handler.
//
// Validates the operation name via isOperationName, dispatches to the handler,
// The connector implements only operations that require the live Obsidian
// process. CLI and generic process execution are runtime-owned.
//
// See docs/wire-protocol.md for dispatch ownership. Operation registration is
// the executable catalogue; do not duplicate it in documentation.

import type { App } from "obsidian";
import type { ObsidianOperationName } from "../vendor/@chatobby/obsidian-protocol/index.js";
import { isOperationName } from "../vendor/@chatobby/obsidian-protocol/index.js";
import type { OperationHandler } from "./types";
import { BridgeError } from "./types";

import {
  handleContextGet,
  handleNoteResolve,
} from "./operations/core-operations";

import {
  handleLinksAudit,
  handleAttachmentImport,
} from "./operations/plugin-native-operations";

// Plugin-native live-process handlers: editor and workspace.
import {
  handleEditorGet,
  handleEditorEdit,
  handleEditorFocus,
  handleEditorHistory,
  handleWorkspaceGet,
  handleWorkspaceManage,
} from "./operations/workspace-operations";

// Visible Obsidian ItemView semantic inspection and guarded interaction.
import {
  handleUiInteract,
  handleUiSnapshot,
} from "./operations/ui-operations";

// Browser handlers (Web viewer core plugin).
import {
  handleBrowserOpen,
  handleBrowserNavigate,
  handleBrowserList,
  handleBrowserSnapshot,
  handleBrowserRead,
  handleBrowserDom,
  handleBrowserClick,
  handleBrowserPointer,
  handleBrowserType,
  handleBrowserPress,
  handleBrowserWait,
  handleBrowserScreenshot,
  handleBrowserDiagnostics,
  handleBrowserClose,
} from "./operations/browser-operations";

/**
 * The complete operation → handler map. Adding an operation is one line here.
 */
const HANDLERS: Record<string, OperationHandler> = {
  "context.get": handleContextGet,
  "note.resolve": handleNoteResolve,

  "links.audit": handleLinksAudit,
  "attachment.import": handleAttachmentImport,

  // ── Plugin-native live process ──
  "editor.get": handleEditorGet,
  "editor.edit": handleEditorEdit,
  "editor.focus": handleEditorFocus,
  "editor.history": handleEditorHistory,
  "workspace.get": handleWorkspaceGet,
  "workspace.manage": handleWorkspaceManage,

  // ── Visible Obsidian UI ──
  "ui.snapshot": handleUiSnapshot,
  "ui.interact": handleUiInteract,

  // ── Browser (Web viewer) ──
  "browser.open": handleBrowserOpen,
  "browser.navigate": handleBrowserNavigate,
  "browser.list": handleBrowserList,
  "browser.snapshot": handleBrowserSnapshot,
  "browser.read": handleBrowserRead,
  "browser.dom": handleBrowserDom,
  "browser.click": handleBrowserClick,
  "browser.pointer": handleBrowserPointer,
  "browser.type": handleBrowserType,
  "browser.press": handleBrowserPress,
  "browser.wait": handleBrowserWait,
  "browser.screenshot": handleBrowserScreenshot,
  "browser.diagnostics": handleBrowserDiagnostics,
  "browser.close": handleBrowserClose,

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
