import { win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChatobbyPlatformPaths } from "../../src/runtime/infrastructure/platform-paths";

describe("Chatobby platform paths", () => {
  it("retains the Windows account-local runtime layout", () => {
    const paths = resolveChatobbyPlatformPaths({
      platform: "win32",
      home: "C:\\Users\\tester",
      localAppData: "C:\\Users\\tester\\AppData\\Local",
    });

    expect(paths.runtimeInstallRoot).toBe(win32.join("C:\\Users\\tester\\AppData\\Local", "Chatobby", "runtime"));
    expect(paths.runtimeLeasesRoot).toBe(win32.join("C:\\Users\\tester\\AppData\\Local", "Chatobby", "runtimes"));
    expect(paths.runtimeLogsRoot).toBe(paths.runtimeLeasesRoot);
  });

  it("uses native macOS application-support and log directories", () => {
    const paths = resolveChatobbyPlatformPaths({ platform: "darwin", home: "/Users/tester" });

    expect(paths.runtimeInstallRoot).toBe("/Users/tester/Library/Application Support/Chatobby/runtime");
    expect(paths.runtimeLeasesRoot).toBe("/Users/tester/Library/Application Support/Chatobby/runtimes");
    expect(paths.runtimeLogsRoot).toBe("/Users/tester/Library/Logs/Chatobby");
  });
});
