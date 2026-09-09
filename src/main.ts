// Chatobby Obsidian Plugin — entry point.
//
// This file is pure wiring: it constructs the settings store, runtime manager,
// transport, and command registry, and connects them. Functionality lives in
// dedicated modules:
//   - persistence           → src/state/settings-store.ts
//   - runtime lifecycle     → src/runtime/application/runtime-manager.ts
//   - command actions       → src/commands/actions/* (registered via CommandRegistry)
//   - obsidian:// handler   → src/uri-handler.ts
//
// The plugin composes one global Obsidian bridge coordinator. View transports
// contribute ownership, while Project observation policy remains feature-owned.

import { MarkdownView, Notice, Plugin } from "obsidian";
import { join } from "node:path";
import { BridgeConnectionCoordinator, ObsidianBridgeClient } from "./obsidian-bridge";
import { parseObsidianBridgeConnectionConfig } from "./vendor/@chatobby/obsidian-protocol/index.js";
import { ChatobbyView } from "./ui/view";
import { CommandRegistry, type ChatobbyServices } from "./commands/registry";
import { buildAllActions } from "./commands/actions";
import { SettingsStore } from "./state/settings-store";
import { ChatobbyTransport } from "./transport/ws-client";
import { ChatobbySettingTab } from "./settings";
import { VIEW_TYPE_CHATOBBY } from "./view-type";
import { handleChatobbyUri } from "./uri-handler";
import type { PluginSettings, SessionPreferences } from "./types";
import { DEFAULT_PLUGIN_SETTINGS } from "./types";
import { getChatobbyVaultRuntimePaths, initializeChatobbyVaultIdentity } from "./vault-runtime";
import { DefaultChatobbyRuntimeManager } from "./runtime/application/runtime-manager";
import type { ReadyRuntime, RuntimeActionReason, RuntimeLifecycleState } from "./runtime/public";
import type { RuntimeDemandHandle, RuntimeDemandKind } from "./runtime/public";
import { DefaultRuntimeDemandRegistry } from "./runtime/application/demand-registry";
import {
  connectorBuildMode,
  connectorRuntimeMode,
  connectorTrustedRuntimePublicKey,
  ManagedRuntimeResolver,
  readInstalledRuntimeVersion,
  RuntimePackageInstaller,
  runtimeInstallRoot,
} from "./runtime/infrastructure/runtime-installation";
import { OperationCoordinator, type ActiveOperation, type OperationDescriptor, type OperationKey } from "./features/operations/public";
import { activateChatobbyLeaf } from "./ui/controller/active-chatobby-leaf";
import {
	ProjectDirectoryObservationService,
	ProjectNavigatorView,
	VIEW_TYPE_CHATOBBY_NAVIGATOR,
	requestDirectoryProjectDecision,
	requestDirectoryProjectDraft,
} from "./features/projects/public";
import { FrontendSessionRegistry } from "./runtime/application/frontend-session-registry";
import { RuntimeUpdateClient } from "./runtime/infrastructure/runtime-update-client";
import {
  automaticRuntimeProvisioningEnabled,
  RuntimeBootstrapCoordinator,
  RuntimeUpdateManager,
  runtimeDevelopmentPairsRoot,
  type RuntimeUpdateState,
} from "./runtime/public";
import { RuntimeInstallModal } from "./features/runtime-status/public";
import { selectChatobbyCommandTarget } from "./ui/controller/view-targeting";
import { addFileExplorerSessionMenuItems } from "./ui/session/file-explorer-session-menu";
import { createFrontendNegotiationRequest } from "./ui/controller/frontend-bootstrap-request";
import {
	CHATOBBY_FRONTEND_PROTOCOL_VERSION,
	frontendId,
	type FrontendProjectSummaryViewModel,
} from "./vendor/chatobby-client/frontend-contracts.js";
import type { ChatobbyGuideChannelAsset } from "./vendor/chatobby-client/ws-client.js";
import { CHATOBBY_RUNTIME_PROTOCOL_VERSION } from "./vendor/chatobby-client/ws-client.js";
import { DevelopmentPairCoordinator } from "./runtime/application/development-pair-coordinator";
import { DevelopmentPairStartupGate } from "./runtime/application/development-pair-startup-gate";
import {
  verifyDevelopmentPairFrontendBootstrap,
  type DevelopmentPairActivationProof,
} from "./runtime/application/development-pair-bootstrap";
import {
  disposeObsidianSemanticContextService,
  disposeObsidianUiSnapshotService,
} from "./obsidian-context";
import { WebSearchCredentialService } from "./credentials/web-search";
import { WorkspacePageRegistry, WorkspacePageView, VIEW_TYPE_CHATOBBY_PAGE } from "./ui/workspace/workspace-tabs";
import type { WorkspacePageState } from "./ui/workspace/workspace-pages";
import { ProductIntroduction } from "./ui/modals/product-intro-modal";

export default class ChatobbyPlugin extends Plugin {
  readonly workspacePages = new WorkspacePageRegistry(this);
  private readonly introduction = new ProductIntroduction({
    app: this.app,
    version: this.manifest.version,
    getSettings: () => this.settings,
    save: patch => this.updateSettings(patch),
    openSettings: async () => { await this.openWorkspacePage({ mode: "settings" }); },
  });
  private readonly workspaceChannels = new Set<string>();
  // ── Persisted settings (public; read by SettingTab, mutated via store) ──
  settings: PluginSettings = DEFAULT_PLUGIN_SETTINGS;

  // ── Owned services ────────────────────────────────────────────────
  private readonly store = new SettingsStore(this, this.settings, (provider, apiKey) =>
    this.writeProviderCredential(provider, apiKey),
  );
  private readonly runtimeDemands = new DefaultRuntimeDemandRegistry();
  private readonly developmentPairStartup = new DevelopmentPairStartupGate();
  private readonly operations = new OperationCoordinator();
  private readonly bridgeCoordinator = new BridgeConnectionCoordinator((config) => new ObsidianBridgeClient(
    this.app,
    config.url,
    config.token,
    "1.0.0",
    this.manifest.version,
    undefined,
    config,
  ));
  private readonly projectDirectoryObservations = new ProjectDirectoryObservationService(this.bridgeCoordinator);
  private readonly frontendSessions = new FrontendSessionRegistry({
    createTransport: (runtime) =>
      new ChatobbyTransport(
        runtime,
        (reference) => this.app.secretStorage.getSecret(reference),
        (request) => {
          this.developmentPairStartup.assertRuntimeStartAllowed();
          return this.runtimeUpdates.activatePendingRuntime(request);
        },
      ),
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
        void this.acceptBridgeConfig(channelId, config).catch((error) => {
          console.error(`Chatobby channel ${channelId}: bridge config error`, error);
        });
      });
      return () => {
        unsubscribeConnection();
        unsubscribeBridge();
        void this.bridgeCoordinator.removeOwner(channelId);
      };
    },
  });
  private readonly webSearchCredentials = new WebSearchCredentialService(
    this.app.secretStorage,
    async (reference, secret) => {
      await this.ensureRuntime("user-action");
      const transport = this.transport ?? await this.frontendSessions.ensureUtility();
      await transport.synchronizeMcpCredential(reference, secret);
    },
  );
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
      documentOcrEngine: this.settings.documentOcrEngine,
      documentOcrLanguage: this.settings.documentOcrLanguage,
      advancedOcrCommand: this.settings.advancedOcrCommand,
    }),
    getVaultPaths: () => getChatobbyVaultRuntimePaths(this.app),
    assertRuntimeStartAllowed: () => this.developmentPairStartup.assertRuntimeStartAllowed(),
    resolveManagedCommand: () => this.runtimeResolver.resolve(),
    connectRuntime: (runtime) => this.bindRuntime(runtime),
    disconnectRuntime: () => this.closeFrontendSession(),
    pluginVersion: this.manifest.version,
    runtimePublicKey: this.runtimePublicKey,
  });
  private readonly runtimeInstaller = new RuntimePackageInstaller(runtimeInstallRoot(), this.runtimePublicKey ?? "");
  private readonly runtimeUpdateClient = new RuntimeUpdateClient(runtimeInstallRoot(), this.runtimePublicKey ?? "");
  private readonly runtimeUpdates = new RuntimeUpdateManager({
    pluginVersion: this.manifest.version,
    enabled: this.buildMode === "release" && Boolean(this.runtimePublicKey),
    client: this.runtimeUpdateClient,
    installer: this.runtimeInstaller,
    getInstalledVersion: () => readInstalledRuntimeVersion(),
    admitMaintenance: (operationId, target) => this.runtimeManager.admitMaintenance(operationId, "runtime-update", target),
    cancelMaintenance: (operationId, leaseId) => this.runtimeManager.cancelMaintenance(operationId, leaseId),
    commitMaintenance: (operationId, leaseId) => this.runtimeManager.commitMaintenance(operationId, leaseId),
    stopRuntime: () => this.runtimeManager.stop("user-action"),
    startRuntime: (command) => {
      this.developmentPairStartup.assertRuntimeStartAllowed();
      return this.runtimeManager.ensureReady({ reason: "manual-restart" }, command).then(() => undefined);
    },
  });
  private readonly automaticRuntimeProvisioning = automaticRuntimeProvisioningEnabled(this.buildMode);
  private readonly runtimeBootstrap = new RuntimeBootstrapCoordinator({
    enabled: this.automaticRuntimeProvisioning,
    hasInstalledRuntime: () => readInstalledRuntimeVersion() !== null,
    shouldStartRuntime: () => this.settings.runtimeAutoStart,
    reattachCompatibleRuntime: () => this.ensureRuntime("automatic-restart").then(() => undefined),
    ensureRequiredRuntime: (signal) => {
      this.developmentPairStartup.assertRuntimeStartAllowed();
      return this.runtimeUpdates.ensureRequiredRuntime(signal);
    },
    stopProvisionedRuntime: () => this.runtimeManager.stop("user-action"),
    reportFailure: (error) => console.error("Chatobby: automatic runtime provisioning needs attention", error),
  });

  private readonly visibleChatViews = new Set<ChatobbyView>();
  private _lastChatobbyView: ChatobbyView | null = null;
  private _lastMarkdownView: MarkdownView | null = null;
  private activeLeafActivation = 0;
  private vaultDirectoryRefreshTimer: number | null = null;
  private unloading = false;

  // ── Lifecycle ────────────────────────────────────────────────────

  async onload(): Promise<void> {
    this.unloading = false;
    await this.store.load();
		// Runtime leases, bridge registration, permissions, and Projects must all
		// use the same path-independent identity before any connection starts.
		await initializeChatobbyVaultIdentity(this.app);
    const developmentVaultPaths = getChatobbyVaultRuntimePaths(this.app);
    if (this.buildMode === "development" && developmentVaultPaths && this.manifest.dir) {
      const adoption = new DevelopmentPairCoordinator({
        enabled: true,
        vaultRoot: developmentVaultPaths.vaultRoot,
        configDir: this.app.vault.configDir,
        pluginRoot: join(developmentVaultPaths.vaultRoot, this.manifest.dir),
        externalRuntimeCacheRoot: runtimeDevelopmentPairsRoot(),
        runtime: this.runtimeManager,
        protocolVersion: CHATOBBY_RUNTIME_PROTOCOL_VERSION,
        frontendProtocolVersion: CHATOBBY_FRONTEND_PROTOCOL_VERSION,
        verifyFrontendBootstrap: (runtime, pairId, timeoutMs, signal) =>
          this.verifyDevelopmentPairFrontendBootstrap(runtime, pairId, timeoutMs, signal),
      });
      const failure = await this.developmentPairStartup.capture(
        this.getRuntimeMode(),
        () => adoption.adoptPending(),
      );
      if (failure) {
        this.runtimeManager.blockRuntimeStartsUntilReload();
        console.error(
          "Chatobby: development pair adoption failed; runtime startup remains blocked "
          + `(${failure.state.diagnostics.code})`,
        );
      }
    }
    if (!this.developmentPairStartup.blocked) {
      await this.runtimeUpdates.recoverInterruptedInstallation();
    }
    this.projectDirectoryObservations.start();

    this.registerView(VIEW_TYPE_CHATOBBY, (leaf) => new ChatobbyView(leaf, this));
    this.registerView(VIEW_TYPE_CHATOBBY_PAGE, (leaf) => new WorkspacePageView(leaf, this));
    this.registerView(VIEW_TYPE_CHATOBBY_NAVIGATOR, (leaf) => new ProjectNavigatorView(leaf, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      const activation = ++this.activeLeafActivation;
      if (leaf?.view instanceof ChatobbyView) {
        const view = leaf.view;
        this._lastChatobbyView = view;
        void activateChatobbyLeaf({
          activateSessionContext: () => view.activateSessionContext(),
          isCurrent: () => activation === this.activeLeafActivation && this.app.workspace.getActiveViewOfType(ChatobbyView) === view,
          synchronizeActiveScreen: () => view.synchronizeActiveScreen(),
          focusComposer: () => view.focusComposer(),
        })
          .catch((error) => {
            console.error("Chatobby: could not activate leaf session context", error);
          });
      } else if (leaf?.view instanceof MarkdownView) {
        this._lastMarkdownView = leaf.view;
      }
    }));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleVaultDirectoryRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleVaultDirectoryRefresh()));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.scheduleVaultDirectoryRefresh();
      this.projectDirectoryObservations.observeRename(file, oldPath);
    }));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      addFileExplorerSessionMenuItems(menu, file, {
        startNewSession: async (vaultDirectoryPath) => {
			await this.startSessionFromVaultDirectory(vaultDirectoryPath);
        },
        resumeSession: async (vaultDirectoryPath) => {
			await this.openSessionsFromVaultDirectory(vaultDirectoryPath);
        },
        createProject: async (vaultDirectoryPath) => {
			await this.createProjectFromVaultDirectory(vaultDirectoryPath);
        },
      });
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
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      if (!this.developmentPairStartup.blocked && !this.unloading) void this.workspacePages.restoreNativeLeaves();
    }));
    this.app.workspace.onLayoutReady(() => {
      if (!this.developmentPairStartup.blocked && !this.unloading) {
        void this.runtimeBootstrap.start();
        void this.workspacePages.restoreNativeLeaves();
      }
      if (!this.unloading) this.introduction.showInitial();
    });
  }

  onunload(): void {
    this.unloading = true;
    this.introduction.dispose();
    this.workspacePages.dispose();
    this.runtimeBootstrap.dispose();
    if (this.vaultDirectoryRefreshTimer) window.clearTimeout(this.vaultDirectoryRefreshTimer);
    this.vaultDirectoryRefreshTimer = null;
    void this.disposePluginResources();
  }

  private async disposePluginResources(): Promise<void> {
    // Plugin reloads must not terminate session-owned work in the backend.
    await this.runtimeManager.detach("plugin-unload").catch(() => {});
    this.projectDirectoryObservations.dispose();
    await this.frontendSessions.dispose();
    await this.bridgeCoordinator.dispose();
    disposeObsidianUiSnapshotService(this.app);
    disposeObsidianSemanticContextService(this.app);
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
        restart: () => this.restartRuntime(),
      },
      cycleModel: () => this.cycleModel(),
      cycleThinking: () => this.cycleThinking(),
      focusActiveEditor: () => {
        const active = this.app.workspace.getActiveViewOfType(MarkdownView);
        const open = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view);
        const target = active ?? (this._lastMarkdownView && open.includes(this._lastMarkdownView)
          ? this._lastMarkdownView
          : null);
        if (target) void this.app.workspace.revealLeaf(target.leaf).then(() => target.editor?.focus());
      },
    };
  }

  // ── View helpers ──────────────────────────────────────────────────

  /** Ensure the view is open, then run an action against it. */
  private async withView(fn: (view: ChatobbyView) => void | Promise<void>): Promise<void> {
    let view = this.getActiveView();
    if (!view) {
      await this.activateView();
      view = this.getActiveView();
    } else {
      await this.app.workspace.revealLeaf(view.leaf);
    }
    if (view) await fn(view);
  }

  /** The active ChatobbyView, if one is open. */
  getActiveView(): ChatobbyView | null {
    return selectChatobbyCommandTarget(
      this.app.workspace.getActiveViewOfType(ChatobbyView),
      this._lastChatobbyView,
      this.chatobbyViews(),
    );
  }

  /** Active leaf transport, falling back to another live frontend or utility channel. */
  get transport(): ChatobbyTransport | null {
    const activeChannelId = this.getActiveView()?.runtimeChannelId;
    return this.frontendSessions.primary(activeChannelId);
  }

  async fetchGuide(): Promise<ChatobbyGuideChannelAsset> {
    if (this.buildMode !== "release" || !this.runtimePublicKey) {
      throw new Error("The external Chatobby Guide is available only from a signed release build");
    }
    return this.runtimeUpdateClient.fetchGuide(this.manifest.version);
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
    await this.bridgeCoordinator.removeOwner(view.runtimeChannelId);
  }

  getViewTransport(view: ChatobbyView): ChatobbyTransport | null {
    return this.frontendSessions.get(view.runtimeChannelId);
  }

  async registerWorkspaceChannel(channelId: string): Promise<void> {
    this.workspaceChannels.add(channelId);
    await this.frontendSessions.register(channelId);
  }

  async ensureWorkspaceChannel(channelId: string): Promise<ChatobbyTransport> {
    await this.ensureRuntime("user-action");
    return this.frontendSessions.ensure(channelId);
  }

  async unregisterWorkspaceChannel(channelId: string): Promise<void> {
    this.workspaceChannels.delete(channelId);
    await this.frontendSessions.unregister(channelId);
  }

  async openWorkspacePage(state: WorkspacePageState): Promise<void> {
    await this.workspacePages.open(state);
  }

  async openSessionById(sessionId: string): Promise<ChatobbyView> {
    const existing = this.chatobbyViews().find((view) => view.tabs().some((tab) => tab.sessionId === sessionId));
    if (existing) {
      await existing.switchToSession(sessionId);
      existing.openMainFeed();
      this.focusChatView(existing);
      return existing;
    }
    const view = await this.openBlankView("");
    await view.resumeSessionById(sessionId);
    return view;
  }

  stopSessionById(sessionId: string): void {
    const stopped = this.chatobbyViews().map((view) => view.requestStopForSession(sessionId)).some(Boolean);
    if (!stopped) new Notice("That conversation is no longer running in an open Chatobby tab.");
  }

  async activateView(): Promise<void> {
    await this.openNavigator();
    const target = this.getActiveView();
    if (target) {
      await this.app.workspace.revealLeaf(target.leaf);
      return;
    }
    // Chatobby is a full work surface, not a utility widget. A root tab avoids
    // inheriting an arbitrarily short or narrow right-sidebar split.
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_CHATOBBY, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  private chatobbyViews(): ChatobbyView[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY)
      .map((leaf) => leaf.view)
      .filter((view): view is ChatobbyView => view instanceof ChatobbyView);
  }

  async openNavigator(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY_NAVIGATOR)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeftLeaf(false) ?? undefined;
      if (!leaf) return;
      await leaf.setViewState({ type: VIEW_TYPE_CHATOBBY_NAVIGATOR, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
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
		await this.app.workspace.revealLeaf(leaf);
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
      await this.app.workspace.revealLeaf(existing.leaf);
      return existing;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_CHATOBBY,
      active: true,
      state: { mode: "chat", vaultDirectoryPath: normalized },
    });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (!(view instanceof ChatobbyView)) throw new Error("Obsidian did not create the Chatobby directory view");
    return view;
  }

	private async startSessionFromVaultDirectory(vaultDirectoryPath: string): Promise<void> {
		const canonical = await this.findCanonicalDirectoryProject(vaultDirectoryPath);
		if (!canonical) {
			const view = await this.openBlankView(vaultDirectoryPath);
			await view.createProjectForCurrentSession({
				name: projectNameFromDirectory(vaultDirectoryPath),
				vaultRelativePath: vaultDirectoryPath,
			});
			return;
		}

		let action = this.settings.directoryProjectLaunchBehavior;
		if (action === "ask") {
			const decision = await requestDirectoryProjectDecision(this.app, {
				projectName: canonical.name,
				vaultRelativePath: vaultDirectoryPath,
			});
			if (!decision) return;
			action = decision.action;
			if (decision.remember) {
				await this.updateSettings({ directoryProjectLaunchBehavior: decision.action });
			}
		}

		if (action === "reuse-canonical") {
			const view = await this.openBlankView(vaultDirectoryPath);
			await view.createSessionForProject(canonical.projectId);
			return;
		}

		const draft = await requestDirectoryProjectDraft(this.app, vaultDirectoryPath);
		if (!draft) return;
		const view = await this.openBlankView(vaultDirectoryPath);
		await view.createProjectForCurrentSession({
			name: draft.name,
			...(draft.description ? { description: draft.description } : {}),
			vaultRelativePath: vaultDirectoryPath,
		});
	}

	private async createProjectFromVaultDirectory(vaultDirectoryPath: string): Promise<void> {
		const draft = await requestDirectoryProjectDraft(this.app, vaultDirectoryPath);
		if (!draft) return;
		const view = await this.openBlankView(vaultDirectoryPath);
		await view.createProjectForCurrentSession({
			name: draft.name,
			...(draft.description ? { description: draft.description } : {}),
			vaultRelativePath: vaultDirectoryPath,
		});
	}

	private async openSessionsFromVaultDirectory(vaultDirectoryPath: string): Promise<void> {
		const canonical = await this.findCanonicalDirectoryProject(vaultDirectoryPath);
		if (!canonical) {
			const view = this.getActiveView() ?? await this.openBlankView();
			await this.app.workspace.revealLeaf(view.leaf);
			view.commandOpenPage("projects");
			return;
		}
		const view = await this.openBlankView(vaultDirectoryPath);
		await view.openProjectSessions(canonical.projectId);
	}

	private async findCanonicalDirectoryProject(
		vaultDirectoryPath: string,
	): Promise<FrontendProjectSummaryViewModel | undefined> {
		await this.ensureRuntime("user-action");
		const transport = await this.frontendSessions.ensureUtility();
		if (!transport.isConnected) throw new Error("Chatobby runtime did not connect.");
		const viewId = "chatobby-project-directory-probe";
		const negotiation = await transport.negotiateFrontend(createFrontendNegotiationRequest(this.app, this, viewId));
		const subscription = await transport.subscribeFrontend({
			schemaVersion: 1,
			protocolVersion: negotiation.protocolVersion,
			requestId: frontendId(crypto.randomUUID(), "requestId"),
			runtimeInstanceId: negotiation.runtimeInstanceId,
			viewId: negotiation.viewId,
		});
		if (subscription.status === "resync-required") throw new Error(subscription.error.message);
		const response = await transport.getFrontendScreen({
			schemaVersion: 1,
			protocolVersion: negotiation.protocolVersion,
			runtimeInstanceId: negotiation.runtimeInstanceId,
			viewId: negotiation.viewId,
			requestId: frontendId(crypto.randomUUID(), "requestId"),
			requestEpoch: 1,
			baseSequence: subscription.sequence,
			screenId: "projects",
		});
		const screen = response.screen;
		if (screen.screenId !== "projects") throw new Error("Chatobby returned the wrong Project screen.");
		const normalized = normalizeVaultDirectoryPath(vaultDirectoryPath);
		return screen.projects.find(
			(project) =>
				project.lifecycle === "active" &&
				normalizeVaultDirectoryPath(project.canonicalVaultRelativePath ?? "") === normalized,
		);
	}

  /** Open a distinct session work surface, or focus the leaf already owning a resumed path. */
  async openSessionView(vaultDirectoryPath: string, sessionPath?: string): Promise<ChatobbyView> {
    if (sessionPath) {
      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY)
        .map((leaf) => leaf.view)
        .filter((view): view is ChatobbyView => view instanceof ChatobbyView)
        .find((view) => view.hasSessionPath(sessionPath));
      if (existing) {
        await existing.resumeStoredSession(sessionPath);
        this.focusChatView(existing);
        return existing;
      }
    }
    const normalized = vaultDirectoryPath.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({
      type: VIEW_TYPE_CHATOBBY,
      active: true,
      state: { mode: "chat", vaultDirectoryPath: normalized, sessionPath },
    });
    const view = leaf.view;
    if (!(view instanceof ChatobbyView)) throw new Error("Obsidian did not create the Chatobby session view");
    if (sessionPath) await view.resumeStoredSession(sessionPath);
    this.focusChatView(view);
    return view;
  }

  focusChatView(view: ChatobbyView): void {
    this._lastChatobbyView = view;
    void this.app.workspace.revealLeaf(view.leaf);
    window.requestAnimationFrame(() => {
      if (this.app.workspace.getActiveViewOfType(ChatobbyView) === view) view.focusComposer();
    });
  }

  notifySessionDirectoryChanged(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY_NAVIGATOR)) {
      if (leaf.view instanceof ProjectNavigatorView) leaf.view.refreshSessionDirectory();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY)) {
      if (leaf.view instanceof ChatobbyView) leaf.view.refreshSessionDirectoryIfOpen();
    }
  }

  private scheduleVaultDirectoryRefresh(): void {
    if (this.vaultDirectoryRefreshTimer) window.clearTimeout(this.vaultDirectoryRefreshTimer);
    this.vaultDirectoryRefreshTimer = window.setTimeout(() => {
      this.vaultDirectoryRefreshTimer = null;
      this.notifySessionDirectoryChanged();
    }, 100);
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
    return this.developmentPairStartup.runtimeState(this.runtimeManager.state);
  }

  /** Effective runtime mode after applying the immutable release boundary. */
  getRuntimeMode(): PluginSettings["runtimeMode"] {
    return connectorRuntimeMode(this.settings.runtimeMode, this.buildMode);
  }

  isReleaseBuild(): boolean {
    return this.buildMode === "release";
  }

  usesAutomaticRuntimeProvisioning(): boolean {
    return this.automaticRuntimeProvisioning;
  }

  onRuntimeStateChange(listener: (state: RuntimeLifecycleState) => void): () => void {
    return this.runtimeManager.onStateChange((state) => listener(this.developmentPairStartup.runtimeState(state)));
  }

  getRuntimeUpdateState(): RuntimeUpdateState {
    return this.runtimeUpdates.state;
  }

  onRuntimeUpdateStateChange(listener: (state: RuntimeUpdateState) => void): () => void {
    return this.runtimeUpdates.onStateChange(listener);
  }

  openRuntimeInstaller(repair = false): void {
    this.developmentPairStartup.assertRuntimeStartAllowed();
    new RuntimeInstallModal(this.app, {
      getState: () => this.runtimeUpdates.state,
      onStateChange: (listener) => this.runtimeUpdates.onStateChange(listener),
      checkForUpdate: () => this.runtimeUpdates.check(true),
      checkForRepair: () => this.runtimeUpdates.checkForRepair(),
      install: (signal) => this.runtimeUpdates.install(signal),
      hasActiveWork: () => this.hasActiveRuntimeWork(),
    }, repair).open();
  }

  async retryRuntimeProvisioning(): Promise<void> {
    this.developmentPairStartup.assertRuntimeStartAllowed();
    if (this.automaticRuntimeProvisioning) {
      await this.runtimeBootstrap.retry();
      return;
    }
    this.openRuntimeInstaller();
  }

  async removeLocalRuntime(): Promise<void> {
    if (this.hasActiveRuntimeWork()) {
      throw new Error("Finish the current Chatobby work before removing the local runtime");
    }
    await this.runtimeManager.stop("user-action");
    await this.runtimeInstaller.removeInstalledRuntime();
    this.runtimeUpdates.reset();
  }

  private hasActiveRuntimeWork(): boolean {
    return [...this.visibleChatViews].some((view) => view.hasActiveWork());
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
    this.developmentPairStartup.assertRuntimeStartAllowed();
    await this.runOperation(
      { key: "backend-lifecycle", id: "backend:restart", label: "Restarting Chatobby" },
      async () => {
        await this.runtimeManager.stop("user-action");
        await this.ensureRuntime("manual-restart");
      },
    );
  }

  async ensureRuntime(reason: RuntimeActionReason): Promise<ReadyRuntime> {
    this.developmentPairStartup.assertRuntimeStartAllowed();
    try {
      const runtime = await this.runtimeManager.ensureReady({ reason });
      await this.runtimeUpdates.finalizeRecoveredRuntime(runtime.identity);
      return runtime;
    } catch (error) {
      let rolledBack = false;
      try {
        rolledBack = await this.runtimeUpdates.rollbackRecoveredRuntime();
      } catch (rollbackError) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} Automatic runtime recovery also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      }
      if (!rolledBack) throw error;
      return this.runtimeManager.ensureReady({ reason });
    }
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

	/** Open the primary in-Chatobby settings surface. */
	async openChatobbySettings(): Promise<void> {
		const app = this.app as typeof this.app & { setting?: { close?(): void } };
		app.setting?.close?.();
		await this.activateView();
		this.getActiveView()?.commandOpenPage("settings");
	}

	async completeOnboarding(): Promise<void> {
		if (this.settings.onboardingVersion >= 1) return;
		await this.updateSettings({ onboardingVersion: 1 });
	}

  showWhatsNew(): void { this.introduction.show("changes"); }

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

  hasEnhancedWebSearch(): boolean {
    return this.webSearchCredentials.isConfigured();
  }

  async setEnhancedWebSearchKey(key: string): Promise<void> {
    await this.webSearchCredentials.set(key);
  }

  async removeEnhancedWebSearchKey(): Promise<void> {
    await this.webSearchCredentials.remove();
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
    const liveChannelIds = new Set<string>(
      this.app.workspace.getLeavesOfType(VIEW_TYPE_CHATOBBY)
        .map((leaf) => leaf.view)
        .filter((view): view is ChatobbyView => view instanceof ChatobbyView)
        .map((view) => view.runtimeChannelId),
    );
    for (const channelId of this.workspaceChannels) liveChannelIds.add(channelId);
    await this.frontendSessions.reconcile(liveChannelIds);
    this.developmentPairStartup.assertRuntimeStartAllowed();
    await this.frontendSessions.bindRuntime(runtime);
  }

  private async verifyDevelopmentPairFrontendBootstrap(
    runtime: ReadyRuntime,
    pairId: string,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<DevelopmentPairActivationProof> {
    const transport = await this.frontendSessions.ensureUtility();
    const viewId = frontendId(`development-pair-${pairId.slice(0, 32)}`, "viewId");
    return verifyDevelopmentPairFrontendBootstrap({
      pairId,
      runtime,
      transport,
      request: createFrontendNegotiationRequest(this.app, this, viewId),
      timeoutMs,
      signal,
    });
  }

  /** Detach frontend clients without waiting on an in-flight agent command. */
  private async closeFrontendSession(): Promise<void> {
    await this.frontendSessions.disconnectRuntime();
    await this.bridgeCoordinator.clearOwners();
  }

  /** Accept only the canonical, stable-vault bridge configuration. */
  private async acceptBridgeConfig(channelId: string, config: unknown): Promise<void> {
    const parsed = parseObsidianBridgeConnectionConfig(config);
    await this.bridgeCoordinator.setOwnerConfig(channelId, parsed);
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

function normalizeVaultDirectoryPath(value: string): string {
	return value.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
}

function projectNameFromDirectory(value: string): string {
	return normalizeVaultDirectoryPath(value).split("/").filter(Boolean).at(-1) ?? "New Project";
}
