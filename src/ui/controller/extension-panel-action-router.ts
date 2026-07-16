import type { ExtensionPanelAction } from "../../types";

export interface ExtensionPanelActionRoutes {
  openPermissions(): void;
  openMemory(actionId: string): void;
  openSubagents(tab?: "settings"): void;
}

/** Route feed-panel actions without coupling block presentation to screen controllers. */
export function routeExtensionPanelAction(
  action: ExtensionPanelAction,
  routes: ExtensionPanelActionRoutes,
): void {
  if (action.id.startsWith("permission:")) routes.openPermissions();
  else if (action.id.startsWith("memory:")) routes.openMemory(action.id);
  else if (action.id === "subagents:refresh") routes.openSubagents();
  else if (action.id === "subagents:settings") routes.openSubagents("settings");
}
