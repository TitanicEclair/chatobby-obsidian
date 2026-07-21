import type { OperationCoordinator } from "../../features/operations/public";
import { SessionTransitionIndicator } from "./session-transition-indicator";

/** Couples the session-operation domain to its blocking readiness presentation. */
export class SessionTransitionCoordinator {
  private readonly indicator: SessionTransitionIndicator;
  private unsubscribe: (() => void) | null = null;

  constructor(
    host: HTMLElement,
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
    this.flush();
    await nextAnimationFrame();
    this.flush();
    await nextAnimationFrame();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.indicator.destroy();
  }

  private render(): void {
    this.indicator.setOperation(this.operations.current("session-transition"));
  }
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}
