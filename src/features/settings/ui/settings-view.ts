import { Notice, Setting, type App } from "obsidian";
import type ChatobbyPlugin from "../../../main";
import type { PluginSettings } from "../domain/settings";
import type { WsLocalModelProvider, WsLocalModelProviderDocument, WsLocalModelProviderProbeResult, WsProviderInfo } from "../../../types";
import { LocalModelProviderModal } from "../../../ui/modals/local-model-provider-modal";
import { confirmAction } from "../../../ui/modals/modals";
import { CHATOBBY_CONNECTOR_REPOSITORY_URL, CHATOBBY_PATREON_URL, CHATOBBY_SUPPORT_URL, openChatobbyUrl } from "../../../publication";
import { ProviderCredentialModal } from "./credential-modals";
import { renderRuntimeSettings } from "./runtime-section";
import { renderDocumentSettings } from "./document-section";
import { renderDisplaySettings } from "./display-section";
import { renderLocalProviderRow, renderProviderRow, renderWebResearchSettings } from "./provider-section";

/** One native or embedded surface's catalogue, refresh, host and callback lifetime. */
export class SettingsView {
  private providerCatalog: WsProviderInfo[] | null = null;
  private localProviderDocument: WsLocalModelProviderDocument | null = null;
  private providerCatalogLoading = false;
  private providerCatalogError: string | null = null;
  private providerCatalogAttempted = false;
  private providerCatalogRefreshPending = false;
  private settingsHost: HTMLElement | null = null;
  private settingsSurface: "plugin" | "chatobby" = "plugin";
  constructor(private readonly app: App, private readonly plugin: ChatobbyPlugin) {}

  renderPluginSettings(containerEl: HTMLElement): void {
    this.settingsHost = containerEl;
    this.settingsSurface = "plugin";
    this.renderSettings(containerEl, "plugin");
  }


  /** Render the full user-facing Settings page without changing credential ownership. */
  renderChatobbySettings(containerEl: HTMLElement): void {
    this.settingsHost = containerEl;
    this.settingsSurface = "chatobby";
    this.providerCatalog = null;
    this.providerCatalogError = null;
    this.providerCatalogAttempted = false;
    this.renderSettings(containerEl, "chatobby");
  }

  /** Re-read runtime-owned provider metadata after a live catalogue projection changes. */
  refreshProviderCatalogFromRuntime(): void {
    this.providerCatalog = null;
    this.providerCatalogError = null;
    if (!this.settingsHost?.isConnected || this.settingsSurface !== "chatobby") {
      this.providerCatalogAttempted = false;
      return;
    }
    this.providerCatalogAttempted = true;
    if (this.providerCatalogLoading) {
      this.providerCatalogRefreshPending = true;
      return;
    }
    void this.refreshProviderCatalog(false, false);
  }

  /** Detach an embedded surface so an asynchronous provider refresh cannot repaint another page. */
  detachChatobbySettings(containerEl: HTMLElement | null): void {
    if (containerEl && this.settingsHost === containerEl)
      this.settingsHost = null;
  }

  private renderSettings(
    containerEl: HTMLElement,
    surface: "plugin" | "chatobby",
  ): void {
    containerEl.empty();
    containerEl.addClass("chatobby-settings");

    containerEl.createDiv({
      cls: "chatobby-settings__intro",
      text: "Local AI sessions, tools, and automations for this vault.",
    });

    if (surface === "plugin") {
      const moved = containerEl.createDiv({
        cls: "chatobby-settings-note chatobby-settings-note--moved",
      });
      moved.createEl("strong", {
        text: "Everyday Chatobby settings moved into Chatobby",
      });
      moved.createDiv({
        text: "Model providers, API keys, local model servers, conversation preferences, and Project behavior are now easier to find from Chatobby's Settings page.",
      });
      new Setting(moved)
        .setName("Open Chatobby Settings")
        .setDesc("Open a Chatobby view and manage these options there.")
        .addButton((button) =>
          button
            .setButtonText("Open Settings")
            .setCta()
            .onClick(() => {
              void this.plugin.openChatobbySettings();
            }),
        );
    }
    if (surface === "chatobby") {
      this.renderCredentialsSection(containerEl);
      renderWebResearchSettings(containerEl, this.app, this.plugin, () => this.refreshSettingsSurface());
      renderDisplaySettings(containerEl, this.plugin, () => this.refreshSettingsSurface());
      this.renderProjectsSection(containerEl);
    }
    renderRuntimeSettings(containerEl, this.plugin, () => this.refreshSettingsSurface());
    renderDocumentSettings(containerEl, this.plugin, () => this.refreshSettingsSurface());
    this.renderHelpSection(containerEl);
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
              directoryProjectLaunchBehavior:
                value as PluginSettings["directoryProjectLaunchBehavior"],
            }).catch((error: unknown) => {
              console.error(
                "Chatobby: failed to update Project folder behavior",
                error,
              );
              new Notice("Failed to update Project folder behavior");
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

    new Setting(containerEl)
      .setName("Local model connections")
      .setDesc(
        "Connect Ollama, LM Studio or another model server.",
      )
      .addButton((button) =>
        button
          .setButtonText("Connect server")
          .setCta()
          .onClick(() => this.openLocalProviderModal()),
      );

    for (const provider of this.localProviderDocument?.providers ?? []) {
      renderLocalProviderRow(containerEl, provider, {
        test: (value) => this.testLocalProvider(value),
        edit: (value) => this.openLocalProviderModal(value),
        remove: (value) => this.removeLocalProvider(value),
      });
    }

    if (
      this.localProviderDocument &&
      this.localProviderDocument.providers.length === 0
    ) {
      containerEl.createDiv({
        cls: "chatobby-settings-note",
        text: "Start your model server, then choose Connect server to find its models.",
      });
    }

    this.requestProviderCatalog();

    if (this.providerCatalogLoading) {
      containerEl.createDiv({
        cls: "chatobby-settings__provider-state",
        text: "Finding available providers…",
      });
    } else if (this.providerCatalogError) {
      new Setting(containerEl)
        .setName("Provider discovery unavailable")
        .setDesc(this.providerCatalogError)
        .addButton((button) =>
          button.setButtonText("Try again").onClick(() => {
            this.providerCatalogAttempted = false;
            this.requestProviderCatalog();
            this.refreshSettingsSurface();
          }),
        );
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
        renderProviderRow(containerEl, provider, this.app, this.plugin, {
          runtimeTransport: () => this.runtimeTransport(),
          refreshAfterChange: () => this.refreshAfterProviderChange(),
          connect: (value) => this.openProviderModal(value),
        });
      }
    }

    new Setting(containerEl)
      .setName("Advanced provider credential")
      .setDesc("Connect a provider id that you manage manually in models.json.")
      .addButton((button) =>
        button
          .setButtonText("Add credential")
          .onClick(() => this.openProviderModal()),
      );
  }

  private openLocalProviderModal(provider?: WsLocalModelProvider): void {
    const revision = this.localProviderDocument?.revision ?? 0;
    new LocalModelProviderModal(
      this.app,
      provider,
      async (candidate, apiKey) => {
        const transport = await this.runtimeTransport();
        this.localProviderDocument = await transport.saveLocalModelProvider(
          revision,
          candidate,
          apiKey,
        );
        await this.refreshProviderCatalog(false, false);
        new Notice(`${candidate.name} saved`);
      },
      async (candidate, apiKey) => this.testLocalProvider(candidate, apiKey),
      async (candidate, apiKey) => (await this.runtimeTransport()).discoverLocalModels(candidate, apiKey),
    ).open();
  }

  private async testLocalProvider(
    provider: WsLocalModelProvider,
    apiKey?: string,
  ): Promise<WsLocalModelProviderProbeResult> {
    return (await this.runtimeTransport()).testLocalModelProvider(
      provider,
      apiKey,
    );
  }

  private async removeLocalProvider(
    provider: WsLocalModelProvider,
  ): Promise<void> {
    const confirmed = await confirmAction(this.app, {
      title: `Remove ${provider.name}?`,
      message:
        "This removes the server and its stored credential from Chatobby. It does not stop or uninstall the local model server.",
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

    new Setting(containerEl).setName("What’s new")
      .setDesc("Recent changes and the Chatobby roadmap.")
      .addButton(button => button.setButtonText("View changes").onClick(() => this.plugin.showWhatsNew()));

    new Setting(containerEl)
      .setName("Documentation")
      .setDesc(
        "Installation, first-run guidance, privacy details, and known alpha limitations.",
      )
      .addButton((button) =>
        button
          .setButtonText("View documentation")
          .onClick(() => openChatobbyUrl(CHATOBBY_CONNECTOR_REPOSITORY_URL)),
      );

    new Setting(containerEl)
      .setName("Support")
      .setDesc(
        "Report a reproducible problem without credentials or private vault content.",
      )
      .addButton((button) =>
        button
          .setButtonText("Report issue")
          .onClick(() => openChatobbyUrl(CHATOBBY_SUPPORT_URL)),
      );

    new Setting(containerEl)
      .setName("Support development")
      .setDesc(
        "Chatobby’s core harness is free. Patreon support is optional.",
      )
      .addButton((button) =>
        button
          .setButtonText("Patreon")
          .onClick(() => openChatobbyUrl(CHATOBBY_PATREON_URL)),
      );
  }

  private openProviderModal(provider?: WsProviderInfo): void {
    new ProviderCredentialModal(this.app, provider, (providerId, key) =>
      this.saveProvider(providerId, key),
    ).open();
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
    const host = this.settingsHost;
    if (!host?.isConnected) return;
    this.renderSettings(host, this.settingsSurface);
  }

  private requestProviderCatalog(): void {
    if (
      this.providerCatalog ||
      this.providerCatalogLoading ||
      this.providerCatalogAttempted
    )
      return;
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
      const transport = startBackend
        ? this.plugin.createTransport()
        : this.plugin.transport;
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
      this.providerCatalogError =
        error instanceof Error ? error.message : String(error);
      if (showFailureNotice)
        new Notice("Could not discover Chatobby providers");
    } finally {
      this.providerCatalogLoading = false;
      this.refreshSettingsSurface();
      if (this.providerCatalogRefreshPending) {
        this.providerCatalogRefreshPending = false;
        this.refreshProviderCatalogFromRuntime();
      }
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
      if (
        this.localProviderDocument?.providers.some(
          (local) => local.id === provider.id,
        )
      )
        continue;
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
      const aConfigured =
        a.configured || this.plugin.settings.providerKeys[a.id] === true;
      const bConfigured =
        b.configured || this.plugin.settings.providerKeys[b.id] === true;
      return (
        Number(bConfigured) - Number(aConfigured) ||
        a.name.localeCompare(b.name)
      );
    });
  }
}
