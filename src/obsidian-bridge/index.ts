// Bridge executor — public API.
// See docs/tooling/bridge-executor.md for architecture.

export { ObsidianBridgeClient } from "./bridge-client";
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
