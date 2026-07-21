import { ItemView, Notice, Scope, type Menu, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import type ChatobbyPlugin from "../main";
import type { ComposerAttachment, ExtensionPanelAction, InteractionState, SessionState, VaultContext, WsPromptAttachment } from "../types";
import { INITIAL_CONNECTION_STATE } from "../types";
import type { FeedStore } from "../features/feed/public";
import { StoredSessionController, type SessionTab } from "../features/session/public";
import { applySessionEvent } from "../transitions";
import { buildViewShell, type ViewShell, type ShellHandlers } from "./shell/view-shell";
import { Toolbar } from "./toolbar/toolbar";
import { FeedRenderer, type FeedHost } from "./feed";
import { createChatViewFeedHost } from "./feed/chat-view-feed-host";
import { Composer, type PromptSubmissionOutcome } from "./composer/composer";
import { createComposerContextHost } from "./composer/composer-context-host";
import { ComposerControls } from "./composer/composer-controls";
import { promptText } from "./modals/modals";
import { openAutoCompactionSettings, toggleAutoCompaction, type AutoCompactionActionOptions } from "./controller/auto-compaction-controller";
import { SlashMenu } from "./composer/slash-menu";
import type { SlashArgumentOption, SlashCommandSpec, SlashParsedCommand } from "./composer/slash-command";
import { TabBar } from "./session/tab-bar";
import { storeComposerFile } from "../attachments/attachment-store";
import { normalizeVaultDirectoryInput } from "./session/session-directory";
import { SessionPickerModeController } from "./session/session-picker-mode-controller";
import { LeafDirectoryRouter } from "./session/leaf-directory-router";
import { SessionTransitionCoordinator } from "./session/session-transition-coordinator";
import { StoredSessionActions } from "./session/stored-session-actions";
import { ActiveSessionActions } from "./session/active-session-actions";
import { gatherVaultContext, toPromptContextPacket } from "../prompt";
import { errorMessage } from "../utils";
import type { ChatobbyTransport } from "../transport/ws-client";
import { LiveStatsController } from "./controller/live-stats-controller";
import { isThinkingLevel, withTimeout, workingDirectoryLabel } from "./controller/view-utils";
import { SlashCommandController } from "../features/commands/public";
import { createChatViewOverlayScreens, type ChatViewOverlayScreens, type OverlayViewMode } from "./screens/chat-view-overlay-screens";
import { ExtensionUiController } from "./controller/extension-ui-controller";
import { SessionController, type SessionMutationRequest, type WorkingDirectoryScope } from "./controller/session-controller";
import { createChatViewSubagentControllers, subagentActorId, type SessionAgentRailController, type SubagentScreenController, type SubagentScreenTab } from "../features/subagents/public";
import { ChannelScreenController, routeAgentReference } from "../features/channels/public";
import { RuntimeStatusController, RuntimeStatusMenu, RuntimeUpdateController } from "../features/runtime-status/public";
import { ViewRuntimeController } from "../runtime/application/view-runtime-controller";
import { closeInactiveViewSurfaces, parseLeafSessionState, parseNavigationState, ribbonModeForNavigation, shouldActivateLeafSession, ViewNavigationController, type ChatobbyNavigationState, type ChatobbyViewMode, type ExclusiveViewSurface } from "./controller/view-navigation-controller";
import { openSystemPathExternally } from "./controller/system-path-opener";
import { ConnectionStatusController } from "./controller/connection-status-controller";
import { SessionPreferenceController } from "./controller/session-preference-controller";
import { removeOnboardingPanel } from "./controller/onboarding-panel-controller";
import { OperationCoordinator, type OperationDescriptor } from "../features/operations/public";
import { TaskProgress } from "../features/tasks/public";
import { routeExtensionPanelAction } from "./controller/extension-panel-action-router";
import { renderViewMode as renderShellViewMode } from "./controller/view-mode-renderer";
import { routePermissionSlash } from "./controller/permission-slash-router";
import { resolveSubagentPermissionAction } from "./controller/subagent-permission-action";
import { TurnAbortController } from "./controller/turn-abort-controller";
import { FrontendProtocolController } from "../frontend/frontend-protocol-controller";
import { FrontendStore } from "../frontend/frontend-store";
import { FrontendSnapshotBatcher, sessionDirectoryProjectionChanged } from "../frontend/frontend-snapshot-batcher";
import { createFrontendBootstrapRequest } from "./controller/frontend-bootstrap-request";
import { synchronizeFrontendFeed as syncFrontendFeedProjection } from "./controller/frontend-feed-sync";
import type {
  FrontendBootstrap,
  FrontendChoiceControl,
  FrontendIntent,
  FrontendNavigationReference,
} from "../vendor/chatobby-client/frontend-contracts.js";
import { FRONTEND_RENDER_BATCH_MS, FRONTEND_SCHEMA_VERSION } from "./shared/constants";
import { ConnectedViewRestorationController } from "./controller/connected-view-restoration";
import { PROMPT_START_TIMEOUT_MS, retractAcceptedPrompt, submitPrompt } from "./controller/prompt-submission-controller";
import { deliverQueuedMessage } from "./controller/queued-message-delivery";
const VIEW_TYPE = "chatobby-view";
export class ChatobbyView extends ItemView {
  readonly runtimeChannelId = globalThis.crypto.randomUUID();
  private readonly operations = new OperationCoordinator();
  private readonly sessions: SessionController;
  private readonly storedSessions: StoredSessionController;
  private readonly storedSessionActions: StoredSessionActions;
  private readonly directoryRouter: LeafDirectoryRouter<ChatobbyView>;
  private readonly activeSessionActions: ActiveSessionActions;
  private shell!: ViewShell;
  private tabBar!: TabBar;
  private toolbar!: Toolbar;
  private feed: FeedRenderer | null = null;
  private composer!: Composer;
  private composerControls!: ComposerControls;
  private taskProgress!: TaskProgress;
  private sessionTransition!: SessionTransitionCoordinator;
  private runtimeStatus!: RuntimeStatusController;
  private runtimeStatusMenu!: RuntimeStatusMenu;
  private runtimeUpdate!: RuntimeUpdateController;
  private viewMode: ChatobbyViewMode = "chat";
  private readonly sessionPickerMode: SessionPickerModeController;
  private componentsReady = false;
  private stateHydrated = false;
  private pendingNavigation: ChatobbyNavigationState = { mode: "chat" };
  private pendingSessionPath: string | null = null;
  private readonly viewNavigation: ViewNavigationController;
  private slashMenu: SlashMenu | null = null;
  private boundTransport: ChatobbyTransport | null = null;
  private readonly runtimeLifecycle: ViewRuntimeController;
  private unsubscribeConnection: (() => void) | null = null;
  private readonly connectionRestoration: ConnectedViewRestorationController<ChatobbyTransport>;
  private lastRetryNoticeKey: string | null = null;
  private readonly liveStats: LiveStatsController;
  private readonly slashCommands: SlashCommandController;
  private readonly overlayScreens: ChatViewOverlayScreens;
  private readonly subagentScreen: SubagentScreenController;
  private readonly sessionAgentRail: SessionAgentRailController;
  private readonly channelScreen: ChannelScreenController;
  private readonly extensionUi: ExtensionUiController;
  private readonly turnAbort: TurnAbortController;
  private readonly connectionStatus: ConnectionStatusController;
  private readonly sessionPreferences: SessionPreferenceController;
  private readonly frontendStore = new FrontendStore();
  private readonly frontendSnapshots = new FrontendSnapshotBatcher(
    FRONTEND_RENDER_BATCH_MS,
    (snapshot, previous) => this.applyFrontendSnapshot(snapshot, previous),
  );
  private readonly frontendProtocol: FrontendProtocolController;
  private unsubscribeFrontendStore: (() => void) | null = null;
  private pendingFeedCatchup = false;
  private readonly handleViewKeydown = (event: KeyboardEvent): void => {
    if (this.viewMode === "session-picker") {
      if (this.sessionPickerMode.handleKeydown(event)) event.stopPropagation();
    } else if (this.viewMode === "permissions") {
      if (this.overlayScreens.permissions.handleKeydown(event)) event.stopPropagation();
    } else if (this.viewMode === "memory") {
      if (this.overlayScreens.memory.handleKeydown(event)) event.stopPropagation();
    } else if (this.viewMode === "events") {
      if (this.overlayScreens.events.handleKeydown(event)) event.stopPropagation();
    } else if (this.viewMode === "queries") {
      if (this.overlayScreens.queries.handleKeydown(event)) event.stopPropagation();
    } else if (this.viewMode === "subagents") {
      if (this.subagentScreen.handleKeydown(event)) event.stopPropagation();
    } else if (this.viewMode === "chat" && this.composer.handleViewKeydown(event)) event.stopPropagation();
  };
  private readonly handleOpenSubagents = (event: Event): void => {
    const detail = (event as CustomEvent<{ runId?: string; nodeId?: string; feedOnly?: boolean }>).detail;
    this.openSubagentSessionsScreen(detail?.runId, "runs", detail?.nodeId, detail?.feedOnly ?? false);
  };
  private readonly handleOpenChannels = (event: Event): void => this.navigateTo(channelNavigationState(event));
  constructor(leaf: WorkspaceLeaf, private plugin: ChatobbyPlugin) {
    super(leaf);
    this.scope = new Scope(this.app.scope);
    this.scope.register(null, null, (event) => this.componentsReady && this.viewMode === "chat" && this.composer.handleCapturedKeydown(event) ? false : undefined);
    // Keep this static work surface out of Obsidian's file-navigation targets.
    this.navigation = false;
    this.viewNavigation = new ViewNavigationController(leaf, VIEW_TYPE, {
      openChat: () => {
        this.prepareExclusiveSurface("chat");
        this.viewMode = "chat";
        this.renderViewMode();
      },
      openPermissions: () => this.overlayScreens.permissions.open(),
      openMemory: () => this.overlayScreens.memory.open(),
      openEvents: () => this.overlayScreens.events.open(),
      openQueries: () => this.overlayScreens.queries.open(),
      openSubagents: (state) => {
        this.subagentScreen.open(state.runId, state.subagentTab ?? "runs", state.nodeId, state.feedOnly ?? false);
      },
      openChannels: (state) => this.channelScreen.open(state.channelId, state.messageId),
      openSessionPicker: () => this.sessionPickerMode.open(),
      getLeafSessionState: () => ({
        vaultDirectoryPath: this.sessions.workingDirectoryPath(),
        sessionPath: this.activeTab()?.sessionFile,
      }),
      onError: (error) => {
        console.error("Chatobby: view navigation failed", error);
        new Notice("Chatobby could not open that view.");
      },
    });
    this.runtimeLifecycle = new ViewRuntimeController({
      shouldAutoStart: () => this.plugin.settings.runtimeAutoStart,
      acquireDemand: (kind, ownerId) => this.plugin.acquireRuntimeDemand(kind, ownerId),
      ensureRuntime: (reason) => this.plugin.ensureChatViewRuntime(this, reason),
      getTransport: () => this.getTransport(),
      onStateChange: (listener) => this.plugin.onRuntimeStateChange(listener),
      handleStateChange: () => this.handleRuntimeStateChange(),
    });
    this.frontendProtocol = new FrontendProtocolController({
      store: this.frontendStore,
	  createBootstrapRequest: () => createFrontendBootstrapRequest(this.app, this.plugin, this.runtimeChannelId, this.gatherContext()),
      onError: (error) => {
        console.error("Chatobby: frontend protocol synchronization failed", error);
        new Notice(`Chatobby could not synchronize this view: ${errorMessage(error)}`);
      },
    });
    this.sessions = new SessionController({
      app: this.app,
      plugin: this.plugin,
      getTransport: () => this.getTransport(),
      refreshTabBar: () => this.refreshTabBar(),
      renderActiveTab: () => this.renderActiveTab(),
      persistLeafState: () => { void this.app.workspace.requestSaveLayout(); },
      exitSessionPicker: () => this.viewNavigation.replace({ mode: "chat" }),
      runOperation: (descriptor, operation) => this.runOperation(descriptor, operation),
      getActiveOperation: () => this.operations.current("session-transition"),
      claimSessionOwnership: () => this.claimSessionOwnership(),
      dispatchSessionIntent: (request) => this.dispatchFrontendSessionIntent(request),
      synchronizeFrontend: async () => {
        const transport = this.getTransport();
        if (transport?.isConnected) await this.frontendProtocol.synchronize(transport);
      },
      settlePresentation: () => this.sessionTransition.settle(),
    });
    this.storedSessions = new StoredSessionController({
      app: this.app,
      ensureConnectedTransport: (action) => this.ensureConnectedTransport(action),
      runOperation: (descriptor, operation) => this.runOperation(descriptor, operation),
    });
    this.directoryRouter = new LeafDirectoryRouter({
      currentTarget: () => this,
      currentDirectory: () => this.sessions.workingDirectoryPath(),
      canReuseCurrentTarget: () => this.sessions.canReuseForSessionNavigation(),
      isDirectory: (path) => this.sessions.isVaultDirectoryPath(path),
      setCurrentDirectory: (path) => this.sessions.setWorkingDirectory(path),
      rememberDefaultDirectory: (path) => this.plugin.setActiveVaultDirectory(path),
      openDirectoryTarget: (path) => this.plugin.openDirectoryView(path),
      openSessionTarget: (path, sessionPath) => this.plugin.openSessionView(path, sessionPath),
      ensureDirectoryTarget: async (target) => { await target.sessions.ensureActiveSessionTarget(); },
      closeCurrentExplorer: () => this.viewNavigation.replace({ mode: "chat" }),
      resumeInTarget: (target, path) => target.handleSessionPickerSelect(path),
      createInTarget: (target) => target.sessions.createSession(),
      focusTarget: (target) => this.plugin.focusChatView(target),
    });
    this.storedSessionActions = new StoredSessionActions({
      app: this.app,
      sessions: this.storedSessions,
      refresh: () => {
        this.sessionPickerMode.refresh();
        this.plugin.notifySessionDirectoryChanged();
      },
    });
    this.activeSessionActions = new ActiveSessionActions({
      app: this.app,
      getTransport: () => this.getTransport(),
      getActiveTab: () => this.activeTab(),
      getWorkingDirectory: () => this.sessions.workingDirectoryPath(),
      getForkOptions: () => this.frontendStore.snapshot?.session?.forkOptions ?? [],
      forkStoredSession: (sessionPath, entryId) => this.storedSessions.fork(sessionPath, entryId),
      openForkedSession: async (workingDirectory, sessionPath) => (await this.plugin.openSessionView(workingDirectory, sessionPath)).resumeStoredSession(sessionPath),
      dispatchSessionIntent: (request) => this.dispatchFrontendSessionIntent(request),
      runOperation: (descriptor, operation) => this.runOperation(descriptor, operation),
      runTransition: (label, operation) => this.sessions.runSessionTransition(label, operation),
      setTab: (tab) => this.sessions.setTab(tab),
      refreshTabs: () => this.refreshTabBar(),
      sessionsChanged: () => this.plugin.notifySessionDirectoryChanged(),
    });
    this.sessionPickerMode = new SessionPickerModeController({
      app: this.app,
      getHost: () => this.shell.sessionPickerHostEl,
      getTransport: () => this.ensureConnectedTransport("browsing session directories"),
      getScope: () => this.resolveWorkingDirectoryScope("browsing session directories"),
      prepareOpen: () => {
        this.prepareExclusiveSurface("session-picker");
      },
      useDirectory: async (directory) => { await this.directoryRouter.use(directory.vaultDirectoryPath); },
      resumeSession: (path, directory) => this.directoryRouter.resume(path, directory.vaultDirectoryPath),
      createSession: (directory) => this.directoryRouter.create(directory.vaultDirectoryPath),
      deleteSession: async (path) => {
        await this.storedSessions.delete(path);
        this.plugin.notifySessionDirectoryChanged();
      },
      runAdvancedAction: (path, action) => this.storedSessionActions.run(path, action),
      onOpened: () => { this.viewMode = "session-picker"; this.renderViewMode(); },
      onClosed: () => {
        if (this.viewMode === "session-picker") this.viewMode = "chat";
        this.renderViewMode();
        this.renderActiveTab();
        this.focusComposerSoon();
      },
      onComplete: () => this.viewNavigation.replace({ mode: "chat" }),
    });
    this.liveStats = new LiveStatsController({
      getTransport: () => this.getTransport(),
      getSessionState: () => this.sessionState,
      onChange: () => this.toolbar?.renderStatus(),
    });
    this.slashCommands = new SlashCommandController({
      sendPrompt: async (text, attachments) => { await this.sendPrompt(text, attachments); },
      sendRawPrompt: (text) => this.sendRawPrompt(text),
      renderFeedback: (input, guidance) => this.getFeedStore().dispatch({ type: "feed.local-feedback-appended", input, guidance }),
      notify: (message) => { new Notice(message); },
      isVaultDirectory: (path) => this.isVaultDirectoryPath(path),
      normalizeVaultDirectory: (path) => normalizeVaultDirectoryInput(path),
      openPermissions: (parsed) => this.executePermissionSystemSlash(parsed),
      openMemory: () => this.openMemoryScreen(),
      openSubagents: () => this.openSubagentSessionsScreen(),
      openEvents: () => this.openEventsScreen(),
      openQueries: () => this.openQueriesScreen(),
      compact: (parsed) => this.executeCompactSlash(parsed),
      createSession: (parsed) => this.executeNewSlash(parsed),
      setWorkingDirectory: (parsed) => this.executeCwdSlash(parsed),
      resumeSession: () => this.commandResumeSession(),
      forkSession: () => this.commandFork(),
      cloneSession: () => this.commandClone(),
      reload: () => this.executeReloadSlash(),
      abort: () => this.turnAbort.request(),
      bash: (parsed) => this.executeBashSlash(parsed),
      setModel: (parsed) => this.executeSetModelSlash(parsed),
      setThinking: (parsed) => this.executeSetThinkingSlash(parsed),
      exportSession: (kind, parsed) => this.executeExportSlash(kind, parsed),
      startBackend: () => this.plugin.startBackend(),
      stopBackend: () => this.plugin.stopBackend(),
    });
    this.overlayScreens = createChatViewOverlayScreens({
      getHost: () => this.shell.sessionPickerHostEl,
      getFrontendStore: () => this.frontendStore,
      getFrontendProtocol: () => this.frontendProtocol,
      prepareOpen: () => {
        this.prepareExclusiveSurface("overlays");
      },
      onOpened: (mode) => { this.viewMode = mode; this.renderViewMode(); },
      onClosed: (mode, renderChat) => this.finishOverlayClose(mode, renderChat),
    });
    const subagents = createChatViewSubagentControllers({
      getHost: () => this.shell.sessionPickerHostEl,
      getFrontendStore: () => this.frontendStore,
      getFrontendProtocol: () => this.frontendProtocol,
      prepareOpen: () => {
        this.prepareExclusiveSurface("subagents");
      },
      onOpened: () => { this.viewMode = "subagents"; this.renderViewMode(); },
      onClosed: (renderChat) => this.finishOverlayClose("subagents", renderChat),
      openPermissions: () => this.openPermissionPolicyScreen(),
      getActiveActorId: () => {
        const state = this.viewNavigation.state();
        return state.mode === "subagents" && state.feedOnly && state.runId && state.nodeId
          ? subagentActorId(state.runId, state.nodeId)
          : "main";
      },
      openMainAgent: () => this.navigateTo({ mode: "chat" }),
      openAgentFeed: (runId, nodeId) => this.openSubagentSessionsScreen(runId, "runs", nodeId, true),
      openAgentHistory: () => this.openSubagentSessionsScreen(),
      createFeedHost: (getFeedStore) => this.createFeedHost(getFeedStore),
    });
    this.subagentScreen = subagents.screen;
    this.sessionAgentRail = subagents.rail;
    this.channelScreen = new ChannelScreenController({
      getHost: () => this.shell.sessionPickerHostEl,
      getStore: () => this.frontendStore,
      getProtocol: () => this.frontendProtocol,
      prepareOpen: () => {
        this.prepareExclusiveSurface("channels");
      },
      onOpened: () => { this.viewMode = "channels"; this.renderViewMode(); },
      onClosed: (renderChat) => this.finishOverlayClose("channels", renderChat),
      openAgentFeed: (reference) => this.openAgentReference(reference),
    });
    this.connectionRestoration = new ConnectedViewRestorationController({
      isCurrent: (transport) => transport === this.boundTransport && transport.isConnected,
      restoreSession: () => this.activateSessionContext(),
      synchronizeFrontend: (transport) => this.frontendProtocol.synchronize(transport),
      synchronizeActiveScreen: () => this.synchronizeActiveScreen(),
      markRestored: () => this.connectionStatus.markRestored(),
      reportSessionError: (error) => {
        console.error("Chatobby: leaf session reconnect failed", error); new Notice(`Could not restore this Chatobby session: ${errorMessage(error)}`);
      },
      reportFrontendError: (error) => console.error("Chatobby: frontend bootstrap failed", error),
    });
    this.extensionUi = new ExtensionUiController({
      getFeedStore: () => this.getFeedStore(),
      getFeedRenderer: () => this.feed,
      setComposerText: (text) => this.composer.setText(text),
      getActiveInteraction: () => this.sessions.activeInteraction(),
      setActiveInteraction: (interaction) => this.setActiveInteraction(interaction),
    });
    this.turnAbort = new TurnAbortController({
      cancelInteractions: () => this.extensionUi.cancelAll(),
      getTransport: () => this.getTransport(),
      setStopping: (stopping) => this.composer?.setStopping(stopping),
      reportError: (error) => { new Notice(`Could not stop the current turn: ${String(error)}`); },
    });
    this.connectionStatus = new ConnectionStatusController(() => this.getFeedStore());
    this.sessionPreferences = new SessionPreferenceController({
      remember: (patch) => this.plugin.rememberSessionPreferences(patch),
      refreshControls: () => this.composerControls.refresh(),
      getComposer: () => this.frontendStore.snapshot?.composer ?? null,
      applyRuntimeControl: (id, value) => this.applyFrontendControl(id, value),
    });
  }
  private get sessionState(): SessionState { return this.sessions.sessionState; }
  private set sessionState(state: SessionState) { this.sessions.sessionState = state; }
  private getTransport(): ChatobbyTransport | null { return this.plugin.getViewTransport(this); }
  private runOperation<T>(descriptor: OperationDescriptor, operation: () => Promise<T>): Promise<T> { return this.operations.run(descriptor, operation); }
  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return "Chatobby"; }
  getIcon(): string { return "message-circle"; }
  getWorkingDirectoryPath(): string { return this.sessions.workingDirectoryPath(); }
  hasSessionPath(sessionPath: string): boolean { return this.sessions.allTabs().some((tab) => tab.sessionFile === sessionPath); }
  async activateSessionContext(): Promise<void> {
    if (!this.componentsReady || !this.stateHydrated) return;
    const transport = this.getTransport();
    if (!transport?.isConnected) return;
    if (this.pendingSessionPath) {
      const sessionPath = this.pendingSessionPath;
      this.pendingSessionPath = null;
      try { await this.sessions.restoreSession(sessionPath); } catch (error) { this.pendingSessionPath = sessionPath; throw error; }
    } else {
      await this.sessions.reconcileActiveSession();
    }
    if (this.activeTab()) this.claimSessionOwnership();
  }
  override getState(): Record<string, unknown> {
    return {
      ...this.viewNavigation.state(),
      vaultDirectoryPath: this.sessions.workingDirectoryPath(),
      sessionPath: this.activeTab()?.sessionFile,
    };
  }
  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const leafState = parseLeafSessionState(state);
    const activateSession = shouldActivateLeafSession(
      this.stateHydrated,
      {
        vaultDirectoryPath: this.sessions.workingDirectoryPath(),
        sessionPath: this.activeTab()?.sessionFile,
      },
      leafState,
    );
    if (leafState.vaultDirectoryPath !== undefined) {
      this.sessions.restoreWorkingDirectory(leafState.vaultDirectoryPath);
    }
    if (leafState.sessionPath && leafState.sessionPath !== this.activeTab()?.sessionFile) {
      this.pendingSessionPath = leafState.sessionPath;
    }
    const navigation = parseNavigationState(state);
    result.history = this.viewNavigation.shouldRecordHistory(navigation);
    this.pendingNavigation = navigation;
    this.stateHydrated = true;
    if (!this.componentsReady) return;
    // Feature screens are session-bound. Refresh the frontend bootstrap before
    // their controllers issue a screen request, or the request can race a
    // concurrent bootstrap and remain pending until the user refreshes again.
    if (activateSession) await this.activateSessionContext();
    await this.viewNavigation.apply(navigation);
  }
  onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string): void {
    super.onPaneMenu(menu, source);
    menu.addItem((item) => item
      .setTitle("Toggle conversation source view")
      .setIcon("file-text")
      .onClick(() => this.feed?.toggleSourceViewMode()));
  }
  async onOpen(): Promise<void> {
    this.buildComponents();
    this.componentsReady = true;
    this.sessionTransition.open();
    this.unsubscribeFrontendStore = this.frontendStore.subscribe((snapshot) => this.frontendSnapshots.schedule(snapshot));
    await this.plugin.registerChatView(this);
    await this.activateSessionContext();
    await this.viewNavigation.apply(this.pendingNavigation);
    this.plugin.setChatViewVisible(this, true);
    this.contentEl.addEventListener("keydown", this.handleViewKeydown, true);
    this.contentEl.addEventListener("chatobby:open-subagents", this.handleOpenSubagents);
    this.contentEl.addEventListener("chatobby:open-channels", this.handleOpenChannels);
    this.bindCurrentTransport();
    this.runtimeLifecycle.open();
    this.focusComposerSoon();
  }

  async onClose(): Promise<void> {
    this.componentsReady = false;
    this.plugin.setChatViewVisible(this, false);
    this.runtimeLifecycle.close();
    this.contentEl.removeEventListener("keydown", this.handleViewKeydown, true);
    this.contentEl.removeEventListener("chatobby:open-subagents", this.handleOpenSubagents);
    this.contentEl.removeEventListener("chatobby:open-channels", this.handleOpenChannels);
    this.unsubscribeConnection?.();
    this.unsubscribeConnection = null;
    this.unsubscribeFrontendStore?.();
    this.unsubscribeFrontendStore = null;
	this.frontendSnapshots.destroy();
	this.pendingFeedCatchup = false;
    this.frontendProtocol.destroy();
    this.boundTransport = null;
    this.liveStats.dispose();
    this.extensionUi.dispose();
    this.tabBar.destroy();
    this.toolbar.destroy();
    this.sessionPickerMode.destroy();
    this.overlayScreens.destroy();
    this.subagentScreen.destroy();
    this.channelScreen.destroy();
    this.sessionAgentRail.destroy();
    this.feed?.clear();
    this.composerControls.destroy();
    this.runtimeStatus.destroy();
    this.runtimeStatusMenu.destroy();
    this.runtimeUpdate.destroy();
    this.sessionTransition.destroy();
    this.shell.dispose();
    await this.plugin.unregisterChatView(this);
  }

  // ── Command surface (command palette + obsidian:// URI handler) ──

  /** Focus the composer textarea. */
  focusComposer(): void {
    if (this.viewMode === "chat") this.composer.focus();
    else if (this.viewMode === "subagents") this.subagentScreen.focusComposer();
  }
  /** Replace the composer text (used by the obsidian:// prompt handler). */
  setComposerText(text: string): void {
    this.composer.setText(text);
  }
  /** Re-render the composer controls after a preference/model change. */
  refreshPreferences(): void {
    this.composerControls.refresh();
  }
  async cycleModel(): Promise<void> { await this.sessionPreferences.cycleModel(); }
  async cycleThinking(): Promise<void> { await this.sessionPreferences.cycleThinking(); }

  /** Apply plugin-level feed display settings without requiring a view reload. */
  refreshDisplaySettings(): void {
    this.feed?.refreshDisplaySettings();
  }
  /** Create a fresh session (command palette). */
  async commandNewSession(): Promise<void> {
		await this.plugin.openBlankView(this.sessions.workingDirectoryPath());
  }
  /** Resume a persisted session from the current backend cwd. */
  async commandResumeSession(): Promise<void> {
    this.navigateTo({ mode: "session-picker" });
  }
  /** Choose the vault directory used by later new-session and resume actions. */
  async commandSetWorkingDirectory(rawVaultDirectoryPath?: string): Promise<void> {
    if (rawVaultDirectoryPath === undefined) {
      this.navigateTo({ mode: "session-picker" });
      return;
    }
    await this.directoryRouter.use(rawVaultDirectoryPath).catch((error) => {
      console.error("Chatobby: set working directory failed", error);
      new Notice(`Could not set working directory: ${String(error)}`);
    });
  }

  /** Legacy entry point kept for existing registrations during hot reload. */
  commandNewSessionInDirectory(): void {
    void this.commandSetWorkingDirectory();
  }
  /** Send the current composer text (command palette / URI handler). */
  commandSendPrompt(): void {
    this.composer.send();
  }
  /** Abort the current generation (command palette). */
  commandAbort(): void {
    this.turnAbort.request();
  }

  /** Trigger context compaction (command palette), optionally with a custom focus. */
  async commandCompact(customInstructions?: string): Promise<void> {
    await this.sessions.compactContext(customInstructions);
  }

  /** Rename the active session (set_session_name). */
  async commandRenameSession(): Promise<void> { await this.activeSessionActions.rename(); }

  /** Duplicate the current session (clone). */
  async commandClone(): Promise<void> { await this.activeSessionActions.clone(); }

  /** Fork from a chosen conversation point (fork + get_fork_messages). */
  async commandFork(): Promise<void> { await this.activeSessionActions.fork(); }

  /** Import a session from a JSONL file (import_jsonl). */
  async commandImportJsonl(): Promise<void> { await this.activeSessionActions.importJsonl(); }

  /** Export the session as HTML (export_html). */
  async commandExportHtml(): Promise<void> {
    await this.activeSessionActions.export("html");
  }

  /** Export the session as JSONL (export_jsonl). */
  async commandExportJsonl(): Promise<void> {
    await this.activeSessionActions.export("jsonl");
  }

  /** Run a one-off bash command and feed its result into the agent context (bash). */
  async commandBash(): Promise<void> {
    const transport = this.getTransport();
    if (!transport?.isConnected) return void new Notice("Chatobby is not connected; cannot run a command yet.");
    const command = await promptText(this.app, { title: "Run bash command", placeholder: "command…", submitLabel: "Run", multiline: true });
    if (!command || !command.trim()) return;
    try {
      const result = await transport.bash(command, false);
      this.copyToClipboard(result.output);
      new Notice(`Ran command — exit ${result.exitCode ?? "?"}${result.truncated ? " (truncated)" : ""}. Output copied.`);
    } catch (e) {
      console.error("Chatobby: bash failed", e);
      new Notice(`Bash failed: ${String(e)}`);
    }
  }

  /** Copy the last assistant response to the clipboard (get_last_assistant_text). */
  async commandCopyLastResponse(): Promise<void> {
    const transport = this.getTransport();
    if (!transport?.isConnected) return void new Notice("Chatobby is not connected; cannot copy the last response yet.");
    try {
      const text = await transport.getLastAssistantText();
      if (text) {
        this.copyToClipboard(text);
        new Notice("Copied last response.");
      } else {
        new Notice("No assistant response to copy.");
      }
    } catch (e) {
      console.error("Chatobby: getLastAssistantText failed", e);
    }
  }

  async commandToggleAutoCompaction(): Promise<void> { await toggleAutoCompaction(this.autoCompactionAction()); }
  async commandReload(): Promise<void> {
    await this.sessions.runSessionTransition("Reloading Chatobby", async () => {
      const transport = await this.ensureConnectedTransport();
      if (!transport) return;
      await transport.reload();
    });
  }

  /** Queue a follow-up message for the next turn (follow_up). */
  async commandQueueFollowUp(): Promise<void> {
    const transport = this.getTransport();
    if (!transport?.isConnected) return void new Notice("Chatobby is not connected; cannot queue a follow-up yet.");
    const message = await promptText(this.app, { title: "Queue follow-up message", placeholder: "message…", submitLabel: "Queue", multiline: true });
    if (!message || !message.trim()) return;
    const trimmed = message.trim();
    await deliverQueuedMessage(this.getFeedStore(), "followUp", trimmed, transport.followUp.bind(transport));
  }

  // ── Component wiring ────────────────────────────────────────────

  private buildComponents(): void {
    // 1. Build static shell
    const handlers: ShellHandlers = {
      submit: () => this.composer.send(),
      interrupt: () => this.composer.stop(),
      input: () => this.composer.handleInput(),
      inputKeydown: (e) => this.composer.handleKeydown(e),
    };
    this.shell = buildViewShell(this.contentEl, handlers);

    // 2. Create components
    this.tabBar = new TabBar({
      workingDirectoryLabel: () => workingDirectoryLabel(
        this.sessions.workingDirectoryPath(),
        this.app.vault.getName(),
      ),
			activeMode: () => ribbonModeForNavigation(this.viewMode, this.viewNavigation.state()),
			onReturnToChat: () => this.viewNavigation.reset(),
			onCreateView: () => this.onCreateTab(),
			onNavigate: (mode) => this.navigateTo({ mode }),
      onSetWorkingDirectory: () => this.onSetWorkingDirectory(),
    });

    this.toolbar = new Toolbar({
      getConnectionState: () => this.getTransport()?.state ?? INITIAL_CONNECTION_STATE,
      getRuntimeState: () => this.plugin.getRuntimeState(),
      getSessionState: () => this.sessionState,
      getStats: () => this.liveStats.current(),
      getFeedStore: () => this.getFeedStore(),
      getAutoCompactionSettings: () => this.sessionState.autoCompaction,
      toggleAutoCompaction: () => this.commandToggleAutoCompaction(),
      openAutoCompaction: () => this.openAutoCompactionSettings(),
    });

    this.feed = new FeedRenderer(this.createFeedHost(() => this.getFeedStore()));
    this.taskProgress = new TaskProgress(this.shell.taskProgressHostEl);
    this.sessionTransition = new SessionTransitionCoordinator(
      this.shell.sessionTransitionHostEl,
      this.operations,
      () => this.frontendSnapshots.flush(),
    );

    this.composer = new Composer({
      send: (msg, att, signal, submissionId) => this.sendPrompt(msg, att, signal, submissionId),
      steer: (msg) => this.steerPrompt(msg),
      abort: () => this.turnAbort.request(),
      retractPrompt: (submissionId, message) =>
        retractAcceptedPrompt(this.getTransport(), this.getFeedStore(), submissionId, message),
      canAbort: () => this.getTransport()?.isConnected ?? false,
      getSessionState: () => this.sessionState,
      getSessionPreferences: () => this.plugin.getSessionPreferences(),
      ...createComposerContextHost(() => this.plugin.settings.composerKeybindings, () => this.frontendStore.snapshot?.feed.blocks ?? []),
      getSlashCommands: () => this.slashCommands.catalog(),
      setSlashMatches: (matches) => this.updateSlashMenu(matches),
      setSlashArgumentOptions: (options) => this.updateSlashArgumentMenu(options),
      isSlashOpen: () => this.slashMenu?.isOpen ?? false,
      moveSlash: (delta) => this.slashMenu?.move(delta),
      currentSlashCommand: () => this.slashMenu?.current() ?? null,
      currentSlashArgumentOption: () => this.slashMenu?.currentArgumentOption() ?? null,
      closeSlash: () => this.closeSlashMenu(),
      submitSlashPlan: async (plan, onAccepted) => { this.closeSlashMenu(); await this.slashCommands.submit(plan, onAccepted); },
      isInteractionActive: () => this.extensionUi.isActive(),
      handleInteractionKey: (e) => this.extensionUi.handleKeydown(e),
      updateInteractionText: (text) => this.extensionUi.updateText(text),
      submitInteraction: () => this.extensionUi.submit(),
      cancelInteraction: () => this.extensionUi.cancelActive(),
      focusFeed: () => this.feed?.focusFeed(),
      storeFiles: (files) => this.storeComposerFiles(files),
    });

    this.composerControls = new ComposerControls({
      getViewModel: () => this.frontendStore.snapshot?.composer ?? null,
      applyControl: (id, value) => this.applyFrontendControl(id, value),
      isBackendAvailable: () => this.isBackendAvailable(),
    });
    this.runtimeStatus = new RuntimeStatusController({
      getState: () => this.plugin.getRuntimeState(),
      start: () => this.plugin.startBackend(),
      restart: () => this.plugin.restartRuntime(),
      install: async (repair) => this.plugin.openRuntimeInstaller(repair),
    });
    this.runtimeStatusMenu = new RuntimeStatusMenu({
      getState: () => this.plugin.getRuntimeState(),
      hasActiveWork: () => this.sessionState.isStreaming || this.sessionState.isCompacting,
      restart: () => this.plugin.restartRuntime(),
      stop: () => this.plugin.stopBackend(),
      supportsRuntimeUpdates: () => this.plugin.isReleaseBuild(),
      manageRuntime: (repair) => this.plugin.openRuntimeInstaller(repair),
    });
    this.runtimeUpdate = new RuntimeUpdateController({
      getState: () => this.plugin.getRuntimeUpdateState(),
      onStateChange: (listener) => this.plugin.onRuntimeUpdateStateChange(listener),
      openInstaller: () => this.plugin.openRuntimeInstaller(),
    });

    this.tabBar.render(this.shell.tabBarHostEl);
    this.sessionAgentRail.render(this.shell.subagentRailHostEl);
    this.runtimeStatus.bind(this.shell.runtimeStatusHostEl);
    this.runtimeStatusMenu.bind(this.shell.connectionEl);
    this.runtimeUpdate.bind(this.shell.runtimeUpdateHostEl);
    this.toolbar.bind(this.shell.connectionEl, this.shell.statsEl);
    this.feed.bind(this.shell.feedEl);
    this.composer.bind(this.shell.inputEl, this.shell.sendBtn, this.shell.stopBtn, this.shell.inputHighlightEl);
    this.composerControls.render(this.shell.composerControlsEl);
    this.slashMenu = new SlashMenu();
    this.slashMenu.render(this.shell.slashMenuEl);

    this.feed.renderEmptyState();
    this.composerControls.refresh();
    this.renderViewMode();
  }

  private createFeedHost(getFeedStore: () => FeedStore): FeedHost {
    return createChatViewFeedHost(this, getFeedStore);
  }

  feedAutoScroll(): boolean { return this.plugin.settings.autoScroll; }
  feedThinkingDisplay(): typeof this.plugin.settings.thinkingDisplay { return this.plugin.settings.thinkingDisplay; }

  hasActiveWork(): boolean { return this.sessionState.isStreaming || this.sessionState.isCompacting; }
  /** Whether the vault runtime and its session transport are ready. */
  private isBackendAvailable(): boolean {
    return this.plugin.getRuntimeState().status === "ready" && (this.getTransport()?.isConnected ?? false);
  }

  // ── Transport connection ────────────────────────────────────────
  private bindCurrentTransport(): void {
    const transport = this.getTransport();
    if (transport === this.boundTransport) {
      return;
    }

    this.unsubscribeConnection?.();
    this.unsubscribeConnection = null;
    this.connectionRestoration.invalidate();
    this.boundTransport = transport;
    this.frontendProtocol.bind(transport);

    if (!transport) {
      this.liveStats.stop();
      this.toolbar.renderStatus();
      return;
    }
    // Subscribe to connection state changes
    this.unsubscribeConnection = transport.onConnectionChange((state) => {
      this.toolbar.renderStatus();
		this.composer?.setStreaming(this.sessionState.isStreaming);
		this.turnAbort.setActivity(this.sessionState.isStreaming || this.sessionState.isCompacting);
      this.composerControls.refresh();
      if (state.status === "connected") {
        this.synchronizeConnectedTransport(transport);
      } else {
        this.connectionRestoration.invalidate();
        this.liveStats.stop();
        if (state.status === "disconnected" || state.status === "error") {
          const interruption = this.sessions.markTransportDisconnected();
          this.connectionStatus.markInterrupted(interruption);
        }
        this.sessionAgentRail.clear();
      }
    });

    this.toolbar.renderStatus();
    if (transport.isConnected) this.synchronizeConnectedTransport(transport);
  }

  private synchronizeConnectedTransport(transport: ChatobbyTransport): void {
    if (transport !== this.boundTransport || !transport.isConnected) return;
    this.connectionRestoration.synchronize(transport);
    void this.liveStats.refresh();
    this.liveStats.sync();
    this.sessionAgentRail.scheduleRefresh();
    if (this.viewMode === "session-picker") this.sessionPickerMode.refresh();
  }
  private synchronizeActiveScreen(): void {
    if (this.viewMode === "channels") this.channelScreen.synchronize();
    else if (this.viewMode === "memory") this.overlayScreens.memory.synchronize();
    else if (this.viewMode === "permissions") this.overlayScreens.permissions.synchronize();
    else if (this.viewMode === "events") this.overlayScreens.events.synchronize();
    else if (this.viewMode === "queries") this.overlayScreens.queries.synchronize();
    else if (this.viewMode === "subagents") this.subagentScreen.synchronize();
  }
  private handleRuntimeStateChange(): void {
    this.bindCurrentTransport();
    this.runtimeStatus.render();
    this.toolbar.renderStatus();
    this.composerControls.refresh();
    if (this.plugin.getRuntimeState().status === "ready" && this.viewMode === "session-picker") {
      this.sessionPickerMode.refresh();
    }
  }
  private async sendPrompt(
    message: string,
    attachments?: WsPromptAttachment[],
    signal?: AbortSignal,
    submissionId?: string,
  ): Promise<void | PromptSubmissionOutcome> {
    this.closeSlashMenu();
    const transport = await this.ensureConnectedTransport();
    if (!transport) throw new Error("Chatobby runtime is unavailable");
    if (signal?.aborted) return;

    await this.sessions.ensureActiveSessionTarget();
    if (signal?.aborted) return;

    const workspaceContext = {
      workingDirectory: this.sessions.workingDirectoryPath() || ".",
      sessionMessageCount: this.sessionState.messages.length,
      sessionName: this.activeTab()?.name,
      permissionMode: this.activeTab()?.permissionMode ?? this.plugin.getSessionPreferences().permissionMode,
    };
    try {
      const outcome = await submitPrompt({
        transport,
        feedStore: this.getFeedStore(),
        message,
        attachments,
        context: toPromptContextPacket(this.gatherContext(), workspaceContext),
        signal,
        submissionId,
      });
      if (outcome) return outcome;
      void this.plugin.completeOnboarding()
        .then(() => removeOnboardingPanel(this.getFeedStore()))
        .catch((error) => console.error("Chatobby: failed to complete onboarding", error));
    } catch (error) {
      this.renderPromptFailure(message, error);
      throw error;
    }
  }

  private async storeComposerFiles(files: readonly File[]): Promise<ComposerAttachment[]> {
    const draftId = this.sessionState.sessionId ?? `draft-${Date.now()}`;
    return Promise.all(files.map((file) => storeComposerFile(this.app, file, draftId)));
  }
  private async sendRawPrompt(message: string, options: { startRun?: boolean } = {}): Promise<void> {
    this.closeSlashMenu();
    const transport = await this.ensureConnectedTransport();
    if (!transport) return;

    await this.sessions.ensureActiveSessionTarget();

    this.getFeedStore().dispatch({
      type: "feed.user-prompt-submitted",
      text: message,
      startRun: options.startRun !== false,
    });

    await withTimeout(transport.prompt(message), PROMPT_START_TIMEOUT_MS, "Slash prompt did not start")
      .catch((e) => this.renderPromptFailure(message, e));
  }

  private async ensureConnectedTransport(
    action = "sending a prompt",
    showNotice = true,
  ): Promise<ReturnType<ChatobbyPlugin["createTransport"]> | null> {
    try {
      const transport = await this.runtimeLifecycle.ensureTransport();
      if (!transport) {
        if (showNotice) new Notice(`Could not prepare Chatobby before ${action}.`);
        return null;
      }
      if (!transport.isConnected) {
        if (showNotice) new Notice(`Could not connect to Chatobby before ${action}.`);
        return null;
      }
      return transport;
    } catch (error) {
      console.error(`Chatobby: failed to prepare runtime before ${action}`, error);
      if (showNotice) new Notice(`Could not prepare Chatobby before ${action}.`);
      return null;
    }
  }

  private renderPromptFailure(input: string, error: unknown): void {
    const message = errorMessage(error);
    console.error("Chatobby: prompt failed:", error);
    this.getFeedStore().dispatch({
      type: "feed.local-feedback-appended",
      input: input.trim(),
      guidance: `Prompt failed: ${message}`,
    });
    new Notice(`Chatobby prompt failed: ${message}`);
  }

  private async applyFrontendControl(
    id: Exclude<FrontendChoiceControl["id"], "provider">,
    value: string,
  ): Promise<void> {
    const snapshot = this.frontendStore.snapshot;
    if (!snapshot?.session) throw new Error("No active Chatobby session");
    const payload = id === "model"
      ? { model: value }
      : id === "effort"
        ? { thinkingLevel: requireThinkingLevel(value) }
        : { permissionProfileId: value || null };
    const result = await this.frontendProtocol.dispatch({
      schemaVersion: FRONTEND_SCHEMA_VERSION,
      intentId: globalThis.crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session.id,
      expectedRevision: snapshot.revision,
      type: "session.update-preferences",
      payload,
    });
    if (result.status !== "completed" && result.status !== "accepted") {
      throw new Error(result.notice?.message ?? "Chatobby rejected the session preference change");
    }
    if (id === "model") await this.plugin.rememberSessionPreferences({ model: value });
    else if (id === "effort") await this.plugin.rememberSessionPreferences({ thinkingLevel: requireThinkingLevel(value) });
  }

  private async dispatchFrontendSessionIntent(request: SessionMutationRequest): Promise<boolean> {
    const transport = await this.ensureConnectedTransport("changing the session");
    if (!transport) throw new Error("Chatobby runtime is not connected");
    await this.frontendProtocol.synchronize(transport);
    const snapshot = this.frontendStore.snapshot;
    if (!snapshot) throw new Error("Chatobby frontend state is unavailable");
    const result = await this.frontendProtocol.dispatch({
      schemaVersion: FRONTEND_SCHEMA_VERSION,
      intentId: globalThis.crypto.randomUUID(),
      viewId: snapshot.viewId,
      mainSessionId: snapshot.session?.id,
      expectedRevision: snapshot.revision,
      ...request,
    } as FrontendIntent);
    if (result.status === "completed" || result.status === "accepted") return true;
    if (result.status === "rejected" && result.notice?.level === "info") return false;
    throw new Error(result.notice?.message ?? "Chatobby rejected the session change");
  }

  private applyFrontendSnapshot(snapshot: FrontendBootstrap, applied: FrontendBootstrap | null): void {
    const session = snapshot.session;
    const previous = this.sessionState;
    const sessionChanged = applied?.session !== session;
    const sessionDirectoryChanged = sessionChanged && sessionDirectoryProjectionChanged(applied?.session, session);
    const feedChanged = applied?.feed !== snapshot.feed;
    const composerChanged = applied?.composer !== snapshot.composer;
    const agentRailChanged = applied?.agentRail !== snapshot.agentRail;
    const commandsChanged = applied?.localCommands !== snapshot.localCommands;
    const taskPlanChanged = applied?.taskPlan !== snapshot.taskPlan;
    if (session && sessionChanged) {
      this.sessions.applyRuntimeSession(session);
    }
	if (feedChanged) {
		if (this.viewMode === "chat") this.synchronizeFrontendFeed(snapshot);
		else this.pendingFeedCatchup = true;
		this.composer?.observeTurnProgress();
	}
    if (sessionChanged && previous.isStreaming !== (session?.streaming ?? false)) {
      this.getFeedStore().dispatch({
        type: "feed.runtime-activity-synchronized",
        active: session?.streaming ?? false,
      });
    }
    if (agentRailChanged) this.sessionAgentRail.setModel(snapshot.agentRail);
    if (commandsChanged) this.slashCommands.setRuntimeCommands(snapshot.localCommands);
    if (taskPlanChanged) this.taskProgress.setModel(snapshot.taskPlan);
    if (composerChanged) this.composerControls?.refresh();
	if (sessionChanged) {
		this.composer?.setStreaming(session?.streaming ?? false);
		this.turnAbort.setActivity(Boolean(session?.streaming || session?.compacting));
	}
    if (session && sessionChanged) {
      if (!previous.isStreaming && session.streaming) this.liveStats.start();
      if (previous.isStreaming && !session.streaming) {
        this.liveStats.stop();
        void this.liveStats.refresh();
      }
      if (!previous.isCompacting && session.compacting) this.liveStats.start();
      if (previous.isCompacting && !session.compacting) this.liveStats.sync();
      if (previous.thinkingLevel !== session.thinkingLevel) {
        void this.plugin.rememberSessionPreferences({ thinkingLevel: session.thinkingLevel });
      }
      const retry = session.retryStatus;
      const retryKey = retry ? `${retry.terminal}:${retry.attempt}:${retry.maxAttempts}:${retry.message}` : null;
      if (retry && retryKey && retryKey !== this.lastRetryNoticeKey) {
        new Notice(retry.terminal
          ? `Chatobby retry failed: ${retry.message}`
          : `Chatobby retrying — attempt ${retry.attempt}/${retry.maxAttempts}: ${retry.message}`);
      }
      this.lastRetryNoticeKey = retryKey;
    }
    if (sessionChanged) {
      this.toolbar?.renderFlags();
      this.liveStats.sync();
    }
    if (sessionDirectoryChanged) this.plugin.notifySessionDirectoryChanged();
  }

  /** Public entry point — refresh models and controls after a provider key change. */
  refreshAvailableModels(): void {
    const transport = this.getTransport();
    if (transport?.isConnected) void this.frontendProtocol.synchronize(transport);
  }

  /** Send a mid-generation steer (a correction to the running turn). Rendered immediately as a
   *  queued block whose ack state (pending→queued→applied) advances via queue_update. */
  private async steerPrompt(message: string): Promise<void> {
    const transport = this.getTransport();
    if (!transport?.isConnected) return;
    await deliverQueuedMessage(this.getFeedStore(), "steer", message, transport.steer.bind(transport));
  }

  private async executePermissionSystemSlash(parsed: SlashParsedCommand): Promise<void> {
    await routePermissionSlash(parsed, {
      openPermissions: () => this.openPermissionPolicyScreen(),
      sendRawPrompt: (text) => this.sendRawPrompt(text),
      renderFeedback: (input, guidance) => this.getFeedStore().dispatch({ type: "feed.local-feedback-appended", input, guidance }),
    });
  }

  private openPermissionPolicyScreen(): void {
    this.navigateTo({ mode: "permissions" });
  }

  handleExtensionPanelAction(action: ExtensionPanelAction): void {
		if (action.id.startsWith("subagent-permission:")) {
			void this.decideSubagentPermission(action.id);
			return;
		}
		if (action.id.startsWith("memory-candidate:")) {
			void this.decideMemorySuggestion(action.id);
			return;
		}
    routeExtensionPanelAction(action, {
      openPermissions: () => this.openPermissionPolicyScreen(),
      openMemory: (actionId) => this.overlayScreens.memory.openFromExtensionAction(actionId),
      openSubagents: (tab) => this.openSubagentSessionsScreen(undefined, tab),
		openSettings: () => this.plugin.openSettings(),
    });
  }

	private async decideMemorySuggestion(actionId: string): Promise<void> {
		const match = /^memory-candidate:(approve|reject):(.+)$/u.exec(actionId);
		if (!match?.[1] || !match[2]) return;
		await this.dispatchNoticeIntent({
			type: "memory.decide-candidate",
			payload: { candidateId: match[2], decision: match[1] === "approve" ? "approve" : "reject" },
		});
	}

	private async decideSubagentPermission(actionId: string): Promise<void> {
		const payload = await resolveSubagentPermissionAction(this.app, actionId);
		if (!payload) return;
		await this.dispatchNoticeIntent({
			type: "subagent.decide-permission",
			payload,
		});
	}

	private async dispatchNoticeIntent(
		input: Pick<Extract<FrontendIntent, { type: "memory.decide-candidate" | "subagent.decide-permission" }>, "type" | "payload">,
	): Promise<void> {
		const snapshot = this.frontendStore.snapshot;
		if (!snapshot) return void new Notice("Chatobby frontend is not initialized.");
		const result = await this.frontendProtocol.dispatch({
			schemaVersion: 1,
			intentId: crypto.randomUUID(),
			viewId: snapshot.viewId,
			mainSessionId: snapshot.session?.id,
			expectedRevision: snapshot.revision,
			...input,
		} as FrontendIntent);
		if (result.status === "rejected" || result.status === "conflict") {
			new Notice(result.notice?.message ?? "The request could not be updated.");
		}
	}

  private openMemoryScreen(): void {
    this.navigateTo({ mode: "memory" });
  }

  private openEventsScreen(): void {
    this.navigateTo({ mode: "events" });
  }

  private openQueriesScreen(): void {
    this.navigateTo({ mode: "queries" });
  }

  private openSubagentSessionsScreen(runId?: string, tab: SubagentScreenTab = "runs", nodeId?: string, feedOnly = false): void {
    this.navigateTo({ mode: "subagents", runId, nodeId, subagentTab: tab, feedOnly });
  }

  private openAutoCompactionSettings(): void {
    const model = this.sessionState.model || this.plugin.getSessionPreferences().model || "";
    openAutoCompactionSettings(this.app, model, this.autoCompactionAction());
  }

  private autoCompactionAction(): AutoCompactionActionOptions {
    return {
      transport: this.getTransport(),
      settings: this.sessionState.autoCompaction,
      apply: (settings) => {
        this.sessionState = applySessionEvent(this.sessionState, { type: "auto_compaction", settings });
        this.composerControls.refresh();
        this.toolbar.renderStatus();
      },
      runMutation: (operation) => this.runOperation(
        { key: "session-state", id: "session:auto-compaction", label: "Updating automatic compaction" },
        operation,
      ),
    };
  }

  private async executeBashSlash(parsed: SlashParsedCommand): Promise<void> {
    const transport = await this.ensureConnectedTransport();
    if (!transport) return;
    const command = parsed.args[0];
    if (!command) {
      new Notice("/bash requires a command.");
      return;
    }
    const result = await transport.bash(command, false);
    this.copyToClipboard(result.output);
    new Notice(`Ran command — exit ${result.exitCode ?? "?"}${result.truncated ? " (truncated)" : ""}. Output copied.`);
  }

  private async executeNewSlash(_parsed: SlashParsedCommand): Promise<void> {
		await this.commandNewSession();
  }

  private async executeCwdSlash(parsed: SlashParsedCommand): Promise<void> {
    const rawDirectory = parsed.args[0]?.trim();
    await this.commandSetWorkingDirectory(rawDirectory || undefined);
  }

  private async executeCompactSlash(parsed: SlashParsedCommand): Promise<void> {
    const focus = parsed.args[0]?.trim();
    await this.commandCompact(focus || undefined);
  }

  private async executeReloadSlash(): Promise<void> { await this.commandReload(); }

  private async executeSetModelSlash(parsed: SlashParsedCommand): Promise<void> {
    const model = parsed.args[0];
    if (!model) return;
    await this.sessionPreferences.apply({ model });
  }

  private async executeSetThinkingSlash(parsed: SlashParsedCommand): Promise<void> {
    const level = parsed.args[0];
    if (!level || !isThinkingLevel(level)) return;
    await this.sessionPreferences.apply({ thinkingLevel: level });
  }

  private async executeExportSlash(kind: "html" | "jsonl", parsed: SlashParsedCommand): Promise<void> {
    const transport = await this.ensureConnectedTransport();
    if (!transport) return;
    const path = parsed.args[0]?.trim() || undefined;
    const out = await this.runOperation(
      { key: "session-maintenance", id: `session:export-${kind}`, label: `Exporting session as ${kind.toUpperCase()}` },
      () => kind === "html" ? transport.exportHtml(path) : transport.exportJsonl(path),
    );
    new Notice(`Exported to ${out}`);
  }

  /** Show/hide the slash menu based on cursor-local composer token matches. */
  private updateSlashMenu(matches: readonly SlashCommandSpec[]): void {
    if (!this.slashMenu) return;
    if (matches.length === 0) {
      this.closeSlashMenu();
      return;
    }
    this.slashMenu.setMatches(matches);
    this.shell.slashMenuEl.removeClass("is-hidden");
  }

  private updateSlashArgumentMenu(options: readonly SlashArgumentOption[]): void {
    if (!this.slashMenu) return;
    if (options.length === 0) {
      this.closeSlashMenu();
      return;
    }
    this.slashMenu.setArgumentOptions(options);
    this.shell.slashMenuEl.removeClass("is-hidden");
  }

  private closeSlashMenu(): void {
    this.slashMenu?.setMatches([]);
    this.shell.slashMenuEl.addClass("is-hidden");
  }

  getFeedStore(): FeedStore {
    return this.sessions.feedStore();
  }

  scrollFeed(): void {
    this.shell.feedEl.scrollTo({ top: this.shell.feedEl.scrollHeight });
  }

  openVaultLink(path: string): void {
    void this.app.workspace.openLinkText(path, "", "tab");
  }

  openSystemPath(path: string): void {
    openSystemPathExternally(this.app, path);
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch((e) => {
      console.error("Chatobby: clipboard write failed", e);
    });
  }

  onAutoScrollChange(enabled: boolean): void {
    this.plugin.updateSettings({ autoScroll: enabled }).catch((e) => {
      console.error("Chatobby: failed to save auto-scroll setting", e);
    });
  }

  onCompactionRequest(): void {
    this.commandCompact().catch((e) => {
      console.error("Chatobby: compaction request failed", e);
    });
  }

  tabs(): SessionTab[] {
    return this.sessions.allTabs();
  }

  activeTabId(): string | null {
    return this.sessions.activeTabId();
  }

  onCreateTab(): void {
		void this.plugin.openBlankView(this.sessions.workingDirectoryPath()).catch((e) => {
			console.error("Chatobby: create view failed", e);
    });
  }

  onSetWorkingDirectory(): void {
    void this.commandSetWorkingDirectory();
  }

  onSwitchTab(id: string): void {
    this.switchToSession(id).catch((e) => {
      console.error("Chatobby: switch tab failed", e);
    });
  }

  onCloseTab(id: string): void {
    void this.sessions.closeTab(id).catch((error) => {
      console.error("Chatobby: close session tab failed", error);
      new Notice(`Could not close session: ${errorMessage(error)}`);
    });
  }

  gatherContext(): VaultContext {
    return gatherVaultContext(this.app, { chatobbyVersion: this.plugin.manifest.version });
  }

  activeTab(): SessionTab | null {
    return this.sessions.activeTab();
  }

  private prepareExclusiveSurface(target: ExclusiveViewSurface): void {
    this.closeSlashMenu();
    closeInactiveViewSurfaces(target, {
      sessionPicker: () => this.sessionPickerMode.destroy(),
      overlays: () => this.overlayScreens.closeAll(false),
      subagents: () => this.subagentScreen.close(false),
      channels: () => this.channelScreen.close(false),
    });
  }

  private focusComposerSoon(): void {
    requestAnimationFrame(() => { if (this.app.workspace.getActiveViewOfType(ChatobbyView) === this) this.focusComposer(); });
  }
  private renderViewMode(): void {
    renderShellViewMode(this.shell, this.viewMode, Boolean(this.activeTab()));
		const chatVisible = this.viewMode === "chat";
		const snapshot = this.frontendSnapshots.current();
		if (chatVisible && this.pendingFeedCatchup && snapshot) {
			this.synchronizeFrontendFeed(snapshot);
		}
		this.feed?.setActive(chatVisible);
		this.toolbar?.setActive(chatVisible);
		this.liveStats.setActive(chatVisible);
		this.refreshTabBar();
    this.sessionAgentRail.refresh();
  }
	private synchronizeFrontendFeed(snapshot: FrontendBootstrap): void {
		syncFrontendFeedProjection(this.getFeedStore(), snapshot, this.plugin.settings.onboardingVersion, this.plugin.configuredProviders().length > 0);
		this.pendingFeedCatchup = false;
	}

  private finishOverlayClose(mode: OverlayViewMode | "subagents" | "channels", renderChat: boolean): void {
    if (this.viewMode === mode) this.viewMode = "chat";
    if (!renderChat) return;
    this.navigateTo({ mode: "chat" });
  }

  private navigateTo(state: ChatobbyNavigationState): void {
    this.viewNavigation.navigate(state);
  }

  private isVaultDirectoryPath(directoryPath: string): boolean {
    return this.sessions.isVaultDirectoryPath(directoryPath);
  }

  private claimSessionOwnership(): void {
    this.getTransport()?.onExtensionUI((request) => this.extensionUi.handle(request));
  }

  async createSession(): Promise<void> { await this.directoryRouter.create(this.sessions.workingDirectoryPath()); }

  private resolveWorkingDirectoryScope(action: string): WorkingDirectoryScope | null {
    return this.sessions.resolveWorkingDirectoryScope(action);
  }

  private async handleSessionPickerSelect(sessionPath: string): Promise<void> {
    if (this.hasSessionPath(sessionPath)) {
      await this.sessionTransition.settle();
      return;
    }
    await this.sessions.handleSessionPickerSelect(sessionPath);
  }

  async resumeStoredSession(sessionPath: string): Promise<void> { await this.handleSessionPickerSelect(sessionPath); }

  refreshSessionDirectoryIfOpen(): void {
    if (this.componentsReady && this.viewMode === "session-picker") this.sessionPickerMode.refresh();
  }

  async switchToSession(sessionId: string): Promise<void> {
    await this.sessions.switchToSession(sessionId);
  }

  async ensureAgentFeedTransport(): Promise<ChatobbyTransport | null> { return this.ensureConnectedTransport("opening an agent feed"); }
  async resumeAgentSession(sessionPath: string, vaultDirectoryPath: string): Promise<void> { await this.directoryRouter.resume(sessionPath, vaultDirectoryPath); }
  async openAgentReference(reference: FrontendNavigationReference): Promise<void> { await routeAgentReference(this, reference); }
  openSubagentFeed(runId: string, nodeId: string): void { this.openSubagentSessionsScreen(runId, "runs", nodeId, true); }
  openMainFeed(): void { this.navigateTo({ mode: "chat" }); }

  async refreshActiveSessionState(): Promise<void> {
    await this.sessions.refreshActiveSessionState();
  }

  private setActiveInteraction(interaction: InteractionState | null): void {
    this.sessions.setActiveInteraction(interaction);
  }

  private renderActiveTab(): void {
    this.refreshTabBar();
    // Drop cached per-connection stats before fetching the active session.
    this.liveStats.reset();
    this.toolbar?.renderStatus();
    this.composerControls?.refresh();
	this.composer?.setStreaming(this.sessionState.isStreaming);
	this.turnAbort.setActivity(this.sessionState.isStreaming || this.sessionState.isCompacting);
    this.feed?.switchStore(this.getFeedStore());
    this.sessionAgentRail.scheduleRefresh();
    void this.liveStats.refresh();
    this.liveStats.sync();
  }

  private refreshTabBar(): void {
    this.tabBar?.refresh();
  }
}

function channelNavigationState(event: Event): ChatobbyNavigationState {
  const detail = (event as CustomEvent<{ channelId?: string; messageId?: string }>).detail;
  return { mode: "channels", channelId: detail?.channelId, messageId: detail?.messageId };
}

function requireThinkingLevel(value: string): SessionState["thinkingLevel"] {
  if (!isThinkingLevel(value)) throw new Error(`Invalid thinking level: ${value}`);
  return value;
}
