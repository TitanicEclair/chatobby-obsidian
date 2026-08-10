import { Modal, Notice, PluginSettingTab, Setting, type App, type SettingDefinitionItem } from "obsidian";
import type ChatobbyPlugin from "./main";
import {
  DEFAULT_COMPOSER_KEYBINDINGS,
  type ComposerKeybindings,
  type PluginSettings,
  type ThinkingDisplay,
  type WsLocalModelProvider,
  type WsLocalModelProviderDocument,
  type WsLocalModelProviderProbeResult,
  type WsProviderInfo,
} from "./types";
import { formatCommandArgs, splitCommandArgs } from "./backend/command-line";
import {
  BRAVE_SEARCH_API_DOCUMENTATION_URL,
  CHATOBBY_CONNECTOR_REPOSITORY_URL,
  CHATOBBY_PATREON_URL,
  CHATOBBY_SUPPORT_URL,
  openChatobbyUrl,
} from "./publication";
import type { RuntimeLifecycleState } from "./runtime/public";
import { confirmAction } from "./ui/modals/modals";
import {
  composerKeybindingFromEvent,
  composerKeybindingLabel,
  type ComposerKeybindingAction,
} from "./ui/composer/keybindings";

const THINKING_DISPLAY_OPTIONS: ThinkingDisplay[] = ["hidden", "collapsed", "expanded"];
const SETTINGS_SEARCH_ALIASES = [
  "runtime",
  "install runtime",
  "runtime mode",
  "runtime lifetime",
  "command shell",
  "document OCR",
  "PDF OCR",
  "Office documents",
  "external server",
  "developer command",
  "model providers",
  "API key",
  "thinking blocks",
  "auto-scroll",
  "auto-name sessions",
  "composer shortcuts",
  "documentation",
  "support",
  "Patreon",
];

export class ChatobbySettingTab extends PluginSettingTab {
  private providerCatalog: WsProviderInfo[] | null = null;
  private localProviderDocument: WsLocalModelProviderDocument | null = null;
  private providerCatalogLoading = false;
  private providerCatalogError: string | null = null;
  private providerCatalogAttempted = false;
  private settingsHost: HTMLElement | null = null;
	private settingsSurface: "plugin" | "chatobby" = "plugin";

  constructor(app: App, private readonly plugin: ChatobbyPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [{
      type: "group",
      cls: "chatobby-settings",
      items: [{
        name: "Chatobby settings",
        desc: "Runtime, document handling, and support, with everyday settings available inside Chatobby.",
        aliases: SETTINGS_SEARCH_ALIASES,
        render: (setting) => {
          setting.settingEl.empty();
          setting.settingEl.addClass("chatobby-settings__definition-host");
          this.settingsHost = setting.settingEl;
					this.settingsSurface = "plugin";
          this.renderSettings(setting.settingEl, "plugin");
        },
      }],
    }];
  }

  display(): void {
    this.settingsHost = this.containerEl;
		this.settingsSurface = "plugin";
    this.renderSettings(this.containerEl, "plugin");
  }

	/** Render the full user-facing Settings page without changing credential ownership. */
	renderChatobbySettings(containerEl: HTMLElement): void {
		this.settingsHost = containerEl;
		this.settingsSurface = "chatobby";
		this.renderSettings(containerEl, "chatobby");
	}

	/** Detach an embedded surface so an asynchronous provider refresh cannot repaint another page. */
	detachChatobbySettings(containerEl: HTMLElement | null): void {
		if (containerEl && this.settingsHost === containerEl) this.settingsHost = null;
	}

  private renderSettings(containerEl: HTMLElement, surface: "plugin" | "chatobby"): void {
    containerEl.empty();
    containerEl.addClass("chatobby-settings");

    containerEl.createDiv({
      cls: "chatobby-settings__intro",
      text: "Local AI sessions, tools, and automations for this vault.",
    });

		if (surface === "plugin") {
			const moved = containerEl.createDiv({ cls: "chatobby-settings-note chatobby-settings-note--moved" });
			moved.createEl("strong", { text: "Everyday Chatobby settings moved into Chatobby" });
			moved.createDiv({
				text: "Model providers, API keys, local model servers, conversation preferences, and Project behavior are now easier to find from Chatobby's Settings page.",
			});
			new Setting(moved)
				.setName("Open Chatobby Settings")
				.setDesc("Open a Chatobby view and manage these options there.")
				.addButton((button) => button.setButtonText("Open Settings").setCta().onClick(() => {
					void this.plugin.openChatobbySettings();
				}));
		}
		if (surface === "chatobby") {
			this.renderFirstRunSection(containerEl);
			this.renderCredentialsSection(containerEl);
			this.renderWebResearchSection(containerEl);
			this.renderDisplaySection(containerEl);
			this.renderProjectsSection(containerEl);
		}
		this.renderConnectionSection(containerEl);
		this.renderDocumentSection(containerEl);
    this.renderHelpSection(containerEl);
  }

	private renderFirstRunSection(containerEl: HTMLElement): void {
		if (this.plugin.settings.onboardingVersion >= 1) return;
		const section = containerEl.createDiv({
			cls: "chatobby-settings-note",
		});
		section.createEl("strong", { text: "Start here" });
		section.createDiv({
			text: "Chatobby starts its signed local runtime automatically. Connect one model provider below, return to the Chatobby tab, review the active permission profile if needed, then send a message.",
		});
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
        .setButtonText("Install runtime")
        .onClick(() => this.plugin.openRuntimeInstaller()));
    } else if (this.plugin.isReleaseBuild()) {
      runtimeSetting.addButton((button) => button
        .setButtonText("Check for updates")
        .onClick(() => this.plugin.openRuntimeInstaller()));
    }
    runtimeSetting
      .addButton((button) => {
        const ready = runtimeState.status === "ready";
        button
          .setButtonText(ready ? "Restart" : "Check again")
          .onClick(() => {
            const action = ready ? this.plugin.restartRuntime() : this.plugin.startBackend();
            action.then(() => this.refreshSettingsSurface()).catch((error: unknown) => {
              console.error("Chatobby: runtime action failed", error);
              new Notice(error instanceof Error ? error.message : "Chatobby runtime action failed");
              this.refreshSettingsSurface();
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
                .then(() => this.refreshSettingsSurface())
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
                .then(() => this.refreshSettingsSurface())
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
      .setDesc("Shell used for terminal commands. Automatic uses Git Bash on Windows and your configured shell or a Bash/sh fallback on macOS and Linux. Changes apply after the runtime restarts.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("auto", "Automatic (recommended)")
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
                this.refreshSettingsSurface();
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
              this.updateSettings({ customShellPath: value.trim() })
                .then(() => {
                  new Notice("Command shell saved. Restart Chatobby to apply it.");
                })
                .catch((error: unknown) => {
                  console.error("Chatobby: failed to update custom shell", error);
                  new Notice("Failed to update custom shell");
                });
            });
        });
    }
  }

  private renderDocumentSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Documents").setHeading();

    new Setting(containerEl)
      .setName("Document OCR")
      .setDesc("Built-in OCR handles scanned images and image-only PDFs. Advanced local OCR preserves more layout but requires MinerU to be installed separately.")
      .addDropdown((dropdown) => dropdown
        .addOption("builtin", "Built-in OCR (recommended)")
        .addOption("advanced", "Advanced local OCR")
        .setValue(this.plugin.settings.documentOcrEngine)
        .onChange((value) => {
          this.updateSettings({ documentOcrEngine: value === "advanced" ? "advanced" : "builtin" })
            .then(() => {
              new Notice("Document OCR setting saved. Restart Chatobby to apply it.");
              this.refreshSettingsSurface();
            })
            .catch((error: unknown) => {
              console.error("Chatobby: failed to update document OCR", error);
              new Notice("Failed to update document OCR");
            });
        }));

    new Setting(containerEl)
      .setName("OCR language")
      .setDesc("Tesseract language code, for example eng or eng+fra. English is available by default; other languages may download data on first use.")
      .addText((text) => text
        .setPlaceholder("eng")
        .setValue(this.plugin.settings.documentOcrLanguage)
        .onChange((value) => {
          this.updateSettings({ documentOcrLanguage: value.trim() || "eng" })
            .then(() => new Notice("OCR language saved. Restart Chatobby to apply it."))
            .catch((error: unknown) => {
              console.error("Chatobby: failed to update OCR language", error);
              new Notice("Failed to update OCR language");
            });
        }));

    if (this.plugin.settings.documentOcrEngine === "advanced") {
      new Setting(containerEl)
        .setName("Advanced OCR command")
        .setDesc("MinerU executable name on PATH or an absolute executable path. Chatobby invokes it without a shell and applies a five-minute limit.")
        .addText((text) => text
          .setPlaceholder("mineru")
          .setValue(this.plugin.settings.advancedOcrCommand)
          .onChange((value) => {
            this.updateSettings({ advancedOcrCommand: value.trim() || "mineru" })
              .then(() => new Notice("Advanced OCR command saved. Restart Chatobby to apply it."))
              .catch((error: unknown) => {
                console.error("Chatobby: failed to update advanced OCR command", error);
                new Notice("Failed to update advanced OCR command");
              });
          }));
      containerEl.createDiv({
        cls: "chatobby-settings-note",
        text: "Advanced OCR is optional and model-inferred. Chatobby does not install model weights, alter Python, or bypass operating-system security settings.",
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

    new Setting(containerEl)
      .setName("Message box keys")
      .setDesc("These keys depend on the cursor position, so they apply only while the Chatobby message box is focused.");
    this.renderComposerKeybinding(
      containerEl,
      "previousMessage",
      "Previous message",
      "Recall earlier prompts when the cursor is at the beginning of the message.",
    );
    this.renderComposerKeybinding(
      containerEl,
      "nextMessage",
      "Next message",
      "Move toward newer recalled prompts when the cursor is at the end of the message.",
    );
    this.renderComposerKeybinding(
      containerEl,
      "cancelTurn",
      "Cancel turn",
      "Arm and confirm cancellation without affecting other Obsidian editors.",
    );
    new Setting(containerEl)
      .setName("Other Chatobby shortcuts")
      .setDesc("Use Obsidian Settings → Hotkeys and search for Chatobby to bind page navigation, session actions, draft stashing, exports, and runtime controls.");
  }

	private renderProjectsSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Starting from a Project folder")
			.setDesc(
				"Choose what happens when you start a session from a folder that already has Chatobby's canonical Project.",
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("ask", "Ask each time")
					.addOption("reuse-canonical", "Continue existing Project")
					.addOption("create-new", "Create a new Project")
					.setValue(this.plugin.settings.directoryProjectLaunchBehavior)
					.onChange((value) => {
						this.updateSettings({
							directoryProjectLaunchBehavior: value as PluginSettings["directoryProjectLaunchBehavior"],
						}).catch((error: unknown) => {
							console.error("Chatobby: failed to update Project folder behavior", error);
							new Notice("Failed to update Project folder behavior");
						});
					});
			});
	}

  private renderComposerKeybinding(
    containerEl: HTMLElement,
    action: ComposerKeybindingAction,
    name: string,
    description: string,
  ): void {
    const setting = new Setting(containerEl).setName(name).setDesc(description);
    setting.addText((text) => {
      text.setValue(composerKeybindingLabel(this.plugin.settings.composerKeybindings[action]));
      text.inputEl.readOnly = true;
      text.inputEl.setAttr("aria-label", `${name} shortcut. Focus and press a replacement shortcut.`);
      text.inputEl.addEventListener("keydown", (event) => {
        const binding = composerKeybindingFromEvent(event);
        if (!binding) return;
        event.preventDefault();
        event.stopPropagation();
        if (bindingUsedByAnotherAction(this.plugin.settings.composerKeybindings, action, binding)) {
          new Notice(`${composerKeybindingLabel(binding)} is already assigned to another Chatobby action.`);
          return;
        }
        text.setValue(composerKeybindingLabel(binding));
        void this.updateSettings({
          composerKeybindings: { ...this.plugin.settings.composerKeybindings, [action]: binding },
        }).catch((error) => {
          console.error("Chatobby: failed to update composer shortcut", error);
          new Notice("Failed to update composer shortcut");
        });
      });
    });
    setting.addButton((button) => button
      .setButtonText("Reset")
      .setTooltip(`Reset ${name.toLowerCase()}`)
      .onClick(() => {
        void this.updateSettings({
          composerKeybindings: {
            ...this.plugin.settings.composerKeybindings,
            [action]: DEFAULT_COMPOSER_KEYBINDINGS[action],
          },
        }).then(() => this.refreshSettingsSurface()).catch((error) => {
          console.error("Chatobby: failed to reset composer shortcut", error);
          new Notice("Failed to reset composer shortcut");
        });
      }));
  }

  private renderCredentialsSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Model providers").setHeading();
    containerEl.createDiv({
      cls: "chatobby-settings-note",
      text: "Connect the providers you want to use. Keys stay in Chatobby's local runtime credential store and are never saved in the Obsidian plugin folder.",
    });

    new Setting(containerEl)
      .setName("Local model servers")
      .setDesc("Connect a model server already running on this computer or network. Chatobby does not start or install the server.")
      .addButton((button) => button
        .setButtonText("Add server")
        .setCta()
        .onClick(() => this.openLocalProviderModal()));

    for (const provider of this.localProviderDocument?.providers ?? []) {
      this.renderLocalProviderRow(containerEl, provider);
    }

    if (this.localProviderDocument && this.localProviderDocument.providers.length === 0) {
      containerEl.createDiv({
        cls: "chatobby-settings-note",
        text: "No local servers configured. Ollama, LM Studio, vLLM, llama.cpp, and compatible OpenAI or Anthropic Messages endpoints are supported.",
      });
    }

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
          this.refreshSettingsSurface();
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
      .setName("Advanced provider credential")
      .setDesc("Connect a provider id that you manage manually in models.json.")
      .addButton((button) => button.setButtonText("Add credential").onClick(() => this.openProviderModal()));
  }

  private renderWebResearchSection(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Web research").setHeading();
    containerEl.createDiv({
      cls: "chatobby-settings-note",
      text: "Basic public-web search works without an account. You can optionally connect Brave Search for stronger freshness, language, region, and date filtering. Chatobby always reports which provider mode a search used.",
    });
    const configured = this.plugin.hasEnhancedWebSearch();
    const setting = new Setting(containerEl)
      .setName("Enhanced Brave Search")
      .setDesc(configured
        ? "Connected through an Obsidian-stored secret. The key is sent only to Chatobby's built-in web-search process."
        : "Optional. Requires your own Brave Search API account and key; provider pricing and allowances are controlled by Brave.")
      .addButton((button) => button
        .setButtonText(configured ? "Update key" : "Connect")
        .setCta()
        .onClick(() => new WebSearchCredentialModal(
          this.app,
          (key) => this.plugin.setEnhancedWebSearchKey(key),
          () => this.refreshSettingsSurface(),
        ).open()))
      .addButton((button) => button
        .setButtonText("Brave API docs")
        .onClick(() => openChatobbyUrl(BRAVE_SEARCH_API_DOCUMENTATION_URL)));
    if (configured) {
      setting.addButton((button) => {
        button.setButtonText("Disconnect");
        button.buttonEl.addClass("mod-warning");
        button.onClick(() => {
          void this.plugin.removeEnhancedWebSearchKey()
            .then(() => {
              new Notice("Enhanced web search disconnected");
              this.refreshSettingsSurface();
            })
            .catch((error: unknown) => {
              console.error("Chatobby: failed to disconnect enhanced web search", error);
              new Notice("Could not disconnect enhanced web search");
            });
        });
      });
    }
    setting.settingEl.addClass("chatobby-settings__provider", configured ? "is-connected" : "is-available");
  }

  private renderLocalProviderRow(containerEl: HTMLElement, provider: WsLocalModelProvider): void {
    const api = localModelApiLabel(provider.api);
    const setting = new Setting(containerEl)
      .setName(provider.name)
      .setDesc(`${localModelPresetLabel(provider.preset)} · ${api} · ${provider.models.length} model${provider.models.length === 1 ? "" : "s"} · ${provider.baseUrl}`)
      .addButton((button) => button.setButtonText("Test").onClick(() => {
        void this.testLocalProvider(provider).then((result) => {
          new Notice(`${provider.name}: ${result.message}`);
        }).catch((error: unknown) => {
          console.error("Chatobby: local model server test failed", error);
          new Notice(error instanceof Error ? error.message : "Local model server test failed");
        });
      }))
      .addButton((button) => button.setButtonText("Edit").onClick(() => this.openLocalProviderModal(provider)))
      .addButton((button) => {
        button.setButtonText("Remove");
        button.buttonEl.addClass("mod-warning");
        button.onClick(() => void this.removeLocalProvider(provider));
      });
    setting.settingEl.addClass("chatobby-settings__provider", "is-connected");
  }

  private openLocalProviderModal(provider?: WsLocalModelProvider): void {
    const revision = this.localProviderDocument?.revision ?? 0;
    new LocalModelProviderModal(
      this.app,
      provider,
      async (candidate, apiKey) => {
        const transport = await this.runtimeTransport();
        this.localProviderDocument = await transport.saveLocalModelProvider(revision, candidate, apiKey);
        await this.refreshProviderCatalog(false, false);
        new Notice(`${candidate.name} saved`);
      },
      async (candidate, apiKey) => this.testLocalProvider(candidate, apiKey),
    ).open();
  }

  private async testLocalProvider(
    provider: WsLocalModelProvider,
    apiKey?: string,
  ): Promise<WsLocalModelProviderProbeResult> {
    return (await this.runtimeTransport()).testLocalModelProvider(provider, apiKey);
  }

  private async removeLocalProvider(provider: WsLocalModelProvider): Promise<void> {
    const confirmed = await confirmAction(this.app, {
      title: `Remove ${provider.name}?`,
      message: "This removes the server and its stored credential from Chatobby. It does not stop or uninstall the local model server.",
      confirmLabel: "Remove server",
      destructive: true,
    });
    if (!confirmed) return;
    const transport = await this.runtimeTransport();
    this.localProviderDocument = await transport.deleteLocalModelProvider(
      this.localProviderDocument?.revision ?? 0,
      provider.id,
      true,
    );
    await this.refreshProviderCatalog(false, false);
    new Notice(`${provider.name} removed`);
  }

  private async runtimeTransport() {
    await this.plugin.startBackend();
    const transport = this.plugin.createTransport();
    if (!transport.isConnected) await transport.connect();
    return transport;
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
      setting.addButton((button) => {
        button.setButtonText("Disconnect");
        button.buttonEl.addClass("mod-warning");
        button.onClick(() => {
          this.plugin.removeProviderKey(provider.id)
            .then(() => this.refreshAfterProviderChange())
            .catch((error) => {
              console.error("Chatobby: failed to remove provider key", error);
              new Notice(`Failed to disconnect ${provider.name}`);
            });
        });
      });
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

  private refreshSettingsSurface(): void {
    const host = this.settingsHost?.isConnected ? this.settingsHost : this.containerEl;
		this.renderSettings(host, this.settingsSurface);
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
    if (renderLoading) this.refreshSettingsSurface();

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
      [this.providerCatalog, this.localProviderDocument] = await Promise.all([
        transport.getProviders(),
        transport.getLocalModelProviders(),
      ]);
    } catch (error) {
      this.providerCatalogError = error instanceof Error ? error.message : String(error);
      if (showFailureNotice) new Notice("Could not discover Chatobby providers");
    } finally {
      this.providerCatalogLoading = false;
      this.refreshSettingsSurface();
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
      if (this.localProviderDocument?.providers.some((local) => local.id === provider.id)) continue;
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
    window.requestAnimationFrame(() => keyInput?.focus());
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

class WebSearchCredentialModal extends Modal {
  private key = "";
  private saving = false;

  constructor(
    app: App,
    private readonly save: (key: string) => Promise<void>,
    private readonly afterSave: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-provider-modal");
    this.titleEl.setText("Connect Brave Search");
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "chatobby-provider-modal__intro",
      text: "Paste a Brave Search API key. Chatobby stores it in Obsidian's secret storage and does not save it in plugin settings, logs, or diagnostics.",
    });
    let keyInput: HTMLInputElement | null = null;
    new Setting(this.contentEl).setName("API key").addText((text) => {
      keyInput = text.inputEl;
      text.inputEl.type = "password";
      text.setPlaceholder("Paste Brave Search API key").onChange((value) => { this.key = value.trim(); });
    });
    const actions = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    const connect = actions.createEl("button", { cls: "mod-cta", text: "Connect", attr: { type: "button" } });
    connect.addEventListener("click", () => void this.connect(connect, cancel));
    window.requestAnimationFrame(() => keyInput?.focus());
  }

  private async connect(connect: HTMLButtonElement, cancel: HTMLButtonElement): Promise<void> {
    if (this.saving) return;
    if (!this.key) {
      new Notice("A Brave Search API key is required");
      return;
    }
    this.saving = true;
    connect.disabled = true;
    cancel.disabled = true;
    try {
      await this.save(this.key);
      this.afterSave();
      new Notice("Enhanced web search connected");
      this.close();
    } catch (error) {
      console.error("Chatobby: failed to connect enhanced web search", error);
      new Notice("Could not connect enhanced web search");
      connect.disabled = false;
      cancel.disabled = false;
    } finally {
      this.saving = false;
    }
  }
}

class LocalModelProviderModal extends Modal {
  private candidate: WsLocalModelProvider;
  private modelLines: string;
  private apiKey = "";
  private saving = false;

  constructor(
    app: App,
    provider: WsLocalModelProvider | undefined,
    private readonly saveProvider: (provider: WsLocalModelProvider, apiKey?: string) => Promise<void>,
    private readonly testProvider: (
      provider: WsLocalModelProvider,
      apiKey?: string,
    ) => Promise<WsLocalModelProviderProbeResult>,
  ) {
    super(app);
    this.candidate = provider ? structuredClone(provider) : defaultLocalModelProvider("ollama");
    this.modelLines = this.candidate.models.map((model) => (
      model.name === model.id ? model.id : `${model.id} | ${model.name}`
    )).join("\n");
  }

  onOpen(): void {
    this.modalEl.addClass("chatobby-provider-modal", "chatobby-local-model-modal");
    this.render();
  }

  private render(): void {
    this.titleEl.setText(this.candidate.id ? `Local model server: ${this.candidate.name}` : "Add local model server");
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "chatobby-provider-modal__intro",
      text: "Chatobby connects to a server you run separately. Configuration is stored locally; bearer tokens stay in the runtime credential store.",
    });

    new Setting(this.contentEl).setName("Server type").addDropdown((dropdown) => dropdown
      .addOption("ollama", "Ollama")
      .addOption("lm-studio", "LM Studio")
      .addOption("vllm", "vLLM")
      .addOption("llama-cpp", "llama.cpp")
      .addOption("openai-compatible", "OpenAI-compatible")
      .addOption("anthropic-compatible", "Anthropic Messages-compatible")
      .setValue(this.candidate.preset)
      .onChange((value) => {
        const preset = value as WsLocalModelProvider["preset"];
        const defaults = defaultLocalModelProvider(preset);
        this.candidate = {
          ...this.candidate,
          preset,
          api: defaults.api,
          baseUrl: defaults.baseUrl,
          authentication: defaults.authentication,
        };
        this.render();
      }));

    new Setting(this.contentEl).setName("Name").addText((text) => text
      .setValue(this.candidate.name)
      .setPlaceholder("My local server")
      .onChange((value) => { this.candidate = { ...this.candidate, name: value }; }));
    new Setting(this.contentEl)
      .setName("Provider id")
      .setDesc("Stable lowercase id used in model selectors. Changing it creates a different provider.")
      .addText((text) => text
        .setValue(this.candidate.id)
        .setPlaceholder("local-models")
        .onChange((value) => { this.candidate = { ...this.candidate, id: value.trim().toLowerCase() }; }));
    new Setting(this.contentEl).setName("Server URL").addText((text) => text
      .setValue(this.candidate.baseUrl)
      .setPlaceholder("http://127.0.0.1:11434/v1")
      .onChange((value) => { this.candidate = { ...this.candidate, baseUrl: value.trim() }; }));
    new Setting(this.contentEl).setName("API format").addDropdown((dropdown) => dropdown
      .addOption("openai-completions", "OpenAI Chat Completions")
      .addOption("openai-responses", "OpenAI Responses")
      .addOption("anthropic-messages", "Anthropic Messages")
      .setValue(this.candidate.api)
      .onChange((value) => {
        this.candidate = { ...this.candidate, api: value as WsLocalModelProvider["api"] };
      }));
    new Setting(this.contentEl).setName("Authentication").addDropdown((dropdown) => dropdown
      .addOption("none", "None")
      .addOption("api-key", "Provider API key")
      .addOption("bearer", "Bearer token")
      .setValue(this.candidate.authentication)
      .onChange((value) => {
        this.candidate = { ...this.candidate, authentication: value as WsLocalModelProvider["authentication"] };
        this.render();
      }));
    if (this.candidate.authentication !== "none") {
      new Setting(this.contentEl)
        .setName(this.candidate.authentication === "api-key" ? "Provider API key" : "Bearer token")
        .setDesc("Optional when editing: leave blank to keep the existing credential.")
        .addText((text) => {
          text.inputEl.type = "password";
          text.setPlaceholder("Token").onChange((value) => { this.apiKey = value.trim(); });
        });
    }
    new Setting(this.contentEl)
      .setName("Models")
      .setDesc("One model per line. Use model-id or model-id | Display name.")
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text.setValue(this.modelLines).setPlaceholder("model-id | Friendly name").onChange((value) => {
          this.modelLines = value;
        });
      });

    const first = this.candidate.models[0] ?? defaultLocalModelProvider(this.candidate.preset).models[0]!;
    new Setting(this.contentEl).setName("Context window").addText((text) => text
      .setValue(String(first.contextWindow))
      .onChange((value) => this.updateModelDefaults({ contextWindow: Number(value) })));
    new Setting(this.contentEl).setName("Maximum output tokens").addText((text) => text
      .setValue(String(first.maxTokens))
      .onChange((value) => this.updateModelDefaults({ maxTokens: Number(value) })));
    new Setting(this.contentEl).setName("Reasoning model").addToggle((toggle) => toggle
      .setValue(first.reasoning)
      .onChange((value) => this.updateModelDefaults({ reasoning: value })));
    new Setting(this.contentEl).setName("Accepts images").addToggle((toggle) => toggle
      .setValue(first.imageInput)
      .onChange((value) => this.updateModelDefaults({ imageInput: value })));

    const status = this.contentEl.createDiv({ cls: "chatobby-local-model-modal__status" });
    const actions = this.contentEl.createDiv({ cls: "chatobby-modal-actions" });
    const test = actions.createEl("button", { text: "Test connection", attr: { type: "button" } });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    const save = actions.createEl("button", { cls: "mod-cta", text: "Save", attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    test.addEventListener("click", () => void this.test(test, save, status));
    save.addEventListener("click", () => void this.save(save, test, cancel));
  }

  private updateModelDefaults(patch: Partial<WsLocalModelProvider["models"][number]>): void {
    const current = this.candidate.models[0] ?? defaultLocalModelProvider(this.candidate.preset).models[0]!;
    this.candidate = { ...this.candidate, models: [{ ...current, ...patch }] };
  }

  private assembledCandidate(): WsLocalModelProvider {
    const defaults = this.candidate.models[0] ?? defaultLocalModelProvider(this.candidate.preset).models[0]!;
    const models = this.modelLines.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [idPart, ...nameParts] = line.split("|");
      const id = idPart?.trim() ?? "";
      const name = nameParts.join("|").trim() || id;
      return { ...defaults, id, name };
    });
    return { ...this.candidate, name: this.candidate.name.trim(), models };
  }

  private async test(
    test: HTMLButtonElement,
    save: HTMLButtonElement,
    status: HTMLElement,
  ): Promise<void> {
    test.disabled = true;
    save.disabled = true;
    status.setText("Testing connection…");
    try {
      const result = await this.testProvider(this.assembledCandidate(), this.apiKey || undefined);
      status.setText(`${result.message} ${result.latencyMs} ms.`);
      status.toggleClass("is-success", result.status === "reachable");
      status.toggleClass("is-error", result.status !== "reachable");
    } catch (error) {
      status.setText(error instanceof Error ? error.message : "Connection test failed");
      status.removeClass("is-success");
      status.addClass("is-error");
    } finally {
      test.disabled = false;
      save.disabled = false;
    }
  }

  private async save(
    save: HTMLButtonElement,
    test: HTMLButtonElement,
    cancel: HTMLButtonElement,
  ): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    save.disabled = true;
    test.disabled = true;
    cancel.disabled = true;
    try {
      await this.saveProvider(this.assembledCandidate(), this.apiKey || undefined);
      this.close();
    } catch (error) {
      console.error("Chatobby: failed to save local model server", error);
      new Notice(error instanceof Error ? error.message : "Could not save local model server");
      save.disabled = false;
      test.disabled = false;
      cancel.disabled = false;
    } finally {
      this.saving = false;
    }
  }
}

function defaultLocalModelProvider(preset: WsLocalModelProvider["preset"]): WsLocalModelProvider {
  const common = {
    id: preset,
    name: localModelPresetLabel(preset),
    preset,
    models: [{ id: "model", name: "model", contextWindow: 32_768, maxTokens: 4_096, reasoning: false, imageInput: false }],
  };
  switch (preset) {
    case "ollama":
      return { ...common, api: "openai-completions", baseUrl: "http://127.0.0.1:11434/v1", authentication: "none" };
    case "lm-studio":
      return { ...common, api: "openai-completions", baseUrl: "http://127.0.0.1:1234/v1", authentication: "none" };
    case "vllm":
      return { ...common, api: "openai-completions", baseUrl: "http://127.0.0.1:8000/v1", authentication: "none" };
    case "llama-cpp":
      return { ...common, api: "openai-completions", baseUrl: "http://127.0.0.1:8080/v1", authentication: "none" };
    case "openai-compatible":
      return { ...common, api: "openai-completions", baseUrl: "http://127.0.0.1:8000/v1", authentication: "bearer" };
    case "anthropic-compatible":
      return { ...common, api: "anthropic-messages", baseUrl: "http://127.0.0.1:8000/v1", authentication: "api-key" };
  }
}

function localModelPresetLabel(preset: WsLocalModelProvider["preset"]): string {
  switch (preset) {
    case "ollama": return "Ollama";
    case "lm-studio": return "LM Studio";
    case "vllm": return "vLLM";
    case "llama-cpp": return "llama.cpp";
    case "openai-compatible": return "OpenAI-compatible";
    case "anthropic-compatible": return "Anthropic Messages-compatible";
  }
}

function localModelApiLabel(api: WsLocalModelProvider["api"]): string {
  switch (api) {
    case "openai-completions": return "Chat Completions";
    case "openai-responses": return "Responses API";
    case "anthropic-messages": return "Messages API";
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

function bindingUsedByAnotherAction(
  bindings: ComposerKeybindings,
  action: ComposerKeybindingAction,
  binding: string,
): boolean {
  return (Object.entries(bindings) as Array<[ComposerKeybindingAction, string]>)
    .some(([candidate, value]) => candidate !== action && value === binding);
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
