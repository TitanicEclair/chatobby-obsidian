import { Modal, Notice, PluginSettingTab, Setting, type App } from "obsidian";
import type ChatobbyPlugin from "./main";
import type { PluginSettings, ThinkingDisplay, WsProviderInfo } from "./types";
import { formatCommandArgs, splitCommandArgs } from "./backend/command-line";
import {
  CHATOBBY_CONNECTOR_REPOSITORY_URL,
  CHATOBBY_PATREON_URL,
  CHATOBBY_RUNTIME_RELEASES_URL,
  CHATOBBY_SUPPORT_URL,
  openChatobbyUrl,
} from "./publication";
import type { RuntimeLifecycleState } from "./runtime/public";

const THINKING_DISPLAY_OPTIONS: ThinkingDisplay[] = ["hidden", "collapsed", "expanded"];

export class ChatobbySettingTab extends PluginSettingTab {
  private providerCatalog: WsProviderInfo[] | null = null;
  private providerCatalogLoading = false;
  private providerCatalogError: string | null = null;
  private providerCatalogAttempted = false;

  constructor(app: App, private readonly plugin: ChatobbyPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("chatobby-settings");

    const heading = new Setting(containerEl)
      .setName("Chatobby")
      .setDesc("Local AI sessions, tools, and automations for this vault.")
      .setHeading();
    heading.settingEl.addClass("chatobby-settings__heading");

    this.renderConnectionSection(containerEl);
    this.renderDisplaySection(containerEl);
    this.renderCredentialsSection(containerEl);
    this.renderHelpSection(containerEl);
  }

  private renderConnectionSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Runtime").setHeading();
    const runtimeMode = this.plugin.getRuntimeMode();

    const runtimeState = this.plugin.getRuntimeState();
    const runtimeSetting = new Setting(containerEl)
      .setName("Chatobby runtime")
      .setDesc(runtimeStatusDescription(runtimeState));
    if (this.plugin.isReleaseBuild() && runtimeState.status !== "ready") {
      runtimeSetting.addButton((button) => button
        .setButtonText("Get runtime")
        .onClick(() => openChatobbyUrl(CHATOBBY_RUNTIME_RELEASES_URL)));
    }
    runtimeSetting
      .addButton((button) => {
        const ready = runtimeState.status === "ready";
        button
          .setButtonText(ready ? "Restart" : "Check again")
          .onClick(() => {
            const action = ready ? this.plugin.restartRuntime() : this.plugin.startBackend();
            action.then(() => this.display()).catch((error: unknown) => {
              console.error("Chatobby: runtime action failed", error);
              new Notice(error instanceof Error ? error.message : "Chatobby runtime action failed");
              this.display();
            });
          });
      });

    if (this.plugin.isReleaseBuild()) {
      new Setting(containerEl)
        .setName("Runtime mode")
        .setDesc("Managed. Release builds use only the signed runtime installed for Chatobby.");
    } else {
      new Setting(containerEl)
        .setName("Runtime mode")
        .setDesc("Managed is recommended. External connects without process ownership; Developer runs a custom local command.")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("managed", "Managed")
            .addOption("external", "External")
            .addOption("developer", "Developer")
            .setValue(runtimeMode)
            .onChange((value) => {
              this.updateSettings({ runtimeMode: value as PluginSettings["runtimeMode"] })
                .then(() => this.display())
                .catch((error: unknown) => {
                  console.error("Chatobby: failed to update runtime mode", error);
                  new Notice("Failed to update Chatobby runtime mode");
                });
            });
        });
    }

    new Setting(containerEl)
      .setName("Start when needed")
      .setDesc("Prepare Chatobby automatically when you open a Chatobby view.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.runtimeAutoStart)
          .onChange((value) => {
            this.updateSettings({ runtimeAutoStart: value }).catch((error: unknown) => {
              console.error("Chatobby: failed to update runtime startup preference", error);
              new Notice("Failed to update runtime startup preference");
            });
          });
      });

    if (runtimeMode === "managed") {
      new Setting(containerEl)
        .setName("Runtime lifetime")
        .setDesc("Keep Chatobby only while Obsidian is open, or leave it available for explicitly permitted background Events.")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("obsidian-session", "While Obsidian is open")
            .addOption("background", "Allow background Events")
            .setValue(this.plugin.settings.runtimeLifetime)
            .onChange((value) => {
              this.updateSettings({ runtimeLifetime: value === "background" ? "background" : "obsidian-session" })
                .then(() => this.display())
                .catch((error: unknown) => {
                  console.error("Chatobby: failed to update runtime lifetime", error);
                  new Notice("Failed to update Chatobby runtime lifetime");
                });
            });
        });
      if (this.plugin.settings.runtimeLifetime === "background") {
        containerEl.createDiv({
          cls: "chatobby-settings-note",
          text: "Background mode may continue work after Obsidian closes. Each Event still requires its own background permission, approval policy, and execution budget.",
        });
      }
    }

    if (runtimeMode === "external") {
      new Setting(containerEl)
        .setName("External server URL")
        .setDesc("WebSocket endpoint owned outside Obsidian. Chatobby will connect but will not start or stop it.")
        .addText((text) => {
          text
            .setPlaceholder("ws://127.0.0.1:9222")
            .setValue(this.plugin.settings.externalServerUrl)
            .onChange((value) => {
              this.plugin.setExternalServerUrl(value.trim()).catch((error: unknown) => {
                console.error("Chatobby: failed to update external server URL", error);
                new Notice("Failed to update external Chatobby server URL");
              });
            });
        });
    }

    if (runtimeMode === "developer") {
      new Setting(containerEl)
        .setName("Developer command")
        .setDesc("Local command used to launch the runtime. Chatobby supplies identity, port, vault, and credential arguments.")
        .addText((text) => {
          text
            .setPlaceholder("chatobby")
            .setValue(this.plugin.settings.developerCommand)
            .onChange((value) => {
              this.updateSettings({ developerCommand: value.trim() }).catch((error: unknown) => {
                console.error("Chatobby: failed to update developer command", error);
                new Notice("Failed to update Chatobby developer command");
              });
            });
        });

      new Setting(containerEl)
        .setName("Developer arguments")
        .setDesc("Optional command arguments. Runtime lifecycle arguments are reserved and cannot be overridden.")
        .addText((text) => {
          text
            .setValue(formatCommandArgs(this.plugin.settings.developerArgs))
            .onChange((value) => {
              this.updateSettings({ developerArgs: splitCommandArgs(value) }).catch((error: unknown) => {
                console.error("Chatobby: failed to update developer arguments", error);
                new Notice("Failed to update Chatobby developer arguments");
              });
            });
        });
    }

    new Setting(containerEl)
      .setName("Command shell")
      .setDesc("Shell used for terminal commands. Automatic is recommended; a change applies after the runtime restarts.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("auto", "Automatic")
          .addOption("pwsh", "PowerShell 7")
          .addOption("powershell", "Windows PowerShell")
          .addOption("cmd", "Command Prompt")
          .addOption("bash", "Bash")
          .addOption("zsh", "Zsh")
          .addOption("fish", "Fish")
          .addOption("sh", "POSIX sh")
          .addOption("custom", "Custom executable")
          .setValue(this.plugin.settings.commandShell)
          .onChange((value) => {
            this.updateSettings({ commandShell: value as PluginSettings["commandShell"] })
              .then(() => {
                new Notice("Command shell saved. Restart Chatobby to apply it.");
                this.display();
              })
              .catch((error: unknown) => {
                console.error("Chatobby: failed to update command shell", error);
                new Notice("Failed to update command shell");
              });
          });
      });

    if (this.plugin.settings.commandShell === "custom") {
      new Setting(containerEl)
        .setName("Shell executable")
        .setDesc("Executable name on PATH or an absolute path, for example nu, tcsh, or /opt/homebrew/bin/fish.")
        .addText((text) => {
          text
            .setPlaceholder("/path/to/shell")
            .setValue(this.plugin.settings.customShellPath)
            .onChange((value) => {
              this.updateSettings({ customShellPath: value.trim() }).catch((error: unknown) => {
                console.error("Chatobby: failed to update custom shell", error);
                new Notice("Failed to update custom shell");
              });
            });
        });
    }
  }

  private renderDisplaySection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Conversation").setHeading();

    new Setting(containerEl)
      .setName("Thinking blocks")
      .setDesc("Choose whether reasoning is hidden, folded, or shown by default.")
      .addDropdown((dropdown) => {
        for (const option of THINKING_DISPLAY_OPTIONS) {
          dropdown.addOption(option, labelThinkingDisplay(option));
        }
        dropdown
          .setValue(this.plugin.settings.thinkingDisplay)
          .onChange((value) => {
            this.updateSettings({ thinkingDisplay: value as ThinkingDisplay }).catch((error) => {
              console.error("Chatobby: failed to update thinking display", error);
              new Notice("Failed to update thinking display");
            });
          });
      });

    new Setting(containerEl)
      .setName("Auto-scroll")
      .setDesc("Follow new output until you deliberately scroll away from the bottom.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoScroll)
          .onChange((value) => {
            this.updateSettings({ autoScroll: value }).catch((error) => {
              console.error("Chatobby: failed to update auto-scroll", error);
              new Notice("Failed to update auto-scroll");
            });
          });
      });

    new Setting(containerEl)
      .setName("Auto-name sessions")
      .setDesc("Use the beginning of your prompt for free, or ask the active model to create a cleaner title.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("truncate", "Beginning of prompt")
          .addOption("model", "Generate with model");
        dropdown
          .setValue(this.plugin.settings.autoNameStrategy)
          .onChange((value) => {
            this.updateSettings({ autoNameStrategy: value as "truncate" | "model" }).catch((error) => {
              console.error("Chatobby: failed to update auto-name strategy", error);
              new Notice("Failed to update auto-name strategy");
            });
          });
      });
  }

  private renderCredentialsSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Model providers").setHeading();
    containerEl.createDiv({
      cls: "chatobby-settings-note",
      text: "Connect the providers you want to use. Keys stay in Chatobby's local runtime credential store and are never saved in the Obsidian plugin folder.",
    });

    this.requestProviderCatalog();

    if (this.providerCatalogLoading) {
      containerEl.createDiv({ cls: "chatobby-settings__provider-state", text: "Finding available providers…" });
    } else if (this.providerCatalogError) {
      new Setting(containerEl)
        .setName("Provider discovery unavailable")
        .setDesc(this.providerCatalogError)
        .addButton((button) => button.setButtonText("Try again").onClick(() => {
          this.providerCatalogAttempted = false;
          this.requestProviderCatalog();
          this.display();
        }));
    }

    const providers = this.providerRows();
    if (providers.length === 0) {
      containerEl.createDiv({
        cls: "chatobby-settings-note",
        text: this.providerCatalog
          ? "No providers are available from the current runtime."
          : "Provider options will appear when the Chatobby runtime is ready.",
      });
    } else {
      for (const provider of providers) {
        this.renderProviderRow(containerEl, provider);
      }
    }

    new Setting(containerEl)
      .setName("Custom provider")
      .setDesc("Connect a provider declared by a custom models.json configuration.")
      .addButton((button) => button.setButtonText("Add provider").onClick(() => this.openProviderModal()));
  }

  private renderHelpSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Help and development").setHeading();

    new Setting(containerEl)
      .setName("Documentation")
      .setDesc("Installation, first-run guidance, privacy details, and known alpha limitations.")
      .addButton((button) => button
        .setButtonText("View documentation")
        .onClick(() => openChatobbyUrl(CHATOBBY_CONNECTOR_REPOSITORY_URL)));

    new Setting(containerEl)
      .setName("Support")
      .setDesc("Report a reproducible problem without credentials or private vault content.")
      .addButton((button) => button
        .setButtonText("Report issue")
        .onClick(() => openChatobbyUrl(CHATOBBY_SUPPORT_URL)));

    new Setting(containerEl)
      .setName("Support development")
      .setDesc("Chatobby is free during alpha. Patreon support is optional and does not unlock product features.")
      .addButton((button) => button
        .setButtonText("Patreon")
        .onClick(() => openChatobbyUrl(CHATOBBY_PATREON_URL)));
  }

  private renderProviderRow(containerEl: HTMLElement, provider: WsProviderInfo): void {
    const configured = provider.configured || this.plugin.settings.providerKeys[provider.id] === true;
    const removable = provider.authSource === "stored" || this.plugin.settings.providerKeys[provider.id] === true;
    const setting = new Setting(containerEl)
      .setName(provider.name === provider.id ? provider.id : `${provider.name} (${provider.id})`)
      .setDesc(providerDescription(provider, configured))
      .addButton((button) => {
        button.setButtonText(configured ? "Update key" : "Connect").onClick(() => this.openProviderModal(provider));
      });
    setting.settingEl.addClass("chatobby-settings__provider");
    setting.settingEl.toggleClass("is-connected", configured);
    if (removable) {
      setting.addButton((button) => button.setButtonText("Disconnect").setWarning().onClick(() => {
        this.plugin.removeProviderKey(provider.id)
          .then(() => this.refreshAfterProviderChange())
          .catch((error) => {
            console.error("Chatobby: failed to remove provider key", error);
            new Notice(`Failed to disconnect ${provider.name}`);
          });
      }));
    }
  }

  private openProviderModal(provider?: WsProviderInfo): void {
    new ProviderCredentialModal(this.app, provider, (providerId, key) => this.saveProvider(providerId, key)).open();
  }

  private async saveProvider(provider: string, key: string): Promise<void> {
    if (!provider || !key) {
      new Notice("Provider and key are required");
      throw new Error("Provider and key are required");
    }

    await this.plugin.setProviderKey(provider, key);
    await this.refreshAfterProviderChange();
    new Notice(`${provider} connected`);
  }

  private updateSettings(patch: Partial<PluginSettings>): Promise<void> {
    return this.plugin.updateSettings(patch);
  }

  private requestProviderCatalog(): void {
    if (this.providerCatalog || this.providerCatalogLoading || this.providerCatalogAttempted) return;
    this.providerCatalogAttempted = true;
    void this.refreshProviderCatalog(true, false, false);
  }

  private async refreshProviderCatalog(
    startBackend: boolean,
    showFailureNotice = true,
    renderLoading = true,
  ): Promise<void> {
    this.providerCatalogLoading = true;
    this.providerCatalogError = null;
    if (renderLoading) this.display();

    try {
      if (startBackend) {
        await this.plugin.startBackend();
      }
      const transport = startBackend ? this.plugin.createTransport() : this.plugin.transport;
      if (!transport) throw new Error("Chatobby backend is not connected");
      if (!transport.isConnected) {
        if (!startBackend) throw new Error("Chatobby backend is not connected");
        await transport.connect();
      }
      this.providerCatalog = await transport.getProviders();
    } catch (error) {
      this.providerCatalogError = error instanceof Error ? error.message : String(error);
      if (showFailureNotice) new Notice("Could not discover Chatobby providers");
    } finally {
      this.providerCatalogLoading = false;
      this.display();
    }
  }

  private async refreshAfterProviderChange(): Promise<void> {
    this.providerCatalog = null;
    this.providerCatalogAttempted = true;
    await this.refreshProviderCatalog(true);
  }

  private providerRows(): WsProviderInfo[] {
    const byId = new Map<string, WsProviderInfo>();
    for (const provider of this.providerCatalog ?? []) {
      byId.set(provider.id, provider);
    }

    for (const providerId of this.plugin.configuredProviders()) {
      if (byId.has(providerId)) continue;
      byId.set(providerId, {
        id: providerId,
        name: providerId,
        configured: true,
        authSource: "stored",
        modelCount: 0,
        availableModelCount: 0,
      });
    }

    return [...byId.values()].sort((a, b) => {
      const aConfigured = a.configured || this.plugin.settings.providerKeys[a.id] === true;
      const bConfigured = b.configured || this.plugin.settings.providerKeys[b.id] === true;
      return Number(bConfigured) - Number(aConfigured) || a.name.localeCompare(b.name);
    });
  }
}

class ProviderCredentialModal extends Modal {
  private providerId: string;
  private key = "";
  private saving = false;

  constructor(
    app: App,
    private readonly provider: WsProviderInfo | undefined,
    private readonly saveProvider: (providerId: string, key: string) => Promise<void>,
  ) {
    super(app);
    this.providerId = provider?.id ?? "";
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-provider-modal");
    this.titleEl.setText(this.provider ? `Connect ${this.provider.name}` : "Connect custom provider");
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "chatobby-provider-modal__intro",
      text: this.provider
        ? "Paste an API key to connect this provider. Existing keys are replaced securely."
        : "Use the exact provider id from your models.json configuration.",
    });
    if (!this.provider) {
      new Setting(this.contentEl).setName("Provider id").addText((text) => text
        .setPlaceholder("provider-id")
        .onChange((value) => { this.providerId = value.trim(); }));
    }
    let keyInput: HTMLInputElement | null = null;
    new Setting(this.contentEl).setName("API key").addText((text) => {
      keyInput = text.inputEl;
      text.inputEl.type = "password";
      text.setPlaceholder("Paste API key").onChange((value) => { this.key = value.trim(); });
    });
    const actions = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const connect = actions.createEl("button", { cls: "mod-cta", text: "Connect", attr: { type: "button" } });
    connect.addEventListener("click", () => void this.connect(connect, cancel));
    requestAnimationFrame(() => keyInput?.focus());
  }

  private async connect(connect: HTMLButtonElement, cancel: HTMLButtonElement): Promise<void> {
    if (this.saving) return;
    if (!this.providerId || !this.key) {
      new Notice("Provider and API key are required");
      return;
    }
    this.saving = true;
    connect.disabled = true;
    cancel.disabled = true;
    try {
      await this.saveProvider(this.providerId, this.key);
      this.close();
    } catch (error) {
      console.error("Chatobby: failed to connect provider", error);
      new Notice(`Could not connect ${this.providerId}`);
      connect.disabled = false;
      cancel.disabled = false;
    } finally {
      this.saving = false;
    }
  }
}

function labelThinkingDisplay(value: ThinkingDisplay): string {
  switch (value) {
    case "hidden":
      return "Hidden";
    case "collapsed":
      return "Collapsed";
    case "expanded":
      return "Expanded";
  }
}

function providerDescription(provider: WsProviderInfo, configured: boolean): string {
  const available = provider.availableModelCount === 1 ? "1 model available" : `${provider.availableModelCount} models available`;
  if (!configured) return provider.modelCount > 0 ? `Not connected · ${provider.modelCount} supported models` : "Not connected";
  return `Connected${authSourceLabel(provider)} · ${available}`;
}

function authSourceLabel(provider: WsProviderInfo): string {
  switch (provider.authSource) {
    case "stored":
      return "";
    case "runtime":
      return provider.authLabel ? ` through ${provider.authLabel}` : " through the runtime";
    case "environment":
      return provider.authLabel ? ` through ${provider.authLabel}` : " through the environment";
    case "fallback":
      return " through fallback credentials";
    case "models_json_key":
      return " through models.json";
    case "models_json_command":
      return " through a models.json command";
    default:
      return "";
  }
}

function runtimeStatusDescription(state: RuntimeLifecycleState): string {
  switch (state.status) {
    case "idle":
      return "Not running.";
    case "resolving":
      return "Checking for this vault's runtime.";
    case "spawning":
      return `Starting runtime (attempt ${state.attempt}).`;
    case "authenticating":
      return "Verifying runtime identity and session access.";
    case "ready":
      return `Ready - ${state.runtime.identity.runtimeVersion} on ${state.runtime.ownership} mode.`;
    case "stopping":
      return "Stopping runtime safely.";
    case "detached":
      return "Detached. Session-owned work may reattach during the grace period.";
    case "error":
      return state.diagnostics.message;
    case "crash_loop":
      return `${state.diagnostics.message} Automatic restart paused.`;
  }
}
