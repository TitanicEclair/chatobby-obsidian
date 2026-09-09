import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareCiConnectorArtifact } from "../../scripts/prepare-ci-connector-artifact.mjs";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("connector CI artifact preparation", () => {
  it("records exact hashes and proves the disposable-vault install contract", async () => {
    const sourceRoot = await temporaryDirectory("chatobby-ci-artifact-source-");
    const outputRoot = await temporaryDirectory("chatobby-ci-artifact-output-");
    await writeFile(join(sourceRoot, "main.js"), "connector main\n");
    await writeFile(join(sourceRoot, "manifest.json"), '{"id":"chatobby","version":"test"}\n');
    await writeFile(join(sourceRoot, "styles.css"), "connector styles\n");

    const result = await prepareCiConnectorArtifact({
      sourceRoot,
      outputRoot,
      revision: "0123456789abcdef",
    });

    expect(result.receipt.sourceRevision).toBe("0123456789abcdef");
    expect(result.receipt.officialArtifactNames).toEqual(["main.js", "manifest.json", "styles.css"]);
    expect(result.receipt.temporaryVaultInstallContract).toEqual({
      passed: true,
      preservedPluginData: true,
      preservedRuntimeState: true,
      reloadPerformed: false,
    });
    for (const file of result.receipt.files) {
      const bytes = await readFile(join(outputRoot, file.name));
      expect(file.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
    const saved = JSON.parse(await readFile(join(outputRoot, "connector-artifact-receipt.json"), "utf8"));
    expect(saved).toEqual(result.receipt);
  });
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}
