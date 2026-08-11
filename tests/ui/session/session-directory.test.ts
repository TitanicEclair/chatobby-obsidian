import { describe, expect, it } from "vitest";
import {
  normalizeVaultDirectoryForBase,
  normalizeVaultDirectoryInput,
  resolveVaultDirectoryCwd,
  vaultDirectoryTabName,
} from "../../../src/ui/session/session-directory";

describe("session directory helpers", () => {
  it("normalizes vault-relative directory input", () => {
    expect(normalizeVaultDirectoryInput(" Projects/Foo/ ")).toBe("Projects/Foo");
    expect(normalizeVaultDirectoryInput("\\Projects\\Foo\\")).toBe("Projects/Foo");
    expect(normalizeVaultDirectoryInput("/")).toBe("");
    expect(normalizeVaultDirectoryInput(".")).toBe("");
  });

  it("migrates legacy absolute paths inside the current vault", () => {
    expect(normalizeVaultDirectoryForBase(
      "C:\\Final_Updated_Second_Brain - Copy (2)",
      "C:/Final_Updated_Second_Brain - Copy (2)/",
    )).toBe("");
    expect(normalizeVaultDirectoryForBase(
      "C:\\Final_Updated_Second_Brain - Copy (2)",
      "c:/final_updated_second_brain - copy (2)/Projects/Chatobby",
    )).toBe("Projects/Chatobby");
    expect(normalizeVaultDirectoryForBase(
      "/home/marvy/vault",
      "/home/marvy/vault/Projects/Chatobby/",
    )).toBe("Projects/Chatobby");
  });

  it("does not reinterpret an external absolute path as a vault directory", () => {
    expect(normalizeVaultDirectoryForBase("C:\\Vault", "D:\\External\\Project")).toBe("D:/External/Project");
    expect(normalizeVaultDirectoryForBase("/home/marvy/vault", "/srv/external/project")).toBe("/srv/external/project");
  });

  it("uses the directory basename as the default tab name", () => {
    expect(vaultDirectoryTabName("Projects/Foo", "Second Brain")).toBe("Foo");
    expect(vaultDirectoryTabName("", "Second Brain")).toBe("Second Brain");
    expect(vaultDirectoryTabName(undefined, "Second Brain")).toBe("Second Brain");
  });

  it("resolves vault-relative directories to absolute cwd paths", () => {
    expect(resolveVaultDirectoryCwd("C:\\vault", "Projects/Foo")).toBe("C:\\vault\\Projects\\Foo");
    expect(resolveVaultDirectoryCwd("/home/me/vault/", "Projects/Foo")).toBe("/home/me/vault/Projects/Foo");
    expect(resolveVaultDirectoryCwd("C:\\vault", "/")).toBe("C:\\vault");
  });
});
