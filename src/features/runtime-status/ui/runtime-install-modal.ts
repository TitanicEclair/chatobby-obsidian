import { Modal, Notice, setIcon, type App } from "obsidian";
import {
  CHATOBBY_RUNTIME_RELEASES_URL,
  CHATOBBY_SUPPORT_URL,
  openChatobbyUrl,
} from "../../../publication";
import type { RuntimeUpdateState } from "../../../runtime/public";

export interface RuntimeInstallModalHost {
  getState(): RuntimeUpdateState;
  onStateChange(listener: (state: RuntimeUpdateState) => void): () => void;
  checkForUpdate(): Promise<unknown>;
  checkForRepair(): Promise<unknown>;
  install(signal?: AbortSignal): Promise<string>;
  hasActiveWork(): boolean;
}

/** User-controlled install and update flow for the signed local runtime. */
export class RuntimeInstallModal extends Modal {
  private unsubscribe: (() => void) | null = null;
  private abortController: AbortController | null = null;
  private completedVersion: string | null = null;

  constructor(app: App, private readonly host: RuntimeInstallModalHost, private readonly repairRequested = false) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-runtime-install-modal");
    this.unsubscribe = this.host.onStateChange(() => this.render());
    if (this.repairRequested) {
      void this.refreshRepair();
      this.render();
      return;
    }
    this.render();
    const state = this.host.getState();
    if (state.status === "idle" || (state.status === "error" && !state.descriptor)) {
      void this.refresh();
    }
  }

  onClose(): void {
    const state = this.host.getState();
    if (state.status === "installing" && (state.phase === "downloading" || state.phase === "extracting")) {
      this.abortController?.abort();
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.abortController = null;
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    if (this.completedVersion) {
      this.setTitle("Chatobby is ready");
      this.statusIcon("circle-check");
      this.contentEl.createDiv({
        cls: "chatobby-runtime-install__lead",
        text: `Runtime ${this.completedVersion} is installed and connected.`,
      });
      this.actions([{ label: "Done", primary: true, run: () => this.close() }]);
      return;
    }

    const state = this.host.getState();
    if (state.status === "checking" || state.status === "idle") {
      this.setTitle("Preparing Chatobby");
      this.statusIcon("loader-circle", true);
      this.contentEl.createDiv({ cls: "chatobby-runtime-install__lead", text: "Checking the latest signed runtime release…" });
      return;
    }
    if (state.status === "current") {
      this.setTitle("Chatobby is up to date");
      this.statusIcon("circle-check");
      this.contentEl.createDiv({
        cls: "chatobby-runtime-install__lead",
        text: `Runtime ${state.installedVersion} is the latest compatible version.`,
      });
      this.actions([
        { label: "Check again", run: () => void this.refresh() },
        { label: "Done", primary: true, run: () => this.close() },
      ]);
      return;
    }
    if (state.status === "available") {
      const installingFresh = state.kind === "install";
      const repairing = state.kind === "repair";
      this.setTitle(installingFresh ? "Install Chatobby" : repairing ? "Repair Chatobby" : "Update Chatobby");
      this.statusIcon(installingFresh ? "download" : repairing ? "shield-check" : "package-open");
      this.contentEl.createDiv({
        cls: "chatobby-runtime-install__lead",
        text: installingFresh
          ? "Chatobby needs its local runtime before it can start."
          : repairing
            ? `A fresh, signed copy of runtime ${state.descriptor.version} is ready to replace the invalid package.`
            : `Runtime ${state.descriptor.version} is ready to install.`,
      });
      this.releaseSummary(state);
      if (this.host.hasActiveWork()) {
        this.contentEl.createDiv({
          cls: "chatobby-runtime-install__notice",
          text: "Finish the current response before installing this update.",
        });
      }
      this.actions([
        { label: "Cancel", run: () => this.close() },
        {
          label: installingFresh ? "Install" : repairing ? "Repair" : "Update",
          primary: true,
          disabled: this.host.hasActiveWork(),
          run: () => void this.install(),
        },
      ]);
      return;
    }
    if (state.status === "installing") {
      this.setTitle(
        state.kind === "repair" ? "Repairing Chatobby" : state.kind === "update" ? "Updating Chatobby" : "Installing Chatobby",
      );
      this.statusIcon("loader-circle", true);
      this.contentEl.createDiv({ cls: "chatobby-runtime-install__lead", text: phaseLabel(state) });
      const progress = progressRatio(state);
      const track = this.contentEl.createDiv({
        cls: "chatobby-runtime-install__progress",
        attr: {
          role: "progressbar",
          "aria-label": phaseLabel(state),
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "aria-valuenow": String(Math.floor(progress * 100)),
        },
      });
      track.createDiv({
        cls: "chatobby-runtime-install__progress-value",
        attr: { style: `width: ${Math.floor(progress * 100)}%` },
      });
      if (state.phase === "downloading" || state.phase === "extracting") {
        this.actions([{ label: "Cancel", run: () => this.close() }]);
      }
      return;
    }

    this.setTitle("Chatobby could not update");
    this.statusIcon("circle-alert");
    this.contentEl.createDiv({ cls: "chatobby-runtime-install__lead", text: state.message });
    this.contentEl.createDiv({
      cls: "chatobby-runtime-install__hint",
      text: state.code === "runtime_target_unavailable"
        ? "This release does not contain a runtime for this computer. No other architecture will be attempted."
        : "Your previous runtime remains available if an update cannot be installed.",
    });
    this.actions([
      { label: "Release page", run: () => openChatobbyUrl(CHATOBBY_RUNTIME_RELEASES_URL) },
      { label: "Support", run: () => openChatobbyUrl(CHATOBBY_SUPPORT_URL) },
      {
        label: "Try again",
        primary: true,
        run: () => void (this.repairRequested || state.kind === "repair" ? this.refreshRepair() : this.refresh()),
      },
    ]);
  }

  private releaseSummary(state: Extract<RuntimeUpdateState, { status: "available" }>): void {
    const summary = this.contentEl.createDiv({ cls: "chatobby-runtime-install__summary" });
    summary.createDiv({ text: `Version ${state.descriptor.version}` });
    summary.createDiv({ text: formatBytes(state.descriptor.bundle.size) });
    summary.createDiv({ text: formatTarget(state.descriptor.platform, state.descriptor.arch) });
    const details = this.contentEl.createEl("details", { cls: "chatobby-runtime-install__details" });
    details.createEl("summary", { text: "Security and installation details" });
    details.createEl("p", {
      text: "Downloaded from Chatobby's GitHub release, checked against its signed descriptor, then verified file-by-file before activation.",
    });
    details.createEl("p", {
      text: process.platform === "darwin"
        ? "Installed in your macOS user Library. Administrator access and security-setting changes are never requested; the previous version is kept for rollback."
        : "Installed for your Windows account. Administrator access is not requested, and the previous version is kept for rollback.",
    });
  }

  private statusIcon(name: string, spinning = false): void {
    const icon = this.contentEl.createDiv({
      cls: `chatobby-runtime-install__icon${spinning ? " is-spinning" : ""}`,
    });
    setIcon(icon, name);
  }

  private actions(actions: readonly ModalAction[]): void {
    const container = this.contentEl.createDiv({ cls: "chatobby-runtime-install__actions" });
    for (const action of actions) {
      const button = container.createEl("button", {
        cls: action.primary ? "mod-cta" : undefined,
        text: action.label,
        attr: { type: "button" },
      });
      button.disabled = action.disabled ?? false;
      button.addEventListener("click", action.run);
    }
  }

  private async refresh(): Promise<void> {
    try {
      await this.host.checkForUpdate();
    } catch (error) {
      console.error("Chatobby: runtime update check failed", error);
    }
  }

  private async refreshRepair(): Promise<void> {
    try {
      await this.host.checkForRepair();
    } catch (error) {
      console.error("Chatobby: runtime repair check failed", error);
    }
  }

  private async install(): Promise<void> {
    if (this.host.hasActiveWork()) {
      new Notice("Finish the current Chatobby response before updating the runtime");
      return;
    }
    this.abortController = new AbortController();
    try {
      this.completedVersion = await this.host.install(this.abortController.signal);
      this.render();
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        console.error("Chatobby: runtime installation failed", error);
      }
    } finally {
      this.abortController = null;
    }
  }
}

interface ModalAction {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  run: () => void;
}

function phaseLabel(state: Extract<RuntimeUpdateState, { status: "installing" }>): string {
  switch (state.phase) {
    case "downloading":
      return `${state.kind === "repair" ? "Downloading a fresh copy of" : "Downloading"} runtime ${state.descriptor.version}…`;
    case "extracting":
      return "Checking and preparing the downloaded files…";
    case "installing":
      return "Verifying every file and installing atomically…";
    case "reconnecting":
      return "Starting the updated runtime and reconnecting this vault…";
  }
}

function progressRatio(state: Extract<RuntimeUpdateState, { status: "installing" }>): number {
  if (state.phase === "installing") return 0.9;
  if (state.phase === "reconnecting") return 0.98;
  if (state.total <= 0) return 0;
  const raw = Math.max(0, Math.min(1, state.completed / state.total));
  return state.phase === "downloading" ? raw * 0.65 : 0.65 + raw * 0.25;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB download`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB download`;
}

function formatTarget(platform: NodeJS.Platform, arch: string): string {
  if (platform === "darwin") return arch === "arm64" ? "macOS · Apple Silicon" : "macOS · Intel";
  if (platform === "win32") return `Windows · ${arch === "x64" ? "64-bit" : arch}`;
  return `${platform} · ${arch}`;
}
