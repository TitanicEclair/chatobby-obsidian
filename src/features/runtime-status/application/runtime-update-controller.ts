import { setIcon } from "obsidian";
import type { RuntimeUpdateState } from "../../../runtime/public";

export interface RuntimeUpdateControllerHost {
  getState(): RuntimeUpdateState;
  onStateChange(listener: (state: RuntimeUpdateState) => void): () => void;
  openInstaller(): void;
  automaticProvisioning(): boolean;
  retryProvisioning(): Promise<void>;
}

/** Render one compact composer-adjacent update action without a persistent banner. */
export class RuntimeUpdateController {
  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private renderedKey: string | null = null;

  constructor(private readonly host: RuntimeUpdateControllerHost) {}

  bind(container: HTMLElement): void {
    this.destroy();
    this.container = container;
    this.unsubscribe = this.host.onStateChange(() => this.render());
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.container?.empty();
    this.container = null;
    this.renderedKey = null;
  }

  render(): void {
    const container = this.container;
    if (!container) return;
    const state = this.host.getState();
    const key = stateKey(state);
    if (key === this.renderedKey) return;
    this.renderedKey = key;
    container.empty();
    container.addClass("is-hidden");
    container.removeClass("is-progress", "is-error");

    const automatic = this.host.automaticProvisioning();
    if (state.status === "available") {
      container.removeClass("is-hidden");
      const icon = container.createSpan({ cls: "chatobby-runtime-update__icon" });
      setIcon(icon, "download");
      container.createSpan({
        cls: "chatobby-runtime-update__label",
        text: state.kind === "repair"
          ? "Runtime repair is ready"
          : automatic
            ? `Preparing runtime ${state.descriptor.version}`
            : `Runtime ${state.descriptor.version} available`,
      });
      if (state.kind === "repair") this.action(container, "Repair Chatobby", () => this.host.openInstaller());
      else if (!automatic) this.action(container, "Update Chatobby", () => this.host.openInstaller());
    } else if (state.status === "deferred") {
      container.removeClass("is-hidden");
      const icon = container.createSpan({ cls: "chatobby-runtime-update__icon" });
      setIcon(icon, "clock-3");
      container.createSpan({
        cls: "chatobby-runtime-update__label",
        text: "Runtime update will continue when current work finishes",
      });
    } else if (state.status === "installing") {
      container.removeClass("is-hidden");
      container.addClass("is-progress");
      const icon = container.createSpan({ cls: "chatobby-runtime-update__icon" });
      setIcon(icon, "loader-circle");
      container.createSpan({
        cls: "chatobby-runtime-update__label",
        text: installLabel(state),
      });
      if (!automatic) this.action(container, "View", () => this.host.openInstaller());
    } else if (state.status === "error" && state.descriptor) {
      container.removeClass("is-hidden");
      container.addClass("is-error");
      const icon = container.createSpan({ cls: "chatobby-runtime-update__icon" });
      setIcon(icon, "circle-alert");
      container.createSpan({ cls: "chatobby-runtime-update__label", text: "Runtime update needs attention" });
      if (automatic && state.kind !== "repair") {
        this.action(container, "Retry", () => void this.host.retryProvisioning());
      } else {
        this.action(container, "Details", () => this.host.openInstaller());
      }
    }
  }

  private action(container: HTMLElement, label: string, action: () => void): void {
    const button = container.createEl("button", {
      cls: "chatobby-runtime-update__action",
      text: label,
      attr: { type: "button" },
    });
    button.addEventListener("click", action);
  }
}

function stateKey(state: RuntimeUpdateState): string {
  switch (state.status) {
    case "available":
      return `available:${state.kind}:${state.descriptor.version}`;
    case "installing":
      return `installing:${state.kind}:${state.descriptor.version}:${state.phase}:${Math.floor(progressRatio(state) * 100)}`;
    case "deferred":
      return `deferred:${state.kind}:${state.descriptor.version}`;
    case "error":
      return `error:${state.message}:${state.descriptor?.version ?? ""}`;
    case "current":
      return `current:${state.installedVersion}`;
    default:
      return state.status;
  }
}

function installLabel(state: Extract<RuntimeUpdateState, { status: "installing" }>): string {
  if (state.phase === "downloading" || state.phase === "extracting") {
    return `Updating runtime · ${Math.floor(progressRatio(state) * 100)}%`;
  }
  return state.phase === "installing" ? "Installing verified runtime" : "Reconnecting Chatobby";
}

function progressRatio(state: Extract<RuntimeUpdateState, { status: "installing" }>): number {
  if (state.total <= 0) return 0;
  return Math.max(0, Math.min(1, state.completed / state.total));
}
