import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportReviewableSource } from "../../scripts/export-reviewable-source.mjs";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("reviewable connector export", () => {
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
