# Chatobby 0.4.1

Chatobby 0.4.1 is a focused reliability update for long-running sessions and
automatic context compaction.

## Fixed

- A completed automatic checkpoint no longer reappears at the end of the feed
  after the next message. Replayed completion events are ignored unless they
  belong to the currently active compaction operation.
- Provider failures with no assistant text now appear as explicit error cards.
  A rejected request can no longer look as though it was never sent.
- Prompt requests wait through runtime-managed compaction instead of being
  cancelled by the connector's former generic 30-second request deadline.
- Post-compaction context usage refreshes even when a queued prompt starts
  immediately after the checkpoint completes.
- The automatic-compaction settings modal now contains one smooth slider and
  one exact percentage readout instead of overlapping values and tracks.

## Configuration

The model-specific automatic-compaction threshold may now be set from 10 to 95
percent. Existing defaults have not changed; the lower bound is available for
very large future context windows and for users who deliberately want earlier
checkpoints.

## Alpha platform status

Windows remains the primary tested desktop path. Native macOS and Linux builds
remain best-effort experimental support pending broader physical-device
acceptance.
