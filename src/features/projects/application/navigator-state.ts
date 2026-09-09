/** Presentation order belongs to this Obsidian sidebar leaf, never to a Project's execution configuration. */
export interface NavigatorState {
  schemaVersion: 1;
  projectOrder: string[];
  sessionOrder: Record<string, string[]>;
  collapsed: string[];
}

export function parseNavigatorState(value: unknown): NavigatorState {
  const state: NavigatorState = { schemaVersion: 1, projectOrder: [], sessionOrder: {}, collapsed: [] };
  if (!value || typeof value !== "object" || !("schemaVersion" in value) || value.schemaVersion !== 1) return state;
  if ("projectOrder" in value) state.projectOrder = strings(value.projectOrder);
  if ("collapsed" in value) state.collapsed = strings(value.collapsed);
  if ("sessionOrder" in value && value.sessionOrder && typeof value.sessionOrder === "object") {
    for (const [key, order] of Object.entries(value.sessionOrder)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      state.sessionOrder[key] = strings(order);
    }
  }
  return state;
}

export function orderItems<T>(items: readonly T[], order: readonly string[], id: (item: T) => string): T[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  return [...items].sort((left, right) => (rank.get(id(left)) ?? -1) - (rank.get(id(right)) ?? -1));
}

export function moveBefore(order: readonly string[], item: string, before: string): string[] {
  if (item === before || !order.includes(item) || !order.includes(before)) return [...order];
  const result = order.filter((key) => key !== item);
  result.splice(result.indexOf(before), 0, item);
  return result;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))] : [];
}
