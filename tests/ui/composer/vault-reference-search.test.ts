import { describe, expect, it } from "vitest";
import { TFile, TFolder, type App } from "obsidian";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FrontendProjectRootViewModel } from "../../../src/vendor/chatobby-client/frontend-contracts.js";
import {
  searchVaultReferences,
  searchWorkspaceReferences,
} from "../../../src/ui/composer/vault-reference-search";

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

  it("prefers shallow files and folders inside the active Vault-backed Project root", () => {
    const app = {
      vault: {
        configDir: ".obsidian",
        getAllLoadedFiles: () => [
          new TFile("Unrelated/First alphabetically.md"),
          new TFile("Projects/Alpha/Plan.md"),
          new TFolder("Projects/Alpha/Notes"),
          new TFile("Projects/Alpha/Notes/Deep.md"),
        ],
      },
    } as unknown as App;
    const matches = searchVaultReferences(app, "", {
      activeRootId: "root:alpha",
      roots: [projectRoot({
        rootId: "root:alpha",
        locationKind: "vault-relative",
        vaultRelativePath: "Projects/Alpha",
      })],
    });

    expect(matches.slice(0, 3).map((entry) => entry.path)).toEqual([
      "Projects/Alpha/Notes",
      "Projects/Alpha/Plan.md",
      "Projects/Alpha/Notes/Deep.md",
    ]);
    expect(matches[0]?.relativePath).toBe("Notes");
  });

  it("discovers files and folders from an active external Project root", async () => {
    const directory = mkdtempSync(join(tmpdir(), "chatobby-reference-root-"));
    try {
      mkdirSync(join(directory, "docs"));
      writeFileSync(join(directory, "README.md"), "root");
      writeFileSync(join(directory, "docs", "spec.md"), "spec");
      const app = {
        vault: { configDir: ".obsidian", getAllLoadedFiles: () => [new TFile("Vault Note.md")] },
      } as unknown as App;

      const matches = await searchWorkspaceReferences(app, "", {
        activeRootId: "root:external",
        roots: [projectRoot({
          rootId: "root:external",
          directoryId: "directory:external",
          label: "External App",
          locationKind: "external",
          localPath: directory,
        })],
      });

      expect(matches[0]).toEqual(expect.objectContaining({
        kind: "folder",
        scope: "project",
        relativePath: "docs",
        localPath: join(directory, "docs"),
      }));
      expect(matches).toEqual(expect.arrayContaining([
        expect.objectContaining({ promptPath: join(directory, "README.md"), relativePath: "README.md" }),
        expect.objectContaining({ promptPath: join(directory, "docs", "spec.md"), relativePath: "docs/spec.md" }),
      ]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function projectRoot(
  overrides: Partial<FrontendProjectRootViewModel>,
): FrontendProjectRootViewModel {
  return {
    rootId: "root:test",
    directoryId: "directory:test",
    label: "Test",
    primary: true,
    locationKind: "external",
    directoryReuse: "none",
    markerPolicy: "recommended",
    recoveryMode: "marker",
    availability: "available",
    availabilityLabel: "Available",
    ...overrides,
  };
}
