export function selectChatobbyCommandTarget<T>(
  active: T | null,
  lastUsed: T | null,
  open: readonly T[],
): T | null {
  if (active && open.includes(active)) return active;
  if (lastUsed && open.includes(lastUsed)) return lastUsed;
  return open[0] ?? null;
}
