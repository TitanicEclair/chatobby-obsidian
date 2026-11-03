import type { App, TFile } from "obsidian";
import { BridgeError } from "../obsidian-bridge/types";
import { getObsidianSemanticContextService } from "./semantic-context-service";
import { captureTree, focusedState, hashText, MAX_CAPTURED_NODES } from "./ui/tree-capture";
import { performInteraction } from "./ui/interaction";
import type { CapturedTree, RetainedDocument, CursorRecord, ObsidianUiSnapshotInput, ObsidianUiInteractInput, ObsidianUiSnapshot, ObsidianUiInteractionResult, ObsidianUiDiagnostics } from "./ui/types";
export type { ObsidianUiNodeState, ObsidianUiNode, ObsidianUiSnapshotInput, ObsidianUiInteractInput, ObsidianUiSnapshot, ObsidianUiInteractionResult, ObsidianUiDiagnostics } from "./ui/types";

const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 200;
const MAX_RETAINED_DOCUMENTS = 16;
const DOCUMENT_TTL_MS = 5 * 60_000;
const services = new WeakMap<App, ObsidianUiSnapshotService>();

interface ViewLike {
  contentEl?: HTMLElement;
  containerEl?: HTMLElement;
  file?: TFile | null;
  getViewType?: () => string;
  getDisplayText?: () => string;
}

interface LeafLike {
  id?: string;
  view?: ViewLike;
}

interface WorkspaceLike {
  activeLeaf?: LeafLike | null;
  getMostRecentLeaf?: () => LeafLike | null;
}

function activeLeaf(app: App): LeafLike | undefined {
	const workspace = app.workspace as unknown as WorkspaceLike;
	return workspace.activeLeaf ?? workspace.getMostRecentLeaf?.() ?? undefined;
}

function viewRoot(view: ViewLike | undefined): HTMLElement | null {
  return view?.contentEl ?? view?.containerEl ?? null;
}

/** Owns retained documents, revision checks, paging, diagnostics and App-scoped lifetime. */
export class ObsidianUiSnapshotService {
  private readonly documents = new Map<string, RetainedDocument>();
  private readonly cursors = new Map<string, CursorRecord>();
  private readonly refDocuments = new Map<string, string>();
  private readonly diagnosticState: ObsidianUiDiagnostics = {
    snapshots: 0,
    interactions: 0,
    treeCaptures: 0,
    scannedElements: 0,
    semanticNodes: 0,
    lastTraversalMs: 0,
    maxTraversalMs: 0,
  };

  constructor(
    private readonly app: App,
    private readonly now: () => number = () => Date.now(),
    private readonly monotonicNow: () => number = () => window.performance?.now() ?? Date.now(),
  ) {}

  snapshot(input: ObsidianUiSnapshotInput, signal?: AbortSignal): ObsidianUiSnapshot {
    this.diagnosticState.snapshots += 1;
    this.prune();
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, input.limit ?? DEFAULT_PAGE_SIZE));
    if (input.cursor) return this.continueSnapshot(input.cursor, limit);

    const leaf = activeLeaf(this.app);
    if (!leaf?.id) throw new BridgeError("OBSIDIAN_OPERATION_FAILED", "No active Obsidian leaf with a stable id");
    if (input.leafId && input.leafId !== leaf.id) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        `The active Obsidian leaf changed from '${input.leafId}' to '${leaf.id}'. Take a fresh snapshot.`,
        false,
        { expectedLeafId: input.leafId, currentLeafId: leaf.id },
      );
    }
    const semantic = getObsidianSemanticContextService(this.app).snapshot();
    const root = viewRoot(leaf.view);
    const tree = root
      ? this.captureTree(root, signal)
      : { nodes: [], scannedElements: 0, availableNodes: 0, fingerprint: hashText("") };
    const documentId = `doc_${crypto.randomUUID()}`;
    const documentRevision = `${semantic.revisions.page}.${tree.fingerprint}`;
    const warnings: string[] = [];
    if (!root) warnings.push("The active ItemView does not expose a visible content root.");
    if (tree.availableNodes > tree.nodes.length) {
      warnings.push(`Only the first ${MAX_CAPTURED_NODES} semantic nodes were retained; narrow the visible view before interacting beyond that prefix.`);
    }
    const view = {
      viewType: leaf.view?.getViewType?.() ?? semantic.focus?.viewType ?? "unknown",
      ...(leaf.view?.getDisplayText?.() ? { title: leaf.view.getDisplayText() } : {}),
      ...(leaf.view?.file?.path ? { path: leaf.view.file.path } : {}),
    };
    const document: RetainedDocument = {
      documentId,
      documentRevision,
      contextId: semantic.contextId,
      leafId: leaf.id,
      pageRevision: semantic.revisions.page,
      capturedAt: new Date(this.now()).toISOString(),
      expiresAt: this.now() + DOCUMENT_TTL_MS,
      view,
      focus: root ? focusedState(root, tree.nodes) : {},
      nodes: tree.nodes,
      availableNodes: tree.availableNodes,
      fingerprint: tree.fingerprint,
      workspace: {
        ...(semantic.workspace.activeLeafId ? { activeLeafId: semantic.workspace.activeLeafId } : {}),
        leaves: semantic.workspace.leaves,
        ...(semantic.workspace.layout ? { layout: semantic.workspace.layout } : {}),
      },
      warnings,
    };
    this.retain(document);
    return this.page(document, 0, limit);
  }

	interact(input: ObsidianUiInteractInput, signal?: AbortSignal): ObsidianUiInteractionResult {
		this.diagnosticState.interactions += 1;
		this.prune();
		if (signal?.aborted) throw new BridgeError("OPERATION_CANCELLED", "Obsidian UI interaction was cancelled");
		if (!input.ref || !input.documentRevision) {
			throw new BridgeError("INVALID_INPUT", "Obsidian UI interaction requires a ref and documentRevision");
		}
		if (!["click", "focus", "set_expanded", "set_value"].includes(input.action)) {
			throw new BridgeError("INVALID_INPUT", `Unsupported Obsidian UI action '${String(input.action)}'`);
		}
    const documentId = this.refDocuments.get(input.ref);
    const retained = documentId ? this.documents.get(documentId) : undefined;
    if (!retained) {
      throw new BridgeError("RESULT_EXPIRED", "The Obsidian UI ref expired. Take a fresh obsidian_ui_snapshot.", false);
    }
    if (input.documentRevision !== retained.documentRevision) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        "The supplied Obsidian UI document revision does not match the referenced snapshot.",
        false,
        { expected: retained.documentRevision, received: input.documentRevision },
      );
    }
    const leaf = activeLeaf(this.app);
    const root = viewRoot(leaf?.view);
    const semanticService = getObsidianSemanticContextService(this.app);
    const semantic = semanticService.snapshot();
    if (!leaf?.id || leaf.id !== retained.leafId || semantic.contextId !== retained.contextId || !root) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        "The active Obsidian view changed. Take a fresh obsidian_ui_snapshot.",
        false,
        {
          expectedLeafId: retained.leafId,
          currentLeafId: leaf?.id,
          expectedContextId: retained.contextId,
          currentContextId: semantic.contextId,
        },
      );
    }
    const currentTree = this.captureTree(root, signal);
    if (semantic.revisions.page !== retained.pageRevision || currentTree.fingerprint !== retained.fingerprint) {
      throw new BridgeError(
        "REVISION_CONFLICT",
        "The visible Obsidian UI changed after the ref was captured. Take a fresh snapshot.",
        false,
        {
          expectedPageRevision: retained.pageRevision,
          currentPageRevision: semantic.revisions.page,
          fingerprintChanged: currentTree.fingerprint !== retained.fingerprint,
        },
      );
    }
    const captured = retained.nodes.find((entry) => entry.node.ref === input.ref);
    if (!captured || !root.contains(captured.element)) {
      throw new BridgeError("RESULT_EXPIRED", "The referenced Obsidian UI element is no longer available. Take a fresh snapshot.");
    }
    performInteraction(captured.element, input);
    semanticService.invalidate(input.action === "focus" ? ["focus", "page"] : ["page"]);
    const updated = semanticService.snapshot();
    this.dropDocument(retained.documentId);
    return {
      performed: true,
      action: input.action,
      ref: input.ref,
      documentId: retained.documentId,
      previousRevision: retained.documentRevision,
      currentPageRevision: updated.revisions.page,
      refreshRequired: true,
    };
  }

  private continueSnapshot(cursor: string, limit: number): ObsidianUiSnapshot {
    const record = this.cursors.get(cursor);
    const document = record ? this.documents.get(record.documentId) : undefined;
    if (!record || !document || record.expiresAt <= this.now()) {
      this.cursors.delete(cursor);
      throw new BridgeError("RESULT_EXPIRED", "The Obsidian UI cursor expired. Take a fresh snapshot.", false);
    }
    return this.page(document, record.offset, limit);
  }

  diagnostics(): ObsidianUiDiagnostics {
    return { ...this.diagnosticState };
  }

  private captureTree(root: HTMLElement, signal?: AbortSignal): CapturedTree {
    const startedAt = this.monotonicNow();
    const tree = captureTree(root, signal);
    const duration = Math.max(0, this.monotonicNow() - startedAt);
    this.diagnosticState.treeCaptures += 1;
    this.diagnosticState.scannedElements += tree.scannedElements;
    this.diagnosticState.semanticNodes += tree.availableNodes;
    this.diagnosticState.lastTraversalMs = duration;
    this.diagnosticState.maxTraversalMs = Math.max(this.diagnosticState.maxTraversalMs, duration);
    return tree;
  }

  private page(document: RetainedDocument, offset: number, limit: number): ObsidianUiSnapshot {
    const pageNodes = document.nodes.slice(offset, offset + limit).map((entry) => entry.node);
    const nextOffset = offset + pageNodes.length;
    const nextCursor = nextOffset < document.nodes.length ? this.createCursor(document, nextOffset) : undefined;
    return {
      schemaVersion: 1,
      contextId: document.contextId,
      leafId: document.leafId,
      documentId: document.documentId,
      documentRevision: document.documentRevision,
      capturedAt: document.capturedAt,
      view: document.view,
      focus: document.focus,
      nodes: pageNodes,
      page: {
        returned: pageNodes.length,
        total: document.nodes.length,
        ...(nextCursor ? { nextCursor } : {}),
        truncated: Boolean(nextCursor) || document.availableNodes > document.nodes.length,
      },
      coverage: {
        kind: document.availableNodes > document.nodes.length ? "visible_item_view_prefix" : "visible_item_view",
        exact: document.availableNodes === document.nodes.length,
        availableNodes: document.availableNodes,
        capturedNodes: document.nodes.length,
        hardLimit: MAX_CAPTURED_NODES,
      },
      workspace: document.workspace,
      warnings: document.warnings,
    };
  }

  private createCursor(document: RetainedDocument, offset: number): string {
    const cursor = `cur_${crypto.randomUUID()}`;
    this.cursors.set(cursor, {
      documentId: document.documentId,
      offset,
      expiresAt: document.expiresAt,
    });
    return cursor;
  }

  private retain(document: RetainedDocument): void {
    while (this.documents.size >= MAX_RETAINED_DOCUMENTS) {
      const oldest = this.documents.keys().next().value as string | undefined;
      if (!oldest) break;
      this.dropDocument(oldest);
    }
    this.documents.set(document.documentId, document);
    for (const node of document.nodes) this.refDocuments.set(node.node.ref, document.documentId);
  }

  private dropDocument(documentId: string): void {
    const document = this.documents.get(documentId);
    if (document) {
      for (const node of document.nodes) this.refDocuments.delete(node.node.ref);
    }
    this.documents.delete(documentId);
    for (const [cursor, record] of this.cursors) {
      if (record.documentId === documentId) this.cursors.delete(cursor);
    }
  }

  private prune(): void {
    const now = this.now();
    for (const [documentId, document] of this.documents) {
      if (document.expiresAt <= now) this.dropDocument(documentId);
    }
    for (const [cursor, record] of this.cursors) {
      if (record.expiresAt <= now) this.cursors.delete(cursor);
    }
  }
}

export function getObsidianUiSnapshotService(app: App): ObsidianUiSnapshotService {
  const existing = services.get(app);
  if (existing) return existing;
  const service = new ObsidianUiSnapshotService(app);
  services.set(app, service);
  return service;
}

export function disposeObsidianUiSnapshotService(app: App): void {
  services.delete(app);
}
