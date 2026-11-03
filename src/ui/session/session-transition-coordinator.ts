import type { OperationCoordinator } from "../../features/operations/public";
import { SessionTransitionIndicator } from "./session-transition-indicator";

/** Couples the session-operation domain to its blocking readiness presentation. */
export class SessionTransitionCoordinator {
  private readonly indicator: SessionTransitionIndicator;
  private readonly presentationLifetime = new AbortController();
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly operations: OperationCoordinator,
    private readonly flush: () => void,
  ) {
    this.indicator = new SessionTransitionIndicator(host);
  }

  open(): void {
    this.unsubscribe = this.operations.subscribe(() => this.render());
    this.render();
  }

  async settle(): Promise<void> {
    const signal = this.presentationLifetime.signal;
    if (signal.aborted) return;
    this.flush();
    await nextPresentationFrame(this.host.ownerDocument, signal);
    if (signal.aborted) return;
    this.flush();
    await nextPresentationFrame(this.host.ownerDocument, signal);
  }

  destroy(): void {
    this.presentationLifetime.abort();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.indicator.destroy();
  }

  private render(): void {
    this.indicator.setOperation(this.operations.current("session-transition"));
  }
}

/** Hidden documents do not paint; closing a view retires only its presentation wait. */
function nextPresentationFrame(document: Document, signal: AbortSignal): Promise<void> {
  const ownerWindow = document.defaultView;
  if (!ownerWindow || document.hidden || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let frame: number | undefined;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (frame !== undefined) ownerWindow.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const onVisibilityChange = () => {
      if (document.hidden) finish();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    signal.addEventListener("abort", finish, { once: true });
    frame = ownerWindow.requestAnimationFrame(() => {
      frame = undefined;
      finish();
    });
    if (document.hidden || signal.aborted) finish();
  });
}
