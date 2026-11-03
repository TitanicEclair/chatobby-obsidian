import type { SubagentPermissionDecisionPayload } from "../domain/permission-request";

const decisions = new Map<string, Promise<void>>();
const settled = new Set<string>();

/** Coalesce feed, parent composer and child composer decisions for the same runtime request revision. */
export function decidePermissionOnce(runtimeId: string, request: SubagentPermissionDecisionPayload, send: () => Promise<void>): Promise<void> {
  const key = JSON.stringify([runtimeId, request.runId, request.nodeId, request.permissionRequestId, request.expectedPermissionRequestRevision]);
  const existing = decisions.get(key);
  if (existing) return existing;
  const pending = Promise.resolve().then(send).then(() => {
    settled.add(key);
    if (settled.size > 256) { const oldest = [...settled][0]; if (oldest) { settled.delete(oldest); decisions.delete(oldest); } }
  }, (error: unknown) => { decisions.delete(key); throw error; });
  decisions.set(key, pending);
  return pending;
}
