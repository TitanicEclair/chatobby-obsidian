import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseSystemDirectories } from "../../src/features/projects/infrastructure/system-directory-picker";

describe("system Project directory picker", () => {
  const originalRequire = (window as Window & { require?: unknown }).require;

  afterEach(() => {
    Object.defineProperty(window, "require", { configurable: true, value: originalRequire });
  });

  it("uses the desktop directory chooser and returns unique selected paths", async () => {
    const showOpenDialog = vi.fn(async () => ({
      canceled: false,
      filePaths: ["C:\\Work\\Alpha", "C:\\Work\\Alpha", "C:\\Work\\Beta"],
    }));
    Object.defineProperty(window, "require", {
      configurable: true,
      value: () => ({ remote: { dialog: { showOpenDialog }, getCurrentWindow: () => "window" } }),
    });

    await expect(chooseSystemDirectories("Add folders", true)).resolves.toEqual([
      "C:\\Work\\Alpha",
      "C:\\Work\\Beta",
    ]);
    expect(showOpenDialog).toHaveBeenCalledWith("window", {
      title: "Add folders",
      properties: ["openDirectory", "createDirectory", "multiSelections"],
    });
  });

  it("fails clearly when the Obsidian window cannot expose a desktop chooser", async () => {
    Object.defineProperty(window, "require", { configurable: true, value: undefined });
    await expect(chooseSystemDirectories("Choose folder", false)).rejects.toThrow(
      "system folder chooser is unavailable",
    );
  });
});
