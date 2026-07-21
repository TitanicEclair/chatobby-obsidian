import type { App } from "obsidian";
import type { VaultEnvironment } from "../types";

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

  return environment;
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
