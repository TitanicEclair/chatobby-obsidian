import { Component, MarkdownRenderer, Notice } from "obsidian";
import type ChatobbyPlugin from "../../main";
import type { ChatobbyNavigationState } from "../controller/view-navigation-controller";
import { WorkspaceConnection } from "./workspace-connection";
import { MemoryScreenController } from "../screens/memory-screen-controller";
import { PermissionsScreenController } from "../screens/permissions-screen-controller";
import { EventsScreenController } from "../../features/events/public";
import { McpScreenController } from "../../features/mcp/public";
import { ProjectsScreenController } from "../../features/projects/public";
import { SettingsScreenController } from "../../features/settings/public";
import { createChatViewSubagentControllers } from "../../features/subagents/public";
import { ChannelScreenController } from "../../features/channels/public";
import { StoredSessionController } from "../../features/session/public";
import { StoredSessionActions } from "../session/stored-session-actions";
import { createFeedHost } from "../feed/feed-host";
import { openSystemPathExternally, revealSystemPathExternally } from "../controller/system-path-opener";
import { downloadChatobbyGuide } from "../../features/guide/public";
import type { FeedStore } from "../../features/feed/public";
import { dispatchNoticeAction, isNoticeAction } from "../controller/notice-intent-controller";
import { routeExtensionPanelAction } from "../controller/extension-panel-action-router";

export type WorkspacePageState = ChatobbyNavigationState & { mode: Exclude<ChatobbyNavigationState["mode"], "chat"> };
export const WORKSPACE_PAGES = [
  { mode: "subagents", label: "Subagents", icon: "bot" },
  { mode: "channels", label: "Channels", icon: "messages-square" },
  { mode: "memory", label: "Memory", icon: "brain" },
  { mode: "events", label: "Events", icon: "calendar-clock" },
  { mode: "permissions", label: "Permissions", icon: "shield-check" },
  { mode: "mcp", label: "Plugins", icon: "blocks" },
  { mode: "settings", label: "Settings", icon: "settings" },
] as const;

export function workspacePageTitle(state: WorkspacePageState): string {
  if (state.mode === "projects") return "Projects";
  if (state.mode === "subagents" && state.feedOnly) return "Agent conversation";
  return WORKSPACE_PAGES.find((page) => page.mode === state.mode)?.label ?? "Chatobby";
}

/** Mounted page ownership is independent of both the conversation and its Obsidian leaf. */
export class WorkspacePage extends Component {
  readonly id: string;
  readonly element = createDiv({ cls: "chatobby-workspace-page" });
  readonly connection: WorkspaceConnection;
  private controller: { destroy(): void; synchronize(): void } | null = null;
  private opened = false;
  private disposed = false;
  private readonly status = this.element.createDiv({ cls: "chatobby-workspace-page__status", text: "Connecting to Chatobby…", attr: { role: "status" } });
  private readonly body = this.element.createDiv({ cls: "chatobby-workspace-page__body" });
  onClose: () => void = () => {};

  constructor(readonly plugin: ChatobbyPlugin, readonly state: WorkspacePageState, id: string = crypto.randomUUID()) {
    super();
    this.id = id;
    this.element.dataset.pageId = id;
    this.element.dataset.page = state.mode;
    this.connection = new WorkspaceConnection(plugin, () => {
      this.status.addClass("is-hidden");
      if (!this.opened) this.openController();
      else this.controller?.synchronize();
    }, (error) => {
      if (this.disposed) return;
      this.status.removeClass("is-hidden");
      this.status.setText(error instanceof Error ? error.message : "Chatobby could not load this page.");
    });
    this.load();
  }

  async start(): Promise<void> {
    try { await this.connection.open(); }
    catch (error) {
      this.status.setText(error instanceof Error ? error.message : "Could not connect.");
      const retry = this.status.createEl("button", { text: "Try again" });
      retry.addEventListener("click", () => void this.connection.connect().catch(() => {}));
    }
  }

  private openController(): void {
    this.opened = true;
    const { plugin, connection, state } = this;
    const options = {
      app: plugin.app,
      getHost: () => this.body,
      getStore: () => connection.store,
      getProtocol: () => connection.protocol,
      prepareOpen: () => {},
      onOpened: () => {},
      onClosed: (close: boolean) => { if (close && !this.disposed) this.onClose(); },
    };
    if (state.mode === "memory") {
      const controller = new MemoryScreenController(options);
      this.controller = controller; controller.open();
    } else if (state.mode === "permissions") {
      const controller = new PermissionsScreenController({ ...options, workspacePage: true, onManageTools: () => { void plugin.openWorkspacePage({ mode: "mcp" }); } });
      this.controller = controller; controller.open();
    } else if (state.mode === "events") {
      const controller = new EventsScreenController({ ...options, openSession: async (cwd, path) => { await plugin.openSessionView(cwd, path); } });
      this.controller = controller; controller.open();
    } else if (state.mode === "mcp") {
      const controller = new McpScreenController({ ...options, onNavigatePlugin: (pluginId) => controller.open(pluginId) });
      this.controller = controller; controller.open(state.pluginId);
    } else if (state.mode === "settings") {
      const controller = new SettingsScreenController({ ...options, plugin, downloadGuide: () => {
        void downloadChatobbyGuide({ app: plugin.app, fetchGuide: () => plugin.fetchGuide(), onError: (message) => new Notice(message) });
      } });
      this.controller = { destroy: () => controller.destroy(), synchronize: () => {} }; controller.open();
    } else if (state.mode === "channels") {
      const controller = new ChannelScreenController({ ...options, openAgentFeed: async (reference) => {
        const view = plugin.getActiveView() ?? await plugin.openBlankView("");
        await view.openAgentReference(reference);
      } });
      this.controller = controller; controller.open(state.channelId, state.messageId);
    } else if (state.mode === "subagents") {
      const controllers = createChatViewSubagentControllers({
        ...options,
        workspacePage: true,
        openParentSession: (sessionId) => { void plugin.openSessionById(sessionId); },
        stopParentSession: (sessionId) => plugin.stopSessionById(sessionId),
        getFrontendStore: () => connection.store,
        getFrontendProtocol: () => connection.protocol,
        openPermissions: () => { void plugin.openWorkspacePage({ mode: "permissions" }); },
        getActiveActorId: () => "main",
        openMainAgent: () => plugin.getActiveView()?.openMainFeed(),
        openAgentFeed: (runId, nodeId) => { void plugin.openWorkspacePage({ mode: "subagents", runId, nodeId, feedOnly: true }); },
        openAgentHistory: () => { void plugin.openWorkspacePage({ mode: "subagents" }); },
        createFeedHost: (getFeedStore) => this.feedHost(getFeedStore),
      });
      this.controller = { destroy: () => { controllers.screen.destroy(); controllers.rail.destroy(); }, synchronize: () => controllers.screen.synchronize() };
      controllers.screen.open(state.runId, state.subagentTab, state.nodeId, state.feedOnly);
    } else {
      const sessions = new StoredSessionController({ app: plugin.app, ensureConnectedTransport: async () => {
        await connection.connect(); return connection.getTransport();
      }, runOperation: (descriptor, operation) => plugin.runOperation(descriptor, operation) });
      const actions = new StoredSessionActions({ app: plugin.app, sessions, refresh: () => plugin.notifySessionDirectoryChanged() });
      const controller = new ProjectsScreenController({
        ...options,
        deleteSession: (sessionId) => sessions.delete({ sessionId }),
        runSessionAction: (sessionId, action) => actions.run({ sessionId }, action),
        navigateToMessageHit: async (hit) => {
          const view = await plugin.openSessionById(hit.sessionId);
          await view.revealMessage(hit.targetBlockId);
        },
        openSessionIntent: async (intent) => {
          if (intent.type === "session.resume-by-id") await plugin.openSessionById(intent.payload.sessionId);
          else {
            const view = await plugin.openBlankView("");
            if (intent.payload.workspace.kind === "project") await view.createSessionForProject(intent.payload.workspace.projectId);
          }
        },
      });
      this.controller = controller; controller.open(state.projectId);
    }
  }

  private feedHost(getFeedStore: () => FeedStore) {
    return createFeedHost({
      app: this.plugin.app, component: this, getFeedStore,
      getAutoScroll: () => this.plugin.settings.autoScroll,
      getThinkingDisplay: () => this.plugin.settings.thinkingDisplay,
      renderMarkdown: (markdown, element) => MarkdownRenderer.render(this.plugin.app, markdown, element, "", this),
      scrollFeed: () => {},
      openVaultLink: (path) => { void this.plugin.app.workspace.openLinkText(path, "", "tab"); },
      openSystemPath: (path) => openSystemPathExternally(this.plugin.app, path),
      revealSystemPath: (path) => revealSystemPathExternally(this.plugin.app, path),
      copyToClipboard: (text) => { void navigator.clipboard.writeText(text); },
      onExtensionPanelAction: (action) => {
        if (isNoticeAction(action.id)) void dispatchNoticeAction(action.id, this.plugin.app, this.connection.store, this.connection.protocol);
        else routeExtensionPanelAction(action, {
          openPermissions: () => { void this.plugin.openWorkspacePage({ mode: "permissions" }); },
          openMemory: () => { void this.plugin.openWorkspacePage({ mode: "memory" }); },
          openSubagents: (tab) => { void this.plugin.openWorkspacePage({ mode: "subagents", subagentTab: tab }); },
          openSettings: () => { void this.plugin.openWorkspacePage({ mode: "settings" }); },
        });
      },
      onAutoScrollChange: (autoScroll) => { void this.plugin.updateSettings({ autoScroll }); },
      onCompactionRequest: () => {},
      onEmptyPrompt: () => {},
      onFeedEscape: () => this.element.focus(),
    });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.controller?.destroy();
    this.unload();
    this.element.remove();
    await this.connection.close();
  }
}
