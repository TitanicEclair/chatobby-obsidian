// Navigation + focus commands. The focus shuttle jumps between the chat
// composer and the active note editor for a keyboard-driven loop.

import type { ChatobbyAction } from "../registry";

export const navigationActions: ChatobbyAction[] = [
  {
    id: "open",
    name: "Open Chatobby",
    group: "navigation",
    run: (services) => services.activateView(),
  },
  {
    id: "focus-chat",
    name: "Focus message box",
    group: "navigation",
    run: (services) => services.withView((view) => view.focusComposer()),
  },
  {
    id: "focus-editor",
    name: "Focus last-used note editor",
    group: "navigation",
    run: (services) => services.focusActiveEditor(),
  },
  {
    id: "open-chat",
    name: "Open conversation",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("chat")),
  },
  {
    id: "open-sessions",
    name: "Open sessions",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("session-picker")),
  },
  {
    id: "open-subagents",
    name: "Open subagents",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("subagents")),
  },
  {
    id: "open-channels",
    name: "Open channels",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("channels")),
  },
  {
    id: "open-permissions",
    name: "Open permissions",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("permissions")),
  },
  {
    id: "open-memory",
    name: "Open memory",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("memory")),
  },
  {
    id: "open-events",
    name: "Open events",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("events")),
  },
  {
    id: "open-queries",
    name: "Open context queries",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandOpenPage("queries")),
  },
  {
    id: "focus-page-navigation",
    name: "Focus page sections",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandFocusPageNavigation()),
  },
  {
    id: "next-page-section",
    name: "Next page section",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandMovePageSection(1)),
  },
  {
    id: "previous-page-section",
    name: "Previous page section",
    group: "navigation",
    run: (services) => services.withView((view) => view.commandMovePageSection(-1)),
  },
];
