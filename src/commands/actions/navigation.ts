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
    name: "Focus chat box",
    group: "navigation",
    run: (services) => services.withView((view) => view.focusComposer()),
  },
  {
    id: "focus-editor",
    name: "Focus active note editor",
    group: "navigation",
    run: (services) => services.focusActiveEditor(),
  },
];
