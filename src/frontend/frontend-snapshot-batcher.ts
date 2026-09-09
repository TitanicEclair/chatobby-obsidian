import type { FrontendBootstrap } from "../vendor/chatobby-client/frontend-contracts.js";

/** Coalesces transport snapshots while preserving immediate activity-completion delivery. */
export class FrontendSnapshotBatcher {
  private pending: FrontendBootstrap | null = null;
  private applied: FrontendBootstrap | null = null;
  private timer: number | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly apply: (snapshot: FrontendBootstrap, previous: FrontendBootstrap | null) => void,
  ) {}

  current(): FrontendBootstrap | null {
    return this.applied;
  }

  schedule(snapshot: FrontendBootstrap): void {
    this.pending = snapshot;
    const activityCompleted = (
      this.applied?.session?.streaming === true
      && snapshot.session?.streaming === false
    ) || (
      this.applied?.session?.compacting === true
      && snapshot.session?.compacting === false
    );
    if (activityCompleted) {
      this.clearTimer();
      this.flush();
      return;
    }
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.delayMs);
  }

  flush(): void {
    const snapshot = this.pending;
    this.pending = null;
    if (!snapshot) return;
    const previous = this.applied;
    this.apply(snapshot, previous);
    this.applied = snapshot;
  }

  destroy(): void {
    this.clearTimer();
    this.pending = null;
    this.applied = null;
  }

  private clearTimer(): void {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
  }
}

/** Directory identity, metadata and turn transitions; token deltas do not refresh the sidebar. */
export function sessionDirectoryProjectionChanged(
  previous: FrontendBootstrap["session"] | undefined,
  current: FrontendBootstrap["session"] | undefined,
): boolean {
  return previous?.id !== current?.id
    || previous?.recoveryPath !== current?.recoveryPath
    || previous?.name !== current?.name
    || previous?.streaming !== current?.streaming
    || previous?.compacting !== current?.compacting
    || previous?.messageCount !== current?.messageCount;
}

/** Whether the active model changed and cached token-window statistics are stale. */
export function sessionModelProjectionChanged(
  previous: FrontendBootstrap["session"] | undefined,
  current: FrontendBootstrap["session"] | undefined,
): boolean {
  return previous?.id === current?.id && previous?.model !== current?.model;
}
