// Chatobby Obsidian Plugin — entry point.
//
// This file is pure wiring: it constructs the settings store, backend controller,
// transport, and command registry, and connects them. Functionality lives in
// dedicated modules:
//   - persistence           → src/state/settings-store.ts
//   - backend lifecycle     → src/backend/backend-controller.ts (+ process.ts)
//   - command actions       → src/commands/actions/* (registered via CommandRegistry)
//   - obsidian:// handler   → src/uri-handler.ts
//
// The plugin still owns the WS transport + ObsidianBridgeClient and their
// bridge_config wiring (tightly coupled; not extracted yet).

import { MarkdownView, Plugin } from "obsidian";
import { join } from "node:path";
import { ObsidianBridgeClient } from "./obsidian-bridge";
import { disposeVaultRetrievalService } from "./obsidian-bridge/retrieval/service";
import { ChatobbyView } from "./ui/view";
import { CommandRegistry, type ChatobbyServices } from "./commands/registry";
import { buildAllActions } from "./commands/actions";
import { SettingsStore } from "./state/settings-store";
import { ChatobbyTransport } from "./transport/ws-client";
import { ChatobbySettingTab } from "./settings";
import { VIEW_TYPE_CHATOBBY } from "./view-type";
import { handleChatobbyUri } from "./uri-handler";
import type { PluginSettings, SessionPreferences, WsBridgeConfig } from "./types";
import { DEFAULT_PLUGIN_SETTINGS } from "./types";
import { getChatobbyVaultRuntimePaths } from "./vault-runtime";
import { DefaultChatobbyRuntimeManager } from "./runtime/application/runtime-manager";
import type { ReadyRuntime, RuntimeActionReason, RuntimeLifecycleState } from "./runtime/public";
import type { RuntimeDemandHandle, RuntimeDemandKind } from "./runtime/public";
import { DefaultRuntimeDemandRegistry } from "./runtime/application/demand-registry";
import {
  connectorBuildMode,
  connectorRuntimeMode,
  connectorTrustedRuntimePublicKey,
  ManagedRuntimeResolver,
  runtimeInstallRoot,
} from "./runtime/infrastructure/runtime-installation";
import { OperationCoordinator, type ActiveOperation, type OperationDescriptor, type OperationKey } from "./features/operations/public";
import { FrontendSessionRegistry } from "./runtime/application/frontend-session-registry";

export default class ChatobbyPlugin extends Plugin {
  // ── Persisted settings (public; read by SettingTab, mutated via store) ──
  settings: PluginSettings = DEFAULT_PLUGIN_SETTINGS;

  // ── Owned services ────────────────────────────────────────────────
  private readonly store = new SettingsStore(this, this.settings, (provider, apiKey) =>
    this.writeProviderCredential(provider, apiKey),
  );
  private readonly runtimeDemands = new DefaultRuntimeDemandRegistry();
  private readonly operations = new OperationCoordinator();
  private readonly bridgeClients = new Map<string, ObsidianBridgeClient>();
  private readonly frontendSessions = new FrontendSessionRegistry({
    createTransport: (runtime) => new ChatobbyTransport(runtime),
    bindTransport: (channelId, transport) => {
      const unsubscribeConnection = transport.onConnectionChange((state) => {
        if (state.status === "error") {
          console.error(`Chatobby channel ${channelId}: connection error: ${state.error}`);
			void this.runtimeManager.reportConnectionFailure(state.error ?? "WebSocket connection failed").catch((error) => {
				console.error("Chatobby: runtime recovery failed", error);
			});
        }
      });
      const unsubscribeBridge = transport.onBridgeConfig((config) => {
        void this.handleBridgeConfig(channelId, config).catch((error) => {
          console.error(`Chatobby channel ${channelId}: bridge config error`, error);
        });
      });
      return () => {
        unsubscribeConnection();
        unsubscribeBridge();
        void this.disconnectBridge(channelId);
      };
    },
  });
  private readonly buildMode = connectorBuildMode();
  private readonly runtimePublicKey = connectorTrustedRuntimePublicKey();
  private readonly runtimeResolver = new ManagedRuntimeResolver(
    () => {
      const paths = getChatobbyVaultRuntimePaths(this.app);
      return paths && this.manifest.dir ? join(paths.vaultRoot, this.manifest.dir) : null;
    },
    runtimeInstallRoot,
    this.buildMode,
    this.manifest.version,
    this.runtimePublicKey,
  );
  private readonly runtimeManager = new DefaultChatobbyRuntimeManager({
    getConfiguration: () => ({
      mode: this.getRuntimeMode(),
      lifetime: this.settings.runtimeLifetime,
      externalUrl: this.settings.externalServerUrl,
      developerCommand: this.settings.developerCommand,
      developerArgs: [...this.settings.developerArgs],
      shellCommand: this.settings.commandShell === "auto"
        ? undefined
        : this.settings.commandShell === "custom"
          ? this.settings.customShellPath.trim() || undefined
          : this.settings.commandShell,
    }),
    getVaultPaths: () => getChatobbyVaultRuntimePaths(this.app),
    resolveManagedCommand: () => this.runtimeResolver.resolve(),
    connectRuntime: (runtime) => this.bindRuntime(runtime),
    disconnectRuntime: () => this.closeFrontendSession(),
    pluginVersion: this.manifest.version,
    runtimePublicKey: this.runtimePublicKey,
  });

  private readonly visibleChatViews = new Set<ChatobbyView>();
  private unloading = false;

  // ── Lifecycle ────────────────────────────────────────────────────

  async onload(): Promise<void> {
    this.unloading = false;
    await this.store.load();

    this.registerView(VIEW_TYPE_CHATOBBY, (leaf) => new ChatobbyView(leaf, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf?.view instanceof ChatobbyView) {
        void leaf.view.activateSessionContext().catch((error) => {
          console.error("Chatobby: could not activate leaf session context", error);
        });
      }
    }));
    this.addSettingTab(new ChatobbySettingTab(this.app, this));

    this.addRibbonIcon("message-circle", "Open Chatobby", () => {
      void this.activateView();
    });

    const registry = new CommandRegistry(this, this.buildServices());
    registry.registerAll(buildAllActions());
    registry.registerAsObsidianCommands();

    // obsidian://chatobby?prompt=…&model=…&thinking=…&permission=…
    this.registerObsidianProtocolHandler("chatobby", (params) => {
      handleChatobbyUri(params, {
        activateView: () => this.activateView(),
        getActiveView: () => this.getActiveView(),
        rememberSessionPreferences: (patch) => this.store.rememberSessionPreferences(patch),
      }).catch((error) => {
        console.error("Chatobby: URI handler failed", error);
      });
    });
  }

  async onunload(): Promise<void> {
    this.unloading = true;
    // Plugin reloads must not terminate session-owned work in the backend.
    await this.runtimeManager.detach("plugin-unload").catch(() => {});
    await this.frontendSessions.dispose();
    await Promise.all([...this.bridgeClients.keys()].map((channelId) => this.disconnectBridge(channelId)));
    // Detach retrieval-service vault listeners so hot-reload doesn't leak them.
    disposeVaultRetrievalService(this.app);
  }

  /** Synchronize visible-view policy with the backend Events approval boundary. */
  setChatViewVisible(view: ChatobbyView, visible: boolean): void {
    if (visible) this.visibleChatViews.add(view);
    else this.visibleChatViews.delete(view);
    void this.frontendSessions.setVisible(view.runtimeChannelId, visible).catch((error) => {
      if (!this.unloading) console.error("Chatobby: failed to synchronize visible-view state", error);
    });
  }

  private buildServices(): ChatobbyServices {
    return {
      activateView: () => this.activateView(),
      withView: (fn) => this.withView(fn),
      getTransport: () => this.transport,
      ensureTransport: async () => {
        await this.ensureRuntime("user-action");
        const activeView = this.getActiveView();
        const transport = activeView
          ? await this.frontendSessions.ensure(activeView.runtimeChannelId)
          : await this.frontendSessions.ensureUtility();
        if (!transport.isConnected) throw new Error("Chatobby runtime did not connect");
        return transport;
      },
      backend: {
        start: () => this.startBackend(),
        stop: () => this.stopBackend(),
      },
      cycleModel: () => this.cycleModel(),
      cycleThinking: () => this.cycleThinking(),
      focusActiveEditor: () => {
        this.app.workspace.getActiveViewOfType(MarkdownView)?.editor?.focus();
      },
    };
  }

  // ── View helpers ──────────────────────────────────────────────────

  /** Ensure the view is open, then run an action against it. */
  private async withView(fn: (view: ChatobbyView) => void | Promise<void>): Promise<void> {
    await this.activateView();
    const view = this.getActiveView();
    if (view) await fn(view);
  }

  /** The active ChatobbyView, if one is open. */
  getActiveView(): ChatobbyView | null {
    const active = this.app.workspace.getActiveViewOfType(ChatobbyView);
    if (active) return active;
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY);
    const leaf = leaves[0];
    return leaf ? (leaf.view as ChatobbyView) : null;
  }

  /** Active leaf transport, falling back to another live frontend or utility channel. */
  get transport(): ChatobbyTransport | null {
    const activeChannelId = this.getActiveView()?.runtimeChannelId;
    return this.frontendSessions.primary(activeChannelId);
  }

  /** Register one independently routable parent runtime for a Chatobby leaf. */
  async registerChatView(view: ChatobbyView): Promise<void> {
    await this.frontendSessions.register(view.runtimeChannelId).catch((error) => {
      console.error("Chatobby: initial leaf runtime connection failed; reconnect remains scheduled", error);
    });
  }

  /** Resolve the process and reattach one restored or newly opened leaf. */
  async ensureChatViewRuntime(view: ChatobbyView, reason: RuntimeActionReason): Promise<ReadyRuntime> {
    const runtime = await this.ensureRuntime(reason);
    await this.frontendSessions.ensure(view.runtimeChannelId);
    return runtime;
  }

  /** Release only this leaf's runtime without disturbing concurrent leaves. */
  async unregisterChatView(view: ChatobbyView): Promise<void> {
    await this.frontendSessions.unregister(view.runtimeChannelId);
    await this.disconnectBridge(view.runtimeChannelId);
  }

  getViewTransport(view: ChatobbyView): ChatobbyTransport | null {
    return this.frontendSessions.get(view.runtimeChannelId);
  }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]!);
      return;
    }
    // Chatobby is a full work surface, not a utility widget. A root tab avoids
    // inheriting an arbitrarily short or narrow right-sidebar split.
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_CHATOBBY, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

	/** Always open a new blank Chatobby work surface in an Obsidian tab. */
	async openBlankView(vaultDirectoryPath = this.settings.activeVaultDirectory): Promise<ChatobbyView> {
		const normalized = vaultDirectoryPath.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_CHATOBBY,
			active: true,
			state: { mode: "chat", vaultDirectoryPath: normalized },
		});
		this.app.workspace.revealLeaf(leaf);
		if (!(leaf.view instanceof ChatobbyView)) throw new Error("Obsidian did not create the Chatobby view");
		return leaf.view;
	}

  /** Open or focus the leaf that owns one vault-directory session context. */
  async openDirectoryView(vaultDirectoryPath: string): Promise<ChatobbyView> {
    const normalized = vaultDirectoryPath.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY)
      .map((leaf) => leaf.view)
      .filter((view): view is ChatobbyView => view instanceof ChatobbyView)
      .find((view) => view.getWorkingDirectoryPath() === normalized);
    if (existing) {
      this.app.workspace.revealLeaf(existing.leaf);
      return existing;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_CHATOBBY,
      active: true,
      state: { mode: "chat", vaultDirectoryPath: normalized },
    });
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (!(view instanceof ChatobbyView)) throw new Error("Obsidian did not create the Chatobby directory view");
    return view;
  }

  /** Open a distinct session work surface, or focus the leaf already owning a resumed path. */
  async openSessionView(vaultDirectoryPath: string, sessionPath?: string): Promise<ChatobbyView> {
    if (sessionPath) {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY)
        .map((leaf) => leaf.view)
        .filter((view): view is ChatobbyView => view instanceof ChatobbyView)
        .find((view) => view.hasSessionPath(sessionPath));
      if (existing) {
        this.app.workspace.revealLeaf(existing.leaf);
        return existing;
      }
    }
    const normalized = vaultDirectoryPath.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_CHATOBBY,
      active: true,
      state: { mode: "chat", vaultDirectoryPath: normalized },
    });
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (!(view instanceof ChatobbyView)) throw new Error("Obsidian did not create the Chatobby session view");
    return view;
  }

  // ── Model / thinking cycling ─────────────────────────────────────

  private async cycleModel(): Promise<void> {
    const view = this.getActiveView();
    if (!view) throw new Error("Open a Chatobby tab before changing its model");
    await view.cycleModel();
  }

  private async cycleThinking(): Promise<void> {
    const view = this.getActiveView();
    if (!view) throw new Error("Open a Chatobby tab before changing its thinking level");
    await view.cycleThinking();
  }

  // ── Settings + session-pref delegates (public API for settings/view/toolbar) ──

  getRuntimeState(): RuntimeLifecycleState {
    return this.runtimeManager.state;
  }

  /** Effective runtime mode after applying the immutable release boundary. */
  getRuntimeMode(): PluginSettings["runtimeMode"] {
    return connectorRuntimeMode(this.settings.runtimeMode, this.buildMode);
  }

  isReleaseBuild(): boolean {
    return this.buildMode === "release";
  }

  onRuntimeStateChange(listener: (state: RuntimeLifecycleState) => void): () => void {
    return this.runtimeManager.onStateChange(listener);
  }

  async startBackend(): Promise<void> {
    await this.runOperation(
      { key: "backend-lifecycle", id: "backend:start", label: "Starting Chatobby" },
      () => this.ensureRuntime("manual-start").then(() => undefined),
    );
  }

  async stopBackend(): Promise<void> {
    await this.runOperation(
      { key: "backend-lifecycle", id: "backend:stop", label: "Stopping Chatobby" },
      () => this.runtimeManager.stop("user-action"),
    );
  }

  async restartRuntime(): Promise<void> {
    await this.runOperation(
      { key: "backend-lifecycle", id: "backend:restart", label: "Restarting Chatobby" },
      () => this.runtimeManager.restart("manual-restart"),
    );
  }

  async ensureRuntime(reason: RuntimeActionReason): Promise<ReadyRuntime> {
    return this.runtimeManager.ensureReady({ reason });
  }

  acquireRuntimeDemand(kind: RuntimeDemandKind, ownerId: string): RuntimeDemandHandle {
    return this.runtimeDemands.acquire(kind, ownerId);
  }

  /** Run one business operation through the plugin-wide concurrency boundary. */
  runOperation<T>(descriptor: OperationDescriptor, operation: () => Promise<T>): Promise<T> {
    return this.operations.run(descriptor, operation);
  }

  /** Return the producer currently holding an operation domain. */
  getActiveOperation(key: OperationKey): ActiveOperation | null {
    return this.operations.current(key);
  }

  getSessionPreferences(): SessionPreferences {
    return this.store.getSessionPreferences();
  }

  async rememberSessionPreferences(patch: Partial<SessionPreferences>): Promise<void> {
    await this.store.rememberSessionPreferences(patch);
  }

	openSettings(): void {
		const app = this.app as typeof this.app & {
			setting?: { open(): void; openTabById(id: string): void };
		};
		app.setting?.open();
		app.setting?.openTabById(this.manifest.id);
	}

	async completeOnboarding(): Promise<void> {
		if (this.settings.onboardingVersion >= 1) return;
		await this.updateSettings({ onboardingVersion: 1 });
	}

  getActiveVaultDirectory(): string {
    return this.settings.activeVaultDirectory;
  }

  async setActiveVaultDirectory(directoryPath: string): Promise<void> {
    await this.updateSettings({ activeVaultDirectory: directoryPath });
  }

  async updateSettings(patch: Partial<PluginSettings>): Promise<void> {
    if (this.buildMode === "release" && containsRuntimeEndpointOverride(patch)) {
      throw new Error("Release connectors use only the signed installer-managed runtime");
    }
    if (runtimeConfigurationChanges(this.settings, patch)) {
      await this.runtimeManager.detach("mode-change");
    }
    await this.store.updateSettings(patch);
    if (patch.autoNameStrategy) {
      await Promise.all(this.frontendSessions.connected().map((transport) => (
        transport.setAutoNameStrategy(patch.autoNameStrategy!).catch((error) => {
          console.error("Chatobby: failed to apply auto-name strategy", error);
        })
      )));
    }
    if (patch.autoScroll !== undefined || patch.thinkingDisplay !== undefined) {
      for (const view of this.visibleChatViews) view.refreshDisplaySettings();
    }
  }

  configuredProviders(): string[] {
    return this.store.configuredProviders();
  }

  async setProviderKey(provider: string, key: string): Promise<void> {
    await this.store.setProviderKey(provider, key);
    this.getActiveView()?.refreshAvailableModels();
  }

  async removeProviderKey(provider: string): Promise<void> {
    await this.store.removeProviderKey(provider);
    this.getActiveView()?.refreshAvailableModels();
  }

  private async writeProviderCredential(provider: string, apiKey: string | null): Promise<void> {
    await this.ensureRuntime("user-action");
    const transport = this.transport ?? await this.frontendSessions.ensureUtility();
    if (apiKey === null) await transport.removeProviderCredential(provider);
    else await transport.setProviderApiKey(provider, apiKey);
  }

  async setExternalServerUrl(url: string): Promise<void> {
    await this.updateSettings({ externalServerUrl: url });
  }

  // ── Transport + bridge lifecycle ──────────────────────────────────

  /** Return the runtime-bound transport after the readiness gateway succeeds. */
  createTransport(): ChatobbyTransport {
    if (!this.transport) throw new Error("Chatobby runtime is not ready");
    return this.transport;
  }

  private async bindRuntime(runtime: ReadyRuntime): Promise<void> {
    await this.frontendSessions.bindRuntime(runtime);
  }

  /** Detach frontend clients without waiting on an in-flight agent command. */
  private async closeFrontendSession(): Promise<void> {
    await this.frontendSessions.disconnectRuntime();
    await Promise.all([...this.bridgeClients.keys()].map((channelId) => this.disconnectBridge(channelId)));
  }

  /** Handle a bridge_config push from the server. */
  private async handleBridgeConfig(channelId: string, config: WsBridgeConfig): Promise<void> {
    await this.disconnectBridge(channelId);

    // Obsidian app version is not exposed via the API, so we use a placeholder.
    const bridgeClient = new ObsidianBridgeClient(
      this.app,
      config.url,
      config.token,
      "1.0.0",
      this.manifest.version,
    );

    this.bridgeClients.set(channelId, bridgeClient);
    bridgeClient.onConnectionChange((state) => {
      if (state.status === "error") {
        console.error(`Chatobby bridge: connection error: ${state.error}`);
      }
    });

    await bridgeClient.connect();
  }

  private async disconnectBridge(channelId: string): Promise<void> {
    const bridgeClient = this.bridgeClients.get(channelId);
    if (!bridgeClient) return;
    this.bridgeClients.delete(channelId);
    await bridgeClient.disconnect().catch(() => {});
  }
}

function runtimeConfigurationChanges(settings: PluginSettings, patch: Partial<PluginSettings>): boolean {
  return (patch.runtimeMode !== undefined && patch.runtimeMode !== settings.runtimeMode)
    || (patch.runtimeLifetime !== undefined && patch.runtimeLifetime !== settings.runtimeLifetime)
    || (patch.externalServerUrl !== undefined && patch.externalServerUrl !== settings.externalServerUrl)
    || (patch.developerCommand !== undefined && patch.developerCommand !== settings.developerCommand)
    || (patch.developerArgs !== undefined && patch.developerArgs !== settings.developerArgs);
}

function containsRuntimeEndpointOverride(patch: Partial<PluginSettings>): boolean {
  return patch.runtimeMode !== undefined
    || patch.externalServerUrl !== undefined
    || patch.developerCommand !== undefined
    || patch.developerArgs !== undefined;
}
