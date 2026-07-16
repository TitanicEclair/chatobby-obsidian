/** Public locations used by the connector's installation and support surfaces. */
export const CHATOBBY_CONNECTOR_REPOSITORY_URL = "https://github.com/TitanicEclair/chatobby-obsidian";
export const CHATOBBY_RUNTIME_RELEASES_URL = "https://github.com/TitanicEclair/chatobby-runtime/releases/latest";
export const CHATOBBY_SUPPORT_URL = "https://github.com/TitanicEclair/chatobby-obsidian/issues";
export const CHATOBBY_PATREON_URL = "https://www.patreon.com/cw/MadelynCruzTan/membership";

/** Open a documented public Chatobby location outside the current Obsidian view. */
export function openChatobbyUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
