import { Notice } from "obsidian";
import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { FrontendStore } from "../../frontend/frontend-store";
import { FRONTEND_SCHEMA_VERSION } from "../shared/constants";

/** Apply the current durable session's runtime-owned mode, never a local preference. */
export async function applyComposerAccessPolicy(
  value: string,
  store: FrontendStore,
  protocol: FrontendProtocolController,
  control: "permission" | "network" = "permission",
): Promise<void> {
  const snapshot = store.snapshot;
  if (!snapshot?.session) throw new Error("No active Chatobby session");
  if (control === "permission" && value !== "read-only" && value !== "workspace" && value !== "full") throw new Error("Invalid access mode");
  if (control === "network" && value !== "on" && value !== "off") throw new Error("Invalid agent network choice");
  const isCurrent = () => {
    const current = store.snapshot;
    return current?.runtimeInstanceId === snapshot.runtimeInstanceId
      && current.viewId === snapshot.viewId && current.session?.id === snapshot.session?.id;
  };
  try {
    const screen = await protocol.loadScreen({ screenId: "permissions" });
    const current = store.snapshot;
    if (!current?.session || !isCurrent()) return;
    if (screen.screenId !== "permissions" || screen.loading || screen.accessPolicySessionId !== current.session.id)
      throw new Error("The current session access policy is unavailable");
    const mode = control === "network" ? screen.accessPolicy.accessMode : value;
    if (mode !== "read-only" && mode !== "workspace" && mode !== "full") throw new Error("Invalid access mode");
    if (mode === "full" && control === "network" && value === "off") throw new Error("Full access includes network access");
    const result = await protocol.dispatch({
      schemaVersion: FRONTEND_SCHEMA_VERSION,
      intentId: window.crypto.randomUUID(),
      viewId: current.viewId,
      mainSessionId: current.session.id,
      expectedRevision: current.revision,
      type: "permissions.set-access-policy",
      payload: {
        expectedRevision: screen.accessPolicy.revision,
        accessMode: mode,
        agentNetworkAccess: mode === "full" || (control === "network" ? value === "on" : screen.accessPolicy.agentNetworkAccess),
      },
    });
    if (!isCurrent()) return;
    if (result.status !== "applied" && result.status !== "accepted") {
      throw new Error(result.notice?.message ?? "Chatobby rejected the access-mode change");
    }
    if (result.notice) new Notice(result.notice.message);
  } catch (error) {
    if (isCurrent()) throw error;
  }
}
