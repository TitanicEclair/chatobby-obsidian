# Chatobby 0.1.7 public alpha

This release repairs the runtime update and reconnect lifecycle, improves
subagent configuration, and adds more productive composer behavior.

## What changed

- **Repair Chatobby** now verifies and replaces invalid runtime bytes even when
  the installed runtime has the same version number as the available package.
- Plugin reloads reattach to the existing per-vault runtime instead of leaving
  stale frontend channels or launching duplicate managed runtimes.
- Feature pages restore their content automatically after reconnect without a
  manual page switch or refresh.
- Built-in subagent roles and their protected permission policies are visible
  in the editor, with clearer role, model, effort, tool, and budget controls.
- The composer adds previous-message recall, configurable draft stashing, and
  early-cancel recovery. Composer shortcuts now run through Obsidian's active
  view key scope so global hotkeys cannot consume them first.
- Saved models that are temporarily unavailable remain visible and explain why
  they cannot currently be selected.

## Verification

- Source, type, architecture, and release-boundary checks pass.
- All 683 connector tests pass.
- The exact release bundle was installed into the main and test vaults.
- Both vaults reached a signed runtime `ready` state and reused the same runtime
  PID across plugin reloads.
- Live Obsidian testing confirmed Ctrl+S stashes and restores a composer draft.
- Release assets are minified, source-map free, and limited to `main.js`,
  `manifest.json`, and `styles.css`.

Chatobby remains public-alpha software. Back up important vaults and begin with
the minimum permissions needed for the task.
