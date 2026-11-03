/** Full-screen controller for Chatobby's user-facing settings and guide entry point. */
export { SettingsScreenController } from "./application/settings-screen-controller";

/** Vault-local configuration defaults; the objects retain their existing shared identity. */
export { DEFAULT_COMPOSER_KEYBINDINGS, DEFAULT_PLUGIN_SETTINGS } from "./domain/settings";
/** Connector-owned settings and shortcut declarations, separate from runtime state. */
export type { ComposerKeybindings, PluginSettings, ThinkingDisplay } from "./domain/settings";
/** In-place configuration persistence and existing credential-command ordering. */
export { SettingsStore } from "./infrastructure/settings-store";

/** Per-surface settings renderer; catalogue and refresh state are never shared across instances. */
export { SettingsView } from "./ui/settings-view";
