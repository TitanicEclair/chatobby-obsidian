import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectPublicDocumentation, writeAtomically } from "../../scripts/project-public-documentation.mjs";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("public documentation projection", () => {
  it("reports an exact dry run without changing documentation or release files", async () => {
    const source = await temporaryRepository("chatobby-doc-source-", "TitanicEclair/chatobby");
    const destination = await temporaryRepository("chatobby-doc-public-", "TitanicEclair/chatobby-obsidian");
    await writePolicy(source);
    await mkdir(join(source, "docs"), { recursive: true });
    await mkdir(join(destination, "docs"), { recursive: true });
    await writeFile(join(source, "README.md"), "# Current docs\n");
    await writeFile(join(source, "docs", "setup.md"), "# Setup\n");
    await writeFile(join(destination, "README.md"), "# Old docs\n");
    await writeFile(join(destination, "docs", "retired.md"), "# Retired\n");
    await writeFile(join(destination, "manifest.json"), "{\"version\":\"0.4.3\"}\n");

    const receipt = await projectPublicDocumentation({
      repositoryRoot: source,
      destination,
      apply: false,
      sourceRevision: "source-sha",
      destinationRevision: "public-sha",
    });

    expect(receipt).toMatchObject({
      mode: "dry-run",
      sourceRevision: "source-sha",
      destinationRevision: "public-sha",
      releaseAssetsChanged: false,
      changes: [
        { path: "README.md", action: "update" },
        { path: "docs/setup.md", action: "add" },
        { path: "docs/retired.md", action: "delete" },
      ],
    });
    await expect(readFile(join(destination, "README.md"), "utf8")).resolves.toBe("# Old docs\n");
    await expect(readFile(join(destination, "docs", "retired.md"), "utf8")).resolves.toBe("# Retired\n");
    await expect(readFile(join(destination, "manifest.json"), "utf8")).resolves.toBe("{\"version\":\"0.4.3\"}\n");
  });

  it("applies only allowlisted Markdown to a clean public checkout", async () => {
    const source = await temporaryRepository("chatobby-doc-source-", "TitanicEclair/chatobby");
    const destination = await temporaryRepository("chatobby-doc-public-", "TitanicEclair/chatobby-obsidian");
    await writePolicy(source);
    await mkdir(join(source, "docs"), { recursive: true });
    await mkdir(join(destination, "docs"), { recursive: true });
    await writeFile(join(source, "README.md"), "# Current docs\n");
    await writeFile(join(source, "docs", "setup.md"), "# Setup\n");
    await writeFile(join(destination, "README.md"), "# Old docs\n");
    await writeFile(join(destination, "docs", "retired.md"), "# Retired\n");
    await commitAll(destination);
    await commitAll(source);

    const receipt = await projectPublicDocumentation({
      repositoryRoot: source,
      destination,
      apply: true,
      sourceRevision: "source-sha",
      destinationRevision: "public-sha",
      verifyCheckout: true,
    });

    expect(receipt.mode).toBe("apply");
    await expect(readFile(join(destination, "README.md"), "utf8")).resolves.toBe("# Current docs\n");
    await expect(readFile(join(destination, "docs", "setup.md"), "utf8")).resolves.toBe("# Setup\n");
    await expect(readFile(join(destination, "docs", "retired.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects non-document paths and a dirty public checkout", async () => {
    const source = await temporaryRepository("chatobby-doc-source-", "TitanicEclair/chatobby");
    const destination = await temporaryRepository("chatobby-doc-public-", "TitanicEclair/chatobby-obsidian");
    await mkdir(join(source, "config"), { recursive: true });
    await writeFile(join(source, "config", "public-documentation-projection.json"), JSON.stringify({
      schemaVersion: 1,
      sourceRepository: "TitanicEclair/chatobby",
      destinationRepository: "TitanicEclair/chatobby-obsidian",
      files: ["manifest.json"],
      retiredFiles: [],
    }));

    await expect(projectPublicDocumentation({ repositoryRoot: source, destination })).rejects.toThrow(
      "may contain only README.md or docs/*.md",
    );

    await writePolicy(source);
    await mkdir(join(source, "docs"), { recursive: true });
    await writeFile(join(source, "README.md"), "# Current docs\n");
    await writeFile(join(source, "docs", "setup.md"), "# Setup\n");
    await commitAll(source);
    await writeFile(join(destination, "uncommitted.txt"), "do not overwrite\n");
    await expect(projectPublicDocumentation({
      repositoryRoot: source,
      destination,
      apply: true,
      sourceRevision: "source-sha",
      destinationRevision: "public-sha",
      verifyCheckout: true,
    })).rejects.toThrow("requires a clean destination checkout");
  });

  it("does not delete a pre-existing temporary path when atomic creation fails", async () => {
    const destination = await temporaryRepository("chatobby-doc-public-", "TitanicEclair/chatobby-obsidian");
    const target = join(destination, "README.md");
    const preExisting = `${target}.chatobby-docs-${process.pid}.tmp`;
    await writeFile(preExisting, "owned by another process\n");

    await expect(writeAtomically(target, Buffer.from("replacement\n"))).rejects.toMatchObject({ code: "EEXIST" });
    await expect(readFile(preExisting, "utf8")).resolves.toBe("owned by another process\n");
  });

  it("rejects a destination path whose parent is a symbolic link or junction", async () => {
    const source = await temporaryRepository("chatobby-doc-source-", "TitanicEclair/chatobby");
    const destination = await temporaryRepository("chatobby-doc-public-", "TitanicEclair/chatobby-obsidian");
    const outside = await temporaryRepository("chatobby-doc-outside-", "TitanicEclair/outside");
    await writePolicy(source);
    await mkdir(join(source, "docs"), { recursive: true });
    await mkdir(join(outside, "docs"), { recursive: true });
    await writeFile(join(source, "README.md"), "# Current docs\n");
    await writeFile(join(source, "docs", "setup.md"), "# Setup\n");
    await writeFile(join(destination, "README.md"), "# Old docs\n");
    await symlink(join(outside, "docs"), join(destination, "docs"), process.platform === "win32" ? "junction" : "dir");

    await expect(projectPublicDocumentation({
      repositoryRoot: source,
      destination,
      apply: false,
      sourceRevision: "source-sha",
      destinationRevision: "public-sha",
    })).rejects.toThrow("rejects symbolic-link or junction paths: docs/setup.md");
    await expect(readFile(join(outside, "docs", "setup.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a relative destination before resolving it", async () => {
    const source = await temporaryRepository("chatobby-doc-source-", "TitanicEclair/chatobby");
    await writePolicy(source);

    await expect(projectPublicDocumentation({
      repositoryRoot: source,
      destination: "relative-public-checkout",
      sourceRevision: "source-sha",
      destinationRevision: "public-sha",
    })).rejects.toThrow("destination must be absolute");
  });
});

async function temporaryRepository(prefix: string, remote: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  execFileSync("git", ["init", "--quiet", directory]);
  execFileSync("git", ["-C", directory, "remote", "add", "origin", `https://github.com/${remote}.git`]);
  return directory;
}

async function writePolicy(root: string): Promise<void> {
  await mkdir(join(root, "config"), { recursive: true });
  await writeFile(join(root, "config", "public-documentation-projection.json"), JSON.stringify({
    schemaVersion: 1,
    sourceRepository: "TitanicEclair/chatobby",
    destinationRepository: "TitanicEclair/chatobby-obsidian",
    files: ["README.md", "docs/setup.md"],
    retiredFiles: ["docs/retired.md"],
  }));
}

async function commitAll(root: string): Promise<void> {
  execFileSync("git", ["-C", root, "add", "--all"]);
  execFileSync("git", ["-C", root, "-c", "user.name=Chatobby Tests", "-c", "user.email=tests@chatobby.local", "commit", "--quiet", "-m", "fixture"]);
}
