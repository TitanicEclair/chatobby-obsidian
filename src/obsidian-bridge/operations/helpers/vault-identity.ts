// Vault identity helpers — get vault metadata for bridge Hello and context.get.
//
// See docs/tooling/bridge-executor.md §7.2 for the Hello message.

import type { App } from "obsidian";
import type { ObsidianBridgeVault } from "../../../vendor/@chatobby/obsidian-protocol/bridge-protocol";

/**
 * Get the vault identity for the current Obsidian vault.
 * Used in the bridge Hello message and context.get responses.
 *
 * `id`/`root` use the vault's absolute base path — the only stable, unique id
 * Obsidian exposes. Using the vault NAME as the id would cause 4000 (replaced)
 * or OBSIDIAN_VAULT_AMBIGUOUS on shared-name or multi-window vaults, since the
 * backend keys connection registration on whatever id we send.
 */
export function getVaultIdentity(app: App): ObsidianBridgeVault {
  // The bundled obsidian typings predate DataAdapter.getBasePath; cast through
  // unknown (zero-`any`) to the runtime shape. getBasePath is a stable Obsidian API.
  const basePath = (app.vault.adapter as unknown as { getBasePath: () => string }).getBasePath();
  const vaultName = (app.vault as { getName?: () => string }).getName?.()
    ?? basePath.split(/[\\/]/).pop()
    ?? "Obsidian Vault";

  return {
    id: basePath,
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
