// obsidian://chatobby?prompt=…&model=…&thinking=…&permission=… handler.
// Extracted from main.ts. Lets a shell inject a specific prompt (bare commands
// can't receive text), e.g.  Start-Process "obsidian://chatobby?prompt=hello%20world".

import type { PermissionMode, SessionPreferences, ThinkingLevel } from "./types";
import type { ChatobbyView } from "./ui/view";

export interface UriHandlerDeps {
  activateView(): Promise<void>;
  getActiveView(): ChatobbyView | null;
  rememberSessionPreferences(patch: Partial<SessionPreferences>): Promise<void>;
}

/** Apply optional preference overrides, then send the prompt if present. */
export async function handleChatobbyUri(
  params: Record<string, string | undefined>,
  deps: UriHandlerDeps,
): Promise<void> {
  await deps.activateView();
  const view = deps.getActiveView();
  if (!view) return;

  const patch: Partial<SessionPreferences> = {};
  if (typeof params.model === "string" && params.model) patch.model = params.model;
  if (typeof params.thinking === "string" && params.thinking) patch.thinkingLevel = params.thinking as ThinkingLevel;
  if (typeof params.permission === "string" && params.permission) patch.permissionMode = params.permission as PermissionMode;
  if (Object.keys(patch).length > 0) {
    await deps.rememberSessionPreferences(patch);
    view.refreshPreferences();
  }

  const prompt = typeof params.prompt === "string" ? params.prompt : "";
  if (prompt) {
    view.setComposerText(prompt);
    view.commandSendPrompt();
  }
}
