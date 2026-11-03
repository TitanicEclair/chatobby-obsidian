/** Transient DOM observations and retained references; service lifetime and revision checks govern their use. */
type UiAction = "click" | "focus" | "set_expanded" | "set_value";

export interface ObsidianUiNodeState {
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
  checked?: boolean;
  pressed?: boolean;
  current?: string;
  valueRedacted?: boolean;
}

export interface ObsidianUiNode {
  ref: string;
  parentRef?: string;
  depth: number;
  role: string;
  tag: string;
  type?: string;
  name?: string;
  text?: string;
  description?: string;
  href?: string;
  value?: string;
  state: ObsidianUiNodeState;
}

export interface CapturedNode {
  node: ObsidianUiNode;
  element: Element;
}

export interface CapturedTree {
  nodes: CapturedNode[];
  scannedElements: number;
  availableNodes: number;
  fingerprint: string;
}

export interface RetainedDocument {
  documentId: string;
  documentRevision: string;
  contextId: string;
  leafId: string;
  pageRevision: number;
  capturedAt: string;
  expiresAt: number;
  view: { viewType: string; title?: string; path?: string };
  focus: {
    ref?: string;
    role?: string;
    name?: string;
    caret?: { start: number; end: number; direction?: "forward" | "backward" | "none" };
  };
  nodes: CapturedNode[];
  availableNodes: number;
  fingerprint: string;
  workspace: {
    activeLeafId?: string;
    leaves: Array<Record<string, unknown>>;
    layout?: Record<string, unknown>;
  };
  warnings: string[];
}

export interface CursorRecord {
  documentId: string;
  offset: number;
  expiresAt: number;
}

export interface ObsidianUiSnapshotInput {
  leafId?: string;
  cursor?: string;
  limit?: number;
}

export interface ObsidianUiInteractInput {
  ref: string;
  documentRevision: string;
  action: UiAction;
  value?: string;
  expanded?: boolean;
}

export interface ObsidianUiSnapshot {
  schemaVersion: 1;
  contextId: string;
  leafId: string;
  documentId: string;
  documentRevision: string;
  capturedAt: string;
  view: RetainedDocument["view"];
  focus: RetainedDocument["focus"];
  nodes: ObsidianUiNode[];
  page: {
    returned: number;
    total: number;
    nextCursor?: string;
    truncated: boolean;
  };
  coverage: {
    kind: "visible_item_view" | "visible_item_view_prefix";
    exact: boolean;
    availableNodes: number;
    capturedNodes: number;
    hardLimit: number;
  };
  workspace: RetainedDocument["workspace"];
  warnings: string[];
}

export interface ObsidianUiInteractionResult {
  performed: true;
  action: UiAction;
  ref: string;
  documentId: string;
  previousRevision: string;
  currentPageRevision: number;
  refreshRequired: true;
}

export interface ObsidianUiDiagnostics {
  snapshots: number;
  interactions: number;
  treeCaptures: number;
  scannedElements: number;
  semanticNodes: number;
  lastTraversalMs: number;
  maxTraversalMs: number;
}
