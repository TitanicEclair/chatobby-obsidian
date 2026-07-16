/** User-visible operation domains that require cross-surface serialization. */
export type OperationKey = "backend-lifecycle" | "session-transition" | "session-maintenance" | "session-state" | "workflow-control";

const CONFLICTING_OPERATION_KEYS: Readonly<Record<OperationKey, readonly OperationKey[]>> = {
  "backend-lifecycle": ["backend-lifecycle", "session-transition", "session-maintenance", "session-state", "workflow-control"],
  "session-transition": ["backend-lifecycle", "session-transition", "session-maintenance", "session-state", "workflow-control"],
  "session-maintenance": ["backend-lifecycle", "session-transition", "session-maintenance"],
  "session-state": ["backend-lifecycle", "session-transition", "session-state"],
  "workflow-control": ["backend-lifecycle", "session-transition", "workflow-control"],
};

/** Identifies the producer currently holding an operation domain. */
export interface OperationDescriptor {
  key: OperationKey;
  id: string;
  label: string;
}

/** Read-only projection of an operation currently in progress. */
export interface ActiveOperation extends OperationDescriptor {
  startedAt: number;
}

/** Raised when a producer tries to enter an operation domain that is already held. */
export class OperationConflictError extends Error {
  readonly active: ActiveOperation;

  constructor(active: ActiveOperation) {
    super(`${active.label} is already in progress.`);
    this.name = "OperationConflictError";
    this.active = active;
  }
}

/**
 * Owns in-flight operation state independently of command, slash, and button UI.
 *
 * Business controllers enter a domain at the point where they mutate runtime
 * state. Presentation surfaces only invoke those controllers and decide how to
 * display an {@link OperationConflictError}.
 */
export class OperationCoordinator {
  private readonly active = new Map<OperationKey, ActiveOperation>();
  private readonly listeners = new Set<() => void>();

  current(key: OperationKey): ActiveOperation | null {
    return this.active.get(key) ?? null;
  }

  all(): ActiveOperation[] {
    return [...this.active.values()];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async run<T>(descriptor: OperationDescriptor, operation: () => Promise<T>): Promise<T> {
    const conflict = this.findConflict(descriptor.key);
    if (conflict) throw new OperationConflictError(conflict);

    const owned = { ...descriptor, startedAt: Date.now() };
    this.active.set(descriptor.key, owned);
    this.notify();
    try {
      return await operation();
    } finally {
      const current = this.active.get(descriptor.key);
      if (current === owned) {
        this.active.delete(descriptor.key);
        this.notify();
      }
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private findConflict(key: OperationKey): ActiveOperation | null {
    for (const conflictingKey of CONFLICTING_OPERATION_KEYS[key]) {
      const active = this.active.get(conflictingKey);
      if (active) return active;
    }
    return null;
  }
}
