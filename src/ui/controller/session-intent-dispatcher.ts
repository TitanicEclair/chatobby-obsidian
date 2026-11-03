import type { FrontendProtocolController } from "../../frontend/frontend-protocol-controller";
import type { ChatobbyTransport } from "../../transport/ws-client";
import type { FrontendBootstrap } from "../../vendor/chatobby-client/frontend-contracts.js";
import type { SessionRestorationConnection } from "../session/session-recovery";
import { SessionIntentRejectedError, type SessionMutationRequest } from "./session-controller";
import { FRONTEND_SCHEMA_VERSION } from "../shared/constants";
import { waitForConnection } from "./connected-view-restoration";

export type { SessionRestorationConnection } from "../session/session-recovery";

export interface SessionIntentDispatcherOptions {
  getTransport(): ChatobbyTransport | null;
  ensureTransport(): Promise<ChatobbyTransport | null>;
  getSnapshot(): FrontendBootstrap | null;
  protocol: Pick<FrontendProtocolController, "synchronize" | "dispatch">;
}

/** Ordinary actions await runtime readiness; reconnect uses only its authenticated leaf connection. */
export async function dispatchSessionMutation(
  options: SessionIntentDispatcherOptions,
  request: SessionMutationRequest,
  restoration?: SessionRestorationConnection,
): Promise<boolean> {
  const requireCurrent = () => {
    if (restoration && (restoration.signal.aborted || !restoration.isCurrent() || !restoration.transport.isConnected
      || restoration.transport !== options.getTransport())) {
      throw new Error("Chatobby connection changed while restoring this session.");
    }
  };
  requireCurrent();
  const transport = restoration?.transport ?? await options.ensureTransport();
  if (!transport) throw new Error("Chatobby runtime is not connected");
  await waitForConnection(() => options.protocol.synchronize(transport), restoration);
  requireCurrent();
  const snapshot = options.getSnapshot();
  if (!snapshot) throw new Error("Chatobby frontend state is unavailable");
  const result = await waitForConnection(() => options.protocol.dispatch({
    schemaVersion: FRONTEND_SCHEMA_VERSION,
    intentId: window.crypto.randomUUID(),
    viewId: snapshot.viewId,
    mainSessionId: snapshot.session?.id,
    expectedRevision: snapshot.revision,
    ...request,
  }), restoration);
  requireCurrent();
  if (result.status === "applied" || result.status === "accepted") return true;
  if (result.status === "rejected" && result.notice?.level === "info") return false;
  throw new SessionIntentRejectedError(
    result.status === "rejected" ? result.errorCode : undefined,
    result.notice?.message ?? "Chatobby rejected the session change",
  );
}
