import type { ObsidianCapabilityState, ObsidianContextRevisions } from "../../vendor/@chatobby/obsidian-protocol/index.js";
import type { getVaultIdentity } from "../../obsidian-bridge/operations/helpers/vault-identity";

/** Volatile observations shared by prompt and tool projections; never policy or persisted session state. */
export type ContextInclude = "activeNote" | "selection" | "cursor" | "headings" | "openNotes";
export type SemanticContextScope = "current" | "active-view" | "workspace" | "region" | "leaf";

export interface SemanticContextProjectionInput {
  include?: ContextInclude[];
  maxOpenNotes?: number;
  scope?: SemanticContextScope;
  regionId?: string;
  leafId?: string;
  cursor?: string;
  limit?: number;
}

export interface SemanticContextFocus {
  activeLeafId?: string;
  viewType: string;
  title?: string;
  path?: string;
}

export interface SemanticContextOpenNote {
  leafId?: string;
  path: string;
  basename: string;
  title: string;
  mtime: number;
  ctime: number;
  isActive: boolean;
}

export interface SemanticContextSnapshot {
  schemaVersion: 2;
  contextId: string;
  sequence: number;
  capturedAt: string;
  revisions: ObsidianContextRevisions;
  vault: ReturnType<typeof getVaultIdentity>;
  focus?: SemanticContextFocus;
  activeNote?: {
    path: string;
    basename: string;
    title: string;
    mtime: number;
    ctime: number;
    excerpt: string;
    fromLine: number;
    toLine: number;
  };
  cursor?: { line: number; ch: number };
  selection?: { text: string; from: number; to: number };
  headings?: Array<{ level: number; text: string; heading: string; line: number }>;
  openNotes: SemanticContextOpenNote[];
  workspace: {
    activeLeafId?: string;
    leaves: Array<{
      leafId?: string;
      viewType: string;
      title?: string;
      path?: string;
      url?: string;
      isActive: boolean;
      pinned: boolean;
    }>;
    openNotes: SemanticContextOpenNote[];
    layout?: Record<string, unknown>;
  };
  editor: {
    available: boolean;
    path?: string;
    cursor?: { line: number; ch: number };
    selection?: string;
    lineCount?: number;
    reason?: string;
  };
  capabilities: ObsidianCapabilityState;
  warnings: string[];
}

export interface SemanticContextDiagnostics {
  captures: number;
  emittedEvents: number;
  invalidations: number;
  coalescedInvalidations: number;
  lastCaptureMs: number;
  maxCaptureMs: number;
}
