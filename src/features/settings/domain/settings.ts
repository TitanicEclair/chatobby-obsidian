// Connector-owned configuration persisted per vault by SettingsStore.
import type { AutoNameStrategy } from "../../../vendor/chatobby-client/connector-types.js";

// ── Display types ────────────────────────────────────────────────────

/** How thinking/reasoning blocks are rendered in the conversation feed. */
export type ThinkingDisplay = "hidden" | "collapsed" | "expanded";

/** Composer-local shortcuts. `Mod` means Ctrl on Windows/Linux and Command on macOS. */
export interface ComposerKeybindings {
  previousMessage: string;
  nextMessage: string;
  stashDraft: string;
  restoreStash: string;
  cancelTurn: string;
}

export const DEFAULT_COMPOSER_KEYBINDINGS: ComposerKeybindings = {
  previousMessage: "ArrowUp",
  nextMessage: "ArrowDown",
  stashDraft: "Mod+S",
  restoreStash: "Mod+Shift+S",
  cancelTurn: "Escape",
};

// ── Layer 1: Plugin Settings (persisted, infrastructure) ─────────────

/** Settings owned by the Obsidian SettingTab. Persisted to data.json. */
export interface PluginSettings {
  /** Completed first-run experience version. Zero marks a new user's welcome. */
  onboardingVersion: number;
  /** Highest plugin release introduction dismissed in this vault. Empty on first install. */
  lastSeenPluginVersion: string;
  /** Product runtime ownership mode. */
  runtimeMode: "managed" | "external" | "developer";
  /** Automatically acquire the managed runtime when a visible Chatobby view opens. */
  runtimeAutoStart: boolean;
  /** Whether the managed runtime follows Obsidian or remains available for background Events. */
  runtimeLifetime: "obsidian-session" | "background";
  /** User-supplied endpoint used only in external mode. */
  externalServerUrl: string;
  /** Raw command used only in developer mode. */
  developerCommand: string;
  /** Raw arguments used only in developer mode; lifecycle arguments remain manager-owned. */
  developerArgs: string[];
  /** Command shell used by agent shell tools. */
  commandShell:
    | "auto"
    | "pwsh"
    | "powershell"
    | "cmd"
    | "bash"
    | "zsh"
    | "fish"
    | "sh"
    | "custom";
  /** Executable name or absolute path used when commandShell is custom. */
  customShellPath: string;
  /** Document OCR path used by read_document. */
  documentOcrEngine: "builtin" | "advanced";
  /** Tesseract language code used by built-in OCR. */
  documentOcrLanguage: string;
  /** MinerU-compatible command used by optional advanced local OCR. */
  advancedOcrCommand: string;
  /** Local display flags only; credential values are persisted by the runtime. */
  providerKeys: Record<string, boolean>;
  /** How thinking blocks are rendered in the feed. */
  thinkingDisplay: ThinkingDisplay;
  /** Whether the feed auto-scrolls to bottom on new content. */
  autoScroll: boolean;
  /** Focus-sensitive shortcuts owned by the Chatobby composer. */
  composerKeybindings: ComposerKeybindings;
  /** Vault-relative directory used for new sessions and resume listing. Empty string = vault root. */
  activeVaultDirectory: string;
  /** Per-vault behavior when a folder already has a canonical directory-session Project. */
  directoryProjectLaunchBehavior: "ask" | "reuse-canonical" | "create-new";
  /** How new sessions are auto-named: "truncate" (first 5 words) or "model" (LLM call). */
  autoNameStrategy: AutoNameStrategy;
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  onboardingVersion: 0,
  lastSeenPluginVersion: "",
  runtimeMode: "managed",
  runtimeAutoStart: true,
  runtimeLifetime: "obsidian-session",
  externalServerUrl: "ws://127.0.0.1:9222",
  developerCommand: "chatobby",
  developerArgs: [],
  commandShell: "auto",
  customShellPath: "",
  documentOcrEngine: "builtin",
  documentOcrLanguage: "eng",
  advancedOcrCommand: "mineru",
  providerKeys: {},
  thinkingDisplay: "collapsed",
  autoScroll: true,
  composerKeybindings: { ...DEFAULT_COMPOSER_KEYBINDINGS },
  activeVaultDirectory: "",
  directoryProjectLaunchBehavior: "ask",
  autoNameStrategy: "truncate",
};
