import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../frontend/frontend-store";
import type { App } from "obsidian";
import { EventsScreenController } from "../../features/events/public";
import { ContextQueryScreenController } from "../../features/queries/public";
import { McpScreenController } from "../../features/mcp/public";
import { MemoryScreenController } from "./memory-screen-controller";
import { PermissionsScreenController } from "./permissions-screen-controller";

export type OverlayViewMode = "permissions" | "memory" | "events" | "queries" | "mcp";

export interface ChatViewOverlayScreens {
  memory: MemoryScreenController;
  permissions: PermissionsScreenController;
  events: EventsScreenController;
  queries: ContextQueryScreenController;
  mcp: McpScreenController;
  closeAll(renderChat: boolean): void;
  destroy(): void;
}

export interface ChatViewOverlayScreenOptions {
  app: App;
  getHost(): HTMLElement;
  getFrontendStore(): FrontendStore;
  getFrontendProtocol(): FrontendProtocolController;
  prepareOpen(): void;
  onOpened(mode: OverlayViewMode): void;
  onClosed(mode: OverlayViewMode, renderChat: boolean): void;
  openSession(projectPath: string, sessionPath: string): Promise<void>;
  navigateMcpPlugin(pluginId?: string): void;
}

/** Builds mutually exclusive full-view screens without adding their lifecycle policy to ChatobbyView. */
export function createChatViewOverlayScreens(options: ChatViewOverlayScreenOptions): ChatViewOverlayScreens {
  let memory: MemoryScreenController;
  let permissions: PermissionsScreenController;
  let events: EventsScreenController;
  let queries: ContextQueryScreenController;
  let mcp: McpScreenController;
  const prepare = (mode: OverlayViewMode): void => {
    options.prepareOpen();
    if (mode !== "memory") memory.close(false);
    if (mode !== "permissions") permissions.close(false);
    if (mode !== "events") events.close(false);
    if (mode !== "queries") queries.close(false);
    if (mode !== "mcp") mcp.close(false);
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
  queries = new ContextQueryScreenController({
    getHost: () => options.getHost(),
    getStore: () => options.getFrontendStore(),
    getProtocol: () => options.getFrontendProtocol(),
    prepareOpen: () => prepare("queries"),
    onOpened: () => options.onOpened("queries"),
    onClosed: (renderChat) => options.onClosed("queries", renderChat),
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
  return {
    memory,
    permissions,
    events,
    queries,
    mcp,
    closeAll: (renderChat) => {
      memory.close(renderChat);
      permissions.close(renderChat);
      events.close(renderChat);
      queries.close(renderChat);
      mcp.close(renderChat);
    },
    destroy: () => {
      memory.destroy();
      permissions.destroy();
      events.destroy();
      queries.destroy();
      mcp.destroy();
    },
  };
}
