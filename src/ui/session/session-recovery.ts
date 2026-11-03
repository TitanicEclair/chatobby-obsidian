import type { ChatobbyTransport } from "../../transport/ws-client";
import type { ConnectedViewRestorationContext } from "../controller/connected-view-restoration";

export type SessionRestorationConnection = ConnectedViewRestorationContext<ChatobbyTransport>;

interface SessionRecoveryTarget {
  readonly path: string;
  readonly source: "pending" | "disconnected";
}

export interface SessionRecoveryOperation {
  readonly target: SessionRecoveryTarget | null;
  readonly connection?: SessionRestorationConnection;
  readonly requireCurrent: () => void;
}

/** Owns one leaf's recovery target and in-flight restoration; durable sessions stay runtime-owned. */
export class SessionRecovery {
  private target: SessionRecoveryTarget | null = null;
  private active: { target: SessionRecoveryTarget | null; connection?: SessionRestorationConnection; promise: Promise<void> } | null = null;

  constructor(
    private readonly restore: (operation: SessionRecoveryOperation) => Promise<void>,
    private readonly onRestored: () => void,
  ) {}

  get path(): string | null {
    return this.target?.path ?? null;
  }

  setPendingPath(path: string): void {
    // Object identity is the target token: even A -> B -> A is a new request.
    this.target = { path, source: "pending" };
  }

  rememberDisconnected(path: string | undefined): void {
    if (!this.target && path) this.target = { path, source: "disconnected" };
  }

  waitForCurrent(): Promise<void> | undefined { return this.active?.promise; }

  reconcile(connection?: SessionRestorationConnection): Promise<void> {
    const target = this.target;
    const previous = this.active;
    if (previous && previous.target === target && (!connection || previous.connection === connection)) return previous.promise;
    // An old epoch releases its presentation before the new target takes ownership.
    const work = previous
      ? previous.promise.catch(() => {}).then(() => this.restoreTarget(target, connection))
      : this.restoreTarget(target, connection);
    const promise = work.finally(() => { if (this.active?.promise === promise) this.active = null; });
    this.active = { target, connection, promise };
    return promise;
  }

  private async restoreTarget(target: SessionRecoveryTarget | null, connection?: SessionRestorationConnection): Promise<void> {
    const isCurrent = () => this.target === target && (!connection || connection.isCurrent());
    const requireCurrent = () => {
      if (!isCurrent()) throw new Error("Chatobby session restoration target changed.");
    };
    requireCurrent();
    await this.restore({ target, connection: connection ? { ...connection, isCurrent } : undefined, requireCurrent });
    requireCurrent();
    this.target = null;
    // Publish the final path/title only after releasing provisional-state protection.
    if (target) this.onRestored();
  }
}
