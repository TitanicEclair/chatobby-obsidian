import type { ActiveOperation } from "../../features/operations/public";

/** Full-view readiness state for session identity changes. */
export class SessionTransitionIndicator {
  private operationId: string | null = null;

  constructor(private readonly host: HTMLElement) {}

  setOperation(operation: ActiveOperation | null): void {
    if (this.operationId === operation?.id) return;
    this.operationId = operation?.id ?? null;
    this.host.empty();
    this.host.toggleClass("is-hidden", operation === null);
    this.host.setAttr("aria-busy", operation ? "true" : "false");
    if (!operation) {
      this.host.removeAttribute("role");
      this.host.removeAttribute("aria-live");
      return;
    }
    this.host.setAttr("role", "status");
    this.host.setAttr("aria-live", "polite");
    const status = this.host.createDiv({ cls: "chatobby-session-transition" });
    status.createSpan({ text: operation.label });
    status.createSpan({ cls: "chatobby-session-transition__dots", attr: { "aria-hidden": "true" } });
  }

  destroy(): void {
    this.operationId = null;
    this.host.empty();
    this.host.addClass("is-hidden");
    this.host.removeAttribute("role");
    this.host.removeAttribute("aria-live");
    this.host.removeAttribute("aria-busy");
  }
}
