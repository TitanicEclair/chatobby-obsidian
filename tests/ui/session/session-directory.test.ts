import { describe, expect, it } from "vitest";
import {
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
