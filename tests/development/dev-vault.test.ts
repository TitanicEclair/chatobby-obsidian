import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deployDevVault,
  registerDevVault,
} from "../../scripts/dev-vault.mjs";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("disposable-vault frontend deployment", () => {
  it("refuses relative, unconfirmed, and unregistered vaults", async () => {
    const { repositoryRoot, vaultRoot } = await fixture();

    await expect(registerDevVault({
      vaultRoot: relative(process.cwd(), vaultRoot),
      confirmDisposable: true,
    })).rejects.toThrow("must be an absolute path");
    await expect(registerDevVault({
      vaultRoot,
      confirmDisposable: false,
    })).rejects.toThrow("requires --confirm-disposable");
    await expect(deployDevVault(
      deploymentInput(repositoryRoot, vaultRoot, false),
      fakeDependencies(),
    )).rejects.toThrow("Disposable-vault marker is missing");
  });

  it("registers once and deploys only main.js and styles.css by default", async () => {
    const { repositoryRoot, vaultRoot, pluginDirectory } = await fixture();
    await writeInstalledFixture(pluginDirectory);

    const registration = await registerDevVault({ vaultRoot, confirmDisposable: true });
    const repeated = await registerDevVault({ vaultRoot, confirmDisposable: true });
    expect(registration.created).toBe(true);
    expect(repeated.created).toBe(false);

    const result = await deployDevVault(
      deploymentInput(repositoryRoot, vaultRoot, false),
      fakeDependencies(),
    );

    await expect(readFile(join(pluginDirectory, "main.js"), "utf8")).resolves.toBe("new main\n");
    await expect(readFile(join(pluginDirectory, "styles.css"), "utf8")).resolves.toBe("new styles\n");
    await expect(readFile(join(pluginDirectory, "manifest.json"), "utf8")).resolves.toBe("old manifest\n");
    await expect(readFile(join(pluginDirectory, "data.json"), "utf8")).resolves.toBe("user settings\n");
    await expect(readFile(join(pluginDirectory, "runtime", "current.json"), "utf8")).resolves.toBe("runtime pointer\n");
    await expect(readFile(join(pluginDirectory, "credentials", "sentinel"), "utf8")).resolves.toBe("secret boundary\n");
    await expect(readFile(join(pluginDirectory, "developer-launcher.cmd"), "utf8")).resolves.toBe("launcher\n");
    expect((await readdir(pluginDirectory)).filter((name) => name.startsWith(".chatobby-dev-"))).toEqual([]);
    expect(result.artifacts.map((artifact) => artifact.name)).toEqual(["main.js", "styles.css"]);
    for (const artifact of result.artifacts) {
      expect(artifact.installedSha256).toBe(artifact.sourceSha256);
      expect(artifact.installedSha256).toMatch(/^[a-f\d]{64}$/u);
    }
  });

  it("copies manifest.json only through the explicit option", async () => {
    const { repositoryRoot, vaultRoot, pluginDirectory } = await fixture();
    await writeInstalledFixture(pluginDirectory);
    await registerDevVault({ vaultRoot, confirmDisposable: true });

    const result = await deployDevVault(
      { ...deploymentInput(repositoryRoot, vaultRoot, false), includeManifest: true },
      fakeDependencies(),
    );

    expect(result.artifacts.map((artifact) => artifact.name)).toEqual([
      "main.js",
      "styles.css",
      "manifest.json",
    ]);
    await expect(readFile(join(pluginDirectory, "manifest.json"), "utf8")).resolves.toContain('"id":"chatobby"');
  });

  it("rolls back every installed artifact when hash verification fails", async () => {
    const { repositoryRoot, vaultRoot, pluginDirectory } = await fixture();
    await writeInstalledFixture(pluginDirectory);
    await registerDevVault({ vaultRoot, confirmDisposable: true });
    const mainTarget = join(pluginDirectory, "main.js");

    await expect(deployDevVault(
      deploymentInput(repositoryRoot, vaultRoot, false),
      fakeDependencies({
        hashFile: async (path: string) => path === mainTarget ? "0".repeat(64) : sha256File(path),
      }),
    )).rejects.toThrow("Installed hash mismatch for main.js");

    await expect(readFile(join(pluginDirectory, "main.js"), "utf8")).resolves.toBe("old main\n");
    await expect(readFile(join(pluginDirectory, "styles.css"), "utf8")).resolves.toBe("old styles\n");
    await expect(readFile(join(pluginDirectory, "data.json"), "utf8")).resolves.toBe("user settings\n");
  });

  it("rolls back an earlier replacement when a later artifact copy cannot commit", async () => {
    const { repositoryRoot, vaultRoot, pluginDirectory } = await fixture();
    await writeInstalledFixture(pluginDirectory);
    await registerDevVault({ vaultRoot, confirmDisposable: true });
    const stylesTarget = join(pluginDirectory, "styles.css");

    await expect(deployDevVault(
      deploymentInput(repositoryRoot, vaultRoot, false),
      fakeDependencies({
        renameFile: async (source: string, target: string) => {
          if (source.includes(".chatobby-dev-stage-") && target === stylesTarget) {
            throw new Error("injected copy failure");
          }
          await rename(source, target);
        },
      }),
    )).rejects.toThrow("injected copy failure");

    await expect(readFile(join(pluginDirectory, "main.js"), "utf8")).resolves.toBe("old main\n");
    await expect(readFile(join(pluginDirectory, "styles.css"), "utf8")).resolves.toBe("old styles\n");
    expect((await readdir(pluginDirectory)).filter((name) => name.startsWith(".chatobby-dev-"))).toEqual([]);
  });

  it("does not invoke Obsidian in no-reload mode", async () => {
    const { repositoryRoot, vaultRoot } = await fixture();
    await registerDevVault({ vaultRoot, confirmDisposable: true });
    const runObsidian = vi.fn();

    const result = await deployDevVault(
      deploymentInput(repositoryRoot, vaultRoot, false),
      fakeDependencies({ runObsidian }),
    );

    expect(result.reload).toBe(false);
    expect(result.developerErrors).toBe("");
    expect(runObsidian).not.toHaveBeenCalled();
  });

  it("clears errors, reloads only Chatobby, and reports the fresh error buffer", async () => {
    const { repositoryRoot, vaultRoot } = await fixture();
    await registerDevVault({ vaultRoot, confirmDisposable: true });
    const runObsidian = vi.fn()
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "fresh error", stderr: "" });

    const result = await deployDevVault(
      { ...deploymentInput(repositoryRoot, vaultRoot, true), vaultName: "Disposable Test" },
      fakeDependencies({ runObsidian }),
    );

    expect(runObsidian.mock.calls.map((call) => call[1])).toEqual([
      ["vault=Disposable Test", "dev:errors", "clear"],
      ["vault=Disposable Test", "plugin:reload", "id=chatobby"],
      ["vault=Disposable Test", "dev:errors"],
    ]);
    expect(result.developerErrors).toBe("fresh error");
  });
});

async function fixture(): Promise<{
  repositoryRoot: string;
  vaultRoot: string;
  pluginDirectory: string;
}> {
  const repositoryRoot = await temporaryDirectory("chatobby-dev-vault-source-");
  const vaultRoot = await temporaryDirectory("chatobby-dev-vault-target-");
  const pluginDirectory = join(vaultRoot, ".obsidian", "plugins", "chatobby");
  await mkdir(join(vaultRoot, ".obsidian"), { recursive: true });
  await writeFile(join(repositoryRoot, "main.js"), "new main\n");
  await writeFile(join(repositoryRoot, "styles.css"), "new styles\n");
  await writeFile(join(repositoryRoot, "manifest.json"), '{"id":"chatobby","version":"test"}\n');
  return { repositoryRoot, vaultRoot, pluginDirectory };
}

async function writeInstalledFixture(pluginDirectory: string): Promise<void> {
  await mkdir(join(pluginDirectory, "runtime"), { recursive: true });
  await mkdir(join(pluginDirectory, "credentials"), { recursive: true });
  await writeFile(join(pluginDirectory, "main.js"), "old main\n");
  await writeFile(join(pluginDirectory, "styles.css"), "old styles\n");
  await writeFile(join(pluginDirectory, "manifest.json"), "old manifest\n");
  await writeFile(join(pluginDirectory, "data.json"), "user settings\n");
  await writeFile(join(pluginDirectory, "runtime", "current.json"), "runtime pointer\n");
  await writeFile(join(pluginDirectory, "credentials", "sentinel"), "secret boundary\n");
  await writeFile(join(pluginDirectory, "developer-launcher.cmd"), "launcher\n");
}

function deploymentInput(repositoryRoot: string, vaultRoot: string, reload: boolean) {
  return {
    repositoryRoot,
    vaultRoot,
    includeManifest: false,
    reload,
    obsidianCli: "obsidian-test-double",
  };
}

function fakeDependencies(overrides: Record<string, unknown> = {}) {
  return {
    build: vi.fn(),
    gitState: vi.fn().mockResolvedValue({
      revision: "0123456789abcdef",
      dirty: true,
      changedPaths: 2,
    }),
    runObsidian: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
    ...overrides,
  };
}

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
