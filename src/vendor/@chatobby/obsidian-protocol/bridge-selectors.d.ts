export interface ObsidianVaultSelector {
    vaultId?: string;
    vaultName?: string;
    vaultRoot?: string;
}
/**
 * Parse an unknown value into a validated ObsidianVaultSelector.
 *
 * Accepts only `vaultId`, `vaultName`, and `vaultRoot` as optional string
 * fields. Rejects unknown fields and non-string values. Returns an empty
 * selector for undefined/null input.
 */
export declare function parseVaultSelector(input: unknown): ObsidianVaultSelector;
