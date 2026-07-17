/** Public locations used by the connector's installation and support surfaces. */
export const CHATOBBY_CONNECTOR_REPOSITORY_URL = "https://github.com/TitanicEclair/chatobby-obsidian";
export const CHATOBBY_RUNTIME_RELEASES_URL = "https://github.com/TitanicEclair/chatobby-runtime/releases/latest";
export const CHATOBBY_RUNTIME_UPDATE_DESCRIPTOR_URL =
  "https://github.com/TitanicEclair/chatobby-runtime/releases/latest/download/runtime-update.json";
export const CHATOBBY_SUPPORT_URL = "https://github.com/TitanicEclair/chatobby-obsidian/issues";
export const CHATOBBY_PATREON_URL = "https://www.patreon.com/cw/MadelynCruzTan/membership";

/** Open a documented public Chatobby location outside the current Obsidian view. */
export function openChatobbyUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Resolve one signed descriptor's immutable GitHub release asset. */
export function chatobbyRuntimeBundleUrl(version: string, file: string): string {
  return `https://github.com/TitanicEclair/chatobby-runtime/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(file)}`;
}
