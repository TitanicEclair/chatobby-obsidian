// Backend lifecycle commands: explicit Start (launch + connect) and Stop
// (graceful close). Replaces the old single "Toggle backend" command whose
// stop branch was unreachable after a renderer reload.

import type { ChatobbyAction } from "../registry";

export const backendActions: ChatobbyAction[] = [
  {
    id: "start-backend",
    name: "Start Chatobby runtime",
    group: "backend",
    run: (services) => services.backend.start(),
  },
  {
    id: "stop-backend",
    name: "Stop Chatobby runtime",
    group: "backend",
    run: (services) => services.backend.stop(),
  },
  {
    id: "restart-backend",
    name: "Restart Chatobby runtime",
    group: "backend",
    run: (services) => services.backend.restart(),
  },
];
