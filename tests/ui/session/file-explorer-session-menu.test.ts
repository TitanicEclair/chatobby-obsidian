import { Menu, TFile, TFolder, type TAbstractFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
  addFileExplorerSessionMenuItems,
  resolveFileExplorerDirectory,
} from "../../../src/ui/session/file-explorer-session-menu";

describe("file explorer Chatobby session menu", () => {
  it("uses the selected folder directly", () => {
    const folder = new TFolder("Projects/Research") as unknown as TAbstractFile;

    expect(resolveFileExplorerDirectory(folder)).toBe("Projects/Research");
  });

  it("uses a selected file's parent folder and supports the vault root", () => {
    const file = new TFile("Projects/Research/brief.md") as unknown as TFile & { parent: TFolder | null };
    file.parent = new TFolder("Projects/Research");
    const rootFile = new TFile("Inbox.md") as unknown as TFile & { parent: TFolder | null };
    rootFile.parent = new TFolder("/");

    expect(resolveFileExplorerDirectory(file as unknown as TAbstractFile)).toBe("Projects/Research");
    expect(resolveFileExplorerDirectory(rootFile as unknown as TAbstractFile)).toBe("");
  });

  it("routes both native menu actions through the resolved directory", async () => {
    const startNewSession = vi.fn(async () => {});
    const resumeSession = vi.fn(async () => {});
    const file = new TFile("Projects/Research/brief.md") as unknown as TFile & { parent: TFolder | null };
    file.parent = new TFolder("Projects/Research");
    const menu = new Menu();

    addFileExplorerSessionMenuItems(menu, file as unknown as TAbstractFile, {
      startNewSession,
      resumeSession,
    });

    expect(menu.items.map((item) => [item.title, item.icon, item.section])).toEqual([
      ["New Chatobby session here", "message-square-plus", "chatobby"],
      ["Resume Chatobby session here", "history", "chatobby"],
    ]);
    menu.items[0]?.callback?.();
    menu.items[1]?.callback?.();
    await vi.waitFor(() => {
      expect(startNewSession).toHaveBeenCalledWith("Projects/Research");
      expect(resumeSession).toHaveBeenCalledWith("Projects/Research");
    });
  });
});
