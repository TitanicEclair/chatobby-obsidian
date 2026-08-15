import type { App } from "obsidian";
import type { ObsidianFileConventionFactsV1, VaultEnvironment } from "../types";

interface EnvironmentOptions {
  chatobbyVersion?: string;
  now?: Date;
}

type RuntimeApp = App & { version?: unknown };
type NavigatorWithDeviceInfo = Navigator & {
  deviceMemory?: unknown;
  userAgentData?: { platform?: unknown };
};

export function gatherEnvironmentContext(app: App, options: EnvironmentOptions = {}): VaultEnvironment {
  const now = options.now ?? new Date();
  const environment: VaultEnvironment = {
    time: {
      sentAtUtc: now.toISOString(),
      localDate: formatLocalDate(now),
      localTime: formatLocalTime(now),
      timeZone: getTimeZone(),
      utcOffsetMinutes: -now.getTimezoneOffset(),
    },
  };

  const nav = typeof navigator === "undefined" ? null : navigator;
  if (nav) {
    environment.locale = compactObject({
      primary: nav.language,
      languages: nav.languages?.length ? Array.from(nav.languages) : undefined,
    });

    const deviceInfo = nav as NavigatorWithDeviceInfo;
    const deviceMemory = deviceInfo.deviceMemory;
    environment.device = compactObject({
      platform: typeof deviceInfo.userAgentData?.platform === "string"
        ? deviceInfo.userAgentData.platform
        : undefined,
      userAgent: nav.userAgent,
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemoryGb: typeof deviceMemory === "number" ? deviceMemory : undefined,
    });
  }

  const win = typeof window === "undefined" ? null : window;
  if (win) {
    environment.display = compactObject({
      viewportWidth: win.innerWidth,
      viewportHeight: win.innerHeight,
      screenWidth: win.screen?.width,
      screenHeight: win.screen?.height,
      devicePixelRatio: win.devicePixelRatio,
      colorScheme: win.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    });
  }

  const obsidianVersion = (app as RuntimeApp).version;
  environment.app = compactObject({
    obsidianVersion: typeof obsidianVersion === "string" ? obsidianVersion : undefined,
    chatobbyVersion: options.chatobbyVersion,
  });

  environment.fileConventions = gatherFileConventionFacts(app, now);

  return environment;
}

type ConfigurableVault = { getConfig?: (key: string) => unknown };

export function gatherFileConventionFacts(app: App, now = new Date()): ObsidianFileConventionFactsV1 {
  const configurableVault = app.vault as unknown as ConfigurableVault;
  const getConfig = configurableVault.getConfig;
  const unavailable = (): ObsidianFileConventionFactsV1 => ({
    schemaVersion: 1,
    revision: "unavailable",
    observedAt: now.toISOString(),
    observationStatus: "unavailable",
  });
  if (typeof getConfig !== "function") return unavailable();
  try {
    const useMarkdownLinks: unknown = getConfig.call(configurableVault, "useMarkdownLinks");
    const linkFormat: unknown = getConfig.call(configurableVault, "newLinkFormat");
    const attachmentFolderPath: unknown = getConfig.call(configurableVault, "attachmentFolderPath");
    if (
      typeof useMarkdownLinks !== "boolean" ||
      typeof linkFormat !== "string" ||
      typeof attachmentFolderPath !== "string"
    ) {
      return unavailable();
    }
    const pathStyle: NonNullable<ObsidianFileConventionFactsV1["generatedLinks"]>["pathStyle"] | undefined =
      linkFormat === "shortest"
        ? "shortest"
        : linkFormat === "relative"
          ? "relative"
          : linkFormat === "absolute"
            ? "vault-absolute"
            : undefined;
    const newAttachments = normalizeAttachmentLocation(attachmentFolderPath);
    if (!pathStyle || !newAttachments) return unavailable();
    const normalized = {
      generatedLinks: { syntax: useMarkdownLinks ? ("markdown" as const) : ("wikilink" as const), pathStyle },
      newAttachments,
    };
    return {
      schemaVersion: 1,
      revision: stableFactRevision(JSON.stringify(normalized)),
      observedAt: now.toISOString(),
      observationStatus: "exact",
      ...normalized,
    };
  } catch {
    return unavailable();
  }
}

function normalizeAttachmentLocation(value: string): ObsidianFileConventionFactsV1["newAttachments"] | undefined {
  if (value === "/") return { mode: "vault-root" };
  if (value === "./") return { mode: "same-folder-as-source" };
  if (value.startsWith("./") && value.length > 2) {
    return { mode: "subfolder-under-source", subfolderName: value.slice(2) };
  }
  const normalized = value.replaceAll("\\", "/").replace(/^\/+|\/+$/gu, "");
  return normalized ? { mode: "vault-folder", vaultRelativePath: normalized } : undefined;
}

function stableFactRevision(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `file-conventions-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function formatLocalDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatLocalTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function getTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): T | undefined {
  for (const entry of Object.values(value)) {
    if (entry !== undefined) return value;
  }
  return undefined;
}
