import { describe, expect, it, vi } from "vitest";
import { LeafDirectoryRouter } from "../../../src/ui/session/leaf-directory-router";

describe("LeafDirectoryRouter", () => {
  it("opens a separate leaf instead of mutating a leaf that already owns sessions", async () => {
    const current = { id: "current" };
    const project = { id: "project" };
    const setCurrentDirectory = vi.fn(async () => undefined);
    const rememberDefaultDirectory = vi.fn(async () => undefined);
    const openDirectoryTarget = vi.fn(async () => project);
    const ensureDirectoryTarget = vi.fn(async () => undefined);
    const router = new LeafDirectoryRouter({
      currentTarget: () => current,
      currentDirectory: () => "Inbox",
      hasSessions: () => true,
      isDirectory: () => true,
      setCurrentDirectory,
      rememberDefaultDirectory,
      openDirectoryTarget,
      openSessionTarget: vi.fn(),
      ensureDirectoryTarget,
      closeCurrentExplorer: vi.fn(),
      resumeInTarget: vi.fn(),
      createInTarget: vi.fn(),
    });

    await expect(router.use("Projects/Research")).resolves.toBe(project);

    expect(setCurrentDirectory).not.toHaveBeenCalled();
    expect(rememberDefaultDirectory).toHaveBeenCalledWith("Projects/Research");
    expect(openDirectoryTarget).toHaveBeenCalledWith("Projects/Research");
    expect(ensureDirectoryTarget).toHaveBeenCalledWith(project);
  });

  it("lets an empty leaf adopt the selected directory", async () => {
    const current = { id: "current" };
    const setCurrentDirectory = vi.fn(async () => undefined);
    const ensureDirectoryTarget = vi.fn(async () => undefined);
    const router = new LeafDirectoryRouter({
      currentTarget: () => current,
      currentDirectory: () => "Inbox",
      hasSessions: () => false,
      isDirectory: () => true,
      setCurrentDirectory,
      rememberDefaultDirectory: vi.fn(),
      openDirectoryTarget: vi.fn(),
      openSessionTarget: vi.fn(),
      ensureDirectoryTarget,
      closeCurrentExplorer: vi.fn(),
      resumeInTarget: vi.fn(),
      createInTarget: vi.fn(),
    });

    await expect(router.use("Projects/Research/")).resolves.toBe(current);
    expect(setCurrentDirectory).toHaveBeenCalledWith("Projects/Research");
    expect(ensureDirectoryTarget).toHaveBeenCalledWith(current);
  });

  it("resumes a stored session in the directory-owned target leaf", async () => {
    const current = { id: "current" };
    const project = { id: "project" };
    const closeCurrentExplorer = vi.fn();
    const resumeInTarget = vi.fn(async () => undefined);
    const openSessionTarget = vi.fn(async () => project);
    const router = new LeafDirectoryRouter({
      currentTarget: () => current,
      currentDirectory: () => "Inbox",
      hasSessions: () => true,
      isDirectory: () => true,
      setCurrentDirectory: vi.fn(),
      rememberDefaultDirectory: vi.fn(async () => undefined),
      openDirectoryTarget: vi.fn(),
      openSessionTarget,
      ensureDirectoryTarget: vi.fn(),
      closeCurrentExplorer,
      resumeInTarget,
      createInTarget: vi.fn(),
    });

    await router.resume("C:/Vault/Projects/Research/session.jsonl", "Projects/Research");

    expect(closeCurrentExplorer).toHaveBeenCalledOnce();
    expect(openSessionTarget).toHaveBeenCalledWith(
      "Projects/Research",
      "C:/Vault/Projects/Research/session.jsonl",
    );
    expect(resumeInTarget).toHaveBeenCalledWith(project, "C:/Vault/Projects/Research/session.jsonl");
  });

  it("creates another session in a separate leaf even when the directory is unchanged", async () => {
    const current = { id: "current" };
    const next = { id: "next" };
    const createInTarget = vi.fn(async () => undefined);
    const closeCurrentExplorer = vi.fn();
    const openSessionTarget = vi.fn(async () => next);
    const router = new LeafDirectoryRouter({
      currentTarget: () => current,
      currentDirectory: () => "Projects/Research",
      hasSessions: () => true,
      isDirectory: () => true,
      setCurrentDirectory: vi.fn(),
      rememberDefaultDirectory: vi.fn(async () => undefined),
      openDirectoryTarget: vi.fn(),
      openSessionTarget,
      ensureDirectoryTarget: vi.fn(),
      closeCurrentExplorer,
      resumeInTarget: vi.fn(),
      createInTarget,
    });

    await router.create("Projects/Research");

    expect(openSessionTarget).toHaveBeenCalledWith("Projects/Research", undefined);
    expect(createInTarget).toHaveBeenCalledWith(next);
    expect(closeCurrentExplorer).toHaveBeenCalledOnce();
  });
});
