import type { App } from "obsidian";
import type ChatobbyPlugin from "../../main";
import type { VaultContext } from "../../types";
import { CHATOBBY_FRONTEND_PROTOCOL_VERSION } from "../../vendor/chatobby-client/ws-client.js";
import type { FrontendBootstrapRequest } from "../../vendor/chatobby-client/frontend-contracts.js";
import { FRONTEND_SCHEMA_VERSION } from "../shared/constants";

export function createFrontendBootstrapRequest(
  app: App,
  plugin: ChatobbyPlugin,
  viewId: string,
  context: VaultContext,
): FrontendBootstrapRequest {
  const runtimeApp = app as typeof app & { version?: string };
  return {
    schemaVersion: FRONTEND_SCHEMA_VERSION,
    connectorVersion: plugin.manifest.version,
    obsidianVersion: runtimeApp.version ?? plugin.manifest.minAppVersion,
    vaultInstanceId: app.vault.getName(),
    viewId,
    supportedProtocolVersions: [CHATOBBY_FRONTEND_PROTOCOL_VERSION],
    capabilities: {
      featureFamilies: context.capabilities?.featureFamilies ?? [],
      integrations: context.capabilities?.integrations ?? [],
    },
  };
}
