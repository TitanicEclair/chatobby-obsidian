import { Notice, type App } from "obsidian";
import type { FrontendStore } from "../../frontend/frontend-store";
import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendIntent } from "../../vendor/chatobby-client/frontend-contracts.js";
import { resolveSubagentPermissionAction } from "./subagent-permission-action";
import { decidePermissionOnce, type SubagentPermissionDecisionPayload } from "../../features/permissions/public";

export function isNoticeAction(id: string): boolean {
  return id.startsWith("subagent-permission:") || id.startsWith("memory-candidate:");
}

/** Route a notice action from any feed surface while preserving its owning frontend store. */
export function handleNoticeAction(id: string, app: App, store: FrontendStore, protocol: FrontendProtocolController): boolean {
  if (!isNoticeAction(id)) return false;
  void dispatchNoticeAction(id, app, store, protocol).catch((error: unknown) => {
    new Notice(error instanceof Error ? error.message : "The request could not be updated.");
  });
  return true;
}

/** Dispatch through the projection that owns the notice, including detached agent feeds. */
export async function dispatchNoticeAction(id: string, app: App, store: FrontendStore, protocol: FrontendProtocolController): Promise<void> {
  const snapshot = store.snapshot;
  if (!snapshot) throw new Error("Chatobby frontend is not initialized.");
  let input: Pick<Extract<FrontendIntent, { type: "memory.decide-candidate" | "subagent.decide-permission" }>, "type" | "payload">;
  let subagentPayload: SubagentPermissionDecisionPayload | null = null;
  const memory = /^memory-candidate:(approve|reject):(.+)$/u.exec(id);
  if (memory?.[1] && memory[2]) {
    input = { type: "memory.decide-candidate", payload: { candidateId: memory[2], decision: memory[1] === "approve" ? "approve" : "reject" } };
  } else {
    const payload = await resolveSubagentPermissionAction(app, id);
    if (!payload) return;
    subagentPayload = payload;
    input = { type: "subagent.decide-permission", payload };
  }
  // A modal may have remained open while the owning conversation changed.
  if (store.snapshot?.session?.id !== snapshot.session?.id || store.snapshot?.runtimeInstanceId !== snapshot.runtimeInstanceId || store.snapshot?.viewId !== snapshot.viewId) {
    throw new Error("The conversation changed. Open the request again.");
  }
  const send = async () => {
    if (store.snapshot?.session?.id !== snapshot.session?.id || store.snapshot?.runtimeInstanceId !== snapshot.runtimeInstanceId || store.snapshot?.viewId !== snapshot.viewId) throw new Error("The conversation changed. Open the request again.");
    const outcome = await protocol.dispatch({ schemaVersion: 1, intentId: crypto.randomUUID(), viewId: snapshot.viewId, mainSessionId: snapshot.session?.id, expectedRevision: snapshot.revision, ...input } as FrontendIntent);
    if (outcome.status === "rejected" || outcome.status === "conflict" || outcome.status === "unavailable") throw new Error(outcome.notice?.message ?? "The request could not be updated.");
  };
  if (subagentPayload) await decidePermissionOnce(snapshot.runtimeInstanceId, subagentPayload, send);
  else await send();
}
