import { PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import type ChatobbyPlugin from "./main";
import { SettingsView } from "./features/settings/public";

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

/** Obsidian's native registration; each tab delegates to its own settings renderer. */
export class ChatobbySettingTab extends PluginSettingTab {
  private readonly view: SettingsView;

  constructor(app: App, plugin: ChatobbyPlugin) {
    super(app, plugin);
    this.view = new SettingsView(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        cls: "chatobby-settings",
        items: [
          {
            name: "Chatobby settings",
            desc: "Runtime, document handling, and support, with everyday settings available inside Chatobby.",
            aliases: SETTINGS_SEARCH_ALIASES,
            render: (setting) => {
              setting.settingEl.empty();
              setting.settingEl.addClass("chatobby-settings__definition-host");
              this.view.renderPluginSettings(setting.settingEl);
            },
          },
        ],
      },
    ];
  }

  display(): void { this.view.renderPluginSettings(this.containerEl); }

  /** Compatibility entry for callers rendering an embedded settings surface. */
  renderChatobbySettings(containerEl: HTMLElement): void { this.view.renderChatobbySettings(containerEl); }

  refreshProviderCatalogFromRuntime(): void { this.view.refreshProviderCatalogFromRuntime(); }

  detachChatobbySettings(containerEl: HTMLElement | null): void { this.view.detachChatobbySettings(containerEl); }
}
