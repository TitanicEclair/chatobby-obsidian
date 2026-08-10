import { describe, expect, it } from "vitest";
import { TFile, TFolder, type App } from "obsidian";
import { searchVaultReferences } from "../../../src/ui/composer/vault-reference-search";

describe("searchVaultReferences", () => {
  it("searches files and folders while excluding Chatobby and Obsidian internals", () => {
    const app = {
      vault: {
        configDir: ".obsidian",
        getAllLoadedFiles: () => [
          new TFolder("Projects"),
          new TFolder("Projects/Launch"),
          new TFile("Projects/Launch/Plan.md"),
          new TFile(".chatobby/projects/private.json"),
          new TFile(".obsidian/workspace.json"),
        ],
      },
    } as unknown as App;

    const matches = searchVaultReferences(app, "pl");
    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "file", path: "Projects/Launch/Plan.md" }),
      expect.objectContaining({ kind: "folder", path: "Projects/Launch" }),
    ]));
    expect(matches[0]).toEqual(expect.objectContaining({ kind: "file", path: "Projects/Launch/Plan.md" }));
    expect(searchVaultReferences(app, "").map((entry) => entry.path)).not.toContain(".chatobby/projects/private.json");
    expect(searchVaultReferences(app, "").map((entry) => entry.path)).not.toContain(".obsidian/workspace.json");
  });

  it("excludes the Vault's configured Obsidian settings directory", () => {
    const app = {
      vault: {
        configDir: ".vault-settings",
        getAllLoadedFiles: () => [
          new TFile(".vault-settings/workspace.json"),
          new TFile(".obsidian/ordinary-note.md"),
          new TFile("Notes/Visible.md"),
        ],
      },
    } as unknown as App;

    const paths = searchVaultReferences(app, "").map((entry) => entry.path);
    expect(paths).not.toContain(".vault-settings/workspace.json");
    expect(paths).toContain(".obsidian/ordinary-note.md");
    expect(paths).toContain("Notes/Visible.md");
  });
});
