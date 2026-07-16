import { Menu, Notice } from "obsidian";
import type { RuntimeLifecycleState } from "../../../runtime/public";

export interface RuntimeStatusMenuHost {
  getState(): RuntimeLifecycleState;
  hasActiveWork(): boolean;
  restart(): Promise<void>;
  stop(): Promise<void>;
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
    const menu = new Menu();
    if (state.status === "ready" || state.status === "error" || state.status === "crash_loop") {
      menu.addItem((item) => item
        .setTitle("Restart Chatobby")
        .setIcon("refresh-cw")
        .onClick(() => void this.host.restart().catch(reportRuntimeActionFailure)));
    }
    if (state.status !== "idle" && state.status !== "detached" && state.status !== "stopping") {
      menu.addItem((item) => item
        .setTitle("Stop Chatobby")
        .setIcon("square")
        .onClick(() => {
          if (this.host.hasActiveWork() && !window.confirm("Chatobby is working. Stop the runtime and interrupt active work?")) return;
          void this.host.stop().catch(reportRuntimeActionFailure);
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
