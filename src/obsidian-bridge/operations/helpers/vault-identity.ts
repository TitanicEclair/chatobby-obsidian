// Vault identity helpers — get vault metadata for bridge Hello and context.get.
//
// See docs/wire-protocol.md for connection and capability ownership.

import type { App } from "obsidian";
import type { ObsidianBridgeVault } from "../../../vendor/@chatobby/obsidian-protocol/index.js";
import { getCachedChatobbyVaultIdentity } from "../../../vault-runtime";

/**
 * Get the vault identity for the current Obsidian vault.
 * Used in the bridge Hello message and context.get responses.
 *
 * `id` uses Chatobby's path-independent identity after plugin startup, while
 * `root` remains the current absolute location. A vault rename therefore does
 * not replace its bridge or Project identity.
 */
export function getVaultIdentity(app: App): ObsidianBridgeVault {
  // The bundled obsidian typings predate DataAdapter.getBasePath; cast through
  // unknown (zero-`any`) to the runtime shape. getBasePath is a stable Obsidian API.
  const basePath = (app.vault.adapter as unknown as { getBasePath: () => string }).getBasePath();
  const vaultName = (app.vault as { getName?: () => string }).getName?.()
    ?? basePath.split(/[\\/]/).pop()
    ?? "Obsidian Vault";

  return {
		// Plugin startup activates this record before any bridge connects. The
		// fallback keeps isolated operation tests usable without pretending that
		// an uninitialized product connection has a durable identity.
    id: getCachedChatobbyVaultIdentity(app)?.vaultId ?? basePath,
    name: vaultName,
    root: basePath,
  };
}

/**
 * Check if a vault selector matches the current vault.
 * Returns true if the selector is empty (matches any vault) or matches by id/name.
 */
export function checkVaultSelector(
  app: App,
  selector: { vaultId?: string; vaultName?: string },
): boolean {
  if (!selector.vaultId && !selector.vaultName) return true;

  const identity = getVaultIdentity(app);
  if (selector.vaultId && selector.vaultId !== identity.id) return false;
  if (selector.vaultName && selector.vaultName !== identity.name) return false;
  return true;
}
