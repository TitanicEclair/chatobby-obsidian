import { Notice, setIcon } from "obsidian";
import { CHATOBBY_SUPPORT_URL, openChatobbyUrl } from "../../../publication";
import type { RuntimeLifecycleState } from "../../../runtime/public";

export interface RuntimeStatusHost {
  getState(): RuntimeLifecycleState;
  start(): Promise<void>;
  restart(): Promise<void>;
  install(repair?: boolean): Promise<void>;
}

/** Render low-noise lifecycle progress and actionable terminal failures. */
export class RuntimeStatusController {
  private readonly host: RuntimeStatusHost;
  private container: HTMLElement | null = null;
  private showTimer: number | null = null;
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
      this.showTimer = window.setTimeout(() => {
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
        this.actionButton(container, "Install runtime", () => this.host.install());
      } else if (shouldOfferRuntimeRepair(state)) {
        this.actionButton(container, "Repair Chatobby", () => this.host.install(true));
      } else if (state.diagnostics.code === "macos_security_blocked") {
        this.linkButton(container, "Apple instructions", "https://support.apple.com/en-us/102445");
      } else {
        this.actionButton(container, state.status === "crash_loop" ? "Try again" : "Retry", () => this.host.restart());
      }
      const details = container.createEl("details", { cls: "chatobby-runtime-status__diagnostics" });
      details.createEl("summary", { text: "Details" });
      details.createEl("code", { text: state.diagnostics.code });
      if (state.diagnostics.recentLogs.length > 0) {
        details.createEl("pre", { text: state.diagnostics.recentLogs.slice(-8).join("\n") });
      }
      const diagnosticActions = details.createDiv({ cls: "chatobby-runtime-status__diagnostic-actions" });
      const copy = diagnosticActions.createEl("button", { text: "Copy diagnostics", attr: { type: "button" } });
      copy.addEventListener("click", () => void copyDiagnostics(state));
      const support = diagnosticActions.createEl("button", { text: "Support", attr: { type: "button" } });
      support.addEventListener("click", () => openChatobbyUrl(CHATOBBY_SUPPORT_URL));
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

  private linkButton(container: HTMLElement, label: string, url: string): void {
    const button = container.createEl("button", { cls: "chatobby-runtime-status__action", text: label });
    button.addEventListener("click", () => openChatobbyUrl(url));
  }

  private cancelShowTimer(): void {
    if (this.showTimer) window.clearTimeout(this.showTimer);
    this.showTimer = null;
    this.pendingKey = null;
  }
}

function shouldOfferRuntimeDownload(
  state: Extract<RuntimeLifecycleState, { status: "error" | "crash_loop" }>,
): boolean {
  return state.mode === "managed" && state.diagnostics.code === "runtime_not_installed";
}

function shouldOfferRuntimeRepair(
  state: Extract<RuntimeLifecycleState, { status: "error" | "crash_loop" }>,
): boolean {
  return state.mode === "managed" && (
    state.diagnostics.code === "runtime_package_invalid"
    || state.diagnostics.code === "runtime_architecture_mismatch"
    || state.diagnostics.code === "runtime_executable_permission_invalid"
  );
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
      if (state.mode === "managed" && shouldOfferRuntimeRepair(state)) {
        return {
          title: "Chatobby needs repair",
          detail: state.diagnostics.message,
          icon: "shield-alert",
          failure: true,
          loading: false,
        };
      }
      return { title: "Chatobby could not start", detail: state.diagnostics.message, icon: "circle-alert", failure: true, loading: false };
    case "crash_loop":
      return { title: "Automatic restart paused", detail: state.diagnostics.message, icon: "triangle-alert", failure: true, loading: false };
    case "ready":
    case "detached":
      return { title: "", detail: "", icon: "circle", failure: false, loading: false };
  }
}

async function copyDiagnostics(
  state: Extract<RuntimeLifecycleState, { status: "error" | "crash_loop" }>,
): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify({
    code: state.diagnostics.code,
    message: state.diagnostics.message,
    occurredAt: new Date(state.diagnostics.occurredAt).toISOString(),
    recentLogs: state.diagnostics.recentLogs.slice(-8),
  }, null, 2));
  new Notice("Chatobby diagnostics copied");
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
