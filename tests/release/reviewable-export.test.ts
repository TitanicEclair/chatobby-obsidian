import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportReviewableSource } from "../../scripts/export-reviewable-source.mjs";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("reviewable connector export", () => {
  it("exports the current documentation link closure into a fresh publication tree", async () => {
    const destination = await temporaryDirectory("chatobby-export-current-");
    await exportReviewableSource({ repositoryRoot: resolve(import.meta.dirname, "../.."), destination });
    const missing: string[] = [];
    async function inspect(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) { await inspect(file); continue; }
        if (!entry.name.endsWith(".md")) continue;
        for (const match of (await readFile(file, "utf8")).matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
          const raw = match[1]!.trim();
          const target = (raw.startsWith("<") ? raw.slice(1, raw.indexOf(">")) : raw.split(/\s+["']/u)[0]!).split(/[?#]/u)[0]!;
          if (!target || target.startsWith("/") || /^[a-z][a-z\d+.-]*:/iu.test(target)) continue;
          try { await access(resolve(dirname(file), decodeURIComponent(target))); }
          catch { missing.push(`${relative(destination, file)} -> ${target}`); }
        }
      }
    }
    await inspect(destination);
    expect(missing).toEqual([]);
  });
  it("fails strict export on publication gaps and records them in a draft", async () => {
    const repositoryRoot = await temporaryDirectory("chatobby-export-source-");
    const destination = await temporaryDirectory("chatobby-export-output-");
    await writeFixture(repositoryRoot);

    await expect(exportReviewableSource({ repositoryRoot, destination, draft: false })).rejects.toThrow(
      "missing publication files: LICENSE.md",
    );
    await expect(exportReviewableSource({ repositoryRoot, destination, draft: true })).resolves.toMatchObject({
      destination,
      publicationGaps: ["LICENSE.md"],
    });
    await expect(readFile(join(destination, "src", "main.ts"), "utf8")).resolves.toBe("export const value = 1;\n");
    await expect(readFile(join(destination, "RELEASE_NOTES_0.3.2.md"), "utf8")).resolves.toBe("# Release 0.3.2\n");
    await expect(readFile(join(destination, "RELEASE_NOTES_latest.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(destination, "publication-gaps.json"), "utf8")).resolves.toContain("LICENSE.md");
  });
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

async function writeFixture(root: string): Promise<void> {
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "README.md"), "# Connector\n");
  await writeFile(join(root, "RELEASE_NOTES_0.3.2.md"), "# Release 0.3.2\n");
  await writeFile(join(root, "RELEASE_NOTES_latest.md"), "# Not a versioned release\n");
  await writeFile(join(root, "src", "main.ts"), "export const value = 1;\n");
  await writeFile(
    join(root, "boundary-manifest.json"),
    JSON.stringify({
      reviewableExportFiles: ["README.md", "boundary-manifest.json"],
      reviewableExportRoots: ["src"],
      requiredPublicationFiles: ["LICENSE.md"],
    }),
  );
}
