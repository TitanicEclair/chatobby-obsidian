import { setIcon } from "obsidian";
import { CHATOBBY_RUNTIME_RELEASES_URL, openChatobbyUrl } from "../../../publication";
import type { RuntimeLifecycleState } from "../../../runtime/public";

export interface RuntimeStatusHost {
  getState(): RuntimeLifecycleState;
  start(): Promise<void>;
  restart(): Promise<void>;
}

/** Render low-noise lifecycle progress and actionable terminal failures. */
export class RuntimeStatusController {
  private readonly host: RuntimeStatusHost;
  private container: HTMLElement | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingKey: string | null = null;
  private renderedKey: string | null = null;

  constructor(host: RuntimeStatusHost) {
    this.host = host;
  }

  bind(container: HTMLElement): void {
    this.container = container;
    this.render();
  }

  render(): void {
    const container = this.container;
    if (!container) return;
    const state = this.host.getState();
    const key = stateKey(state);
    if (this.renderedKey === key || this.pendingKey === key) return;
    if (state.status === "resolving" || state.status === "spawning" || state.status === "authenticating") {
      this.cancelShowTimer();
      this.pendingKey = key;
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        this.pendingKey = null;
        this.renderState(state, key);
      }, STATUS_REVEAL_DELAY_MS);
      return;
    }
    this.cancelShowTimer();
    this.renderState(state, key);
  }

  private renderState(state: RuntimeLifecycleState, key: string): void {
    const container = this.container;
    if (!container) return;
    this.renderedKey = key;
    container.empty();
    container.removeClass("is-hidden", "is-progress", "is-failure", "is-loading");
    if (state.status === "ready" || state.status === "detached") {
      container.addClass("is-hidden");
      return;
    }

    const presentation = presentRuntimeState(state);
    container.addClass(presentation.failure ? "is-failure" : "is-progress");
    if (presentation.loading) container.addClass("is-loading");
    container.setAttr("role", presentation.failure ? "alert" : "status");
    container.setAttr("aria-live", "polite");
    const icon = container.createSpan({ cls: "chatobby-runtime-status__icon" });
    setIcon(icon, presentation.icon);
    const copy = container.createDiv({ cls: "chatobby-runtime-status__copy" });
    copy.createDiv({ cls: "chatobby-runtime-status__title", text: presentation.title });
    copy.createDiv({ cls: "chatobby-runtime-status__detail", text: presentation.detail });

    if (state.status === "idle") {
      this.actionButton(container, "Start", () => this.host.start());
    } else if (state.status === "error" || state.status === "crash_loop") {
      if (shouldOfferRuntimeDownload(state)) {
        this.actionButton(container, "Get runtime", async () => openChatobbyUrl(CHATOBBY_RUNTIME_RELEASES_URL));
      }
      this.actionButton(container, state.status === "crash_loop" ? "Try again" : "Retry", () => this.host.restart());
      const details = container.createEl("details", { cls: "chatobby-runtime-status__diagnostics" });
      details.createEl("summary", { text: "Details" });
      details.createEl("code", { text: state.diagnostics.code });
      if (state.diagnostics.recentLogs.length > 0) {
        details.createEl("pre", { text: state.diagnostics.recentLogs.slice(-8).join("\n") });
      }
    }
  }

  destroy(): void {
    this.cancelShowTimer();
    this.container?.empty();
    this.container = null;
    this.renderedKey = null;
  }

  private actionButton(container: HTMLElement, label: string, action: () => Promise<void>): void {
    const button = container.createEl("button", { cls: "chatobby-runtime-status__action", text: label });
    button.addEventListener("click", () => {
      button.disabled = true;
      void action().catch(() => {}).finally(() => {
        button.disabled = false;
        this.render();
      });
    });
  }

  private cancelShowTimer(): void {
    if (this.showTimer) clearTimeout(this.showTimer);
    this.showTimer = null;
    this.pendingKey = null;
  }
}

function shouldOfferRuntimeDownload(
  state: Extract<RuntimeLifecycleState, { status: "error" | "crash_loop" }>,
): boolean {
  if (state.mode !== "managed") return false;
  return state.diagnostics.code === "configuration_invalid"
    || state.diagnostics.code === "descriptor_invalid"
    || state.diagnostics.code === "protocol_incompatible"
    || state.diagnostics.code === "spawn_failed";
}

const STATUS_REVEAL_DELAY_MS = 250;

interface RuntimeStatePresentation {
  title: string;
  detail: string;
  icon: string;
  failure: boolean;
  loading: boolean;
}

function presentRuntimeState(state: RuntimeLifecycleState): RuntimeStatePresentation {
  switch (state.status) {
    case "idle":
      return { title: "Chatobby is paused", detail: "Start when you are ready to work.", icon: "play", failure: false, loading: false };
    case "resolving":
      return { title: "Preparing Chatobby", detail: "Checking this vault's runtime.", icon: "loader-circle", failure: false, loading: true };
    case "spawning":
      return { title: "Starting Chatobby", detail: `Runtime startup attempt ${state.attempt}.`, icon: "loader-circle", failure: false, loading: true };
    case "authenticating":
      return { title: "Connecting securely", detail: "Verifying runtime identity and session access.", icon: "shield-check", failure: false, loading: true };
    case "stopping":
      return { title: "Stopping Chatobby", detail: "Finishing runtime cleanup.", icon: "loader-circle", failure: false, loading: true };
    case "error":
      return { title: "Chatobby could not start", detail: state.diagnostics.message, icon: "circle-alert", failure: true, loading: false };
    case "crash_loop":
      return { title: "Automatic restart paused", detail: state.diagnostics.message, icon: "triangle-alert", failure: true, loading: false };
    case "ready":
    case "detached":
      return { title: "", detail: "", icon: "circle", failure: false, loading: false };
  }
}

function stateKey(state: RuntimeLifecycleState): string {
  switch (state.status) {
    case "ready":
      return `ready:${state.runtime.identity.instanceId}`;
    case "spawning":
      return `spawning:${state.attempt}`;
    case "authenticating":
      return `authenticating:${state.endpoint}`;
    case "error":
    case "crash_loop":
      return `${state.status}:${state.diagnostics.code}:${state.diagnostics.message}`;
    default:
      return state.status;
  }
}
