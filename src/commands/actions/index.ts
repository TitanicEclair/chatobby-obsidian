// Aggregates all action groups into the single list the plugin registers.
// Add new groups here (and to the corresponding actions/*.ts file).

import type { ChatobbyAction } from "../registry";
import { backendActions } from "./backend";
import { modelActions } from "./model";
import { navigationActions } from "./navigation";
import { viewSessionActions } from "./view-session";

export function buildAllActions(): ChatobbyAction[] {
  return [
    ...backendActions,
    ...navigationActions,
    ...modelActions,
    ...viewSessionActions,
  ];
}

// Re-export for tests / external enumeration.
export { backendActions, modelActions, navigationActions, viewSessionActions };
