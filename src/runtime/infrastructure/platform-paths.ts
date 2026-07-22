import { homedir } from "node:os";
import { join, posix, win32 } from "node:path";

export interface RuntimePlatformEnvironment {
  platform: NodeJS.Platform;
  home: string;
  localAppData?: string;
  xdgDataHome?: string;
  xdgRuntimeDir?: string;
}

export interface ChatobbyPlatformPaths {
  applicationSupportRoot: string;
  runtimeInstallRoot: string;
  runtimeLeasesRoot: string;
  runtimeLogsRoot: string;
}

/** Resolve every machine-local Chatobby path from one platform contract. */
export function resolveChatobbyPlatformPaths(
  environment: RuntimePlatformEnvironment = currentRuntimePlatformEnvironment(),
): ChatobbyPlatformPaths {
  if (environment.platform === "win32") {
    const applicationSupportRoot = win32.join(
      environment.localAppData ?? win32.join(environment.home, "AppData", "Local"),
      "Chatobby",
    );
    const runtimeLeasesRoot = win32.join(applicationSupportRoot, "runtimes");
    return {
      applicationSupportRoot,
      runtimeInstallRoot: win32.join(applicationSupportRoot, "runtime"),
      runtimeLeasesRoot,
      runtimeLogsRoot: runtimeLeasesRoot,
    };
  }

  if (environment.platform === "darwin") {
    const applicationSupportRoot = posix.join(environment.home, "Library", "Application Support", "Chatobby");
    return {
      applicationSupportRoot,
      runtimeInstallRoot: posix.join(applicationSupportRoot, "runtime"),
      runtimeLeasesRoot: posix.join(applicationSupportRoot, "runtimes"),
      runtimeLogsRoot: posix.join(environment.home, "Library", "Logs", "Chatobby"),
    };
  }

  const applicationSupportRoot = posix.join(
    environment.xdgDataHome ?? posix.join(environment.home, ".local", "share"),
    "Chatobby",
  );
  return {
    applicationSupportRoot,
    runtimeInstallRoot: posix.join(applicationSupportRoot, "runtime"),
    runtimeLeasesRoot: environment.xdgRuntimeDir
      ? posix.join(environment.xdgRuntimeDir, "Chatobby", "runtimes")
      : posix.join(environment.home, ".chatobby", "runtimes"),
    runtimeLogsRoot: posix.join(applicationSupportRoot, "logs"),
  };
}

export function runtimeInstallRoot(): string {
  return resolveChatobbyPlatformPaths().runtimeInstallRoot;
}

export function runtimeInstancePaths(vaultId: string): {
  directory: string;
  descriptorFile: string;
  controlTokenFile: string;
  sessionTokenFile: string;
  logFile: string;
} {
  const paths = resolveChatobbyPlatformPaths();
  const directory = join(paths.runtimeLeasesRoot, vaultId);
  return {
    directory,
    descriptorFile: join(directory, "ready.json"),
    controlTokenFile: join(directory, "control.token"),
    sessionTokenFile: join(directory, "session.token"),
    logFile: join(paths.runtimeLogsRoot, vaultId, "runtime.log"),
  };
}

function currentRuntimePlatformEnvironment(): RuntimePlatformEnvironment {
  return {
    platform: process.platform,
    home: homedir(),
    localAppData: process.env.LOCALAPPDATA,
    xdgDataHome: process.env.XDG_DATA_HOME,
    xdgRuntimeDir: process.env.XDG_RUNTIME_DIR,
  };
}
