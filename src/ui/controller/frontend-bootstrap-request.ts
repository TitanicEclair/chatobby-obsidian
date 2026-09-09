import type { App } from "obsidian";
import type ChatobbyPlugin from "../../main";
import { gatherVaultCapabilities } from "../../prompt";
import {
  CHATOBBY_FRONTEND_PROTOCOL_VERSION,
  CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES,
  CHATOBBY_FRONTEND_OPTIONAL_CAPABILITIES,
  frontendId,
  type FrontendNegotiationRequest,
} from "../../vendor/chatobby-client/frontend-contracts.js";
import { FRONTEND_SCHEMA_VERSION } from "../shared/constants";

export function createFrontendNegotiationRequest(
  app: App,
  plugin: ChatobbyPlugin,
  viewId: string,
  surface: "conversation" | "workspace" = "conversation",
): FrontendNegotiationRequest {
  const runtimeApp = app as typeof app & { version?: string };
  const capabilities = gatherVaultCapabilities(app);
  return {
    surface,
    schemaVersion: FRONTEND_SCHEMA_VERSION,
    requestId: frontendId(window.crypto.randomUUID(), "requestId"),
    connectorVersion: plugin.manifest.version,
    obsidianVersion: runtimeApp.version ?? plugin.manifest.minAppVersion,
    vaultInstanceId: frontendId(app.vault.getName(), "vaultInstanceId"),
    viewId: frontendId(viewId, "viewId"),
    supportedProtocolVersions: [CHATOBBY_FRONTEND_PROTOCOL_VERSION],
    capabilities: {
      featureFamilies: capabilities.featureFamilies,
      protocolCapabilities: [
        ...CHATOBBY_FRONTEND_REQUIRED_CAPABILITIES,
        ...CHATOBBY_FRONTEND_OPTIONAL_CAPABILITIES,
      ],
      integrations: capabilities.integrations,
    },
  };
}
