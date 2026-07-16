// Model + thinking-level cycling commands. The cycle logic (and preference
// persistence/UI refresh) lives on the plugin; these records just dispatch.

import type { ChatobbyAction } from "../registry";

export const modelActions: ChatobbyAction[] = [
  {
    id: "cycle-model",
    name: "Cycle model",
    group: "model",
    run: (services) => services.cycleModel(),
  },
  {
    id: "cycle-thinking",
    name: "Cycle thinking level",
    group: "model",
    run: (services) => services.cycleThinking(),
  },
];
