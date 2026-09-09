import { win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveChatobbyPlatformPaths, runtimeDevelopmentPairsRoot } from "../../src/runtime/infrastructure/platform-paths";

describe("Chatobby platform paths", () => {
  it("uses the canonical external development namespace on all supported platforms", () => {
    expect(runtimeDevelopmentPairsRoot({ platform: "win32", home: "C:\\Users\\tester", localAppData: "D:\\Local" })).toBe("D:\\Local\\Chatobby\\runtime\\development-pairs");
    expect(runtimeDevelopmentPairsRoot({ platform: "darwin", home: "/Users/tester" })).toBe("/Users/tester/Library/Application Support/Chatobby/runtime/development-pairs");
    expect(runtimeDevelopmentPairsRoot({ platform: "linux", home: "/home/tester", xdgDataHome: "/data", xdgStateHome: "/state" })).toBe("/data/Chatobby/runtime/development-pairs");
    expect(() => runtimeDevelopmentPairsRoot({ platform: "freebsd", home: "/home/tester" })).toThrow(/unsupported/u);
  });
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

  it("uses XDG data and runtime directories on Linux", () => {
    const paths = resolveChatobbyPlatformPaths({
      platform: "linux",
      home: "/home/tester",
      xdgDataHome: "/home/tester/.data",
      xdgStateHome: "/home/tester/.state",
    });

    expect(paths.runtimeInstallRoot).toBe("/home/tester/.data/Chatobby/runtime");
    expect(paths.runtimeLeasesRoot).toBe("/home/tester/.data/Chatobby/runtimes");
    expect(paths.runtimeLogsRoot).toBe("/home/tester/.state/Chatobby");
  });

  it("falls back to private user paths when Linux XDG overrides are absent", () => {
    const paths = resolveChatobbyPlatformPaths({ platform: "linux", home: "/home/tester" });

    expect(paths.runtimeInstallRoot).toBe("/home/tester/.local/share/Chatobby/runtime");
    expect(paths.runtimeLeasesRoot).toBe("/home/tester/.local/share/Chatobby/runtimes");
    expect(paths.runtimeLogsRoot).toBe("/home/tester/.local/state/Chatobby");
  });
});
