import { type App, Menu, Notice } from "obsidian";
import { confirmAction } from "../../../ui/modals/modals";
import type { RuntimeLifecycleState } from "../../../runtime/public";

export interface RuntimeStatusMenuHost {
  app: App;
  getState(): RuntimeLifecycleState;
  hasActiveWork(): boolean;
  restart(): Promise<void>;
  stop(): Promise<void>;
  supportsRuntimeUpdates(): boolean;
  automaticProvisioning(): boolean;
  retryProvisioning(): Promise<void>;
  manageRuntime(repair?: boolean): void;
  removeRuntime(): Promise<void>;
}

/** Keyboard-accessible runtime actions attached to the composer status button. */
export class RuntimeStatusMenu {
  private readonly host: RuntimeStatusMenuHost;
  private button: HTMLElement | null = null;
  private readonly handleClick = (event: MouseEvent): void => this.open(event);

  constructor(host: RuntimeStatusMenuHost) {
    this.host = host;
  }

  bind(button: HTMLElement): void {
    this.destroy();
    this.button = button;
    button.addEventListener("click", this.handleClick);
  }

  destroy(): void {
    this.button?.removeEventListener("click", this.handleClick);
    this.button = null;
  }

  private open(event: MouseEvent): void {
    const state = this.host.getState();
    const developmentPairBlocked = state.status === "error"
      && state.diagnostics.code === "development_pair_adoption_failed";
    const menu = new Menu();
    if (!developmentPairBlocked && this.host.supportsRuntimeUpdates()) {
      const missing = state.status === "error"
        && state.mode === "managed"
        && state.diagnostics.code === "runtime_not_installed";
      const invalid = state.status === "error"
        && state.mode === "managed"
        && state.diagnostics.code === "runtime_package_invalid";
      if (missing && this.host.automaticProvisioning()) {
        menu.addItem((item) => item
          .setTitle("Retry Chatobby setup")
          .setIcon("refresh-cw")
          .onClick(() => void this.host.retryProvisioning().catch(reportRuntimeActionFailure)));
      } else if (invalid) {
        menu.addItem((item) => item
          .setTitle("Repair Chatobby")
          .setIcon("shield-alert")
          .onClick(() => this.host.manageRuntime(true)));
      } else if (!this.host.automaticProvisioning()) {
        menu.addItem((item) => item
          .setTitle(missing ? "Install Chatobby runtime" : "Check for runtime updates")
          .setIcon(missing ? "download" : "refresh-cw")
          .onClick(() => this.host.manageRuntime(false)));
      }
    }
    if (!developmentPairBlocked && (state.status === "ready" || state.status === "error" || state.status === "crash_loop")) {
      menu.addItem((item) => item
        .setTitle("Restart Chatobby")
        .setIcon("refresh-cw")
        .onClick(() => void this.host.restart().catch(reportRuntimeActionFailure)));
    }
    if (!developmentPairBlocked && state.status !== "idle" && state.status !== "detached" && state.status !== "stopping") {
      menu.addItem((item) => item
        .setTitle("Stop Chatobby")
        .setIcon("square")
        .onClick(async () => {
          if (this.host.hasActiveWork() && !await confirmAction(this.host.app, {
            title: "Stop Chatobby?",
            message: "Chatobby is working. Stopping the runtime will interrupt active work.",
            confirmLabel: "Stop Chatobby",
            destructive: true,
          })) return;
          void this.host.stop().catch(reportRuntimeActionFailure);
        }));
    }
    const managed = state.status === "ready" ? state.runtime.ownership === "managed" : state.mode === "managed";
    const missing = state.status === "error" && state.diagnostics.code === "runtime_not_installed";
    if (!developmentPairBlocked && managed && !missing) {
      menu.addItem((item) => item
        .setTitle("Remove local runtime")
        .setIcon("trash-2")
        .onClick(async () => {
          if (!await confirmAction(this.host.app, {
            title: "Remove local Chatobby runtime?",
            message: "This removes only account-local runtime program files. Chats, vault data, and credentials are preserved.",
            confirmLabel: "Remove runtime",
            destructive: true,
          })) return;
          void this.host.removeRuntime().catch(reportRuntimeActionFailure);
        }));
    }
    if (state.status === "error" || state.status === "crash_loop") {
      menu.addItem((item) => item
        .setTitle("Copy diagnostics")
        .setIcon("copy")
        .onClick(() => void copyDiagnostics(state)));
    }
    menu.showAtMouseEvent(event);
  }
}

async function copyDiagnostics(state: Extract<RuntimeLifecycleState, { status: "error" | "crash_loop" }>): Promise<void> {
  const diagnostics = {
    state: state.status,
    code: state.diagnostics.code,
    message: state.diagnostics.message,
    occurredAt: new Date(state.diagnostics.occurredAt).toISOString(),
    recentLogs: state.diagnostics.recentLogs,
  };
  await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
  new Notice("Chatobby diagnostics copied");
}

function reportRuntimeActionFailure(error: unknown): void {
  console.error("Chatobby runtime action failed", error);
  new Notice(error instanceof Error ? error.message : "Chatobby runtime action failed");
}
