# Chatobby 0.3.2

Chatobby 0.3.2 is a recovery update for the 0.3.1 public alpha.

## What changed

- Failed runtime downloads and package copies now remove their incomplete
  staging directory immediately.
- Before a retry, Chatobby reclaims only exact installer-owned staged, backup,
  or failed directories when no installation operation is pending. Unrelated
  files and similarly named folders are preserved.
- The paired runtime can recover vaults whose Projects migration was repeatedly
  interrupted or ran out of disk space, without requiring users to delete
  Chatobby data manually.
- Disk-capacity failures now produce an actionable migration error instead of
  appearing only as a generic runtime connection failure.

This remains public-alpha software. macOS and Linux support remain experimental
until representative physical-device acceptance is completed.
