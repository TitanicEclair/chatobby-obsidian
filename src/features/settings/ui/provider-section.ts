import { Notice, Setting, type App } from "obsidian";
import type ChatobbyPlugin from "../../../main";
import type { ChatobbyTransport } from "../../../transport/ws-client";
import type { WsLocalModelProvider, WsLocalModelProviderProbeResult, WsProviderInfo } from "../../../types";
import { ProviderLoginModal } from "../../../ui/modals/provider-login-modal";
import { BRAVE_SEARCH_API_DOCUMENTATION_URL, openChatobbyUrl } from "../../../publication";
import { WebSearchCredentialModal } from "./credential-modals";

export function renderWebResearchSettings(containerEl: HTMLElement, app: App, plugin: ChatobbyPlugin, refresh: () => void): void {
    new Setting(containerEl).setName("Web research").setHeading();
    containerEl.createDiv({
      cls: "chatobby-settings-note",
      text: "Basic public-web search works without an account. You can optionally connect Brave Search for stronger freshness, language, region, and date filtering. Chatobby always reports which provider mode a search used.",
    });
    const configured = plugin.hasEnhancedWebSearch();
    const setting = new Setting(containerEl)
      .setName("Enhanced Brave Search")
      .setDesc(
        configured
          ? "Connected through an Obsidian-stored secret. The key is sent only to Chatobby's built-in web-search process."
          : "Optional. Requires your own Brave Search API account and key; provider pricing and allowances are controlled by Brave.",
      )
      .addButton((button) =>
        button
          .setButtonText(configured ? "Update key" : "Connect")
          .setCta()
          .onClick(() =>
            new WebSearchCredentialModal(
              app,
              (key) => plugin.setEnhancedWebSearchKey(key),
              () => refresh(),
            ).open(),
          ),
      )
      .addButton((button) =>
        button
          .setButtonText("Brave API docs")
          .onClick(() => openChatobbyUrl(BRAVE_SEARCH_API_DOCUMENTATION_URL)),
      );
    if (configured) {
      setting.addButton((button) => {
        button.setButtonText("Disconnect");
        button.buttonEl.addClass("mod-warning");
        button.onClick(() => {
          void plugin
            .removeEnhancedWebSearchKey()
            .then(() => {
              new Notice("Enhanced web search disconnected");
              refresh();
            })
            .catch((error: unknown) => {
              console.error(
                "Chatobby: failed to disconnect enhanced web search",
                error,
              );
              new Notice("Could not disconnect enhanced web search");
            });
        });
      });
    }
    setting.settingEl.addClass(
      "chatobby-settings__provider",
      configured ? "is-connected" : "is-available",
    );
  }

export function renderLocalProviderRow(
  containerEl: HTMLElement,
  provider: WsLocalModelProvider,
  actions: {
    test(provider: WsLocalModelProvider): Promise<WsLocalModelProviderProbeResult>;
    edit(provider: WsLocalModelProvider): void;
    remove(provider: WsLocalModelProvider): Promise<void>;
  },
): void {
    const api = localModelApiLabel(provider.api);
    const setting = new Setting(containerEl)
      .setName(provider.name)
      .setDesc(
        `${localModelPresetLabel(provider.preset)} · ${api} · ${provider.models.length} model${provider.models.length === 1 ? "" : "s"} · ${provider.baseUrl}`,
      )
      .addButton((button) =>
        button.setButtonText("Test").onClick(() => {
          void actions.test(provider)
            .then((result) => {
              new Notice(`${provider.name}: ${result.message}`);
            })
            .catch((error: unknown) => {
              console.error("Chatobby: local model server test failed", error);
              new Notice(
                error instanceof Error
                  ? error.message
                  : "Local model server test failed",
              );
            });
        }),
      )
      .addButton((button) =>
        button
          .setButtonText("Edit")
          .onClick(() => actions.edit(provider)),
      )
      .addButton((button) => {
        button.setButtonText("Remove");
        button.buttonEl.addClass("mod-warning");
        button.onClick(() => void actions.remove(provider));
      });
    setting.settingEl.addClass("chatobby-settings__provider", "is-connected");
  }

export function renderProviderRow(
  containerEl: HTMLElement,
  provider: WsProviderInfo,
  app: App,
  plugin: ChatobbyPlugin,
  actions: {
    runtimeTransport(): Promise<ChatobbyTransport>;
    refreshAfterChange(): Promise<void>;
    connect(provider: WsProviderInfo): void;
  },
): void {
    const configured =
      provider.configured ||
      plugin.settings.providerKeys[provider.id] === true;
    const removable =
      provider.authSource === "stored" ||
      plugin.settings.providerKeys[provider.id] === true;
    const setting = new Setting(containerEl)
      .setName(
        provider.name === provider.id
          ? provider.id
          : `${provider.name} (${provider.id})`,
      )
      .setDesc(providerDescription(provider, configured));
    if (provider.authentication?.subscription) {
      setting.addButton((button) => {
        button.setButtonText(provider.authentication?.connectedWith === "oauth" ? "Reconnect account" : "Sign in")
          .setCta().onClick(() => {
            new ProviderLoginModal(app, provider, () => actions.runtimeTransport(), async () => {
              await actions.refreshAfterChange();
              plugin.getActiveView()?.refreshAvailableModels();
            }).open();
          });
      });
    }
    if (provider.authentication?.apiKey !== false) {
      setting.addButton((button) => {
        button
          .setButtonText(provider.authentication?.subscription ? "Use API key" : configured ? "Update key" : "Connect")
          .onClick(() => actions.connect(provider));
      });
    }
    setting.settingEl.addClass("chatobby-settings__provider");
    setting.settingEl.toggleClass("is-connected", configured);
    const excludedModels = provider.modelDiscovery?.unavailableModels ?? [];
    if (configured && excludedModels.length > 0) {
      const details = containerEl.createEl("details", { cls: "chatobby-settings__model-discovery" });
      details.createEl("summary", { text: `${excludedModels.length} account ${excludedModels.length === 1 ? "model needs" : "models need"} attention` });
      const list = details.createEl("ul");
      for (const model of excludedModels) {
        const row = list.createEl("li");
        row.createEl("strong", { text: model.id });
        row.createSpan({ text: ` — ${model.reason}` });
      }
    }
    if (removable) {
      setting.addButton((button) => {
        button.setButtonText("Disconnect");
        button.buttonEl.addClass("mod-warning");
        button.onClick(() => {
          plugin
            .removeProviderKey(provider.id)
            .then(() => actions.refreshAfterChange())
            .catch((error) => {
              console.error("Chatobby: failed to remove provider key", error);
              new Notice(`Failed to disconnect ${provider.name}`);
            });
        });
      });
    }
  }

function localModelPresetLabel(preset: WsLocalModelProvider["preset"]): string {
  switch (preset) {
    case "ollama":
      return "Ollama";
    case "lm-studio":
      return "LM Studio";
    case "vllm":
      return "vLLM";
    case "llama-cpp":
      return "llama.cpp";
    case "openai-compatible":
      return "OpenAI-compatible";
    case "anthropic-compatible":
      return "Anthropic Messages-compatible";
  }
}

function localModelApiLabel(api: WsLocalModelProvider["api"]): string {
  switch (api) {
    case "openai-completions":
      return "Chat Completions";
    case "openai-responses":
      return "Responses API";
    case "anthropic-messages":
      return "Messages API";
  }
}

function providerDescription(
  provider: WsProviderInfo,
  configured: boolean,
): string {
  const available =
    provider.availableModelCount === 1
      ? "1 model available"
      : `${provider.availableModelCount} models available`;
  if (!configured)
    return provider.modelCount > 0
      ? `Not connected · ${provider.modelCount} supported models`
      : "Not connected";
  const discovery = provider.modelDiscovery;
  const warning = discovery?.error
    ? ` ${discovery.error} ${discovery.usingCachedModels ? "Keeping the last account model list." : "Bundled model choices have not been checked for this account."}`
    : "";
  return `Connected${authSourceLabel(provider)} · ${available}${warning}`;
}

function authSourceLabel(provider: WsProviderInfo): string {
  switch (provider.authSource) {
    case "stored":
      return "";
    case "runtime":
      return provider.authLabel
        ? ` through ${provider.authLabel}`
        : " through the runtime";
    case "environment":
      return provider.authLabel
        ? ` through ${provider.authLabel}`
        : " through the environment";
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
