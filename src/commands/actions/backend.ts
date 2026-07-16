// Backend lifecycle commands: explicit Start (launch + connect) and Stop
// (graceful close). Replaces the old single "Toggle backend" command whose
// stop branch was unreachable after a renderer reload.

import type { ChatobbyAction } from "../registry";

export const backendActions: ChatobbyAction[] = [
  {
    id: "start-backend",
    name: "Start backend",
    group: "backend",
    palette: false,
    run: (services) => services.backend.start(),
  },
  {
    id: "stop-backend",
    name: "Stop backend",
    group: "backend",
    palette: false,
    run: (services) => services.backend.stop(),
  },
];
