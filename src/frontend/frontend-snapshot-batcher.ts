import type { FrontendBootstrap } from "../vendor/chatobby-client/frontend-contracts.js";

/** Coalesces transport snapshots while preserving immediate turn-completion delivery. */
export class FrontendSnapshotBatcher {
  private pending: FrontendBootstrap | null = null;
  private applied: FrontendBootstrap | null = null;
  private timer: ReturnType<typeof globalThis.setTimeout> | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly apply: (snapshot: FrontendBootstrap, previous: FrontendBootstrap | null) => void,
  ) {}

  current(): FrontendBootstrap | null {
    return this.applied;
  }

  schedule(snapshot: FrontendBootstrap): void {
    this.pending = snapshot;
    const generationCompleted = this.applied?.session?.streaming === true && snapshot.session?.streaming === false;
    if (generationCompleted) {
      this.clearTimer();
      this.flush();
      return;
    }
    if (this.timer) return;
    this.timer = globalThis.setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.delayMs);
  }

  flush(): void {
    const snapshot = this.pending;
    this.pending = null;
    if (!snapshot) return;
    const previous = this.applied;
    this.applied = snapshot;
    this.apply(snapshot, previous);
  }

  destroy(): void {
    this.clearTimer();
    this.pending = null;
    this.applied = null;
  }

  private clearTimer(): void {
    if (this.timer) globalThis.clearTimeout(this.timer);
    this.timer = null;
  }
}

/** Whether persisted-session directory metadata changed between snapshots. */
export function sessionDirectoryProjectionChanged(
  previous: FrontendBootstrap["session"] | undefined,
  current: FrontendBootstrap["session"] | undefined,
): boolean {
  return previous?.id !== current?.id
    || previous?.recoveryPath !== current?.recoveryPath
    || previous?.name !== current?.name
    || previous?.messageCount !== current?.messageCount;
}
