import { Notice, type App } from "obsidian";
import type { FrontendStore } from "../../frontend/frontend-store";
import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendIntent } from "../../vendor/chatobby-client/frontend-contracts.js";
import { resolveSubagentPermissionAction } from "./subagent-permission-action";

export function isNoticeAction(id: string): boolean {
  return id.startsWith("subagent-permission:") || id.startsWith("memory-candidate:");
}

/** Dispatch through the projection that owns the notice, including detached agent feeds. */
export async function dispatchNoticeAction(id: string, app: App, store: FrontendStore, protocol: FrontendProtocolController): Promise<void> {
  try {
    const snapshot = store.snapshot;
    if (!snapshot) throw new Error("Chatobby frontend is not initialized.");
    let input: Pick<Extract<FrontendIntent, { type: "memory.decide-candidate" | "subagent.decide-permission" }>, "type" | "payload">;
    const memory = /^memory-candidate:(approve|reject):(.+)$/u.exec(id);
    if (memory?.[1] && memory[2]) {
      input = { type: "memory.decide-candidate", payload: { candidateId: memory[2], decision: memory[1] === "approve" ? "approve" : "reject" } };
    } else {
      const payload = await resolveSubagentPermissionAction(app, id);
      if (!payload) return;
      input = { type: "subagent.decide-permission", payload };
    }
    // A modal may have remained open while the owning conversation changed.
    if (store.snapshot?.session?.id !== snapshot.session?.id || store.snapshot?.runtimeInstanceId !== snapshot.runtimeInstanceId) {
      throw new Error("The conversation changed. Open the request again.");
    }
    const outcome = await protocol.dispatch({ schemaVersion: 1, intentId: crypto.randomUUID(), viewId: snapshot.viewId, mainSessionId: snapshot.session?.id, expectedRevision: snapshot.revision, ...input } as FrontendIntent);
    if (outcome.status === "rejected" || outcome.status === "conflict") throw new Error(outcome.notice?.message ?? "The request could not be updated.");
  } catch (error) {
    new Notice(error instanceof Error ? error.message : "The request could not be updated.");
  }
}
