// Bridge executor — public API.
// See docs/wire-protocol.md for architecture and ownership.

export { ObsidianBridgeClient } from "./bridge-client";
export { BridgeConnectionCoordinator } from "./bridge-connection-coordinator";
export { transitionBridgeConnection, canRetryBridge } from "./bridge-connection-state";
export { routeInboundFrame, serializeOutbound } from "./bridge-router";
export { executeOperation } from "./operation-registry";
export { BridgeError } from "./types";
export type {
  BridgeConnectionState,
  BridgeConnectionEvent,
  BridgeConnectionStatus,
  InFlightRequest,
  OperationHandler,
} from "./types";
export type { BridgeClientFactory, CoordinatedBridgeClient } from "./bridge-connection-coordinator";
export type { BridgeInboundResultHandlers } from "./bridge-router";
