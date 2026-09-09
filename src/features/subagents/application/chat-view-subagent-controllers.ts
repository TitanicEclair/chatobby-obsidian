import type { App } from "obsidian";
import type { FrontendProtocolController } from "../../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../../frontend/frontend-store";
import { SessionAgentRailController } from "./session-agent-rail-controller";
import { SubagentScreenController } from "./subagent-screen-controller";
import type { SubagentFeedHostFactory } from "../ui/agent-conversation-view";
import { SubagentStore } from "../state/subagent-store";

export interface ChatViewSubagentControllersOptions {
  workspacePage?: boolean;
  openParentSession?: (sessionId: string) => void;
  stopParentSession?: (sessionId: string) => void;
  app: App;
  getHost: () => HTMLElement;
  getFrontendStore: () => FrontendStore;
  getFrontendProtocol: () => FrontendProtocolController;
  prepareOpen: () => void;
  onOpened: () => void;
  onClosed: (renderChat: boolean) => void;
  openPermissions: () => void;
  getActiveActorId: () => string;
  openMainAgent: () => void;
  openAgentFeed: (runId: string, nodeId: string) => void;
  openAgentHistory: () => void;
  createFeedHost: SubagentFeedHostFactory;
}

export interface ChatViewSubagentControllers {
  screen: SubagentScreenController;
  rail: SessionAgentRailController;
}

/** Composes the management screen and session rail around one shared workspace context. */
export function createChatViewSubagentControllers(
  options: ChatViewSubagentControllersOptions,
): ChatViewSubagentControllers {
  const store = new SubagentStore(options.getFrontendStore());
  const screen = new SubagentScreenController({
    workspacePage: options.workspacePage,
    openParentSession: options.openParentSession,
    stopParentSession: options.stopParentSession,
    openAgentFeed: options.openAgentFeed,
    app: options.app,
    store,
    getFrontendStore: options.getFrontendStore,
    getFrontendProtocol: options.getFrontendProtocol,
    getHost: options.getHost,
    prepareOpen: options.prepareOpen,
    onOpened: options.onOpened,
    onClosed: options.onClosed,
    onOpenManagement: options.openAgentHistory,
    openPermissions: options.openPermissions,
    createFeedHost: options.createFeedHost,
  });
  const rail = new SessionAgentRailController({
    getActiveActorId: options.getActiveActorId,
    openMainAgent: options.openMainAgent,
    openAgentFeed: options.openAgentFeed,
    openAgentHistory: options.openAgentHistory,
  });
  return { screen, rail };
}
