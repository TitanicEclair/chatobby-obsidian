import type { ChatobbyViewMode } from "./view-navigation-controller";
import type { ViewShell } from "../shell/view-shell";

/** Apply the mutually exclusive chat/overlay visibility contract to the static shell. */
export function renderViewMode(
  shell: ViewShell,
  mode: ChatobbyViewMode,
  hasActiveTab: boolean,
): void {
  const overlayOpen = mode !== "chat";
  const agentSurface = mode === "chat" || mode === "subagents" || mode === "channels";
  shell.toolbarEl.toggleClass("is-hidden", overlayOpen);
  shell.subagentRailHostEl.toggleClass("is-hidden", !agentSurface || !hasActiveTab);
  shell.feedWrapEl.toggleClass("is-hidden", overlayOpen);
  shell.taskProgressHostEl.toggleClass("is-view-hidden", overlayOpen);
  shell.composerEl.toggleClass("is-hidden", overlayOpen);
  shell.sessionPickerHostEl.toggleClass("is-hidden", !overlayOpen);
}
