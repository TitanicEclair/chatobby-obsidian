import { TFolder, type TAbstractFile } from "obsidian";
import type {
  ProjectDirectoryObservationResult,
  ProjectDirectoryObserved,
  ProjectDirectoryRescanRequested,
  ProjectDirectoryRescanResult,
} from "../../../vendor/@chatobby/obsidian-protocol/index.js";
import { normalizeVaultFolderPath } from "../../../vendor/@chatobby/obsidian-protocol/index.js";

/** Maximum folder observations retained before one authoritative rescan replaces them. */
export const PROJECT_DIRECTORY_OBSERVATION_QUEUE_LIMIT = 64;

/** Maximum transport attempts for one observation or rescan. */
export const PROJECT_DIRECTORY_OBSERVATION_MAX_ATTEMPTS = 3;

/** Time allowed for one typed result before a bounded retry. */
export const PROJECT_DIRECTORY_OBSERVATION_RESULT_TIMEOUT_MS = 5_000;

/** Delay before retrying a timed-out or retryable request. */
export const PROJECT_DIRECTORY_OBSERVATION_RETRY_DELAY_MS = 250;

export interface ProjectDirectoryObservationTransport {
  readonly isProjectDirectoryBridgeAvailable: boolean;
  onAvailabilityChange(listener: (available: boolean) => void): () => void;
  onProjectDirectoryObservationResult(
    listener: (result: ProjectDirectoryObservationResult) => void,
  ): () => void;
  onProjectDirectoryRescanResult(listener: (result: ProjectDirectoryRescanResult) => void): () => void;
  sendProjectDirectoryObservation(message: ProjectDirectoryObserved): boolean;
  sendProjectDirectoryRescan(message: ProjectDirectoryRescanRequested): boolean;
}

export interface ProjectDirectoryObservationServiceOptions {
  queueLimit?: number;
  maxAttempts?: number;
  resultTimeoutMs?: number;
  retryDelayMs?: number;
  createId?: () => string;
  now?: () => Date;
}

interface PendingObservation {
  observationId: string;
  observedAt: string;
  oldVaultRelativePath: string;
  newVaultRelativePath: string;
  attempts: number;
}

interface PendingRescan {
  rescanId: string;
  requestedAt: string;
  reason: ProjectDirectoryRescanRequested["reason"];
  attempts: number;
}

type InFlightRequest =
  | { kind: "observation"; requestId: string; item: PendingObservation; timer: number }
  | { kind: "rescan"; requestId: string; item: PendingRescan; timer: number };

/**
 * Converts Obsidian folder rename/move events into one ordered, retry-bounded
 * bridge stream. Any gap collapses to one authoritative rescan request.
 */
export class ProjectDirectoryObservationService {
  private readonly queue: PendingObservation[] = [];
  private readonly unsubscribes: Array<() => void> = [];
  private readonly queueLimit: number;
  private readonly maxAttempts: number;
  private readonly resultTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly createId: () => string;
  private readonly now: () => Date;
  private available = false;
  private started = false;
  private disposed = false;
  private pendingRescan: PendingRescan | null = null;
  private inFlight: InFlightRequest | null = null;
  private retryTimer: number | null = null;

  constructor(
    private readonly transport: ProjectDirectoryObservationTransport,
    options: ProjectDirectoryObservationServiceOptions = {},
  ) {
    this.queueLimit = options.queueLimit ?? PROJECT_DIRECTORY_OBSERVATION_QUEUE_LIMIT;
    this.maxAttempts = options.maxAttempts ?? PROJECT_DIRECTORY_OBSERVATION_MAX_ATTEMPTS;
    this.resultTimeoutMs = options.resultTimeoutMs ?? PROJECT_DIRECTORY_OBSERVATION_RESULT_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? PROJECT_DIRECTORY_OBSERVATION_RETRY_DELAY_MS;
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date());
  }

  /** Begin listening to bridge state and request one startup reconciliation. */
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.unsubscribes.push(
      this.transport.onAvailabilityChange((available) => this.handleAvailability(available)),
      this.transport.onProjectDirectoryObservationResult((result) => this.handleObservationResult(result)),
      this.transport.onProjectDirectoryRescanResult((result) => this.handleRescanResult(result)),
    );
    this.requireRescan("startup");
    this.handleAvailability(this.transport.isProjectDirectoryBridgeAvailable);
  }

  /** Queue a folder rename/move; file renames are intentionally ignored. */
  observeRename(file: TAbstractFile, oldPath: string): boolean {
    if (!this.started || this.disposed || !isFolder(file)) return false;
    const oldVaultRelativePath = normalizeObservedPath(oldPath);
    const newVaultRelativePath = normalizeObservedPath(file.path);
    if (!oldVaultRelativePath || !newVaultRelativePath || oldVaultRelativePath === newVaultRelativePath) {
      return false;
    }
    if (this.pendingRescan) return true;
    if (this.queue.length >= this.queueLimit) {
      this.requireRescan("queue-overflow");
      return true;
    }
    this.queue.push({
      observationId: this.createId(),
      observedAt: this.timestamp(),
      oldVaultRelativePath,
      newVaultRelativePath,
      attempts: 0,
    });
    this.pump();
    return true;
  }

  /** Stop timers and subscriptions without starting, stopping, or reconnecting the runtime. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.started = false;
    this.clearInFlight();
    this.clearRetryTimer();
    this.queue.length = 0;
    this.pendingRescan = null;
    for (const unsubscribe of this.unsubscribes.splice(0)) unsubscribe();
  }

  private handleAvailability(available: boolean): void {
    if (this.disposed || this.available === available) return;
    const wasAvailable = this.available;
    this.available = available;
    if (!available) {
      if (wasAvailable || this.inFlight || this.queue.length > 0) this.requireRescan("disconnect-timeout");
      return;
    }
    this.pump();
  }

  private handleObservationResult(result: ProjectDirectoryObservationResult): void {
    const current = this.inFlight;
    if (!current || current.kind !== "observation") return;
    if (result.requestId !== current.requestId || result.observationId !== current.item.observationId) return;
    this.clearInFlight();
    if (result.retryable) {
      this.retry(current.item, "observation");
      return;
    }
    if (this.queue[0]?.observationId === current.item.observationId) this.queue.shift();
    this.pump();
  }

  private handleRescanResult(result: ProjectDirectoryRescanResult): void {
    const current = this.inFlight;
    if (!current || current.kind !== "rescan") return;
    if (result.requestId !== current.requestId || result.rescanId !== current.item.rescanId) return;
    this.clearInFlight();
    if (result.retryable) {
      this.retry(current.item, "rescan");
      return;
    }
    if (this.pendingRescan?.rescanId === current.item.rescanId) this.pendingRescan = null;
    this.pump();
  }

  private pump(): void {
    if (!this.started || this.disposed || !this.available || this.inFlight || this.retryTimer !== null) return;
    if (this.pendingRescan) {
      this.sendRescan(this.pendingRescan);
      return;
    }
    const next = this.queue[0];
    if (next) this.sendObservation(next);
  }

  private sendObservation(item: PendingObservation): void {
    item.attempts += 1;
    const requestId = this.createId();
    const message: ProjectDirectoryObserved = {
      type: "project_directory_observed",
      schemaVersion: 1,
      requestId,
      observationId: item.observationId,
      observedAt: item.observedAt,
      changeKind: "rename-or-move",
      entryKind: "folder",
      oldVaultRelativePath: item.oldVaultRelativePath,
      newVaultRelativePath: item.newVaultRelativePath,
    };
    if (!this.transport.sendProjectDirectoryObservation(message)) {
      this.retry(item, "observation");
      return;
    }
    this.inFlight = {
      kind: "observation",
      requestId,
      item,
      timer: window.setTimeout(() => this.handleTimeout(requestId), this.resultTimeoutMs),
    };
  }

  private sendRescan(item: PendingRescan): void {
    item.attempts += 1;
    const requestId = this.createId();
    const message: ProjectDirectoryRescanRequested = {
      type: "project_directory_rescan_requested",
      schemaVersion: 1,
      requestId,
      rescanId: item.rescanId,
      requestedAt: item.requestedAt,
      reason: item.reason,
    };
    if (!this.transport.sendProjectDirectoryRescan(message)) {
      this.retry(item, "rescan");
      return;
    }
    this.inFlight = {
      kind: "rescan",
      requestId,
      item,
      timer: window.setTimeout(() => this.handleTimeout(requestId), this.resultTimeoutMs),
    };
  }

  private handleTimeout(requestId: string): void {
    const current = this.inFlight;
    if (!current || current.requestId !== requestId) return;
    this.clearInFlight();
    this.retry(current.item, current.kind);
  }

  private retry(item: PendingObservation | PendingRescan, kind: InFlightRequest["kind"]): void {
    if (item.attempts >= this.maxAttempts) {
      if (kind === "observation") {
        this.requireRescan("retry-exhausted");
      } else {
        // The rescan remains pending but does not spin. A later connection
        // transition gets one fresh bounded attempt sequence.
        item.attempts = 0;
        this.available = false;
      }
      return;
    }
    this.clearRetryTimer();
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.pump();
    }, this.retryDelayMs);
  }

  private requireRescan(reason: ProjectDirectoryRescanRequested["reason"]): void {
    this.clearInFlight();
    this.clearRetryTimer();
    this.queue.length = 0;
    if (!this.pendingRescan) {
      this.pendingRescan = {
        rescanId: this.createId(),
        requestedAt: this.timestamp(),
        reason,
        attempts: 0,
      };
    }
    this.pump();
  }

  private clearInFlight(): void {
    if (!this.inFlight) return;
    window.clearTimeout(this.inFlight.timer);
    this.inFlight = null;
  }

  private clearRetryTimer(): void {
    if (this.retryTimer === null) return;
    window.clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function normalizeObservedPath(path: string): string | null {
  try {
    const normalized = normalizeVaultFolderPath(path);
    return normalized || null;
  } catch {
    return null;
  }
}

function isFolder(file: TAbstractFile): file is TFolder {
  if (typeof TFolder === "function" && file instanceof TFolder) return true;
  return isRecord(file) && Array.isArray(file.children);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
