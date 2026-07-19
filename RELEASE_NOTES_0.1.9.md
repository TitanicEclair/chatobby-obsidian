# Chatobby 0.1.9 public alpha

This patch fixes session-directory selection when opening Chatobby work in a
different vault folder.

## What changed

- **Use selected directory** now waits until the target Chatobby leaf has a
  runtime session bound to the selected folder.
- A synchronized session from another directory is replaced before a prompt can
  be sent to it.
- An existing session is reused when its runtime directory already matches, so
  **Use selected directory** remains distinct from **New session here**.

## Verification

- A regression test reproduces the previous mismatched-directory session and
  confirms that Chatobby creates the correct replacement before returning a
  prompt target.
- Directory routing tests confirm both reused and newly opened leaves are
  aligned before the picker completes.
- TypeScript, public API, architecture, release-boundary, and the complete
  connector test suite pass.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
