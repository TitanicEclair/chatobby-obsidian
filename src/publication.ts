/** Public locations used by the connector's installation and support surfaces. */
declare const __CHATOBBY_BUILD_MODE__: "development" | "release";
declare const __CHATOBBY_DEV_GUIDE_FEED_BASE_URL__: string;

const CHATOBBY_PRODUCTION_GUIDE_FEED_BASE_URL =
  "https://raw.githubusercontent.com/TitanicEclair/chatobby-runtime/main/";
const CHATOBBY_COMPILED_DEVELOPMENT_GUIDE_FEED_BASE_URL =
  typeof __CHATOBBY_BUILD_MODE__ !== "undefined" &&
  __CHATOBBY_BUILD_MODE__ === "development" &&
  typeof __CHATOBBY_DEV_GUIDE_FEED_BASE_URL__ !== "undefined"
    ? __CHATOBBY_DEV_GUIDE_FEED_BASE_URL__
    : "";
const CHATOBBY_GUIDE_FEED_BASE_URL =
  CHATOBBY_COMPILED_DEVELOPMENT_GUIDE_FEED_BASE_URL ||
  CHATOBBY_PRODUCTION_GUIDE_FEED_BASE_URL;

export const CHATOBBY_CONNECTOR_REPOSITORY_URL = "https://github.com/TitanicEclair/chatobby-obsidian";
export const CHATOBBY_RUNTIME_RELEASES_URL = "https://github.com/TitanicEclair/chatobby-runtime/releases/latest";
export const CHATOBBY_GUIDE_CHANNEL_URL = new URL("guide-channel.json", CHATOBBY_GUIDE_FEED_BASE_URL).toString();
export const CHATOBBY_SUPPORT_URL = "https://github.com/TitanicEclair/chatobby-obsidian/issues";
export const CHATOBBY_PATREON_URL = "https://www.patreon.com/cw/MadelynCruzTan/membership";
export const BRAVE_SEARCH_API_DOCUMENTATION_URL =
  "https://api-dashboard.search.brave.com/app/documentation/web-search/get-started";

/** Open a documented public Chatobby location outside the current Obsidian view. */
export function openChatobbyUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Resolve one signed descriptor's immutable GitHub release asset. */
export function chatobbyRuntimeBundleUrl(version: string, file: string): string {
  return `https://github.com/TitanicEclair/chatobby-runtime/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(file)}`;
}

/** Resolve the immutable signed index paired with one connector version. */
export function chatobbyRuntimeIndexUrl(version: string): string {
  return `https://github.com/TitanicEclair/chatobby-runtime/releases/download/${encodeURIComponent(version)}/runtime-index.json`;
}

/** Resolve one immutable guide revision named by the signed stable channel. */
export function chatobbyGuideChannelAssetUrl(file: string): string {
  if (!/^guides\/chatobby-guide-[0-9A-Za-z.-]+\.json$/u.test(file)) {
    throw new Error("Chatobby guide channel asset path is invalid");
  }
  const encoded = file.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return new URL(encoded, CHATOBBY_GUIDE_FEED_BASE_URL).toString();
}
