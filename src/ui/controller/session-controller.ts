import { Notice, type App } from "obsidian";
import type ChatobbyPlugin from "../../main";
import type { InteractionState, SessionState } from "../../types";
import { EMPTY_SESSION_STATE } from "../../types";
import { createSessionTab, type SessionTab } from "../../features/session/public";
import { createFeedStore, type FeedStore } from "../../features/feed/public";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type { FrontendIntent, FrontendSessionViewModel } from "../../vendor/chatobby-client/frontend-contracts.js";
import { TabMap } from "../session/tab-state";
import { vaultDirectoryTabName } from "../session/session-directory";
import { sameWorkingDirectory, WorkingDirectoryController, type WorkingDirectoryScope } from "../session/working-directory-controller";
import { OperationConflictError } from "../../features/operations/public";
import type { ActiveOperation, OperationDescriptor } from "../../features/operations/public";
import type { TransportInterruption } from "./connection-status-controller";
import { disconnectSession } from "../session/session-disconnection";

export type { WorkingDirectoryScope } from "../session/working-directory-controller";

type SessionMutationIntent = Extract<FrontendIntent, {
  type: "session.create" | "session.resume" | "session.clone" | "session.fork" | "session.rename" | "session.import-jsonl";
}>;

export type SessionMutationRequest = SessionMutationIntent extends infer Intent
  ? Intent extends SessionMutationIntent
    ? Pick<Intent, "type" | "payload">
    : never
  : never;

/** Host callbacks needed when one Obsidian leaf changes its runtime session. */
export interface SessionControllerOptions {
  app: App;
  plugin: ChatobbyPlugin;
  getTransport: () => ChatobbyTransport | null;
  refreshTabBar: () => void;
  renderActiveTab: () => void;
  persistLeafState: () => void;
  exitSessionPicker: () => void;
  runOperation: <T>(descriptor: OperationDescriptor, operation: () => Promise<T>) => Promise<T>;
  getActiveOperation: () => ActiveOperation | null;
  claimSessionOwnership: () => void;
  dispatchSessionIntent: (request: SessionMutationRequest) => Promise<boolean>;
  synchronizeFrontend: () => Promise<void>;
}

/**
 * Binds one Obsidian leaf to one runtime-owned session projection.
 * The connector keeps only leaf recovery identity and presentation stores; all
 * session mutations are atomic runtime intents.
 */
export class SessionController {
  private readonly tabs = new TabMap();
  private fallbackSessionState: SessionState = EMPTY_SESSION_STATE;
  private readonly fallbackFeedStore: FeedStore = createFeedStore();
  private fallbackInteraction: InteractionState | null = null;
  private reconnectPromise: Promise<void> | null = null;
  private sessionTargetTransition: Promise<void> | null = null;
  private readonly workingDirectory: WorkingDirectoryController;
  private runtimeMessageCount = 0;

  constructor(private readonly options: SessionControllerOptions) {
    this.workingDirectory = new WorkingDirectoryController(options.app, options.plugin);
  }

  get sessionState(): SessionState {
    return this.activeTab()?.sessionState ?? this.fallbackSessionState;
  }

  set sessionState(state: SessionState) {
    const active = this.activeTab();
    if (active && (!state.sessionId || state.sessionId === active.sessionId)) {
      this.tabs.set({ ...active, sessionState: state });
    } else if (state.sessionId) {
      const tab = createSessionTab(state.sessionId, active ?? undefined);
      this.tabs.reset({ ...tab, sessionState: state });
    } else {
      this.fallbackSessionState = state;
    }
    this.options.refreshTabBar();
  }

  /** Apply the authoritative runtime session read model without reconstructing messages locally. */
  applyRuntimeSession(session: FrontendSessionViewModel): void {
    const previous = this.activeTab();
    const identityChanged = previous?.sessionId !== session.id;
    const tab = identityChanged ? createSessionTab(session.id, previous ?? undefined) : previous ?? createSessionTab(session.id);
    this.tabs.reset({
      ...tab,
      sessionId: session.id,
      sessionFile: session.recoveryPath,
      name: session.name ?? tab.name,
      sessionState: {
        ...tab.sessionState,
        sessionId: session.id,
        model: session.model,
        thinkingLevel: session.thinkingLevel,
        isStreaming: session.streaming,
        isCompacting: session.compacting,
        isRetrying: session.retrying,
      },
    });
    this.runtimeMessageCount = session.messageCount;
    this.options.refreshTabBar();
    // A newly projected runtime session owns a different feed store. Switch the
    // visible renderer immediately so the first prompt and its live patches do
    // not remain hidden in the new store until an unrelated navigation render.
    if (identityChanged) this.options.renderActiveTab();
    if (identityChanged || previous?.sessionFile !== session.recoveryPath || previous?.name !== session.name) {
      this.options.persistLeafState();
    }
  }

  feedStore(): FeedStore { return this.activeTab()?.feedStore ?? this.fallbackFeedStore; }
  allTabs(): SessionTab[] { return this.tabs.all(); }
  activeTab(): SessionTab | null { return this.tabs.active(); }
  activeTabId(): string | null { return this.tabs.activeTabId(); }
  sessionTransitionLabel(): string | null { return this.options.getActiveOperation()?.label ?? null; }
  setTab(tab: SessionTab): void { this.tabs.reset(tab); this.options.refreshTabBar(); }
  hasSessions(): boolean { return this.tabs.all().length > 0; }
  workingDirectoryPath(): string { return this.workingDirectory.current(); }

  restoreWorkingDirectory(rawVaultDirectoryPath: string): void {
    this.workingDirectory.restore(rawVaultDirectoryPath);
    this.options.refreshTabBar();
  }

  async closeTab(id: string): Promise<void> {
    const closing = this.tabs.get(id);
    if (!closing) return;
    if (closing.sessionState.isStreaming || closing.sessionState.isCompacting) {
      new Notice("Stop the active Chatobby operation before closing this session.");
      return;
    }
    await this.createSession();
  }

  setActiveInteraction(interaction: InteractionState | null): void {
    const active = this.activeTab();
    if (active) this.tabs.set({ ...active, activeInteraction: interaction });
    else this.fallbackInteraction = interaction;
  }

  activeInteraction(): InteractionState | null {
    return this.activeTab()?.activeInteraction ?? this.fallbackInteraction;
  }

  isVaultDirectoryPath(directoryPath: string): boolean {
    return this.workingDirectory.isVaultDirectory(directoryPath);
  }

  async setWorkingDirectory(rawVaultDirectoryPath: string): Promise<void> {
    await this.workingDirectory.set(rawVaultDirectoryPath);
    this.options.refreshTabBar();
    this.options.persistLeafState();
  }

  resolveWorkingDirectoryScope(action: string): WorkingDirectoryScope | null {
    return this.workingDirectory.resolve(action);
  }

  async createSession(): Promise<void> {
    await this.runSessionTransition("Creating session", async () => {
      const scope = this.resolveWorkingDirectoryScope("creating a session");
      if (!scope) return;
      const active = this.activeTab();
      if (active && this.isReusableBlankSession(active)) {
        const transport = this.options.getTransport();
        if (transport?.isConnected) {
          const runtimeInfo = await transport.getRuntimeInfo().catch(() => null);
          if (runtimeInfo && sameWorkingDirectory(runtimeInfo.cwd, scope.cwd)) return;
        }
      }
      const preferences = this.options.plugin.getSessionPreferences();
      const changed = await this.options.dispatchSessionIntent({
        type: "session.create",
        payload: {
          cwdOverride: scope.cwd,
          model: preferences.model || undefined,
          thinkingLevel: preferences.thinkingLevel,
          autoNameStrategy: this.options.plugin.settings.autoNameStrategy,
        },
      });
      if (!changed) return;
      const current = this.activeTab();
      if (current && !current.name) {
        this.tabs.set({
          ...current,
          name: vaultDirectoryTabName(scope.vaultDirectoryPath, this.options.app.vault.getName()),
        });
      }
      this.options.claimSessionOwnership();
      this.options.renderActiveTab();
    });
  }

  async restoreSession(sessionPath: string): Promise<void> {
    await this.handleSessionPickerSelect(sessionPath);
  }

  async handleSessionPickerSelect(sessionPath: string): Promise<void> {
    await this.runSessionTransition("Resuming session", async () => {
      const preferences = this.options.plugin.getSessionPreferences();
      const changed = await this.options.dispatchSessionIntent({
        type: "session.resume",
        payload: {
          sessionPath,
          model: preferences.model || undefined,
          thinkingLevel: preferences.thinkingLevel,
        },
      });
      if (!changed) return;
      this.options.claimSessionOwnership();
      this.options.renderActiveTab();
      this.options.exitSessionPicker();
    }).catch((error) => {
      console.error("Chatobby: resume session failed", error);
      new Notice(`Could not resume session: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  async switchToSession(sessionId: string): Promise<void> {
    const target = this.tabs.get(sessionId);
    if (!target || target.sessionId === this.activeTabId()) return;
    if (!target.sessionFile) throw new Error("The target session is missing its recovery path");
    await this.handleSessionPickerSelect(target.sessionFile);
  }

  reconcileActiveSession(): Promise<void> {
    if (this.reconnectPromise) return this.reconnectPromise;
    this.reconnectPromise = this.options.synchronizeFrontend().finally(() => { this.reconnectPromise = null; });
    return this.reconnectPromise;
  }

  async ensureActiveSessionTarget(): Promise<SessionTab> {
    await this.sessionTargetTransition;
    if (!this.activeTab()) await this.createSession();
    else await this.reconcileActiveSession();
    const active = this.activeTab();
    if (!active || this.sessionState.sessionId !== active.sessionId) {
      throw new Error("Chatobby could not establish the visible session as the prompt destination.");
    }
    this.options.claimSessionOwnership();
    return active;
  }

  markTransportDisconnected(): TransportInterruption {
    const active = this.activeTab();
    if (!active) return { hadActiveWork: false, hadInteraction: false };
    const disconnected = disconnectSession(active);
    this.tabs.set(disconnected.tab);
    this.options.renderActiveTab();
    return disconnected.interruption;
  }

  async addCurrentBackendSessionTab(
    _previousTab?: SessionTab,
    _options?: { fallbackName?: string; fallbackSessionState?: SessionState },
  ): Promise<void> {
    await this.options.synchronizeFrontend();
    this.options.claimSessionOwnership();
    this.options.renderActiveTab();
  }

  async refreshActiveSessionState(): Promise<void> {
    await this.options.synchronizeFrontend();
    this.options.persistLeafState();
  }

  runSessionTransition(label: string, operation: () => Promise<void>): Promise<void> {
    const id = `session:${label.toLocaleLowerCase().replaceAll(" ", "-")}`;
    const promise = this.options.runOperation({ key: "session-transition", id, label }, operation);
    this.options.refreshTabBar();
    return promise.catch((error: unknown) => {
      if (error instanceof OperationConflictError) {
        new Notice(error.message);
        return;
      }
      throw error;
    }).finally(() => this.options.refreshTabBar());
  }

  private isReusableBlankSession(tab: SessionTab): boolean {
    return this.runtimeMessageCount === 0 && !tab.sessionState.isStreaming && !tab.sessionState.isCompacting && !tab.activeInteraction;
  }
}
