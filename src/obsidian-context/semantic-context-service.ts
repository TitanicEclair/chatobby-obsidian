import type { App, EventRef } from "obsidian";
import type { ObsidianBridgeContextChanged, ObsidianContextChangedDomain, ObsidianContextRevisions } from "../vendor/@chatobby/obsidian-protocol/index.js";
import { captureSemanticSnapshot, captureEditorForPath } from "./semantic/capture";
import { projectSemanticContext } from "./semantic/projection";
import type { SemanticContextSnapshot, SemanticContextDiagnostics, SemanticContextProjectionInput } from "./semantic/types";
export type { SemanticContextFocus, SemanticContextOpenNote, SemanticContextSnapshot, SemanticContextDiagnostics, SemanticContextProjectionInput, SemanticContextScope } from "./semantic/types";

interface EventSource {
  on?(name: string, callback: (...args: unknown[]) => unknown): EventRef;
  offref?(ref: EventRef): void;
}

const EVENT_COALESCE_MS = 75;
const CURSOR_EVENT_COALESCE_MS = 200;
const services = new WeakMap<App, ObsidianSemanticContextService>();

/**
 * One connector-owned authority for volatile Obsidian state. Prompt context and
 * bridge projections are derived from the same snapshot instead of independently
 * guessing which leaf, editor buffer, or plugin inventory is current.
 */
export class ObsidianSemanticContextService {
  private readonly contextId = crypto.randomUUID();
  private readonly listeners = new Set<(event: ObsidianBridgeContextChanged) => void>();
  private readonly eventRefs: Array<{ source: EventSource; ref: EventRef }> = [];
  private readonly domDisposers: Array<() => void> = [];
  private readonly pendingDomains = new Set<ObsidianContextChangedDomain>();
  private readonly revisions: ObsidianContextRevisions = {
    workspace: 1,
    editor: 1,
    page: 1,
    capabilities: 1,
  };
  private sequence = 1;
  private flushTimer: number | null = null;
  private started = false;
  private currentSnapshot: SemanticContextSnapshot | undefined;
  private readonly diagnosticState: SemanticContextDiagnostics = {
    captures: 0,
    emittedEvents: 0,
    invalidations: 0,
    coalescedInvalidations: 0,
    lastCaptureMs: 0,
    maxCaptureMs: 0,
  };

  constructor(
    private readonly app: App,
    private readonly now: () => Date = () => new Date(),
    private readonly monotonicNow: () => number = () => window.performance?.now() ?? Date.now(),
  ) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    const workspace = this.app.workspace as unknown as EventSource;
    const vault = this.app.vault as unknown as EventSource;
    this.listen(workspace, "active-leaf-change", ["focus", "workspace", "editor", "page"]);
    this.listen(workspace, "file-open", ["focus", "workspace", "editor", "page"]);
    this.listen(workspace, "layout-change", ["focus", "workspace", "page", "capabilities"]);
    this.listen(workspace, "window-open", ["focus", "workspace", "page"]);
    this.listen(workspace, "window-close", ["focus", "workspace", "page"]);
    this.listen(workspace, "editor-change", ["editor", "page"]);
    this.listen(vault, "modify", ["editor", "page"]);
    this.listen(vault, "create", ["workspace", "page"]);
    this.listen(vault, "delete", ["workspace", "editor", "page"]);
    this.listen(vault, "rename", ["workspace", "editor", "page"]);
    const document = window.document;
    const handleSelectionChange = (): void => {
      const active = document.activeElement;
      if (!active?.closest(".markdown-source-view, .cm-editor")) return;
      this.invalidate(["editor", "page"], CURSOR_EVENT_COALESCE_MS);
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    this.domDisposers.push(() => document.removeEventListener("selectionchange", handleSelectionChange));
  }

  dispose(): void {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    for (const { source, ref } of this.eventRefs) source.offref?.(ref);
    this.eventRefs.length = 0;
    for (const dispose of this.domDisposers) dispose();
    this.domDisposers.length = 0;
    this.pendingDomains.clear();
    this.listeners.clear();
    this.started = false;
  }

  onChange(listener: (event: ObsidianBridgeContextChanged) => void): () => void {
    this.start();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  invalidate(
    domains: readonly ObsidianContextChangedDomain[],
    coalesceMs = EVENT_COALESCE_MS,
  ): void {
    this.diagnosticState.invalidations += 1;
    for (const domain of domains) this.pendingDomains.add(domain);
    if (this.flushTimer !== null) {
      this.diagnosticState.coalescedInvalidations += 1;
      return;
    }
    this.flushTimer = window.setTimeout(() => this.flushPending(), coalesceMs);
  }

  snapshot(): SemanticContextSnapshot {
    this.start();
    this.flushPending();
    this.currentSnapshot ??= this.capture();
    return this.currentSnapshot;
  }

  diagnostics(): SemanticContextDiagnostics {
    return { ...this.diagnosticState };
  }

  contextProjection(input: SemanticContextProjectionInput = {}): Record<string, unknown> {
    return projectSemanticContext(this.snapshot(), input);
  }

  workspaceProjection(): SemanticContextSnapshot["workspace"] & {
    schemaVersion: 2;
    contextId: string;
    sequence: number;
    capturedAt: string;
    revision: number;
  } {
    const snapshot = this.snapshot();
    return {
      schemaVersion: 2,
      contextId: snapshot.contextId,
      sequence: snapshot.sequence,
      capturedAt: snapshot.capturedAt,
      revision: snapshot.revisions.workspace,
      ...snapshot.workspace,
    };
  }

  editorProjection(path?: string): SemanticContextSnapshot["editor"] & {
    schemaVersion: 2;
    contextId: string;
    sequence: number;
    capturedAt: string;
    revision: number;
  } {
    const snapshot = path ? this.captureForPath(path) : this.snapshot();
    return {
      schemaVersion: 2,
      contextId: snapshot.contextId,
      sequence: snapshot.sequence,
      capturedAt: snapshot.capturedAt,
      revision: snapshot.revisions.editor,
      ...snapshot.editor,
    };
  }

  private listen(
    source: EventSource,
    name: string,
    domains: readonly ObsidianContextChangedDomain[],
  ): void {
    const ref = source.on?.(name, () => this.invalidate(domains));
    if (!ref) return;
    this.eventRefs.push({ source, ref });
  }

  private flushPending(): void {
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pendingDomains.size === 0) return;
    const changed = [...this.pendingDomains];
    this.pendingDomains.clear();
    const revised = new Set<keyof ObsidianContextRevisions>();
    for (const domain of changed) {
      if (domain === "focus") revised.add("workspace").add("editor").add("page");
      else revised.add(domain);
    }
    for (const domain of revised) this.revisions[domain] += 1;
    this.sequence += 1;
    // Unsolicited changes invalidate cached context without reading note contents.
    // Only a demand snapshot, behind the caller's current grant, captures again.
    this.currentSnapshot = undefined;
    this.diagnosticState.emittedEvents += 1;
    const event: ObsidianBridgeContextChanged = {
      type: "context_changed",
      sequence: this.sequence,
      capturedAt: this.now().toISOString(),
      changed,
      revisions: { ...this.revisions },
    };
    for (const listener of this.listeners) listener(event);
  }

  private captureForPath(path: string): SemanticContextSnapshot {
    this.flushPending();
    return captureEditorForPath(this.app, this.capture(), path);
  }

  private capture(): SemanticContextSnapshot {
    const captureStartedAt = this.monotonicNow();
    const snapshot = captureSemanticSnapshot(this.app, {
      contextId: this.contextId, sequence: this.sequence, revisions: this.revisions,
    }, () => this.now());
    const duration = Math.max(0, this.monotonicNow() - captureStartedAt);
    this.diagnosticState.captures += 1;
    this.diagnosticState.lastCaptureMs = duration;
    this.diagnosticState.maxCaptureMs = Math.max(this.diagnosticState.maxCaptureMs, duration);
    return snapshot;
  }
}

export function getObsidianSemanticContextService(app: App): ObsidianSemanticContextService {
  const existing = services.get(app);
  if (existing) return existing;
  const service = new ObsidianSemanticContextService(app);
  services.set(app, service);
  service.start();
  return service;
}

export function disposeObsidianSemanticContextService(app: App): void {
  const service = services.get(app);
  if (!service) return;
  services.delete(app);
  service.dispose();
}
