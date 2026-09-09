import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../frontend/frontend-store";
import type { App } from "obsidian";
import type ChatobbyPlugin from "../../main";
import type { SessionAdvancedAction } from "../session/session-maintenance";
import type { FrontendProjectMessageSearchHitViewModel } from "../../vendor/chatobby-client/frontend-contracts.js";
import { EventsScreenController } from "../../features/events/public";
import { McpScreenController } from "../../features/mcp/public";
import { ProjectsScreenController } from "../../features/projects/public";
import { SettingsScreenController } from "../../features/settings/public";
import { MemoryScreenController } from "./memory-screen-controller";
import { PermissionsScreenController } from "./permissions-screen-controller";

export type OverlayViewMode = "projects" | "permissions" | "memory" | "events" | "mcp" | "settings";

export interface ChatViewOverlayScreens {
  memory: MemoryScreenController;
  permissions: PermissionsScreenController;
  events: EventsScreenController;
  mcp: McpScreenController;
  projects: ProjectsScreenController;
	settings: SettingsScreenController;
  closeAll(renderChat: boolean): void;
  destroy(): void;
}

export interface ChatViewOverlayScreenOptions {
  app: App;
	plugin: ChatobbyPlugin;
  getHost(): HTMLElement;
  getFrontendStore(): FrontendStore;
  getFrontendProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(mode: OverlayViewMode): void;
  onClosed(mode: OverlayViewMode, renderChat: boolean): void;
  openSession(projectPath: string, sessionPath: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  runSessionAction(sessionId: string, action: SessionAdvancedAction): Promise<void>;
  navigateToMessageHit(hit: FrontendProjectMessageSearchHitViewModel): Promise<void>;
  navigateMcpPlugin(pluginId?: string): void;
	downloadGuide(): void;
}

/** Builds mutually exclusive full-view screens without adding their lifecycle policy to ChatobbyView. */
export function createChatViewOverlayScreens(options: ChatViewOverlayScreenOptions): ChatViewOverlayScreens {
  let memory: MemoryScreenController;
  let permissions: PermissionsScreenController;
  let events: EventsScreenController;
  let mcp: McpScreenController;
  let projects: ProjectsScreenController;
	let settings: SettingsScreenController;
  const prepare = (mode: OverlayViewMode): void => {
    options.prepareOpen();
    if (mode !== "memory") memory.close(false);
    if (mode !== "permissions") permissions.close(false);
    if (mode !== "events") events.close(false);
    if (mode !== "mcp") mcp.close(false);
    if (mode !== "projects") projects.close(false);
		if (mode !== "settings") settings.close(false);
  };
  memory = new MemoryScreenController({
    getHost: () => options.getHost(),
    getStore: () => options.getFrontendStore(),
    getProtocol: () => options.getFrontendProtocol(),
    prepareOpen: () => prepare("memory"),
    onOpened: () => options.onOpened("memory"),
    onClosed: (renderChat) => options.onClosed("memory", renderChat),
  });
  permissions = new PermissionsScreenController({
    getHost: () => options.getHost(),
    getStore: () => options.getFrontendStore(),
    getProtocol: () => options.getFrontendProtocol(),
    prepareOpen: () => prepare("permissions"),
    onOpened: () => options.onOpened("permissions"),
    onClosed: (renderChat) => options.onClosed("permissions", renderChat),
  });
  events = new EventsScreenController({
    getHost: () => options.getHost(),
    getStore: () => options.getFrontendStore(),
    getProtocol: () => options.getFrontendProtocol(),
    prepareOpen: () => prepare("events"),
    onOpened: () => options.onOpened("events"),
    onClosed: (renderChat) => options.onClosed("events", renderChat),
    openSession: (projectPath, sessionPath) => options.openSession(projectPath, sessionPath),
  });
  mcp = new McpScreenController({
    app: options.app,
    getHost: () => options.getHost(),
    getStore: () => options.getFrontendStore(),
    getProtocol: () => options.getFrontendProtocol(),
    prepareOpen: () => prepare("mcp"),
    onOpened: () => options.onOpened("mcp"),
    onClosed: (renderChat) => options.onClosed("mcp", renderChat),
    onNavigatePlugin: (pluginId) => options.navigateMcpPlugin(pluginId),
  });
  projects = new ProjectsScreenController({
    app: options.app,
    getHost: () => options.getHost(),
    getStore: () => options.getFrontendStore(),
    getProtocol: () => options.getFrontendProtocol(),
    prepareOpen: () => prepare("projects"),
    onOpened: () => options.onOpened("projects"),
    onClosed: (renderChat) => options.onClosed("projects", renderChat),
    deleteSession: (sessionId) => options.deleteSession(sessionId),
    runSessionAction: (sessionId, action) => options.runSessionAction(sessionId, action),
    navigateToMessageHit: (hit) => options.navigateToMessageHit(hit),
  });
	settings = new SettingsScreenController({
		app: options.app,
		plugin: options.plugin,
		getHost: () => options.getHost(),
		getStore: () => options.getFrontendStore(),
		prepareOpen: () => prepare("settings"),
		onOpened: () => options.onOpened("settings"),
		onClosed: (renderChat) => options.onClosed("settings", renderChat),
		downloadGuide: () => options.downloadGuide(),
	});
  return {
    memory,
    permissions,
    events,
    mcp,
    projects,
		settings,
    closeAll: (renderChat) => {
      memory.close(renderChat);
      permissions.close(renderChat);
      events.close(renderChat);
      mcp.close(renderChat);
      projects.close(renderChat);
		settings.close(renderChat);
    },
    destroy: () => {
      memory.destroy();
      permissions.destroy();
      events.destroy();
      mcp.destroy();
      projects.destroy();
		settings.destroy();
    },
  };
}
