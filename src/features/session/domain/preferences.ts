import type { ThinkingLevel } from "../../../vendor/chatobby-client/wire-types.js";


// ── Layer 2: Session Preferences (persisted, managed by UI controls) ─

/** Session defaults managed by the session controls popover. Persisted to data.json.
 *  Used to seed new sessions via newSession(). NOT in the settings tab. */
export interface SessionPreferences {
  /** Model ID to request. null = server default. */
  model: string | null;
  /** Thinking/reasoning level to request. */
  thinkingLevel: ThinkingLevel;
  /** Permission mode to request for new sessions. */
  permissionMode: PermissionMode;
}

export const DEFAULT_SESSION_PREFERENCES: SessionPreferences = {
  model: null,
  thinkingLevel: "medium",
  permissionMode: "default",
};

/** Legacy preference compatibility vocabulary. Runtime permission policy is authoritative;
 * these persisted UI values do not define the runtime's effective permission modes. */
export type PermissionMode =
  | "default" // ask before each tool use
  | "acceptEdits" // auto-allow file edits, ask for commands
  | "bypassPermissions" // allow everything
  | "plan" // read-only planning mode
  | "dontAsk" // allow without asking (with reason)
  | "auto"; // server decides
